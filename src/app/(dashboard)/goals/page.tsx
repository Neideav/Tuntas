'use client';

import React, { useEffect, useState } from 'react';
import {
  Target,
  Plus,
  Calendar,
  CheckCircle2,
  Trash2,
  ArrowRight,
  TrendingUp,
  Award,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

interface Milestone {
  id: number;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
  is_completed: boolean;
}

interface Goal {
  id: number;
  title: string;
  description?: string;
  start_date: string;
  target_date: string;
  status: 'not_started' | 'in_progress' | 'achieved' | 'abandoned';
  progress: number;
  milestones?: Milestone[];
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedGoalForMilestone, setSelectedGoalForMilestone] = useState<Goal | null>(null);

  // Goal Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  // Milestone Form
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneTarget, setMilestoneTarget] = useState('100');
  const [milestoneUnit, setMilestoneUnit] = useState('%');
  const [savingMilestone, setSavingMilestone] = useState(false);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const res = await api.get('/goals');
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
  }, []);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !targetDate) return;

    try {
      setSavingGoal(true);
      const res = await api.post('/goals', {
        title,
        description,
        start_date: startDate,
        target_date: targetDate,
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
      });

      if (res.data?.success) {
        setSelectedGoalForMilestone(null);
        setMilestoneTitle('');
        setMilestoneTarget('100');
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

  const getStatusBadge = (status: Goal['status']) => {
    switch (status) {
      case 'achieved':
        return <Badge variant="completed">Achieved</Badge>;
      case 'in_progress':
        return <Badge variant="in_progress">In Progress</Badge>;
      case 'abandoned':
        return <Badge variant="urgent">Abandoned</Badge>;
      default:
        return <Badge variant="todo">Not Started</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Goals & OKRs</h2>
          <p className="mt-1 text-xs text-slate-500">
            Define objectives, measure quantifiable key results, and monitor achievement milestones.
          </p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
          className="shrink-0"
        >
          New Objective
        </Button>
      </div>

      {/* Goals Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals set"
          description="Establish your first objective with measurable key result milestones."
          actionLabel="Create Objective"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="space-y-5">
          {goals.map((goal) => {
            const milestones = goal.milestones || [];
            const completedMilestones = milestones.filter((m) => m.is_completed).length;

            return (
              <div
                key={goal.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition space-y-5"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      {getStatusBadge(goal.status)}
                      <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        Target: {new Date(goal.target_date).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{goal.title}</h3>
                    {goal.description && (
                      <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                        {goal.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() => setSelectedGoalForMilestone(goal)}
                    >
                      Add Key Result
                    </Button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="text-slate-300 hover:text-red-500 p-1.5 transition"
                      title="Delete Goal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-sky-600" /> Overall Progress
                    </span>
                    <span className="font-bold text-sky-700">{goal.progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        goal.progress >= 100 ? 'bg-emerald-500' : 'bg-sky-500'
                      }`}
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>

                {/* Milestones / Key Results Section */}
                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <span>Key Results ({completedMilestones}/{milestones.length})</span>
                  </div>

                  {milestones.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {milestones.map((m) => {
                        const ratio = m.target_value > 0 ? Math.min(100, Math.round((m.current_value / m.target_value) * 100)) : 0;
                        return (
                          <div
                            key={m.id}
                            className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-bold text-slate-800 leading-snug">
                                {m.title}
                              </span>
                              <span className="text-[11px] font-bold text-slate-600 shrink-0">
                                {m.current_value} / {m.target_value} {m.unit}
                              </span>
                            </div>

                            {/* Slider / Value input */}
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min={0}
                                max={m.target_value}
                                value={m.current_value}
                                onChange={(e) =>
                                  handleUpdateMilestoneProgress(m, parseFloat(e.target.value))
                                }
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                              />
                              <span className="text-[10px] font-bold text-sky-600 w-8 text-right">
                                {ratio}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      No key results added yet. Click &quot;Add Key Result&quot; to establish measurable milestones.
                    </p>
                  )}
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
        title="Create Objective"
        description="Establish an ambitious goal with target timeline."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button loading={savingGoal} onClick={handleCreateGoal}>
              Save Objective
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateGoal} className="space-y-4">
          <Input
            label="Objective Title"
            placeholder="e.g. Master Distributed Systems Architecture"
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
              placeholder="Why is this objective important?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="Target Date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>

      {/* ADD KEY RESULT MILESTONE MODAL */}
      {selectedGoalForMilestone && (
        <Modal
          isOpen={!!selectedGoalForMilestone}
          onClose={() => setSelectedGoalForMilestone(null)}
          title="Add Key Result"
          description={`Add a measurable target for "${selectedGoalForMilestone.title}"`}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setSelectedGoalForMilestone(null)}
              >
                Cancel
              </Button>
              <Button loading={savingMilestone} onClick={handleAddMilestone}>
                Add Key Result
              </Button>
            </>
          }
        >
          <form onSubmit={handleAddMilestone} className="space-y-4">
            <Input
              label="Key Result Title"
              placeholder="e.g. Complete 5 Practice Labs"
              value={milestoneTitle}
              onChange={(e) => setMilestoneTitle(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Target Numeric Value"
                type="number"
                min="0.1"
                step="any"
                value={milestoneTarget}
                onChange={(e) => setMilestoneTarget(e.target.value)}
                required
              />

              <Input
                label="Unit Label"
                placeholder="e.g. %, labs, books"
                value={milestoneUnit}
                onChange={(e) => setMilestoneUnit(e.target.value)}
                required
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

