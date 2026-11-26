'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  FileText,
  Pin,
  CheckSquare,
  History,
  MessageSquare,
  Trash2,
  FolderKanban,
  Check,
  Tag,
  Palette,
  Eye,
  Lock,
  Globe,
  Users,
} from 'lucide-react';
import api, { extractApiErrorMessage } from '@/lib/api';
import { showToast } from '@/components/ui/Toast';
import { RichTextEditor } from './RichTextEditor';
import { NoteVersionModal, VersionItem } from './NoteVersionModal';
import { NoteCommentsModal, CommentItem } from './NoteCommentsModal';

export interface NoteData {
  id?: number;
  user_id?: number;
  context_type?: 'workspace' | 'project' | 'task';
  context_id?: number | null;
  project_id?: number | null;
  task_id?: number | null;
  title: string;
  content: string;
  status?: 'draft' | 'published' | 'archived';
  visibility?: 'private' | 'team' | 'public';
  version?: number;
  color?: string;
  tags?: string[];
  is_pinned?: boolean;
  is_archived?: boolean;
  created_at?: string;
  updated_at?: string;
  user?: { id: number; name: string; email: string };
  project?: { id: number; title: string };
  task?: { id: number; title: string };
  versions?: VersionItem[];
  comments?: CommentItem[];
}

