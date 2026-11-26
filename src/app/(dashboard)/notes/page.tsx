'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Pin,
  FolderKanban,
  CheckSquare,
  Clock,
  Tag,
  Filter,
  Trash2,
  Edit2,
  Lock,
  Globe,
  Users,
  Archive,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import api, { extractApiErrorMessage } from '@/lib/api';
import { showToast } from '@/components/ui/Toast';
import { NoteEditorModal, NoteData } from '@/components/notes/NoteEditorModal';
import { EmptyState } from '@/components/ui/EmptyState';

interface NotesSummary {
  total: number;
  workspace_count: number;
  project_count: number;
  task_count: number;
  pinned_count: number;
  drafts_count: number;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [summary, setSummary] = useState<NotesSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [contextFilter, setContextFilter] = useState<'all' | 'workspace' | 'project' | 'task'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Modals
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [selectedNoteForEdit, setSelectedNoteForEdit] = useState<NoteData | null>(null);

  const fetchNotes = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const params = new URLSearchParams();
      if (contextFilter !== 'all') params.append('context', contextFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (selectedTag) params.append('tag', selectedTag);

      const res = await api.get(`/notes?${params.toString()}`);
      if (res.data?.success) {
        setNotes(res.data.data || []);
        setSummary(res.data.summary || null);
      }
    } catch (err: unknown) {
      console.error(err);
      showToast('Gagal memuat daftar catatan.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [contextFilter, statusFilter, searchQuery, selectedTag]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleCreateNew = () => {
    setSelectedNoteForEdit(null);
    setEditorModalOpen(true);
  };

  const handleEditNote = (note: NoteData) => {
    setSelectedNoteForEdit(note);
    setEditorModalOpen(true);
  };

  const handleTogglePin = async (e: React.MouseEvent, noteId: number) => {
    e.stopPropagation();
    try {
      const res = await api.patch(`/notes/${noteId}/pin`);
      if (res.data?.success) {
        showToast(res.data.message || 'Status sematan diperbarui.', 'info');
        fetchNotes(true);
      }
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal mengubah sematan catatan.'), 'error');
    }
  };

  const handleDeleteNote = async (e: React.MouseEvent, noteId: number) => {
    e.stopPropagation();
    if (!confirm('Hapus catatan ini?')) return;
    try {
      await api.delete(`/notes/${noteId}`);
      showToast('Catatan berhasil dihapus.', 'info');
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      fetchNotes(true);
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal menghapus catatan.'), 'error');
    }
  };

  // Split pinned vs normal notes
  const pinnedNotes = useMemo(() => notes.filter((n) => n.is_pinned), [notes]);
  const otherNotes = useMemo(() => notes.filter((n) => !n.is_pinned), [notes]);

  const getContextBadge = (note: NoteData) => {
    if (note.task_id) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          <CheckSquare className="h-3 w-3" />
          <span>Tugas</span>
        </span>
      );
    }
    if (note.project_id) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 truncate max-w-[120px]">
          <FolderKanban className="h-3 w-3 shrink-0" />
          <span className="truncate">{note.project?.title || 'Proyek'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
        <span>Workspace</span>
      </span>
    );
  };

  const renderNoteCard = (note: NoteData) => {
    const cardBg = note.color && note.color !== '#ffffff' ? note.color : '#ffffff';
    const plainSnippet = note.content
      ? note.content.replace(/[#*`_~\[\]\(\)\->]/g, '').trim()
      : 'Tidak ada konten';

    return (
      <div
        key={note.id}
        onClick={() => handleEditNote(note)}
        className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md hover:border-slate-300 transition cursor-pointer select-none"
        style={{ backgroundColor: cardBg }}
      >
        <div>
          {/* Card Top: Badges & Pin Action */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {getContextBadge(note)}
              {note.status === 'draft' && (
                <span className="px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700 text-[9px] font-bold uppercase tracking-wider">
                  Draf
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => note.id && handleTogglePin(e, note.id)}
                className={`p-1 rounded-lg transition cursor-pointer ${
                  note.is_pinned
                    ? 'text-amber-600 bg-amber-100/80 shadow-2xs'
                    : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700'
                }`}
                title={note.is_pinned ? 'Lepas Sematan' : 'Sematkan Catatan'}
              >
                <Pin className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={(e) => note.id && handleDeleteNote(e, note.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-rose-600 transition cursor-pointer"
                title="Hapus Catatan"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Title & Snippet */}
          <div className="mt-2.5 space-y-1">
            <h4 className="font-bold text-sm text-slate-900 group-hover:text-black line-clamp-1">
              {note.title || 'Untitled'}
            </h4>
            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed font-sans">
              {plainSnippet}
            </p>
          </div>
        </div>

        {/* Card Footer: Tags & Author/Date */}
        <div className="mt-4 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1 flex-wrap truncate max-w-[65%]">
            {note.tags && note.tags.length > 0 ? (
              note.tags.slice(0, 2).map((t) => (
                <span key={t} className="px-1.5 py-0.2 rounded bg-black/5 text-[10px] font-semibold text-slate-700">
                  #{t}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-slate-400">
                {note.updated_at ? new Date(note.updated_at).toLocaleDateString() : ''}
              </span>
            )}
          </div>

          <span className="text-[10px] font-semibold text-slate-600 truncate">
            {note.user?.name ? note.user.name.split(' ')[0] : 'Saya'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Catatan & Dokumentasi</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {summary?.total || notes.length} Dokumen
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola ide, dokumentasi proyek tim, dan catatan kontekstual tugas dengan rich text dan autosave.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateNew}
          className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-black active:scale-[0.99] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Buat Catatan Baru</span>
        </button>
      </div>

      {/* Metrics Row */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Workspace</span>
            <span className="text-lg font-bold text-slate-900">{summary.workspace_count}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Proyek Tim</span>
            <span className="text-lg font-bold text-slate-900">{summary.project_count}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tugas Terkait</span>
            <span className="text-lg font-bold text-slate-900">{summary.task_count}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Disematkan</span>
            <span className="text-lg font-bold text-amber-600">{summary.pinned_count}</span>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari catatan berdasarkan judul, isi konten, atau tag..."
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </div>

        {/* Context Filters */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setContextFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              contextFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => setContextFilter('workspace')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              contextFilter === 'workspace' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Workspace
          </button>
          <button
            type="button"
            onClick={() => setContextFilter('project')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              contextFilter === 'project' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Proyek
          </button>
          <button
            type="button"
            onClick={() => setContextFilter('task')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              contextFilter === 'task' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tugas
          </button>
        </div>

        {/* Status Selector */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="published">Diterbitkan</option>
            <option value="draft">Draf</option>
            <option value="archived">Diarsipkan</option>
          </select>
        </div>
      </div>

      {/* Content Rendering */}
      {loading && notes.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
          <p className="text-xs text-slate-500 font-medium">Memuat catatan...</p>
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={searchQuery ? 'Tidak ada catatan yang cocok' : 'Belum ada catatan'}
          description={
            searchQuery
              ? 'Coba gunakan kata kunci pencarian lain atau setel ulang filter.'
              : 'Buat catatan pertama Anda untuk mendokumentasikan riset, ide, atau pedoman kerja.'
          }
          actionLabel="Buat Catatan Sekarang"
          onAction={handleCreateNew}
        />
      ) : (
        <div className="space-y-6">
          {/* Pinned Notes Section */}
          {pinnedNotes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Pin className="h-3.5 w-3.5 text-amber-500" />
                <span>Disematkan ({pinnedNotes.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinnedNotes.map((note) => renderNoteCard(note))}
              </div>
            </div>
          )}

          {/* Regular Notes Section */}
          {otherNotes.length > 0 && (
            <div className="space-y-3">
              {pinnedNotes.length > 0 && (
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Lainnya ({otherNotes.length})
                </h3>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherNotes.map((note) => renderNoteCard(note))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Note Editor Modal */}
      <NoteEditorModal
        isOpen={editorModalOpen}
        note={selectedNoteForEdit}
        defaultContextType={contextFilter === 'all' ? 'workspace' : contextFilter}
        onClose={() => setEditorModalOpen(false)}
        onSuccess={() => {
          fetchNotes(true);
        }}
      />
    </div>
  );
}
