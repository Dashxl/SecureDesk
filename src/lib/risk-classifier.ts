import { RiskLevel, RiskClassification, ServiceType } from '@/types/risk';

interface ActionPattern {
  keywords: string[];
  service: ServiceType;
  action: string;
  riskLevel: RiskLevel;
  description: string;
}

const ACTION_PATTERNS: ActionPattern[] = [
  // Gmail — LOW RISK (read)
  { keywords: ['read email', 'list email', 'summarize email', 'check email', 'unread email', 'search email', 'inbox'],
    service: 'gmail', action: 'read_emails', riskLevel: 'low', description: 'Read and summarize emails' },
  // Gmail — HIGH RISK (write)
  { keywords: ['send email', 'compose email', 'reply email', 'forward email', 'draft email', 'write email', 'send mail'],
    service: 'gmail', action: 'send_email', riskLevel: 'high', description: 'Send or compose an email' },
  { keywords: ['delete email', 'remove email', 'trash email'],
    service: 'gmail', action: 'delete_email', riskLevel: 'high', description: 'Delete an email' },

  // Slack — LOW RISK (read)
  { keywords: ['list channel', 'search slack', 'read message', 'check slack', 'slack history', 'list slack'],
    service: 'slack', action: 'read_slack', riskLevel: 'low', description: 'Read Slack messages and channels' },
  // Slack — HIGH RISK (write)
  { keywords: ['send slack', 'post slack', 'send message', 'post message', 'message channel', 'write slack', 'slack message to'],
    service: 'slack', action: 'post_slack_message', riskLevel: 'high', description: 'Post a message to Slack' },

  // Jira — LOW RISK (read)
  { keywords: ['list ticket', 'search jira', 'find issue', 'list issue', 'check jira', 'jira status', 'show ticket', 'search ticket'],
    service: 'jira', action: 'read_jira', riskLevel: 'low', description: 'Search and read Jira issues' },
  // Jira — HIGH RISK (write)
  { keywords: ['create ticket', 'create issue', 'new ticket', 'new issue', 'create jira', 'make ticket', 'open ticket'],
    service: 'jira', action: 'create_jira_issue', riskLevel: 'high', description: 'Create a new Jira issue' },
  { keywords: ['delete ticket', 'delete issue', 'remove ticket', 'close ticket', 'remove issue'],
    service: 'jira', action: 'delete_jira_issue', riskLevel: 'high', description: 'Delete or close a Jira issue' },
  { keywords: ['update ticket', 'update issue', 'edit ticket', 'modify ticket', 'assign ticket', 'change ticket'],
    service: 'jira', action: 'update_jira_issue', riskLevel: 'high', description: 'Update a Jira issue' },
];

export function classifyAction(userMessage: string): RiskClassification | null {
  const lower = userMessage.toLowerCase();

  for (const pattern of ACTION_PATTERNS) {
    const matched = pattern.keywords.some(kw => lower.includes(kw));
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

  // Default: if message mentions a service but no specific action
  if (lower.includes('gmail') || lower.includes('email')) {
    return { level: 'low', action: 'read_emails', service: 'gmail', description: 'Access Gmail', dataAffected: 'Email data' };
  }
  if (lower.includes('slack')) {
    return { level: 'low', action: 'read_slack', service: 'slack', description: 'Access Slack', dataAffected: 'Slack data' };
  }
  if (lower.includes('jira') || lower.includes('ticket') || lower.includes('issue')) {
    return { level: 'low', action: 'read_jira', service: 'jira', description: 'Access Jira', dataAffected: 'Jira data' };
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
    case 'jira': {
      const ticketMatch = message.match(/([A-Z]+-\d+)/i);
      if (ticketMatch) return `Issue ${ticketMatch[1].toUpperCase()}`;
      return 'Jira project';
    }
    default:
      return 'Service data';
  }
}

export function isHighRisk(classification: RiskClassification | null): boolean {
  return classification?.level === 'high';
}
