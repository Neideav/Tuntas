'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, Send, Trash2, CornerDownRight, User } from 'lucide-react';
import api, { extractApiErrorMessage } from '@/lib/api';
import { showToast } from '@/components/ui/Toast';

export interface CommentItem {
  id: number;
  note_id: number;
  user_id: number;
  parent_id: number | null;
  content: string;
  created_at: string;
  user?: { id: number; name: string; email: string };
  replies?: CommentItem[];
}

interface NoteCommentsModalProps {
  isOpen: boolean;
  noteId: number;
  noteTitle: string;
  comments: CommentItem[];
  onClose: () => void;
  onCommentAdded: () => void;
}

export function NoteCommentsModal({
  isOpen,
  noteId,
  noteTitle,
  comments,
  onClose,
  onCommentAdded,
}: NoteCommentsModalProps) {
  const [newComment, setNewComment] = useState('');
  const [replyParentId, setReplyParentId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      const res = await api.post(`/notes/${noteId}/comments`, {
        content: newComment.trim(),
        parent_id: replyParentId,
      });

      if (res.data?.success) {
        showToast('Komentar berhasil ditambahkan.', 'success');
        setNewComment('');
        setReplyParentId(null);
        onCommentAdded();
      }
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal menambahkan komentar.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Hapus komentar ini?')) return;
    try {
      await api.delete(`/notes/${noteId}/comments/${commentId}`);
      showToast('Komentar berhasil dihapus.', 'info');
      onCommentAdded();
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal menghapus komentar.'), 'error');
    }
  };

  const renderCommentThread = (item: CommentItem, isReply = false) => {
    return (
      <div
        key={item.id}
        className={`p-3.5 rounded-2xl bg-white border border-slate-200/80 space-y-2 transition ${
          isReply ? 'ml-6 bg-slate-50/70 border-slate-200' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[11px] flex items-center justify-center">
              {item.user?.name ? item.user.name.substring(0, 2).toUpperCase() : 'U'}
            </div>
            <div>
              <h5 className="font-bold text-xs text-slate-900">{item.user?.name || 'Pengguna'}</h5>
              <p className="text-[10px] text-slate-400">
                {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!isReply && (
              <button
                type="button"
                onClick={() => setReplyParentId(item.id)}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-0.5 rounded-md hover:bg-indigo-50 transition cursor-pointer"
              >
                Balas
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDeleteComment(item.id)}
              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Hapus Komentar"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-800 leading-relaxed font-sans pl-1 whitespace-pre-wrap">
          {item.content}
        </p>

        {/* Nested replies */}
        {item.replies && item.replies.length > 0 && (
          <div className="pt-2 space-y-2 border-t border-slate-100">
            {item.replies.map((reply) => renderCommentThread(reply, true))}
          </div>
        )}
      </div>
    );
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
          className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 z-10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-xs">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-slate-900 truncate max-w-xs">
                  Diskusi: {noteTitle || 'Catatan'}
                </h3>
                <p className="text-xs text-slate-500">
                  {comments.length} utas komentar pada catatan ini
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

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/30">
            {comments.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 italic">
                Belum ada komentar pada catatan ini. Mulai diskusi di bawah!
              </div>
            ) : (
              comments.map((c) => renderCommentThread(c, false))
            )}
          </div>

          {/* Reply Target Indicator */}
          {replyParentId && (
            <div className="px-5 py-2 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between text-xs text-indigo-900">
              <span className="flex items-center gap-1 font-semibold">
                <CornerDownRight className="h-3.5 w-3.5 text-indigo-600" />
                <span>Membalas komentar...</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyParentId(null)}
                className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold cursor-pointer"
              >
                Batal Balas
              </button>
            </div>
          )}

          {/* New Comment Input Form */}
          <form
            onSubmit={handleSubmitComment}
            className="p-4 border-t border-slate-100 bg-white flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyParentId ? 'Tuliskan balasan...' : 'Tulis komentar atau sebut @anggota...'}
              className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Kirim</span>
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
