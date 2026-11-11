'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  FolderKanban,
  GraduationCap,
  Flame,
  ArrowUpRight,
  Clock,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Target,
  Sparkles,
  BookOpen,
  Bell,
  Plus,
  ArrowRight,
  Check,
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard');
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleToggleTask = async (taskId: number) => {
    try {
      const res = await api.patch(`/tasks/${taskId}/toggle`);
      if (res.data?.success) {
        fetchDashboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleHabit = async (habitId: number) => {
    try {
      const res = await api.post(`/habits/${habitId}/toggle`);
      if (res.data?.success) {
        fetchDashboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
      </div>
    );
  }

  const {
    metrics = {},
    today_tasks = [],
    active_projects = [],
    habits = [],
    goals = [],
    upcoming_examinations = [],
    recent_exam_results = [],
    recent_notifications = [],
    weekly_productivity = [],
  } = data;

  return (
    <div className="space-y-8">
      {/* Top Banner / Workspace Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-bold uppercase tracking-wider">
              Tuntas Unified Dashboard
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Welcome back to your workspace!
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            You have <span className="font-bold text-sky-600">{metrics.tasks_in_progress_count || 0} tasks</span> in progress,{' '}
            <span className="font-bold text-purple-600">{metrics.upcoming_examinations_count || 0} scheduled exams</span>, and{' '}
            <span className="font-bold text-emerald-600">{metrics.total_study_hours || 0} hours</span> studied.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/tasks">
            <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
              New Task
            </Button>
          </Link>
          <Link href="/examinations">
            <Button size="sm" variant="secondary" leftIcon={<GraduationCap className="h-3.5 w-3.5" />}>
              Exams
            </Button>
          </Link>
          <Link href="/notifications">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Bell className="h-3.5 w-3.5" />}
              className="relative"
            >
              Alerts
              {metrics.unread_notifications_count > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                  {metrics.unread_notifications_count}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </div>

      {/* 5 Core Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Tasks Completion */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Task Completion</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckSquare className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {metrics.completion_rate_percentage || 0}%
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                ({metrics.tasks_completed_count}/{metrics.tasks_total_count})
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Active Projects */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Active Projects</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <FolderKanban className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {metrics.active_projects_count || 0}
              </span>
              <span className="text-[11px] text-sky-600 font-medium">
                {metrics.average_project_progress || 0}% avg
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Habit Streaks */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Best Streak</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Flame className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {metrics.active_habit_streaks || 0}d
              </span>
              <span className="text-[11px] text-amber-600 font-semibold">Consistency</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Goals Progress */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Active Goals</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Target className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {metrics.goals_active_count || 0}
              </span>
              <span className="text-[11px] text-blue-600 font-medium">
                {metrics.average_goal_progress || 0}% avg
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 5: Study Hours */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Study Hours</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <BookOpen className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {metrics.total_study_hours || 0}h
              </span>
              <span className="text-[11px] text-purple-600 font-semibold">Deep focus</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Tasks, Projects, Weekly Productivity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Today's Priorities */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Today's Priorities & Deadlines</h3>
              </div>
              <Link
                href="/tasks"
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                View all tasks <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            {today_tasks.length > 0 ? (
              <div className="space-y-2.5">
                {today_tasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition ${
                          task.status === 'completed'
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 hover:border-sky-500 bg-white'
                        }`}
                      >
                        {task.status === 'completed' && <Check className="h-3.5 w-3.5" />}
                      </button>

                      <div>
                        <h4
                          className={`text-sm font-bold ${
                            task.status === 'completed'
                              ? 'line-through text-slate-400'
                              : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {task.project?.title || 'General Task'} • Due{' '}
                          {task.due_date ? new Date(task.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={task.priority} size="sm">
                        {task.priority}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-500 font-medium">
                  No priority tasks scheduled for today. Great job!
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Active Projects Portfolio */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Active Projects</h3>
              </div>
              <Link
                href="/projects"
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                All projects <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            {active_projects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {active_projects.map((proj: any) => (
                  <div
                    key={proj.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{proj.title}</h4>
                      <Badge variant="in_progress" size="sm">
                        {proj.status}
                      </Badge>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                        <span>Progress</span>
                        <span className="text-sky-600">{proj.progress}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-500 rounded-full transition-all"
                          style={{ width: `${proj.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{proj.completed_tasks_count || 0}/{proj.tasks_count || 0} Tasks</span>
                      <span>{proj.deadline ? new Date(proj.deadline).toLocaleDateString() : 'No date'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No active projects in progress.</p>
            )}
          </div>

          {/* Section 3: Weekly Productivity Activity Trend */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Weekly Completion Velocity
                </h3>
                <p className="text-xs text-slate-500">Tasks completed over the past 7 days.</p>
              </div>
              <Badge variant="success" size="sm">
                Velocity
              </Badge>
            </div>

            <div className="grid grid-cols-7 gap-2 pt-2">
              {weekly_productivity.map((day: any) => (
                <div key={day.date} className="flex flex-col items-center gap-1.5 text-center">
                  <div className="h-24 w-full flex items-end justify-center bg-slate-50 rounded-xl p-1.5">
                    <div
                      className="w-full bg-sky-500 rounded-lg transition-all"
                      style={{
                        height: `${Math.min(100, Math.max(15, (day.completed || 0) * 25))}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-800">{day.completed}</span>
                  <span className="text-[10px] text-slate-400">{day.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Habits, Goals, Exams, Notifications */}
        <div className="space-y-6">
          {/* Quick Habit Check-ins */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Habit Streaks</h3>
              </div>
              <Link
                href="/habits"
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                All <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {habits.length > 0 ? (
                habits.map((habit: any) => (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 font-bold text-xs">
                        {habit.current_streak}d
                      </div>
                      <span className="text-xs font-bold text-slate-800 truncate">{habit.title}</span>
                    </div>

                    <button
                      onClick={() => handleToggleHabit(habit.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        habit.is_completed_today
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {habit.is_completed_today ? 'Done ✓' : 'Check'}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No habits registered yet.</p>
              )}
            </div>
          </div>

          {/* Goals & OKRs Snapshot */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Goals & OKRs</h3>
              </div>
              <Link
                href="/goals"
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                All <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {goals.length > 0 ? (
                goals.map((goal: any) => (
                  <div key={goal.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{goal.title}</h4>
                      <span className="text-[11px] font-bold text-sky-600">{goal.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all"
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No active goals set.</p>
              )}
            </div>
          </div>

          {/* Upcoming Examinations Countdown */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Exam Hub</h3>
              </div>
              <Link
                href="/examinations"
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                Hub <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            {upcoming_examinations.length > 0 ? (
              <div className="space-y-2.5">
                {upcoming_examinations.map((exam: any) => (
                  <div key={exam.id} className="p-3 rounded-xl border border-purple-100 bg-purple-50/40 space-y-1">
                    <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                      {exam.subject}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900">{exam.title}</h4>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      {new Date(exam.examination_date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : recent_exam_results.length > 0 ? (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Recent Scorecard
                </span>
                {recent_exam_results.slice(0, 2).map((res: any) => (
                  <div key={res.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{res.title}</h4>
                      <p className="text-[10px] text-slate-500">{res.subject}</p>
                    </div>
                    <Badge variant={res.is_passed ? 'success' : 'danger'} size="sm">
                      {res.score_percentage}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No upcoming exams scheduled.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
