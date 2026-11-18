'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCheck,
  Trash2,
  Clock,
  AlertCircle,
  Info,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Archive,
  RotateCcw,
  Settings,
  Target,
  Moon,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [scanning, setScanning] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Notification Preferences Modal State
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefs, setPrefs] = useState<any>({
    task_reminders: true,
    project_reminders: true,
    habit_reminders: true,
    goal_reminders: true,
    exam_reminders: true,
    learning_reminders: true,
    preferred_reminder_time: '09:00',
    quiet_hours_start: '',
    quiet_hours_end: '',
  });

  const fetchNotifications = async (cat?: string) => {
    setLoading(true);
    try {
      const params: any = {};
      const currentCat = cat || activeCategory;

      if (currentCat === 'archived') {
        params.is_archived = true;
      } else {
        params.is_archived = false;
        if (currentCat && currentCat !== 'all') {
          params.type = currentCat;
        }
      }

      const response = await api.get('/notifications', { params });
      if (response.data?.success) {
        setNotifications(response.data.data || []);
        setUnreadCount(response.data.unread_count || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      setPrefsLoading(true);
      const res = await api.get('/notifications/preferences');
      if (res.data?.success) {
        setPrefs(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPrefsLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSavingPrefs(true);
      const res = await api.put('/notifications/preferences', prefs);
      if (res.data?.success) {
        setPrefs(res.data.data);
        setIsPreferencesOpen(false);
      }
    } catch (err) {
      alert('Gagal menyimpan preferensi notifikasi.');
    } finally {
      setSavingPrefs(false);
    }
  };

  useEffect(() => {
    fetchNotifications(activeCategory);
  }, [activeCategory]);

  const handleCheckReminders = async () => {
    try {
      setScanning(true);
      const res = await api.post('/notifications/check-reminders');
      if (res.data?.success) {
        fetchNotifications(activeCategory);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleArchive = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/archive`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnarchive = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/unarchive`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const categories = [
    { id: 'all', label: 'Semua Notifikasi' },
    { id: 'deadline', label: 'Tenggat Waktu', icon: Clock },
    { id: 'exam', label: 'Ujian', icon: GraduationCap },
    { id: 'habit', label: 'Kebiasaan', icon: Sparkles },
    { id: 'goal', label: 'Target / OKR', icon: Target },
    { id: 'system', label: 'Sistem', icon: Info },
    { id: 'archived', label: 'Diarsipkan', icon: Archive },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Notification Center</h2>
            {unreadCount > 0 && (
              <span className="flex h-5 items-center justify-center rounded-full bg-rose-500 px-2 text-[10px] font-bold text-white">
                {unreadCount} Baru
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Pusat peringatan cerdas: pengingat batas waktu, jadwal ujian, kebiasaan, dan progres target.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              fetchPreferences();
              setIsPreferencesOpen(true);
            }}
            leftIcon={<Settings className="h-3.5 w-3.5" />}
          >
            Pengaturan
          </Button>

          <Button
            size="sm"
            variant="secondary"
            loading={scanning}
            onClick={handleCheckReminders}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Pindai Jadwal
          </Button>

          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkAllRead}
              leftIcon={<CheckCheck className="h-4 w-4" />}
            >
              Tandai Dibaca
            </Button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-slate-900 text-white shadow-xs font-bold'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={activeCategory === 'archived' ? 'Tidak ada notifikasi yang diarsipkan' : 'Tidak ada notifikasi aktif'}
          description="Semua jadwal dan tugas Anda dalam kondisi terkini. Peringatan baru akan muncul di sini."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`flex items-start justify-between gap-4 p-4 rounded-2xl border transition ${
                notif.is_read
                  ? 'bg-white border-slate-200/80 shadow-2xs'
                  : 'bg-slate-50 border-slate-300 shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    notif.type === 'deadline'
                      ? 'bg-rose-50 text-rose-600'
                      : notif.type === 'exam'
                      ? 'bg-purple-50 text-purple-600'
                      : notif.type === 'habit'
                      ? 'bg-emerald-50 text-emerald-600'
                      : notif.type === 'goal'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {notif.type === 'deadline' ? (
                    <Clock className="h-4 w-4" />
                  ) : notif.type === 'exam' ? (
                    <GraduationCap className="h-4 w-4" />
                  ) : notif.type === 'habit' ? (
                    <Sparkles className="h-4 w-4" />
                  ) : notif.type === 'goal' ? (
                    <Target className="h-4 w-4" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{notif.title}</h4>
                    {!notif.is_read && (
                      <span className="h-2 w-2 rounded-full bg-slate-900" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                    {notif.action_url && (
                      <Link
                        href={notif.action_url}
                        className="text-[11px] font-semibold text-slate-900 hover:underline flex items-center gap-1"
                      >
                        Lihat Detail <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {!notif.is_read && (
                  <button
                    onClick={() => handleMarkAsRead(notif.id)}
                    title="Tandai Dibaca"
                    className="p-1.5 text-slate-400 hover:text-slate-900 transition cursor-pointer"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                {activeCategory === 'archived' ? (
                  <button
                    onClick={() => handleUnarchive(notif.id)}
                    title="Kembalikan dari Arsip"
                    className="p-1.5 text-slate-400 hover:text-slate-900 transition cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleArchive(notif.id)}
                    title="Arsipkan / Tutup"
                    className="p-1.5 text-slate-400 hover:text-slate-900 transition cursor-pointer"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(notif.id)}
                  title="Hapus Permanen"
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NOTIFICATION PREFERENCES MODAL */}
      <Modal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        title="Preferensi Notifikasi & Jam Tenang"
        description="Atur jenis pengingat otomatis dan tentukan jam tenang agar tidak terganggu."
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setIsPreferencesOpen(false)}>
              Batal
            </Button>
            <Button loading={savingPrefs} onClick={handleSavePreferences}>
              Simpan Pengaturan
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Categories Toggle Grid */}
          <div className="space-y-2">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
              Kategori Pengingat Otomatis
            </span>
            <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {[
                { key: 'task_reminders', label: 'Pengingat Deadline Task (<24 jam)' },
                { key: 'project_reminders', label: 'Pengingat Deadline Proyek (<48 jam)' },
                { key: 'habit_reminders', label: 'Pengingat Kebiasaan Harian' },
                { key: 'goal_reminders', label: 'Pengingat Milestone Target (<72 jam)' },
                { key: 'exam_reminders', label: 'Pengingat Jadwal Ujian (<48 jam)' },
                { key: 'learning_reminders', label: 'Pengingat Sesi Belajar Rutin' },
              ].map((item) => (
                <label key={item.key} className="flex items-center justify-between cursor-pointer py-1">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={!!prefs[item.key]}
                    onChange={(e) => setPrefs({ ...prefs, [item.key]: e.target.checked })}
                    className="h-4 w-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="space-y-2">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Moon className="h-3.5 w-3.5 text-slate-500" />
              <span>Jam Tenang (Quiet Hours)</span>
            </span>
            <p className="text-[11px] text-slate-500">
              Sistem tidak akan mengirimkan pengingat selama rentang waktu ini.
            </p>
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Mulai Jam</label>
                <input
                  type="time"
                  value={prefs.quiet_hours_start || ''}
                  onChange={(e) => setPrefs({ ...prefs, quiet_hours_start: e.target.value })}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Berakhir Jam</label>
                <input
                  type="time"
                  value={prefs.quiet_hours_end || ''}
                  onChange={(e) => setPrefs({ ...prefs, quiet_hours_end: e.target.value })}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
