'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  History,
  UserPlus,
  ChevronDown,
  Menu,
  User,
  Settings,
  LogOut,
  Folder,
} from 'lucide-react';
import api from '@/lib/api';
import { useSidebar } from './sidebar-context';
import { ActivityDrawer } from './ActivityDrawer';
import { InviteModal } from './InviteModal';

// Centralized Route Meta Configuration
const ROUTE_META: Record<string, { title: string; parent: string }> = {
  dashboard: { title: 'Dashboard', parent: 'Workspace' },
  notifications: { title: 'Notifications', parent: 'Workspace' },
  tasks: { title: 'Tasks', parent: 'Workspace' },
  calendar: { title: 'Calendar', parent: 'Workspace' },
  projects: { title: 'Projects', parent: 'Management' },
  habits: { title: 'Habits', parent: 'Management' },
  goals: { title: 'Goals', parent: 'Management' },
  learning: { title: 'Learning Management', parent: 'Learning' },
  examinations: { title: 'Examinations', parent: 'Learning' },
  analytics: { title: 'Analytics', parent: 'Insights' },
  settings: { title: 'Settings', parent: 'Support' },
  categories: { title: 'Categories & Tags', parent: 'Workspace' },
};

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleMobile } = useSidebar();

  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Load real authenticated user
  const loadUser = useCallback(async () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('tuntas_user');
      if (stored && stored !== 'undefined') {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            if (parsed.name) setUserName(parsed.name);
            if (parsed.email) setUserEmail(parsed.email);
          }
        } catch {
          // ignore
        }
      }
    }

    try {
      const res = await api.get('/auth/me');
      if (res.data?.success && res.data.data) {
        const u = res.data.data;
        if (u.name) setUserName(u.name);
        if (u.email) setUserEmail(u.email);
        localStorage.setItem('tuntas_user', JSON.stringify(u));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadUser();

    // Listen to profile update events dispatched from Settings
    const handleProfileUpdated = (e: any) => {
      if (e.detail?.name) setUserName(e.detail.name);
      if (e.detail?.email) setUserEmail(e.detail.email);
    };

    window.addEventListener('tuntas:profile-updated', handleProfileUpdated);
    return () => {
      window.removeEventListener('tuntas:profile-updated', handleProfileUpdated);
    };
  }, [loadUser]);

  // Click outside and Escape listeners for profile menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('tuntas_token');
      localStorage.removeItem('tuntas_user');
      router.replace('/login');
    }
  };

  // Determine title & breadcrumb parent from centralized config
  const cleanPath = pathname?.replace(/^\//, '') || 'dashboard';
  const segments = cleanPath.split('/');
  const rootSegment = segments[0] || 'dashboard';

  let title = ROUTE_META[rootSegment]?.title || rootSegment.charAt(0).toUpperCase() + rootSegment.slice(1);
  let parent = ROUTE_META[rootSegment]?.parent || 'Workspace';

  // Handle nested exam routes
  if (rootSegment === 'examinations' && segments.length > 1) {
    if (segments[1] === 'take') {
      title = 'Assessment in Progress';
      parent = 'Examinations';
    } else if (segments[1] === 'review') {
      title = 'Assessment Review';
      parent = 'Examinations';
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex flex-col border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        {/* Row 1: Mobile Toggle & Title on left, User Profile on right */}
        <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 pt-4 pb-2">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Menu Button */}
            <button
              type="button"
              onClick={toggleMobile}
              className="md:hidden p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
              title="Open Navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
            </div>
          </div>

          {/* User Profile Pill / Interactive Dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              className="flex items-center gap-2.5 p-1 sm:px-2 sm:py-1 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition cursor-pointer select-none"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white font-bold text-xs ring-2 ring-slate-100 shadow-2xs">
                {userName
                  ? userName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'U'}
              </div>
              <span className="text-xs font-semibold text-slate-800 hidden sm:inline max-w-[120px] truncate">
                {userName}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:inline" />
            </button>

            {/* Profile Dropdown Menu */}
            <AnimatePresence>
              {isProfileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 6 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl z-50 text-xs space-y-1"
                >
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="font-bold text-slate-900 truncate">{userName}</p>
                    <p className="text-[11px] text-slate-400 truncate">{userEmail || 'Active User'}</p>
                  </div>

                  <Link
                    href="/settings"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    <span>My Profile</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition"
                  >
                    <Settings className="h-4 w-4 text-slate-400" />
                    <span>Account Settings</span>
                  </Link>

                  <div className="border-t border-slate-100 my-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition cursor-pointer text-left font-semibold"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Row 2: Centralized Breadcrumbs on left, Real Activity & Invite actions on right */}
        <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 pb-3.5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span>{parent}</span>
            <span>/</span>
            <span className="font-semibold text-slate-700">{title}</span>
          </div>

          {/* Right Tools: Activity & Invite People */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real Activity Button */}
            <button
              type="button"
              onClick={() => setIsActivityOpen(true)}
              title="Open Activity & Audit Log"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
            >
              <History className="h-3.5 w-3.5 text-slate-500" />
              <span>Activity</span>
            </button>

            {/* Invite People Button */}
            <button
              type="button"
              onClick={() => setIsInviteOpen(true)}
              title="Workspace Collaboration Information"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 hover:bg-sky-50 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Invite People</span>
            </button>
          </div>
        </div>
      </header>

      {/* Activity Drawer Component */}
      <ActivityDrawer isOpen={isActivityOpen} onClose={() => setIsActivityOpen(false)} />

      {/* Invite People Honest Modal */}
      <InviteModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
    </>
  );
}
