'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import api, { extractApiErrorMessage } from '@/lib/api';
import {
  AuthLayout,
  AuthUnderlineInput,
  AuthInteractionState,
} from '@/components/auth';
import { AlertCircle, CheckCircle2, ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [interactionState, setInteractionState] = useState<AuthInteractionState>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMsg(null);
    setLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { email });
      if (response.data?.success) {
        setInteractionState('success');
        setStatusMsg(
          response.data.message ||
            'Password recovery instructions have been sent to your email.'
        );
      }
    } catch (err: unknown) {
      setInteractionState('error');
      setError(
        extractApiErrorMessage(
          err,
          'Failed to send recovery link. Please verify your email address.'
        )
      );
      setTimeout(() => {
        setInteractionState((curr) => (curr === 'error' ? 'idle' : curr));
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      interactionState={interactionState}
      title="Reset password"
      subtitle="Enter your email to receive recovery instructions"
    >
      <div className="space-y-5">
        {/* Success Alert */}
        {statusMsg && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200/90 p-4 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5 text-xs text-emerald-900 font-semibold leading-relaxed">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <p className="font-bold">Instructions Dispatched</p>
                <p className="text-[11px] text-emerald-700 font-normal mt-0.5">
                  {statusMsg}
                </p>
                <div className="mt-2 pt-1 border-t border-emerald-200">
                  <Link
                    href={`/reset-password?email=${encodeURIComponent(email)}`}
                    className="text-[11px] font-bold text-emerald-900 underline hover:text-emerald-950 inline-flex items-center gap-1"
                  >
                    Sudah memiliki token? Masukkan token di sini &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2.5 rounded-xl bg-rose-50 border border-rose-200/80 p-3 text-xs font-semibold text-rose-700 animate-in fade-in duration-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthUnderlineInput
            label="Email Address"
            type="email"
            placeholder="anna@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setInteractionState('emailFocus')}
            onBlur={() => {
              if (interactionState === 'emailFocus') setInteractionState('idle');
            }}
            required
            autoComplete="email"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full bg-[#19191D] hover:bg-black active:scale-[0.99] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>Send Recovery Link</span>
              </div>
            )}
          </button>
        </form>

        {/* Back to Login Link */}
        <div className="text-center pt-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#19191D] hover:underline transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Log In</span>
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

