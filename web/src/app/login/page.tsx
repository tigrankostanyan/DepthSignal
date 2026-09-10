'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchAuthConfig, googleLogin } from '@/lib/api';
import { BrandLogo } from '@/components/ui/BrandLogo';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement | null,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              width?: number;
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
            },
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In script'));
    document.head.appendChild(script);
  });
}

/* ── Google "G" multi-color logo (inline SVG) ── */
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const gsiRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setGsiReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const handleCredential = async (response: { credential: string }) => {
      if (cancelled || submittingRef.current) return;
      submittingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        await googleLogin(response.credential);
        router.replace('/screener');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
        submittingRef.current = false;
        setLoading(false);
      }
    };

    const initGoogle = async () => {
      try {
        const config = await fetchAuthConfig();
        if (cancelled) return;

        if (!config || !config.googleClientId) {
          setError('Google sign-in is not configured yet. Please set GOOGLE_CLIENT_ID in the server .env file.');
          return;
        }

        await loadGoogleScript();
        if (cancelled) return;

        window.google!.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: handleCredential,
        });

        window.google!.accounts.id.renderButton(gsiRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'rectangular',
          width: 320,
        });

        setGsiReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize Google sign-in.');
        }
      }
    };

    initGoogle();

    return () => {
      cancelled = true;
      window.google?.accounts.id.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(23,61,154,0.35),rgba(7,21,34,0))] px-4">
      {/* ── Ambient glow behind card ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(22,143,214,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-[420px] relative">
        {/* ── Glassmorphic card ── */}
        <div
          className="relative bg-[#0B1E33]/80 backdrop-blur-xl rounded-2xl p-8 md:p-10 shadow-2xl overflow-hidden"
          style={{
            border: '1px solid rgba(26,54,84,0.6)',
            boxShadow: '0 0 80px rgba(22,143,214,0.06), 0 32px 64px rgba(0,0,0,0.4)',
          }}
        >
          {/* Top gradient accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, #173D9A 15%, #168FD6 40%, #24C4E8 65%, #BCEFFF 80%, transparent 100%)',
            }}
          />

          {/* ── Hero section ── */}
          <div className="text-center mb-8">
            {/* Logo with subtle glow */}
            <div className="flex justify-center mb-5 relative">
              <div className="absolute inset-0 flex justify-center items-center">
                <div className="w-20 h-20 rounded-full bg-[radial-gradient(circle,rgba(22,143,214,0.15)_0%,transparent_70%)]" />
              </div>
              <BrandLogo lockup="symbol" theme="dark" size={64} priority />
            </div>

            <h1
              className="text-[26px] font-bold tracking-tight"
              style={{
                background: 'linear-gradient(180deg, #F7FBFF 0%, #C5D8EA 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              MyScreener
            </h1>

            <p
              className="text-[10px] font-semibold tracking-[0.25em] uppercase mt-1.5"
              style={{
                background: 'linear-gradient(90deg, #168FD6, #24C4E8, #BCEFFF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Intelligence, made visible.
            </p>

            <p className="text-[13px] text-[#7A96B2] mt-3 max-w-[280px] mx-auto leading-relaxed">
              Real-time multi-exchange order book screener and institutional liquidity wall alerts.
            </p>

            {/* Brand values pill */}
            <div className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary/50 border border-divider/60 text-[10px] text-[#6B8BA8] tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-[#24C4E8]" />
              Precision · Data · Analytics · Trust
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#1A3654] to-transparent" />
            <span className="text-[10px] text-[#4A6A84] uppercase tracking-widest font-medium">Sign in</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#1A3654] to-transparent" />
          </div>

          {/* ── Error banner ── */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-ask/10 border border-[#F6465D]/20 text-ask text-xs flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* ── Google Sign-In Button ── */}
          <div className="relative flex justify-center">
            {/* Hidden GSI rendered button (offscreen for auth) */}
            <div
              ref={gsiRef}
              aria-hidden="true"
              className="absolute overflow-hidden"
              style={{ width: 1, height: 1, left: -9999, top: 0, opacity: 0, pointerEvents: 'none' }}
            />

            {/* Gradient border wrapper */}
            <div
              className="p-[1px] rounded-2xl transition-all duration-300 hover:shadow-[0_0_28px_rgba(22,143,214,0.2)]"
              style={{
                background: 'linear-gradient(135deg, #1A3654 0%, #168FD6 50%, #24C4E8 100%)',
              }}
            >
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (loading) return;
                  const clickable = gsiRef.current?.querySelector('[role="button"]') as HTMLElement
                    || gsiRef.current?.querySelector('div[tabindex]') as HTMLElement
                    || gsiRef.current?.firstElementChild as HTMLElement;
                  clickable?.click();
                }}
                className={`group relative h-[48px] px-8 rounded-[15px] flex items-center justify-center gap-3 overflow-hidden transition-all duration-300 bg-[#0D2440] hover:bg-[#0F2A4A] ${
                  loading
                    ? 'cursor-not-allowed opacity-60 active:scale-100'
                    : 'cursor-pointer active:scale-[0.98]'
                }`}
              >
                {/* Hover shimmer sweep */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                  style={{
                    background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.03) 45%, rgba(22,143,214,0.06) 50%, rgba(255,255,255,0.03) 55%, transparent 65%)',
                  }}
                />

                {/* Google "G" logo badge */}
                <div className="w-8 h-8 rounded-full bg-white/[0.1] border border-white/[0.1] flex items-center justify-center flex-shrink-0">
                  <GoogleLogo size={18} />
                </div>

                {/* Label */}
                <span className="text-[15px] font-semibold text-white/90 group-hover:text-white transition-colors duration-300">
                  Continue with Google
                </span>
              </button>
            </div>
          </div>

          {/* ── Loading state ── */}
          {loading && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-[#168FD6]/30 border-t-[#168FD6] rounded-full animate-spin" />
              <p className="text-xs text-[#7A96B2]">Signing you in…</p>
            </div>
          )}

          {/* ── Footer text ── */}
          <p className="mt-7 text-center text-[11px] text-[#5A7A94] leading-relaxed">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="text-brand hover:text-[#24C4E8] transition-colors">
              Terms of Service
            </Link>
            ,{' '}
            <Link href="/privacy" className="text-brand hover:text-[#24C4E8] transition-colors">
              Privacy Policy
            </Link>
            ,{' '}
            <Link href="/aup" className="text-brand hover:text-[#24C4E8] transition-colors">
              Acceptable Use Policy
            </Link>{' '}
            and{' '}
            <Link href="/cookies" className="text-brand hover:text-[#24C4E8] transition-colors">
              Cookie Policy
            </Link>
            .<br />
            <span className="text-[#4A6A84]">Your account is created automatically on first sign-in.</span>
          </p>
        </div>

        {/* ── Bottom reflection glow ── */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 rounded-full bg-[radial-gradient(ellipse,rgba(22,143,214,0.06)_0%,transparent_70%)] pointer-events-none" />
      </div>
    </div>
  );
}
