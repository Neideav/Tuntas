'use client';

import React, { useMemo } from 'react';
import { Shield, Check, Lock, CheckSquare, Square } from 'lucide-react';

export interface PermissionItem {
  label: string;
  description: string;
  protected?: boolean;
}

export interface PermissionGroup {
  title: string;
  permissions: Record<string, PermissionItem>;
}

export interface PermissionMatrixProps {
  catalog: Record<string, PermissionGroup>;
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  readOnly?: boolean;
}

export function PermissionMatrix({
  catalog,
  selectedPermissions,
  onChange,
  readOnly = false,
}: PermissionMatrixProps) {
  const isWildcard = selectedPermissions.includes('*');

  // Compute all available permission keys from catalog (excluding protected system permissions)
  const allSelectableKeys = useMemo(() => {
    const keys: string[] = [];
    Object.values(catalog).forEach((group) => {
      Object.entries(group.permissions).forEach(([key, item]) => {
        if (!item.protected) {
          keys.push(key);
        }
      });
    });
    return keys;
  }, [catalog]);

  const handleToggle = (key: string, isProtected?: boolean) => {
    if (readOnly || isProtected) return;

    if (isWildcard) {
      // De-wildcard to all selectable keys except this one
      const updated = allSelectableKeys.filter((k) => k !== key);
      onChange(updated);
      return;
    }

    if (selectedPermissions.includes(key)) {
      onChange(selectedPermissions.filter((k) => k !== key));
    } else {
      onChange([...selectedPermissions, key]);
    }
  };

  const handleSelectAllGroup = (groupKeys: string[]) => {
    if (readOnly) return;
    const selectableGroupKeys = groupKeys.filter((k) => {
      for (const grp of Object.values(catalog)) {
        if (grp.permissions[k]?.protected) return false;
      }
      return true;
    });

    const newSet = new Set([...selectedPermissions, ...selectableGroupKeys]);
    onChange(Array.from(newSet));
  };

  const handleClearGroup = (groupKeys: string[]) => {
    if (readOnly) return;
    if (isWildcard) {
      const remaining = allSelectableKeys.filter((k) => !groupKeys.includes(k));
      onChange(remaining);
      return;
    }
    const groupKeySet = new Set(groupKeys);
    onChange(selectedPermissions.filter((k) => !groupKeySet.has(k)));
  };

  const handleSelectAllGlobal = () => {
    if (readOnly) return;
    onChange(allSelectableKeys);
  };

  const handleClearAllGlobal = () => {
    if (readOnly) return;
    onChange([]);
  };

  return (
    <div className="space-y-6">
      {/* Global Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <Shield className="h-4 w-4 text-indigo-600" />
            <span>
              Izin Terpilih:{' '}
              <strong className="text-slate-900 font-bold">
                {isWildcard ? 'Semua Akses (*)' : `${selectedPermissions.length} dari ${allSelectableKeys.length}`}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllGlobal}
              className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
            >
              Pilih Semua
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleClearAllGlobal}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
            >
              Hapus Semua
            </button>
          </div>
        </div>
      )}

      {/* Module Groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(catalog).map(([groupKey, group]) => {
          const groupKeys = Object.keys(group.permissions);
          const selectedInGroup = groupKeys.filter(
            (k) => isWildcard || selectedPermissions.includes(k)
          );
          const isAllGroupSelected =
            groupKeys.length > 0 && selectedInGroup.length === groupKeys.length;

          return (
            <div
              key={groupKey}
              className="flex flex-col border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden"
            >
              {/* Group Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                    {group.title}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/70 text-slate-700">
                    {selectedInGroup.length}/{groupKeys.length}
                  </span>
                </div>

                {!readOnly && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        isAllGroupSelected
                          ? handleClearGroup(groupKeys)
                          : handleSelectAllGroup(groupKeys)
                      }
                      className="text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-0.5 rounded-md hover:bg-indigo-50 transition cursor-pointer"
                    >
                      {isAllGroupSelected ? 'Batal' : 'Pilih Semua'}
                    </button>
                  </div>
                )}
              </div>

              {/* Permission Items */}
              <div className="p-3 divide-y divide-slate-100 space-y-1">
                {Object.entries(group.permissions).map(([permKey, perm]) => {
                  const isChecked = isWildcard || selectedPermissions.includes(permKey);
                  const isProtected = perm.protected;

                  return (
                    <label
                      key={permKey}
                      onClick={(e) => {
                        if (isProtected || readOnly) {
                          e.preventDefault();
                        }
                      }}
                      className={`flex items-start gap-3 p-2 rounded-xl transition ${
                        isProtected || readOnly
                          ? 'opacity-70 cursor-not-allowed bg-slate-50/40'
                          : 'hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={readOnly || isProtected}
                          onChange={() => handleToggle(permKey, isProtected)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-xs text-slate-800">
                            {perm.label}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                            {permKey}
                          </span>
                          {isProtected && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                              <Lock className="h-2.5 w-2.5" />
                              Khusus Owner
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          {perm.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
