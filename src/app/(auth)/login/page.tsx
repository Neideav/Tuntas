'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { extractApiErrorMessage } from '@/lib/api';
import {
  AuthLayout,
  AuthUnderlineInput,
  PasswordInput,
  GoogleAuthButton,
  AuthInteractionState,
} from '@/components/auth';
import { AlertCircle, ArrowRight, UserPlus, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [interactionState, setInteractionState] = useState<AuthInteractionState>('idle');
  const router = useRouter();

  const isNotRegistered =
    error &&
    (error.toLowerCase().includes('belum terdaftar') ||
      error.toLowerCase().includes('buat akun') ||
      error.toLowerCase().includes('not found') ||
      error.toLowerCase().includes('tidak ditemukan'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data?.success) {
        // Trigger celebratory character animation
        setInteractionState('success');

        localStorage.setItem('tuntas_token', response.data.data.token);
        localStorage.setItem('tuntas_user', JSON.stringify(response.data.data.user));

        if (rememberMe) {
          localStorage.setItem('tuntas_remember', 'true');
        } else {
          localStorage.removeItem('tuntas_remember');
        }

        // Brief delay so user sees joyful animation
        setTimeout(() => {
          router.push('/dashboard');
        }, 650);
      }
    } catch (err: unknown) {
      setInteractionState('error');
      setError(
        extractApiErrorMessage(
          err,
          'Login failed. Please check your email and password.'
        )
      );
      // Recovery: Smoothly return characters to idle composition after error reaction
      setTimeout(() => {
        setInteractionState((curr) => (curr === 'error' ? 'idle' : curr));
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('demo@tuntas.test');
    setPassword('Password123!');
    setInteractionState('emailFocus');
    setTimeout(() => setInteractionState('idle'), 800);
  };

  return (
    <AuthLayout
      interactionState={interactionState}
      title="Welcome back!"
      subtitle="Please enter your details"
    >
      <div className="space-y-4">
        {/* Error Alert */}
        {error && !isNotRegistered && (
          <div className="flex items-center gap-2.5 rounded-xl bg-rose-50 border border-rose-200/80 p-3 text-xs font-semibold text-rose-700 animate-in fade-in duration-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Not Registered Assistance Card */}
        {isNotRegistered && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200/90 p-4 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5 text-xs text-amber-900 font-semibold leading-relaxed">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold">Account Not Registered</p>
                <p className="text-[11px] text-amber-700 font-normal mt-0.5">
                  The email <span className="font-semibold">{email}</span> is not registered yet. Please create an account to start using Tuntas.
                </p>
              </div>
            </div>
            <Link
              href={`/register?email=${encodeURIComponent(email)}`}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Create Account Now</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <AuthUnderlineInput
            label="Email"
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

          {/* Password Input */}
          <PasswordInput
            label="Password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setInteractionState('passwordFocus')}
            onBlur={() => {
              if (
                interactionState === 'passwordFocus' ||
                interactionState === 'passwordVisible'
              ) {
                setInteractionState('idle');
              }
            }}
            onVisibilityChange={(visible) =>
              setInteractionState(visible ? 'passwordVisible' : 'passwordFocus')
            }
            required
            autoComplete="current-password"
          />

          {/* Remember me & Forgot Password Row */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 text-[#858585] hover:text-[#19191D] cursor-pointer select-none transition">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-[#D8D8D8] text-[#19191D] focus:ring-0 accent-[#19191D] cursor-pointer"
              />
              <span className="text-[11px] font-medium">Remember for 30 days</span>
            </label>

            <Link
              href="/forgot-password"
              className="text-[11px] font-medium text-[#858585] hover:text-[#19191D] transition"
            >
              Forgot password?
            </Link>
          </div>

          {/* Primary Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full bg-[#19191D] hover:bg-black active:scale-[0.99] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span>Log In</span>
            )}
          </button>

          {/* Google OAuth Button */}
          <GoogleAuthButton label="Log in with Google" disabled={loading} />

          {/* Demo Credentials Quick Trigger */}
          <button
            type="button"
            onClick={handleFillDemo}
            className="w-full py-1 text-center text-[10px] text-[#858585] hover:text-[#19191D] font-medium transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>Use Demo Account (demo@tuntas.test)</span>
          </button>
        </form>

        {/* Footer Registration Link */}
        <p className="text-center text-xs text-[#858585] pt-2">
          Don&apos;t have an account?{' '}
          <Link
            href={email ? `/register?email=${encodeURIComponent(email)}` : '/register'}
            className="font-bold text-[#19191D] hover:underline transition"
          >
            Sign Up
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
