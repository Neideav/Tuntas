'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AtSign, Users } from 'lucide-react';
import api from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MentionUser {
  id: number;
  name: string;
  email: string;
  avatar: string; // initials fallback
  role?: string | null;
}

export interface MentionRole {
  id: number;
  name: string;
  slug: string;
  color: string;
  member_count: number;
}

export interface MentionEntity {
  type: 'user' | 'role';
  id: number;
  label: string;   // display text in editor
  color?: string;
}

interface MentionPickerProps {
  projectId?: number | null;
  query: string;
  position: { top: number; left: number };
  onSelect: (entity: MentionEntity) => void;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mention Picker Dropdown
// ─────────────────────────────────────────────────────────────────────────────

function MentionPicker({ projectId, query, position, onSelect, onClose }: MentionPickerProps) {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [roles, setRoles] = useState<MentionRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const allItems: Array<{ kind: 'user' | 'role'; data: MentionUser | MentionRole }> = [
    ...users.map((u) => ({ kind: 'user' as const, data: u })),
    ...roles.map((r) => ({ kind: 'role' as const, data: r })),
  ];

  const fetchCandidates = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { q };
      if (projectId) params.project_id = projectId;
      const res = await api.get('/mentions/autocomplete', { params });
      if (res.data?.success) {
        setUsers(res.data.data.users ?? []);
        setRoles(res.data.data.roles ?? []);
        setActiveIdx(0);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCandidates(query);
  }, [query, fetchCandidates]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, allItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && allItems[activeIdx]) {
        e.preventDefault();
        selectItem(allItems[activeIdx]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [activeIdx, allItems]); // eslint-disable-line

  const selectItem = (item: { kind: 'user' | 'role'; data: MentionUser | MentionRole }) => {
    if (item.kind === 'user') {
      const u = item.data as MentionUser;
      onSelect({ type: 'user', id: u.id, label: u.name });
    } else {
      const r = item.data as MentionRole;
      onSelect({ type: 'role', id: r.id, label: r.name, color: r.color });
    }
  };

  if (!loading && allItems.length === 0) return null;

  return (
    <motion.div
      ref={listRef}
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.1 }}
      style={{ top: position.top, left: position.left }}
      className="absolute z-[200] w-72 rounded-2xl border border-slate-200 bg-white shadow-2xl p-1.5 max-h-64 overflow-y-auto"
      onMouseDown={(e) => e.preventDefault()} // prevent blur on click
    >
      {loading && (
        <div className="text-xs text-slate-400 px-3 py-2">Mencari…</div>
      )}

      {/* Users section */}
      {users.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
            <AtSign className="h-3 w-3" /> Anggota
          </div>
          {users.map((u, i) => {
            const idx = i;
            return (
              <button
                key={`user-${u.id}`}
                type="button"
                onMouseDown={() => selectItem({ kind: 'user', data: u })}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-xs text-left transition ${
                  idx === activeIdx ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white font-bold text-[10px] shrink-0">
                  {u.avatar}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{u.name}</p>
                  {u.role && <p className="text-[10px] text-slate-400 truncate">{u.role}</p>}
                </div>
              </button>
            );
          })}
        </>
      )}

