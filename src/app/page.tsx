import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { ShieldCheck, Lock, Activity, Bot, ArrowRight, CheckCircle2 } from 'lucide-react';
import { isAuth0Configured, safeGetSession } from '@/lib/auth-config';
import LogoWordmark from '@/app/img/Logo4.jpg';

const proofPoints = [
  'Auth0 Token Vault for delegated provider tokens',
  'Fine-grained authorization by tool and user',
  'Explicit approval before high-risk actions',
];

const featureCards = [
  {
    title: 'Token Vault Isolation',
    body: 'Third-party tokens stay inside Auth0. SecureDesk requests scoped delegated access only at execution time.',
    icon: Lock,
    tint: 'text-brand-300',
  },
  {
    title: 'Approval Boundaries',
    body: 'Reads can flow immediately. Writes pause for explicit user approval before data leaves the assistant.',
    icon: ShieldCheck,
    tint: 'text-white',
  },
  {
    title: 'Live Audit Trail',
    body: 'Every meaningful action is logged with risk, status, timestamp, and execution context for judges to inspect.',
    icon: Activity,
    tint: 'text-brand-200',
  },
];

export default async function LandingPage() {
  const authConfigured = isAuth0Configured();
  const session = await safeGetSession();
  const hasSession = Boolean(session?.user);
  const primaryHref = authConfigured ? (hasSession ? '/dashboard' : '/api/auth/login') : '#';
  const primaryLabel = hasSession ? 'Open Workspace' : 'Enter SecureDesk';
  const secondaryHref = hasSession ? '/dashboard/audit' : '/dashboard/settings';
  const secondaryLabel = hasSession ? 'Review Audit Trail' : 'Review Setup Guide';

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-0 text-surface-900">
      <div className="brand-orb left-[-10rem] top-[-8rem] h-80 w-80 bg-brand-500/30" />
      <div className="brand-orb right-[-6rem] top-20 h-72 w-72 bg-white/10" />
      <div className="brand-grid absolute inset-0 opacity-30" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-8 lg:px-10">
        <div className="flex items-center gap-4">
          <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#202857] shadow-[0_20px_48px_rgba(4,7,17,0.28)]">
            <Image src={LogoWordmark} alt="SecureDesk" className="h-14 w-auto object-contain" priority />
          </div>
          <div className="hidden rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-brand-200 md:block">
            Authorized to Act Demo
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={authConfigured ? (hasSession ? '/dashboard' : '/api/auth/login') : '#'}
            aria-disabled={!authConfigured}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              authConfigured
                ? 'text-surface-800 hover:text-white'
                : 'pointer-events-none text-surface-600 opacity-60'
            }`}
          >
            {hasSession ? 'Workspace' : 'Sign In'}
          </a>
          <a
            href={primaryHref}
            aria-disabled={!authConfigured}
            className={authConfigured ? '' : 'pointer-events-none opacity-60'}
          >
            <Button variant="primary" className="rounded-full px-5">
              {primaryLabel}
            </Button>
          </a>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 pb-20 pt-8 lg:px-10 lg:pt-10">
        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-2 text-sm font-medium text-brand-100">
              <Bot className="h-4 w-4" />
              Secure enterprise agent with visible security boundaries
            </div>

            <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-[-0.04em] text-white md:text-7xl">
              Delegated AI actions,
              <br />
              <span className="gradient-text">without blind trust.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-surface-700 md:text-xl">
              SecureDesk lets a real user act through AI while keeping credentials in Auth0 Token Vault,
              enforcing approval on risky steps, and recording every action in an auditable trail.
            </p>

            {!authConfigured && (
              <div className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-left text-sm text-amber-100">
                Auth0 is not configured yet. Add values for `AUTH0_SECRET`, `AUTH0_CLIENT_ID`,
                `AUTH0_CLIENT_SECRET`, and `AUTH0_ISSUER_BASE_URL` in `.env.local` to unlock the workspace.
              </div>
            )}

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a
                href={primaryHref}
                aria-disabled={!authConfigured}
                className={authConfigured ? '' : 'pointer-events-none opacity-60'}
              >
                <Button variant="primary" size="lg" className="w-full rounded-2xl px-7 sm:w-auto">
                  {hasSession ? 'Go to SecureDesk' : 'Launch Live Demo'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <a href={secondaryHref}>
                <Button variant="ghost" size="lg" className="w-full rounded-2xl border border-surface-300/80 bg-white/5 px-7 sm:w-auto">
                  {secondaryLabel}
                </Button>
              </a>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {proofPoints.map((point) => (
                <div
                  key={point}
                  className="brand-panel rounded-2xl px-4 py-4 text-sm font-medium text-surface-800"
                >
                  <div className="mb-3 flex items-center gap-2 text-brand-200">
                    <CheckCircle2 className="h-4 w-4" />
                    Verified
                  </div>
                  {point}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="brand-panel relative overflow-hidden rounded-[2rem] p-6 md:p-8">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-200">
                    SecureDesk Control Plane
                  </div>
                  <div className="mt-2 font-display text-2xl font-bold text-white">Token Vault + FGA + Audit</div>
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Live Slack Path
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#12192B] p-4">
                <Image
                  src={LogoWordmark}
                  alt="SecureDesk brand hero"
                  className="h-auto w-full rounded-2xl object-cover"
                  priority
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-surface-700">Low Risk</div>
                    <div className="mt-2 text-lg font-semibold text-white">Read Slack Channels</div>
                    <div className="mt-1 text-sm text-surface-700">Direct execution through delegated access.</div>
                  </div>
                  <div className="rounded-2xl border border-brand-400/20 bg-brand-500/10 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-brand-200">High Risk</div>
                    <div className="mt-2 text-lg font-semibold text-white">Post to Slack</div>
                    <div className="mt-1 text-sm text-surface-800">Approval gate + audit event before execution.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-20 grid gap-6 lg:grid-cols-3">
          {featureCards.map((card) => (
            <article key={card.title} className="glass-card-hover p-8">
              <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 ${card.tint}`}>
                <card.icon className="h-6 w-6" />
              </div>
              <h2 className="font-display text-2xl font-bold text-white">{card.title}</h2>
              <p className="mt-4 text-sm leading-7 text-surface-700">{card.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
