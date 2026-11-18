'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Target,
  Plus,
  Calendar,
  CheckCircle2,
  Trash2,
  ArrowRight,
  TrendingUp,
  Award,
  Edit2,
  Archive,
  RotateCcw,
  Check,
  Folder,
  CheckSquare,
} from 'lucide-react';
import api, { getCachedData } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { GoalsSkeleton } from '@/components/ui/Skeleton';

interface Milestone {
  id: number;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
  weight?: number;
  is_completed: boolean;
}

interface Goal {
  id: number;
  title: string;
  description?: string;
  type?: 'standard' | 'okr';
  confidence_level?: 'low' | 'medium' | 'high';
  start_date: string;
  target_date: string;
  status: 'not_started' | 'in_progress' | 'achieved' | 'abandoned';
  progress: number;
  is_archived?: boolean;
  milestones?: Milestone[];
  tasks?: { id: number; title: string; status: string }[];
  projects?: { id: number; title: string }[];
  tasks_count?: number;
  completed_tasks_count?: number;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>(() => getCachedData<Goal[]>('/goals') || []);
  const [loading, setLoading] = useState<boolean>(() => !getCachedData('/goals'));
  const [showArchived, setShowArchived] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedGoalForMilestone, setSelectedGoalForMilestone] = useState<Goal | null>(null);

  // Edit Goal State
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<'standard' | 'okr'>('standard');
  const [editConfidence, setEditConfidence] = useState<'low' | 'medium' | 'high'>('medium');
  const [editStartDate, setEditStartDate] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editStatus, setEditStatus] = useState<Goal['status']>('in_progress');
  const [savingEditGoal, setSavingEditGoal] = useState(false);

  // Create Goal Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalType, setGoalType] = useState<'standard' | 'okr'>('okr');
  const [confidenceLevel, setConfidenceLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  // Key Result / Milestone Form State
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneTarget, setMilestoneTarget] = useState('100');
  const [milestoneUnit, setMilestoneUnit] = useState('%');
  const [milestoneWeight, setMilestoneWeight] = useState('1.0');
  const [savingMilestone, setSavingMilestone] = useState(false);

  const fetchGoals = async (silent = false) => {
    try {
      if (!silent && goals.length === 0) {
        setLoading(true);
      }
      const res = await api.get(`/goals?archived=${showArchived ? 1 : 0}`);
      if (res.data?.success) {
        setGoals(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [showArchived]);

  const openEditGoalModal = (goal: Goal) => {
    setEditGoal(goal);
    setEditTitle(goal.title);
    setEditDescription(goal.description || '');
    setEditType(goal.type || 'standard');
    setEditConfidence(goal.confidence_level || 'medium');
    setEditStartDate(goal.start_date ? goal.start_date.split('T')[0] : '');
    setEditTargetDate(goal.target_date ? goal.target_date.split('T')[0] : '');
    setEditStatus(goal.status);
  };

  const handleSaveEditGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGoal || !editTitle.trim()) return;

    try {
      setSavingEditGoal(true);
      const res = await api.put(`/goals/${editGoal.id}`, {
        title: editTitle,
        description: editDescription,
        type: editType,
        confidence_level: editConfidence,
        start_date: editStartDate,
        target_date: editTargetDate,
        status: editStatus,
      });

      if (res.data?.success) {
        setEditGoal(null);
        fetchGoals();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEditGoal(false);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setSavingGoal(true);
      const res = await api.post('/goals', {
        title,
        description,
        type: goalType,
        confidence_level: confidenceLevel,
        start_date: startDate || new Date().toISOString().split('T')[0],
        target_date: targetDate || new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
      });

      if (res.data?.success) {
        setIsCreateOpen(false);
        setTitle('');
        setDescription('');
        setStartDate('');
        setTargetDate('');
        fetchGoals();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingGoal(false);
    }
  };

  const handleToggleArchive = async (goal: Goal) => {
    try {
      const res = await api.patch(`/goals/${goal.id}/archive`);
      if (res.data?.success) {
        setGoals((prev) => prev.filter((g) => g.id !== goal.id));
        fetchGoals(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalForMilestone || !milestoneTitle.trim()) return;

    try {
      setSavingMilestone(true);
      const res = await api.post(`/goals/${selectedGoalForMilestone.id}/milestones`, {
        title: milestoneTitle,
        target_value: parseFloat(milestoneTarget) || 100,
        current_value: 0,
        unit: milestoneUnit,
        weight: parseFloat(milestoneWeight) || 1.0,
      });

      if (res.data?.success) {
        setSelectedGoalForMilestone(null);
        setMilestoneTitle('');
        setMilestoneTarget('100');
        setMilestoneWeight('1.0');
        fetchGoals();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingMilestone(false);
    }
  };

  const handleUpdateMilestoneProgress = async (
    milestone: Milestone,
    newValue: number
  ) => {
    try {
      const res = await api.patch(`/milestones/${milestone.id}`, {
        current_value: newValue,
      });
      if (res.data?.success) {
        fetchGoals();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteGoal = async (id: number) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    try {
      await api.delete(`/goals/${id}`);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const getConfidenceBadge = (confidence?: string) => {
    switch (confidence) {
      case 'high':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">Confidence: High</span>;
      case 'low':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">Confidence: Low</span>;
      default:
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">Confidence: Medium</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Goals & OKRs</h2>
          <p className="mt-1 text-xs text-slate-500">
            Define objectives, measure quantifiable Key Results (KRs), and auto-calculate progress from linked tasks and milestones.
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
            New Objective
          </Button>
        </div>
      </div>

      {/* Goals Content */}
      {loading && goals.length === 0 ? (
        <GoalsSkeleton />
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title={showArchived ? 'No archived goals' : 'No goals or OKRs established'}
          description={showArchived ? 'You have no archived goals.' : 'Establish strategic goals and measurable Key Results to focus your productivity.'}
          actionLabel={showArchived ? undefined : 'Create Objective'}
          onAction={showArchived ? undefined : () => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map((goal) => {
            const milestones = goal.milestones || [];
            const isOkr = goal.type === 'okr';

            return (
              <div
                key={goal.id}
                className="group relative flex flex-col justify-between bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs hover:shadow-md transition-shadow space-y-5"
              >
                <div>
                  {/* Top: Status, OKR Tag, Confidence & Actions */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={goal.status === 'achieved' ? 'completed' : goal.status === 'in_progress' ? 'in_progress' : 'todo'}>
                        {goal.status.replace('_', ' ')}
                      </Badge>
                      {isOkr && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                          OKR
                        </span>
                      )}
                      {getConfidenceBadge(goal.confidence_level)}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditGoalModal(goal)}
                        className="p-1 text-slate-400 hover:text-slate-800 transition cursor-pointer"
                        title="Edit Objective"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleArchive(goal)}
                        className="p-1 text-slate-400 hover:text-amber-600 transition cursor-pointer"
                        title={goal.is_archived ? 'Restore' : 'Archive'}
                      >
                        {goal.is_archived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Delete Objective"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="mt-3">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-black transition">
                      {goal.title}
                    </h3>
                    {goal.description && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {goal.description}
                      </p>
                    )}
                  </div>

                  {/* Objective Overall Progress */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span>Progress Achieved</span>
                      <span className="font-bold text-slate-900">{goal.progress}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-900 rounded-full transition-all duration-300"
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Linked Tasks and Projects Summary */}
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-600 font-semibold">
                    <span className="flex items-center gap-1">
                      <CheckSquare className="h-3.5 w-3.5 text-slate-400" />
                      {goal.completed_tasks_count || 0}/{goal.tasks_count || goal.tasks?.length || 0} Linked Tasks
                    </span>
                    {goal.projects && goal.projects.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Folder className="h-3.5 w-3.5 text-slate-400" />
                        {goal.projects.length} Linked Projects
                      </span>
                    )}
                  </div>

                  {/* Key Results / Milestones Section */}
                  <div className="mt-5 pt-3 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Key Results & Milestones ({milestones.length})
                      </span>
                      <button
                        onClick={() => setSelectedGoalForMilestone(goal)}
                        className="text-xs font-bold text-slate-800 hover:text-black flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" /> Add Key Result
                      </button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {milestones.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-1">No Key Results added yet.</p>
                      ) : (
                        milestones.map((m) => {
                          const ratio = m.target_value > 0 ? Math.min(100, Math.round((m.current_value / m.target_value) * 100)) : 0;
                          return (
                            <div
                              key={m.id}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-800 truncate max-w-[200px]">
                                  {m.title}
                                </span>
                                <span className="font-semibold text-slate-600">
                                  {m.current_value} / {m.target_value} {m.unit} ({ratio}%)
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min={0}
                                  max={m.target_value}
                                  step={m.target_value > 10 ? 1 : 0.1}
                                  value={m.current_value}
                                  onChange={(e) => handleUpdateMilestoneProgress(m, parseFloat(e.target.value))}
                                  className="flex-1 accent-slate-900 cursor-pointer h-1.5"
                                />
                                {m.weight && m.weight !== 1 && (
                                  <span className="text-[10px] text-slate-400 font-bold shrink-0">
                                    w:{m.weight}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Horizon */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      Target: {new Date(goal.target_date).toLocaleDateString()}
                    </span>
                  </div>

                  <Link
                    href={`/tasks?goal_id=${goal.id}`}
                    className="font-bold text-slate-800 hover:text-black transition"
                  >
                    View Tasks →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE GOAL MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Objective"
        maxWidth="md"
      >
        <form onSubmit={handleCreateGoal} className="space-y-4">
          <Input
            label="Objective Title"
            placeholder="e.g. Scale Monthly Active Users to 100K"
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
              placeholder="Strategic rationale and desired impact..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Goal Framework
              </label>
              <select
                value={goalType}
                onChange={(e) => setGoalType(e.target.value as any)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="okr">OKR (Objectives & Key Results)</option>
                <option value="standard">Standard Milestone Goal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Confidence Level
              </label>
              <select
                value={confidenceLevel}
                onChange={(e) => setConfidenceLevel(e.target.value as any)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="high">🟢 High (Committed)</option>
                <option value="medium">🟡 Medium (Target)</option>
                <option value="low">🔴 Low (Aspirational / Stretch)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="Target Date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={savingGoal} className="bg-slate-900 text-white hover:bg-black">
              Create Objective
            </Button>
          </div>
        </form>
      </Modal>

      {/* ADD KEY RESULT / MILESTONE MODAL */}
      <Modal
        isOpen={!!selectedGoalForMilestone}
        onClose={() => setSelectedGoalForMilestone(null)}
        title={`Add Key Result to: ${selectedGoalForMilestone?.title}`}
        maxWidth="md"
      >
        <form onSubmit={handleAddMilestone} className="space-y-4">
          <Input
            label="Key Result Title"
            placeholder="e.g. Publish 10 Technical Articles"
            value={milestoneTitle}
            onChange={(e) => setMilestoneTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Target Value"
              type="number"
              value={milestoneTarget}
              onChange={(e) => setMilestoneTarget(e.target.value)}
              required
            />
            <Input
              label="Unit"
              placeholder="e.g. %, users, articles"
              value={milestoneUnit}
              onChange={(e) => setMilestoneUnit(e.target.value)}
              required
            />
            <Input
              label="Weight"
              type="number"
              step="0.1"
              value={milestoneWeight}
              onChange={(e) => setMilestoneWeight(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setSelectedGoalForMilestone(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={savingMilestone} className="bg-slate-900 text-white hover:bg-black">
              Add Key Result
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT GOAL MODAL */}
      {editGoal && (
        <Modal
          isOpen={!!editGoal}
          onClose={() => setEditGoal(null)}
          title="Edit Objective"
          maxWidth="md"
        >
          <form onSubmit={handleSaveEditGoal} className="space-y-4">
            <Input
              label="Title"
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
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Framework
                </label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-900 focus:outline-none"
                >
                  <option value="okr">OKR</option>
                  <option value="standard">Standard</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confidence
                </label>
                <select
                  value={editConfidence}
                  onChange={(e) => setEditConfidence(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-900 focus:outline-none"
                >
                  <option value="high">🟢 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🔴 Low</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Start Date"
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
              />
              <Input
                label="Target Date"
                type="date"
                value={editTargetDate}
                onChange={(e) => setEditTargetDate(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setEditGoal(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={savingEditGoal} className="bg-slate-900 text-white hover:bg-black">
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
