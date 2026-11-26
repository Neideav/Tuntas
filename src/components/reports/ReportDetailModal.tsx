'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RotateCcw,
  Send,
  Eye,
  User,
  Calendar,
  FolderKanban,
  CheckSquare,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import api, { extractApiErrorMessage } from '@/lib/api';
import { showToast } from '@/components/ui/Toast';
import { ReviewActionModal } from './ReviewActionModal';

interface ReportDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: number | null;
  currentUserId?: number;
  onRefresh: () => void;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  isOpen,
  onClose,
  reportId,
  currentUserId,
  onRefresh,
}) => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'request_revision' | 'reject' | 'resubmit';
  }>({ isOpen: false, action: 'approve' });
  const [expandedSnapshots, setExpandedSnapshots] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (isOpen && reportId) {
      fetchReportDetails();
    }
  }, [isOpen, reportId]);

  const fetchReportDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/${reportId}`);
      if (res.data?.data) {
        setReport(res.data.data);
      }
    } catch (err) {
      showToast(extractApiErrorMessage(err, 'Gagal memuat detail laporan.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !reportId) return null;

  const isAuthor = currentUserId && report?.user_id === currentUserId;
  const isApproved = report?.status === 'approved';
  const isRevisionRequested = report?.status === 'revision_requested';
  const isSubmitted = report?.status === 'submitted';
  const isInReview = report?.status === 'in_review';
  const isDraft = report?.status === 'draft';

  const handleStartReview = async () => {
    try {
      await api.post(`/reports/${report.id}/start-review`);
      showToast('Review laporan telah dimulai.', 'success');
      fetchReportDetails();
      onRefresh();
    } catch (err) {
      showToast(extractApiErrorMessage(err, 'Gagal memulai review.'), 'error');
    }
  };

  const handleSubmitDraft = async () => {
    try {
      await api.post(`/reports/${report.id}/submit`);
      showToast('Laporan berhasil dikirimkan untuk review!', 'success');
      fetchReportDetails();
      onRefresh();
    } catch (err) {
      showToast(extractApiErrorMessage(err, 'Gagal mengirim laporan.'), 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Approved
          </span>
        );
      case 'revision_requested':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Revision Requested
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="h-3.5 w-3.5 text-rose-600" />
            Rejected
          </span>
        );
      case 'in_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            In Review
          </span>
        );
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Send className="h-3.5 w-3.5 text-purple-600" />
            Submitted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Draft
          </span>
        );
    }
  };

  const toggleSnapshot = (reviewId: number) => {
    setExpandedSnapshots((prev) => ({ ...prev, [reviewId]: !prev[reviewId] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white shadow-2xs border border-slate-200">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {report?.type?.replace('_', ' ') || 'Report'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-200/80 text-[10px] font-bold text-slate-700">
                  v{report?.version || 1}
                </span>
                {report && getStatusBadge(report.status)}
              </div>
              <h2 className="text-lg font-bold text-slate-900 line-clamp-1 mt-0.5">
                {report?.title || 'Memuat...'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-12 flex justify-center text-xs text-slate-400 animate-pulse">
              Memuat data laporan...
            </div>
          ) : report ? (
            <>
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block">Penulis</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    {report.user?.name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Reviewer</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    {report.reviewer?.name || 'Belum ditugaskan'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Konteks</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5 capitalize">
                    {report.project ? (
                      <span className="text-indigo-600 flex items-center gap-1">
                        <FolderKanban className="h-3.5 w-3.5" />
                        {report.project.title}
                      </span>
                    ) : report.task ? (
                      <span className="text-teal-600 flex items-center gap-1">
                        <CheckSquare className="h-3.5 w-3.5" />
                        {report.task.title}
                      </span>
                    ) : (
                      'Workspace'
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Tanggal Submit</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    {report.submitted_at
                      ? new Date(report.submitted_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Draft'}
                  </span>
                </div>
              </div>

              {/* Task Link Alert if applicable */}
              {report.task && (
                <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200/80 flex items-center justify-between text-xs text-teal-900">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-teal-600 shrink-0" />
                    <div>
                      <span className="font-bold">Terkait Tugas: {report.task.title}</span>
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-800">
                        Status Tugas: {report.task.status}
                      </span>
                    </div>
                  </div>
                  {isApproved && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                      Syarat Laporan Terpenuhi
                    </span>
                  )}
                </div>
              )}

              {/* Executive Summary */}
              {report.summary && (
                <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100">
                  <h4 className="text-xs font-bold text-indigo-950 mb-1">Ringkasan Eksekutif</h4>
                  <p className="text-xs text-indigo-900 leading-relaxed">{report.summary}</p>
                </div>
              )}

              {/* Content Box */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2">Konten Laporan</h4>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-mono">
                  {report.content}
                </div>
              </div>

              {/* Metrics */}
              {report.metrics && (
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <h4 className="text-xs font-bold text-slate-800">Metrik & Deliverable</h4>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-700">
                    {report.metrics.hours_spent !== undefined && (
                      <div className="px-3 py-1.5 rounded-lg bg-slate-100 font-medium">
                        Jam Kerja: <strong className="text-slate-900">{report.metrics.hours_spent} jam</strong>
                      </div>
                    )}
                  </div>
                  {Array.isArray(report.metrics.deliverables) && report.metrics.deliverables.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[11px] text-slate-500 font-semibold block mb-1">Daftar Deliverable:</span>
                      <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                        {report.metrics.deliverables.map((d: string, idx: number) => (
                          <li key={idx}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Reviewer / Decision History Section */}
              <div className="pt-2">
                <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-indigo-600" />
                  <span>Riwayat Audit Review & Keputusan ({report.reviews?.length || 0})</span>
                </h4>

                {report.reviews && report.reviews.length > 0 ? (
                  <div className="space-y-3">
                    {report.reviews.map((rev: any) => (
                      <div
                        key={rev.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(rev.status)}
                            <span className="text-[11px] text-slate-500">
                              oleh <strong>{rev.reviewer?.name || 'Reviewer'}</strong> (Versi {rev.version})
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {new Date(rev.created_at).toLocaleString('id-ID')}
                          </span>
                        </div>

                        {rev.feedback && (
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-800 italic">
                            &ldquo;{rev.feedback}&rdquo;
                          </div>
                        )}

                        {rev.report_snapshot && (
                          <div>
                            <button
                              type="button"
                              onClick={() => toggleSnapshot(rev.id)}
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              {expandedSnapshots[rev.id] ? (
                                <>
                                  <ChevronUp className="h-3 w-3" /> Sembunyikan Snapshot Konten Saat Review
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" /> Lihat Snapshot Konten Saat Review
                                </>
                              )}
                            </button>
                            {expandedSnapshots[rev.id] && (
                              <div className="mt-2 p-3 rounded-lg bg-slate-100/80 border border-slate-200 text-[11px] font-mono whitespace-pre-wrap text-slate-700">
                                <p className="font-bold text-slate-900 mb-1">
                                  Judul: {rev.report_snapshot.title}
                                </p>
                                <p className="mb-1 text-slate-800">
                                  {rev.report_snapshot.summary || 'Tanpa ringkasan'}
                                </p>
                                <hr className="my-2 border-slate-300" />
                                {rev.report_snapshot.content}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Belum ada riwayat review pada laporan ini.</p>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer Actions Bar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2">
            {/* Author actions */}
            {isAuthor && isDraft && (
              <button
                type="button"
                onClick={handleSubmitDraft}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Kirim untuk Review</span>
              </button>
            )}

            {isAuthor && isRevisionRequested && (
              <button
                type="button"
                onClick={() => setActionModal({ isOpen: true, action: 'resubmit' })}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Kirim Ulang Revisi</span>
              </button>
            )}

            {/* Reviewer actions (ONLY if NOT author) */}
            {!isAuthor && (isSubmitted || isInReview) && (
              <>
                {isSubmitted && (
                  <button
                    type="button"
                    onClick={handleStartReview}
                    className="px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Mulai Review</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActionModal({ isOpen: true, action: 'request_revision' })}
                  className="px-3.5 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Minta Revisi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActionModal({ isOpen: true, action: 'reject' })}
                  className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Tolak</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActionModal({ isOpen: true, action: 'approve' })}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Setujui Laporan</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Review Action Sub-Modal */}
      {actionModal.isOpen && (
        <ReviewActionModal
          isOpen={actionModal.isOpen}
          onClose={() => setActionModal({ isOpen: false, action: 'approve' })}
          action={actionModal.action}
          reportId={report.id}
          reportTitle={report.title}
          currentVersion={report.version}
          onSuccess={() => {
            fetchReportDetails();
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
