'use client';

import React, { useState, useEffect } from 'react';
import { X, Send, Save, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import api, { extractApiErrorMessage } from '@/lib/api';
import { showToast } from '@/components/ui/Toast';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report?: any;
  defaultContext?: 'workspace' | 'project' | 'task';
  defaultProjectId?: number;
  defaultTaskId?: number;
  onSuccess: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  report,
  defaultContext = 'workspace',
  defaultProjectId,
  defaultTaskId,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [type, setType] = useState('progress_report');
  const [contextType, setContextType] = useState<'workspace' | 'project' | 'task'>(defaultContext);
  const [projectId, setProjectId] = useState<number | ''>(defaultProjectId || '');
  const [taskId, setTaskId] = useState<number | ''>(defaultTaskId || '');
  const [hoursSpent, setHoursSpent] = useState<number | ''>('');
  const [deliverables, setDeliverables] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (report) {
        setTitle(report.title || '');
        setContent(report.content || '');
        setSummary(report.summary || '');
        setType(report.type || 'progress_report');
        setContextType(report.context_type || (report.task_id ? 'task' : report.project_id ? 'project' : 'workspace'));
        setProjectId(report.project_id || '');
        setTaskId(report.task_id || '');
        setHoursSpent(report.metrics?.hours_spent || '');
        setDeliverables(Array.isArray(report.metrics?.deliverables) ? report.metrics.deliverables.join('\n') : '');
      } else {
        setTitle('');
        setContent('');
        setSummary('');
        setType('progress_report');
        setContextType(defaultContext);
        setProjectId(defaultProjectId || '');
        setTaskId(defaultTaskId || '');
        setHoursSpent('');
        setDeliverables('');
      }
      setError(null);
      fetchProjectsAndTasks();
    }
  }, [isOpen, report, defaultContext, defaultProjectId, defaultTaskId]);

  const fetchProjectsAndTasks = async () => {
    try {
      const [projRes, taskRes] = await Promise.all([
        api.get('/projects'),
        api.get('/tasks'),
      ]);
      if (projRes.data?.data) {
        setProjects(projRes.data.data);
      }
      if (taskRes.data?.data) {
        setTasks(taskRes.data.data);
      }
    } catch {
      // Ignored
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (targetStatus: 'draft' | 'submitted') => {
    if (!title.trim()) {
      setError('Judul laporan wajib diisi.');
      return;
    }
    if (!content.trim()) {
      setError('Konten laporan wajib diisi.');
      return;
    }

    setLoading(true);
    setError(null);

    const deliverablesList = deliverables
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean);

    const metricsData: Record<string, any> = {};
    if (hoursSpent !== '') metricsData.hours_spent = Number(hoursSpent);
    if (deliverablesList.length > 0) metricsData.deliverables = deliverablesList;

    const payload: any = {
      title: title.trim(),
      content: content.trim(),
      summary: summary.trim() || null,
      type,
      context_type: contextType,
      project_id: contextType === 'project' || (contextType === 'task' && projectId) ? Number(projectId) || null : null,
      task_id: contextType === 'task' ? Number(taskId) || null : null,
      metrics: Object.keys(metricsData).length > 0 ? metricsData : null,
      status: targetStatus,
    };

    try {
      if (report?.id) {
        await api.put(`/reports/${report.id}`, payload);
        showToast('Laporan berhasil diperbarui!', 'success');
      } else {
        await api.post('/reports', payload);
        showToast(
          targetStatus === 'draft' ? 'Draft laporan berhasil disimpan!' : 'Laporan berhasil dikirim untuk direview!',
          'success'
        );
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Gagal menyimpan laporan.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {report ? 'Edit Laporan Kerja' : 'Buat Laporan Kerja Baru'}
              </h2>
              <p className="text-xs text-slate-500">
                Laporan progres, tugas, atau penyelesaian dengan alur review & persetujuan.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-xs font-semibold text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Judul Laporan *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Laporan Progres Sprint 4 - Modul Autentikasi"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Type & Context Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tipe Laporan</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 transition bg-white"
              >
                <option value="progress_report">Progress Report (Laporan Kemajuan)</option>
                <option value="task_report">Task Report (Laporan Tugas)</option>
                <option value="completion_report">Completion Report (Laporan Penyelesaian)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Konteks Laporan</label>
              <select
                value={contextType}
                onChange={(e) => setContextType(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 transition bg-white"
              >
                <option value="workspace">Workspace (Independen / Pribadi)</option>
                <option value="project">Project (Terkait Proyek)</option>
                <option value="task">Task (Terkait Tugas Spesifik)</option>
              </select>
            </div>
          </div>

          {/* Context Target Selectors */}
          {contextType === 'project' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pilih Proyek *</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 transition bg-white"
              >
                <option value="">-- Pilih Proyek Terkait --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {contextType === 'task' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pilih Tugas *</label>
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 transition bg-white"
              >
                <option value="">-- Pilih Tugas Terkait --</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} {t.requires_report ? '⚠️ (Perlu Laporan)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Summary */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ringkasan Eksekutif (Opsional)
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Ringkasan 1-2 kalimat dari inti laporan ini..."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 transition"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Isi Laporan Detail *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Deskripsikan latar belakang, pekerjaan yang diselesaikan, kendala, hasil pengujian, dan temuan..."
              rows={8}
              className="w-full rounded-xl border border-slate-200 p-3.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-mono leading-relaxed"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Mendukung tag mention seperti <code className="text-indigo-600">@user</code> dan <code className="text-indigo-600">@role:admin</code>.
            </p>
          </div>

          {/* Metrics: Hours & Deliverables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Estimasi Jam Kerja (Opsional)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={hoursSpent}
                onChange={(e) => setHoursSpent(e.target.value ? Number(e.target.value) : '')}
                placeholder="e.g. 12.5"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Deliverable / Hasil (1 per baris)
              </label>
              <textarea
                value={deliverables}
                onChange={(e) => setDeliverables(e.target.value)}
                placeholder="Repository link&#10;Dokumentasi API&#10;Laporan QA"
                rows={2}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Batal
          </button>
          <div className="flex items-center gap-2">
            {!report && (
              <button
                type="button"
                onClick={() => handleSubmit('draft')}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5 text-slate-500" />
                <span>Simpan Draft</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSubmit('submitted')}
              disabled={loading}
              className="px-4.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{report ? 'Simpan Perubahan' : 'Kirim untuk Review'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
