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
import {
  generateConversationalReply,
  isGeminiConfigured,
  parseIntentWithGemini,
} from '@/lib/gemini';
import {
  approvalMatchesAction,
  consumeApprovalRequest,
  createApprovalRequest,
  getApprovalRequestForUser,
} from '@/lib/approval-runtime';

export const maxDuration = 30;

type ChatPayload = {
  message?: string;
  messages?: Array<{ content?: string; parts?: Array<{ type?: string; text?: string }> }>;
  approvalDecision?: 'approved' | 'rejected';
  approvalRequestId?: string;
};

type ResolvedAction =
  | { kind: 'help' }
  | { kind: 'identity' }
  | { kind: 'unknown'; reason?: string }
  | { kind: 'slack_list' }
  | { kind: 'slack_post'; channel: string; text: string }
  | { kind: 'gmail_unread' }
  | { kind: 'gmail_today_summary' }
  | { kind: 'gmail_send'; to: string; body: string };

type ReplyLanguage = 'en' | 'es';

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

function detectReplyLanguage(message: string): ReplyLanguage {
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return 'en';
  }

  const spanishSignals = [
    /\b(hola|gracias|correo|correos|canal|canales|enviar|envia|mandar|manda|resumir|resume|hoy|quien|qué|que|eres|puedes|ayuda|lee|lista|muestra|mensaje)\b/,
    /[¿¡]/,
    /(?:ción|mente|estás|cómo|tú|día|acción)/,
  ];

  return spanishSignals.some((pattern) => pattern.test(normalized)) ? 'es' : 'en';
}

function formatHelpResponse(language: ReplyLanguage = 'en') {
  if (language === 'es') {
    return [
      'SecureDesk es tu workspace empresarial de IA para acciones delegadas en Slack y Gmail con límites de confianza visibles.',
      'Puedes escribir de forma natural o usar comandos directos como:',
      '- `List my Slack channels`',
      '- `Post a message to #general-securedesk saying: Hello from SecureDesk`',
      '- `List my unread emails`',
      '- `Summarize my emails from today`',
      '- `Send an email to teammate@example.com saying: Hello from SecureDesk`',
      'Slack y Gmail funcionan a través de Auth0 Token Vault, Auth0 FGA gobierna el acceso a herramientas, las acciones de mayor impacto pasan por aprobación explícita y cada decisión queda registrada en una auditoría persistente.',
      'Puedes pedirme las acciones en español y yo las traduzco a la ruta de ejecución más segura disponible en este workspace.',
    ].join('\n\n');
  }

  return [
    'SecureDesk is your enterprise AI workspace for delegated actions across Slack and Gmail with visible trust boundaries.',
    'You can ask naturally or use direct commands like:',
    '- `List my Slack channels`',
    '- `Post a message to #general-securedesk saying: Hello from SecureDesk`',
    '- `List my unread emails`',
    '- `Summarize my emails from today`',
    '- `Send an email to teammate@example.com saying: Hello from SecureDesk`',
    'Slack and Gmail run through Auth0 Token Vault, Auth0 FGA governs tool access, high-impact actions pause for explicit approval, and every decision is recorded in a persistent audit trail.',
    'Ask naturally and I will translate the request into the safest executable action path available in this workspace.',
  ].join('\n\n');
}

function formatIdentityResponse(language: ReplyLanguage = 'en') {
  if (language === 'es') {
    return [
      'Soy SecureDesk, tu agente de IA empresarial para trabajo delegado en Slack y Gmail.',
      'Puedo leer canales, publicar mensajes aprobados en Slack, revisar correos no leídos, resumir la actividad de Gmail de hoy y enviar correos aprobados, mientras Auth0 Token Vault, Auth0 FGA, la capa de revisión y la auditoría persistente mantienen cada acción dentro de límites de seguridad visibles.',
    ].join('\n\n');
  }

  return [
    'I am SecureDesk, your enterprise AI agent for delegated work across Slack and Gmail.',
    'I can read channels, post approved Slack messages, review unread Gmail, summarize today\'s email activity, and send approved emails while Auth0 Token Vault, Auth0 FGA, approval review, and a persistent audit trail keep every action inside visible security boundaries.',
  ].join('\n\n');
}

