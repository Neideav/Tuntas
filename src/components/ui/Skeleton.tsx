import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`}
      {...props}
    />
  );
}

/**
 * High-fidelity Skeleton matching the Dashboard Page layout.
 * Shown instantly on first load to eliminate layout shifts and avoid ugly spinners.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
        </div>
      </div>

      {/* 5 Core Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3.5 w-12" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Tasks, Projects, Weekly Productivity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Priorities */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-md" />
                <Skeleton className="h-5 w-48" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>

            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-lg shrink-0" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-48 sm:w-64" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
              ))}
            </div>
          </div>

          {/* Active Projects */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-md" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3"
                >
                  <Skeleton className="h-4 w-40" />
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-14" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Productivity Trend */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-56" />
            </div>
            <div className="grid grid-cols-7 gap-2 pt-2">
              {[40, 65, 30, 85, 50, 95, 70].map((h, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="h-24 w-full flex items-end justify-center bg-slate-50 rounded-xl p-1.5">
                    <Skeleton
                      className="w-full rounded-lg"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                  <Skeleton className="h-3 w-4" />
                  <Skeleton className="h-2.5 w-6" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Habits, Goals, Exams */}
        <div className="space-y-6">
          {/* Habit Streaks */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-md" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-3.5 w-10" />
            </div>

            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50"
                >
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
                    <Skeleton className="h-3.5 w-28" />
                  </div>
                  <Skeleton className="h-7 w-14 rounded-lg" />
                </div>
              ))}
            </div>
          </div>

          {/* Goals Snapshot */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-md" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-3.5 w-10" />
            </div>

            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3.5 w-8" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Exams */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-md" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-3.5 w-12" />
            </div>

            <div className="space-y-2.5">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl border border-rose-100 bg-rose-50/30 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                  <Skeleton className="h-7 w-16 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for Tasks Kanban Board
 */
export function TaskBoardSkeleton() {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Skeleton className="h-10 w-full sm:w-72 rounded-xl" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
        {[1, 2, 3, 4].map((col) => (
          <div
            key={col}
            className="flex flex-col rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between px-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
            {[1, 2].map((card) => (
              <div
                key={card}
                className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 shadow-xs"
              >
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-12 rounded-md" />
                </div>
                <Skeleton className="h-3 w-full" />
                <div className="flex items-center justify-between pt-2">
                  <Skeleton className="h-5 w-16 rounded-md" />
                  <Skeleton className="h-5 w-5 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for Projects Grid
 */
export function ProjectsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fadeIn">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-4 w-6 rounded-md" />
          </div>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-full" />
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for Examinations Page
 */
export function ExaminationsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>
          <Skeleton className="h-5 w-40" />
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-3.5 rounded-full" />
              <Skeleton className="h-3.5 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-3.5 rounded-full" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-20 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for Habits Page
 */
export function HabitsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-6 w-12 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-20" />
          </div>
          <div className="pt-2">
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for Goals Page
 */
export function GoalsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fadeIn">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-4 w-6 rounded-md" />
          </div>
          <Skeleton className="h-5 w-44" />
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for Learning / Courses
 */
export function CoursesSkeleton() {
  return (
    <div className="space-y-4 animate-fadeIn">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3.5 w-64" />
            </div>
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
