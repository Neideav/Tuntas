'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  CheckSquare,
  FolderKanban,
  Flame,
  Target,
  BookOpen,
  GraduationCap,
  Calendar,
  Bell,
  Settings,
  HelpCircle,
  Folder,
  Plus,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  MoreVertical,
} from 'lucide-react';
import api from '@/lib/api';

const mainNavigation = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Habits', href: '/habits', icon: Flame },
  { name: 'Goals', href: '/goals', icon: Target },
  { name: 'Learning', href: '/learning', icon: BookOpen },
  { name: 'Examinations', href: '/examinations', icon: GraduationCap },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Notification', href: '/notifications', icon: Bell, badgeKey: 'notifications' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState('Aditya Pratama');
  const [userEmail, setUserEmail] = useState('demo@tuntas.test');
  const [unreadCount, setUnreadCount] = useState(3);
  const [categories, setCategories] = useState<{ id: number; name: string; color?: string }[]>([
    { id: 1, name: 'Administrator', color: '#0284c7' },
    { id: 2, name: 'Computer Science', color: '#3b82f6' },
    { id: 3, name: 'Mathematics', color: '#8b5cf6' },
  ]);

  useEffect(() => {
    // Read local user
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('tuntas_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.name) setUserName(parsed.name);
          if (parsed.email) setUserEmail(parsed.email);
        } catch {
          // ignore
        }
      }
    }

    // Fetch categories and notifications count
    api.get('/categories')
      .then((res: any) => {
        if (res.data?.success && res.data.data?.length > 0) {
          setCategories(res.data.data.slice(0, 5));
        }
      })
      .catch(() => {});

    api.get('/notifications')
      .then((res: any) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          const unread = res.data.data.filter((n: any) => !n.is_read).length;
          setUnreadCount(unread);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('tuntas_token');
    localStorage.removeItem('tuntas_user');
    router.replace('/login');
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200/80 bg-white">
      {/* Top Header: Workspace & Collapse */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Workspace
        </span>
        <button
          title="Collapse sidebar"
          className="text-slate-400 hover:text-slate-700 transition"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Workspace Selector Card */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/60 hover:bg-slate-100/70 transition cursor-pointer">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-sm shadow-sm">
              T
            </div>
            <div className="truncate text-xs">
              <p className="font-bold text-slate-900 truncate">Tuntas Workspace</p>
              <p className="text-[11px] text-slate-500 truncate">{userEmail}</p>
            </div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-1" />
        </div>
      </div>

      {/* Navigation Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-3 space-y-6 py-2">
        {/* Main Menu */}
        <div>
          <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Main Menu
          </p>
          <nav className="space-y-0.5">
            {mainNavigation.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 border border-sky-100 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-sky-600' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>
                  {item.badgeKey === 'notifications' && unreadCount > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Division / Categories Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Division
            </p>
          </div>
          <div className="space-y-0.5">
            {categories.map((cat, idx) => (
              <Link
                key={cat.id}
                href={`/tasks?category=${cat.id}`}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition ${
                  idx === 0
                    ? 'bg-sky-50/70 text-sky-700 border border-sky-200/50'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Folder
                    className={`h-3.5 w-3.5 shrink-0 ${
                      idx === 0 ? 'text-sky-600' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{cat.name}</span>
                </div>
                <MoreVertical className="h-3 w-3 text-slate-400 shrink-0 hover:text-slate-600" />
              </Link>
            ))}
            <Link
              href="/categories"
              className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-sky-600 hover:bg-sky-50 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create New</span>
            </Link>
          </div>
        </div>

        {/* Help Center Section */}
        <div>
          <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Help Center
          </p>
          <div className="space-y-0.5">
            <a
              href="https://github.com/Neideav/Tuntas"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            >
              <HelpCircle className="h-4 w-4 text-slate-400 shrink-0" />
              <span>Help & Docs</span>
            </a>
            <Link
              href="/settings"
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                pathname === '/settings'
                  ? 'bg-sky-50 text-sky-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Settings className="h-4 w-4 text-slate-400 shrink-0" />
              <span>Settings</span>
            </Link>
          </div>
        </div>
      </div>

      {/* User Profile & Logout Bottom Row */}
      <div className="border-t border-slate-100 p-3 bg-white">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800 font-bold text-xs">
              {userName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div className="truncate text-xs">
              <p className="font-semibold text-slate-900 truncate">{userName}</p>
              <p className="text-[10px] text-slate-400 truncate">Online</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
