type GeminiSupportedIntent =
  | 'list_slack_channels'
  | 'post_slack_message'
  | 'list_unread_emails'
  | 'summarize_emails_today'
  | 'send_email'
  | 'unknown';

export interface GeminiIntentResult {
  intent: GeminiSupportedIntent;
  channel?: string;
  text?: string;
  to?: string;
  body?: string;
  confidence?: 'high' | 'medium' | 'low';
  reason?: string;
}

function stripCodeFences(input: string) {
  return input
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function parseGeminiJson(input: string): GeminiIntentResult | null {
  try {
    const parsed = JSON.parse(stripCodeFences(input)) as GeminiIntentResult;
    if (!parsed || typeof parsed.intent !== 'string') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export async function parseIntentWithGemini(message: string): Promise<GeminiIntentResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = [
    'You are an intent parser for SecureDesk, a corporate AI agent.',
    'Return ONLY compact JSON with no markdown and no prose.',
    'Map the user request to exactly one supported intent.',
    'Supported intents:',
    '- list_slack_channels',
    '- post_slack_message',
    '- list_unread_emails',
    '- summarize_emails_today',
    '- send_email',
    '- unknown',
    'Rules:',
    '- If the user asks to list, show, or read Slack channels, use list_slack_channels.',
    '- If the user asks to post/send a Slack message, use post_slack_message and extract channel plus text.',
    '- If the user asks to list unread emails, use list_unread_emails.',
    '- If the user asks to summarize emails from today, use summarize_emails_today.',
    '- If the user asks to send an email, use send_email and extract recipient plus body.',
    '- If you cannot map the request confidently, return intent="unknown".',
    '- Keep channel values like #general-securedesk when possible.',
    '- Keep email recipients as raw email addresses.',
    '- Do not invent missing fields. If a required field is missing, return unknown and explain why in reason.',
    'JSON schema:',
    '{"intent":"...","channel":"optional","text":"optional","to":"optional","body":"optional","confidence":"high|medium|low","reason":"optional"}',
    `User message: ${message}`,
  ].join('\n');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini intent parsing failed. ${errorText}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();

  if (!text) {
    return null;
  }

  return parseGeminiJson(text);
}
