'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  AtSign,
  ClipboardCheck,
  FileText,
  Users,
  UserCheck,
  UserPlus,
  StickyNote,
  X,
  Settings,
  Archive,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  action_url: string | null;
  meta: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  is_archived: boolean;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification type icon and color helpers
// ─────────────────────────────────────────────────────────────────────────────

function getNotificationMeta(type: string): {
  icon: React.ReactNode;
  color: string;
  bg: string;
} {
  const map: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    user_mentioned:    { icon: <AtSign className="h-3.5 w-3.5" />,    color: 'text-indigo-600',  bg: 'bg-indigo-100' },
    role_mentioned:    { icon: <Users className="h-3.5 w-3.5" />,     color: 'text-purple-600',  bg: 'bg-purple-100' },
    task_assigned:     { icon: <UserCheck className="h-3.5 w-3.5" />, color: 'text-sky-600',     bg: 'bg-sky-100' },
    task_completed:    { icon: <Check className="h-3.5 w-3.5" />,     color: 'text-emerald-600', bg: 'bg-emerald-100' },
    report_submitted:  { icon: <FileText className="h-3.5 w-3.5" />,  color: 'text-amber-600',   bg: 'bg-amber-100' },
    report_approved:   { icon: <ClipboardCheck className="h-3.5 w-3.5" />, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    revision_requested:{ icon: <FileText className="h-3.5 w-3.5" />,  color: 'text-orange-600',  bg: 'bg-orange-100' },
    report_rejected:   { icon: <X className="h-3.5 w-3.5" />,         color: 'text-rose-600',    bg: 'bg-rose-100' },
    note_commented:    { icon: <StickyNote className="h-3.5 w-3.5" />,color: 'text-teal-600',    bg: 'bg-teal-100' },
    project_invitation:{ icon: <UserPlus className="h-3.5 w-3.5" />,  color: 'text-sky-600',     bg: 'bg-sky-100' },
    member_joined:     { icon: <UserPlus className="h-3.5 w-3.5" />,  color: 'text-emerald-600', bg: 'bg-emerald-100' },
    role_changed:      { icon: <Users className="h-3.5 w-3.5" />,     color: 'text-violet-600',  bg: 'bg-violet-100' },
    deadline:          { icon: <Bell className="h-3.5 w-3.5" />,      color: 'text-rose-600',    bg: 'bg-rose-100' },
  };
  return map[type] ?? { icon: <Bell className="h-3.5 w-3.5" />, color: 'text-slate-500', bg: 'bg-slate-100' };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// ─────────────────────────────────────────────────────────────────────────────
// NotificationBell — compact bell icon for the Navbar with live unread count
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationBellProps {
  onClick: () => void;
  unreadCount: number;
}

export function NotificationBell({ onClick, unreadCount }: NotificationBellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Notifikasi"
      className="relative inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs cursor-pointer"
    >
      <Bell className="h-4 w-4" />
      <AnimatePresence>
        {unreadCount > 0 && (
          <motion.span
            key="badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NotificationDropdown — compact dropdown shown on Bell click
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCenter: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function NotificationDropdown({
  isOpen,
  onClose,
  onOpenCenter,
  anchorRef,
}: NotificationDropdownProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const fetchRecent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications', { params: { per_page: 8 } });
      if (res.data?.success) {
        setItems(res.data.data ?? []);
        setUnread(res.data.unread_count ?? 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchRecent();
  }, [isOpen, fetchRecent]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropRef.current &&
        !dropRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose, anchorRef]);

  const markRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch {}
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropRef}
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.13 }}
          className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-2xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-bold text-slate-800">Notifikasi</span>
              {unread > 0 && (
                <span className="rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold px-1.5 py-0.5">
                  {unread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  title="Tandai semua dibaca"
                  className="text-[10px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-indigo-50 transition"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Semua
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-400">
                <BellOff className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                Belum ada notifikasi
              </div>
            )}
            {!loading &&
              items.map((n) => {
                const meta = getNotificationMeta(n.type);
                return (
                  <div
                    key={n.id}
                    className={`group flex gap-2.5 px-4 py-3 hover:bg-slate-50 transition cursor-pointer ${
                      !n.is_read ? 'bg-indigo-50/40' : ''
                    }`}
                    onClick={() => !n.is_read && markRead(n.id)}
                  >
                    <div
                      className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}
                    >
                      {meta.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{n.title}</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                    )}
                  </div>
                );
              })}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              onClick={() => { onClose(); onOpenCenter(); }}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 py-2 rounded-xl transition"
            >
              Lihat Semua Notifikasi
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NotificationCenter — full-page notification management
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'all' | 'mentions' | 'tasks' | 'reports' | 'unread';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'all',      label: 'Semua' },
  { id: 'unread',   label: 'Belum Dibaca' },
  { id: 'mentions', label: '@Mention' },
  { id: 'tasks',    label: 'Tugas' },
  { id: 'reports',  label: 'Laporan' },
];

