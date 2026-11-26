'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, RotateCcw } from 'lucide-react';
import api, { extractApiErrorMessage } from '@/lib/api';
import { showToast } from '@/components/ui/Toast';

interface ReviewActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: 'approve' | 'request_revision' | 'reject' | 'resubmit';
  reportId: number;
  reportTitle: string;
  currentVersion: number;
  onSuccess: () => void;
}

export const ReviewActionModal: React.FC<ReviewActionModalProps> = ({
  isOpen,
  onClose,
  action,
  reportId,
  reportTitle,
  currentVersion,
  onSuccess,
}) => {
  const [feedback, setFeedback] = useState('');
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isRevision = action === 'request_revision';
  const isReject = action === 'reject';
  const isApprove = action === 'approve';
  const isResubmit = action === 'resubmit';

  const titleText = isApprove
    ? 'Setujui Laporan'
    : isRevision
    ? 'Minta Revisi Laporan'
    : isReject
    ? 'Tolak Laporan'
    : 'Kirim Ulang Laporan Revisi';

  const actionIcon = isApprove ? (
    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
  ) : isRevision ? (
    <AlertTriangle className="h-5 w-5 text-amber-600" />
  ) : isReject ? (
    <XCircle className="h-5 w-5 text-rose-600" />
  ) : (
    <RotateCcw className="h-5 w-5 text-indigo-600" />
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if ((isRevision || isReject) && (!feedback || feedback.trim().length < 3)) {
      setError('Umpan balik / alasan wajib diisi (minimal 3 karakter).');
      return;
    }

    setSubmitting(true);
    try {
      if (isApprove) {
        await api.post(`/reports/${reportId}/approve`, { feedback });
        showToast('Laporan berhasil disetujui!', 'success');
      } else if (isRevision) {
        await api.post(`/reports/${reportId}/request-revision`, { feedback });
        showToast('Permintaan revisi berhasil dikirim ke penulis.', 'success');
      } else if (isReject) {
        await api.post(`/reports/${reportId}/reject`, { feedback });
        showToast('Laporan telah ditolak.', 'info');
      } else if (isResubmit) {
        await api.post(`/reports/${reportId}/resubmit`, { summary });
        showToast(`Laporan versi ${currentVersion + 1} berhasil dikirim ulang!`, 'success');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Gagal memproses aksi review laporan.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white shadow-xs border border-slate-100">
              {actionIcon}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{titleText}</h3>
              <p className="text-xs text-slate-500 line-clamp-1 max-w-xs">{reportTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          {isResubmit ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Catatan Revisi / Ringkasan Perubahan
              </label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Jelaskan perbaikan yang telah Anda lakukan pada versi ini..."
                rows={4}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Laporan akan dinaikkan ke <strong>Versi {currentVersion + 1}</strong> dan dikembalikan ke antrean review.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {isApprove ? 'Catatan Persetujuan (Opsional)' : 'Umpan Balik / Alasan Keputusan *'}
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={
                  isApprove
                    ? 'Bagus sekali, semua deliverable telah dipenuhi...'
                    : isRevision
                    ? 'Mohon lengkapi bagian hasil testing dan bukti implementasi...'
                    : 'Laporan tidak sesuai dengan spesifikasi tugas yang disepakati...'
                }
                rows={4}
                required={isRevision || isReject}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
              {(isRevision || isReject) && (
                <p className="text-[11px] text-amber-600 mt-1">
                  * Umpan balik wajib diisi dan akan dicatat secara permanen dalam riwayat audit review.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                isApprove
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : isRevision
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : isReject
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {submitting ? 'Memproses...' : titleText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
