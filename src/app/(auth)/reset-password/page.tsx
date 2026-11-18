'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import api, { extractApiErrorMessage } from '@/lib/api';
import {
  AuthLayout,
  AuthUnderlineInput,
  PasswordInput,
  AuthInteractionState,
} from '@/components/auth';
import { AlertCircle, CheckCircle2, ArrowLeft, KeyRound } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [interactionState, setInteractionState] = useState<AuthInteractionState>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMsg(null);

    if (!token.trim()) {
      setError('Token pemulihan kata sandi diperlukan. Silakan gunakan tautan dari email Anda.');
      return;
    }

    if (password.length < 8) {
      setError('Kata sandi baru minimal harus 8 karakter.');
      return;
    }

    if (password !== passwordConfirmation) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/reset-password', {
        email: email.trim(),
        token: token.trim(),
        password,
        password_confirmation: passwordConfirmation,
      });

      if (response.data?.success) {
        setInteractionState('success');
        setStatusMsg(response.data.message || 'Kata sandi berhasil diperbarui.');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    } catch (err: unknown) {
      setInteractionState('error');
      setError(
        extractApiErrorMessage(
          err,
          'Gagal memperbarui kata sandi. Pastikan token pemulihan masih berlaku.'
        )
      );
      setTimeout(() => {
        setInteractionState((curr) => (curr === 'error' ? 'idle' : curr));
      }, 2500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      interactionState={interactionState}
      title="Atur Ulang Kata Sandi"
      subtitle="Masukkan token pemulihan dan buat kata sandi baru Anda"
    >
      <div className="space-y-5">
        {/* Success Alert */}
        {statusMsg && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200/90 p-4 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5 text-xs text-emerald-900 font-semibold leading-relaxed">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <p className="font-bold">Kata Sandi Berhasil Diperbarui!</p>
                <p className="text-[11px] text-emerald-700 font-normal mt-0.5">
                  {statusMsg} Mengalihkan ke halaman login...
                </p>
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
            label="Alamat Email"
            type="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setInteractionState('emailFocus')}
            onBlur={() => {
              if (interactionState === 'emailFocus') setInteractionState('idle');
            }}
            required
            autoComplete="email"
          />

          <AuthUnderlineInput
            label="Token Pemulihan"
            type="text"
            placeholder="Tempel token pemulihan di sini"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />

          <PasswordInput
            label="Kata Sandi Baru"
            placeholder="Minimal 8 karakter"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setInteractionState('passwordFocus')}
            onBlur={() => {
              if (interactionState === 'passwordFocus') setInteractionState('idle');
            }}
            required
            autoComplete="new-password"
          />

          <PasswordInput
            label="Konfirmasi Kata Sandi Baru"
            placeholder="Ulangi kata sandi baru"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            onFocus={() => setInteractionState('passwordFocus')}
            onBlur={() => {
              if (interactionState === 'passwordFocus') setInteractionState('idle');
            }}
            required
            autoComplete="new-password"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full bg-[#19191D] hover:bg-black active:scale-[0.99] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-4"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Memperbarui Kata Sandi...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Simpan Kata Sandi Baru
              </span>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Halaman Masuk
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