function formatUnknownActionResponse(reason?: string, language: ReplyLanguage = 'en') {
  if (language === 'es') {
    return [
      'No pude mapear esa solicitud a una de las acciones que puedo ejecutar en este workspace en este momento.',
      reason,
      'En este workspace puedo ayudarte con:',
      '- listar canales de Slack',
      '- publicar un mensaje en Slack',
      '- listar correos no leídos de Gmail',
      '- resumir los correos de hoy en Gmail',
      '- enviar un correo',
      'Si quieres, reformula la solicitud de forma natural y vuelvo a intentarlo.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return [
    "I couldn't route that request to one of the workspace actions I can execute right now.",
    reason,
    'In this workspace, I can help you with:',
    '- list Slack channels',
    '- post a Slack message',
    '- list unread Gmail messages',
    '- summarize today\'s Gmail messages',
    '- send an email',
    'If you want, rephrase the request naturally and I will try to map it for you.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function isIdentityOrGreetingRequest(message: string) {
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  const identityPatterns = [
    /\bwho are you\b/,
    /\bwhat are you\b/,
    /\btell me about yourself\b/,
    /\bquien eres\b/,
    /\bqué eres\b/,
    /\bque eres\b/,
    /\bquien eres tu\b/,
    /\bqué haces\b/,
    /\bque haces\b/,
  ];

  if (identityPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const greetingPatterns = [
    /^hi$/,
    /^hello$/,
    /^hey$/,
    /^hola$/,
    /^buenas$/,
    /^buenos dias$/,
    /^buen día$/,
    /^buen dia$/,
    /^buenas tardes$/,
    /^buenas noches$/,
  ];

  return greetingPatterns.some((pattern) => pattern.test(normalized));
}

function isSlackListRequest(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes('slack') &&
    (lower.includes('channel') || lower.includes('canal')) &&
    /(list|show|read|display|what|muestr|lista|lee|cuales)/i.test(lower)
  );
}

function extractSlackPostRequest(message: string) {
  const patterns = [
    // English rules
    /post\s+(?:a\s+)?message\s+to\s+(#\s*[\w-]+|[CGD][A-Z0-9]+)\s+(?:saying|that says|with text)\s*:?\s*([\s\S]+)/i,
    /send\s+(?:a\s+)?slack\s+message\s+to\s+(#\s*[\w-]+|[CGD][A-Z0-9]+)\s+(?:saying|that says|with text)\s*:?\s*([\s\S]+)/i,
    // Spanish rules
    /mand(?:a|ar|e)\s+(?:un\s+)?(?:mensaje|msj)\s+(?:a|al canal)\s+(#\s*[\w-]+|[CGD][A-Z0-9]+)\s+(?:diciendo|que diga|con el texto)\s*:?\s*([\s\S]+)/i,
    /envi(?:a|ar|e)\s+(?:un\s+)?(?:mensaje|msj)\s+(?:de\s+slack\s+)?(?:a|al canal)\s+(#\s*[\w-]+|[CGD][A-Z0-9]+)\s+(?:diciendo|que diga|con el texto)\s*:?\s*([\s\S]+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return {
        channel: match[1].replace(/\s+/g, ''),
        text: match[2].trim(),
      };
    }
  }

  return null;
}

function isGmailUnreadRequest(message: string) {
  const lower = message.toLowerCase();
  return (
    (/\bunread\b/.test(lower) || /\bno le[ií]dos?\b/.test(lower)) &&
    /\b(email|emails|gmail|inbox|correos?|mensajes?)\b/.test(lower) &&
    /(list|show|read|check|what|fetch|muestr|lista|lee|cuales|tengo)/i.test(lower)
  );
}

function isGmailTodaySummaryRequest(message: string) {
  const lower = message.toLowerCase();
  return (
    (/\b(today|todays|today's)\b/.test(lower) || /\b(hoy|diarios?)\b/.test(lower)) &&
    /\b(email|emails|gmail|correos?)\b/.test(lower) &&
    /(summarize|summary|digest|recap|brief|what|resum|dime)/i.test(lower)
  );
}

function extractSendEmailRequest(message: string) {
  const patterns = [
    // English
    /send\s+(?:an?\s+)?email\s+to\s+([^\s,;]+@[^\s,;]+)\s+(?:saying|that says|with message)\s*:?\s*([\s\S]+)/i,
    /email\s+([^\s,;]+@[^\s,;]+)\s+(?:saying|that says|with message)\s*:?\s*([\s\S]+)/i,
    // Spanish
    /envi(?:a|ar|e)\s+(?:un\s+)?(?:correo|email)\s+a\s+([^\s,;]+@[^\s,;]+)\s+(?:diciendo|que diga|con el texto)\s*:?\s*([\s\S]+)/i,
    /(?:correo|email)\s+a\s+([^\s,;]+@[^\s,;]+)\s+(?:diciendo|que diga|con el texto)\s*:?\s*([\s\S]+)/i,
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
  let detail = classification.dataAffected.replace(/\s+/g, ' ').slice(0, 32);
  
  // Auth0 binding_message restricts allowed characters.
  // Generally allowed: alphanumeric, spaces, and + - _ . , : #
  // The @ sign in emails (e.g. gmail_send) will cause an invalid_request error.
  detail = detail.replace(/@/g, '_at_');
  
  const rawMsg = `${core} ${detail}`.slice(0, 60);
  return rawMsg.replace(/[^a-zA-Z0-9+\-_.,:# ]/g, '');
}

async function evaluateToolPermission(userId: string, action: string) {
  if (!isFGAConfigured()) {
    return {
      allowed: false,
      note:
        'SecureDesk policy enforcement is offline. Configure Auth0 FGA before running connected Slack or Gmail actions.',
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
      : 'through the SecureDesk approval console';

  return approvalStatus === 'approved'
    ? `User approved ${action} ${source}. SecureDesk released the action for execution.`
    : `User rejected ${action} ${source}. SecureDesk kept the action blocked.`;
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

  if (isIdentityOrGreetingRequest(normalized)) {
    return { kind: 'identity' };
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
    default:
      return null;
  }
}

function getHighRiskAuditMetadata(resolvedAction: ResolvedAction) {
  switch (resolvedAction.kind) {
    case 'slack_post':
      return `Target ${resolvedAction.channel}; message length ${resolvedAction.text.trim().length} characters.`;
    case 'gmail_send':
      return `Recipient ${resolvedAction.to}; body length ${resolvedAction.body.trim().length} characters.`;
    default:
      return null;
  }
}

function getRecentConversation(messages: ChatPayload['messages']) {
  return (messages ?? [])
    .map((item) => getLatestMessageText(item))
    .filter(Boolean)
    .slice(-6);
}

async function presentReply(args: {
  userMessage: string;
  rawReply: string;
  mode: 'help' | 'unsupported' | 'approval' | 'success' | 'error' | 'info';
  recentMessages?: string[];
}) {
  if (!isGeminiConfigured()) {
    return args.rawReply;
  }

  try {
    return await generateConversationalReply(args);
  } catch {
    return args.rawReply;
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
    approvalDecision,
    approvalRequestId,
  } = (await req.json()) as ChatPayload;

  const latestMessage = messages[messages.length - 1];
  const latestMessageText =
    (typeof message === 'string' && message.trim()) || getLatestMessageText(latestMessage);
  const replyLanguage = detectReplyLanguage(latestMessageText);
  const recentConversation = getRecentConversation(messages);
  const resolvedAction = await resolveActionRequest(latestMessageText);
  const classification = getClassificationForResolvedAction(resolvedAction, latestMessageText);
  const highRisk = isHighRisk(classification);
  const userId = session.user.sub ?? session.user.email ?? 'unknown-user';
  const approverId = session.user.email ?? session.user.sub ?? 'current-user';
  const slackConnectionId =
    process.env.SLACK_CONNECTION_NAME || process.env.SLACK_CONNECTION_ID || 'slack';
  const gmailConnectionId =
    process.env.GMAIL_CONNECTION_NAME || process.env.GMAIL_CONNECTION_ID || 'google-oauth2';
  let permissionNote: string | undefined;

  if (
    classification &&
    (classification.service === 'slack' || classification.service === 'gmail')
  ) {
    const permission = await evaluateToolPermission(userId, classification.action);

    if (!permission.allowed) {
      return NextResponse.json(
        {
          reply: await presentReply({
            userMessage: latestMessageText,
            rawReply: permission.note!,
            mode: 'error',
            recentMessages: recentConversation,
          }),
        },
        { status: 403 }
      );
    }

    permissionNote = permission.note ?? undefined;
  }

  let consumedApprovalMode: 'modal' | 'ciba' | undefined;

  if (highRisk && approvalDecision === 'rejected' && classification) {
    if (!approvalRequestId) {
      return NextResponse.json(
        {
          reply: await presentReply({
            userMessage: latestMessageText,
            rawReply:
              'SecureDesk could not record that rejection because the approval session id was missing.',
            mode: 'error',
            recentMessages: recentConversation,
          }),
        },
        { status: 400 }
      );
    }

    const { request: pendingApproval, error } = await getApprovalRequestForUser(
      approvalRequestId,
      userId
    );

    if (!pendingApproval || error) {
      return NextResponse.json({ reply: error }, { status: 400 });
    }

    if (!approvalMatchesAction(pendingApproval, classification, latestMessageText)) {
      await consumeApprovalRequest(approvalRequestId);
      return NextResponse.json(
        {
          reply:
            'That approval session no longer matches the action waiting to run. Please submit the request again.',
        },
        { status: 409 }
      );
    }

    await consumeApprovalRequest(approvalRequestId);
    const rejectedLog = await logAction({
      userId,
      action: classification.action,
      service: classification.service,
      riskLevel: classification.level,
      status: 'rejected',
      details: getApprovalDetails(classification.action, 'rejected', pendingApproval.mode),
      metadata: classification.dataAffected,
      approvedBy: approverId,
      approvedAt: new Date(),
    });

    return NextResponse.json({
      reply: await presentReply({
        userMessage: latestMessageText,
        rawReply: 'Approval declined. SecureDesk kept the external action blocked.',
        mode: 'info',
        recentMessages: recentConversation,
      }),
      auditEntries: [rejectedLog],
    });
  }

  if (highRisk && classification) {
    if (approvalDecision === 'approved') {
      if (!approvalRequestId) {
        return NextResponse.json(
          {
            reply: await presentReply({
              userMessage: latestMessageText,
              rawReply:
                'SecureDesk could not release that action because the approval session id was missing.',
              mode: 'error',
              recentMessages: recentConversation,
            }),
          },
          { status: 400 }
        );
      }

      const { request: pendingApproval, error } = await getApprovalRequestForUser(
        approvalRequestId,
        userId
      );

      if (!pendingApproval || error) {
        return NextResponse.json({ reply: error }, { status: 400 });
      }

      if (!approvalMatchesAction(pendingApproval, classification, latestMessageText)) {
        await consumeApprovalRequest(approvalRequestId);
        return NextResponse.json(
          {
            reply:
              'That approval session no longer matches the action waiting to run. Please review the action again.',
          },
          { status: 409 }
        );
      }

      if (pendingApproval.mode === 'ciba') {
        if (pendingApproval.status === 'pending') {
          return NextResponse.json({
            reply: await presentReply({
              userMessage: latestMessageText,
              rawReply:
                'SecureDesk is still waiting for confirmation from Auth0 Guardian before it can proceed.',
              mode: 'info',
              recentMessages: recentConversation,
            }),
          });
        }

        if (pendingApproval.status === 'rejected') {
          await consumeApprovalRequest(approvalRequestId);

          const rejectedLog = await logAction({
            userId,
            action: classification.action,
            service: classification.service,
            riskLevel: classification.level,
            status: 'rejected',
            details: getApprovalDetails(classification.action, 'rejected', 'ciba'),
            metadata: classification.dataAffected,
            approvedBy: approverId,
            approvedAt: new Date(),
          });

          return NextResponse.json({
            reply: await presentReply({
              userMessage: latestMessageText,
              rawReply: 'Auth0 Guardian declined the request. SecureDesk kept the action blocked.',
              mode: 'info',
              recentMessages: recentConversation,
            }),
            auditEntries: [rejectedLog],
          });
        }

        if (pendingApproval.status !== 'approved') {
          return NextResponse.json(
            {
              reply:
                'SecureDesk could not confirm the external approval state. Please submit the action again.',
            },
            { status: 400 }
          );
        }
      }

      await consumeApprovalRequest(approvalRequestId);
      consumedApprovalMode = pendingApproval.mode;
    } else {
      const pendingLog = await logAction({
        userId,
        action: classification.action,
        service: classification.service,
        riskLevel: classification.level,
        status: 'pending',
        details: isCibaConfigured()
          ? `Awaiting external approval through Auth0 CIBA / Guardian for ${classification.action}.`
          : `Awaiting in-product approval for ${classification.action}.`,
        metadata: classification.dataAffected,
      });

      if (isCibaConfigured()) {
        try {
          const ciba = await initiateCIBARequest({
            userId,
            bindingMessage: getCibaBindingMessage(classification),
            scope: 'openid',
          });
          const approvalRequest = await createApprovalRequest({
            userId,
            message: latestMessageText,
            classification,
            mode: 'ciba',
            authReqId: ciba.auth_req_id,
          });

          return NextResponse.json({
            reply: await presentReply({
              userMessage: latestMessageText,
              rawReply:
                'Approval requested in Auth0 Guardian. SecureDesk will continue automatically once you confirm it.',
              mode: 'approval',
              recentMessages: recentConversation,
            }),
            approvalRequired: {
              classification,
              mode: 'ciba',
              approvalId: approvalRequest.id,
              authReqId: ciba.auth_req_id,
              interval: ciba.interval,
            },
            auditEntries: [pendingLog],
          });
        } catch (error) {
          const approvalRequest = await createApprovalRequest({
            userId,
            message: latestMessageText,
            classification,
            mode: 'modal',
          });
          const fallbackNote =
            error instanceof Error
              ? `SecureDesk could not reach the external approval channel, so the request moved into the in-product review step. ${error.message}`
              : 'SecureDesk could not reach the external approval channel, so the request moved into the in-product review step.';

          return NextResponse.json({
            reply: await presentReply({
              userMessage: latestMessageText,
              rawReply: fallbackNote,
              mode: 'approval',
              recentMessages: recentConversation,
            }),
            approvalRequired: {
              classification,
              mode: 'modal',
              approvalId: approvalRequest.id,
            },
            auditEntries: [pendingLog],
          });
        }
      }

      const approvalRequest = await createApprovalRequest({
        userId,
        message: latestMessageText,
        classification,
        mode: 'modal',
      });

      return NextResponse.json({
        reply: await presentReply({
          userMessage: latestMessageText,
          rawReply: 'This action is ready for review. Approve it to let SecureDesk continue.',
          mode: 'approval',
          recentMessages: recentConversation,
        }),
        approvalRequired: {
          classification,
          mode: 'modal',
          approvalId: approvalRequest.id,
        },
        auditEntries: [pendingLog],
      });
    }
  }

  try {
    switch (resolvedAction.kind) {
      case 'slack_list': {
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
          reply: await presentReply({
            userMessage: latestMessageText,
            rawReply: formatChannelsResponse(channels, permissionNote),
            mode: 'success',
            recentMessages: recentConversation,
          }),
          auditEntries: [executedLog],
        });
      }

      case 'slack_post': {
        const auditEntries: AuditEntry[] = [];

        if (consumedApprovalMode && classification) {
          const approvedLog = await logAction({
            userId,
            action: classification.action,
            service: classification.service,
            riskLevel: classification.level,
            status: 'approved',
            details: getApprovalDetails(classification.action, 'approved', consumedApprovalMode),
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
          metadata: getHighRiskAuditMetadata(resolvedAction) ?? undefined,
          approvedBy: consumedApprovalMode ? approverId : null,
          approvedAt: consumedApprovalMode ? new Date() : null,
          executedAt: new Date(),
        });
        auditEntries.push(executedLog);

        return NextResponse.json({
          reply: await presentReply({
            userMessage: latestMessageText,
            rawReply: [
              `Slack message posted successfully to ${resolvedAction.channel}.`,
              `Slack channel id: ${result.channel}`,
              `Slack timestamp: ${result.ts}`,
              permissionNote,
            ]
              .filter(Boolean)
              .join('\n\n'),
            mode: 'success',
            recentMessages: recentConversation,
          }),
          auditEntries,
        });
      }

      case 'gmail_unread': {
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
          reply: await presentReply({
            userMessage: latestMessageText,
            rawReply: formatUnreadEmailsResponse(emails, permissionNote),
            mode: 'success',
            recentMessages: recentConversation,
          }),
          auditEntries: [executedLog],
        });
      }

      case 'gmail_today_summary': {
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
          reply: await presentReply({
            userMessage: latestMessageText,
            rawReply: formatTodaySummaryResponse(summary, emails.length, permissionNote),
            mode: 'success',
            recentMessages: recentConversation,
          }),
          auditEntries: [executedLog],
        });
      }

      case 'gmail_send': {
        const auditEntries: AuditEntry[] = [];

        if (consumedApprovalMode && classification) {
          const approvedLog = await logAction({
            userId,
            action: classification.action,
            service: classification.service,
            riskLevel: classification.level,
            status: 'approved',
            details: getApprovalDetails(classification.action, 'approved', consumedApprovalMode),
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
          metadata: getHighRiskAuditMetadata(resolvedAction) ?? undefined,
          approvedBy: consumedApprovalMode ? approverId : null,
          approvedAt: consumedApprovalMode ? new Date() : null,
          executedAt: new Date(),
        });
        auditEntries.push(executedLog);

        return NextResponse.json({
          reply: await presentReply({
            userMessage: latestMessageText,
            rawReply: [
              `Email sent successfully to ${resolvedAction.to}.`,
              `Gmail message id: ${result.id}`,
              `Gmail thread id: ${result.threadId}`,
              permissionNote,
            ]
              .filter(Boolean)
              .join('\n\n'),
            mode: 'success',
            recentMessages: recentConversation,
          }),
          auditEntries,
        });
      }

      case 'unknown':
        return NextResponse.json({
          reply: await presentReply({
            userMessage: latestMessageText,
            rawReply: formatUnknownActionResponse(resolvedAction.reason, replyLanguage),
            mode: 'unsupported',
            recentMessages: recentConversation,
          }),
        });

      case 'identity':
        return NextResponse.json({
          reply: await presentReply({
            userMessage: latestMessageText,
            rawReply: formatIdentityResponse(replyLanguage),
            mode: 'info',
            recentMessages: recentConversation,
          }),
        });

      case 'help':
      default:
        return NextResponse.json({
          reply: await presentReply({
            userMessage: latestMessageText,
            rawReply: formatHelpResponse(replyLanguage),
            mode: 'help',
            recentMessages: recentConversation,
          }),
        });
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
        approvedBy: consumedApprovalMode ? approverId : null,
        approvedAt: consumedApprovalMode ? new Date() : null,
      });

      return NextResponse.json({
        reply: await presentReply({
          userMessage: latestMessageText,
          rawReply: [
            'SecureDesk could not complete that action.',
            details,
            'If this happened during Slack or Gmail access, check the connected account, the Token Vault exchange, and the provider scopes.',
          ].join('\n\n'),
          mode: 'error',
          recentMessages: recentConversation,
        }),
        auditEntries: [failedLog],
      });
    }

    return NextResponse.json({
      reply: await presentReply({
        userMessage: latestMessageText,
        rawReply: [
          'SecureDesk could not complete that action.',
          details,
          'If this happened during Slack or Gmail access, check the connected account, the Token Vault exchange, and the provider scopes.',
        ].join('\n\n'),
        mode: 'error',
        recentMessages: recentConversation,
      }),
    });
  }
}
