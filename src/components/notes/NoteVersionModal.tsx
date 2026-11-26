'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, History, RotateCcw, Clock, User as UserIcon, Check } from 'lucide-react';
import api, { extractApiErrorMessage } from '@/lib/api';
import { showToast } from '@/components/ui/Toast';

export interface VersionItem {
  id: number;
  note_id: number;
  user_id: number;
  version: number;
  title: string | null;
  content: string;
  summary: string | null;
  created_at: string;
  user?: { id: number; name: string };
}

interface NoteVersionModalProps {
  isOpen: boolean;
  noteId: number;
  versions: VersionItem[];
  currentVersion: number;
  onClose: () => void;
  onRestored: () => void;
}

export function NoteVersionModal({
  isOpen,
  noteId,
  versions,
  currentVersion,
  onClose,
  onRestored,
}: NoteVersionModalProps) {
  const [selectedVersion, setSelectedVersion] = useState<VersionItem | null>(() => {
    return versions.length > 0 ? versions[0] : null;
  });
  const [restoring, setRestoring] = useState(false);

  if (!isOpen) return null;

  const handleRestore = async (versionObj: VersionItem) => {
    if (!confirm(`Pulihkan catatan ke versi ${versionObj.version}? Snapshot baru akan dicatat.`)) return;

    try {
      setRestoring(true);
      const res = await api.post(`/notes/${noteId}/restore/${versionObj.id}`);
      if (res.data?.success) {
        showToast(res.data.message || 'Catatan berhasil dipulihkan.', 'success');
        onRestored();
        onClose();
      }
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal memulihkan versi catatan.'), 'error');
    } finally {
      setRestoring(false);
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

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 14 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 z-10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-xs">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Riwayat Versi Dokumen</h3>
                <p className="text-xs text-slate-500">
                  Total {versions.length} rekaman versi historis tercatat
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body: Split View */}
          <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
            {/* Version List Sidebar */}
            <div className="w-full sm:w-72 border-r border-slate-100 bg-slate-50/40 overflow-y-auto divide-y divide-slate-100 shrink-0">
              {versions.length === 0 ? (
                <p className="p-4 text-xs text-slate-400 italic">Belum ada riwayat versi.</p>
              ) : (
                versions.map((v) => {
                  const isCurrent = v.version === currentVersion;
                  const isSelected = selectedVersion?.id === v.id;

                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVersion(v)}
                      className={`w-full text-left p-3.5 transition flex flex-col gap-1 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/70 border-l-3 border-indigo-600 text-indigo-900'
                          : 'hover:bg-slate-100/60 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs flex items-center gap-1.5">
                          <span>Versi {v.version}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                              Aktif
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(v.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 truncate">
                        {v.summary || v.title || 'Pembaruan tanpa judul'}
                      </p>

                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <UserIcon className="h-2.5 w-2.5" />
                        <span>{v.user?.name || 'Penulis'}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Version Content Preview Pane */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedVersion ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="font-bold text-base text-slate-900">
                        {selectedVersion.title || 'Untitled'}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Versi {selectedVersion.version} • Dicatat pada{' '}
                        {new Date(selectedVersion.created_at).toLocaleString()}
                      </p>
                    </div>

                    {selectedVersion.version !== currentVersion && (
                      <button
                        type="button"
                        disabled={restoring}
                        onClick={() => handleRestore(selectedVersion)}
                        className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-60"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>{restoring ? 'Memulihkan...' : 'Pulihkan Versi Ini'}</span>
                      </button>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {selectedVersion.content || '<konten kosong>'}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Pilih versi untuk melihat isi snapshot dokumen.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
