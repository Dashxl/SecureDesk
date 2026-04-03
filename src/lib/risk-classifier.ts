import { RiskLevel, RiskClassification, ServiceType } from '@/types/risk';

interface ActionPattern {
  keywords: string[];
  service: ServiceType;
  action: string;
  riskLevel: RiskLevel;
  description: string;
}

const ACTION_PATTERNS: ActionPattern[] = [
  {
    keywords: [
      'read email',
      'list email',
      'summarize email',
      'check email',
      'unread email',
      'search email',
      'inbox',
    ],
    service: 'gmail',
    action: 'read_emails',
    riskLevel: 'low',
    description: 'Read and summarize emails',
  },
  {
    keywords: [
      'send email',
      'compose email',
      'reply email',
      'forward email',
      'draft email',
      'write email',
      'send mail',
    ],
    service: 'gmail',
    action: 'send_email',
    riskLevel: 'high',
    description: 'Send or compose an email',
  },
  {
    keywords: ['delete email', 'remove email', 'trash email'],
    service: 'gmail',
    action: 'delete_email',
    riskLevel: 'high',
    description: 'Delete an email',
  },
  {
    keywords: [
      'list channel',
      'search slack',
      'read message',
      'check slack',
      'slack history',
      'list slack',
    ],
    service: 'slack',
    action: 'read_slack',
    riskLevel: 'low',
    description: 'Read Slack messages and channels',
  },
  {
    keywords: [
      'send slack',
      'post slack',
      'send message',
      'post message',
      'message channel',
      'write slack',
      'slack message to',
    ],
    service: 'slack',
    action: 'post_slack_message',
    riskLevel: 'high',
    description: 'Post a message to Slack',
  },
];

export function classifyAction(userMessage: string): RiskClassification | null {
  const lower = userMessage.toLowerCase();

  for (const pattern of ACTION_PATTERNS) {
    const matched = pattern.keywords.some((keyword) => lower.includes(keyword));

    if (matched) {
      return {
        level: pattern.riskLevel,
        action: pattern.action,
        service: pattern.service,
        description: pattern.description,
        dataAffected: extractDataContext(lower, pattern.service),
      };
    }
  }

  if (lower.includes('gmail') || lower.includes('email')) {
    return {
      level: 'low',
      action: 'read_emails',
      service: 'gmail',
      description: 'Access Gmail',
      dataAffected: 'Email data',
    };
  }

  if (lower.includes('slack')) {
    return {
      level: 'low',
      action: 'read_slack',
      service: 'slack',
      description: 'Access Slack',
      dataAffected: 'Slack data',
    };
  }

  return null;
}

function extractDataContext(message: string, service: ServiceType): string {
  switch (service) {
    case 'gmail': {
      const toMatch = message.match(/to\s+([^\s,]+@[^\s,]+)/);
      if (toMatch) return `Email to ${toMatch[1]}`;
      return 'Email messages';
    }
    case 'slack': {
      const channelMatch = message.match(/#(\w[\w-]*)/);
      if (channelMatch) return `Channel #${channelMatch[1]}`;
      return 'Slack workspace';
    }
    default:
      return 'Service data';
  }
}

export function isHighRisk(classification: RiskClassification | null): boolean {
  return classification?.level === 'high';
}
