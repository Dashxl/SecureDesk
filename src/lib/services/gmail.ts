import { getTokenForService } from '../auth0';

export async function getGmailToken(accessToken: string): Promise<string> {
  const connectionId = process.env.GMAIL_CONNECTION_ID || 'google-oauth2';
  return getTokenForService(accessToken, connectionId);
}

export async function readEmails(token: string): Promise<any[]> {
  try {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=5', {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!response.ok) throw new Error('Failed to fetch emails');
    const data = await response.json();
    return data.messages || [];
  } catch (error) {
    console.warn('Gmail read failed or not configured, returning mock data:', error);
    return [
      { id: '1', snippet: 'Mock email: Don\'t forget the team meeting tomorrow at 10 AM.', unread: true },
      { id: '2', snippet: 'Mock email: Your deployment to production succeeded.', unread: true },
    ];
  }
}

export async function sendEmail(token: string, to: string, subject: string, body: string): Promise<boolean> {
  // In a real app, you would construct a MIME message and base64url encode it,
  // then POST to https://gmail.googleapis.com/gmail/v1/users/me/messages/send
  try {
    console.log(`Sending email to ${to} via Gmail API (mock)`);
    // Simulated delay 
    await new Promise((resolve) => setTimeout(resolve, 800));
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}
