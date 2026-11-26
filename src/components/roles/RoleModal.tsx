'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, AlertTriangle, Check, Palette } from 'lucide-react';
import { PermissionMatrix, PermissionGroup } from './PermissionMatrix';
import api, { extractApiErrorMessage } from '@/lib/api';
import { showToast } from '@/components/ui/Toast';

export interface RoleData {
  id?: number;
  project_id?: number;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  is_builtin?: boolean;
  permissions: string[];
}

interface RoleModalProps {
  isOpen: boolean;
  projectId: number;
  role?: RoleData | null;
  catalog: Record<string, PermissionGroup>;
  onClose: () => void;
  onSuccess: () => void;
}

const PRESET_COLORS = [
  { label: 'Indigo', hex: '#6366F1' },
  { label: 'Sky', hex: '#0EA5E9' },
  { label: 'Emerald', hex: '#10B981' },
  { label: 'Amber', hex: '#F59E0B' },
  { label: 'Rose', hex: '#EF4444' },
  { label: 'Violet', hex: '#8B5CF6' },
  { label: 'Pink', hex: '#EC4899' },
  { label: 'Teal', hex: '#14B8A6' },
  { label: 'Slate', hex: '#64748B' },
];

export function RoleModal({
  isOpen,
  projectId,
  role,
  catalog,
  onClose,
  onSuccess,
}: RoleModalProps) {
  const isEditing = !!role?.id;
  const isOwner = role?.slug === 'owner';
  const isBuiltin = role?.is_builtin ?? false;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366F1');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  // Initial state tracking for unsaved change detection
  const [initialStateJson, setInitialStateJson] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (role) {
        setName(role.name);
        setSlug(role.slug);
        setDescription(role.description || '');
        setColor(role.color || '#6366F1');
        setSelectedPermissions(role.permissions || []);
        setInitialStateJson(
          JSON.stringify({
            name: role.name,
            slug: role.slug,
            description: role.description || '',
            color: role.color || '#6366F1',
            permissions: role.permissions || [],
          })
        );
      } else {
        setName('');
        setSlug('');
        setDescription('');
        setColor('#6366F1');
        setSelectedPermissions([
          'project.view',
          'tasks.view',
          'tasks.create',
          'notes.view',
        ]);
        setInitialStateJson(
          JSON.stringify({
            name: '',
            slug: '',
            description: '',
            color: '#6366F1',
            permissions: ['project.view', 'tasks.view', 'tasks.create', 'notes.view'],
          })
        );
      }
      setShowUnsavedConfirm(false);
    }
  }, [isOpen, role]);

  const hasUnsavedChanges = () => {
    const current = JSON.stringify({
      name,
      slug,
      description,
      color,
      permissions: selectedPermissions,
    });
    return current !== initialStateJson;
  };

  const handleRequestClose = () => {
    if (hasUnsavedChanges()) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing && !isBuiltin) {
      // Auto-generate slug from name
      const autoSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSlug(autoSlug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Nama peran wajib diisi.', 'error');
      return;
    }

    if (isOwner) {
      showToast('Peran Pemilik dilindungi oleh sistem.', 'error');
      return;
    }

    try {
      setSaving(true);
      if (isEditing && role?.id) {
        await api.put(`/projects/${projectId}/roles/${role.id}`, {
          name: name.trim(),
          description: description.trim(),
          color,
          permissions: selectedPermissions,
        });
        showToast(`Peran '${name}' berhasil diperbarui.`, 'success');
      } else {
        await api.post(`/projects/${projectId}/roles`, {
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim(),
          color,
          permissions: selectedPermissions,
        });
        showToast(`Peran baru '${name}' berhasil dibuat.`, 'success');
      }
      onSuccess();
    } catch (err: unknown) {
      showToast(extractApiErrorMessage(err, 'Gagal menyimpan konfigurasi peran.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleRequestClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 14 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 z-10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-xs"
                style={{ backgroundColor: color }}
              >
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  {isEditing ? `Ubah Peran: ${role?.name}` : 'Buat Peran Kustom'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isEditing
                    ? 'Sesuaikan matriks izin dan atribut peran proyek'
                    : 'Definisikan peran baru beserta tingkat akses anggota'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRequestClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form Content (Scrollable) */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            {isOwner && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 text-xs text-amber-900 font-medium">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Peran Pemilik Dilindungi</p>
                  <p className="text-amber-800 text-xs mt-0.5">
                    Peran Pemilik (Owner) memiliki hak akses penuh (*) ke seluruh modul proyek dan tidak dapat dibatasi demi menjaga integritas kepemilikan proyek.
                  </p>
                </div>
              </div>
            )}

            {/* Basic Info Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Role Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Peran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  disabled={isOwner}
                  placeholder="e.g. Project Manager, QA Engineer"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 disabled:bg-slate-100"
                  required
                />
              </div>

              {/* Role Slug */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Slug Identifikasi
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={isEditing || isBuiltin}
                  placeholder="e.g. project-manager"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 disabled:opacity-75"
                />
              </div>
            </div>

            {/* Description & Color */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Deskripsi Peran
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isOwner}
                  placeholder="Jelaskan ruang lingkup tanggung jawab peran ini..."
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-none disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Warna Label
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      disabled={isOwner}
                      onClick={() => setColor(c.hex)}
                      className={`h-7 w-7 rounded-full flex items-center justify-center transition cursor-pointer ${
                        color === c.hex
                          ? 'ring-2 ring-offset-2 ring-slate-800 scale-110 shadow-xs'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    >
                      {color === c.hex && <Check className="h-3.5 w-3.5 text-white stroke-3" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Permission Matrix */}
            <div className="pt-2">
              <div className="flex items-center justify-between pb-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="h-4 w-4 text-indigo-600" />
                  <span>Matriks Izin Modul</span>
                </h4>
                {isOwner && (
                  <span className="text-[11px] font-semibold text-amber-600">
                    Semua Izin Aktif Otomatis
                  </span>
                )}
              </div>

              <PermissionMatrix
                catalog={catalog}
                selectedPermissions={isOwner ? ['*'] : selectedPermissions}
                onChange={setSelectedPermissions}
                readOnly={isOwner}
              />
            </div>

            {/* Footer Buttons */}
            <div className="sticky bottom-0 bg-white pt-4 pb-2 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleRequestClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>

              {!isOwner && (
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <span>{isEditing ? 'Simpan Perubahan' : 'Buat Peran'}</span>
                  )}
                </button>
              )}
            </div>
          </form>

          {/* Unsaved Changes Confirmation Modal */}
          {showUnsavedConfirm && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
              <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Perubahan Belum Disimpan</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Anda memiliki perubahan izin yang belum disimpan. Yakin ingin keluar?
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUnsavedConfirm(false)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Lanjut Mengedit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnsavedConfirm(false);
                      onClose();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
                  >
                    Tinggalkan Perubahan
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
