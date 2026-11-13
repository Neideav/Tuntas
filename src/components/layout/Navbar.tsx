'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  History,
  UserPlus,
  ChevronDown,
} from 'lucide-react';
import { AvatarStack } from '@/components/ui/AvatarStack';

export function Navbar({ onSearch }: { onSearch?: (q: string) => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState('Icih Caroline');

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

  // Determine title & breadcrumb based on pathname
  const cleanPath = pathname?.replace(/^\//, '') || 'dashboard';
  const segments = cleanPath.split('/');
  
  let mainTitle = 'Administrator';
  let breadcrumbParent = 'Division';
  
  if (segments[0] === 'dashboard') {
    mainTitle = 'Dashboard';
    breadcrumbParent = 'Workspace';
  } else if (segments[0] === 'tasks') {
    mainTitle = 'Administrator';
    breadcrumbParent = 'Division';
  } else if (segments[0] === 'projects') {
    mainTitle = 'Projects';
    breadcrumbParent = 'Workspace';
  } else if (segments[0] === 'calendar') {
    mainTitle = 'Calendar';
    breadcrumbParent = 'Workspace';
  } else if (segments[0] === 'habits') {
    mainTitle = 'Habits';
    breadcrumbParent = 'Workspace';
  } else if (segments[0] === 'goals') {
    mainTitle = 'Goals';
    breadcrumbParent = 'Workspace';
  } else if (segments[0] === 'learning') {
    mainTitle = 'Learning';
    breadcrumbParent = 'Workspace';
  } else if (segments[0] === 'examinations') {
    mainTitle = 'Examinations';
    breadcrumbParent = 'Workspace';
  } else if (segments[0] === 'analytics') {
    mainTitle = 'Analytics';
    breadcrumbParent = 'Workspace';
  } else if (segments[0] === 'settings') {
    mainTitle = 'Settings';
    breadcrumbParent = 'Workspace';
  } else if (segments[0] === 'notifications') {
    mainTitle = 'Notifications';
    breadcrumbParent = 'Workspace';
  } else if (segments[0]) {
    mainTitle = segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
    breadcrumbParent = 'Workspace';
  }

  return (
    <header className="sticky top-0 z-30 flex flex-col border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      {/* Row 1: Main Title on left, User Profile on right */}
      <div className="flex items-center justify-between px-8 pt-5 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{mainTitle}</h1>
        </div>

        {/* User Profile Pill / Dropdown */}
        <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition select-none">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-white font-bold text-xs ring-2 ring-slate-100 overflow-hidden shadow-2xs">
            {userName
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-slate-800 hidden sm:inline">{userName}</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </div>
      </div>

      {/* Row 2: Breadcrumbs on left, Activity & Collaborators & Invite on right */}
      <div className="flex items-center justify-between px-8 pb-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <span>{breadcrumbParent}</span>
          <span>/</span>
          <span className="font-semibold text-slate-700">{mainTitle}</span>
        </div>

        {/* Right Tools: Activity, Collaborators, Invite People */}
        <div className="flex items-center gap-3">
          {/* Activity button */}
          <button
            title="Activity Log"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          >
            <History className="h-3.5 w-3.5 text-slate-500" />
            <span>Activity</span>
          </button>

          {/* Collaborator Avatars Stack */}
          <div className="flex items-center">
            <AvatarStack
              users={[
                { name: 'Diana Miller', initials: 'DM', bgColor: 'bg-slate-100 text-slate-700' },
                { name: 'Uma Larson', initials: 'UL', bgColor: 'bg-emerald-100 text-emerald-700' },
                { name: 'Chloe Ray', initials: 'CR', bgColor: 'bg-sky-100 text-sky-700' },
                { name: 'Kevin Tan', initials: 'KT', bgColor: 'bg-purple-100 text-purple-700' },
              ]}
              max={2}
            />
          </div>

          {/* Invite People button */}
          <button
            title="Invite team member"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 hover:bg-sky-50 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Invite People</span>
          </button>
        </div>
      </div>
    </header>
  );
}
