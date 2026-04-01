import { getTokenForService } from '../auth0';

export async function getJiraToken(accessToken: string): Promise<string> {
  const connectionId = process.env.JIRA_CONNECTION_ID || 'atlassian';
  return getTokenForService(accessToken, connectionId);
}

export async function readJiraIssues(token: string): Promise<any[]> {
  const baseUrl = process.env.JIRA_BASE_URL;
  try {
    if(!baseUrl) throw new Error('Jira base URL not configured');
    const response = await fetch(`${baseUrl}/rest/api/3/search?jql=assignee=currentUser()`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!response.ok) throw new Error('Failed to fetch Jira issues');
    const data = await response.json();
    return data.issues || [];
  } catch (error) {
    console.warn('Jira read failed or not configured, returning mock data:', error);
    return [
      { key: 'PROJ-101', fields: { summary: 'Fix login page CSS bugs', status: { name: 'In Progress' } } },
      { key: 'PROJ-102', fields: { summary: 'Implement Auth0 CIBA flow', status: { name: 'To Do' } } },
    ];
  }
}

export async function createJiraIssue(token: string, projectKey: string, summary: string, description: string): Promise<string> {
  try {
    console.log(`Creating Jira issue in ${projectKey}: ${summary} (mock)`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return `${projectKey}-${Math.floor(Math.random() * 1000)}`;
  } catch (error) {
    console.error('Failed to create Jira issue:', error);
    throw error;
  }
}

export async function deleteJiraIssue(token: string, issueKey: string): Promise<boolean> {
  try {
    console.log(`Deleting Jira issue ${issueKey} (mock)`);
    await new Promise((resolve) => setTimeout(resolve, 800));
    return true;
  } catch (error) {
    console.error(`Failed to delete Jira issue ${issueKey}:`, error);
    return false;
  }
}
