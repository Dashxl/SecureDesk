import { classifyAction, isHighRisk } from '@/lib/risk-classifier';
import { logAction } from '@/lib/audit-logger';
import { isFGAConfigured, checkPermission } from '@/lib/fga';
import { getSlackToken, readSlackChannels, postSlackMessage } from '@/lib/services/slack';
import {
  getGmailToken,
  listTodayEmails,
  listUnreadEmails,
  sendEmail,
  summarizeTodayEmails,
} from '@/lib/services/gmail';
import { getCurrentUserAccessToken } from '@/lib/auth0';
import { isAuth0Configured, isCibaConfigured, safeGetSession } from '@/lib/auth-config';
import { NextResponse } from 'next/server';
import { AuditEntry } from '@/types/audit';
import { RiskClassification } from '@/types/risk';
import { markServiceTokenObserved } from '@/lib/connected-service-store';
import { initiateCIBARequest } from '@/lib/ciba';
import { isGeminiConfigured, parseIntentWithGemini } from '@/lib/gemini';

export const maxDuration = 30;

type ChatPayload = {
  message?: string;
  messages?: Array<{ content?: string; parts?: Array<{ type?: string; text?: string }> }>;
  approvalStatus?: 'approved' | 'rejected';
  approvalMode?: 'modal' | 'ciba';
};

type ResolvedAction =
  | { kind: 'help' }
  | { kind: 'unknown'; reason?: string }
  | { kind: 'jira' }
  | { kind: 'slack_list' }
  | { kind: 'slack_post'; channel: string; text: string }
  | { kind: 'gmail_unread' }
  | { kind: 'gmail_today_summary' }
  | { kind: 'gmail_send'; to: string; body: string };

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
    'SecureDesk routes supported actions through Gemini Flash intent parsing and a deterministic security runtime.',
    'You can ask naturally or use direct commands like:',
    '- `List my Slack channels`',
    '- `Post a message to #general-securedesk saying: Hello from SecureDesk`',
    '- `List my unread emails`',
    '- `Summarize my emails from today`',
    '- `Send an email to teammate@example.com saying: Hello from SecureDesk`',
    'Slack and Gmail run through Auth0 Token Vault. FGA gates tool access. High-risk actions use CIBA when configured and fall back to the in-app approval modal otherwise.',
  ].join('\n\n');
}

