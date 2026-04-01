import { Settings, ExternalLink, ShieldCheck, Lock, Activity } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { getSetupStatus } from '@/lib/auth-config';
import { getSlackConnectedAccountStatus } from '@/lib/connected-accounts';

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

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const setup = getSetupStatus();
  const slackStatus = await getSlackConnectedAccountStatus();
  const slackParam = typeof searchParams?.slack === 'string' ? searchParams.slack : '';
  const slackMessage =
    typeof searchParams?.message === 'string' ? decodeURIComponent(searchParams.message) : '';

  return (
    <div className="flex flex-col min-h-full w-full p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-surface-900" />
        <div>
          <h1 className="text-2xl font-semibold text-surface-900">Settings & Integrations</h1>
          <p className="text-sm text-surface-600 mt-1">
            This page is the implementation checklist for the hackathon demo. Slack is the first live
            integration path.
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

      {(slackParam === 'connect-error' || slackParam === 'error') && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {slackMessage || 'Slack could not be connected. Start the Connect Slack flow again.'}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="w-12 h-12 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-4 text-brand-400">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium text-white">Auth0 + Token Vault + Slack</h3>
            </div>
            <StatusPill ready={setup.tokenVaultReady} />
          </div>

          <p className="text-sm text-surface-600">
            Dashboard path you need:{' '}
            <code>Applications -&gt; Applications -&gt; SecureDesk</code>,{' '}
            <code>Applications -&gt; APIs</code>, and{' '}
            <code>Authentication -&gt; Social Connections -&gt; Slack</code>.
          </p>

          <StepList
            steps={[
              'In Applications > Applications > SecureDesk > Advanced Settings > Grant Types, enable Authorization Code, Refresh Token, and Token Vault.',
              'In Applications > Applications > SecureDesk > Multi-Resource Refresh Token, edit the configuration and toggle on My Account API.',
              'In Applications > APIs, create or verify the custom API identifier matches AUTH0_AUDIENCE.',
              'In Applications > APIs, open Auth0 My Account API and authorize SecureDesk with the Connected Accounts scopes.',
              'In Authentication > Social Connections, create the Slack connection if it does not exist yet, then enable it for SecureDesk and look for Connected Accounts for Token Vault under Purpose.',
              'If you do not see Connected Accounts for Token Vault, your tenant likely does not have Token Vault enabled yet and you should ask the organizers/Auth0 contact to enable it for the hackathon tenant.',
            ]}
          />

          <div className="rounded-xl border border-surface-300 bg-surface-100/50 p-4 text-xs text-surface-600 space-y-2">
            <p>Current audience: {setup.audience || 'missing'}</p>
            <p>Current Slack connection name: {setup.slackConnectionName || 'missing'}</p>
            <p>Current Slack connection id: {setup.slackConnectionId || 'missing'}</p>
            <p>Easiest live demo path: enable Slack as the Auth0 social connection and sign in with Slack for the demo user.</p>
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
              'Create tuples like user:YOUR_AUTH0_SUB invoke tool:read_slack and user:YOUR_AUTH0_SUB invoke tool:post_slack_message.',
              'Copy FGA_API_URL, FGA_STORE_ID, FGA_MODEL_ID, FGA_CLIENT_ID, and FGA_CLIENT_SECRET into .env.local.',
              'Restart the dev server after saving the variables.',
            ]}
          />

          <pre className="overflow-x-auto rounded-xl border border-surface-300 bg-surface-100/50 p-4 text-xs text-surface-600">
{`model
  schema 1.1

type user

type tool
  relations
    define invoke: [user]`}
          </pre>

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
            Treat this as phase 2. It strengthens the demo, but Token Vault is the required feature and
            should not be blocked by CIBA availability.
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
    </div>
  );
}
