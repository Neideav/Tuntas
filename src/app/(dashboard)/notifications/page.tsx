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
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [scanning, setScanning] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async (type?: string) => {
    setLoading(true);
    try {
      const params: any = {};
      if (type && type !== 'all') params.type = type;

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

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const categories = [
    { id: 'all', label: 'All Notifications' },
    { id: 'deadline', label: 'Deadlines', icon: Clock },
    { id: 'exam', label: 'Exams', icon: GraduationCap },
    { id: 'habit', label: 'Habits', icon: Sparkles },
    { id: 'system', label: 'System', icon: Info },
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
                {unreadCount} New
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Real-time activity alerts, deadline reminders, and examination countdown warnings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="secondary"
            loading={scanning}
            onClick={handleCheckReminders}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Scan Deadlines
          </Button>

          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkAllRead}
              leftIcon={<CheckCheck className="h-4 w-4" />}
            >
              Mark all as read
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
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeCategory === cat.id
                ? 'bg-sky-600 text-white shadow-xs'
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications in this category"
          description="You're all caught up! New reminders and task updates will appear here."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`flex items-start justify-between gap-4 p-4 rounded-2xl border transition ${
                notif.is_read
                  ? 'bg-white border-slate-200/80 shadow-2xs'
                  : 'bg-sky-50/50 border-sky-200 shadow-sm'
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
                      : 'bg-sky-50 text-sky-600'
                  }`}
                >
                  {notif.type === 'deadline' ? (
                    <Clock className="h-4 w-4" />
                  ) : notif.type === 'exam' ? (
                    <GraduationCap className="h-4 w-4" />
                  ) : notif.type === 'habit' ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{notif.title}</h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {notif.type}
                    </span>
                    {!notif.is_read && (
                      <span className="h-2 w-2 rounded-full bg-sky-500" />
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
                        className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                      >
                        View Details <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {!notif.is_read && (
                  <button
                    onClick={() => handleMarkAsRead(notif.id)}
                    title="Mark as Read"
                    className="p-1.5 text-slate-400 hover:text-sky-600 transition"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(notif.id)}
                  title="Delete"
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