function formatUnknownActionResponse(reason?: string) {
  return [
    "SecureDesk couldn't map that request to a supported action yet.",
    reason,
    'Current actions SecureDesk can perform:',
    '- list Slack channels',
    '- post a Slack message',
    '- list unread Gmail messages',
    '- summarize today\'s Gmail messages',
    '- send an email',
  ]
    .filter(Boolean)
    .join('\n\n');
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

function isGmailUnreadRequest(message: string) {
  const lower = message.toLowerCase();
  return (
    /\bunread\b/.test(lower) &&
    /\b(email|emails|gmail|inbox)\b/.test(lower) &&
    /(list|show|read|check|what|fetch)/i.test(lower)
  );
}

function isGmailTodaySummaryRequest(message: string) {
  const lower = message.toLowerCase();
  return (
    /\b(today|todays|today's)\b/.test(lower) &&
    /\b(email|emails|gmail)\b/.test(lower) &&
    /(summarize|summary|digest|recap|brief|what)/i.test(lower)
  );
}

function extractSendEmailRequest(message: string) {
  const patterns = [
    /send\s+(?:an?\s+)?email\s+to\s+([^\s,;]+@[^\s,;]+)\s+(?:saying|that says|with message)\s*:?\s*([\s\S]+)/i,
    /email\s+([^\s,;]+@[^\s,;]+)\s+(?:saying|that says|with message)\s*:?\s*([\s\S]+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return {
        to: match[1].trim(),
        body: match[2].trim(),
      };
    }
  }

  return null;
}

function formatUnreadEmailsResponse(
  emails: Awaited<ReturnType<typeof listUnreadEmails>>,
  fgaNote?: string
) {
  if (emails.length === 0) {
    return [
      'No unread Gmail messages were returned for this user.',
      fgaNote,
      'Confirm the Gmail connected account has mailbox access and that unread messages exist.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  const lines = emails
    .slice(0, 10)
    .map((email) => `- ${email.subject} - ${email.from} - ${email.date}`);

  return [
    'Here are your unread Gmail messages through Auth0 Token Vault:',
    lines.join('\n'),
    emails.length > 10 ? `Showing 10 of ${emails.length} unread messages.` : null,
    fgaNote,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function formatTodaySummaryResponse(summary: string, emailsCount: number, fgaNote?: string) {
  return [
    `SecureDesk summarized ${emailsCount} Gmail message${emailsCount === 1 ? '' : 's'} from today:`,
    summary,
    fgaNote,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function getCibaBindingMessage(classification: NonNullable<RiskClassification>) {
  const core = `${classification.service}:${classification.action}`;
  const detail = classification.dataAffected.replace(/\s+/g, ' ').slice(0, 32);
  return `${core} ${detail}`.slice(0, 60);
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

function getApprovalDetails(
  action: string,
  approvalStatus: 'approved' | 'rejected',
  approvalMode?: 'modal' | 'ciba'
) {
  const source =
    approvalMode === 'ciba'
      ? 'through Auth0 CIBA / Guardian'
      : 'through the SecureDesk in-app approval modal';

  return approvalStatus === 'approved'
    ? `User approved ${action} ${source}. SecureDesk is executing the request.`
    : `User rejected ${action} ${source}. No external action was executed.`;
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

async function getGmailProviderTokenForCurrentUser() {
  const apiAccessToken = await getCurrentUserAccessToken();

  try {
    return await getGmailToken(apiAccessToken);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to exchange a Gmail provider token.';

    if (
      message.includes('federated_connection_refresh_token_not_found') ||
      message.includes('No Gmail connected account')
    ) {
      throw new Error(
        'No Gmail connected account exists for this user yet. Go to Settings and run Connect Gmail before asking SecureDesk to call Gmail.'
      );
    }

    throw error;
  }
}

async function resolveActionRequest(message: string): Promise<ResolvedAction> {
  const normalized = message.trim();

  if (!normalized) {
    return { kind: 'help' };
  }

  if (/\b(help|what can you do|supported commands)\b/i.test(normalized)) {
    return { kind: 'help' };
  }

  if (isSlackListRequest(normalized)) {
    return { kind: 'slack_list' };
  }

  const slackPost = extractSlackPostRequest(normalized);
  if (slackPost) {
    return { kind: 'slack_post', ...slackPost };
  }

  if (isGmailUnreadRequest(normalized)) {
    return { kind: 'gmail_unread' };
  }

  if (isGmailTodaySummaryRequest(normalized)) {
    return { kind: 'gmail_today_summary' };
  }

  const gmailSend = extractSendEmailRequest(normalized);
  if (gmailSend) {
    return { kind: 'gmail_send', ...gmailSend };
  }

  if (isGeminiConfigured()) {
    const intent = await parseIntentWithGemini(normalized);

    if (intent) {
      switch (intent.intent) {
        case 'list_slack_channels':
          return { kind: 'slack_list' };
        case 'post_slack_message':
          if (intent.channel && intent.text) {
            return { kind: 'slack_post', channel: intent.channel, text: intent.text };
          }
          return {
            kind: 'unknown',
            reason: intent.reason || 'SecureDesk recognized a Slack post request but the channel or message text was missing.',
          };
        case 'list_unread_emails':
          return { kind: 'gmail_unread' };
        case 'summarize_emails_today':
          return { kind: 'gmail_today_summary' };
        case 'send_email':
          if (intent.to && intent.body) {
            return { kind: 'gmail_send', to: intent.to, body: intent.body };
          }
          return {
            kind: 'unknown',
            reason: intent.reason || 'SecureDesk recognized an email request but the recipient or message body was missing.',
          };
        case 'unknown':
        default:
          return { kind: 'unknown', reason: intent.reason };
      }
    }
  }

  const rawClassification = classifyAction(normalized);
  if (rawClassification?.service === 'jira') {
    return { kind: 'jira' };
  }

  return { kind: 'unknown' };
}

function getClassificationForResolvedAction(
  resolvedAction: ResolvedAction,
  rawMessage: string
): RiskClassification | null {
  switch (resolvedAction.kind) {
    case 'slack_list':
      return {
        level: 'low',
        action: 'read_slack',
        service: 'slack',
        description: 'Read Slack messages and channels',
        dataAffected: 'Slack workspace',
      };
    case 'slack_post':
      return {
        level: 'high',
        action: 'post_slack_message',
        service: 'slack',
        description: 'Post a message to Slack',
        dataAffected: `Channel ${resolvedAction.channel}`,
      };
    case 'gmail_unread':
    case 'gmail_today_summary':
      return {
        level: 'low',
        action: 'read_emails',
        service: 'gmail',
        description: 'Read and summarize emails',
        dataAffected: 'Email messages',
      };
    case 'gmail_send':
      return {
        level: 'high',
        action: 'send_email',
        service: 'gmail',
        description: 'Send or compose an email',
        dataAffected: `Email to ${resolvedAction.to}`,
      };
    case 'jira':
      return classifyAction(rawMessage);
    default:
      return null;
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

  const {
    message,
    messages = [],
    approvalStatus,
    approvalMode,
  } = (await req.json()) as ChatPayload;

  const latestMessage = messages[messages.length - 1];
  const latestMessageText =
    (typeof message === 'string' && message.trim()) || getLatestMessageText(latestMessage);
  const resolvedAction = await resolveActionRequest(latestMessageText);
  const classification = getClassificationForResolvedAction(resolvedAction, latestMessageText);
  const highRisk = isHighRisk(classification);
  const userId = session.user.sub ?? session.user.email ?? 'unknown-user';
  const approverId = session.user.email ?? session.user.sub ?? 'current-user';
  const slackConnectionId =
    process.env.SLACK_CONNECTION_NAME || process.env.SLACK_CONNECTION_ID || 'slack';
  const gmailConnectionId =
    process.env.GMAIL_CONNECTION_NAME || process.env.GMAIL_CONNECTION_ID || 'google-oauth2';

  if (highRisk && approvalStatus === 'rejected' && classification) {
    const rejectedLog = await logAction({
      userId,
      action: classification.action,
      service: classification.service,
      riskLevel: classification.level,
      status: 'rejected',
      details: getApprovalDetails(classification.action, 'rejected', approvalMode),
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
      details: isCibaConfigured()
        ? `Awaiting Auth0 CIBA / Guardian approval for ${classification.action}.`
        : `Awaiting explicit in-app approval for ${classification.action}.`,
      metadata: classification.dataAffected,
    });

    if (isCibaConfigured()) {
      try {
        const ciba = await initiateCIBARequest({
          userId,
          bindingMessage: getCibaBindingMessage(classification),
          scope: 'openid',
        });

        return NextResponse.json({
          reply: 'Waiting for your approval - check your Auth0 Guardian notification.',
          approvalRequired: {
            classification,
            mode: 'ciba',
            authReqId: ciba.auth_req_id,
            interval: ciba.interval,
          },
          auditEntries: [pendingLog],
        });
      } catch (error) {
        const fallbackNote =
          error instanceof Error
            ? `CIBA could not be started, so SecureDesk fell back to the in-app approval modal. ${error.message}`
            : 'CIBA could not be started, so SecureDesk fell back to the in-app approval modal.';

        return NextResponse.json({
          reply: fallbackNote,
          approvalRequired: {
            classification,
            mode: 'modal',
          },
          auditEntries: [pendingLog],
        });
      }
    }

    return NextResponse.json({
      reply: 'Action requires approval before SecureDesk can execute it.',
      approvalRequired: {
        classification,
        mode: 'modal',
      },
      auditEntries: [pendingLog],
    });
  }

  try {
    switch (resolvedAction.kind) {
      case 'slack_list': {
        const permission = await evaluateToolPermission(userId, 'read_slack');
        if (!permission.allowed) {
          return NextResponse.json({ reply: permission.note! });
        }

        const slackToken = await getSlackProviderTokenForCurrentUser();
        await markServiceTokenObserved(userId, 'slack', slackConnectionId);
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

      case 'slack_post': {
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
            details: getApprovalDetails(classification.action, 'approved', approvalMode),
            metadata: classification.dataAffected,
            approvedBy: approverId,
            approvedAt: new Date(),
          });

          auditEntries.push(approvedLog);
        }

        const slackToken = await getSlackProviderTokenForCurrentUser();
        await markServiceTokenObserved(userId, 'slack', slackConnectionId);
        const result = await postSlackMessage(
          slackToken,
          resolvedAction.channel,
          resolvedAction.text
        );

        const executedLog = await logAction({
          userId,
          action: 'post_slack_message',
          service: 'slack',
          riskLevel: 'high',
          status: 'executed',
          details: `Posted a Slack message to ${resolvedAction.channel}.`,
          metadata: resolvedAction.text,
          approvedBy: approvalStatus === 'approved' ? approverId : null,
          approvedAt: approvalStatus === 'approved' ? new Date() : null,
          executedAt: new Date(),
        });
        auditEntries.push(executedLog);

        return NextResponse.json({
          reply: [
            `Slack message posted successfully to ${resolvedAction.channel}.`,
            `Slack channel id: ${result.channel}`,
            `Slack timestamp: ${result.ts}`,
            permission.note,
          ]
            .filter(Boolean)
            .join('\n\n'),
          auditEntries,
        });
      }

      case 'gmail_unread': {
        const permission = await evaluateToolPermission(userId, 'read_emails');
        if (!permission.allowed) {
          return NextResponse.json({ reply: permission.note! });
        }

        const gmailToken = await getGmailProviderTokenForCurrentUser();
        await markServiceTokenObserved(userId, 'gmail', gmailConnectionId);
        const emails = await listUnreadEmails(gmailToken);

        const executedLog = await logAction({
          userId,
          action: 'read_emails',
          service: 'gmail',
          riskLevel: 'low',
          status: 'executed',
          details: 'Listed unread Gmail messages through Auth0 Token Vault.',
          metadata: `Returned ${emails.length} unread messages.`,
        });

        return NextResponse.json({
          reply: formatUnreadEmailsResponse(emails, permission.note ?? undefined),
          auditEntries: [executedLog],
        });
      }

      case 'gmail_today_summary': {
        const permission = await evaluateToolPermission(userId, 'read_emails');
        if (!permission.allowed) {
          return NextResponse.json({ reply: permission.note! });
        }

        const gmailToken = await getGmailProviderTokenForCurrentUser();
        await markServiceTokenObserved(userId, 'gmail', gmailConnectionId);
        const emails = await listTodayEmails(gmailToken);
        const summary = summarizeTodayEmails(emails);

        const executedLog = await logAction({
          userId,
          action: 'read_emails',
          service: 'gmail',
          riskLevel: 'low',
          status: 'executed',
          details: 'Summarized Gmail messages from today through Auth0 Token Vault.',
          metadata: `Summarized ${emails.length} messages from today.`,
        });

        return NextResponse.json({
          reply: formatTodaySummaryResponse(summary, emails.length, permission.note ?? undefined),
          auditEntries: [executedLog],
        });
      }

      case 'gmail_send': {
        const permission = await evaluateToolPermission(userId, 'send_email');
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
            details: getApprovalDetails(classification.action, 'approved', approvalMode),
            metadata: classification.dataAffected,
            approvedBy: approverId,
            approvedAt: new Date(),
          });

          auditEntries.push(approvedLog);
        }

        const gmailToken = await getGmailProviderTokenForCurrentUser();
        await markServiceTokenObserved(userId, 'gmail', gmailConnectionId);
        const result = await sendEmail(gmailToken, resolvedAction.to, resolvedAction.body);

        const executedLog = await logAction({
          userId,
          action: 'send_email',
          service: 'gmail',
          riskLevel: 'high',
          status: 'executed',
          details: `Sent a Gmail message to ${resolvedAction.to}.`,
          metadata: resolvedAction.body,
          approvedBy: approvalStatus === 'approved' ? approverId : null,
          approvedAt: approvalStatus === 'approved' ? new Date() : null,
          executedAt: new Date(),
        });
        auditEntries.push(executedLog);

        return NextResponse.json({
          reply: [
            `Email sent successfully to ${resolvedAction.to}.`,
            `Gmail message id: ${result.id}`,
            `Gmail thread id: ${result.threadId}`,
            permission.note,
          ]
            .filter(Boolean)
            .join('\n\n'),
          auditEntries,
        });
      }

      case 'jira':
        return NextResponse.json({
          reply:
            'SecureDesk currently runs live Slack and Gmail paths through Auth0 Token Vault. Jira remains scaffolded in the repository but is not active in this tenant yet.',
        });

      case 'unknown':
        return NextResponse.json({
          reply: formatUnknownActionResponse(resolvedAction.reason),
        });

      case 'help':
      default:
        return NextResponse.json({ reply: formatHelpResponse() });
    }
  } catch (error) {
    const details =
      error instanceof Error
        ? error.message
        : 'Unknown deterministic runtime error while processing the request.';

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
          'If this happened during Slack or Gmail access, check the connected account, the Token Vault exchange, and the provider scopes.',
        ].join('\n\n'),
        auditEntries: [failedLog],
      });
    }

    return NextResponse.json({
      reply: [
        'SecureDesk could not complete that action.',
        details,
        'If this happened during Slack or Gmail access, check the connected account, the Token Vault exchange, and the provider scopes.',
      ].join('\n\n'),
    });
  }
}
