'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Users,
  UserPlus,
  Shield,
  Search,
  Mail,
  Copy,
  Check,
  Trash2,
  Edit2,
  Lock,
  Plus,
  AlertTriangle,
  Clock,
  ChevronDown,
} from 'lucide-react';
import api, { extractApiErrorMessage } from '@/lib/api';
import { showToast } from '@/components/ui/Toast';
import { RoleModal, RoleData } from '@/components/roles/RoleModal';
import { PermissionGroup } from '@/components/roles/PermissionMatrix';

interface MemberItem {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role_id: number | null;
  role: string;
  role_name: string;
  role_color: string;
  is_owner: boolean;
  is_builtin: boolean;
  joined_at: string;
}

interface InvitationItem {
  id: number;
  email: string;
  role: string;
  token: string;
  status: string;
  expires_at: string;
  inviter?: { id: number; name: string; email: string };
  project_role?: { id: number; name: string; color: string };
}

interface ProjectMembersModalProps {
  isOpen: boolean;
  projectId: number;
  projectTitle: string;
  onClose: () => void;
}

export function ProjectMembersModal({
  isOpen,
  projectId,
  projectTitle,
  onClose,
}: ProjectMembersModalProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'roles'>('members');
  const [loading, setLoading] = useState(false);

  // Data
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [catalog, setCatalog] = useState<Record<string, PermissionGroup>>({});
  const [currentUserData, setCurrentUserData] = useState<{
    is_owner: boolean;
    role: string;
    permissions: string[];
  }>({
    is_owner: false,
    role: 'viewer',
    permissions: [],
  });

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Inline Invite Form State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState<number | string>('');
  const [inviting, setInviting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Role Modal State
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedRoleForEdit, setSelectedRoleForEdit] = useState<RoleData | null>(null);

  // Member Action Modals
  const [memberToRemove, setMemberToRemove] = useState<MemberItem | null>(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [memberToChangeRole, setMemberToChangeRole] = useState<MemberItem | null>(null);
  const [newSelectedRole, setNewSelectedRole] = useState<string>('');
  const [changingRole, setChangingRole] = useState(false);

  // Check permissions
  const can = useCallback(
    (perm: string) => {
      if (currentUserData.is_owner || currentUserData.permissions.includes('*')) {
        return true;
      }
      return currentUserData.permissions.includes(perm);
    },
    [currentUserData]
  );

  const fetchMembersAndCurrentUser = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${projectId}/members`);
      if (res.data?.success) {
        setMembers(res.data.data.members || []);
        setCurrentUserData(
          res.data.data.current_user || {
            is_owner: false,
            role: 'viewer',
            permissions: [],
          }
        );
      }
    } catch (err: unknown) {
      console.error(err);
    }
  }, [projectId]);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${projectId}/invitations`);
      if (res.data?.success) {
        setInvitations(res.data.data || []);
      }
    } catch (err: unknown) {
      console.error(err);
    }
  }, [projectId]);

  const fetchRolesAndCatalog = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${projectId}/roles`);
      if (res.data?.success) {
        setRoles(res.data.data.roles || []);
        setCatalog(res.data.data.catalog || {});
      }
    } catch (err: unknown) {
      console.error(err);
    }
  }, [projectId]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchMembersAndCurrentUser(),
      fetchInvitations(),
      fetchRolesAndCatalog(),
    ]);
    setLoading(false);
  }, [fetchMembersAndCurrentUser, fetchInvitations, fetchRolesAndCatalog]);

  useEffect(() => {
    if (isOpen) {
      loadAllData();
      setSearchQuery('');
      setInviteEmail('');
      setInviteRoleId('');
    }
  }, [isOpen, loadAllData]);

  // Set default invite role once roles are loaded
  useEffect(() => {
    if (roles.length > 0 && !inviteRoleId) {
      const defaultRole = roles.find((r) => r.slug === 'member') || roles[0];
      if (defaultRole?.id) {
        setInviteRoleId(defaultRole.id);
      }
    }
  }, [roles, inviteRoleId]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      showToast('Masukkan alamat email untuk mengundang.', 'error');
      return;
    }

    try {
      setInviting(true);
      const res = await api.post(`/projects/${projectId}/invitations`, {
        email: inviteEmail.trim(),
        role_id: Number(inviteRoleId) || undefined,
      });

      if (res.data?.success) {
        showToast(res.data.message || 'Undangan berhasil dikirim!', 'success');
        setInviteEmail('');
        fetchInvitations();
      }
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal mengirim undangan.'), 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (invitationId: number) => {
    try {
      await api.delete(`/projects/${projectId}/invitations/${invitationId}`);
      showToast('Undangan berhasil dibatalkan.', 'info');
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal membatalkan undangan.'), 'error');
    }
  };

  const handleCopyLink = (token: string) => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/invite/${token}`;
      navigator.clipboard.writeText(url);
      setCopiedToken(token);
      showToast('Tautan undangan disalin ke clipboard!', 'info');
      setTimeout(() => setCopiedToken(null), 2500);
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      setRemovingMember(true);
      await api.delete(`/projects/${projectId}/members/${memberToRemove.user_id}`);
      showToast(`Anggota '${memberToRemove.name}' telah dikeluarkan dari proyek.`, 'info');
      setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
      setMemberToRemove(null);
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal mengeluarkan anggota.'), 'error');
    } finally {
      setRemovingMember(false);
    }
  };

  const handleConfirmChangeRole = async () => {
    if (!memberToChangeRole || !newSelectedRole) return;
    try {
      setChangingRole(true);
      const targetRoleObj = roles.find((r) => r.slug === newSelectedRole);
      const res = await api.patch(
        `/projects/${projectId}/members/${memberToChangeRole.user_id}/role`,
        {
          role_id: targetRoleObj?.id,
          role: newSelectedRole,
        }
      );

      if (res.data?.success) {
        showToast('Peran anggota berhasil diperbarui.', 'success');
        fetchMembersAndCurrentUser();
        setMemberToChangeRole(null);
      }
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal memperbarui peran anggota.'), 'error');
    } finally {
      setChangingRole(false);
    }
  };

  const handleDeleteRole = async (roleObj: RoleData) => {
    if (!confirm(`Hapus peran '${roleObj.name}'? Peran tidak dapat dipulihkan.`)) return;
    try {
      await api.delete(`/projects/${projectId}/roles/${roleObj.id}`);
      showToast(`Peran '${roleObj.name}' berhasil dihapus.`, 'info');
      setRoles((prev) => prev.filter((r) => r.id !== roleObj.id));
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal menghapus peran.'), 'error');
    }
  };

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 14 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 z-10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xs">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-slate-900 truncate max-w-md">
                    {projectTitle}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {currentUserData.is_owner ? 'Owner' : currentUserData.role}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Kelola anggota tim, undang kolaborator, dan atur matriks izin peran
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-100 bg-white shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'members'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Anggota Tim</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                {members.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('invitations')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'invitations'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Mail className="h-4 w-4" />
              <span>Undangan</span>
              {invitations.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                  {invitations.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('roles')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'roles'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Shield className="h-4 w-4" />
              <span>Peran & Izin</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                {roles.length}
              </span>
            </button>
          </div>

          {/* Tab Content Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
                <p className="text-xs text-slate-500 font-medium">Memuat data keanggotaan...</p>
              </div>
            ) : (
              <>
                {/* TAB 1: MEMBERS */}
                {activeTab === 'members' && (
                  <div className="space-y-4">
                    {/* Search & Actions Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Cari anggota berdasarkan nama atau email..."
                          className="w-full h-10 pl-9 pr-3.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        />
                      </div>

                      {can('members.invite') && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('invitations')}
                          className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <UserPlus className="h-4 w-4" />
                          <span>Undang Anggota</span>
                        </button>
                      )}
                    </div>

                    {/* Members List */}
                    <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-white">
                      {filteredMembers.length === 0 ? (
                        <div className="py-12 text-center text-xs text-slate-400">
                          Tidak ada anggota yang cocok dengan pencarian.
                        </div>
                      ) : (
                        filteredMembers.map((member) => (
                          <div
                            key={member.id}
                            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
                                style={{ backgroundColor: member.role_color || '#6366F1' }}
                              >
                                {member.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-xs text-slate-900 truncate">
                                    {member.name}
                                  </h4>
                                  {member.is_owner && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                      <Lock className="h-2.5 w-2.5" />
                                      Owner
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 font-mono truncate">
                                  {member.email}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                              {/* Role Badge */}
                              <span
                                className="px-2.5 py-1 rounded-full text-xs font-bold shadow-xs text-white"
                                style={{ backgroundColor: member.role_color || '#6366F1' }}
                              >
                                {member.role_name}
                              </span>

                              {/* Action Menu */}
                              {!member.is_owner && (
                                <div className="flex items-center gap-1.5">
                                  {can('members.manage') && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMemberToChangeRole(member);
                                        setNewSelectedRole(member.role);
                                      }}
                                      className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                                      title="Ubah Peran Anggota"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}

                                  {can('members.remove') && (
                                    <button
                                      type="button"
                                      onClick={() => setMemberToRemove(member)}
                                      className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                                      title="Keluarkan dari Proyek"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: INVITATIONS */}
                {activeTab === 'invitations' && (
                  <div className="space-y-6">
                    {/* Invite Form */}
                    {can('members.invite') && (
                      <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                          <UserPlus className="h-4 w-4 text-indigo-600" />
                          <span>Kirim Undangan Baru</span>
                        </div>

                        <form
                          onSubmit={handleSendInvite}
                          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
                        >
                          <div className="relative flex-1">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <input
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="nama@email.com"
                              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                              required
                            />
                          </div>

                          <div className="w-full sm:w-48">
                            <select
                              value={inviteRoleId}
                              onChange={(e) => setInviteRoleId(e.target.value)}
                              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                            >
                              {roles
                                .filter((r) => r.slug !== 'owner' || currentUserData.is_owner)
                                .map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <button
                            type="submit"
                            disabled={inviting}
                            className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-60"
                          >
                            {inviting ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              <span>Undang</span>
                            )}
                          </button>
                        </form>
                      </div>
                    )}

                    {/* Pending Invitations List */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>Undangan Aktif ({invitations.length})</span>
                      </h4>

                      <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-white">
                        {invitations.length === 0 ? (
                          <div className="py-10 text-center text-xs text-slate-400">
                            Tidak ada undangan yang sedang aktif saat ini.
                          </div>
                        ) : (
                          invitations.map((inv) => (
                            <div
                              key={inv.id}
                              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-slate-900">
                                    {inv.email}
                                  </span>
                                  <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    {inv.status}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  Peran: <strong className="text-slate-700 font-semibold">{inv.project_role?.name || inv.role}</strong>{' '}
                                  • Diundang oleh {inv.inviter?.name || 'Admin'}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(inv.token)}
                                  className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                                >
                                  {copiedToken === inv.token ? (
                                    <>
                                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                                      <span className="text-emerald-700 font-bold">Tersalin</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                                      <span>Salin Tautan</span>
                                    </>
                                  )}
                                </button>

                                {can('members.invite') && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelInvite(inv.id)}
                                    className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                                    title="Batalkan Undangan"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: ROLES & PERMISSIONS */}
                {activeTab === 'roles' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Daftar Peran Proyek
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Peran bawaan sistem memiliki set izin dasar, sementara peran kustom dapat diatur sepenuhnya.
                        </p>
                      </div>

                      {can('roles.create') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRoleForEdit(null);
                            setRoleModalOpen(true);
                          }}
                          className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Buat Peran Kustom</span>
                        </button>
                      )}
                    </div>

                    {/* Roles Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {roles.map((r) => {
                        const isRoleOwner = r.slug === 'owner';
                        const isRoleBuiltin = r.is_builtin;

                        return (
                          <div
                            key={r.id}
                            className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition flex flex-col justify-between gap-3 shadow-xs"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-3 w-3 rounded-full shrink-0"
                                    style={{ backgroundColor: r.color || '#6366F1' }}
                                  />
                                  <h4 className="font-bold text-xs text-slate-900">{r.name}</h4>
                                </div>

                                <span
                                  className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                                    isRoleBuiltin
                                      ? 'bg-slate-100 text-slate-700'
                                      : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                  }`}
                                >
                                  {isRoleBuiltin ? 'Bawaan' : 'Kustom'}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-500 leading-relaxed mt-1 line-clamp-2">
                                {r.description || 'Tidak ada deskripsi'}
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                              <span className="font-semibold text-slate-500">
                                {r.permissions?.includes('*')
                                  ? 'Akses Penuh (*)'
                                  : `${r.permissions?.length || 0} Izin`}
                              </span>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRoleForEdit(r);
                                    setRoleModalOpen(true);
                                  }}
                                  className="text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded-md hover:bg-indigo-50 transition cursor-pointer"
                                >
                                  {isRoleOwner ? 'Lihat Izin' : can('roles.update') ? 'Ubah' : 'Lihat'}
                                </button>

                                {!isRoleBuiltin && can('roles.delete') && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRole(r)}
                                    className="text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50 transition cursor-pointer"
                                    title="Hapus Peran"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span>
              Peran Anda saat ini:{' '}
              <strong className="text-slate-900 font-bold capitalize">
                {currentUserData.is_owner ? 'Owner' : currentUserData.role}
              </strong>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition cursor-pointer"
            >
              Selesai
            </button>
          </div>

          {/* SUBMODAL: REMOVE MEMBER CONFIRMATION */}
          {memberToRemove && (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
              <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Keluarkan Anggota?</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Keluarkan <strong className="text-slate-800">{memberToRemove.name}</strong> dari proyek ini? Akses ke tugas dan laporan proyek akan segera dicabut.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMemberToRemove(null)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={removingMember}
                    onClick={handleConfirmRemoveMember}
                    className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer disabled:opacity-60"
                  >
                    {removingMember ? 'Mengeluarkan...' : 'Keluarkan'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SUBMODAL: CHANGE MEMBER ROLE */}
          {memberToChangeRole && (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
              <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Ubah Peran Anggota</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pilih peran baru untuk <strong className="text-slate-800">{memberToChangeRole.name}</strong>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Pilih Peran
                  </label>
                  <select
                    value={newSelectedRole}
                    onChange={(e) => setNewSelectedRole(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  >
                    {roles
                      .filter((r) => r.slug !== 'owner' || currentUserData.is_owner)
                      .map((r) => (
                        <option key={r.id} value={r.slug}>
                          {r.name} {r.is_builtin ? '(Bawaan)' : '(Kustom)'}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMemberToChangeRole(null)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={changingRole}
                    onClick={handleConfirmChangeRole}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition cursor-pointer disabled:opacity-60"
                  >
                    {changingRole ? 'Menyimpan...' : 'Terapkan Peran'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Embedded Role Modal (for creating/editing roles) */}
      <RoleModal
        isOpen={roleModalOpen}
        projectId={projectId}
        role={selectedRoleForEdit}
        catalog={catalog}
        onClose={() => setRoleModalOpen(false)}
        onSuccess={() => {
          setRoleModalOpen(false);
          fetchRolesAndCatalog();
        }}
      />
    </AnimatePresence>
  );
}
