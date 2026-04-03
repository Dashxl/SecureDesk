import { getTokenForService } from '../auth0';

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  internalDate?: string;
}

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
};

type GmailMessageResponse = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
};

function getGmailConnectionName() {
  return process.env.GMAIL_CONNECTION_NAME || process.env.GMAIL_CONNECTION_ID || 'google-oauth2';
}

function getHeaderValue(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string
) {
  return (
    headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || ''
  );
}

function toBase64Url(input: string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function gmailFetch<T>(token: string, input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail API request failed. ${errorText}`);
  }

  return (await response.json()) as T;
}

async function fetchMessageSummaries(
  token: string,
  messages: Array<{ id: string; threadId: string }>
): Promise<GmailMessageSummary[]> {
  const results = await Promise.all(
    messages.map((message) =>
      gmailFetch<GmailMessageResponse>(
        token,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
      )
    )
  );

  return results.map((message) => {
    const headers = message.payload?.headers;

    return {
      id: message.id,
      threadId: message.threadId,
      from: getHeaderValue(headers, 'From') || 'Unknown sender',
      subject: getHeaderValue(headers, 'Subject') || '(no subject)',
      date:
        getHeaderValue(headers, 'Date') ||
        new Date(Number(message.internalDate || 0)).toUTCString(),
      snippet: message.snippet || '',
      internalDate: message.internalDate,
    };
  });
}

export async function getGmailToken(accessToken: string): Promise<string> {
  return getTokenForService(accessToken, getGmailConnectionName());
}

export async function listUnreadEmails(
  token: string,
  limit = 8
): Promise<GmailMessageSummary[]> {
  const data = await gmailFetch<GmailListResponse>(
    token,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
      'is:unread'
    )}&maxResults=${limit}`
  );

  const messages = data.messages ?? [];
  if (messages.length === 0) {
    return [];
  }

  return fetchMessageSummaries(token, messages);
}

export async function listTodayEmails(
  token: string,
  limit = 12
): Promise<GmailMessageSummary[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const unixTimestamp = Math.floor(startOfToday.getTime() / 1000);
  const query = `after:${unixTimestamp}`;

  const data = await gmailFetch<GmailListResponse>(
    token,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
      query
    )}&maxResults=${limit}`
  );

  const messages = data.messages ?? [];
  if (messages.length === 0) {
    return [];
  }

  return fetchMessageSummaries(token, messages);
}

export function summarizeTodayEmails(messages: GmailMessageSummary[]) {
  if (messages.length === 0) {
    return 'No emails from today were returned by Gmail.';
  }

  const bySender = new Map<string, number>();
  for (const message of messages) {
    bySender.set(message.from, (bySender.get(message.from) || 0) + 1);
  }

  const senderSummary = [...bySender.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([sender, count]) => `- ${sender}: ${count} email${count === 1 ? '' : 's'}`)
    .join('\n');

  const subjectLines = messages
    .slice(0, 6)
    .map((message) => `- ${message.subject} - ${message.from}`)
    .join('\n');

  return [
    `You received ${messages.length} email${messages.length === 1 ? '' : 's'} today.`,
    senderSummary ? `Top senders:\n${senderSummary}` : null,
    subjectLines ? `Latest subjects:\n${subjectLines}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function sendEmail(
  token: string,
  to: string,
  body: string,
  subject = 'Message from SecureDesk'
) {
  const mimeMessage = [
    `To: ${to}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body,
  ].join('\r\n');

  const raw = toBase64Url(mimeMessage);

  return gmailFetch<{ id: string; threadId: string; labelIds?: string[] }>(
    token,
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      body: JSON.stringify({ raw }),
    }
  );
}