interface NoteEditorModalProps {
  isOpen: boolean;
  note?: NoteData | null;
  defaultContextType?: 'workspace' | 'project' | 'task';
  defaultProjectId?: number | null;
  defaultTaskId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

const NOTE_COLORS = [
  { label: 'Putih', hex: '#ffffff' },
  { label: 'Kuning', hex: '#fef9c3' },
  { label: 'Hijau', hex: '#dcfce7' },
  { label: 'Biru', hex: '#e0f2fe' },
  { label: 'Merah Muda', hex: '#fce7f3' },
  { label: 'Ungu', hex: '#f3e8ff' },
  { label: 'Abu-abu', hex: '#f1f5f9' },
];

export function NoteEditorModal({
  isOpen,
  note,
  defaultContextType = 'workspace',
  defaultProjectId = null,
  defaultTaskId = null,
  onClose,
  onSuccess,
}: NoteEditorModalProps) {
  const isEditing = !!note?.id;

  // Form Fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contextType, setContextType] = useState<'workspace' | 'project' | 'task'>(defaultContextType);
  const [projectId, setProjectId] = useState<number | null>(defaultProjectId);
  const [taskId, setTaskId] = useState<number | null>(defaultTaskId);
  const [color, setColor] = useState('#ffffff');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('published');
  const [visibility, setVisibility] = useState<'private' | 'team' | 'public'>('team');
  const [isPinned, setIsPinned] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [currentNoteId, setCurrentNoteId] = useState<number | null>(null);

  // Submodals
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [versionsList, setVersionsList] = useState<VersionItem[]>([]);
  const [commentsList, setCommentsList] = useState<CommentItem[]>([]);

  // Project List for selection
  const [projectsList, setProjectsList] = useState<{ id: number; title: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Load Projects for dropdown
  useEffect(() => {
    if (isOpen) {
      api.get('/projects').then((res) => {
        if (res.data?.success) {
          setProjectsList(res.data.data || []);
        }
      }).catch(console.error);
    }
  }, [isOpen]);

  // Sync Note state
  useEffect(() => {
    if (isOpen) {
      if (note) {
        setCurrentNoteId(note.id || null);
        setTitle(note.title || '');
        setContent(note.content || '');
        setContextType(note.context_type || (note.project_id ? 'project' : note.task_id ? 'task' : 'workspace'));
        setProjectId(note.project_id || null);
        setTaskId(note.task_id || null);
        setColor(note.color || '#ffffff');
        setStatus(note.status || 'published');
        setVisibility(note.visibility || 'team');
        setIsPinned(!!note.is_pinned);
        setTags(note.tags || []);
        setCurrentVersion(note.version || 1);
        setVersionsList(note.versions || []);
        setCommentsList(note.comments || []);
      } else {
        setCurrentNoteId(null);
        setTitle('');
        setContent('');
        setContextType(defaultContextType);
        setProjectId(defaultProjectId);
        setTaskId(defaultTaskId);
        setColor('#ffffff');
        setStatus('published');
        setVisibility('team');
        setIsPinned(false);
        setTags([]);
        setCurrentVersion(1);
        setVersionsList([]);
        setCommentsList([]);
      }
    }
  }, [isOpen, note, defaultContextType, defaultProjectId, defaultTaskId]);

  // Fetch full details if editing existing note
  const refreshNoteDetails = useCallback(async () => {
    if (!currentNoteId) return;
    try {
      const res = await api.get(`/notes/${currentNoteId}`);
      if (res.data?.success) {
        const d = res.data.data;
        setCurrentVersion(d.version || 1);
        setVersionsList(d.versions || []);
        setCommentsList(d.comments || []);
        setIsPinned(!!d.is_pinned);
      }
    } catch (err: unknown) {
      console.error(err);
    }
  }, [currentNoteId]);

  // Autosave callback for RichTextEditor
  const handleAutosave = async (newContent: string): Promise<boolean> => {
    if (!newContent.trim()) return false;

    try {
      if (currentNoteId) {
        // Update existing note
        const res = await api.put(`/notes/${currentNoteId}`, {
          title: title.trim() || 'Untitled Note',
          content: newContent,
          color,
          status,
          visibility,
          tags,
          is_pinned: isPinned,
          version: currentVersion,
        });

        if (res.data?.success) {
          setCurrentVersion(res.data.data.version);
          return true;
        }
      } else {
        // Create initial draft
        const res = await api.post('/notes', {
          title: title.trim() || 'Untitled Note',
          content: newContent,
          context_type: contextType,
          project_id: projectId,
          task_id: taskId,
          color,
          status,
          visibility,
          tags,
          is_pinned: isPinned,
        });

        if (res.data?.success) {
          setCurrentNoteId(res.data.data.id);
          setCurrentVersion(res.data.data.version);
          return true;
        }
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        showToast('Konflik versi terdeteksi! Catatan telah diperbarui di sesi lain.', 'error');
      }
      return false;
    }
    return false;
  };

  const handleManualSave = async () => {
    if (!content.trim()) {
      showToast('Konten catatan tidak boleh kosong.', 'error');
      return;
    }

    try {
      setSaving(true);
      if (currentNoteId) {
        await api.put(`/notes/${currentNoteId}`, {
          title: title.trim() || 'Untitled Note',
          content,
          color,
          status,
          visibility,
          tags,
          is_pinned: isPinned,
          version: currentVersion,
        });
        showToast('Catatan berhasil diperbarui.', 'success');
      } else {
        const res = await api.post('/notes', {
          title: title.trim() || 'Untitled Note',
          content,
          context_type: contextType,
          project_id: projectId,
          task_id: taskId,
          color,
          status,
          visibility,
          tags,
          is_pinned: isPinned,
        });
        showToast('Catatan baru berhasil disimpan.', 'success');
        setCurrentNoteId(res.data?.data?.id);
      }
      onSuccess();
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal menyimpan catatan.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToTask = async () => {
    if (!currentNoteId) {
      showToast('Simpan catatan terlebih dahulu sebelum mengonversi ke tugas.', 'info');
      return;
    }

    if (!confirm('Konversi catatan ini menjadi tugas? Dokumen asli tetap akan disimpan dan ditautkan.')) return;

    try {
      const res = await api.post(`/notes/${currentNoteId}/convert-to-task`);
      if (res.data?.success) {
        showToast(res.data.message || 'Catatan berhasil dikonversi menjadi tugas!', 'success');
        refreshNoteDetails();
        onSuccess();
      }
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal mengonversi catatan ke tugas.'), 'error');
    }
  };

  const handleTogglePin = async () => {
    if (!currentNoteId) {
      setIsPinned(!isPinned);
      return;
    }

    try {
      const res = await api.patch(`/notes/${currentNoteId}/pin`);
      if (res.data?.success) {
        setIsPinned(res.data.data.is_pinned);
        showToast(res.data.message || 'Status sematan diperbarui.', 'info');
        onSuccess();
      }
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal mengubah sematan catatan.'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!currentNoteId) return;
    if (!confirm('Hapus catatan ini? Catatan akan dipindahkan ke arsip sampah.')) return;

    try {
      await api.delete(`/notes/${currentNoteId}`);
      showToast('Catatan berhasil dihapus.', 'info');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal menghapus catatan.'), 'error');
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((item) => item !== t));
  };

  if (!isOpen) return null;

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
          className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 z-10 overflow-hidden"
          style={{ backgroundColor: color !== '#ffffff' ? color : '#ffffff' }}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-white/80 backdrop-blur-xs shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-xs">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {isEditing ? 'Sunting Catatan & Dokumentasi' : 'Buat Catatan Baru'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {currentNoteId ? `Versi ${currentVersion} • Tersimpan di Tuntas Cloud` : 'Draf baru'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick Actions (if existing note) */}
              {currentNoteId && (
                <>
                  <button
                    type="button"
                    onClick={handleTogglePin}
                    className={`p-2 rounded-xl transition cursor-pointer ${
                      isPinned
                        ? 'bg-amber-100 text-amber-700 shadow-xs'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                    title={isPinned ? 'Lepas Sematan' : 'Sematkan di Atas'}
                  >
                    <Pin className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleConvertToTask}
                    className="h-8 px-3 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="Konversi catatan ini menjadi tugas kolaboratif"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Jadikan Tugas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVersionModalOpen(true)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    title="Riwayat Versi"
                  >
                    <History className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCommentsModalOpen(true)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer relative"
                    title="Komentar & Diskusi"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {commentsList.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center">
                        {commentsList.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDelete}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="Hapus Catatan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Form Content Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Title & Color Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Judul Catatan..."
                className="flex-1 text-base sm:text-lg font-bold text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
              />

              {/* Color Palette Selector */}
              <div className="flex items-center gap-1.5 shrink-0 bg-white/70 p-1 rounded-xl border border-slate-200/60">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    className={`h-6 w-6 rounded-full border border-slate-300 transition cursor-pointer flex items-center justify-center ${
                      color === c.hex ? 'scale-110 ring-2 ring-slate-800 ring-offset-1' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  >
                    {color === c.hex && <Check className="h-3 w-3 text-slate-800" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Context & Metadata Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-2xl bg-white/80 border border-slate-200/80 text-xs">
              {/* Context Type */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Konteks Catatan
                </label>
                <select
                  value={contextType}
                  onChange={(e) => setContextType(e.target.value as any)}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="workspace">Workspace Pribadi</option>
                  <option value="project">Proyek Tim</option>
                  <option value="task">Terkait Tugas</option>
                </select>
              </div>

              {/* Project selector if project context */}
              {contextType === 'project' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Pilih Proyek
                  </label>
                  <select
                    value={projectId || ''}
                    onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none truncate"
                  >
                    <option value="">-- Pilih Proyek --</option>
                    {projectsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Status Publikasi
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="published">Diterbitkan (Published)</option>
                  <option value="draft">Draf (Draft)</option>
                  <option value="archived">Diarsipkan (Archived)</option>
                </select>
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Visibilitas Akses
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="team">Tim (Sesuai Izin Proyek)</option>
                  <option value="private">Pribadi (Hanya Saya)</option>
                  <option value="public">Publik</option>
                </select>
              </div>
            </div>

            {/* Tags Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Tag className="h-3 w-3" />
                <span>Tag:</span>
              </span>

              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}

              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="+ Tambah tag..."
                className="h-7 px-2 text-xs rounded-lg border border-slate-200/80 bg-white/70 focus:outline-none focus:bg-white"
              />
            </div>

            {/* Embedded Rich Text Editor with Autosave */}
            <RichTextEditor
              value={content}
              onChange={setContent}
              onAutosave={handleAutosave}
              minHeight="340px"
              placeholder="Tuliskan dokumentasi, catatan teknis, atau ide Anda..."
            />
          </div>

          {/* Footer Save & Close */}
          <div className="px-6 py-3.5 border-t border-slate-100 bg-white/80 backdrop-blur-xs flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-500 font-medium">
              {currentNoteId ? `ID: #${currentNoteId}` : 'Catatan baru'}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleManualSave}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span>Simpan Catatan</span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Submodal: Versions History */}
      {currentNoteId && (
        <NoteVersionModal
          isOpen={versionModalOpen}
          noteId={currentNoteId}
          versions={versionsList}
          currentVersion={currentVersion}
          onClose={() => setVersionModalOpen(false)}
          onRestored={() => {
            refreshNoteDetails();
            onSuccess();
          }}
        />
      )}

      {/* Submodal: Threaded Comments */}
      {currentNoteId && (
        <NoteCommentsModal
          isOpen={commentsModalOpen}
          noteId={currentNoteId}
          noteTitle={title}
          comments={commentsList}
          onClose={() => setCommentsModalOpen(false)}
          onCommentAdded={refreshNoteDetails}
        />
      )}
    </AnimatePresence>
  );
}
