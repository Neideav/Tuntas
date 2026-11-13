'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  SlidersHorizontal,
  Plus,
  Kanban as KanbanIcon,
  Table as TableIcon,
  List as ListIcon,
  Calendar as TimelineIcon,
  MoreVertical,
  Paperclip,
  MessageSquare,
  ListChecks,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Trash2,
  ChevronDown,
  Tag,
  FileText,
  Hourglass,
  FileSearch,
} from 'lucide-react';
import api from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { AvatarStack } from '@/components/ui/AvatarStack';
import { EmptyState } from '@/components/ui/EmptyState';

interface Subtask {
  id: number;
  title: string;
  is_completed: boolean;
  order: number;
}

interface TagItem {
  id: number;
  name: string;
  color?: string;
}

interface Task {
  id: number;
  title: string;
  description?: string | null;
  status: 'todo' | 'in_progress' | 'in_review' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string | null;
  project_id?: number | null;
  category_id?: number | null;
  subtasks?: Subtask[];
  tags?: TagItem[];
  project?: { id: number; title: string };
  category?: { id: number; name: string };
}

const COLUMNS: {
  id: Task['status'];
  label: string;
  badgeBg: string;
  badgeText: string;
  icon: any;
  iconColor: string;
}[] = [
  { id: 'todo', label: 'To-Do', badgeBg: 'bg-slate-900', badgeText: 'text-white', icon: FileText, iconColor: 'text-slate-600' },
  { id: 'in_progress', label: 'On Progress', badgeBg: 'bg-sky-500', badgeText: 'text-white', icon: Hourglass, iconColor: 'text-sky-500' },
  { id: 'in_review', label: 'In Review', badgeBg: 'bg-amber-500', badgeText: 'text-white', icon: FileSearch, iconColor: 'text-amber-500' },
  { id: 'completed', label: 'Completed', badgeBg: 'bg-emerald-500', badgeText: 'text-white', icon: CheckCircle2, iconColor: 'text-emerald-500' },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'list' | 'timelines'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [availableTags, setAvailableTags] = useState<TagItem[]>([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState<number | 'all'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<Task['priority']>('medium');
  const [formStatus, setFormStatus] = useState<Task['status']>('todo');
  const [formDueDate, setFormDueDate] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formSubtasks, setFormSubtasks] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const [res, tagsRes] = await Promise.all([
        api.get('/tasks'),
        api.get('/tags'),
      ]);
      if (res.data?.success) {
        setTasks(res.data.data || []);
      }
      if (tagsRes.data?.success) {
        setAvailableTags(tagsRes.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    try {
      setSaving(true);
      const filteredSubtasks = formSubtasks
        .filter((s) => s.trim().length > 0)
        .map((s) => ({ title: s.trim() }));

      const parsedTags = formTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await api.post('/tasks', {
        title: formTitle,
        description: formDescription,
        priority: formPriority,
        status: formStatus,
        due_date: formDueDate || null,
        subtasks: filteredSubtasks,
        tags: parsedTags,
      });

      if (res.data?.success) {
        setIsCreateOpen(false);
        setFormTitle('');
        setFormDescription('');
        setFormPriority('medium');
        setFormStatus('todo');
        setFormDueDate('');
        setFormTags('');
        setFormSubtasks(['']);
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSubtask = async (subtask: Subtask, task: Task) => {
    try {
      const res = await api.patch(`/subtasks/${subtask.id}/toggle`);
      if (res.data?.success) {
        const updatedTask = {
          ...task,
          subtasks: task.subtasks?.map((s) =>
            s.id === subtask.id ? { ...s, is_completed: !s.is_completed } : s
          ),
        };
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)));
        if (selectedTask?.id === task.id) {
          setSelectedTask(updatedTask);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveTaskStatus = async (task: Task, newStatus: Task['status']) => {
    try {
      const res = await api.put(`/tasks/${task.id}`, { status: newStatus });
      if (res.data?.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        searchQuery === '' ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      const matchesTag =
        selectedTagFilter === 'all' ||
        task.tags?.some((t) => t.id === selectedTagFilter);

      return matchesSearch && matchesPriority && matchesTag;
    });
  }, [tasks, searchQuery, priorityFilter, selectedTagFilter]);

  const viewTabs = [
    { id: 'kanban', label: 'Kanban', icon: <KanbanIcon className="h-4 w-4" /> },
    { id: 'table', label: 'Table', icon: <TableIcon className="h-4 w-4" /> },
    { id: 'list', label: 'List', icon: <ListIcon className="h-4 w-4" /> },
    { id: 'timelines', label: 'Timelines', icon: <TimelineIcon className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Full-width Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search here..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 shadow-2xs transition"
          />
        </div>

        {/* Filter and New Task Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`h-11 px-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs flex items-center gap-2 cursor-pointer transition ${
                priorityFilter !== 'all' || selectedTagFilter !== 'all'
                  ? 'border-sky-400 text-sky-700 bg-sky-50/50'
                  : ''
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
              <span>Filter</span>
              {(priorityFilter !== 'all' || selectedTagFilter !== 'all') && (
                <span className="h-2 w-2 rounded-full bg-sky-600" />
              )}
            </button>

            {/* Filter Popover */}
            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl z-50 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">Filter Tasks</span>
                    {(priorityFilter !== 'all' || selectedTagFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setPriorityFilter('all');
                          setSelectedTagFilter('all');
                        }}
                        className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Priority
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['all', 'urgent', 'high', 'medium', 'low'].map((p) => (
                        <button
                          key={p}
                          onClick={() => setPriorityFilter(p)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize text-left transition cursor-pointer ${
                            priorityFilter === p
                              ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {availableTags.length > 0 && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Tags
                      </label>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                        <button
                          onClick={() => setSelectedTagFilter('all')}
                          className={`px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                            selectedTagFilter === 'all'
                              ? 'bg-sky-600 text-white font-bold'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          All Tags
                        </button>
                        {availableTags.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTagFilter(t.id)}
                            className={`px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                              selectedTagFilter === t.id
                                ? 'bg-sky-600 text-white font-bold'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            #{t.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="h-11 px-5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm shadow-sm flex items-center gap-2 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* View Switcher Tabs (Matching uploaded UI screenshot) */}
      <Tabs
        tabs={viewTabs}
        activeTab={viewMode}
        onChange={(id) => setViewMode(id as any)}
        className="pt-1"
      />

      {/* Main Content Area */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          title="No tasks found"
          description="Create your first task to start organizing your work and collaboration."
          actionLabel="Create New Task"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW — Exactly matching the user's uploaded images */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {COLUMNS.map((column) => {
            const colTasks = filteredTasks.filter((t) => t.status === column.id);

            return (
              <div key={column.id} className="flex flex-col gap-3 min-w-[260px]">
                {/* Column Header */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <column.icon className={`h-4 w-4 ${column.iconColor}`} />
                    <span className="text-xs font-bold text-slate-800">{column.label}</span>
                    <span
                      className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${column.badgeBg} ${column.badgeText}`}
                    >
                      {colTasks.length}
                    </span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </div>

                {/* Cards in Column */}
                <div className="space-y-3.5 min-h-[150px]">
                  <AnimatePresence mode="popLayout">
                    {colTasks.map((task) => {
                      const totalSubs = task.subtasks?.length || 0;
                      const completedSubs =
                        task.subtasks?.filter((s) => s.is_completed).length || 0;
                      const progressPercent =
                        totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;

                      return (
                        <motion.div
                          layout
                          layoutId={`task-card-${task.id}`}
                          initial={{ opacity: 0, y: 12, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.14 } }}
                          whileHover={{ y: -2 }}
                          transition={{ type: "spring", stiffness: 420, damping: 28 }}
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-md transition-shadow cursor-pointer space-y-3"
                        >
                          {/* Top: Priority Pill & More options */}
                          <div className="flex items-center justify-between">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                task.priority === 'high' || task.priority === 'urgent'
                                  ? 'bg-rose-50 text-rose-600'
                                  : task.priority === 'medium'
                                  ? 'bg-amber-50 text-amber-600'
                                  : 'bg-sky-50 text-sky-600'
                              }`}
                            >
                              {task.priority.toUpperCase()}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTask(task.id);
                              }}
                              title="Delete Task"
                              className="text-slate-300 group-hover:text-slate-500 hover:text-red-500 transition p-1 cursor-pointer"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Title & Description */}
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition leading-snug">
                              {task.title}
                            </h4>
                            {task.description && (
                              <p className="mt-1 text-xs text-slate-400 line-clamp-1 leading-relaxed">
                                {task.description}
                              </p>
                            )}
                          </div>

                          {/* Tags */}
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {task.tags.map((t) => (
                                <span
                                  key={t.id}
                                  className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-100"
                                >
                                  #{t.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Subtasks Progress Box (As shown in screenshot) */}
                          {totalSubs > 0 && (
                            <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                <div className="flex items-center gap-1.5">
                                  <ListChecks className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Sub Task</span>
                                </div>
                                <span className="text-slate-600 font-bold">
                                  {completedSubs}/{totalSubs}
                                </span>
                              </div>
                              {/* Smooth progress bar */}
                              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progressPercent}%` }}
                                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                  className="h-full bg-sky-500 rounded-full"
                                />
                              </div>
                            </div>
                          )}

                          {/* Due Date */}
                          <div className="text-[11px] font-normal text-slate-400">
                            Due Date :{' '}
                            <span className="font-medium text-slate-600">
                              {task.due_date
                                ? new Date(task.due_date).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '01 Nov 2025, 12:00 AM'}
                            </span>
                          </div>

                          {/* Bottom Row: Collaborators Stack, Paperclip, Comments (As in screenshot) */}
                          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                            <AvatarStack
                              users={[
                                { initials: 'UL', bgColor: 'bg-emerald-100 text-emerald-800' },
                                { initials: 'DM', bgColor: 'bg-slate-100 text-slate-700' },
                              ]}
                              max={2}
                            />

                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1 text-xs text-slate-600 font-medium shadow-2xs">
                                <Paperclip className="h-3 w-3 text-slate-400" />
                                <span>1</span>
                              </div>
                              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1 text-xs text-slate-600 font-medium shadow-2xs">
                                <MessageSquare className="h-3 w-3 text-slate-400" />
                                <span>{totalSubs || 1}</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE / LIST VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Task Title</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Priority</th>
                  <th className="px-4 py-3.5">Subtasks</th>
                  <th className="px-4 py-3.5">Due Date</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const totalSubs = task.subtasks?.length || 0;
                  const completedSubs =
                    task.subtasks?.filter((s) => s.is_completed).length || 0;

                  return (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="hover:bg-slate-50/70 transition cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900 text-sm">{task.title}</p>
                        {task.description && (
                          <p className="text-slate-500 text-xs truncate max-w-xs">
                            {task.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={task.status}>{task.status.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={task.priority}>{task.priority}</Badge>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {completedSubs}/{totalSubs}
                      </td>
                      <td className="px-4 py-4 text-slate-600 font-medium">
                        {task.due_date
                          ? new Date(task.due_date).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTask(task.id);
                          }}
                          className="text-slate-400 hover:text-red-600 transition p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE TASK MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Task"
        description="Add a task with subtasks and assign priorities."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleCreateTask}>
              Create Task
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input
            label="Task Title"
            placeholder="e.g. Set Up Meeting With Clients"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Provide context or instructions for this task..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as any)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="todo">To-Do</option>
                <option value="in_progress">On Progress</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <Input
            label="Due Date"
            type="date"
            value={formDueDate}
            onChange={(e) => setFormDueDate(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Tags (comma-separated)
            </label>
            <Input
              placeholder="e.g. Frontend, API, Sprint-3"
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
            />
          </div>

          {/* Subtasks Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Subtasks Checklist
              </label>
              <button
                type="button"
                onClick={() => setFormSubtasks([...formSubtasks, ''])}
                className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add Item
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {formSubtasks.map((sub, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder={`Subtask ${idx + 1}`}
                    value={sub}
                    onChange={(e) => {
                      const updated = [...formSubtasks];
                      updated[idx] = e.target.value;
                      setFormSubtasks(updated);
                    }}
                  />
                  {formSubtasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setFormSubtasks(formSubtasks.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-red-500 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* TASK DETAIL & EDIT SLIDE-OVER MODAL */}
      {selectedTask && (
        <Modal
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          title={selectedTask.title}
          description={`Created in ${selectedTask.category?.name || 'Workspace'}`}
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDeleteTask(selectedTask.id)}
              >
                Delete
              </Button>
              <Button size="sm" onClick={() => setSelectedTask(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Status & Priority selector */}
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Status
                </span>
                <select
                  value={selectedTask.status}
                  onChange={(e) =>
                    handleMoveTaskStatus(selectedTask, e.target.value as any)
                  }
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold focus:outline-none"
                >
                  <option value="todo">To-Do</option>
                  <option value="in_progress">On Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Priority
                </span>
                <Badge variant={selectedTask.priority}>{selectedTask.priority}</Badge>
              </div>
            </div>

            {/* Description */}
            {selectedTask.description && (
              <div>
                <h5 className="text-xs font-bold text-slate-700 uppercase mb-1">Description</h5>
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {selectedTask.description}
                </p>
              </div>
            )}

            {/* Interactive Subtasks checklist */}
            <div>
              <h5 className="text-xs font-bold text-slate-700 uppercase mb-2">
                Checklist ({selectedTask.subtasks?.filter((s) => s.is_completed).length || 0}/
                {selectedTask.subtasks?.length || 0})
              </h5>
              <div className="space-y-1.5">
                {selectedTask.subtasks && selectedTask.subtasks.length > 0 ? (
                  selectedTask.subtasks.map((sub) => (
                    <label
                      key={sub.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        checked={sub.is_completed}
                        onChange={() => handleToggleSubtask(sub, selectedTask)}
                        className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500"
                      />
                      <span
                        className={`text-sm ${
                          sub.is_completed ? 'line-through text-slate-400' : 'text-slate-800'
                        }`}
                      >
                        {sub.title}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No subtasks for this item.</p>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
