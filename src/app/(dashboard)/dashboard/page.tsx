'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
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
import api, { getCachedData } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import {
  FadeIn,
  StaggerContainer,
  StaggerItem,
  AnimatedNumber,
  AnimatedList,
  AnimatedItem,
} from '@/components/animations';
import { SPRING_TRANSITIONS } from '@/lib/animations';

export default function DashboardPage() {
  // Synchronous cache read for 0ms return renders
  const [data, setData] = useState<any>(() => getCachedData<any>('/dashboard'));
  const [loading, setLoading] = useState<boolean>(() => !getCachedData('/dashboard'));

  const fetchDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent && !data) {
        setLoading(true);
      }
      const res = await api.get('/dashboard');
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    // If we already have cached data, revalidate silently in the background
    const hasCache = !!getCachedData('/dashboard');
    fetchDashboard(hasCache);
  }, []);

  // Smooth, instant Optimistic Task Toggle
  const handleToggleTask = async (taskId: number) => {
    if (!data) return;

    const previousData = data;
    const targetTask = data.today_tasks?.find((t: any) => t.id === taskId);
    if (!targetTask) return;

    const willComplete = targetTask.status !== 'completed';
    const updatedStatus = willComplete ? 'completed' : 'todo';
    const completedDiff = willComplete ? 1 : -1;
    const currentCompleted = data.metrics?.tasks_completed_count || 0;
    const newCompletedCount = Math.max(0, currentCompleted + completedDiff);
    const totalCount = data.metrics?.tasks_total_count || 1;
    const newPercentage = Math.round((newCompletedCount / Math.max(1, totalCount)) * 100);

    // Instant UI update
    setData((prev: any) => ({
      ...prev,
      today_tasks: prev.today_tasks?.map((t: any) =>
        t.id === taskId ? { ...t, status: updatedStatus } : t
      ),
      metrics: {
        ...prev.metrics,
        tasks_completed_count: newCompletedCount,
        completion_rate_percentage: newPercentage,
      },
    }));

    // Background sync
    try {
      const res = await api.patch(`/tasks/${taskId}/toggle`);
      if (!res.data?.success) {
        setData(previousData);
      } else {
        fetchDashboard(true);
      }
    } catch (err) {
      console.error(err);
      setData(previousData);
    }
  };

  // Smooth, instant Optimistic Habit Toggle
  const handleToggleHabit = async (habitId: number) => {
    if (!data) return;

    const previousData = data;
    const targetHabit = data.habits?.find((h: any) => h.id === habitId);
    if (!targetHabit) return;

    const willComplete = !targetHabit.is_completed_today;
    const streakDiff = willComplete ? 1 : -1;
    const newStreak = Math.max(0, (targetHabit.current_streak || 0) + streakDiff);
    const completedTodayDiff = willComplete ? 1 : -1;
    const newCompletedToday = Math.max(
      0,
      (data.metrics?.habits_completed_today_count || 0) + completedTodayDiff
    );

    // Instant UI update
    setData((prev: any) => ({
      ...prev,
      habits: prev.habits?.map((h: any) =>
        h.id === habitId
          ? { ...h, is_completed_today: willComplete, current_streak: newStreak }
          : h
      ),
      metrics: {
        ...prev.metrics,
        habits_completed_today_count: newCompletedToday,
      },
    }));

    // Background sync
    try {
      const res = await api.post(`/habits/${habitId}/toggle`);
      if (!res.data?.success) {
        setData(previousData);
      } else {
        fetchDashboard(true);
      }
    } catch (err) {
      console.error(err);
      setData(previousData);
    }
  };

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return <DashboardSkeleton />;
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
      <FadeIn direction="down">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Welcome back to your workspace!
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              You have{' '}
              <span className="font-bold text-sky-600">
                <AnimatedNumber value={metrics.tasks_in_progress_count || 0} /> tasks
              </span>{' '}
              in progress,{' '}
              <span className="font-bold text-purple-600">
                <AnimatedNumber value={metrics.upcoming_examinations_count || 0} /> scheduled exams
              </span>
              , and{' '}
              <span className="font-bold text-emerald-600">
                <AnimatedNumber value={metrics.total_study_hours || 0} /> hours
              </span>{' '}
              studied.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/tasks" prefetch={true}>
              <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                New Task
              </Button>
            </Link>
            <Link href="/examinations" prefetch={true}>
              <Button size="sm" variant="secondary" leftIcon={<GraduationCap className="h-3.5 w-3.5" />}>
                Exams
              </Button>
            </Link>
            <Link href="/notifications" prefetch={true}>
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
      </FadeIn>

      {/* 5 Core Metrics Cards: Clickable to Features with Staggered Entrance & Animated Numbers */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Tasks Completion */}
        <StaggerItem>
          <Link href="/tasks" prefetch={true} className="block group focus:outline-hidden">
            <Card interactive className="transition-all group-hover:border-sky-300">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-800 transition-colors">
                    Task Completion
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                    <CheckSquare className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    <AnimatedNumber value={metrics.completion_rate_percentage || 0} />%
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    (<AnimatedNumber value={metrics.tasks_completed_count || 0} />/
                    <AnimatedNumber value={metrics.tasks_total_count || 0} />)
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </StaggerItem>

        {/* Metric 2: Active Projects */}
        <StaggerItem>
          <Link href="/projects" prefetch={true} className="block group focus:outline-hidden">
            <Card interactive className="transition-all group-hover:border-sky-300">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-800 transition-colors">
                    Active Projects
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600 group-hover:bg-sky-100 transition-colors">
                    <FolderKanban className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    <AnimatedNumber value={metrics.active_projects_count || 0} />
                  </span>
                  <span className="text-[11px] text-sky-600 font-medium">
                    <AnimatedNumber value={metrics.average_project_progress || 0} />% avg
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </StaggerItem>

        {/* Metric 3: Active Habit Streaks */}
        <StaggerItem>
          <Link href="/habits" prefetch={true} className="block group focus:outline-hidden">
            <Card interactive className="transition-all group-hover:border-amber-300">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-800 transition-colors">
                    Habit Streaks
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
                    <Flame className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    <AnimatedNumber value={metrics.habits_active_streak_sum || 0} />d
                  </span>
                  <span className="text-[11px] text-amber-600 font-medium">
                    <AnimatedNumber value={metrics.habits_completed_today_count || 0} /> today
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </StaggerItem>

        {/* Metric 4: Scheduled Exams */}
        <StaggerItem>
          <Link href="/examinations" prefetch={true} className="block group focus:outline-hidden">
            <Card interactive className="transition-all group-hover:border-rose-300">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-800 transition-colors">
                    Upcoming Exams
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 group-hover:bg-rose-100 transition-colors">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    <AnimatedNumber value={metrics.upcoming_examinations_count || 0} />
                  </span>
                  <span className="text-[11px] text-rose-600 font-semibold">Active Window</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </StaggerItem>

        {/* Metric 5: Focus Study Hours */}
        <StaggerItem>
          <Link href="/learning" prefetch={true} className="block group focus:outline-hidden">
            <Card interactive className="transition-all group-hover:border-purple-300">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-800 transition-colors">
                    Study Sessions
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
                    <BookOpen className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    <AnimatedNumber value={metrics.total_study_hours || 0} />h
                  </span>
                  <span className="text-[11px] text-purple-600 font-semibold">Deep focus</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </StaggerItem>
      </StaggerContainer>

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
                prefetch={true}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                View all tasks <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            {today_tasks.length > 0 ? (
              <AnimatedList className="space-y-2.5">
                {today_tasks.map((task: any) => (
                  <AnimatedItem
                    key={task.id}
                    layoutId={`dashboard-task-${task.id}`}
                    className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition"
                  >
                    <div className="flex items-center gap-3">
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        transition={SPRING_TRANSITIONS.tight}
                        onClick={() => handleToggleTask(task.id)}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition cursor-pointer ${
                          task.status === 'completed'
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 hover:border-sky-500 bg-white'
                        }`}
                      >
                        {task.status === 'completed' && <Check className="h-3.5 w-3.5" />}
                      </motion.button>

                      <div>
                        <h4
                          className={`text-sm font-bold transition-all ${
                            task.status === 'completed'
                              ? 'line-through text-slate-400'
                              : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {task.project?.title || 'General Task'} • Due{' '}
                          {task.due_date
                            ? new Date(task.due_date).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Today'}
                        </p>
                      </div>
                    </div>
                  </AnimatedItem>
                ))}
              </AnimatedList>
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
                prefetch={true}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                All projects <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            {active_projects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {active_projects.map((proj: any) => (
                  <Link
                    key={proj.id}
                    href="/projects"
                    prefetch={true}
                    className="block group focus:outline-hidden"
                  >
                    <motion.div
                      whileHover={{ y: -2 }}
                      transition={SPRING_TRANSITIONS.tight}
                      className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3 hover:shadow-md hover:border-sky-200 transition"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors truncate">
                          {proj.title}
                        </h4>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                          <span>Progress</span>
                          <span className="text-sky-600">{proj.progress}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${proj.progress}%` }}
                            transition={SPRING_TRANSITIONS.snappy}
                            className="h-full bg-sky-500 rounded-full"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          {proj.completed_tasks_count || 0}/{proj.tasks_count || 0} Tasks
                        </span>
                        <span>
                          {proj.deadline ? new Date(proj.deadline).toLocaleDateString() : 'No date'}
                        </span>
                      </div>
                    </motion.div>
                  </Link>
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
            </div>

            <div className="grid grid-cols-7 gap-2 pt-2">
              {weekly_productivity.map((day: any, i: number) => (
                <div key={day.date} className="flex flex-col items-center gap-1.5 text-center">
                  <div className="h-24 w-full flex items-end justify-center bg-slate-50 rounded-xl p-1.5 overflow-hidden">
                    <motion.div
                      initial={{ height: "4px" }}
                      animate={{
                        height: `${Math.min(100, Math.max(15, (day.completed || 0) * 25))}%`,
                      }}
                      transition={{
                        ...SPRING_TRANSITIONS.snappy,
                        delay: i * 0.04,
                      }}
                      className="w-full bg-sky-500 rounded-lg"
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-800">
                    <AnimatedNumber value={day.completed || 0} />
                  </span>
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
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Habit Streaks
                </h3>
              </div>
              <Link
                href="/habits"
                prefetch={true}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                All <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <AnimatedList className="space-y-2.5">
              {habits.length > 0 ? (
                habits.map((habit: any) => (
                  <AnimatedItem
                    key={habit.id}
                    layoutId={`dashboard-habit-${habit.id}`}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 font-bold text-xs">
                        {habit.current_streak}d
                      </div>
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {habit.title}
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant={habit.is_completed_today ? 'secondary' : 'primary'}
                      onClick={() => handleToggleHabit(habit.id)}
                      className={`h-7 text-xs px-2.5 cursor-pointer ${
                        habit.is_completed_today
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100'
                          : ''
                      }`}
                    >
                      {habit.is_completed_today ? 'Done ✓' : 'Check'}
                    </Button>
                  </AnimatedItem>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No habits registered yet.</p>
              )}
            </AnimatedList>
          </div>

          {/* Goals & OKRs Snapshot */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Goals & OKRs
                </h3>
              </div>
              <Link
                href="/goals"
                prefetch={true}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                All <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-3">
              {goals.length > 0 ? (
                goals.slice(0, 3).map((goal: any) => (
                  <div key={goal.id} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span className="truncate">{goal.title}</span>
                      <span className="text-emerald-600">{goal.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${goal.progress}%` }}
                        transition={SPRING_TRANSITIONS.snappy}
                        className="h-full bg-emerald-500 rounded-full"
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No active goals configured.</p>
              )}
            </div>
          </div>

          {/* Dedicated Examination Countdown & Scorecards */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Upcoming Exams
                </h3>
              </div>
              <Link
                href="/examinations"
                prefetch={true}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                Portal <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {upcoming_examinations.length > 0 ? (
                upcoming_examinations.slice(0, 2).map((exam: any) => (
                  <motion.div
                    key={exam.id}
                    whileHover={{ scale: 1.01 }}
                    transition={SPRING_TRANSITIONS.tight}
                    className="p-3 rounded-xl border border-rose-100 bg-rose-50/30 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{exam.title}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {exam.duration_minutes} mins • Passing: {exam.passing_score}%
                      </p>
                    </div>
                    <Link href={`/examinations`} prefetch={true}>
                      <Button size="sm" variant="danger" className="h-7 text-xs px-2.5">
                        Prepare
                      </Button>
                    </Link>
                  </motion.div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No scheduled exams in this window.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
