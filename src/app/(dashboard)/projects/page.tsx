'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Plus,
  Calendar,
  Clock,
  TrendingUp,
  Trash2,
  Edit2,
  CheckCircle2,
  Search,
  Archive,
  RotateCcw,
  Flag,
  Target,
  Check,
  Activity,
  AlertTriangle,
  Users,
} from 'lucide-react';
import api, { getCachedData, extractApiErrorMessage } from '@/lib/api';
import { showToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProjectsSkeleton } from '@/components/ui/Skeleton';
import { ProjectMembersModal } from '@/components/projects/ProjectMembersModal';

interface Milestone {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  due_date?: string;
  is_completed: boolean;
  order: number;
}

interface Project {
  id: number;
  title: string;
  description?: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  health: 'on_track' | 'at_risk' | 'off_track';
  progress: number;
  start_date?: string;
  deadline?: string;
  is_archived?: boolean;
  tasks_count?: number;
  completed_tasks_count?: number;
  milestones?: Milestone[];
  milestones_count?: number;
  completed_milestones_count?: number;
  members_count?: number;
  goal?: { id: number; title: string };
}

interface ProjectSummary {
  total: number;
  completed: number;
  in_progress: number;
  on_track: number;
  at_risk: number;
  off_track: number;
  archived: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>(() => getCachedData<Project[]>('/projects') || []);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !getCachedData('/projects'));
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [membersModalProject, setMembersModalProject] = useState<Project | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Project['status']>('planning');
  const [priority, setPriority] = useState<Project['priority']>('medium');
  const [health, setHealth] = useState<Project['health']>('on_track');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [goalId, setGoalId] = useState('');
  const [goalsList, setGoalsList] = useState<{ id: number; title: string }[]>([]);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchProjects = async (silent = false) => {
    try {
      if (!silent && projects.length === 0) {
        setLoading(true);
      }
      const [res, goalsRes] = await Promise.allSettled([
        api.get(`/projects?archived=${showArchived ? 1 : 0}`),
        api.get('/goals'),
      ]);

      if (res.status === 'fulfilled' && res.value.data?.success) {
        setProjects(res.value.data.data || []);
        if (res.value.data.summary) {
          setSummary(res.value.data.summary);
        }
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
    fetchProjects();
  }, [showArchived]);

  const openCreateModal = () => {
    setEditingProject(null);
    setTitle('');
    setDescription('');
    setStatus('planning');
    setPriority('medium');
    setHealth('on_track');
    setStartDate('');
    setDeadline('');
    setGoalId('');
    setIsModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setTitle(project.title);
    setDescription(project.description || '');
    setStatus(project.status);
    setPriority(project.priority);
    setHealth(project.health || 'on_track');
    setStartDate(project.start_date || '');
    setDeadline(project.deadline || '');
    setGoalId(project.goal?.id ? String(project.goal.id) : '');
    setIsModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setSaving(true);
      const payload = {
        title,
        description,
        status,
        priority,
        health,
        start_date: startDate || null,
        deadline: deadline || null,
        goal_id: goalId ? Number(goalId) : null,
      };

      if (editingProject) {
        await api.put(`/projects/${editingProject.id}`, payload);
      } else {
        await api.post('/projects', payload);
      }

      setIsModalOpen(false);
      fetchProjects();
      showToast(editingProject ? 'Proyek berhasil diperbarui' : 'Proyek berhasil dibuat', 'success');
    } catch (err: any) {
      showToast(extractApiErrorMessage(err, 'Gagal menyimpan proyek.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleArchive = async (project: Project) => {
    try {
      const res = await api.patch(`/projects/${project.id}/archive`);
      if (res.data?.success) {
        setProjects((prev) => prev.filter((p) => p.id !== project.id));
        fetchProjects(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMilestone = async (projectId: number, milestoneId: number) => {
    try {
      const res = await api.patch(`/projects/${projectId}/milestones/${milestoneId}/toggle`);
      if (res.data?.success) {
        const updatedMilestone = res.data.data.milestone;
        const newProgress = res.data.data.project_progress;

        setProjects((prev) =>
          prev.map((p) => {
            if (p.id === projectId) {
              const updatedMilestones = p.milestones?.map((m) =>
                m.id === milestoneId ? updatedMilestone : m
              );
              return {
                ...p,
                progress: newProgress,
                milestones: updatedMilestones,
              };
            }
            return p;
          })
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMilestone = async (projectId: number, milestoneId: number) => {
    try {
      const res = await api.delete(`/projects/${projectId}/milestones/${milestoneId}`);
      if (res.data?.success) {
        const newProgress = res.data.data?.project_progress;
        setProjects((prev) =>
          prev.map((p) => {
            if (p.id === projectId) {
              return {
                ...p,
                progress: typeof newProgress === 'number' ? newProgress : p.progress,
                milestones: p.milestones?.filter((m) => m.id !== milestoneId),
              };
            }
            return p;
          })
        );
      }
    } catch (err) {
      showToast(extractApiErrorMessage(err, 'Gagal menghapus milestone.'), 'error');
    }
  };

  const handleAddMilestone = async (projectId: number) => {
    if (!newMilestoneTitle.trim()) return;
    try {
      const res = await api.post(`/projects/${projectId}/milestones`, {
        title: newMilestoneTitle.trim(),
      });
      if (res.data?.success) {
        const added = res.data.data.milestone;
        const newProgress = res.data.data.project_progress;

        setProjects((prev) =>
          prev.map((p) => {
            if (p.id === projectId) {
              return {
                ...p,
                progress: newProgress,
                milestones: [...(p.milestones || []), added],
              };
            }
            return p;
          })
        );
        setNewMilestoneTitle('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await api.delete(`/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      showToast('Proyek berhasil dihapus', 'info');
    } catch (err) {
      showToast(extractApiErrorMessage(err, 'Gagal menghapus proyek.'), 'error');
      console.error(err);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        searchQuery === '' ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchHealth = healthFilter === 'all' || p.health === healthFilter;

      return matchSearch && matchStatus && matchHealth;
    });
  }, [projects, searchQuery, statusFilter, healthFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Project Management</h2>
          <p className="mt-1 text-xs text-slate-500">
            Track multi-stage initiatives, monitor milestones & tasks, and align collaborative workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Active vs Archived Filter Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setShowArchived(false)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                !showArchived ? 'bg-slate-900 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setShowArchived(true)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                showArchived ? 'bg-slate-900 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Archived ({summary?.archived || 0})
            </button>
          </div>

          <Button onClick={openCreateModal} leftIcon={<Plus className="h-4 w-4" />} className="bg-slate-900 text-white hover:bg-black">
            New Project
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && !showArchived && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
            <span className="text-xs font-semibold text-slate-500">Active Projects</span>
            <p className="text-2xl font-black text-slate-900 mt-1">{summary.total}</p>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
            <span className="text-xs font-semibold text-emerald-600">Completed</span>
            <p className="text-2xl font-black text-slate-900 mt-1">{summary.completed}</p>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
            <span className="text-xs font-semibold text-slate-700">On Track</span>
            <p className="text-2xl font-black text-slate-900 mt-1">{summary.on_track}</p>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
            <span className="text-xs font-semibold text-amber-600">At Risk / Attention</span>
            <p className="text-2xl font-black text-slate-900 mt-1">{summary.at_risk + summary.off_track}</p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none shadow-sm cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="planning">Planning</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
          </select>

          <select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none shadow-sm cursor-pointer"
          >
            <option value="all">All Health</option>
            <option value="on_track">🟢 On Track</option>
            <option value="at_risk">🟡 At Risk</option>
            <option value="off_track">🔴 Off Track</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {loading && projects.length === 0 ? (
        <ProjectsSkeleton />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={showArchived ? 'No archived projects' : 'No projects found'}
          description={showArchived ? 'You have not archived any projects yet.' : 'Create your first project to organize your team goals and milestones.'}
          actionLabel={showArchived ? undefined : 'Create Project'}
          onAction={showArchived ? undefined : openCreateModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const milestones = project.milestones || [];
            const completedMilestones = milestones.filter((m) => m.is_completed).length;

            return (
              <div
                key={project.id}
                className="group relative flex flex-col justify-between bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-md transition-shadow space-y-4"
              >
                <div>
                  {/* Top Bar: Status, Health & Priority Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={project.status}>{project.status.replace('_', ' ')}</Badge>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          project.health === 'off_track'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : project.health === 'at_risk'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {project.health ? project.health.replace('_', ' ') : 'on track'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setMembersModalProject(project)}
                        className="p-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                        title="Kelola Tim & Peran"
                      >
                        <Users className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openEditModal(project)}
                        className="p-1 text-slate-400 hover:text-slate-800 transition cursor-pointer"
                        title="Edit Project"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleArchive(project)}
                        className="p-1 text-slate-400 hover:text-amber-600 transition cursor-pointer"
                        title={project.is_archived ? 'Restore Project' : 'Archive Project'}
                      >
                        {project.is_archived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Delete Project"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="mt-3">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-black transition">
                      {project.title}
                    </h3>
                    {project.description && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {project.description}
                      </p>
                    )}
                  </div>

                  {/* Goal Badge */}
                  {project.goal && (
                    <div className="mt-2.5">
                      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100">
                        <Target className="h-3 w-3" />
                        {project.goal.title}
                      </span>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span>Unified Progress</span>
                      <span className="font-bold text-slate-900">{project.progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-900 rounded-full transition-all duration-300"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Milestones Checklist Accordion */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-1">
                        <Flag className="h-3.5 w-3.5 text-slate-500" /> Milestones ({completedMilestones}/{milestones.length})
                      </span>
                    </div>

                    {milestones.length > 0 && (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pt-1">
                        {milestones.map((m) => (
                          <div
                            key={m.id}
                            className="group flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition text-xs"
                          >
                            <label className="flex items-center gap-2 cursor-pointer truncate flex-1">
                              <input
                                type="checkbox"
                                checked={m.is_completed}
                                onChange={() => handleToggleMilestone(project.id, m.id)}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                              />
                              <span className={`truncate ${m.is_completed ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>
                                {m.title}
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDeleteMilestone(project.id, m.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-600 transition"
                              title="Delete milestone"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quick Add Milestone Input */}
                    <div className="flex items-center gap-1 pt-1">
                      <input
                        type="text"
                        placeholder="Add milestone..."
                        value={editingProject?.id === project.id ? newMilestoneTitle : ''}
                        onFocus={() => setEditingProject(project)}
                        onChange={(e) => setNewMilestoneTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddMilestone(project.id);
                          }
                        }}
                        className="flex-1 h-7 px-2 text-[11px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddMilestone(project.id)}
                        className="h-7 px-2 rounded-lg bg-slate-900 text-white text-[11px] font-semibold hover:bg-black transition cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer Metadata */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {project.deadline
                          ? `Due ${new Date(project.deadline).toLocaleDateString()}`
                          : 'No deadline'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMembersModalProject(project)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition cursor-pointer"
                    >
                      <Users className="h-3 w-3" />
                      <span>{project.members_count || 1} anggota</span>
                    </button>
                  </div>

                  <Link
                    href={`/tasks?project=${project.id}`}
                    className="font-bold text-slate-800 hover:text-black transition"
                  >
                    View {project.tasks_count || 0} Tasks →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT PROJECT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProject ? 'Edit Project' : 'Create New Project'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveProject} className="space-y-4">
          <Input
            label="Project Title"
            placeholder="e.g. Mobile App Redesign Sprint"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Outline project deliverables and success criteria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="planning">Planning</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Health Status
              </label>
              <select
                value={health}
                onChange={(e) => setHealth(e.target.value as any)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="on_track">🟢 On Track</option>
                <option value="at_risk">🟡 At Risk</option>
                <option value="off_track">🔴 Off Track</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
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
                Link to Goal / OKR
              </label>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="">No Linked Goal</option>
                {goalsList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="Deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="bg-slate-900 text-white hover:bg-black">
              {editingProject ? 'Save Changes' : 'Create Project'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* TEAM MEMBERS & ROLES MODAL */}
      {membersModalProject && (
        <ProjectMembersModal
          isOpen={!!membersModalProject}
          projectId={membersModalProject.id}
          projectTitle={membersModalProject.title}
          onClose={() => {
            setMembersModalProject(null);
            fetchProjects(true);
          }}
        />
      )}
    </div>
  );
}
