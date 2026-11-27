'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  LayoutDashboard,
  CheckSquare,
  Users,
  Shield,
  FileText,
  ClipboardCheck,
  History,
  Settings,
  Plus,
  ExternalLink,
  Loader2,
  Calendar,
  AlertCircle,
  Clock,
  ChevronRight,
  Target,
  Edit2,
  Archive,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';
import { PermissionMatrix, PermissionGroup } from '@/components/roles/PermissionMatrix';
import { RoleModal } from '@/components/roles/RoleModal';
import { showToast } from '@/components/ui/Toast';

interface Milestone {
  id: number;
  title: string;
  is_completed: boolean;
  due_date?: string | null;
}

interface Project {
  id: number;
  title: string;
  description?: string | null;
  status: any;
  priority: any;
  health: any;
  progress_percentage?: number;
  start_date?: string | null;
  deadline?: string | null;
  is_archived?: boolean;
  category?: { id: number; name: string; color: string } | null;
  goal?: { id: number; title: string } | null;
  milestones?: Milestone[];
}

interface ProjectDetailModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated?: () => void;
}

type ProjectTab = 'overview' | 'tasks' | 'members' | 'roles' | 'notes' | 'reports' | 'activity' | 'settings';

export function ProjectDetailModal({ project, isOpen, onClose, onProjectUpdated }: ProjectDetailModalProps) {
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');

  // Sub-tab Data States
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<Record<string, PermissionGroup>>({});
  const [notes, setNotes] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals for Role Management inside Roles tab
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);

  // Settings tab form state
  const [settingsTitle, setSettingsTitle] = useState('');
  const [settingsDesc, setSettingsDesc] = useState('');
  const [settingsStatus, setSettingsStatus] = useState('planning');
  const [settingsHealth, setSettingsHealth] = useState('on_track');
  const [settingsPriority, setSettingsPriority] = useState('medium');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const fetchTabData = useCallback(async (tab: ProjectTab, projId: number) => {
    setLoading(true);
    try {
      if (tab === 'tasks') {
        const res = await api.get('/tasks', { params: { project_id: projId } });
        if (res.data?.success) setTasks(res.data.data || []);
      } else if (tab === 'members') {
        const res = await api.get(`/projects/${projId}/members`);
        if (res.data?.success) setMembers(res.data.data?.members || []);
      } else if (tab === 'roles') {
        const res = await api.get(`/projects/${projId}/roles`);
        if (res.data?.success) {
          setRoles(res.data.data?.roles || res.data.data || []);
          if (res.data.data?.catalog) setCatalog(res.data.data.catalog);
        }
      } else if (tab === 'notes') {
        const res = await api.get('/notes', { params: { project_id: projId } });
        if (res.data?.success) setNotes(res.data.data || []);
      } else if (tab === 'reports') {
        const res = await api.get('/reports', { params: { project_id: projId } });
        if (res.data?.success) setReports(res.data.data || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (project && isOpen) {
      setSettingsTitle(project.title);
      setSettingsDesc(project.description || '');
      setSettingsStatus(project.status || 'planning');
      setSettingsHealth(project.health || 'on_track');
      setSettingsPriority(project.priority || 'medium');
      fetchTabData(activeTab, project.id);
    }
  }, [project, isOpen, activeTab, fetchTabData]);

  if (!isOpen || !project) return null;

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await api.put(`/projects/${project.id}`, {
        title: settingsTitle,
        description: settingsDesc,
        status: settingsStatus,
        health: settingsHealth,
        priority: settingsPriority,
      });
      if (res.data?.success) {
        showToast('Pengaturan proyek berhasil disimpan.', 'success');
        onProjectUpdated?.();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Gagal menyimpan pengaturan.', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const tabs: Array<{ id: ProjectTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="h-4 w-4" /> },
    { id: 'members', label: 'Members', icon: <Users className="h-4 w-4" /> },
    { id: 'roles', label: 'Roles & Permissions', icon: <Shield className="h-4 w-4" /> },
    { id: 'notes', label: 'Notes', icon: <FileText className="h-4 w-4" /> },
    { id: 'reports', label: 'Reports', icon: <ClipboardCheck className="h-4 w-4" /> },
    { id: 'activity', label: 'Activity', icon: <History className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-5xl h-[88vh] bg-white rounded-2xl border border-slate-200/90 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-slate-900 text-white font-bold text-sm shrink-0">
              {project.title.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 truncate">{project.title}</h2>
                <Badge variant={project.status}>{project.status.replace('_', ' ')}</Badge>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">{project.description || 'Proyek kolaboratif'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-100 bg-slate-50/60 overflow-x-auto shrink-0 scrollbar-none">
          {tabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'border-slate-900 text-slate-900 bg-white/70 rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-4xl">
              {/* Progress & Health Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-xs font-semibold text-slate-400">Progres Keseluruhan</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-slate-900">{project.progress_percentage}%</span>
                    <span className="text-xs text-slate-500">selesai</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${project.progress_percentage}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-xs font-semibold text-slate-400">Kesehatan Proyek</span>
                  <p className="text-base font-bold text-slate-800 mt-1 capitalize">
                    {project.health?.replace('_', ' ') || 'On Track'}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">Prioritas: <span className="font-semibold text-slate-700 capitalize">{project.priority}</span></p>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-xs font-semibold text-slate-400">Tenggat Waktu</span>
                  <p className="text-base font-bold text-slate-800 mt-1">
                    {project.deadline ? new Date(project.deadline).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Tidak ada'}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">Mulai: {project.start_date || '-'}</p>
                </div>
              </div>

              {/* Milestones List */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Milestone Proyek</h3>
                {project.milestones && project.milestones.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {project.milestones.map((m) => (
                      <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={m.is_completed}
                            readOnly
                            className="rounded border-slate-300 text-slate-900 pointer-events-none"
                          />
                          <span className={m.is_completed ? 'line-through text-slate-400' : 'font-medium text-slate-700'}>
                            {m.title}
                          </span>
                        </div>
                        {m.due_date && <span className="text-slate-400">{m.due_date}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Belum ada milestone pada proyek ini.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TASKS */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Tugas Proyek ({tasks.length})</h3>
                <Link
                  href={`/tasks?project_id=${project.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Kelola di Halaman Tasks <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
              ) : tasks.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center bg-white rounded-xl border border-slate-200">Belum ada tugas pada proyek ini.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {tasks.map((t) => (
                    <div key={t.id} className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">{t.title}</h4>
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{t.description || 'Tidak ada deskripsi'}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={t.status}>{t.status}</Badge>
                          {t.due_date && <span className="text-[10px] text-slate-400">📅 {t.due_date}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MEMBERS */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Anggota Tim ({members.length})</h3>
              </div>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-2xs">
                  {members.map((m) => (
                    <div key={m.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                          {m.user?.name ? m.user.name.substring(0, 2).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{m.user?.name}</p>
                          <p className="text-[11px] text-slate-400">{m.user?.email}</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {m.role_name || m.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ROLES & PERMISSIONS */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Peran & Matriks Hak Akses</h3>
                  <p className="text-xs text-slate-400">Konfigurasi peran dan hak akses pada proyek ini.</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => { setEditingRole(null); setIsRoleModalOpen(true); }}
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  className="bg-slate-900 text-white hover:bg-black"
                >
                  Tambah Peran
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {roles.map((r) => (
                  <div key={r.id} className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: r.color || '#6366f1' }} />
                        <span className="font-bold text-xs text-slate-800">{r.name}</span>
                      </div>
                      {r.is_builtin && <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded">Bawaan</span>}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{r.description || 'Tidak ada deskripsi'}</p>
                    <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{r.members_count ?? 0} anggota</span>
                      {!r.is_builtin && (
                        <button
                          type="button"
                          onClick={() => { setEditingRole(r); setIsRoleModalOpen(true); }}
                          className="text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                          Ubah
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Permission Matrix */}
              <div className="mt-6 bg-white p-4 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Matriks Hak Akses Proyek</h4>
                {catalog && Object.keys(catalog).length > 0 ? (
                  <PermissionMatrix
                    catalog={catalog}
                    selectedPermissions={['*']}
                    onChange={() => {}}
                    readOnly
                  />
                ) : (
                  <p className="text-xs text-slate-400">Memuat matriks izin...</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: NOTES */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Catatan & Dokumentasi Proyek ({notes.length})</h3>
                <Link
                  href={`/notes?project_id=${project.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Buka Modul Catatan <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
              ) : notes.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center bg-white rounded-xl border border-slate-200">Belum ada catatan untuk proyek ini.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {notes.map((n) => (
                    <div key={n.id} className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-800 truncate">{n.title}</h4>
                        {n.is_pinned && <span className="text-[10px] text-amber-600 font-bold">📌 Disematkan</span>}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{n.content?.substring(0, 100) || 'Kosong'}</p>
                      <span className="text-[10px] text-slate-400 inline-block mt-2">Versi {n.version || 1} • {n.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Laporan Proyek ({reports.length})</h3>
                <Link
                  href={`/reports?project_id=${project.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Buka Modul Laporan <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
              ) : reports.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center bg-white rounded-xl border border-slate-200">Belum ada laporan untuk proyek ini.</p>
              ) : (
                <div className="divide-y divide-slate-100 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  {reports.map((r) => (
                    <div key={r.id} className="p-3.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{r.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{r.type} • Penulis: {r.user?.name || 'User'}</p>
                      </div>
                      <Badge variant={r.status}>{r.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: ACTIVITY */}
          {activeTab === 'activity' && (
            <div className="h-full">
              <ActivityTimeline projectId={project.id} />
            </div>
          )}

          {/* TAB 8: SETTINGS */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-4 max-w-xl bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Pengaturan Proyek</h3>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nama Proyek</label>
                <input
                  type="text"
                  required
                  value={settingsTitle}
                  onChange={(e) => setSettingsTitle(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Deskripsi</label>
                <textarea
                  rows={3}
                  value={settingsDesc}
                  onChange={(e) => setSettingsDesc(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
                  <select
                    value={settingsStatus}
                    onChange={(e) => setSettingsStatus(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-slate-200 text-xs"
                  >
                    <option value="planning">Planning</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Kesehatan</label>
                  <select
                    value={settingsHealth}
                    onChange={(e) => setSettingsHealth(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-slate-200 text-xs"
                  >
                    <option value="on_track">On Track</option>
                    <option value="at_risk">At Risk</option>
                    <option value="off_track">Off Track</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Prioritas</label>
                  <select
                    value={settingsPriority}
                    onChange={(e) => setSettingsPriority(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-slate-200 text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingSettings}
                  className="bg-slate-900 text-white hover:bg-black"
                >
                  {isSavingSettings ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Role Creation / Editing Modal */}
      {isRoleModalOpen && (
        <RoleModal
          isOpen={isRoleModalOpen}
          onClose={() => setIsRoleModalOpen(false)}
          projectId={project.id}
          role={editingRole}
          catalog={catalog}
          onSuccess={() => {
            fetchTabData('roles', project.id);
            setIsRoleModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
