'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Settings,
  Coffee,
  Brain,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import api, { extractApiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { SPRING_TRANSITIONS } from '@/lib/animations';

interface PomodoroTimerProps {
  courses: Array<{ id: number; title: string }>;
  onSessionSaved?: () => void;
}

type TimerMode = 'focus' | 'short_break' | 'long_break';

export function PomodoroTimer({ courses, onSessionSaved }: PomodoroTimerProps) {
  // Timer durations in minutes
  const [focusDuration, setFocusDuration] = useState(25);
  const [shortBreakDuration, setShortBreakDuration] = useState(5);
  const [longBreakDuration, setLongBreakDuration] = useState(15);

  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<number | undefined>();
  const [sessionTopic, setSessionTopic] = useState('');
  const [completedSessionsCount, setCompletedSessionsCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [completedMessage, setCompletedMessage] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const endTimeRef = useRef<number | null>(null);

  // Initialize and restore state from localStorage
  useEffect(() => {
    try {
      const savedCount = localStorage.getItem('tuntas_pomo_count');
      if (savedCount) setCompletedSessionsCount(parseInt(savedCount, 10));

      const savedSettings = localStorage.getItem('tuntas_pomo_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.focus) setFocusDuration(parsed.focus);
        if (parsed.shortBreak) setShortBreakDuration(parsed.shortBreak);
        if (parsed.longBreak) setLongBreakDuration(parsed.longBreak);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const getDurationForMode = (m: TimerMode) => {
    switch (m) {
      case 'focus':
        return focusDuration * 60;
      case 'short_break':
        return shortBreakDuration * 60;
      case 'long_break':
        return longBreakDuration * 60;
    }
  };

  // Switch mode
  const switchMode = (newMode: TimerMode) => {
    setIsActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    endTimeRef.current = null;
    setMode(newMode);
    setTimeLeft(getDurationForMode(newMode));
  };

  // Timer Tick Engine using real Date.now() to prevent background drift
  useEffect(() => {
    if (isActive) {
      if (!endTimeRef.current) {
        endTimeRef.current = Date.now() + timeLeft * 1000;
      }

      timerRef.current = setInterval(() => {
        if (!endTimeRef.current) return;
        const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
        setTimeLeft(remaining);

        if (remaining <= 0) {
          handleSessionCompletion();
        }
      }, 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      endTimeRef.current = null;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, mode]);

  const handleTogglePlay = () => {
    if (!isActive) {
      endTimeRef.current = Date.now() + timeLeft * 1000;
      setIsActive(true);
    } else {
      setIsActive(false);
      endTimeRef.current = null;
    }
  };

  const handleReset = () => {
    setIsActive(false);
    endTimeRef.current = null;
    setTimeLeft(getDurationForMode(mode));
  };

  const handleSkip = () => {
    if (mode === 'focus') {
      const nextMode = (completedSessionsCount + 1) % 4 === 0 ? 'long_break' : 'short_break';
      switchMode(nextMode);
    } else {
      switchMode('focus');
    }
  };

  const handleSessionCompletion = async () => {
    setIsActive(false);
    endTimeRef.current = null;

    if (mode === 'focus') {
      const newCount = completedSessionsCount + 1;
      setCompletedSessionsCount(newCount);
      try {
        localStorage.setItem('tuntas_pomo_count', String(newCount));
      } catch {}

      // Persist study session to backend
      setSavingSession(true);
      try {
        const course = courses.find((c) => c.id === selectedCourseId);
        const topic = sessionTopic.trim() || (course ? `Study: ${course.title}` : 'Pomodoro Focus Session');
        const today = new Date().toISOString().split('T')[0];

        await api.post('/learning-sessions', {
          topic,
          duration_minutes: focusDuration,
          session_date: today,
          course_id: selectedCourseId || null,
          notes: `Completed 1 Pomodoro session (${focusDuration}m focus). Total focus sessions: ${newCount}.`,
        });

        setCompletedMessage(`Great job! Completed ${focusDuration}m focus session.`);
        if (onSessionSaved) onSessionSaved();
      } catch (err) {
        console.error('Failed to log pomodoro study session:', err);
      } finally {
        setSavingSession(false);
      }

      // Next mode: long break every 4 sessions, otherwise short break
      const nextMode = newCount % 4 === 0 ? 'long_break' : 'short_break';
      setMode(nextMode);
      setTimeLeft(getDurationForMode(nextMode));
    } else {
      // Break finished
      setCompletedMessage('Break finished! Ready to focus?');
      setMode('focus');
      setTimeLeft(getDurationForMode('focus'));
    }
  };

  // Calculate circular progress
  const totalDuration = getDurationForMode(mode);
  const progressRatio = totalDuration > 0 ? (totalDuration - timeLeft) / totalDuration : 0;
  const strokeDashoffset = 100 - progressRatio * 100;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const modeColors = {
    focus: {
      bg: 'bg-sky-50 text-sky-700 border-sky-200',
      stroke: '#0284c7',
      label: 'Focus Time',
      icon: Brain,
    },
    short_break: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      stroke: '#10b981',
      label: 'Short Break',
      icon: Coffee,
    },
    long_break: {
      bg: 'bg-purple-50 text-purple-700 border-purple-200',
      stroke: '#8b5cf6',
      label: 'Long Rest',
      icon: Sparkles,
    },
  };

  const currentTheme = modeColors[mode];
  const ModeIcon = currentTheme.icon;

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-xs space-y-6">
      {/* Top Mode Selectors & Settings Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-2">
          {(['focus', 'short_break', 'long_break'] as TimerMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                mode === m
                  ? `${modeColors[m].bg} border shadow-xs`
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {modeColors[m].label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          title="Configure Timer Durations"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl bg-slate-50 border border-slate-200/70 p-4 text-xs space-y-3"
          >
            <div className="font-bold text-slate-900">Custom Durations (minutes)</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Focus Duration</label>
                <input
                  type="number"
                  min="5"
                  max="90"
                  value={focusDuration}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10) || 25;
                    setFocusDuration(v);
                    if (mode === 'focus') setTimeLeft(v * 60);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Short Break</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={shortBreakDuration}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10) || 5;
                    setShortBreakDuration(v);
                    if (mode === 'short_break') setTimeLeft(v * 60);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Long Break</label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={longBreakDuration}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10) || 15;
                    setLongBreakDuration(v);
                    if (mode === 'long_break') setTimeLeft(v * 60);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-800"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion Toast Notification */}
      <AnimatePresence>
        {completedMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{completedMessage}</span>
            </div>
            <button
              onClick={() => setCompletedMessage(null)}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-bold"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Course & Topic Association */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Associate with Course (Optional)
          </label>
          <select
            value={selectedCourseId ?? ''}
            onChange={(e) => setSelectedCourseId(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-xs focus:border-sky-500 focus:outline-hidden"
          >
            <option value="">No course (General study)</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Focus Topic / Note
          </label>
          <input
            type="text"
            placeholder="e.g., Quantum Mechanics Chapter 4..."
            value={sessionTopic}
            onChange={(e) => setSessionTopic(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-xs focus:border-sky-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Main Circular Countdown Display */}
      <div className="flex flex-col items-center justify-center py-6">
        <div className="relative flex h-64 w-64 items-center justify-center">
          {/* Background circle */}
          <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="44"
              className="stroke-slate-100"
              strokeWidth="6"
              fill="transparent"
            />
            {/* Animated progress circle */}
            <motion.circle
              cx="50"
              cy="50"
              r="44"
              stroke={currentTheme.stroke}
              strokeWidth="6"
              strokeDasharray="276.46"
              strokeDashoffset={276.46 * (1 - progressRatio)}
              strokeLinecap="round"
              fill="transparent"
              transition={{ duration: 0.5, ease: 'linear' }}
            />
          </svg>

          {/* Center Time & Status */}
          <div className="absolute flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <ModeIcon className="h-4 w-4" style={{ color: currentTheme.stroke }} />
              <span>{currentTheme.label}</span>
            </div>

            <motion.span
              key={formattedTime}
              initial={{ scale: 0.98 }}
              animate={{ scale: 1 }}
              className="mt-1 font-mono text-5xl font-black tracking-tight text-slate-900"
            >
              {formattedTime}
            </motion.span>

            <span className="mt-1 text-[11px] font-semibold text-slate-400">
              {isActive ? 'In Session' : 'Paused'}
            </span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="mt-6 flex items-center gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={handleReset}
            title="Reset session"
            className="rounded-2xl"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <Button
            size="lg"
            onClick={handleTogglePlay}
            className={`min-w-36 rounded-2xl px-6 font-bold shadow-md ${
              isActive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-sky-600 hover:bg-sky-700'
            }`}
          >
            {isActive ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                {timeLeft === totalDuration ? 'Start Focus' : 'Resume'}
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={handleSkip}
            title="Skip to next session"
            className="rounded-2xl"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Focus Session Counter & Analytics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-5 text-center">
        <div className="p-3 rounded-2xl bg-slate-50">
          <p className="text-[11px] font-semibold text-slate-500">Pomodoros Done</p>
          <p className="text-xl font-bold text-slate-900">{completedSessionsCount}</p>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50">
          <p className="text-[11px] font-semibold text-slate-500">Total Focused Time</p>
          <p className="text-xl font-bold text-sky-700">{completedSessionsCount * focusDuration}m</p>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50">
          <p className="text-[11px] font-semibold text-slate-500">Next Long Rest In</p>
          <p className="text-xl font-bold text-slate-900">
            {4 - (completedSessionsCount % 4 === 0 && completedSessionsCount > 0 ? 4 : completedSessionsCount % 4)} sessions
          </p>
        </div>
      </div>
    </div>
  );
}

