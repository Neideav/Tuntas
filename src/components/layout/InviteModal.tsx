'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UserPlus, Users, Copy, Check, ShieldCheck, Mail, Sparkles, FolderKanban } from 'lucide-react';
import api, { extractApiErrorMessage } from '@/lib/api';
import { showToast } from '@/components/ui/Toast';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProjectOption {
  id: number;
  title: string;
}

export function InviteModal({ isOpen, onClose }: InviteModalProps) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | string>('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedWorkspace, setCopiedWorkspace] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setGeneratedInviteUrl(null);
      setEmail('');
      setLoadingProjects(true);
      api
        .get('/projects')
        .then((res) => {
          if (res.data?.success) {
            const list = res.data.data || [];
            setProjects(list);
            if (list.length > 0) {
              setSelectedProjectId(list[0].id);
            }
          }
        })
        .catch((err) => console.error(err))
        .finally(() => setLoadingProjects(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      showToast('Pilih proyek tujuan undangan.', 'error');
      return;
    }
    if (!email.trim()) {
      showToast('Masukkan alamat email kolaborator.', 'error');
      return;
    }

    try {
      setInviting(true);
      const res = await api.post(`/projects/${selectedProjectId}/invitations`, {
        email: email.trim(),
        role,
      });

      if (res.data?.success) {
        showToast(res.data.message || 'Undangan berhasil dikirim!', 'success');
        const token = res.data.data?.invite_token;
        if (token && typeof window !== 'undefined') {
          setGeneratedInviteUrl(`${window.location.origin}/invite/${token}`);
        }
        setEmail('');
      }
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal mengirim undangan.'), 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleCopyInviteLink = () => {
    if (generatedInviteUrl && typeof window !== 'undefined') {
      navigator.clipboard.writeText(generatedInviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2500);
      showToast('Tautan undangan berhasil disalin!', 'info');
    }
  };

  const handleCopyWorkspace = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.origin);
      setCopiedWorkspace(true);
      setTimeout(() => setCopiedWorkspace(false), 2500);
      showToast('Tautan workspace disalin!', 'info');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 14 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 z-10 space-y-5"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-xs">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Kolaborasi Proyek & Tim</h3>
                <p className="text-[11px] text-slate-500">Undang anggota ke proyek Anda</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Invitation Form */}
          <form onSubmit={handleSendInvite} className="space-y-3.5">
            {/* Select Project */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Pilih Proyek
              </label>
              {loadingProjects ? (
                <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
              ) : projects.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                  Belum ada proyek aktif. Silakan buat proyek terlebih dahulu di menu Proyek.
                </div>
              ) : (
                <div className="relative">
                  <FolderKanban className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Email and Role Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 relative">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Anggota
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    disabled={projects.length === 0}
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 disabled:bg-slate-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Peran
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={projects.length === 0}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer disabled:bg-slate-100"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={inviting || projects.length === 0}
              className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {inviting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Kirim Undangan Proyek</span>
                </>
              )}
            </button>
          </form>

          {/* Generated Invite Link Banner */}
          {generatedInviteUrl && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                <Check className="h-4 w-4 text-emerald-600" />
                <span>Tautan Undangan Siap Dibagikan:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedInviteUrl}
                  className="flex-1 h-8 px-2.5 rounded-lg border border-emerald-200 bg-white text-[11px] font-mono text-emerald-900 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
                >
                  {copiedInvite ? (
                    <>
                      <Check className="h-3 w-3" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Workspace Link Fallback */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Tautan Web Workspace
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={typeof window !== 'undefined' ? window.location.origin : 'https://tuntas.app'}
                className="flex-1 h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-600 select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyWorkspace}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                {copiedWorkspace ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-500" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
