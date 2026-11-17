'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Saat membuka web, selalu arahkan pengguna ke halaman login terlebih dahulu
    router.replace('/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
        <p className="text-xs font-semibold text-slate-500">Mengarahkan ke halaman login...</p>
      </div>
    </div>
  );
}

