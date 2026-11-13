'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Flame,
  FolderKanban,
  GraduationCap,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Calendar,
  Layers,
  Award,
  BookOpen,
} from 'lucide-react';
import api, { extractApiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { AnimatedNumber, StaggerContainer, StaggerItem, FadeIn } from '@/components/animations';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/analytics/productivity');
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err: unknown) {
      setError(extractApiErrorMessage(err, 'Failed to load productivity analytics.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
          <p className="text-xs font-semibold text-slate-500">Aggregating cross-platform analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Analytics Unavailable</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">{error || 'Could not retrieve data.'}</p>
        <Button onClick={fetchAnalytics} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
          Retry Calculation
        </Button>
      </div>
    );
  }

  const tasks = data.tasks || {};
  const projects = data.projects || {};
  const habits = data.habits || {};
  const learning = data.learning || {};
  const exams = data.examinations || {};

  const priorityColors: Record<string, string> = {
    urgent: 'bg-rose-500',
    high: 'bg-amber-500',
    medium: 'bg-sky-500',
    low: 'bg-slate-400',
  };

  const statusColors: Record<string, string> = {
    todo: 'bg-slate-300',
    in_progress: 'bg-sky-500',
    in_review: 'bg-amber-500',
    completed: 'bg-emerald-500',
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-bold uppercase tracking-wider">
              Productivity Intelligence
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cross-Domain Analytics</h1>
          <p className="mt-1 text-xs text-slate-500">
            Real-time authoritative telemetry across Tasks, Projects, Habits, LMS, and Examinations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Top 5 High-Level KPI Cards */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Tasks */}
        <StaggerItem className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Tasks</span>
            <CheckCircle2 className="h-4 w-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            <AnimatedNumber value={tasks.total || 0} />
          </div>
          <p className="text-[11px] text-slate-400">
            {tasks.completed || 0} completed ({tasks.completion_rate || 0}%)
          </p>
        </StaggerItem>

        {/* Active Projects */}
        <StaggerItem className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Active Projects</span>
            <FolderKanban className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            <AnimatedNumber value={projects.active || 0} />
          </div>
          <p className="text-[11px] text-slate-400">
            Avg {projects.avg_progress || 0}% progress
          </p>
        </StaggerItem>

        {/* Habit Consistency */}
        <StaggerItem className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Habit Consistency</span>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            <AnimatedNumber value={habits.completion_rate_30_days || 0} suffix="%" />
          </div>
          <p className="text-[11px] text-slate-400">
            {habits.active_streaks || 0} active streaks
          </p>
        </StaggerItem>

        {/* Focus Study Duration */}
        <StaggerItem className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Focus Study</span>
            <BookOpen className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            <AnimatedNumber value={learning.total_hours || 0} suffix="h" />
          </div>
          <p className="text-[11px] text-slate-400">
            {learning.total_sessions || 0} study sessions
          </p>
        </StaggerItem>

        {/* Exam Average Score */}
        <StaggerItem className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Avg Exam Score</span>
            <Award className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            <AnimatedNumber value={exams.avg_score || 0} suffix="%" />
          </div>
          <p className="text-[11px] text-slate-400">
            {exams.pass_rate || 0}% pass rate ({exams.total_attempts || 0} taken)
          </p>
        </StaggerItem>
      </StaggerContainer>

      {/* Main Grid: Task Breakdown & Weekly Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Priority & Status Breakdown */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Task Status & Priority Distribution
            </h3>
            {tasks.overdue > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                <AlertCircle className="h-3 w-3" /> {tasks.overdue} Overdue
              </span>
            )}
          </div>

          {/* Status Progress Bars */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-600">Distribution by Status</p>
            {['todo', 'in_progress', 'in_review', 'completed'].map((st) => {
              const count = tasks.by_status?.[st] || 0;
              const pct = tasks.total > 0 ? Math.round((count / tasks.total) * 100) : 0;
              return (
                <div key={st} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700 capitalize">
                      {st.replace('_', ' ')}
                    </span>
                    <span className="font-bold text-slate-900">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6 }}
                      className={`h-full ${statusColors[st]}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Priority Distribution */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <p className="text-xs font-bold text-slate-600">Distribution by Priority</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['urgent', 'high', 'medium', 'low'].map((p) => {
                const count = tasks.by_priority?.[p] || 0;
                return (
                  <div key={p} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <span className="text-[10px] font-bold uppercase text-slate-400">{p}</span>
                    <p className="text-base font-black text-slate-900 mt-0.5">{count}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Weekly Trend Velocity */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Weekly Completion Velocity
              </h3>
              <span className="text-xs font-semibold text-slate-400">Past 7 Days</span>
            </div>

            {/* Weekly Bars Chart */}
            <div className="pt-6 flex items-end justify-between gap-2 h-48">
              {(tasks.weekly_trend || []).map((day: any) => {
                const maxVal = Math.max(1, ...(tasks.weekly_trend || []).map((d: any) => d.count || 0));
                const heightPct = Math.round(((day.count || 0) / maxVal) * 100);

                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <span className="text-[10px] font-bold text-slate-700">{day.count}</span>
                    <div className="w-full max-w-8 bg-slate-100 rounded-t-lg h-36 flex items-end overflow-hidden">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="w-full bg-sky-600 rounded-t-lg"
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 truncate max-w-full">
                      {day.day || day.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-between text-xs text-sky-900">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-600" />
              <span className="font-semibold">Authoritative Database Calculations</span>
            </div>
            <span className="text-[11px] text-sky-700 font-bold">Zero Client Drift</span>
          </div>
        </div>
      </div>

      {/* Domain Multi-Matrix Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Project Matrix */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <FolderKanban className="h-4 w-4 text-indigo-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Project Portfolio</h4>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Total Projects</span>
              <span className="font-bold text-slate-900">{projects.total || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Active</span>
              <span className="font-bold text-indigo-600">{projects.active || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Completed</span>
              <span className="font-bold text-emerald-600">{projects.completed || 0}</span>
            </div>
            <div className="space-y-1 pt-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-600">Average Portfolio Progress</span>
                <span className="text-slate-900">{projects.avg_progress || 0}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${projects.avg_progress || 0}%` }}
                  className="h-full bg-indigo-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Habits Consistency Matrix */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Flame className="h-4 w-4 text-amber-500" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Habit Formation</h4>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Total Tracked Habits</span>
              <span className="font-bold text-slate-900">{habits.total || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Active Streaks</span>
              <span className="font-bold text-amber-600">{habits.active_streaks || 0}</span>
            </div>
            <div className="space-y-1 pt-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-600">30-Day Adherence</span>
                <span className="text-slate-900">{habits.completion_rate_30_days || 0}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${habits.completion_rate_30_days || 0}%` }}
                  className="h-full bg-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Examination & Assessment Matrix */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <GraduationCap className="h-4 w-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Assessment Mastery</h4>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Total Exam Attempts</span>
              <span className="font-bold text-slate-900">{exams.total_attempts || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Average Performance</span>
              <span className="font-bold text-slate-900">{exams.avg_score || 0}%</span>
            </div>
            <div className="space-y-1 pt-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-600">Pass Rate</span>
                <span className="text-emerald-700">{exams.pass_rate || 0}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${exams.pass_rate || 0}%` }}
                  className="h-full bg-emerald-600"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

