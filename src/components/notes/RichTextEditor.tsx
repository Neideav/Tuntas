'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  AtSign,
  Check,
  Clock,
  AlertTriangle,
  RotateCcw,
  Eye,
  FileCode,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onAutosave?: (content: string) => Promise<boolean>;
  placeholder?: string;
  minHeight?: string;
  readOnly?: boolean;
  projectMembers?: { id: number; name: string; email: string }[];
  projectRoles?: { id: number; name: string; slug: string }[];
}

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error' | 'conflict';

export function RichTextEditor({
  value,
  onChange,
  onAutosave,
  placeholder = 'Tuliskan catatan, ide, atau dokumentasi Anda di sini...',
  minHeight = '320px',
  readOnly = false,
  projectMembers = [],
  projectRoles = [],
}: RichTextEditorProps) {
  const [content, setContent] = useState(value);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');

  // Mention autocomplete popup state
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionType, setMentionType] = useState<'user' | 'role'>('user');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>(value);

  // Sync external changes if not actively modified
  useEffect(() => {
    setContent(value);
    lastSavedContentRef.current = value;
  }, [value]);

  // Debounced Autosave Trigger
  const triggerAutosave = useCallback(
    (textToSave: string) => {
      if (!onAutosave || readOnly || textToSave === lastSavedContentRef.current) {
        return;
      }

      setSaveStatus('saving');
      onAutosave(textToSave)
        .then((success) => {
          if (success) {
            lastSavedContentRef.current = textToSave;
            setSaveStatus('saved');
            setTimeout(() => {
              setSaveStatus((curr) => (curr === 'saved' ? 'idle' : curr));
            }, 3000);
          } else {
            setSaveStatus('error');
          }
        })
        .catch(() => {
          setSaveStatus('error');
        });
    },
    [onAutosave, readOnly]
  );

  const handleContentChange = (newText: string) => {
    setContent(newText);
    onChange(newText);

    if (newText !== lastSavedContentRef.current) {
      setSaveStatus('unsaved');
    }

    // Clear existing timer and queue autosave after 1600ms debounce
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      triggerAutosave(newText);
    }, 1600);
  };

  // Text insertion helpers
  const wrapSelection = (before: string, after: string = before, placeholderText: string = '') => {
    if (readOnly || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const selected = text.substring(start, end) || placeholderText;
    const replacement = `${before}${selected}${after}`;

    const updatedText = text.substring(0, start) + replacement + text.substring(end);
    handleContentChange(updatedText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 10);
  };

  const insertAtCursor = (insertion: string) => {
    if (readOnly || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const updatedText = text.substring(0, start) + insertion + text.substring(end);
    handleContentChange(updatedText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 10);
  };

  // Mention selection handler
  const handleInsertMention = (item: { name: string; identifier: string }, type: 'user' | 'role') => {
    const mentionTag = type === 'role' ? `@role:${item.identifier} ` : `@${item.identifier} `;
    insertAtCursor(mentionTag);
    setMentionMenuOpen(false);
  };

  // Render markdown preview safely
  const renderPreviewHtml = (rawMarkdown: string) => {
    if (!rawMarkdown.trim()) {
      return '<p class="text-slate-400 italic">Belum ada konten untuk ditampilkan.</p>';
    }

    let parsed = rawMarkdown
      // Escape HTML entities to prevent raw HTML execution
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headings
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-slate-900 mt-3 mb-1.5">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-slate-900 mt-4 mb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold text-slate-900 mt-4 mb-2.5">$1</h1>')
      // Bold & Italic
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold text-slate-900">$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>')
      .replace(/~~(.*?)~~/gim, '<s class="line-through text-slate-400">$1</s>')
      // Checklists
      .replace(/^- \[ \] (.*$)/gim, '<div class="flex items-center gap-2 py-0.5"><input type="checkbox" disabled class="rounded border-slate-300" /><span>$1</span></div>')
      .replace(/^- \[x\] (.*$)/gim, '<div class="flex items-center gap-2 py-0.5"><input type="checkbox" checked disabled class="rounded border-slate-300 text-indigo-600" /><span class="line-through text-slate-400">$1</span></div>')
      // Bullet lists
      .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-slate-700">$1</li>')
      // Code blocks
      .replace(/```([\s\S]*?)```/gim, '<pre class="p-3 my-2 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto"><code>$1</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/gim, '<code class="px-1.5 py-0.5 rounded-md bg-slate-100 font-mono text-xs text-indigo-600">$1</code>')
      // Mentions styling
      .replace(/@role:([a-zA-Z0-9_-]+)/gim, '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">@$1</span>')
      .replace(/@([a-zA-Z0-9_\.-]+)/gim, '<span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700">@$1</span>')
      // Blockquotes
      .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-indigo-500 pl-3 py-1 my-2 text-slate-600 italic bg-slate-50/50 rounded-r-lg">$1</blockquote>')
      // Links
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 font-semibold underline hover:text-indigo-800">$1</a>')
      // Line breaks
      .replace(/\n/gim, '<br />');

    return parsed;
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
      {/* Editor Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 bg-slate-50/80 border-b border-slate-100 text-slate-700 select-none">
          {/* Formatting Actions */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => wrapSelection('# ', '', 'Judul Dokumen')}
              className="p-1.5 rounded-lg hover:bg-slate-200/70 hover:text-slate-900 transition cursor-pointer"
              title="Heading 1"
            >
              <Heading1 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('## ', '', 'Subjudul')}
              className="p-1.5 rounded-lg hover:bg-slate-200/70 hover:text-slate-900 transition cursor-pointer"
              title="Heading 2"
            >
              <Heading2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('### ', '', 'Bagian')}
              className="p-1.5 rounded-lg hover:bg-slate-200/70 hover:text-slate-900 transition cursor-pointer"
              title="Heading 3"
            >
              <Heading3 className="h-4 w-4" />
            </button>

            <span className="h-4 w-px bg-slate-200 mx-1" />

            <button
              type="button"
              onClick={() => wrapSelection('**', '**', 'teks tebal')}
              className="p-1.5 rounded-lg hover:bg-slate-200/70 hover:text-slate-900 transition cursor-pointer"
              title="Tebal (Bold)"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('*', '*', 'teks miring')}
              className="p-1.5 rounded-lg hover:bg-slate-200/70 hover:text-slate-900 transition cursor-pointer"
              title="Miring (Italic)"
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('~~', '~~', 'teks coret')}
              className="p-1.5 rounded-lg hover:bg-slate-200/70 hover:text-slate-900 transition cursor-pointer"
              title="Coret (Strikethrough)"
            >
              <Strikethrough className="h-4 w-4" />
            </button>

            <span className="h-4 w-px bg-slate-200 mx-1" />

            <button
              type="button"
              onClick={() => insertAtCursor('- ')}
              className="p-1.5 rounded-lg hover:bg-slate-200/70 hover:text-slate-900 transition cursor-pointer"
              title="Daftar Poin (Bullet List)"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertAtCursor('1. ')}
              className="p-1.5 rounded-lg hover:bg-slate-200/70 hover:text-slate-900 transition cursor-pointer"
              title="Daftar Nomor (Numbered List)"
            >
              <ListOrdered className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertAtCursor('- [ ] ')}
              className="p-1.5 rounded-lg hover:bg-slate-200/70 hover:text-slate-900 transition cursor-pointer"
              title="Daftar Periksa (Checklist)"
            >
              <CheckSquare className="h-4 w-4" />
            </button>

            <span className="h-4 w-px bg-slate-200 mx-1" />

            <button
              type="button"
              onClick={() => wrapSelection('```\n', '\n```', '// tulis kode di sini')}
              className="p-1.5 rounded-lg hover:bg-slate-200/70 hover:text-slate-900 transition cursor-pointer"
              title="Blok Kode (Code Block)"
            >
              <Code className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('> ', '', 'Kutipan penting...')}
              className="p-1.5 rounded-lg hover:bg-slate-200/70 hover:text-slate-900 transition cursor-pointer"
              title="Kutipan (Quote)"
            >
              <Quote className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('[', '](https://example.com)', 'Teks Tautan')}
              className="p-1.5 rounded-lg hover:bg-slate-200/70 hover:text-slate-900 transition cursor-pointer"
              title="Sisipkan Tautan"
            >
              <LinkIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('![', '](https://images.unsplash.com/...)', 'Keterangan Gambar')}
              className="p-1.5 rounded-lg hover:bg-slate-200/70 hover:text-slate-900 transition cursor-pointer"
              title="Sisipkan Gambar"
            >
              <ImageIcon className="h-4 w-4" />
            </button>

            {/* Mention Button */}
            <button
              type="button"
              onClick={() => setMentionMenuOpen((prev) => !prev)}
              className="p-1.5 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition cursor-pointer text-indigo-600 font-bold"
              title="Sebut Anggota atau Peran (@mention)"
            >
              <AtSign className="h-4 w-4" />
            </button>
          </div>

          {/* Mode Switch & Autosave Indicator */}
          <div className="flex items-center gap-2">
            {/* Autosave Status Pill */}
            {saveStatus === 'saving' && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                <Clock className="h-3 w-3 animate-spin" />
                <span>Menyimpan...</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                <Check className="h-3 w-3" />
                <span>Tersimpan</span>
              </span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span>Belum disimpan</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <button
                type="button"
                onClick={() => triggerAutosave(content)}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full hover:bg-rose-100 cursor-pointer"
              >
                <AlertTriangle className="h-3 w-3" />
                <span>Gagal simpan (Coba lagi)</span>
              </button>
            )}

            {/* Write / Preview Tab Pill */}
            <div className="flex items-center p-0.5 bg-slate-200/80 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('write')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                  activeTab === 'write'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCode className="h-3.5 w-3.5" />
                <span>Tulis</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                  activeTab === 'preview'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Pratinjau</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Body */}
      <div className="relative flex-1 p-4" style={{ minHeight }}>
        {activeTab === 'write' && !readOnly ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder={placeholder}
            className="w-full h-full min-h-[280px] text-xs font-mono text-slate-800 leading-relaxed bg-transparent resize-y focus:outline-none placeholder:text-slate-400"
          />
        ) : (
          <div
            className="prose prose-sm max-w-none text-xs text-slate-800 leading-relaxed font-sans"
            dangerouslySetInnerHTML={{ __html: renderPreviewHtml(content) }}
          />
        )}

        {/* Mention Autocomplete Dropdown */}
        {mentionMenuOpen && !readOnly && (
          <div className="absolute left-6 top-12 z-20 w-64 rounded-2xl bg-white shadow-xl border border-slate-200 p-2 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 px-2">
              <span className="text-[11px] font-bold text-slate-700">Sebut (@mention)</span>
              <div className="flex gap-1 text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setMentionType('user')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer ${
                    mentionType === 'user' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500'
                  }`}
                >
                  Anggota
                </button>
                <button
                  type="button"
                  onClick={() => setMentionType('role')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer ${
                    mentionType === 'role' ? 'bg-amber-100 text-amber-800' : 'text-slate-500'
                  }`}
                >
                  Peran
                </button>
              </div>
            </div>

            <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
              {mentionType === 'user' ? (
                projectMembers.length === 0 ? (
                  <p className="p-2 text-[11px] text-slate-400 italic">Tidak ada anggota tim terdaftar</p>
                ) : (
                  projectMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleInsertMention({ name: m.name, identifier: m.email }, 'user')}
                      className="w-full text-left p-2 rounded-lg hover:bg-slate-50 text-xs flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-semibold text-slate-800 truncate">{m.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono truncate">{m.email}</span>
                    </button>
                  ))
                )
              ) : projectRoles.length === 0 ? (
                <p className="p-2 text-[11px] text-slate-400 italic">Tidak ada peran proyek terdaftar</p>
              ) : (
                projectRoles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleInsertMention({ name: r.name, identifier: r.slug }, 'role')}
                    className="w-full text-left p-2 rounded-lg hover:bg-slate-50 text-xs flex items-center justify-between cursor-pointer"
                  >
                    <span className="font-semibold text-slate-800">{r.name}</span>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 rounded">@{r.slug}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Editor Footer Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span>{content.length} karakter</span>
          <span>{content.trim() ? content.trim().split(/\s+/).length : 0} kata</span>
        </div>
        <span>Mendukung Markdown & Matriks Izin</span>
      </div>
    </div>
  );
}
