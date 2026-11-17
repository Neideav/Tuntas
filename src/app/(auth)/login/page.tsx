'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { extractApiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertCircle, UserPlus, ArrowRight } from 'lucide-react';

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
      setError(extractApiErrorMessage(err, 'Login gagal. Periksa kembali email dan kata sandi Anda.'));
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('demo@tuntas.test');
    setPassword('Password123!');
  };

  const isNotRegistered =
    error &&
    (error.toLowerCase().includes('belum terdaftar') ||
      error.toLowerCase().includes('buat akun') ||
      error.toLowerCase().includes('not found') ||
      error.toLowerCase().includes('tidak ditemukan'));

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm">
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white font-black text-lg shadow-sm">
            T
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900 tracking-tight">
            Masuk ke Tuntas
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Platform produktivitas terintegrasi, habit tracking, dan sistem ujian
          </p>
        </div>

        {/* Error banner */}
        {error && !isNotRegistered && (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-semibold text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Not registered alert & action */}
        {isNotRegistered && (
          <div className="mb-5 rounded-2xl bg-amber-50 border border-amber-200/90 p-4 space-y-3">
            <div className="flex items-start gap-2.5 text-xs text-amber-900 font-semibold leading-relaxed">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold">Akun Belum Terdaftar</p>
                <p className="text-[11px] text-amber-700 font-normal mt-0.5">
                  Email <span className="font-semibold">{email}</span> belum memiliki akun di Tuntas. Anda harus membuat akun terlebih dahulu sebelum dapat mengakses dashboard.
                </p>
              </div>
            </div>
            <Link
              href={`/register?email=${encodeURIComponent(email)}`}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Buat Akun Baru Sekarang</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Alamat Email"
            type="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Kata Sandi"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" loading={loading} className="w-full font-bold">
            Masuk Sekarang
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleFillDemo}
            className="w-full text-xs font-semibold"
          >
            Gunakan Akun Demo (demo@tuntas.test)
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          Belum memiliki akun Tuntas?{' '}
          <Link
            href={email ? `/register?email=${encodeURIComponent(email)}` : '/register'}
            className="font-bold text-sky-600 hover:text-sky-700 underline"
          >
            Daftar Akun Baru
          </Link>
        </div>
      </div>
    </div>
  );
}
