'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { UserPlus, Shield, Check, ArrowRight, AlertCircle, LogIn } from 'lucide-react';
import api, { extractApiErrorMessage } from '@/lib/api';
import { showToast } from '@/components/ui/Toast';

export default function AcceptInvitationPage() {
  const params = useParams();
  const token = params?.token as string;
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('tuntas_token');
      setIsLoggedIn(!!storedToken);
    }
  }, []);

  const handleAccept = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      const res = await api.post(`/invitations/${token}/accept`);

      if (res.data?.success) {
        setSuccess(true);
        setProjectName(res.data.data?.project_title || 'Proyek');
        showToast(res.data.message || 'Berhasil bergabung dengan proyek!', 'success');
        setTimeout(() => {
          router.push('/projects');
        }, 1500);
      }
    } catch (err: unknown) {
      setError(extractApiErrorMessage(err, 'Gagal menerima undangan proyek.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-slate-200 text-center space-y-6"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600 shadow-xs">
          <UserPlus className="h-8 w-8" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Undangan Kolaborasi Proyek</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Anda telah diundang untuk bergabung dan berkolaborasi dalam proyek di platform Tuntas.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 flex items-start gap-2.5 text-xs text-rose-700 text-left">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 space-y-2 text-emerald-800">
            <Check className="h-8 w-8 text-emerald-600 mx-auto" />
            <h4 className="font-bold text-sm">Selamat Bergabung!</h4>
            <p className="text-xs">
              Anda telah menjadi anggota proyek <strong>{projectName}</strong>. Mengarahkan ke dashboard...
            </p>
          </div>
        ) : isLoggedIn ? (
          <div className="space-y-3">
            <button
              type="button"
              disabled={loading}
              onClick={handleAccept}
              className="w-full h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Terima Undangan & Gabung</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-400">
              Dengan bergabung, Anda akan dapat mengakses tugas, catatan, dan laporan proyek sesuai izin peran Anda.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">Perlu Masuk Terlebih Dahulu</p>
              <p className="text-[11px]">
                Silakan masuk atau daftarkan akun Tuntas Anda untuk menautkan undangan ini ke profil Anda.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href={`/login?redirect=/invite/${token}`}
                className="h-11 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <LogIn className="h-4 w-4" />
                <span>Masuk</span>
              </Link>
              <Link
                href={`/register?redirect=/invite/${token}`}
                className="h-11 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center transition cursor-pointer"
              >
                <span>Daftar Akun</span>
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
