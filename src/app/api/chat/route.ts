import { classifyAction, isHighRisk } from '@/lib/risk-classifier';
import { logAction } from '@/lib/audit-logger';
import { isFGAConfigured, checkPermission } from '@/lib/fga';
import { getSlackToken, readSlackChannels, postSlackMessage } from '@/lib/services/slack';
import { getCurrentUserAccessToken } from '@/lib/auth0';
import { isAuth0Configured, safeGetSession } from '@/lib/auth-config';
import { NextResponse } from 'next/server';
import { AuditEntry } from '@/types/audit';

export const maxDuration = 30;

function getLatestMessageText(
  message: { content?: string; parts?: Array<{ type?: string; text?: string }> } | undefined
) {
  if (!message) {
    return '';
  }

  if (typeof message.content === 'string') {
    return message.content;
  }

  return (message.parts ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join(' ')
    .trim();
}

function formatChannelsResponse(
  channels: Awaited<ReturnType<typeof readSlackChannels>>,
  fgaNote?: string
) {
  if (channels.length === 0) {
    return [
      'No Slack channels were returned for this user.',
      fgaNote,
      'Confirm the Slack connected account can access the workspace channels you expect.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  const lines = channels
    .slice(0, 25)
    .map((channel) => `- #${channel.name} (${channel.is_private ? 'private' : 'public'})`);

  return [
    'Here are the Slack channels available through Auth0 Token Vault:',
    lines.join('\n'),
    channels.length > 25 ? `Showing 25 of ${channels.length} channels.` : null,
    fgaNote,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function formatHelpResponse() {
  return [
    'SecureDesk is currently running in deterministic demo mode, without OpenAI.',
    'Supported commands:',
    '- `List my Slack channels`',
    '- `Show my Slack channels`',
    '- `Post a message to #general saying: Hello from SecureDesk`',
    'Gmail and Jira remain scaffolded in the repo, but the live demo path is Slack through Auth0 Token Vault.',
  ].join('\n\n');
}

function isSlackListRequest(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes('slack') &&
    lower.includes('channel') &&
    /(list|show|read|display|what)/i.test(lower)
  );
}

function extractSlackPostRequest(message: string) {
  const patterns = [
    /post\s+(?:a\s+)?message\s+to\s+(#[\w-]+|[CGD][A-Z0-9]+)\s+(?:saying|that says|with text)\s*:?\s*([\s\S]+)/i,
    /send\s+(?:a\s+)?slack\s+message\s+to\s+(#[\w-]+|[CGD][A-Z0-9]+)\s+(?:saying|that says|with text)\s*:?\s*([\s\S]+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return {
        channel: match[1].trim(),
        text: match[2].trim(),
      };
    }
  }

  return null;
}

async function evaluateToolPermission(userId: string, action: string) {
  if (!isFGAConfigured()) {
    return {
      allowed: true,
      note: 'Auth0 FGA is not configured yet, so SecureDesk allowed this action in demo mode. Configure FGA before judging.',
    };
  }

  const allowed = await checkPermission(userId, 'invoke', 'tool', action);

  if (!allowed) {
    return {
      allowed: false,
      note: `Auth0 FGA denied access to tool:${action} for the current user.`,
    };
  }

  return { allowed: true, note: null };
}

async function getSlackProviderTokenForCurrentUser() {
  const apiAccessToken = await getCurrentUserAccessToken();

  try {
    return await getSlackToken(apiAccessToken);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to exchange a Slack provider token.';

    if (
      message.includes('federated_connection_refresh_token_not_found') ||
      message.includes('No Slack connected account')
    ) {
      throw new Error(
        'No Slack connected account exists for this user yet. Go to Settings and run Connect Slack before asking SecureDesk to call Slack.'
      );
    }

    throw error;
  }
}

export async function POST(req: Request) {
  if (!isAuth0Configured()) {
    return new Response('Auth0 is not configured.', { status: 503 });
  }

  const session = await safeGetSession();
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { message, messages = [], approvalStatus } = (await req.json()) as {
    message?: string;
    messages?: Array<{ content?: string; parts?: Array<{ type?: string; text?: string }> }>;
    approvalStatus?: string;
  };
  const latestMessage = messages[messages.length - 1];
  const latestMessageText = (typeof message === 'string' && message.trim()) || getLatestMessageText(latestMessage);
  const classification = classifyAction(latestMessageText);
  const highRisk = isHighRisk(classification);
  const userId = session.user.sub ?? session.user.email ?? 'unknown-user';
  const approverId = session.user.email ?? session.user.sub ?? 'current-user';

  if (highRisk && approvalStatus === 'rejected' && classification) {
    const rejectedLog = await logAction({
      userId,
      action: classification.action,
      service: classification.service,
      riskLevel: classification.level,
      status: 'rejected',
      details: `User rejected ${classification.action} before execution.`,
      metadata: classification.dataAffected,
      approvedBy: approverId,
      approvedAt: new Date(),
    });

    return NextResponse.json({
      reply: 'Action rejected. No external action was executed.',
      auditEntries: [rejectedLog],
    });
  }

  if (highRisk && approvalStatus !== 'approved' && classification) {
    const pendingLog = await logAction({
      userId,
      action: classification.action,
      service: classification.service,
      riskLevel: classification.level,
      status: 'pending',
      details: `Awaiting explicit approval for ${classification.action}.`,
      metadata: classification.dataAffected,
    });

    return NextResponse.json({
      reply: 'Action requires security approval to proceed.',
      approvalRequired: {
        classification,
      },
      auditEntries: [pendingLog],
    });
  }

  try {
    if (isSlackListRequest(latestMessageText)) {
      const permission = await evaluateToolPermission(userId, 'read_slack');
      if (!permission.allowed) {
        return NextResponse.json({ reply: permission.note! });
      }

      const slackToken = await getSlackProviderTokenForCurrentUser();
      const channels = await readSlackChannels(slackToken);

      const executedLog = await logAction({
        userId,
        action: 'read_slack',
        service: 'slack',
        riskLevel: 'low',
        status: 'executed',
        details: 'Listed Slack channels through Auth0 Token Vault.',
        metadata: `Returned ${channels.length} channels.`,
      });

      return NextResponse.json({
        reply: formatChannelsResponse(channels, permission.note ?? undefined),
        auditEntries: [executedLog],
      });
    }

    const slackPost = extractSlackPostRequest(latestMessageText);
    if (slackPost) {
      const permission = await evaluateToolPermission(userId, 'post_slack_message');
      if (!permission.allowed) {
        return NextResponse.json({ reply: permission.note! });
      }

      const auditEntries: AuditEntry[] = [];

      if (approvalStatus === 'approved' && classification) {
        const approvedLog = await logAction({
          userId,
          action: classification.action,
          service: classification.service,
          riskLevel: classification.level,
          status: 'approved',
          details: `User approved ${classification.action}. SecureDesk is executing the request.`,
          metadata: classification.dataAffected,
          approvedBy: approverId,
          approvedAt: new Date(),
        });

        auditEntries.push(approvedLog);
      }

      const slackToken = await getSlackProviderTokenForCurrentUser();
      const result = await postSlackMessage(slackToken, slackPost.channel, slackPost.text);

      const executedLog = await logAction({
        userId,
        action: 'post_slack_message',
        service: 'slack',
        riskLevel: 'high',
        status: 'executed',
        details: `Posted a Slack message to ${slackPost.channel}.`,
        metadata: slackPost.text,
        approvedBy: approvalStatus === 'approved' ? approverId : null,
        approvedAt: approvalStatus === 'approved' ? new Date() : null,
        executedAt: new Date(),
      });
      auditEntries.push(executedLog);

      return NextResponse.json({
        reply: [
          `Slack message posted successfully to ${slackPost.channel}.`,
          `Slack channel id: ${result.channel}`,
          `Slack timestamp: ${result.ts}`,
          permission.note,
        ]
          .filter(Boolean)
          .join('\n\n'),
        auditEntries,
      });
    }

    if (classification?.service === 'gmail' || classification?.service === 'jira') {
      return NextResponse.json({
        reply: `SecureDesk is currently running a live Slack-only demo path through Auth0 Token Vault. ${classification.service} remains scaffolded in the repository but is not active in this tenant yet.`,
      });
    }

    return NextResponse.json({ reply: formatHelpResponse() });
  } catch (error) {
    const details =
      error instanceof Error
        ? error.message
        : 'Unknown deterministic runtime error while processing the Slack request.';

    if (classification) {
      const failedLog = await logAction({
        userId,
        action: classification.action,
        service: classification.service,
        riskLevel: classification.level,
        status: 'failed',
        details,
        metadata: classification.dataAffected,
        approvedBy: approvalStatus === 'approved' ? approverId : null,
        approvedAt: approvalStatus === 'approved' ? new Date() : null,
      });

      return NextResponse.json({
        reply: [
          'SecureDesk could not complete that action.',
          details,
          'If this happened during Slack access, check the connected account, the Token Vault exchange, and the Slack scopes.',
        ].join('\n\n'),
        auditEntries: [failedLog],
      });
    }

    return NextResponse.json({
      reply: [
        'SecureDesk could not complete that action.',
        details,
        'If this happened during Slack access, check the connected account, the Token Vault exchange, and the Slack scopes.',
      ].join('\n\n'),
    });
  }
}