const TAB_TYPES: Record<TabId, string[]> = {
  all:      [],
  unread:   [],
  mentions: ['user_mentioned', 'role_mentioned'],
  tasks:    ['task_assigned', 'task_completed'],
  reports:  ['report_submitted', 'report_approved', 'revision_requested', 'report_rejected'],
};

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [prefOpen, setPrefOpen] = useState(false);

  const fetchNotifications = useCallback(async (tab: TabId, pg: number) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { per_page: 20, page: pg };
      if (tab === 'unread') params.is_read = false;
      if (TAB_TYPES[tab].length > 0) {
        // Filter by multiple types: use first (server supports single type filter)
        // We'll filter client-side for multi-type tabs
      }
      const res = await api.get('/notifications', { params });
      if (res.data?.success) {
        const all: NotificationItem[] = res.data.data ?? [];
        const filtered =
          TAB_TYPES[tab].length > 0
            ? all.filter((n) => TAB_TYPES[tab].includes(n.type))
            : all;
        setItems((prev) => (pg === 1 ? filtered : [...prev, ...filtered]));
        setUnreadCount(res.data.unread_count ?? 0);
        setCategoryCounts(res.data.category_counts ?? {});
        setLastPage(res.data.meta?.last_page ?? 1);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      fetchNotifications(activeTab, 1);
    }
  }, [isOpen, activeTab]); // eslint-disable-line

  const handleTabChange = (t: TabId) => {
    setActiveTab(t);
    setPage(1);
    setItems([]);
  };

  const markRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((u) => Math.max(0, u - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const archiveNotification = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/archive`);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const deleteNotification = async (id: number) => {
    try {
      await api.delete(`/notifications/${id}`);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-slate-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Pusat Notifikasi</h2>
              {unreadCount > 0 && (
                <p className="text-xs text-slate-500">{unreadCount} belum dibaca</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-xl transition"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tandai Semua
              </button>
            )}
            <button
              type="button"
              onClick={() => setPrefOpen((p) => !p)}
              className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-500"
              title="Preferensi Notifikasi"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-slate-100 overflow-x-auto shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === t.id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
              {t.id === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {loading && items.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <BellOff className="h-10 w-10 mb-3 text-slate-300" />
              <p className="text-sm font-medium">Tidak ada notifikasi</p>
              <p className="text-xs mt-1">Anda sudah up-to-date!</p>
            </div>
          )}
          {items.map((n) => {
            const meta = getNotificationMeta(n.type);
            return (
              <div
                key={n.id}
                className={`group flex gap-3 px-6 py-3.5 hover:bg-slate-50/80 transition ${
                  !n.is_read ? 'bg-indigo-50/30' : ''
                }`}
              >
                <div
                  className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}
                >
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${n.is_read ? 'text-slate-700' : 'text-slate-900'} truncate`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                      {!n.is_read && (
                        <button
                          type="button"
                          onClick={() => markRead(n.id)}
                          title="Tandai dibaca"
                          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-emerald-600 transition"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {n.action_url && (
                        <Link
                          href={n.action_url}
                          onClick={() => { markRead(n.id); onClose(); }}
                          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-indigo-600 transition"
                          title="Buka"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => archiveNotification(n.id)}
                        title="Arsip"
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-amber-600 transition"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNotification(n.id)}
                        title="Hapus"
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-rose-600 transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                {!n.is_read && (
                  <div className="mt-2 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                )}
              </div>
            );
          })}

          {/* Load more */}
          {!loading && page < lastPage && (
            <div className="p-4 text-center">
              <button
                type="button"
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  fetchNotifications(activeTab, next);
                }}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-xl transition"
              >
                Muat Lebih Banyak
              </button>
            </div>
          )}
        </div>

        {/* Preference Panel (inline) */}
        <AnimatePresence>
          {prefOpen && (
            <NotificationPreferencesPanel onClose={() => setPrefOpen(false)} />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification Preferences Panel
// ─────────────────────────────────────────────────────────────────────────────

interface PrefPanelProps {
  onClose: () => void;
}

const PREF_FIELDS: Array<{ key: string; label: string; description: string }> = [
  { key: 'in_app_notifications', label: 'Notifikasi In-App',  description: 'Tampilkan notifikasi di dalam aplikasi.' },
  { key: 'email_notifications',  label: 'Notifikasi Email',   description: 'Kirim notifikasi ke email Anda.' },
  { key: 'mention_notifications',label: '@Mention',           description: 'Notifikasi saat seseorang menyebut Anda.' },
  { key: 'task_reminders',       label: 'Tugas & Deadline',   description: 'Pengingat tugas mendekati tenggat waktu.' },
  { key: 'report_notifications', label: 'Laporan & Review',   description: 'Update status laporan dan permintaan review.' },
  { key: 'note_notifications',   label: 'Komentar Catatan',   description: 'Notifikasi komentar baru pada catatan Anda.' },
  { key: 'project_reminders',    label: 'Proyek & Tim',       description: 'Undangan, anggota baru, dan perubahan peran.' },
];

function NotificationPreferencesPanel({ onClose }: PrefPanelProps) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/notifications/preferences');
        if (res.data?.success) setPrefs(res.data.data ?? {});
      } catch {}
      setLoading(false);
    })();
  }, []);

  const toggle = (key: string) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/notifications/preferences', prefs);
      onClose();
    } catch {}
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="absolute inset-x-0 bottom-0 bg-white border-t border-slate-200 rounded-b-2xl p-6 shadow-2xl z-10"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-800">Preferensi Notifikasi</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
          {PREF_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-800">{f.label}</p>
                <p className="text-[11px] text-slate-400">{f.description}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(f.key)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  prefs[f.key] ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                    prefs[f.key] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Simpan Preferensi
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useNotifications hook — manages real-time-like polling + unread count
// ─────────────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/notifications', { params: { per_page: 1 } });
      if (res.data?.success) {
        setUnreadCount(res.data.unread_count ?? 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    // Poll every 60 seconds as a soft realtime fallback
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Listen to custom events dispatched elsewhere in the app
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('tuntas:notification-created', handler);
    return () => window.removeEventListener('tuntas:notification-created', handler);
  }, [refresh]);

  return { unreadCount, refresh };
}
