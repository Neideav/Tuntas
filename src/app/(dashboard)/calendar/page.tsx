'use client';

import React, { useEffect, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CheckSquare,
  FolderKanban,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

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
          <button
            onClick={prevMonth}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition shadow-xs"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-36 text-center text-xs font-bold text-slate-800">
            {monthName}
          </span>
          <button
            onClick={nextMonth}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition shadow-xs"
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
                className={`h-28 rounded-xl p-2 border transition overflow-y-auto space-y-1 ${
                  isToday
                    ? 'border-sky-300 bg-sky-50/30'
                    : 'border-slate-100 bg-white hover:border-slate-200'
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

                    return (
                      <div
                        key={i}
                        title={ev.title}
                        className={`truncate text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          isExam
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : isProject
                            ? 'bg-purple-50 text-purple-800 border border-purple-200'
                            : 'bg-sky-50 text-sky-800 border border-sky-200'
                        }`}
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
    </div>
  );
}
