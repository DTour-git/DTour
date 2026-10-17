'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Icon } from '@/components/Icon';
import { LogoMark } from '@/components/ui';

const DOMAIN = 'dtu.ac.in';

export default function LoginPage() {
  return <Suspense><Login /></Suspense>;
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';
  const [step, setStep] = useState<'start' | 'code'>('start');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get('error'));

  const google = async () => {
    setBusy(true); setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { hd: DOMAIN, prompt: 'select_account' },
      },
    });
    if (error) { setError(error.message); setBusy(false); }
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr.endsWith(`@${DOMAIN}`)) { setError(`Use your @${DOMAIN} email address.`); return; }
    setBusy(true); setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: addr, options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else { setEmail(addr); setStep('code'); }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabaseBrowser().auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(error.message);
    else { router.replace(next); router.refresh(); }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12vh 20px 40px', fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>
      <div style={{ width: 'min(440px, 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <LogoMark />
          <span style={{ font: '600 48px/0.9 var(--font-heading)', letterSpacing: '-.035em' }}>DTour</span>
        </div>
        <div style={{ font: 'italic 400 18px/1.3 var(--font-body)', color: 'var(--color-neutral-700)', margin: '14px 0 22px' }}>The campus, all in one place.</div>
        <div style={{ borderTop: '3px solid var(--color-text)', borderBottom: '1px solid var(--color-text)', padding: '10px 0', font: '600 15px var(--font-heading)' }}>
          {step === 'start' ? 'Sign in with your DTU account' : 'Check your DTU inbox'}
        </div>

        {step === 'start' ? (
          <div style={{ marginTop: 26 }}>
            <button className="btn btn-primary" onClick={google} disabled={busy} style={{ width: '100%', height: 46, fontSize: 15 }}>
              <Icon name="google-logo" size={19} />Continue with Google
            </button>
            <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 8 }}>Only @{DOMAIN} accounts can join.</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 18px', fontSize: 13, color: 'var(--color-neutral-700)' }}>
              <span style={{ flex: 1, height: 1, background: 'var(--color-divider)' }} />or get a code by email<span style={{ flex: 1, height: 1, background: 'var(--color-divider)' }} />
            </div>
            <form onSubmit={sendCode}>
              <label className="label-caps" htmlFor="email" style={{ display: 'block' }}>DTU email</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input id="email" className="input" type="email" required autoComplete="email" placeholder={`name_2k24co123@${DOMAIN}`}
                  value={email} onChange={(e) => setEmail(e.target.value)} style={{ height: 44, fontSize: 15 }} />
                <button className="btn btn-secondary" disabled={busy} style={{ height: 44, whiteSpace: 'nowrap' }}>Send code</button>
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 8, lineHeight: 1.5 }}>
                Can’t open your DTU mail on this device? Open it anywhere else and type the 6-digit code here.
              </div>
            </form>
          </div>
        ) : (
          <form onSubmit={verify} style={{ marginTop: 26 }}>
            <p style={{ fontSize: 16, lineHeight: 1.55, margin: '0 0 18px' }}>We sent a 6-digit code to <b>{email}</b>. It expires in 10 minutes.</p>
            <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="6-digit code"
              style={{ height: 56, font: '600 28px var(--font-heading)', letterSpacing: '.3em', textAlign: 'center' }} />
            <button className="btn btn-primary" disabled={busy || code.length < 6} style={{ width: '100%', height: 46, marginTop: 14, fontSize: 15 }}>Sign in</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setStep('start'); setCode(''); }} style={{ marginTop: 10 }}>← Use a different email</button>
          </form>
        )}

        {error && (
          <div role="alert" style={{ marginTop: 20, padding: '12px 14px', background: 'var(--color-accent-2-100)', color: 'var(--color-accent-2-800)', borderRadius: 2, fontSize: 14, display: 'flex', gap: 8 }}>
            <Icon name="warning" size={18} />{error}
          </div>
        )}
      </div>
    </main>
  );
}
