import { Button } from '@/components/ui/Button';
import { ShieldCheck, Lock, Activity, Bot } from 'lucide-react';
import { redirect } from 'next/navigation';
import { isAuth0Configured, safeGetSession } from '@/lib/auth-config';

export default async function LandingPage() {
  const authConfigured = isAuth0Configured();
  const session = await safeGetSession();

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col bg-surface-50">
      <div className="absolute top-0 inset-x-0 h-96 bg-brand-500/10 blur-[100px] pointer-events-none" />
      
      <header className="container mx-auto px-6 py-8 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-brand-500/20 shadow-glow">
            SD
          </div>
          <span className="font-bold text-xl tracking-tight text-white">SecureDesk</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={authConfigured ? '/api/auth/login' : '#'}
            aria-disabled={!authConfigured}
            className={`text-sm font-medium transition-colors ${authConfigured ? 'text-surface-600 hover:text-white' : 'text-surface-500 pointer-events-none opacity-60'}`}
          >
            Sign In
          </a>
          <a
            href={authConfigured ? '/api/auth/login' : '#'}
            aria-disabled={!authConfigured}
            className={authConfigured ? '' : 'pointer-events-none opacity-60'}
          >
            <Button variant="primary" disabled={!authConfigured}>Get Started</Button>
          </a>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-20 flex flex-col items-center justify-center text-center z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm font-medium mb-8 animate-fade-in">
          <Bot className="w-4 h-4" />
          Auth0-Powered Deterministic Agent
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white max-w-4xl mb-6 animate-slide-up">
          The AI Agent that <br/>
          <span className="gradient-text">Respects Boundaries</span>
        </h1>
        
        <p className="text-lg md:text-xl text-surface-600 max-w-2xl mb-12 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          Connect Gmail, Slack, and Jira securely via Auth0 Token Vault. Let the AI read your context, but always ask for explicit CIBA approval before executing high-risk actions.
        </p>

        {!authConfigured && (
          <div className="w-full max-w-2xl mb-10 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-left text-sm text-amber-100">
            Auth0 is not configured yet. Add values for `AUTH0_SECRET`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, and `AUTH0_ISSUER_BASE_URL` in `.env.local` to enable login.
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <a
            href={authConfigured ? '/api/auth/login' : '#'}
            aria-disabled={!authConfigured}
            className={`btn-primary px-6 py-3 text-base w-full sm:w-auto shadow-brand-500/20 shadow-glow ${authConfigured ? '' : 'pointer-events-none opacity-60'}`}
          >
            Start Free Trial
          </a>
          <a href="/dashboard/settings" className="btn-ghost px-6 py-3 text-base w-full sm:w-auto text-surface-400">
            View Documentation
          </a>
        </div>

        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 text-left w-full max-w-5xl animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="glass-card p-8">
            <div className="w-12 h-12 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-6 text-brand-400">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-3">Token Vault Integration</h3>
            <p className="text-surface-600 leading-relaxed text-sm">
              Your OAuth tokens for external services never touch the frontend. Auth0 securely manages federated tokens.
            </p>
          </div>
          
          <div className="glass-card p-8">
            <div className="w-12 h-12 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-6 text-amber-500">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-3">Explicit CIBA Approvals</h3>
            <p className="text-surface-600 leading-relaxed text-sm">
              High-risk operations like sending emails require out-of-band user consent via Client-Initiated Backchannel Authentication.
            </p>
          </div>
          
          <div className="glass-card p-8">
            <div className="w-12 h-12 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-6 text-emerald-500">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-3">Immutable Audit Trail</h3>
            <p className="text-surface-600 leading-relaxed text-sm">
              Every action taken by the AI is logged precisely with timestamps, risk level, status, and approval tracking.
            </p>
          </div>
        </div>
      </main>
      
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-surface-400 to-transparent opacity-20" />
    </div>
  );
}
