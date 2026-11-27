'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  X,
  History,
  Clock,
  Activity,
  CheckCircle2,
  Flame,
  Target,
  GraduationCap,
  Folder,
  RefreshCw,
  FileText,
  Users,
  Shield,
  StickyNote,
  Filter,
  Search,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';

export interface AuditItem {
  id: number;
  actor_id?: number | null;
  user_id?: number | null;
  action: string;
  auditable_type?: string | null;
  auditable_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  context_type?: string | null;
  context_id?: number | null;
  project_id?: number | null;
  old_values?: any;
  new_values?: any;
  metadata?: any;
  payload?: any;
  created_at: string;
  actor?: {
    id: number;
    name: string;
    email: string;
  } | null;
  project?: {
    id: number;
    title: string;
  } | null;
}

interface ActivityTimelineProps {
  projectId?: number | null;
  className?: string;
  compact?: boolean;
}

export function ActivityTimeline({ projectId, className, compact = false }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const fetchActivities = useCallback(async (pg = 1, append = false) => {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        page: pg,
        per_page: compact ? 15 : 25,
      };

      if (projectId) params.project_id = projectId;
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (search) params.search = search;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await api.get('/activity', { params });
      if (res.data?.success) {
        const items = res.data.data || [];
        setActivities((prev) => (append ? [...prev, ...items] : items));
        setPage(res.data.meta?.current_page || 1);
        setLastPage(res.data.meta?.last_page || 1);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedCategory, search, startDate, endDate, compact]);

  useEffect(() => {
    fetchActivities(1, false);
  }, [fetchActivities]);

  const getActionBadge = (action: string) => {
    const act = action.toLowerCase();
    if (act.startsWith('project')) {
      return {
        icon: <Folder className="h-3.5 w-3.5 text-indigo-500" />,
        bg: 'bg-indigo-50 border-indigo-100',
        text: 'text-indigo-700',
        label: 'Project',
      };
    }
    if (act.startsWith('members')) {
      return {
        icon: <Users className="h-3.5 w-3.5 text-blue-500" />,
        bg: 'bg-blue-50 border-blue-100',
        text: 'text-blue-700',
        label: 'Member',
      };
    }
    if (act.startsWith('task')) {
      return {
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-sky-500" />,
        bg: 'bg-sky-50 border-sky-100',
        text: 'text-sky-700',
        label: 'Task',
      };
    }
    if (act.startsWith('notes')) {
      return {
        icon: <StickyNote className="h-3.5 w-3.5 text-teal-500" />,
        bg: 'bg-teal-50 border-teal-100',
        text: 'text-teal-700',
        label: 'Note',
      };
    }
    if (act.startsWith('report')) {
      return {
        icon: <FileText className="h-3.5 w-3.5 text-amber-500" />,
        bg: 'bg-amber-50 border-amber-100',
        text: 'text-amber-700',
        label: 'Report',
      };
    }
    if (act.startsWith('roles')) {
      return {
        icon: <Shield className="h-3.5 w-3.5 text-purple-500" />,
        bg: 'bg-purple-50 border-purple-100',
        text: 'text-purple-700',
        label: 'Role',
      };
    }
    if (act.includes('habit')) {
      return {
        icon: <Flame className="h-3.5 w-3.5 text-rose-500" />,
        bg: 'bg-rose-50 border-rose-100',
        text: 'text-rose-700',
        label: 'Habit',
      };
    }
    if (act.includes('goal')) {
      return {
        icon: <Target className="h-3.5 w-3.5 text-emerald-500" />,
        bg: 'bg-emerald-50 border-emerald-100',
        text: 'text-emerald-700',
        label: 'Goal',
      };
    }
    if (act.includes('exam')) {
      return {
        icon: <GraduationCap className="h-3.5 w-3.5 text-violet-500" />,
        bg: 'bg-violet-50 border-violet-100',
        text: 'text-violet-700',
        label: 'Exam',
      };
    }
    return {
      icon: <Activity className="h-3.5 w-3.5 text-slate-500" />,
      bg: 'bg-slate-50 border-slate-100',
      text: 'text-slate-700',
      label: 'Activity',
    };
  };

  const formatDescription = (item: AuditItem) => {
    const act = item.action;
    const meta = item.metadata || {};
    const payload = item.payload || {};
    const title = payload.title || payload.name || meta.description;

    switch (act) {
      case 'project.created':
        return `membuat proyek "${title || 'Baru'}"`;
      case 'project.updated':
        return `memperbarui proyek "${title || ''}"`;
      case 'project.archived':
        return `mengarsipkan proyek "${title || ''}"`;
      case 'members.invited':
        return `mengundang ${payload.email || 'anggota'} ke proyek`;
      case 'members.joined':
        return `bergabung ke proyek`;
      case 'members.removed':
        return `mengeluarkan anggota dari proyek`;
      case 'members.role_updated':
        return `mengubah peran anggota menjadi ${payload.new_role || 'baru'}`;
      case 'task.created':
        return `membuat tugas "${title || ''}"`;
      case 'task.assigned':
        return `menugaskan tugas "${title || ''}"`;
      case 'task.updated':
        return `memperbarui tugas "${title || ''}"`;
      case 'task.completed':
        return `menyelesaikan tugas "${title || ''}"`;
      case 'notes.created':
        return `membuat catatan "${title || ''}"`;
      case 'notes.updated':
        return `memperbarui catatan "${title || ''}"`;
      case 'notes.published':
        return `menerbitkan catatan "${title || ''}"`;
      case 'notes.archived':
        return `mengarsipkan catatan "${title || ''}"`;
      case 'notes.pinned':
        return `menyematkan catatan "${title || ''}"`;
      case 'notes.unpinned':
        return `melepas sematan catatan "${title || ''}"`;
      case 'report.submitted':
        return `mengirimkan laporan "${title || ''}"`;
      case 'report.in_review':
        return `memulai review laporan "${title || ''}"`;
      case 'report.revision_requested':
        return `meminta revisi untuk laporan "${title || ''}"`;
      case 'report.resubmitted':
        return `mengirimkan kembali revisi laporan "${title || ''}"`;
      case 'report.approved':
        return `menyetujui laporan "${title || ''}"`;
      case 'report.rejected':
        return `menolak laporan "${title || ''}"`;
      case 'roles.created':
        return `membuat peran "${title || ''}"`;
      case 'roles.updated':
        return `memperbarui izin peran "${title || ''}"`;
      case 'roles.deleted':
        return `menghapus peran "${title || ''}"`;
      default:
        return meta.description || payload.description || act.replace('.', ' ');
    }
  };

  const getResourceLink = (item: AuditItem) => {
    const act = item.action.toLowerCase();
    const id = item.resource_id || item.auditable_id;

    if (!id || id === '0') return null;

    if (act.startsWith('task')) return `/tasks?id=${id}`;
    if (act.startsWith('notes')) return `/notes`;
    if (act.startsWith('report')) return `/reports`;
    if (act.startsWith('project') && item.project_id) return `/projects`;
    return null;
  };

  return (
    <div className={`flex flex-col h-full bg-white ${className || ''}`}>
      {/* Top Filter Bar */}
      <div className="p-3 border-b border-slate-100 flex flex-col gap-2.5 bg-slate-50/50">
        <div className="flex items-center justify-between gap-2">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs py-0.5">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'task', label: 'Tugas' },
              { id: 'notes', label: 'Catatan' },
              { id: 'report', label: 'Laporan' },
              { id: 'members', label: 'Anggota' },
              { id: 'roles', label: 'Peran' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                showFilters
                  ? 'bg-slate-200/70 border-slate-300 text-slate-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title="Filter tambahan"
            >
              <Filter className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => fetchActivities(1, false)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-slate-900' : ''}`} />
            </button>
          </div>
        </div>

        {/* Collapsible search / date filters */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Cari aktivitas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-600"
              />
            </div>
            <div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-600"
              />
            </div>
          </div>
        )}
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && activities.length === 0 ? (
          <div className="flex h-36 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4">
            <Clock className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-600">Tidak ada riwayat aktivitas</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Aktivitas yang tercatat akan ditampilkan di sini.</p>
          </div>
        ) : (
          activities.map((item) => {
            const badge = getActionBadge(item.action);
            const actorName = item.actor?.name || 'Sistem';
            const resourceLink = getResourceLink(item);

            return (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-200 hover:shadow-2xs transition group"
              >
                {/* Badge Icon */}
                <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${badge.bg}`}>
                  {badge.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900">
                        {actorName}
                      </span>
                      <span className="text-xs text-slate-600 font-normal">
                        {formatDescription(item)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Context and date */}
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 font-medium">
                    <span className={`px-1.5 py-0.5 rounded-md font-semibold text-[9px] ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                    {item.project?.title && !projectId && (
                      <span className="truncate max-w-[140px] text-slate-500">
                        📁 {item.project.title}
                      </span>
                    )}
                    <span>•</span>
                    <span>
                      {new Date(item.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    {resourceLink && (
                      <Link
                        href={resourceLink}
                        className="ml-auto inline-flex items-center gap-0.5 text-indigo-600 hover:text-indigo-800 transition"
                      >
                        Buka <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Pagination load more */}
        {page < lastPage && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => fetchActivities(page + 1, true)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer"
            >
              {loading ? 'Memuat...' : 'Muat Lebih Banyak'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
