'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  SlidersHorizontal,
  History,
  UserPlus,
  ChevronDown,
} from 'lucide-react';
import { AvatarStack } from '@/components/ui/AvatarStack';

export function Navbar({ onSearch }: { onSearch?: (q: string) => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [userName, setUserName] = useState('Aditya Pratama');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('tuntas_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.name) setUserName(parsed.name);
        } catch {}
      }
    }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    } else if (searchQuery.trim()) {
      router.push(`/tasks?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  // Build breadcrumbs
  const cleanPath = pathname?.replace(/^\//, '') || 'dashboard';
  const segments = cleanPath.split('/');
  const mainTitle = segments[0] ? segments[0].charAt(0).toUpperCase() + segments[0].slice(1) : 'Dashboard';

  return (
    <header className="sticky top-0 z-30 flex flex-col border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      {/* Top Bar: Title, Activity, Collaborators, Profile */}
      <div className="flex h-16 items-center justify-between px-8">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{mainTitle}</h1>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Workspace</span>
            <span>/</span>
            <span className="font-medium text-slate-600">{mainTitle}</span>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-3">
          {/* Activity button */}
          <button
            title="Activity Log"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <History className="h-3.5 w-3.5 text-slate-500" />
            <span>Activity</span>
          </button>

          {/* Collaborator Avatars Stack */}
          <div className="hidden md:flex items-center">
            <AvatarStack
              users={[
                { name: 'Diana Miller', initials: 'DM', bgColor: 'bg-amber-100 text-amber-800' },
                { name: 'Uma Larson', initials: 'UL', bgColor: 'bg-emerald-100 text-emerald-800' },
                { name: 'Chloe Ray', initials: 'CR', bgColor: 'bg-sky-100 text-sky-800' },
                { name: 'Kevin Tan', initials: 'KT', bgColor: 'bg-purple-100 text-purple-800' },
              ]}
              max={2}
            />
          </div>

          {/* Invite button */}
          <button
            title="Invite team member"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 hover:bg-sky-50 px-2.5 py-1.5 rounded-xl transition"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Invite People</span>
          </button>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* User Profile Dropdown Pill */}
          <div className="flex items-center gap-2 pl-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white font-bold text-xs ring-2 ring-slate-100">
              {userName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div className="hidden lg:block text-left text-xs">
              <p className="font-semibold text-slate-900 leading-tight">{userName}</p>
              <p className="text-[10px] text-slate-500">Administrator</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden lg:block" />
          </div>
        </div>
      </div>
    </header>
  );
}
