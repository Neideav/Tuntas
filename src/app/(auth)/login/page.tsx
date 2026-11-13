'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { extractApiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data?.success) {
        localStorage.setItem('tuntas_token', response.data.data.token);
        localStorage.setItem('tuntas_user', JSON.stringify(response.data.data.user));
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      setError(extractApiErrorMessage(err, 'Login failed. Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('demo@tuntas.test');
    setPassword('Password123!');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm">
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white font-black text-lg shadow-sm">
            T
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900 tracking-tight">
            Log in to Tuntas
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Enterprise productivity, habit tracking, and examination platform
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" loading={loading} className="w-full font-bold">
            Sign In
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleFillDemo}
            className="w-full text-xs font-semibold"
          >
            Use Demo Credentials (demo@tuntas.test)
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Don&apos;t have an account yet?{' '}
          <Link href="/register" className="font-bold text-sky-600 hover:text-sky-700">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
