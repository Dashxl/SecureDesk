import { Settings, ExternalLink, ShieldCheck, Lock, Activity, Mail, Slack, PlugZap, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { getSetupStatus, safeGetSession } from '@/lib/auth-config';
import {
  getGmailConnectedAccountStatus,
  getSlackConnectedAccountStatus,
  hasUsableGmailConnectedAccountViaTokenVault,
  hasUsableSlackConnectedAccountViaTokenVault,
} from '@/lib/connected-accounts';
import { getRecommendedFgaModel, getRecommendedFgaTuples } from '@/lib/fga';
import { getConnectedServiceSnapshots } from '@/lib/connected-service-store';
import { formatDistanceToNow } from 'date-fns';

function deriveDisplayStatus(args: {
  connected: boolean;
  accounts: Array<{ id: string; connection: string }>;
  error: string | null;
  runtimeConnected?: boolean;
  runtimeError?: string | null;
  snapshot?: {
    connectionId?: string | null;
    status?: string | null;
  } | null;
  fallbackConnection: string;
}) {
  const snapshotConnected = args.snapshot?.status === 'connected';
  const runtimeConnected = args.runtimeConnected === true;
  const available = args.connected || runtimeConnected;

  if (available) {
    return {
      connected: args.connected,
      available,
      observedPreviously: snapshotConnected,
      accounts:
        args.accounts.length > 0
          ? args.accounts
          : [
              {
                id: args.snapshot?.connectionId || `observed-${args.fallbackConnection}`,
                connection: args.snapshot?.connectionId || args.fallbackConnection,
              },
            ],
      error: args.connected ? args.error : null,
      derivedFromObservedUsage: !args.connected && (snapshotConnected || runtimeConnected),
      derivedFromRuntimeCheck: !args.connected && runtimeConnected,
      runtimeError: args.runtimeError || null,
    };
  }

  return {
    connected: false,
    available: false,
    observedPreviously: snapshotConnected,
    accounts: [],
    error: args.error || args.runtimeError || null,
    derivedFromObservedUsage: false,
    derivedFromRuntimeCheck: false,
    runtimeError: args.runtimeError || null,
  };
}

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

function CompactBulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-surface-600">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-300/80" />
          <span className="flex-1 leading-6">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function TechnicalDisclosure({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-surface-300 bg-surface-100/40">
      <summary className="flex cursor-pointer list-none flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="mt-1 text-xs leading-6 text-surface-600">{summary}</p>
        </div>
        <ChevronDown className="h-4 w-4 text-surface-600 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-surface-300 px-5 py-4">{children}</div>
    </details>
  );
}

function SlackConnectionPill({
  connected,
  available,
}: {
  connected: boolean;
  available: boolean;
}) {
  const stateClass = connected
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : available
      ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-200';

  const stateLabel = connected ? 'Connected' : available ? 'Available' : 'Not connected';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${stateClass}`}
    >
      {stateLabel}
    </span>
  );
}

function ServiceStatusCard({
  title,
  icon,
  connected,
  available,
  connectionCount,
  lastObserved,
  statusSource,
  connectHref,
  revokeAction,
  canRevoke = true,
  showConnectAction = true,
}: {
  title: string;
  icon: React.ReactNode;
  connected: boolean;
  available: boolean;
  connectionCount: number;
  lastObserved?: string | null;
  statusSource: string;
  connectHref: string;
  revokeAction: string;
  canRevoke?: boolean;
  showConnectAction?: boolean;
}) {
  const showConnectButton = showConnectAction && !connected && !available;
  const showRevokeButton = canRevoke && (connected || available);

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
                        : available
                          ? 'Available through runtime'
                          : 'No connected account'}
                    </p>
                  </div>
        </div>
        <SlackConnectionPill connected={connected} available={available} />
      </div>

      <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
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
          <div className="mt-2 text-sm text-white">{statusSource}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {showConnectButton && (
          <a
            href={connectHref}
            className="btn-primary inline-flex items-center justify-center px-4 py-2 text-sm"
          >
            {`Connect ${title}`}
          </a>
        )}
        {showRevokeButton && (
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
  const session = await safeGetSession();
  const currentUserId = session?.user?.sub || '';
  const slackStatus = currentUserId
    ? await getSlackConnectedAccountStatus()
    : {
        connected: false,
        accounts: [],
        error: 'Sign in to inspect Slack connected accounts.',
      };
  const gmailStatus = currentUserId
    ? await getGmailConnectedAccountStatus()
    : {
        connected: false,
        accounts: [],
        error: 'Sign in to inspect Gmail connected accounts.',
      };
  const serviceSnapshots = currentUserId
    ? await getConnectedServiceSnapshots(currentUserId)
    : [];
  const slackRuntimeStatus = currentUserId
    ? await hasUsableSlackConnectedAccountViaTokenVault()
    : { connected: false, error: null };
  const gmailRuntimeStatus = currentUserId
    ? await hasUsableGmailConnectedAccountViaTokenVault()
    : { connected: false, error: null };
  const fgaTuples = currentUserId ? getRecommendedFgaTuples(currentUserId) : [];
  const slackParam = typeof searchParams?.slack === 'string' ? searchParams.slack : '';
  const gmailParam = typeof searchParams?.gmail === 'string' ? searchParams.gmail : '';
  const slackMessage =
    typeof searchParams?.message === 'string' ? decodeURIComponent(searchParams.message) : '';
  const gmailMessage =
    typeof searchParams?.message === 'string' ? decodeURIComponent(searchParams.message) : '';
  const slackSnapshot = serviceSnapshots.find((snapshot) => snapshot.service === 'slack');
  const gmailSnapshot = serviceSnapshots.find((snapshot) => snapshot.service === 'gmail');
  const resolvedSlackStatus = deriveDisplayStatus({
    connected: slackStatus.connected,
    accounts: slackStatus.accounts,
    error: slackStatus.error,
    runtimeConnected: slackRuntimeStatus.connected,
    runtimeError: slackRuntimeStatus.error,
    snapshot: slackSnapshot,
    fallbackConnection: setup.slackConnectionName || setup.slackConnectionId || 'slack',
  });
  const resolvedGmailStatus = deriveDisplayStatus({
    connected: gmailStatus.connected,
    accounts: gmailStatus.accounts,
    error: gmailStatus.error,
    runtimeConnected: gmailRuntimeStatus.connected,
    runtimeError: gmailRuntimeStatus.error,
    snapshot: gmailSnapshot,
    fallbackConnection: setup.gmailConnectionName || setup.gmailConnectionId || 'google-oauth2',
  });
  const effectiveSlackStatus =
    slackParam === 'connected'
      ? {
          connected: true,
          available: true,
          accounts:
            resolvedSlackStatus.accounts.length > 0
              ? resolvedSlackStatus.accounts
              : [
                  {
                    id: 'recent-slack-connect',
                    connection: setup.slackConnectionName || setup.slackConnectionId || 'slack',
                  },
                ],
          error: null,
          derivedFromObservedUsage: false,
          derivedFromRuntimeCheck: false,
          observedPreviously: false,
          runtimeError: null,
        }
      : slackParam === 'revoked'
        ? {
            connected: false,
            available: false,
            observedPreviously: false,
            accounts: [],
            error: null,
            derivedFromObservedUsage: false,
            derivedFromRuntimeCheck: false,
            runtimeError: null,
          }
        : resolvedSlackStatus;
  const effectiveGmailStatus =
    gmailParam === 'connected'
      ? {
          connected: true,
          available: true,
          accounts:
            resolvedGmailStatus.accounts.length > 0
              ? resolvedGmailStatus.accounts
              : [
                  {
                    id: 'recent-gmail-connect',
                    connection: setup.gmailConnectionName || setup.gmailConnectionId || 'google-oauth2',
                  },
                ],
          error: null,
          derivedFromObservedUsage: false,
          derivedFromRuntimeCheck: false,
          observedPreviously: false,
          runtimeError: null,
        }
      : gmailParam === 'revoked'
        ? {
            connected: false,
            available: false,
            observedPreviously: false,
            accounts: [],
            error: null,
            derivedFromObservedUsage: false,
            derivedFromRuntimeCheck: false,
            runtimeError: null,
          }
        : resolvedGmailStatus;
  const readyServicesCount = Number(effectiveSlackStatus.available) + Number(effectiveGmailStatus.available);
  const needsConnectionOnboarding = readyServicesCount < 2;
  const slackStateSource = effectiveSlackStatus.derivedFromRuntimeCheck
    ? 'Token Vault runtime check'
    : effectiveSlackStatus.connected
      ? 'Auth0 Connected Accounts'
      : effectiveSlackStatus.observedPreviously
        ? 'Historical observed usage'
        : 'No live connection';
  const gmailStateSource = effectiveGmailStatus.derivedFromRuntimeCheck
    ? 'Token Vault runtime check'
    : effectiveGmailStatus.connected
      ? 'Auth0 Connected Accounts'
      : effectiveGmailStatus.observedPreviously
        ? 'Historical observed usage'
        : 'No live connection';
  const canRevokeSlack = slackStatus.connected && slackStatus.accounts.length > 0;
  const canRevokeGmail = gmailStatus.connected && gmailStatus.accounts.length > 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col space-y-5 overflow-y-auto p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <Settings className="w-6 h-6 text-surface-900" />
        <div>
          <h1 className="text-xl font-semibold text-surface-900 sm:text-2xl">Settings & Integrations</h1>
            <p className="text-sm text-surface-600 mt-1">
              This page is the live control surface for SecureDesk. Slack and Gmail are connected through
              Auth0 Token Vault, and SecureDesk surfaces the exact security state used by the runtime.
          </p>
        </div>
      </div>

      {needsConnectionOnboarding && (
        <Card className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-200">
                First-Time Setup
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Connect Slack and Gmail before you use SecureDesk
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-surface-600">
                SecureDesk can only read or act inside services that you explicitly connect through Auth0
                Connected Accounts. Start by connecting Slack and Gmail below, then return to the workspace
                to chat naturally with the agent.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-surface-100/40 px-4 py-3 text-sm text-surface-600">
              {readyServicesCount}/2 required app connections are ready.
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-surface-300 bg-surface-100/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-surface-300 bg-surface-200 text-brand-300">
                    <Slack className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-900">Connect Slack</p>
                    <p className="text-xs text-surface-600">
                      Required for channel reads and approved message posting.
                    </p>
                  </div>
                </div>
                <SlackConnectionPill
                  connected={effectiveSlackStatus.connected}
                  available={effectiveSlackStatus.available}
                />
              </div>
              {!effectiveSlackStatus.connected && !effectiveSlackStatus.available && (
                <a
                  href="/api/integrations/slack/connect"
                  className="btn-primary mt-4 inline-flex items-center justify-center px-4 py-2 text-sm"
                >
                  Connect Slack
                </a>
              )}
            </div>

            <div className="rounded-xl border border-surface-300 bg-surface-100/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-surface-300 bg-surface-200 text-brand-300">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-900">Connect Gmail</p>
                    <p className="text-xs text-surface-600">
                      Required for inbox reads, summaries, and approved email delivery.
                    </p>
                  </div>
                </div>
                <SlackConnectionPill
                  connected={effectiveGmailStatus.connected}
                  available={effectiveGmailStatus.available}
                />
              </div>
              {!effectiveGmailStatus.connected && !effectiveGmailStatus.available && (
                <a
                  href="/api/integrations/gmail/connect"
                  className="btn-primary mt-4 inline-flex items-center justify-center px-4 py-2 text-sm"
                >
                  Connect Gmail
                </a>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            SecureDesk will stay partially unavailable until both services are connected. The chat
            experience becomes fully functional after Slack and Gmail are authorized.
          </div>
        </Card>
      )}

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
          {slackMessage
            ? `Slack access was cleared in SecureDesk. Auth0 returned: ${slackMessage}`
            : 'Slack access revoked.'}
        </div>
      )}

      {gmailParam === 'revoked' && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          {gmailMessage
            ? `Gmail access was cleared in SecureDesk. Auth0 returned: ${gmailMessage}`
            : 'Gmail access revoked.'}
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
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
            SecureDesk uses Auth0 Connected Accounts and Token Vault so Slack and Gmail access stays
            delegated, scoped, and off the client.
          </p>

          <CompactBulletList
            items={[
              'Users explicitly connect Slack and Gmail before SecureDesk can act inside either service.',
              'Provider access tokens are exchanged server-side through Token Vault instead of being exposed to the browser.',
              'Connection status is verified against live runtime checks so the UI reflects what the agent can actually use.',
            ]}
          />

          <div className="rounded-xl border border-surface-300 bg-surface-100/50 p-4 text-xs text-surface-600 space-y-2">
            <p>Audience: {setup.audience || 'missing'}</p>
            <p>Slack connection configured: {setup.slackConnectionName || setup.slackConnectionId || 'missing'}</p>
            <p>Gmail connection configured: {setup.gmailConnectionName || setup.gmailConnectionId || 'missing'}</p>
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
            Auth0 FGA limits what SecureDesk is allowed to do before any provider call is made.
          </p>

          <CompactBulletList
            items={[
              'Slack and Gmail actions are evaluated against explicit tool permissions.',
              'The runtime blocks execution when policy is missing or denies access.',
              'This keeps authorization visible and reviewable for both judges and end users.',
            ]}
          />

          <div className="rounded-xl border border-surface-300 bg-surface-100/50 p-4 text-xs text-surface-600 space-y-2">
            <p>Store configured: {process.env.FGA_STORE_ID ? 'yes' : 'no'}</p>
            <p>Model configured: {process.env.FGA_MODEL_ID ? 'yes' : 'no'}</p>
            <p>Auth0 subject available: {currentUserId ? 'yes' : 'sign in required'}</p>
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
            High-risk actions move into explicit approval, with Guardian as the preferred path when
            the tenant supports CIBA.
          </p>

          <CompactBulletList
            items={[
              'Write actions pause for review before SecureDesk releases them.',
              'Guardian approval is used when CIBA is available in the tenant.',
              'If CIBA is unavailable, SecureDesk keeps the action inside an explicit in-product approval flow.',
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
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-200">
            Technical Setup
          </p>
          <h3 className="mt-2 text-lg font-medium text-white">Judge Notes & Configuration Details</h3>
          <p className="mt-2 text-sm text-surface-600">
            Expanded setup notes for judges, final deployment checks, or last-mile tenant configuration.
          </p>
        </div>

        <TechnicalDisclosure
          title="Auth0 + Token Vault setup"
          summary="Grant types, Connected Accounts, social connection expectations, and required provider scopes."
        >
          <div className="space-y-4">
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
              <p>Current Gmail connection name: {setup.gmailConnectionName || 'missing'}</p>
              <p>Current Gmail connection id: {setup.gmailConnectionId || 'missing'}</p>
              <p>Required Slack scopes: `channels:read`, `groups:read`, `chat:write`.</p>
              <p>Required Gmail scopes: `gmail.readonly` and `gmail.send`.</p>
            </div>
          </div>
        </TechnicalDisclosure>

        <TechnicalDisclosure
          title="Auth0 FGA model and tuples"
          summary="Recommended minimal model plus tuple examples for the signed-in user."
        >
          <div className="space-y-4">
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

            <pre className="overflow-x-auto rounded-xl border border-surface-300 bg-surface-100/50 p-4 text-[11px] text-surface-600">
{getRecommendedFgaModel()}
            </pre>

            <div className="rounded-xl border border-surface-300 bg-surface-100/50 p-4 text-xs text-surface-600 space-y-2">
              <p>Current Auth0 subject: {currentUserId || 'Sign in to reveal your subject.'}</p>
              <p>Recommended tuple entries:</p>
              {fgaTuples.length > 0 ? (
                <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-6">
                  {fgaTuples.join('\n')}
                </pre>
              ) : (
                <p className="text-[11px]">Sign in first so SecureDesk can show the exact tuples for your user.</p>
              )}
              <p>Optional issuer override: {process.env.FGA_API_TOKEN_ISSUER || 'https://fga.us.auth0.com/'}</p>
              <p>Optional audience override: {process.env.FGA_API_AUDIENCE || 'https://api.us1.fga.dev/'}</p>
            </div>
          </div>
        </TechnicalDisclosure>

        <TechnicalDisclosure
          title="CIBA / Guardian rollout"
          summary="Approval prerequisites for high-risk actions when the tenant supports backchannel auth."
        >
          <StepList
            steps={[
              'In Applications > Applications > SecureDesk, enable the CIBA grant type if your tenant shows it.',
              'Enable Guardian Push under Security > Multi-factor Auth.',
              'Enroll the operating user in Guardian.',
              'Populate AUTH0_CIBA_CLIENT_ID, AUTH0_CIBA_CLIENT_SECRET, and AUTH0_CIBA_AUDIENCE only if CIBA is available in your tenant.',
              'If the CIBA option is missing, ask the organizers whether the hackathon tenant includes it.',
            ]}
          />
        </TechnicalDisclosure>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="w-12 h-12 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-4 text-brand-300">
              <PlugZap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-white">Connected Workspace Apps</h3>
            <p className="mt-2 text-sm text-surface-600">
              This is the single place where users should connect, reconnect, or revoke the apps that
              SecureDesk can use. "Observed refresh" is the last time SecureDesk successfully exchanged or
              used a provider token for that service.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ServiceStatusCard
            title="Slack"
            icon={<Slack className="h-5 w-5" />}
            connected={effectiveSlackStatus.connected}
            available={effectiveSlackStatus.available}
            connectionCount={effectiveSlackStatus.accounts.length}
            lastObserved={slackSnapshot?.lastUsed?.toISOString?.() || slackSnapshot?.lastUsed?.toString?.() || null}
            statusSource={slackStateSource}
            connectHref="/api/integrations/slack/connect"
            revokeAction="/api/integrations/slack/revoke"
            canRevoke={canRevokeSlack}
            showConnectAction={!needsConnectionOnboarding}
          />
          <ServiceStatusCard
            title="Gmail"
            icon={<Mail className="h-5 w-5" />}
            connected={effectiveGmailStatus.connected}
            available={effectiveGmailStatus.available}
            connectionCount={effectiveGmailStatus.accounts.length}
            lastObserved={gmailSnapshot?.lastUsed?.toISOString?.() || gmailSnapshot?.lastUsed?.toString?.() || null}
            statusSource={gmailStateSource}
            connectHref="/api/integrations/gmail/connect"
            revokeAction="/api/integrations/gmail/revoke"
            canRevoke={canRevokeGmail}
            showConnectAction={!needsConnectionOnboarding}
          />
        </div>

        <div className="rounded-xl border border-surface-300 bg-surface-100/50 p-4 text-xs text-surface-600 space-y-2">
          <p>Observed refreshes are stored when SecureDesk successfully exchanges a provider token through Token Vault.</p>
          {effectiveSlackStatus.derivedFromObservedUsage && (
            <p>Slack is currently shown as available because SecureDesk recently used a valid Slack provider token successfully.</p>
          )}
          {effectiveGmailStatus.derivedFromObservedUsage && (
            <p>Gmail is currently shown as available because SecureDesk recently used a valid Gmail provider token successfully.</p>
          )}
          {effectiveSlackStatus.derivedFromRuntimeCheck && (
            <p>Slack is currently shown as available because SecureDesk confirmed a live Token Vault exchange for this user.</p>
          )}
          {effectiveGmailStatus.derivedFromRuntimeCheck && (
            <p>Gmail is currently shown as available because SecureDesk confirmed a live Token Vault exchange for this user.</p>
          )}
          {!effectiveSlackStatus.available && effectiveSlackStatus.observedPreviously && (
            <p>Slack had previously been observed through Token Vault, but SecureDesk can no longer confirm live access. Reconnect or revoke to clear the stale state.</p>
          )}
          {!effectiveGmailStatus.available && effectiveGmailStatus.observedPreviously && (
            <p>Gmail had previously been observed through Token Vault, but SecureDesk can no longer confirm live access. Reconnect or revoke to clear the stale state.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
