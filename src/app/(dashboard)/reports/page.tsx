'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Send,
  User,
  Calendar,
  FolderKanban,
  CheckSquare,
  ArrowUpDown,
  RefreshCw,
  Eye,
  Edit2,
  Sparkles,
} from 'lucide-react';
import api, { extractApiErrorMessage } from '@/lib/api';
import { showToast } from '@/components/ui/Toast';
import { ReportModal } from '@/components/reports/ReportModal';
import { ReportDetailModal } from '@/components/reports/ReportDetailModal';

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    draft: 0,
    submitted: 0,
    in_review: 0,
    revision_requested: 0,
    approved: 0,
    rejected: 0,
  });
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'queue' | 'my' | 'workspace' | 'project' | 'task'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [currentUserId, setCurrentUserId] = useState<number | undefined>(undefined);

  // Modals state
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  // Fetch current user
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('tuntas_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setCurrentUserId(parsed.id);
      }
    } catch {
      // Ignored
    }
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        sort_by: sortBy,
        sort_dir: sortDir,
      };

      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      if (typeFilter !== 'all') params.type = typeFilter;
      if (projectFilter !== 'all') params.project_id = projectFilter;

      if (activeTab === 'queue') {
        params.queue = 'pending';
      } else if (activeTab === 'my') {
        if (currentUserId) params.author_id = currentUserId;
      } else if (activeTab === 'workspace') {
        params.context = 'workspace';
      } else if (activeTab === 'project') {
        params.context = 'project';
      } else if (activeTab === 'task') {
        params.context = 'task';
      }

      const res = await api.get('/reports', { params });
      if (res.data?.data) {
        setReports(res.data.data);
      }
      if (res.data?.meta?.metrics) {
        setMetrics(res.data.meta.metrics);
      }
    } catch (err) {
      showToast(extractApiErrorMessage(err, 'Gagal memuat daftar laporan.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, statusFilter, typeFilter, projectFilter, sortBy, sortDir, currentUserId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await api.get('/projects');
        if (res.data?.data) {
          setProjects(res.data.data);
        }
      } catch {
        // Ignored
      }
    };
    loadProjects();
  }, []);

  const openCreateModal = () => {
    setEditingReport(null);
    setEditorModalOpen(true);
  };

  const openEditModal = (report: any) => {
    setEditingReport(report);
    setEditorModalOpen(true);
  };

  const openDetailModal = (reportId: number) => {
    setSelectedReportId(reportId);
    setDetailModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Approved
          </span>
        );
      case 'revision_requested':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            Revision
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
            <XCircle className="h-3 w-3 text-rose-600" />
            Rejected
          </span>
        );
      case 'in_review':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
            <Clock className="h-3 w-3 text-blue-600" />
            In Review
          </span>
        );
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
            <Send className="h-3 w-3 text-purple-600" />
            Submitted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-600" />
            <span>Work Reports & Review Workflow</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manajemen laporan tugas, kemajuan proyek, antrean review, dan verifikasi persetujuan.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchReports()}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Laporan</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
            Total Laporan
          </span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
            {metrics.total}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {metrics.draft} draft tersimpan
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-purple-100/80 shadow-2xs">
          <span className="text-[11px] font-semibold text-purple-600 block uppercase tracking-wider flex items-center gap-1">
            <Clock className="h-3 w-3" /> Antrean Review
          </span>
          <span className="text-2xl font-extrabold text-purple-900 mt-1 block">
            {metrics.submitted + metrics.in_review}
          </span>
          <span className="text-[11px] text-purple-500 mt-0.5 block">
            Menunggu verifikasi reviewer
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-amber-100/80 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-600 block uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Perlu Revisi
          </span>
          <span className="text-2xl font-extrabold text-amber-900 mt-1 block">
            {metrics.revision_requested}
          </span>
          <span className="text-[11px] text-amber-500 mt-0.5 block">
            Menunggu revisi penulis
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-emerald-100/80 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-600 block uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Disetujui
          </span>
          <span className="text-2xl font-extrabold text-emerald-900 mt-1 block">
            {metrics.approved}
          </span>
          <span className="text-[11px] text-emerald-600 mt-0.5 block">
            Laporan final terverifikasi
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
        {[
          { id: 'all', label: 'Semua Laporan' },
          { id: 'queue', label: 'Antrean Review (Queue)', highlight: metrics.submitted + metrics.in_review > 0 },
          { id: 'my', label: 'Laporan Saya' },
          { id: 'workspace', label: 'Workspace' },
          { id: 'project', label: 'Proyek' },
          { id: 'task', label: 'Tugas' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>{tab.label}</span>
            {tab.highlight && activeTab !== tab.id && (
              <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Search & Filters Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul, ringkasan, atau konten..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-indigo-500 transition"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:border-indigo-500 transition"
          >
            <option value="all">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="in_review">In Review</option>
            <option value="revision_requested">Revision Requested</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:border-indigo-500 transition"
          >
            <option value="all">Semua Tipe</option>
            <option value="progress_report">Progress Report</option>
            <option value="task_report">Task Report</option>
            <option value="completion_report">Completion Report</option>
          </select>

          {projects.length > 0 && (
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:border-indigo-500 transition max-w-[160px] truncate"
            >
              <option value="all">Semua Proyek</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title={`Urutan: ${sortDir === 'desc' ? 'Terbaru' : 'Terlama'}`}
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Reports Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="text-xs">Memuat laporan...</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="p-4 rounded-full bg-slate-50 text-slate-400 mb-3">
            <FileText className="h-8 w-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Tidak ada laporan ditemukan</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {activeTab === 'queue'
              ? 'Antrean review Anda kosong saat ini.'
              : 'Belum ada laporan yang sesuai dengan filter atau kata kunci ini.'}
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Buat Laporan Baru
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => {
            const isOwner = currentUserId && report.user_id === currentUserId;
            return (
              <div
                key={report.id}
                onClick={() => openDetailModal(report.id)}
                className="group p-5 rounded-2xl bg-white border border-slate-100 hover:border-slate-300 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                        {report.type?.replace('_', ' ') || 'Report'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-mono font-bold text-slate-500">
                        v{report.version || 1}
                      </span>
                    </div>
                    {getStatusBadge(report.status)}
                  </div>

                  {/* Title & Summary */}
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition line-clamp-1 mb-1">
                    {report.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                    {report.summary || report.content}
                  </p>
                </div>

                <div>
                  {/* Context Tag */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    {report.project ? (
                      <span className="inline-flex items-center gap-1 text-indigo-600 font-semibold truncate max-w-[150px]">
                        <FolderKanban className="h-3 w-3 shrink-0" />
                        {report.project.title}
                      </span>
                    ) : report.task ? (
                      <span className="inline-flex items-center gap-1 text-teal-600 font-semibold truncate max-w-[150px]">
                        <CheckSquare className="h-3 w-3 shrink-0" />
                        {report.task.title}
                      </span>
                    ) : (
                      <span className="text-slate-400">Workspace</span>
                    )}
                  </div>

                  {/* Author & Actions row */}
                  <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-50 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <strong className="text-slate-700 font-medium">
                        {isOwner ? 'Saya' : report.user?.name || 'User'}
                      </strong>
                    </span>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {isOwner && report.status === 'draft' && (
                        <button
                          onClick={() => openEditModal(report)}
                          className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                          title="Edit Draft"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => openDetailModal(report.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-bold transition text-[10px]"
                      >
                        Detail
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {editorModalOpen && (
        <ReportModal
          isOpen={editorModalOpen}
          onClose={() => setEditorModalOpen(false)}
          report={editingReport}
          onSuccess={fetchReports}
        />
      )}

      {detailModalOpen && (
        <ReportDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          reportId={selectedReportId}
          currentUserId={currentUserId}
          onRefresh={fetchReports}
        />
      )}
    </div>
  );
}
