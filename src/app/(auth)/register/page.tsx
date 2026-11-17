'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { extractApiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    if (password.length < 8) {
      setError('Kata sandi harus minimal 8 karakter.');
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
        localStorage.setItem('tuntas_token', response.data.data.token);
        localStorage.setItem('tuntas_user', JSON.stringify(response.data.data.user));
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      setError(extractApiErrorMessage(err, 'Pendaftaran gagal. Periksa kembali data yang dimasukkan.'));
    } finally {
      setLoading(false);
    }
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
            Buat Akun Tuntas
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Daftar untuk mengelola tugas, proyek, kebiasaan harian, dan ujian akademik
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-semibold text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nama Lengkap"
            placeholder="e.g. Budi Santoso"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Alamat Email"
            type="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Kata Sandi (Minimal 8 karakter)"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Input
            label="Konfirmasi Kata Sandi"
            type="password"
            placeholder="••••••••"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            required
          />

          <Button type="submit" loading={loading} className="w-full font-bold">
            Daftar Akun Baru
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Sudah memiliki akun?{' '}
          <Link href="/login" className="font-bold text-sky-600 hover:text-sky-700 underline">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