      {/* Roles section */}
      {roles.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1 mt-1 flex items-center gap-1">
            <Users className="h-3 w-3" /> Peran
          </div>
          {roles.map((r, i) => {
            const idx = users.length + i;
            return (
              <button
                key={`role-${r.id}`}
                type="button"
                onMouseDown={() => selectItem({ kind: 'role', data: r })}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-xs text-left transition ${
                  idx === activeIdx ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-[10px]"
                  style={{ backgroundColor: r.color }}
                >
                  {r.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{r.name}</p>
                  <p className="text-[10px] text-slate-400">{r.member_count} anggota</p>
                </div>
              </button>
            );
          })}
        </>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MentionEditor — a textarea-like input with @mention autocomplete support.
// Works as a plain textarea that tracks the cursor position and shows the picker.
// For TipTap integration, use the structured data format via onMentionsChange.
// ─────────────────────────────────────────────────────────────────────────────

export interface MentionEditorRef {
  getValue: () => string;
  getMentions: () => MentionEntity[];
  focus: () => void;
}

interface MentionEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  onMentionsChange?: (mentions: MentionEntity[]) => void;
  placeholder?: string;
  projectId?: number | null;
  className?: string;
  minRows?: number;
}

export const MentionEditor = forwardRef<MentionEditorRef, MentionEditorProps>(
  ({ value = '', onChange, onMentionsChange, placeholder, projectId, className, minRows = 3 }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [text, setText] = useState(value);
    const [mentions, setMentions] = useState<MentionEntity[]>([]);
    const [picker, setPicker] = useState<{
      query: string;
      startIndex: number;
      position: { top: number; left: number };
    } | null>(null);

    useImperativeHandle(ref, () => ({
      getValue: () => text,
      getMentions: () => mentions,
      focus: () => textareaRef.current?.focus(),
    }));

    // Sync controlled value
    useEffect(() => {
      if (value !== text) setText(value);
    }, [value]); // eslint-disable-line

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setText(newText);
      onChange?.(newText);

      // Detect @mention trigger
      const cursor = e.target.selectionStart ?? 0;
      const before = newText.slice(0, cursor);
      const mentionMatch = before.match(/@([a-zA-Z0-9 _.\-]*)$/);

      if (mentionMatch) {
        const query = mentionMatch[1];
        // Calculate picker position (approximate)
        const ta = textareaRef.current;
        if (ta) {
          const rect = ta.getBoundingClientRect();
          const containerRect = containerRef.current?.getBoundingClientRect() ?? rect;
          setPicker({
            query,
            startIndex: cursor - query.length - 1,
            position: {
              top: rect.bottom - containerRect.top + 4,
              left: 0,
            },
          });
        }
      } else {
        setPicker(null);
      }
    };

    const handleSelectMention = (entity: MentionEntity) => {
      if (!picker) return;

      // Replace the @query text with the mention token
      const before = text.slice(0, picker.startIndex);
      const after = text.slice(picker.startIndex + picker.query.length + 1);
      const mention = entity.type === 'role'
        ? `@role:${entity.label} `
        : `@${entity.label} `;
      const newText = before + mention + after;

      setText(newText);
      onChange?.(newText);

      const newMentions = [...mentions.filter((m) => !(m.type === entity.type && m.id === entity.id)), entity];
      setMentions(newMentions);
      onMentionsChange?.(newMentions);
      setPicker(null);

      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          const pos = before.length + mention.length;
          ta.setSelectionRange(pos, pos);
          ta.focus();
        }
      }, 0);
    };

    return (
      <div ref={containerRef} className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onBlur={() => setTimeout(() => setPicker(null), 150)}
          placeholder={placeholder}
          rows={minRows}
          className={
            className ??
            'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition'
          }
        />

        {/* Mention tokens display (chip overlay) */}
        {mentions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {mentions.map((m) => (
              <span
                key={`${m.type}-${m.id}`}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                style={
                  m.type === 'role'
                    ? { backgroundColor: m.color + '22', color: m.color }
                    : { backgroundColor: '#e0e7ff', color: '#4338ca' }
                }
              >
                @{m.label}
                <button
                  type="button"
                  onClick={() => {
                    const updated = mentions.filter((x) => !(x.type === m.type && x.id === m.id));
                    setMentions(updated);
                    onMentionsChange?.(updated);
                  }}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <AnimatePresence>
          {picker && (
            <MentionPicker
              projectId={projectId}
              query={picker.query}
              position={picker.position}
              onSelect={handleSelectMention}
              onClose={() => setPicker(null)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }
);

MentionEditor.displayName = 'MentionEditor';

// ─────────────────────────────────────────────────────────────────────────────
// MentionDisplay — renders stored mention tokens as styled chips in content.
// ─────────────────────────────────────────────────────────────────────────────

interface MentionDisplayProps {
  content: string;
  className?: string;
}

export function MentionDisplay({ content, className }: MentionDisplayProps) {
  // Replace @name and @role:name with styled spans
  const parts = content.split(/(@role:[a-zA-Z0-9_\-]+ |@[a-zA-Z0-9_.@\- ]+(?= |$))/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('@role:')) {
          const roleName = part.replace('@role:', '').trim();
          return (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 text-purple-700 px-1.5 text-xs font-semibold"
            >
              @{roleName}
            </span>
          );
        }
        if (part.startsWith('@') && part.length > 1) {
          return (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 text-indigo-700 px-1.5 text-xs font-semibold"
            >
              {part.trim()}
            </span>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}
