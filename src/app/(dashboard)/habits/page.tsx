'use client';

import React, { useEffect, useState } from 'react';
import {
  Flame,
  Shield,
  Plus,
  Check,
  Calendar,
  Sparkles,
  Award,
  Trash2,
  Snowflake,
  Edit2,
  History,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

interface Habit {
  id: number;
  title: string;
  description?: string;
  frequency: 'daily' | 'weekdays' | 'weekly';
  target_count: number;
  current_streak: number;
  best_streak: number;
  freeze_tokens: number;
  is_completed_today?: boolean;
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFreezeModalOpen, setIsFreezeModalOpen] = useState<Habit | null>(null);
  const [freezeDate, setFreezeDate] = useState('');
  const [freezeError, setFreezeError] = useState<string | null>(null);

  // Edit Habit State
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editFrequency, setEditFrequency] = useState<'daily' | 'weekdays' | 'weekly'>('daily');
  const [savingEdit, setSavingEdit] = useState(false);

  // History State
  const [historyHabit, setHistoryHabit] = useState<Habit | null>(null);
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Create Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekdays' | 'weekly'>('daily');
  const [freezeTokens, setFreezeTokens] = useState(2);
  const [saving, setSaving] = useState(false);

  const fetchHabits = async () => {
    try {
      setLoading(true);
      const res = await api.get('/habits');
      if (res.data?.success) {
        setHabits(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHabits();
  }, []);

  const handleToggle = async (habitId: number) => {
    try {
      const res = await api.post(`/habits/${habitId}/toggle`);
      if (res.data?.success) {
        setHabits((prev) =>
          prev.map((h) =>
            h.id === habitId
              ? {
                  ...h,
                  is_completed_today: !h.is_completed_today,
                  current_streak: res.data.data.habit.current_streak,
                  best_streak: res.data.data.habit.best_streak,
                }
              : h
          )
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setSaving(true);
      const res = await api.post('/habits', {
        title,
        description,
        frequency,
        freeze_tokens: freezeTokens,
      });

      if (res.data?.success) {
        setIsCreateOpen(false);
        setTitle('');
        setDescription('');
        setFrequency('daily');
        setFreezeTokens(2);
        fetchHabits();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (habit: Habit) => {
    setEditHabit(habit);
    setEditTitle(habit.title);
    setEditDescription(habit.description || '');
    setEditFrequency(habit.frequency);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editHabit || !editTitle.trim()) return;

    try {
      setSavingEdit(true);
      const res = await api.put(`/habits/${editHabit.id}`, {
        title: editTitle,
        description: editDescription,
        frequency: editFrequency,
      });

      if (res.data?.success) {
        setEditHabit(null);
        fetchHabits();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  const openHistoryModal = async (habit: Habit) => {
    setHistoryHabit(habit);
    setHistoryData(null);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/habits/${habit.id}/history`);
      if (res.data?.success) {
        setHistoryData(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleApplyFreeze = async () => {
    if (!isFreezeModalOpen || !freezeDate) return;
    setFreezeError(null);
    try {
      const res = await api.post(`/habits/${isFreezeModalOpen.id}/freeze`, {
        date: freezeDate,
      });
      if (res.data?.success) {
        setIsFreezeModalOpen(null);
        setFreezeDate('');
        fetchHabits();
      }
    } catch (err: any) {
      setFreezeError(err.response?.data?.message || 'Could not apply freeze token.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this habit?')) return;
    try {
      await api.delete(`/habits/${id}`);
      setHabits((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Habit Tracker</h2>
          <p className="mt-1 text-xs text-slate-500">
            Build consistency, protect your streak with freeze shields, and track productive daily routines.
          </p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
          className="shrink-0"
        >
          New Habit
        </Button>
      </div>

      {/* Habits Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
        </div>
      ) : habits.length === 0 ? (
        <EmptyState
          icon={Flame}
          title="No habits yet"
          description="Create your first habit like 'Daily LeetCode Problem' or 'Morning Reading' to start tracking streaks."
          actionLabel="Create Habit"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {habits.map((habit) => (
            <div
              key={habit.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header: Title, Edit & Delete */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {habit.frequency}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {habit.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(habit)}
                      title="Edit Habit"
                      className="text-slate-300 hover:text-sky-600 p-1 transition cursor-pointer"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(habit.id)}
                      title="Delete Habit"
                      className="text-slate-300 hover:text-rose-500 p-1 transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {habit.description && (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {habit.description}
                  </p>
                )}

                {/* Streak Metric Banner */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <Flame className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Streak</p>
                      <p className="text-sm font-bold text-slate-900">{habit.current_streak} days</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                      <Award className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Best</p>
                      <p className="text-sm font-bold text-slate-900">{habit.best_streak} days</p>
                    </div>
                  </div>
                </div>

                {/* Freeze Tokens Shield */}
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Shield className="h-3.5 w-3.5 text-sky-500" />
                    <span>Freeze Shields: {habit.freeze_tokens}</span>
                  </div>
                  {habit.freeze_tokens > 0 && (
                    <button
                      onClick={() => {
                        setFreezeError(null);
                        setIsFreezeModalOpen(habit);
                      }}
                      className="text-[11px] font-bold text-sky-600 hover:text-sky-700 underline cursor-pointer"
                    >
                      Use Shield
                    </button>
                  )}
                </div>

                {/* History & Consistency link */}
                <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => openHistoryModal(habit)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-sky-600 transition cursor-pointer"
                  >
                    <History className="h-3.5 w-3.5 text-slate-400" />
                    <span>View History & Consistency</span>
                  </button>
                </div>
              </div>

              {/* Check-in Action Button */}
              <button
                onClick={() => handleToggle(habit.id)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs ${
                  habit.is_completed_today
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {habit.is_completed_today ? (
                  <>
                    <Check className="h-4 w-4" /> Completed Today
                  </>
                ) : (
                  <>Check-in Today</>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* CREATE HABIT MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Habit"
        description="Configure your routine frequency and freeze protection tokens."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleCreate}>
              Save Habit
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Habit Title"
            placeholder="e.g. Read 20 Pages of System Design"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Why is this habit important to you?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays Only</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <Input
              label="Starting Freeze Shields"
              type="number"
              min={0}
              max={10}
              value={freezeTokens}
              onChange={(e) => setFreezeTokens(parseInt(e.target.value) || 0)}
            />
          </div>
        </form>
      </Modal>

      {/* EDIT HABIT MODAL */}
      {editHabit && (
        <Modal
          isOpen={!!editHabit}
          onClose={() => setEditHabit(null)}
          title="Edit Habit"
          description={`Update details and cadence for "${editHabit.title}".`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditHabit(null)}>
                Cancel
              </Button>
              <Button loading={savingEdit} onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <Input
              label="Habit Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Description
              </label>
              <textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Frequency
              </label>
              <select
                value={editFrequency}
                onChange={(e) => setEditFrequency(e.target.value as any)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays Only</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </form>
        </Modal>
      )}

      {/* HABIT HISTORY & CONSISTENCY MODAL */}
      {historyHabit && (
        <Modal
          isOpen={!!historyHabit}
          onClose={() => setHistoryHabit(null)}
          title={`Consistency & History`}
          description={`Performance analytics and check-in timeline for "${historyHabit.title}".`}
          footer={
            <Button size="sm" onClick={() => setHistoryHabit(null)}>
              Close
            </Button>
          }
        >
          {loadingHistory ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading history...</div>
          ) : historyData ? (
            <div className="space-y-4">
              {/* Stats overview banner */}
              <div className="grid grid-cols-3 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Consistency</span>
                  <span className="text-base font-bold text-sky-600">
                    {historyData.statistics?.consistency_rate || 0}%
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Current Streak</span>
                  <span className="text-base font-bold text-amber-600">
                    {historyData.statistics?.current_streak || 0} d
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Checked</span>
                  <span className="text-base font-bold text-emerald-600">
                    {historyData.statistics?.total_completions || 0}
                  </span>
                </div>
              </div>

              {/* Logs Timeline */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Recent Check-ins ({historyData.logs?.length || 0})
                </span>
                {historyData.logs && historyData.logs.length > 0 ? (
                  historyData.logs.slice().reverse().map((log: any) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-white text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-800">
                          {new Date(log.log_date).toLocaleDateString(undefined, {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div>
                        {log.is_completed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <Check className="h-3 w-3" /> Completed
                          </span>
                        ) : log.is_frozen ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md">
                            <Shield className="h-3 w-3" /> Shielded
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
                            Missed
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">
                    No check-ins recorded yet. Check-in daily to build your activity history.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic py-4">Could not load habit history.</p>
          )}
        </Modal>
      )}

      {/* USE FREEZE TOKEN MODAL */}
      {isFreezeModalOpen && (
        <Modal
          isOpen={!!isFreezeModalOpen}
          onClose={() => setIsFreezeModalOpen(null)}
          title="Apply Streak Freeze Shield"
          description={`Protect streak for "${isFreezeModalOpen.title}" on a missed day.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsFreezeModalOpen(null)}>
                Cancel
              </Button>
              <Button onClick={handleApplyFreeze}>Apply Freeze</Button>
            </>
          }
        >
          <div className="space-y-4">
            {freezeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{freezeError}</span>
              </div>
            )}
            <p className="text-xs text-slate-600">
              Applying a freeze shield consumes 1 shield token and preserves your active streak on the chosen date.
            </p>
            <Input
              label="Missed Date"
              type="date"
              value={freezeDate}
              onChange={(e) => setFreezeDate(e.target.value)}
              required
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

