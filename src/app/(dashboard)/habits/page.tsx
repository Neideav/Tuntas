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
  Archive,
  RotateCcw,
} from 'lucide-react';
import api, { getCachedData } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { HabitsSkeleton } from '@/components/ui/Skeleton';

interface HabitLog {
  id: number;
  log_date: string;
  value: number;
  is_completed: boolean;
  used_freeze: boolean;
}

interface Habit {
  id: number;
  title: string;
  description?: string;
  frequency: 'daily' | 'weekdays' | 'weekly';
  habit_type?: 'boolean' | 'numeric';
  target_count: number;
  target_value?: number;
  selected_days?: number[];
  unit?: string;
  current_streak: number;
  best_streak: number;
  freeze_tokens: number;
  is_archived?: boolean;
  is_completed_today?: boolean;
  today_log?: HabitLog;
}

const DAYS_OF_WEEK = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 0, label: 'Sun' },
];

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>(() => getCachedData<Habit[]>('/habits') || []);
  const [loading, setLoading] = useState<boolean>(() => !getCachedData('/habits'));
  const [showArchived, setShowArchived] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFreezeModalOpen, setIsFreezeModalOpen] = useState<Habit | null>(null);
  const [freezeDate, setFreezeDate] = useState('');
  const [freezeError, setFreezeError] = useState<string | null>(null);

  // Edit Habit State
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editFrequency, setEditFrequency] = useState<'daily' | 'weekdays' | 'weekly'>('daily');
  const [editHabitType, setEditHabitType] = useState<'boolean' | 'numeric'>('boolean');
  const [editTargetValue, setEditTargetValue] = useState('1');
  const [editUnit, setEditUnit] = useState('');
  const [editSelectedDays, setEditSelectedDays] = useState<number[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // History State
  const [historyHabit, setHistoryHabit] = useState<Habit | null>(null);
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Create Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekdays' | 'weekly'>('daily');
  const [habitType, setHabitType] = useState<'boolean' | 'numeric'>('boolean');
  const [targetValue, setTargetValue] = useState('1');
  const [unit, setUnit] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [freezeTokens, setFreezeTokens] = useState(2);
  const [saving, setSaving] = useState(false);

  const fetchHabits = async (silent = false) => {
    try {
      if (!silent && habits.length === 0) {
        setLoading(true);
      }
      const res = await api.get(`/habits?archived=${showArchived ? 1 : 0}`);
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
  }, [showArchived]);

  const handleToggle = async (habitId: number, numericValue?: number) => {
    try {
      const payload: any = {};
      if (numericValue !== undefined) {
        payload.numeric_value = numericValue;
      }

      const res = await api.post(`/habits/${habitId}/toggle`, payload);
      if (res.data?.success) {
        const updatedHabit = res.data.data.habit;
        const updatedLog = res.data.data.log;

        setHabits((prev) =>
          prev.map((h) =>
            h.id === habitId
              ? {
                  ...h,
                  is_completed_today: updatedLog.is_completed,
                  current_streak: updatedHabit.current_streak,
                  best_streak: updatedHabit.best_streak,
                  today_log: updatedLog,
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
        habit_type: habitType,
        target_value: habitType === 'numeric' ? Number(targetValue) : 1,
        unit: habitType === 'numeric' ? unit : null,
        selected_days: selectedDays.length > 0 ? selectedDays : null,
        freeze_tokens: freezeTokens,
      });

      if (res.data?.success) {
        setIsCreateOpen(false);
        setTitle('');
        setDescription('');
        setFrequency('daily');
        setHabitType('boolean');
        setTargetValue('1');
        setUnit('');
        setSelectedDays([]);
        setFreezeTokens(2);
        fetchHabits();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Could not create habit.');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (habit: Habit) => {
    setEditHabit(habit);
    setEditTitle(habit.title);
    setEditDescription(habit.description || '');
    setEditFrequency(habit.frequency);
    setEditHabitType(habit.habit_type || 'boolean');
    setEditTargetValue(habit.target_value ? String(habit.target_value) : '1');
    setEditUnit(habit.unit || '');
    setEditSelectedDays(habit.selected_days || []);
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
        habit_type: editHabitType,
        target_value: editHabitType === 'numeric' ? Number(editTargetValue) : 1,
        unit: editHabitType === 'numeric' ? editUnit : null,
        selected_days: editSelectedDays.length > 0 ? editSelectedDays : null,
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

  const handleToggleArchive = async (habit: Habit) => {
    try {
      const res = await api.put(`/habits/${habit.id}`, {
        is_archived: !habit.is_archived,
      });
      if (res.data?.success) {
        setHabits((prev) => prev.filter((h) => h.id !== habit.id));
        fetchHabits(true);
      }
    } catch (err) {
      console.error(err);
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
            Build consistency, protect streaks with freeze shields, and measure daily routines with targets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Active vs Archived Filter Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setShowArchived(false)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                !showArchived ? 'bg-slate-900 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setShowArchived(true)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                showArchived ? 'bg-slate-900 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Archived
            </button>
          </div>

          <Button
            onClick={() => setIsCreateOpen(true)}
            leftIcon={<Plus className="h-4 w-4" />}
            className="bg-slate-900 text-white hover:bg-black"
          >
            New Habit
          </Button>
        </div>
      </div>

      {/* Habits Grid */}
      {loading && habits.length === 0 ? (
        <HabitsSkeleton />
      ) : habits.length === 0 ? (
        <EmptyState
          icon={Flame}
          title={showArchived ? 'No archived habits' : 'No habits tracked yet'}
          description={showArchived ? 'You have no archived habits.' : 'Start building daily momentum by creating your first habit.'}
          actionLabel={showArchived ? undefined : 'Create Habit'}
          onAction={showArchived ? undefined : () => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {habits.map((habit) => {
            const isNumeric = habit.habit_type === 'numeric';
            const targetVal = habit.target_value || habit.target_count || 1;
            const currentVal = habit.today_log?.value || 0;
            const progressPct = Math.min(100, Math.round((currentVal / targetVal) * 100));

            return (
              <div
                key={habit.id}
                className="group relative flex flex-col justify-between bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-md transition-shadow space-y-4"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 uppercase tracking-wider px-2 py-0.5 rounded-md">
                        {habit.frequency}
                      </span>
                      {isNumeric && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">
                          Target {targetVal} {habit.unit}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openHistoryModal(habit)}
                        className="p-1 text-slate-400 hover:text-slate-900 transition cursor-pointer"
                        title="View Consistency History"
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openEditModal(habit)}
                        className="p-1 text-slate-400 hover:text-slate-900 transition cursor-pointer"
                        title="Edit Habit"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleArchive(habit)}
                        className="p-1 text-slate-400 hover:text-amber-600 transition cursor-pointer"
                        title={habit.is_archived ? 'Restore' : 'Archive'}
                      >
                        {habit.is_archived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDelete(habit.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Delete Habit"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="mt-3">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-black transition">
                      {habit.title}
                    </h3>
                    {habit.description && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {habit.description}
                      </p>
                    )}
                  </div>

                  {/* Custom Schedule Days Badges */}
                  {habit.selected_days && habit.selected_days.length > 0 && (
                    <div className="flex items-center gap-1 mt-2.5 flex-wrap">
                      {DAYS_OF_WEEK.map((d) => {
                        const isScheduled = habit.selected_days?.includes(d.id);
                        return (
                          <span
                            key={d.id}
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              isScheduled ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {d.label}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Numeric Target Progress Bar */}
                  {isNumeric && (
                    <div className="mt-3.5 space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span>Today&apos;s Progress</span>
                        <span className="font-bold text-slate-900">
                          {currentVal} / {targetVal} {habit.unit} ({progressPct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-900 rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Streak & Freeze Status Counters */}
                  <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                        <Flame className="h-4 w-4 fill-orange-500" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Streak
                        </span>
                        <span className="text-sm font-black text-slate-900">
                          {habit.current_streak} days
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600">
                        <Shield className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Shields
                        </span>
                        <span className="text-sm font-black text-slate-900">
                          {habit.freeze_tokens} left
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions: Log Measurement / Complete Button */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setIsFreezeModalOpen(habit)}
                    disabled={habit.freeze_tokens <= 0}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-cyan-700 disabled:opacity-40 transition cursor-pointer"
                  >
                    <Snowflake className="h-3.5 w-3.5 text-cyan-600" />
                    <span>Freeze Token</span>
                  </button>

                  {isNumeric ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="Log value"
                        defaultValue={currentVal || ''}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = Number((e.target as HTMLInputElement).value);
                            handleToggle(habit.id, val);
                          }
                        }}
                        className="w-20 h-9 px-2 text-xs font-semibold rounded-xl border border-slate-200 text-center focus:outline-none focus:border-slate-900"
                      />
                      <button
                        onClick={() => handleToggle(habit.id, habit.is_completed_today ? 0 : targetVal)}
                        className={`h-9 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                          habit.is_completed_today
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-900 text-white hover:bg-black'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{habit.is_completed_today ? 'Done' : 'Target'}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleToggle(habit.id)}
                      className={`h-9 px-4 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        habit.is_completed_today
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-900 text-white hover:bg-black'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{habit.is_completed_today ? 'Completed' : 'Check Today'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE HABIT MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Habit"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Habit Title"
            placeholder="e.g. Read 20 Pages of Book"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Why is this routine important?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Habit Type
              </label>
              <select
                value={habitType}
                onChange={(e) => setHabitType(e.target.value as any)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="boolean">Checkmark (Yes / No)</option>
                <option value="numeric">Numeric Measurement Target</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="daily">Daily (Every Day)</option>
                <option value="weekdays">Weekdays (Mon-Fri)</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>

          {habitType === 'numeric' && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <Input
                label="Target Value"
                type="number"
                placeholder="e.g. 2000"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                required
              />
              <Input
                label="Unit of Measurement"
                placeholder="e.g. ml, pages, steps"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
              />
            </div>
          )}

          {/* Custom Scheduled Days */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Scheduled Days (Optional Custom Schedule)
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {DAYS_OF_WEEK.map((d) => {
                const isSelected = selectedDays.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setSelectedDays((prev) =>
                        prev.includes(d.id) ? prev.filter((id) => id !== d.id) : [...prev, d.id]
                      );
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Initial Streak Freeze Shields
            </label>
            <Input
              type="number"
              min={0}
              max={10}
              value={freezeTokens}
              onChange={(e) => setFreezeTokens(Number(e.target.value))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="bg-slate-900 text-white hover:bg-black">
              Create Habit
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT HABIT MODAL */}
      {editHabit && (
        <Modal
          isOpen={!!editHabit}
          onClose={() => setEditHabit(null)}
          title="Edit Habit"
          maxWidth="md"
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
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Habit Type
                </label>
                <select
                  value={editHabitType}
                  onChange={(e) => setEditHabitType(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-900 focus:outline-none"
                >
                  <option value="boolean">Checkmark</option>
                  <option value="numeric">Numeric Target</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Frequency
                </label>
                <select
                  value={editFrequency}
                  onChange={(e) => setEditFrequency(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-900 focus:outline-none"
                >
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setEditHabit(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={savingEdit} className="bg-slate-900 text-white hover:bg-black">
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* FREEZE TOKEN MODAL */}
      {isFreezeModalOpen && (
        <Modal
          isOpen={!!isFreezeModalOpen}
          onClose={() => setIsFreezeModalOpen(null)}
          title="Apply Streak Freeze Shield"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Protect your streak for a missed date. Freeze shields bridge gaps without breaking your momentum.
            </p>

            <Input
              label="Missed Date"
              type="date"
              max={new Date().toISOString().split('T')[0]}
              value={freezeDate}
              onChange={(e) => setFreezeDate(e.target.value)}
            />

            {freezeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{freezeError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setIsFreezeModalOpen(null)}>
                Cancel
              </Button>
              <Button onClick={handleApplyFreeze} className="bg-slate-900 text-white hover:bg-black">
                Apply Freeze Shield
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* HISTORY MODAL */}
      {historyHabit && (
        <Modal
          isOpen={!!historyHabit}
          onClose={() => setHistoryHabit(null)}
          title={`Consistency Analytics: ${historyHabit.title}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            {loadingHistory ? (
              <p className="text-xs text-slate-500 py-6 text-center">Loading analytics...</p>
            ) : historyData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Current Streak</span>
                    <p className="text-xl font-black text-slate-900 mt-0.5">{historyData.statistics?.current_streak} days</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Best Record</span>
                    <p className="text-xl font-black text-slate-900 mt-0.5">{historyData.statistics?.best_streak} days</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Consistency Rate</span>
                    <p className="text-xl font-black text-slate-900 mt-0.5">{historyData.statistics?.consistency_rate}%</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2">Completion Log Heatmap (Last 60 Days)</h4>
                  <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto p-2 rounded-xl bg-slate-50 border border-slate-200">
                    {historyData.logs?.map((log: any) => (
                      <div
                        key={log.id}
                        title={`${log.log_date}: ${log.is_completed ? 'Completed' : log.used_freeze ? 'Freeze Applied' : 'Incomplete'}`}
                        className={`h-5 w-5 rounded text-[9px] flex items-center justify-center font-bold ${
                          log.is_completed
                            ? 'bg-emerald-500 text-white'
                            : log.used_freeze
                            ? 'bg-cyan-500 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {new Date(log.log_date).getDate()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setHistoryHabit(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
