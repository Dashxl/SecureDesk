import { getCurrentUserAccessToken, getTokenForService } from '../auth0';

export interface SlackChannel {
  id: string;
  name: string;
  is_private?: boolean;
  is_member?: boolean;
  num_members?: number;
}

interface SlackApiEnvelope {
  ok: boolean;
  error?: string;
}

function isSlackChannelId(value: string) {
  return /^[CGD][A-Z0-9]+$/i.test(value.trim());
}

async function callSlackApi<T extends SlackApiEnvelope>(
  token: string,
  endpoint: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`https://slack.com/api/${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Slack API request failed with HTTP ${response.status}.`);
  }

  const data = (await response.json()) as T;

  if (!data.ok) {
    throw new Error(
      `Slack API returned "${data.error || 'unknown_error'}". Confirm the Slack connected account is authorized with the scopes required by this action.`
    );
  }

  return data;
}

export async function getSlackToken(accessToken: string): Promise<string> {
  const connection = process.env.SLACK_CONNECTION_NAME || process.env.SLACK_CONNECTION_ID || 'slack';
  return getTokenForService(accessToken, connection);
}

export async function getSlackTokenForCurrentUser(): Promise<string> {
  const auth0AccessToken = await getCurrentUserAccessToken();
  return getSlackToken(auth0AccessToken);
}

export async function readSlackChannels(token: string): Promise<SlackChannel[]> {
  const data = await callSlackApi<{ channels?: SlackChannel[] } & SlackApiEnvelope>(
    token,
    'conversations.list?exclude_archived=true&limit=100&types=public_channel,private_channel'
  );

  return data.channels ?? [];
}

async function resolveSlackChannelId(token: string, requestedChannel: string) {
  const normalized = requestedChannel.trim().replace(/^#/, '');

  if (isSlackChannelId(normalized)) {
    return normalized.toUpperCase();
  }

  const channels = await readSlackChannels(token);
  const match = channels.find((channel) => channel.name.toLowerCase() === normalized.toLowerCase());

  if (!match) {
    throw new Error(
      `SecureDesk could not find a Slack channel named "${requestedChannel}". Use a channel ID or a connected channel name the user can access.`
    );
  }

  return match.id;
}

export async function postSlackMessage(
  token: string,
  channel: string,
  text: string
): Promise<{ success: true; channel: string; ts: string }> {
  const channelId = await resolveSlackChannelId(token, channel);
  const data = await callSlackApi<{ channel: string; ts: string } & SlackApiEnvelope>(
    token,
    'chat.postMessage',
    {
      method: 'POST',
      body: JSON.stringify({
        channel: channelId,
        text,
      }),
    }
  );

  return {
    success: true,
    channel: data.channel,
    ts: data.ts,
  };
}

export async function readSlackChannelsForCurrentUser() {
  const token = await getSlackTokenForCurrentUser();
  return readSlackChannels(token);
}

export async function postSlackMessageForCurrentUser(channel: string, text: string) {
  const token = await getSlackTokenForCurrentUser();
  return postSlackMessage(token, channel, text);
}
