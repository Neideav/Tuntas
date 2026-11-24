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
  Check,
  Lock,
  Target,
  RefreshCw,
  Folder,
} from 'lucide-react';
import api, { getCachedData, extractApiErrorMessage } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { TaskBoardSkeleton } from '@/components/ui/Skeleton';

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

interface TaskDependency {
  id: number;
  title: string;
  status: string;
}

interface Task {
  id: number;
  title: string;
  description?: string | null;
  status: 'todo' | 'in_progress' | 'in_review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string | null;
  start_date?: string | null;
  project_id?: number | null;
  category_id?: number | null;
  goal_id?: number | null;
  is_recurring?: boolean;
  recurrence_pattern?: 'daily' | 'weekly' | 'monthly' | null;
  subtasks?: Subtask[];
  tags?: TagItem[];
  project?: { id: number; title: string };
  category?: { id: number; name: string };
  goal?: { id: number; title: string };
  dependencies?: TaskDependency[];
  dependents?: TaskDependency[];
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
  const [tasks, setTasks] = useState<Task[]>(() => getCachedData<Task[]>('/tasks') || []);
  const [loading, setLoading] = useState<boolean>(() => !getCachedData('/tasks'));
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'list' | 'timelines'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [availableTags, setAvailableTags] = useState<TagItem[]>([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState<number | 'all'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Bulk Selection State
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  // Drag and Drop active column highlight
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Referenced Resources for Dropdowns
  const [projectsList, setProjectsList] = useState<{ id: number; title: string }[]>([]);
  const [goalsList, setGoalsList] = useState<{ id: number; title: string }[]>([]);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Form State (Create)
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<Task['priority']>('medium');
  const [formStatus, setFormStatus] = useState<Task['status']>('todo');
  const [formDueDate, setFormDueDate] = useState('');
  const [formProjectId, setFormProjectId] = useState<string>('');
  const [formGoalId, setFormGoalId] = useState<string>('');
  const [formDependencies, setFormDependencies] = useState<number[]>([]);
  const [formIsRecurring, setFormIsRecurring] = useState(false);
  const [formRecurrencePattern, setFormRecurrencePattern] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [formTags, setFormTags] = useState('');
  const [formSubtasks, setFormSubtasks] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);

  // Edit Task State
  const [taskEditTitle, setTaskEditTitle] = useState('');
  const [taskEditDescription, setTaskEditDescription] = useState('');
  const [taskEditPriority, setTaskEditPriority] = useState<Task['priority']>('medium');
  const [taskEditStatus, setTaskEditStatus] = useState<Task['status']>('todo');
  const [taskEditDueDate, setTaskEditDueDate] = useState('');
  const [taskEditProjectId, setTaskEditProjectId] = useState<string>('');
  const [taskEditGoalId, setTaskEditGoalId] = useState<string>('');
  const [taskEditDependencies, setTaskEditDependencies] = useState<number[]>([]);
  const [taskEditIsRecurring, setTaskEditIsRecurring] = useState(false);
  const [taskEditRecurrencePattern, setTaskEditRecurrencePattern] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [savingEditTask, setSavingEditTask] = useState(false);

  const openTaskDetail = (task: Task) => {
    setSelectedTask(task);
    setTaskEditTitle(task.title);
    setTaskEditDescription(task.description || '');
    setTaskEditPriority(task.priority);
    setTaskEditStatus(task.status);
    setTaskEditDueDate(task.due_date ? task.due_date.split('T')[0] : '');
    setTaskEditProjectId(task.project_id ? String(task.project_id) : '');
    setTaskEditGoalId(task.goal_id ? String(task.goal_id) : '');
    setTaskEditDependencies(task.dependencies?.map((d) => d.id) || []);
    setTaskEditIsRecurring(!!task.is_recurring);
    setTaskEditRecurrencePattern(task.recurrence_pattern || 'daily');
    setNewSubtaskTitle('');
  };

  const handleSaveTaskEdits = async () => {
    if (!selectedTask || !taskEditTitle.trim()) return;
    try {
      setSavingEditTask(true);
      const res = await api.put(`/tasks/${selectedTask.id}`, {
        title: taskEditTitle,
        description: taskEditDescription,
        priority: taskEditPriority,
        status: taskEditStatus,
        due_date: taskEditDueDate || null,
        project_id: taskEditProjectId ? Number(taskEditProjectId) : null,
        goal_id: taskEditGoalId ? Number(taskEditGoalId) : null,
        dependencies: taskEditDependencies,
        is_recurring: taskEditIsRecurring,
        recurrence_pattern: taskEditIsRecurring ? taskEditRecurrencePattern : null,
      });

      if (res.data?.success) {
        fetchTasks();
        setSelectedTask(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyimpan perubahan tugas.');
    } finally {
      setSavingEditTask(false);
    }
  };

  const handleAddModalSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newSubtaskTitle.trim()) return;
    try {
      const res = await api.post(`/tasks/${selectedTask.id}/subtasks`, {
        title: newSubtaskTitle.trim(),
      });
      if (res.data?.success) {
        const added = res.data.data;
        const updatedSubs = [...(selectedTask.subtasks || []), added];
        const updatedTask = { ...selectedTask, subtasks: updatedSubs };
        setSelectedTask(updatedTask);
        setTasks((prev) => prev.map((t) => (t.id === selectedTask.id ? updatedTask : t)));
        setNewSubtaskTitle('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSubtask = async (subtaskId: number) => {
    if (!selectedTask) return;
    try {
      const res = await api.delete(`/subtasks/${subtaskId}`);
      if (res.data?.success) {
        const updatedSubs = (selectedTask.subtasks || []).filter((s) => s.id !== subtaskId);
        const updatedTask = { ...selectedTask, subtasks: updatedSubs };
        setSelectedTask(updatedTask);
        setTasks((prev) => prev.map((t) => (t.id === selectedTask.id ? updatedTask : t)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTasks = async (silent = false) => {
    try {
      if (!silent && tasks.length === 0) {
        setLoading(true);
      }
      const [res, tagsRes, projRes, goalsRes] = await Promise.allSettled([
        api.get('/tasks'),
        api.get('/tags'),
        api.get('/projects'),
        api.get('/goals'),
      ]);

      if (res.status === 'fulfilled' && res.value.data?.success) {
        setTasks(res.value.data.data || []);
      }
      if (tagsRes.status === 'fulfilled' && tagsRes.value.data?.success) {
        setAvailableTags(tagsRes.value.data.data || []);
      }
      if (projRes.status === 'fulfilled' && projRes.value.data?.success) {
        setProjectsList(projRes.value.data.data || []);
      }
      if (goalsRes.status === 'fulfilled' && goalsRes.value.data?.success) {
        setGoalsList(goalsRes.value.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const hasCache = !!getCachedData('/tasks');
    fetchTasks(hasCache);
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
        project_id: formProjectId ? Number(formProjectId) : null,
        goal_id: formGoalId ? Number(formGoalId) : null,
        dependencies: formDependencies,
        is_recurring: formIsRecurring,
        recurrence_pattern: formIsRecurring ? formRecurrencePattern : null,
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
        setFormProjectId('');
        setFormGoalId('');
        setFormDependencies([]);
        setFormIsRecurring(false);
        setFormTags('');
        setFormSubtasks(['']);
        fetchTasks();
      }
    } catch (err: any) {
      alert(extractApiErrorMessage(err, 'Gagal membuat tugas.'));
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

  // Drag-and-drop status update with optimistic sync
  const handleDropStatus = async (taskId: number, newStatus: Task['status']) => {
    setDragOverColumn(null);
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask || targetTask.status === newStatus) return;

    if (newStatus === 'completed' && targetTask.dependencies?.some((d) => d.status !== 'completed')) {
      alert('Tugas tidak dapat diselesaikan karena ada tugas prasyarat yang belum selesai.');
      return;
    }

    const previousStatus = targetTask.status;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      const res = await api.put(`/tasks/${taskId}`, { status: newStatus });
      if (!res.data?.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t))
        );
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal memindahkan tugas.');
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t))
      );
    }
  };

  const handleQuickToggleTask = async (task: Task) => {
    const newStatus: Task['status'] = task.status === 'completed' ? 'todo' : 'completed';

    if (newStatus === 'completed' && task.dependencies?.some((d) => d.status !== 'completed')) {
      alert('Tugas tidak dapat diselesaikan karena ada tugas prasyarat yang belum selesai.');
      return;
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );
    try {
      const res = await api.patch(`/tasks/${task.id}/toggle`);
      if (!res.data?.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
        );
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengubah status tugas.');
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
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

  // Bulk actions processor
  const handleBulkAction = async (action: 'status' | 'delete', statusVal?: string) => {
    if (selectedTaskIds.length === 0) return;
    if (action === 'delete' && !confirm(`Hapus ${selectedTaskIds.length} tugas yang dipilih?`)) return;

    try {
      setIsBulkLoading(true);
      const res = await api.post('/tasks/bulk', {
        action,
        task_ids: selectedTaskIds,
        status: statusVal,
      });

      if (res.data?.success) {
        if (action === 'delete') {
          setTasks((prev) => prev.filter((t) => !selectedTaskIds.includes(t.id)));
        } else if (action === 'status' && statusVal) {
          setTasks((prev) =>
            prev.map((t) =>
              selectedTaskIds.includes(t.id) ? { ...t, status: statusVal as any } : t
            )
          );
        }
        setSelectedTaskIds([]);
        fetchTasks();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal memproses aksi massal.');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const toggleSelectTask = (taskId: number) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTaskIds.length === filteredTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredTasks.map((t) => t.id));
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

  const timelineBuckets = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const nextWeekEnd = new Date(todayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);

    const overdue: Task[] = [];
    const today: Task[] = [];
    const thisWeek: Task[] = [];
    const later: Task[] = [];
    const noDate: Task[] = [];

    filteredTasks.forEach((task) => {
      if (!task.due_date) {
        noDate.push(task);
        return;
      }
      const due = new Date(task.due_date);
      if (due < todayStart && task.status !== 'completed') {
        overdue.push(task);
      } else if (due >= todayStart && due <= todayEnd) {
        today.push(task);
      } else if (due > todayEnd && due <= nextWeekEnd) {
        thisWeek.push(task);
      } else {
        later.push(task);
      }
    });

    return [
      { id: 'overdue', label: 'Overdue', color: 'bg-rose-500', badgeBg: 'bg-rose-50 text-rose-700 border-rose-200', tasks: overdue },
      { id: 'today', label: "Today's Schedule", color: 'bg-slate-900', badgeBg: 'bg-slate-100 text-slate-800 border-slate-300', tasks: today },
      { id: 'thisWeek', label: 'Coming Up Next (7 Days)', color: 'bg-amber-500', badgeBg: 'bg-amber-50 text-amber-700 border-amber-200', tasks: thisWeek },
      { id: 'later', label: 'Later Horizons', color: 'bg-emerald-500', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200', tasks: later },
      { id: 'noDate', label: 'No Due Date Assigned', color: 'bg-slate-400', badgeBg: 'bg-slate-50 text-slate-600 border-slate-200', tasks: noDate },
    ].filter((b) => b.tasks.length > 0);
  }, [filteredTasks]);

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
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-100 shadow-2xs transition"
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
                  ? 'border-slate-900 text-slate-900 bg-slate-100 font-bold'
                  : ''
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
              <span>Filter</span>
              {(priorityFilter !== 'all' || selectedTagFilter !== 'all') && (
                <span className="h-2 w-2 rounded-full bg-slate-900" />
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
                        className="text-[11px] font-semibold text-slate-700 hover:text-black cursor-pointer"
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
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize text-left transition cursor-pointer ${
                            priorityFilter === p
                              ? 'bg-slate-900 text-white font-bold shadow-xs'
                              : 'text-slate-600 hover:bg-slate-100'
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
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                            selectedTagFilter === 'all'
                              ? 'bg-slate-900 text-white font-bold'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          All Tags
                        </button>
                        {availableTags.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTagFilter(t.id)}
                            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                              selectedTagFilter === t.id
                                ? 'bg-slate-900 text-white font-bold'
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
            className="h-11 px-5 rounded-xl bg-[#19191D] hover:bg-black active:bg-[#111113] text-white font-semibold text-sm shadow-xs hover:shadow-sm flex items-center gap-2 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <Tabs
        tabs={viewTabs}
        activeTab={viewMode}
        onChange={(id) => setViewMode(id as any)}
        className="pt-1"
      />

      {/* Main Content Area */}
      {loading && tasks.length === 0 ? (
        <TaskBoardSkeleton />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          title="No tasks found"
          description="Create your first task to start organizing your work and collaboration."
          actionLabel="Create New Task"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW With Drag and Drop */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {COLUMNS.map((column) => {
            const colTasks = filteredTasks.filter((t) => t.status === column.id);
            const isColumnOver = dragOverColumn === column.id;

            return (
              <div
                key={column.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverColumn(column.id);
                }}
                onDragLeave={() => {
                  if (dragOverColumn === column.id) setDragOverColumn(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskIdStr = e.dataTransfer.getData('text/plain');
                  const tId = Number(taskIdStr);
                  if (tId) handleDropStatus(tId, column.id);
                }}
                className={`flex flex-col gap-3 min-w-[260px] rounded-2xl p-1 transition-colors ${
                  isColumnOver ? 'bg-slate-100 ring-2 ring-slate-400 ring-dashed' : ''
                }`}
              >
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
                <div className="space-y-3.5 min-h-[160px]">
                  <AnimatePresence mode="popLayout">
                    {colTasks.map((task) => {
                      const totalSubs = task.subtasks?.length || 0;
                      const completedSubs =
                        task.subtasks?.filter((s) => s.is_completed).length || 0;
                      const progressPercent =
                        totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;
                      const hasDependencies = (task.dependencies?.length || 0) > 0;
                      const isBlocked = task.dependencies?.some((d) => d.status !== 'completed');

                      return (
                        <motion.div
                          layout
                          layoutId={`task-card-${task.id}`}
                          initial={{ opacity: 0, y: 12, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.14 } }}
                          whileHover={{ y: -2 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                          key={task.id}
                          draggable
                          onDragStart={(e: any) => {
                            e.dataTransfer?.setData('text/plain', String(task.id));
                          }}
                          onClick={() => openTaskDetail(task)}
                          className={`group bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-md transition cursor-grab active:cursor-grabbing space-y-3 ${
                            selectedTaskIds.includes(task.id)
                              ? 'border-slate-900 ring-2 ring-slate-900/10'
                              : 'border-slate-200/80'
                          }`}
                        >
                          {/* Top: Selection Checkbox, Priority Pill & More options */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedTaskIds.includes(task.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleSelectTask(task.id);
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                              />
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                  task.priority === 'high' || task.priority === 'urgent'
                                    ? 'bg-rose-50 text-rose-600'
                                    : task.priority === 'medium'
                                    ? 'bg-amber-50 text-amber-600'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {task.priority.toUpperCase()}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openTaskDetail(task);
                              }}
                              title="Edit Task Details"
                              className="text-slate-300 group-hover:text-slate-600 hover:text-black transition p-1 cursor-pointer"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Title & Description */}
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 group-hover:text-black transition leading-snug">
                              {task.title}
                            </h4>
                            {task.description && (
                              <p className="mt-1 text-xs text-slate-400 line-clamp-1 leading-relaxed">
                                {task.description}
                              </p>
                            )}
                          </div>

                          {/* Badges: Goal, Dependencies, Recurrence */}
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {task.goal && (
                              <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100">
                                <Target className="h-3 w-3" />
                                {task.goal.title}
                              </span>
                            )}
                            {hasDependencies && (
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${
                                  isBlocked
                                    ? 'text-amber-800 bg-amber-50 border-amber-200'
                                    : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                }`}
                              >
                                <Lock className="h-3 w-3" />
                                {isBlocked ? `Blocked (${task.dependencies!.length})` : 'Dependencies Met'}
                              </span>
                            )}
                            {task.is_recurring && (
                              <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100">
                                <RefreshCw className="h-3 w-3" />
                                {task.recurrence_pattern}
                              </span>
                            )}
                          </div>

                          {/* Tags */}
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {task.tags.map((t) => (
                                <span
                                  key={t.id}
                                  className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200"
                                >
                                  #{t.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Subtasks Progress Box */}
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
                              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progressPercent}%` }}
                                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                                  className="h-full bg-slate-900 rounded-full"
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
                                : 'No deadline'}
                            </span>
                          </div>

                          {/* Bottom Row */}
                          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                            {task.project?.title ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                <Folder className="h-3 w-3" />
                                {task.project.title}
                              </span>
                            ) : task.category?.name ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                {task.category.name}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400">General</span>
                            )}

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickToggleTask(task);
                                }}
                                title={task.status === 'completed' ? 'Mark Incomplete' : 'Mark Completed'}
                                className={`flex items-center gap-1 rounded-xl border px-2 py-1 text-xs font-semibold shadow-2xs transition ${
                                  task.status === 'completed'
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                                }`}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
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
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="w-10 px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.length === filteredTasks.length && filteredTasks.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3.5">Task Title</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Priority</th>
                  <th className="px-4 py-3.5">Subtasks</th>
                  <th className="px-4 py-3.5">Project / Goal</th>
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
                      onClick={() => openTaskDetail(task)}
                      className="hover:bg-slate-50/70 transition cursor-pointer"
                    >
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.includes(task.id)}
                          onChange={() => toggleSelectTask(task.id)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-900 text-sm">{task.title}</p>
                        {task.description && (
                          <p className="text-slate-500 text-xs truncate max-w-xs">{task.description}</p>
                        )}
                        {task.dependencies && task.dependencies.length > 0 && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            <Lock className="h-3 w-3" /> Depends on {task.dependencies.length} tasks
                          </span>
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
                      <td className="px-4 py-4">
                        {task.project?.title && (
                          <span className="block text-[11px] font-semibold text-slate-700 truncate max-w-[120px]">
                            📁 {task.project.title}
                          </span>
                        )}
                        {task.goal?.title && (
                          <span className="block text-[11px] font-semibold text-indigo-700 truncate max-w-[120px]">
                            🎯 {task.goal.title}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-600 font-medium">
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-slate-400 hover:text-red-600 transition p-1 cursor-pointer"
                          title="Hapus Tugas"
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
      ) : viewMode === 'list' ? (
        /* LIST VIEW */
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const totalSubs = task.subtasks?.length || 0;
            const completedSubs =
              task.subtasks?.filter((s) => s.is_completed).length || 0;

            return (
              <div
                key={task.id}
                onClick={() => openTaskDetail(task)}
                className="group flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-sm transition cursor-pointer"
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.includes(task.id)}
                      onChange={() => toggleSelectTask(task.id)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuickToggleTask(task)}
                      className={`h-5 w-5 rounded-full border flex items-center justify-center transition cursor-pointer ${
                        task.status === 'completed'
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-300 hover:border-slate-400 bg-white'
                      }`}
                    >
                      {task.status === 'completed' && <Check className="h-3 w-3 stroke-[3]" />}
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-bold truncate ${
                          task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </span>
                      {task.project && (
                        <span className="shrink-0 text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {task.project.title}
                        </span>
                      )}
                      {task.goal && (
                        <span className="shrink-0 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                          🎯 {task.goal.title}
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{task.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {totalSubs > 0 && (
                    <span className="text-[11px] font-medium text-slate-500 hidden sm:flex items-center gap-1">
                      <ListChecks className="h-3.5 w-3.5 text-slate-400" />
                      {completedSubs}/{totalSubs}
                    </span>
                  )}

                  <Badge variant={task.priority}>{task.priority}</Badge>
                  <Badge variant={task.status}>{task.status.replace('_', ' ')}</Badge>

                  {task.due_date && (
                    <span className="text-xs text-slate-500 hidden sm:flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTask(task.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    title="Delete task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DEDICATED TIMELINES VIEW */
        <div className="space-y-8 relative pl-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {timelineBuckets.map((bucket) => (
            <div key={bucket.id} className="relative space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white ${bucket.color} ring-4 ring-slate-100`}
                />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">{bucket.label}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${bucket.badgeBg}`}>
                  {bucket.tasks.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
                {bucket.tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => openTaskDetail(task)}
                    className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant={task.priority}>{task.priority}</Badge>
                      <Badge variant={task.status}>{task.status.replace('_', ' ')}</Badge>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{task.title}</h4>
                    {task.due_date && (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {new Date(task.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedTaskIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 text-xs font-semibold"
          >
            <span className="font-bold text-slate-300">
              {selectedTaskIds.length} tasks selected
            </span>
            <div className="h-4 w-px bg-slate-700" />
            <button
              onClick={() => handleBulkAction('status', 'completed')}
              disabled={isBulkLoading}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition cursor-pointer flex items-center gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Mark Complete</span>
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              disabled={isBulkLoading}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
            <button
              onClick={() => setSelectedTaskIds([])}
              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CREATE TASK MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Task"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input
            label="Task Title"
            placeholder="e.g. Set Up Architecture Design"
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
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-100"
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
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-900 focus:outline-none"
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
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="todo">To-Do</option>
                <option value="in_progress">On Progress</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Project Link
              </label>
              <select
                value={formProjectId}
                onChange={(e) => setFormProjectId(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="">No Project</option>
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Goal / OKR Link
              </label>
              <select
                value={formGoalId}
                onChange={(e) => setFormGoalId(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="">No Goal</option>
                {goalsList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="Due Date"
            type="date"
            value={formDueDate}
            onChange={(e) => setFormDueDate(e.target.value)}
          />

          {/* Recurrence Toggle */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-slate-500" /> Recurring Task Engine
              </span>
              <input
                type="checkbox"
                checked={formIsRecurring}
                onChange={(e) => setFormIsRecurring(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
              />
            </div>
            {formIsRecurring && (
              <div className="flex items-center gap-2 pt-1">
                <label className="text-xs text-slate-600 font-medium">Repeat Pattern:</label>
                <select
                  value={formRecurrencePattern}
                  onChange={(e) => setFormRecurrencePattern(e.target.value as any)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}
          </div>

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
                className="text-xs font-bold text-slate-800 hover:text-black flex items-center gap-1 cursor-pointer"
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
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="bg-slate-900 text-white hover:bg-black">
              Create Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* TASK DETAIL / EDIT MODAL */}
      {selectedTask && (
        <Modal
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          title="Task Details"
          maxWidth="lg"
        >
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Title
              </label>
              <Input
                value={taskEditTitle}
                onChange={(e) => setTaskEditTitle(e.target.value)}
                placeholder="Task title"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={taskEditDescription}
                onChange={(e) => setTaskEditDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-100"
                placeholder="Description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={taskEditStatus}
                  onChange={(e) => setTaskEditStatus(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                >
                  <option value="todo">To-Do</option>
                  <option value="in_progress">On Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Priority
                </label>
                <select
                  value={taskEditPriority}
                  onChange={(e) => setTaskEditPriority(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Project
                </label>
                <select
                  value={taskEditProjectId}
                  onChange={(e) => setTaskEditProjectId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                >
                  <option value="">No Project</option>
                  {projectsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Goal / OKR
                </label>
                <select
                  value={taskEditGoalId}
                  onChange={(e) => setTaskEditGoalId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                >
                  <option value="">No Goal</option>
                  {goalsList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Input
              label="Due Date"
              type="date"
              value={taskEditDueDate}
              onChange={(e) => setTaskEditDueDate(e.target.value)}
            />

            {/* Subtasks Section */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Subtasks ({selectedTask.subtasks?.filter((s) => s.is_completed).length || 0}/
                {selectedTask.subtasks?.length || 0})
              </label>

              <div className="space-y-1.5 max-h-44 overflow-y-auto mb-3">
                {selectedTask.subtasks && selectedTask.subtasks.length > 0 ? (
                  selectedTask.subtasks.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/60"
                    >
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sub.is_completed}
                          onChange={() => handleToggleSubtask(sub, selectedTask)}
                          className="h-4 w-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer"
                        />
                        <span className={sub.is_completed ? 'line-through text-slate-400' : ''}>
                          {sub.title}
                        </span>
                      </label>
                      <button
                        onClick={() => handleDeleteSubtask(sub.id)}
                        className="text-slate-400 hover:text-red-500 p-0.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No subtasks added yet.</p>
                )}
              </div>

              <form onSubmit={handleAddModalSubtask} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a new subtask item..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-xl border border-slate-200 text-xs focus:border-slate-900 focus:outline-none"
                />
                <Button size="sm" type="submit" className="bg-slate-900 text-white hover:bg-black">
                  Add
                </Button>
              </form>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => handleDeleteTask(selectedTask.id)}
                className="text-rose-600 hover:bg-rose-50 border-rose-200"
              >
                Delete Task
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setSelectedTask(null)}>
                  Close
                </Button>
                <Button
                  onClick={handleSaveTaskEdits}
                  loading={savingEditTask}
                  className="bg-slate-900 text-white hover:bg-black"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
