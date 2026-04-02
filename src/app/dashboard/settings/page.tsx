import { Settings, ExternalLink, ShieldCheck, Lock, Activity, Mail, Slack, RefreshCw, PlugZap } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { getSetupStatus, safeGetSession } from '@/lib/auth-config';
import { getGmailConnectedAccountStatus, getSlackConnectedAccountStatus } from '@/lib/connected-accounts';
import { getRecommendedFgaModel, getRecommendedFgaTuples } from '@/lib/fga';
import { getConnectedServiceSnapshots } from '@/lib/connected-service-store';
import { formatDistanceToNow } from 'date-fns';

function StatusPill({ ready }: { ready: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        ready
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      }`}
    >
      {ready ? 'Ready' : 'Needs setup'}
    </span>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2 text-sm text-surface-600 list-decimal list-inside">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}

function SlackConnectionPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        connected
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      }`}
    >
      {connected ? 'Connected' : 'Not connected'}
    </span>
  );
}

function ServiceStatusCard({
  title,
  icon,
  connected,
  connectionCount,
  lastObserved,
  connectHref,
  revokeAction,
}: {
  title: string;
  icon: React.ReactNode;
  connected: boolean;
  connectionCount: number;
  lastObserved?: string | null;
  connectHref: string;
  revokeAction: string;
}) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100/50 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-surface-300 bg-surface-200 text-brand-300">
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-surface-900">{title}</p>
            <p className="text-xs text-surface-600">
              {connected
                ? `${connectionCount} connected account${connectionCount === 1 ? '' : 's'}`
                : 'No connected account'}
            </p>
          </div>
        </div>
        <SlackConnectionPill connected={connected} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-surface-300 bg-surface-100/40 px-3 py-2">
          <div className="uppercase tracking-[0.18em] text-surface-600">Observed refresh</div>
          <div className="mt-2 text-sm text-white">
            {lastObserved
              ? formatDistanceToNow(new Date(lastObserved), { addSuffix: true })
              : 'Not observed yet'}
          </div>
        </div>
        <div className="rounded-lg border border-surface-300 bg-surface-100/40 px-3 py-2">
          <div className="uppercase tracking-[0.18em] text-surface-600">State source</div>
          <div className="mt-2 text-sm text-white">Auth0 Connected Accounts</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={connectHref}
          className="btn-primary inline-flex items-center justify-center px-4 py-2 text-sm"
        >
          Connect {title}
        </a>
        {connected && (
          <form action={revokeAction} method="post">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/15"
            >
              Revoke access
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const setup = getSetupStatus();
  const slackStatus = await getSlackConnectedAccountStatus();
  const gmailStatus = await getGmailConnectedAccountStatus();
  const session = await safeGetSession();
  const currentUserId = session?.user?.sub || '';
  const serviceSnapshots = currentUserId
    ? await getConnectedServiceSnapshots(currentUserId)
    : [];
  const fgaTuples = currentUserId ? getRecommendedFgaTuples(currentUserId) : [];
  const slackParam = typeof searchParams?.slack === 'string' ? searchParams.slack : '';
  const gmailParam = typeof searchParams?.gmail === 'string' ? searchParams.gmail : '';
  const slackMessage =
    typeof searchParams?.message === 'string' ? decodeURIComponent(searchParams.message) : '';
  const gmailMessage =
    typeof searchParams?.message === 'string' ? decodeURIComponent(searchParams.message) : '';
  const slackSnapshot = serviceSnapshots.find((snapshot) => snapshot.service === 'slack');
  const gmailSnapshot = serviceSnapshots.find((snapshot) => snapshot.service === 'gmail');
  const effectiveSlackStatus =
    slackParam === 'connected'
      ? {
          connected: true,
          accounts:
            slackStatus.accounts.length > 0
              ? slackStatus.accounts
              : [
                  {
                    id: 'recent-slack-connect',
                    connection: setup.slackConnectionName || setup.slackConnectionId || 'slack',
                  },
                ],
          error: null,
        }
      : slackParam === 'revoked'
        ? {
            connected: false,
            accounts: [],
            error: null,
          }
        : slackStatus;
  const effectiveGmailStatus =
    gmailParam === 'connected'
      ? {
          connected: true,
          accounts:
            gmailStatus.accounts.length > 0
              ? gmailStatus.accounts
              : [
                  {
                    id: 'recent-gmail-connect',
                    connection: setup.gmailConnectionName || setup.gmailConnectionId || 'google-oauth2',
                  },
                ],
          error: null,
        }
      : gmailParam === 'revoked'
        ? {
            connected: false,
            accounts: [],
            error: null,
          }
        : gmailStatus;

  return (
    <div className="flex flex-col min-h-full w-full p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-surface-900" />
        <div>
          <h1 className="text-2xl font-semibold text-surface-900">Settings & Integrations</h1>
          <p className="text-sm text-surface-600 mt-1">
            This page is the live control surface for SecureDesk. Slack and Gmail are connected through
            Auth0 Token Vault, and SecureDesk surfaces the exact security state used by the runtime.
          </p>
        </div>
      </div>

      {setup.issuerPathMismatch && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          `AUTH0_ISSUER_BASE_URL` should be the tenant root only. Remove `/api/v2` from the value in
          `.env.local`.
        </div>
      )}

      {slackParam === 'connected' && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
          Slack connected account created successfully. Token Vault can now use this user connection.
        </div>
      )}

      {gmailParam === 'connected' && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
          Gmail connected account created successfully. Token Vault can now use this user connection.
        </div>
      )}

      {slackParam === 'revoked' && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          Slack connected account revoked.
        </div>
      )}

      {gmailParam === 'revoked' && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          Gmail connected account revoked.
        </div>
      )}

      {(slackParam === 'connect-error' || slackParam === 'error') && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {slackMessage || 'Slack could not be connected. Start the Connect Slack flow again.'}
        </div>
      )}

      {(gmailParam === 'connect-error' || gmailParam === 'error' || gmailParam === 'revoke-error') && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {gmailMessage || 'Gmail could not be connected. Start the Connect Gmail flow again.'}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="w-12 h-12 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-4 text-brand-400">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium text-white">Auth0 + Token Vault</h3>
            </div>
            <StatusPill ready={setup.tokenVaultReady} />
          </div>

          <p className="text-sm text-surface-600">
            Dashboard path you need:{' '}
            <code>Applications -&gt; Applications -&gt; SecureDesk</code>,{' '}
            <code>Applications -&gt; APIs</code>, and{' '}
            <code>Authentication -&gt; Social Connections</code>.
          </p>

          <StepList
            steps={[
              'In Applications > Applications > SecureDesk > Advanced Settings > Grant Types, enable Authorization Code, Refresh Token, and Token Vault.',
              'In Applications > Applications > SecureDesk > Multi-Resource Refresh Token, edit the configuration and toggle on My Account API.',
              'In Applications > APIs, create or verify the custom API identifier matches AUTH0_AUDIENCE.',
              'In Applications > APIs, open Auth0 My Account API and authorize SecureDesk with the Connected Accounts scopes.',
              'In Authentication > Social Connections, create or verify the Slack connection, then enable it for SecureDesk and look for Connected Accounts for Token Vault under Purpose.',
              'Create or verify the Google social connection for Gmail Connected Accounts, with offline access and Gmail scopes for readonly + send.',
              'If you do not see Connected Accounts for Token Vault, your tenant likely does not have Token Vault enabled yet and you should ask the organizers/Auth0 contact to enable it for the hackathon tenant.',
            ]}
          />

          <div className="rounded-xl border border-surface-300 bg-surface-100/50 p-4 text-xs text-surface-600 space-y-2">
            <p>Current audience: {setup.audience || 'missing'}</p>
            <p>Current Slack connection name: {setup.slackConnectionName || 'missing'}</p>
            <p>Current Slack connection id: {setup.slackConnectionId || 'missing'}</p>
            <p>Easiest live demo path: sign in with Slack, connect Slack and Gmail once, then let SecureDesk act through Connected Accounts.</p>
            <p>Expected Slack scopes for the live demo: `channels:read`, `groups:read`, `chat:write`.</p>
          </div>

          <div className="rounded-xl border border-surface-300 bg-surface-100/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-surface-900">Slack Connected Account</p>
                <p className="text-xs text-surface-600">
                  This must exist before Token Vault can exchange tokens for Slack.
                </p>
              </div>
              <SlackConnectionPill connected={slackStatus.connected} />
            </div>

            {slackStatus.connected ? (
              <p className="text-xs text-surface-600">
                Connected accounts found: {slackStatus.accounts.length}
              </p>
            ) : (
              <p className="text-xs text-surface-600">
                {slackStatus.error ||
                  'No Slack connected account exists yet for this user. Use the Connect Slack button below.'}
              </p>
            )}

            <a
              href="/api/integrations/slack/connect"
              className="btn-primary inline-flex items-center justify-center px-4 py-2 text-sm"
            >
              Connect Slack
            </a>
          </div>

          <div className="rounded-xl border border-surface-300 bg-surface-100/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-surface-900">Gmail Connected Account</p>
                <p className="text-xs text-surface-600">
                  Gmail uses the same Auth0 Connected Accounts + Token Vault pattern as Slack.
                </p>
              </div>
              <SlackConnectionPill connected={effectiveGmailStatus.connected} />
            </div>

            {effectiveGmailStatus.connected ? (
              <p className="text-xs text-surface-600">
                Connected accounts found: {effectiveGmailStatus.accounts.length}
              </p>
            ) : (
              <p className="text-xs text-surface-600">
                {effectiveGmailStatus.error ||
                  'No Gmail connected account exists yet for this user. Use the Connect Gmail button below.'}
              </p>
            )}

            <a
              href="/api/integrations/gmail/connect"
              className="btn-primary inline-flex items-center justify-center px-4 py-2 text-sm"
            >
              Connect Gmail
            </a>
          </div>

          <div className="rounded-xl border border-surface-300 bg-surface-100/50 p-4 text-xs text-surface-600 space-y-2">
            <p>Current Gmail connection name: {setup.gmailConnectionName || 'missing'}</p>
            <p>Current Gmail connection id: {setup.gmailConnectionId || 'missing'}</p>
            <p>Expected Gmail scopes for the live demo: `gmail.readonly` and `gmail.send`.</p>
          </div>

          <a
            href="https://auth0.com/docs/secure/tokens/token-vault/connected-accounts-for-token-vault"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-400 hover:text-brand-300"
          >
            Open Token Vault setup docs <ExternalLink className="w-4 h-4" />
          </a>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="w-12 h-12 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-4 text-emerald-500">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium text-white">Auth0 FGA</h3>
            </div>
            <StatusPill ready={setup.fgaReady} />
          </div>

          <p className="text-sm text-surface-600">
            Keep the model intentionally small for the judges. A single `tool` type with `invoke`
            relation is enough for the first real slice.
          </p>

          <StepList
            steps={[
              'Create an FGA store.',
              'Create a model with type user and type tool, with relation invoke.',
              'Create tuples for read_slack and post_slack_message using your real Auth0 subject shown below.',
              'Create tuples for read_emails and send_email too, so Gmail is covered by FGA before the judges test it.',
              'Copy FGA_API_URL, FGA_STORE_ID, FGA_MODEL_ID, FGA_CLIENT_ID, and FGA_CLIENT_SECRET into .env.local.',
              'Restart the dev server after saving the variables.',
            ]}
          />

          <pre className="overflow-x-auto rounded-xl border border-surface-300 bg-surface-100/50 p-4 text-xs text-surface-600">
{getRecommendedFgaModel()}
          </pre>

          <div className="rounded-xl border border-surface-300 bg-surface-100/50 p-4 text-xs text-surface-600 space-y-2">
            <p>Current Auth0 subject: {currentUserId || 'Sign in to reveal your subject.'}</p>
            <p>Recommended tuple entries:</p>
            {fgaTuples.length > 0 ? (
              <pre className="overflow-x-auto whitespace-pre-wrap text-[11px] leading-6">
                {fgaTuples.join('\n')}
              </pre>
            ) : (
              <p className="text-[11px]">Sign in first so SecureDesk can show the exact tuples for your user.</p>
            )}
            <p>Optional issuer override: {process.env.FGA_API_TOKEN_ISSUER || 'https://fga.us.auth0.com/'}</p>
            <p>Optional audience override: {process.env.FGA_API_AUDIENCE || 'https://api.us1.fga.dev/'}</p>
          </div>

          <a
            href="https://openfga.dev/docs/getting-started/configure-model"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-400 hover:text-brand-300"
          >
            Open FGA model docs <ExternalLink className="w-4 h-4" />
          </a>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="w-12 h-12 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-4 text-amber-500">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium text-white">CIBA / Guardian</h3>
            </div>
            <StatusPill ready={setup.cibaReady} />
          </div>

          <p className="text-sm text-surface-600">
            CIBA is the preferred approval path for high-risk actions. The in-app modal remains as a
            fallback so the demo still works if your tenant does not expose CIBA yet.
          </p>

          <StepList
            steps={[
              'In Applications > Applications > SecureDesk, enable the CIBA grant type if your tenant shows it.',
              'Enable Guardian Push under Security > Multi-factor Auth.',
              'Enroll your demo user in Guardian.',
              'Populate AUTH0_CIBA_CLIENT_ID, AUTH0_CIBA_CLIENT_SECRET, and AUTH0_CIBA_AUDIENCE only if CIBA is available in your tenant.',
              'If the CIBA option is missing, ask the organizers whether the hackathon tenant includes it.',
            ]}
          />

          <a
            href="https://auth0.com/docs/get-started/applications/configure-client-initiated-backchannel-authentication"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-400 hover:text-brand-300"
          >
            Open CIBA docs <ExternalLink className="w-4 h-4" />
          </a>
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="w-12 h-12 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-4 text-brand-300">
              <PlugZap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-white">Active Token Vault Connections</h3>
            <p className="mt-2 text-sm text-surface-600">
              Status comes from Auth0 Connected Accounts. "Observed refresh" is the last time SecureDesk
              successfully exchanged or used a provider token for that service.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ServiceStatusCard
            title="Slack"
            icon={<Slack className="h-5 w-5" />}
            connected={effectiveSlackStatus.connected}
            connectionCount={effectiveSlackStatus.accounts.length}
            lastObserved={slackSnapshot?.lastUsed?.toISOString?.() || slackSnapshot?.lastUsed?.toString?.() || null}
            connectHref="/api/integrations/slack/connect"
            revokeAction="/api/integrations/slack/revoke"
          />
          <ServiceStatusCard
            title="Gmail"
            icon={<Mail className="h-5 w-5" />}
            connected={effectiveGmailStatus.connected}
            connectionCount={effectiveGmailStatus.accounts.length}
            lastObserved={gmailSnapshot?.lastUsed?.toISOString?.() || gmailSnapshot?.lastUsed?.toString?.() || null}
            connectHref="/api/integrations/gmail/connect"
            revokeAction="/api/integrations/gmail/revoke"
          />
        </div>

        <div className="rounded-xl border border-surface-300 bg-surface-100/50 p-4 text-xs text-surface-600 space-y-2">
          <p>Slack status source: Auth0 Connected Accounts ({effectiveSlackStatus.connected ? 'connected' : 'not connected'}).</p>
          <p>Gmail status source: Auth0 Connected Accounts ({effectiveGmailStatus.connected ? 'connected' : 'not connected'}).</p>
          <p>Observed refreshes are stored when SecureDesk successfully exchanges a provider token through Token Vault.</p>
        </div>
      </Card>
    </div>
  );
}
