'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  History,
  Clock,
  Activity,
  CheckCircle2,
  Flame,
  Target,
  GraduationCap,
  Folder,
  RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';

interface AuditItem {
  id: number;
  action: string;
  auditable_type: string;
  auditable_id: string;
  payload?: any;
  created_at: string;
}

interface ActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActivityDrawer({ isOpen, onClose }: ActivityDrawerProps) {
  const [activities, setActivities] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const res = await api.get('/activity');
      if (res.data?.success) {
        setActivities(res.data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchActivities();
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const getActionIcon = (action: string) => {
    if (action.includes('habit')) return <Flame className="h-4 w-4 text-amber-500" />;
    if (action.includes('goal')) return <Target className="h-4 w-4 text-emerald-500" />;
    if (action.includes('exam')) return <GraduationCap className="h-4 w-4 text-purple-500" />;
    if (action.includes('task')) return <CheckCircle2 className="h-4 w-4 text-sky-500" />;
    return <Activity className="h-4 w-4 text-slate-500" />;
  };

  const formatActionTitle = (item: AuditItem) => {
    const action = item.action || '';
    if (action === 'habit.toggle') return 'Habit Completion Toggled';
    if (action === 'goal.milestone.update') return 'Goal Milestone Updated';
    if (action === 'exam.start') return 'Examination Started';
    if (action === 'exam.submit') return 'Assessment Submitted';
    if (action === 'exam.sync') return 'Exam Answers Synchronized';
    return action.replace('.', ' ').replace('_', ' ').toUpperCase();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative w-full max-w-md h-full bg-white shadow-2xl z-10 border-l border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Activity & Audit Trail</h3>
                  <p className="text-[11px] text-slate-400">Real-time system events and user actions</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={fetchActivities}
                  title="Refresh activity"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Activities List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              {loading && activities.length === 0 ? (
                <div className="flex h-48 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
                </div>
              ) : activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center p-6 space-y-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                    <Clock className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-xs text-slate-700">No recent activity logs</h4>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    Your actions across habits, goals, assessments, and tasks will be recorded here in real time.
                  </p>
                </div>
              ) : (
                activities.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 transition"
                  >
                    <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs shrink-0 mt-0.5">
                      {getActionIcon(item.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-slate-800 truncate">
                          {formatActionTitle(item)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {item.auditable_type ? item.auditable_type.split('\\').pop() : 'System'} #{item.auditable_id}
                      </p>
                      <div className="text-[10px] text-slate-400 mt-1 font-medium">
                        {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-400 text-center">
              Backed by Laravel Sanctum Audit Engine
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

