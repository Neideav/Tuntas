'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  HelpCircle,
  BookOpen,
  CheckSquare,
  Flame,
  Target,
  GraduationCap,
  Calendar,
  ExternalLink,
  Keyboard,
  Shield,
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 z-10 space-y-6"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Tuntas Help & Knowledge Base</h3>
                <p className="text-xs text-slate-500">
                  Quick reference guide and navigation tips for your productivity workspace.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Guide Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <CheckSquare className="h-4 w-4 text-sky-600" />
                <span>Tasks & Kanban</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Organize items across To-Do, In Progress, In Review, and Completed columns. Manage subtasks, tags, and category filters.
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Flame className="h-4 w-4 text-amber-500" />
                <span>Habit Streak & Freeze</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Check in daily to build consistency. When a day is missed, apply a Freeze Token to safeguard your active streak count.
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <BookOpen className="h-4 w-4 text-emerald-600" />
                <span>Learning & Pomodoro</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Structured courses with modules and lessons. Use the integrated Pomodoro focus timer to record dedicated study sessions.
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <GraduationCap className="h-4 w-4 text-purple-600" />
                <span>Dedicated Examinations</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Secure anti-leak assessment engine with real-time answer sync, integrity tracking, automated grading, and instructor queues.
              </p>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Keyboard className="h-4 w-4 text-slate-500" />
              <span>Keyboard & Navigation Shortcuts</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <span className="text-slate-600">Close open modal / drawer</span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono font-bold text-slate-700">Esc</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <span className="text-slate-600">Toggle Sidebar</span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono font-bold text-slate-700">Left Arrow</kbd>
              </div>
            </div>
          </div>

          {/* Footer Action */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400">Tuntas Platform Version 2.0.0</span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition cursor-pointer"
            >
              Got it
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

