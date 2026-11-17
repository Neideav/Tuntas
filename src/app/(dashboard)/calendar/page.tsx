'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  CheckSquare,
  FolderKanban,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();

      const response = await api.get('/calendar/events', {
        params: { start, end },
      });

      if (response.data?.success) {
        setEvents(response.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Compute days in month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(new Date(year, month, d));
  }

  const getDayEvents = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter((e) => {
      const eventDate = (e.start || e.date || '').split('T')[0];
      return eventDate === dateStr;
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Calendar & Schedule</h2>
          <p className="mt-1 text-xs text-slate-500">
            Unified schedule synchronizing task deadlines, project deliveries, and scheduled examinations.
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCurrentDate(new Date())}
            className="text-xs font-semibold"
          >
            Today
          </Button>
          <button
            onClick={prevMonth}
            aria-label="Previous Month"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-36 text-center text-xs font-bold text-slate-800">
            {monthName}
          </span>
          <button
            onClick={nextMonth}
            aria-label="Next Month"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 p-4 rounded-2xl bg-white border border-slate-200/80 text-xs font-semibold shadow-xs">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-sky-500" />
          <span className="text-slate-700">Task Deadline</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-purple-500" />
          <span className="text-slate-700">Project Delivery</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-amber-500" />
          <span className="text-slate-700">Examination Date</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-violet-500" />
          <span className="text-slate-700">Study Session</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-slate-700">Habit Logged</span>
        </div>
      </div>

      {/* Monthly Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-4">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, idx) => {
            if (!day) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="h-28 rounded-xl bg-slate-50/40 border border-slate-100/40 p-2"
                />
              );
            }

            const isToday = day.toDateString() === new Date().toDateString();
            const dayEvents = getDayEvents(day);

            return (
              <div
                key={day.toISOString()}
                onClick={() => {
                  setSelectedDay(day);
                  setIsDetailOpen(true);
                }}
                className={`h-28 rounded-xl p-2 border transition overflow-y-auto space-y-1 cursor-pointer select-none ${
                  isToday
                    ? 'border-sky-300 bg-sky-50/40 ring-1 ring-sky-200'
                    : 'border-slate-100 bg-white hover:border-sky-200 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${
                      isToday ? 'bg-sky-600 text-white' : 'text-slate-700'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {dayEvents.length} items
                    </span>
                  )}
                </div>

                {/* Day events pills */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((ev: any, i: number) => {
                    const isExam = ev.type === 'examination' || ev.type === 'exam';
                    const isProject = ev.type === 'project';
                    const isSession = ev.type === 'learning_session' || ev.type === 'study_session';
                    const isHabit = ev.type === 'habit';

                    let pillClass = 'bg-sky-50 text-sky-800 border border-sky-200';
                    if (isExam) pillClass = 'bg-amber-50 text-amber-800 border border-amber-200';
                    else if (isProject) pillClass = 'bg-purple-50 text-purple-800 border border-purple-200';
                    else if (isSession) pillClass = 'bg-violet-50 text-violet-800 border border-violet-200';
                    else if (isHabit) pillClass = 'bg-emerald-50 text-emerald-800 border border-emerald-200';

                    return (
                      <div
                        key={i}
                        title={ev.title}
                        className={`truncate text-[10px] font-bold px-1.5 py-0.5 rounded-md ${pillClass}`}
                      >
                        {ev.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <span className="text-[9px] font-bold text-slate-400 pl-1 block">
                      +{dayEvents.length - 2} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DAY EVENT DETAILS MODAL */}
      {selectedDay && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`Schedule for ${selectedDay.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}`}
          description="Detailed breakdown of scheduled tasks, deliveries, sessions, and examinations."
          footer={
            <Button size="sm" onClick={() => setIsDetailOpen(false)}>
              Close
            </Button>
          }
        >
          {(() => {
            const dayEvents = getDayEvents(selectedDay);
            if (dayEvents.length === 0) {
              return (
                <div className="py-8 text-center space-y-2">
                  <CalendarIcon className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">No events scheduled for this day</p>
                  <p className="text-xs text-slate-400">Tasks with due dates or scheduled examinations will automatically populate here.</p>
                </div>
              );
            }

            return (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {dayEvents.map((ev: any, idx: number) => {
                  const isExam = ev.type === 'examination' || ev.type === 'exam';
                  const isProject = ev.type === 'project';
                  const isSession = ev.type === 'learning_session' || ev.type === 'study_session';
                  const isHabit = ev.type === 'habit';

                  let badgeVariant: any = 'todo';
                  let targetHref = '/tasks';
                  let typeLabel = 'Task';

                  if (isExam) {
                    badgeVariant = 'urgent';
                    targetHref = '/examinations';
                    typeLabel = 'Examination';
                  } else if (isProject) {
                    badgeVariant = 'in_progress';
                    targetHref = '/projects';
                    typeLabel = 'Project Delivery';
                  } else if (isSession) {
                    badgeVariant = 'secondary';
                    targetHref = '/learning';
                    typeLabel = 'Study Session';
                  } else if (isHabit) {
                    badgeVariant = 'completed';
                    targetHref = '/habits';
                    typeLabel = 'Habit Routine';
                  }

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/60 transition space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={badgeVariant}>{typeLabel}</Badge>
                            {ev.status && (
                              <span className="text-[10px] font-semibold uppercase text-slate-400">
                                {ev.status}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 leading-snug">
                            {ev.title}
                          </h4>
                        </div>

                        <Link
                          href={targetHref}
                          className="shrink-0 text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 hover:underline"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>

                      {ev.description && (
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {ev.description}
                        </p>
                      )}

                      {(ev.start || ev.date) && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Date(ev.start || ev.date).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
