'use client';

import React, { useState, useEffect } from 'react';
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
import { AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [interactionState, setInteractionState] = useState<AuthInteractionState>('idle');
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get('email');
      if (emailParam) {
        setEmail(emailParam);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirmation) {
      setInteractionState('error');
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setInteractionState('error');
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/register', {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });

      if (response.data?.success) {
        setInteractionState('success');

        localStorage.setItem('tuntas_token', response.data.data.token);
        localStorage.setItem('tuntas_user', JSON.stringify(response.data.data.user));

        setTimeout(() => {
          router.push('/dashboard');
        }, 650);
      }
    } catch (err: unknown) {
      setInteractionState('error');
      setError(
        extractApiErrorMessage(
          err,
          'Registration failed. Please check your details.'
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
      title="Create account"
      subtitle="Start your educational journey with Tuntas"
    >
      <div className="space-y-4">
        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2.5 rounded-xl bg-rose-50 border border-rose-200/80 p-3 text-xs font-semibold text-rose-700 animate-in fade-in duration-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Full Name */}
          <AuthUnderlineInput
            label="Full Name"
            type="text"
            placeholder="Anna Caroline"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setInteractionState('emailFocus')}
            onBlur={() => {
              if (interactionState === 'emailFocus') setInteractionState('idle');
            }}
            required
            autoComplete="name"
          />

          {/* Email */}
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

          {/* Password */}
          <PasswordInput
            label="Password"
            placeholder="At least 8 characters"
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
            autoComplete="new-password"
          />

          {/* Confirm Password */}
          <PasswordInput
            label="Confirm Password"
            placeholder="Repeat password"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
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
            autoComplete="new-password"
          />

          {/* Primary Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full bg-[#19191D] hover:bg-black active:scale-[0.99] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span>Sign Up</span>
            )}
          </button>

          {/* Google OAuth Button */}
          <GoogleAuthButton label="Sign up with Google" disabled={loading} />
        </form>

        {/* Footer Login Link */}
        <p className="text-center text-xs text-[#858585] pt-1">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-bold text-[#19191D] hover:underline transition"
          >
            Log In
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
