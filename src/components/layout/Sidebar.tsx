'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
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
  PanelLeftOpen,
  MoreVertical,
} from 'lucide-react';
import api from '@/lib/api';
import { SPRING_TRANSITIONS } from '@/lib/animations';
import { useSidebar } from './sidebar-context';

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
  const { isCollapsed, toggleSidebar } = useSidebar();

  const [userName, setUserName] = useState('Aditya Pratama');
  const [userEmail, setUserEmail] = useState('demo@tuntas.test');
  const [unreadCount, setUnreadCount] = useState(3);
  const [categories, setCategories] = useState<{ id: number; name: string; color?: string }[]>([
    { id: 1, name: 'Administrator', color: '#0284c7' },
    { id: 2, name: 'Computer Science', color: '#3b82f6' },
    { id: 3, name: 'Mathematics', color: '#8b5cf6' },
  ]);

  useEffect(() => {
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
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 256 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200/80 bg-white shadow-xs overflow-hidden select-none"
    >
      {/* Top Header: Workspace Title & Collapse Toggle */}
      <div className={`flex items-center pt-5 pb-3 transition-all ${isCollapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
        <AnimatePresence initial={false} mode="wait">
          {!isCollapsed && (
            <motion.span
              key="workspace-label"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="text-xs font-bold text-slate-400 uppercase tracking-wider"
            >
              Workspace
            </motion.span>
          )}
        </AnimatePresence>

        <motion.button
          onClick={toggleSidebar}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.88 }}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="rounded-lg p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </motion.button>
      </div>

      {/* Workspace Selector Card */}
      <div className="px-3 pb-3">
        <motion.div
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
          transition={SPRING_TRANSITIONS.tight}
          className={`flex items-center rounded-xl bg-slate-50 border border-slate-200/60 p-2 cursor-pointer hover:bg-slate-100/70 hover:border-slate-300 transition-colors ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-sm shadow-xs">
              T
            </div>
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="truncate text-xs"
                >
                  <p className="font-bold text-slate-900 truncate">Tuntas Workspace</p>
                  <p className="text-[11px] text-slate-500 truncate">{userEmail}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {!isCollapsed && <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-1" />}
        </motion.div>
      </div>

      {/* Navigation Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-3 space-y-6 py-2 no-scrollbar">
        {/* Main Navigation */}
        <div>
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
              >
                Main Menu
              </motion.p>
            )}
          </AnimatePresence>

          <nav className="space-y-1">
            {mainNavigation.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
              const Icon = item.icon;

              return (
                <div key={item.name} className="relative group">
                  <motion.div
                    whileHover={{ x: isCollapsed ? 0 : 3 }}
                    whileTap={{ scale: 0.98 }}
                    transition={SPRING_TRANSITIONS.tight}
                  >
                    <Link
                      href={item.href}
                      className={`relative flex items-center rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                        isCollapsed ? 'justify-center' : 'justify-between'
                      } ${
                        isActive
                          ? 'text-sky-700'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {/* Fluid Active Sliding Pill Indicator */}
                      {isActive && (
                        <motion.span
                          layoutId="active-sidebar-pill"
                          className="absolute inset-0 bg-sky-50 rounded-xl border border-sky-100/90 shadow-xs -z-0"
                          transition={SPRING_TRANSITIONS.tight}
                        />
                      )}

                      <div className="relative z-10 flex items-center gap-2.5 truncate">
                        <motion.span
                          animate={{ scale: isActive ? 1.08 : 1 }}
                          transition={SPRING_TRANSITIONS.tight}
                        >
                          <Icon
                            className={`h-4 w-4 shrink-0 transition-colors ${
                              isActive ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-700'
                            }`}
                          />
                        </motion.span>

                        <AnimatePresence initial={false}>
                          {!isCollapsed && (
                            <motion.span
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -6 }}
                              transition={{ duration: 0.15 }}
                              className="truncate"
                            >
                              {item.name}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Notification Count Badge */}
                      {item.badgeKey === 'notifications' && unreadCount > 0 && (
                        <motion.span
                          initial={{ scale: 0.7, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={SPRING_TRANSITIONS.tight}
                          className={`relative z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs ${
                            isCollapsed ? 'absolute -top-1 -right-1' : ''
                          }`}
                        >
                          {unreadCount}
                        </motion.span>
                      )}
                    </Link>
                  </motion.div>

                  {/* Collapsed Tooltip */}
                  {isCollapsed && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md">
                      {item.name}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Division / Categories Section */}
        <div>
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between px-3 mb-2"
              >
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Division
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1">
            {categories.map((cat) => (
              <div key={cat.id} className="relative group">
                <motion.div
                  whileHover={{ x: isCollapsed ? 0 : 2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING_TRANSITIONS.tight}
                >
                  <Link
                    href={`/tasks?category=${cat.id}`}
                    className={`flex items-center rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors ${
                      isCollapsed ? 'justify-center' : 'justify-between'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Folder
                        className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-sky-600 transition-colors"
                        style={{ color: cat.color }}
                      />
                      <AnimatePresence initial={false}>
                        {!isCollapsed && (
                          <motion.span
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -6 }}
                            transition={{ duration: 0.15 }}
                            className="truncate"
                          >
                            {cat.name}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>

                    {!isCollapsed && (
                      <MoreVertical className="h-3 w-3 text-slate-400 shrink-0 opacity-0 group-hover:opacity-100 hover:text-slate-700 transition" />
                    )}
                  </Link>
                </motion.div>

                {isCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md">
                    {cat.name}
                  </div>
                )}
              </div>
            ))}

            <motion.div
              whileHover={{ scale: 1.02, x: isCollapsed ? 0 : 2 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_TRANSITIONS.tight}
            >
              <Link
                href="/categories"
                title="Create Category"
                className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-sky-600 hover:bg-sky-50 transition-colors ${
                  isCollapsed ? 'justify-center' : ''
                }`}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      Create New
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Help Center Section */}
        <div>
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
              >
                Help Center
              </motion.p>
            )}
          </AnimatePresence>

          <div className="space-y-1">
            <motion.div
              whileHover={{ x: isCollapsed ? 0 : 2 }}
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TRANSITIONS.tight}
              className="relative group"
            >
              <a
                href="https://github.com/Neideav/Tuntas"
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors ${
                  isCollapsed ? 'justify-center' : ''
                }`}
              >
                <HelpCircle className="h-4 w-4 text-slate-400 shrink-0" />
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      Help & Docs
                    </motion.span>
                  )}
                </AnimatePresence>
              </a>
              {isCollapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md">
                  Help & Docs
                </div>
              )}
            </motion.div>

            <motion.div
              whileHover={{ x: isCollapsed ? 0 : 2 }}
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TRANSITIONS.tight}
              className="relative group"
            >
              <Link
                href="/settings"
                className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  isCollapsed ? 'justify-center' : ''
                } ${
                  pathname === '/settings'
                    ? 'text-sky-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {pathname === '/settings' && (
                  <motion.span
                    layoutId="active-sidebar-pill"
                    className="absolute inset-0 bg-sky-50 rounded-xl border border-sky-100/90 shadow-xs -z-0"
                    transition={SPRING_TRANSITIONS.tight}
                  />
                )}
                <Settings
                  className={`relative z-10 h-4 w-4 shrink-0 transition-colors ${
                    pathname === '/settings' ? 'text-sky-600' : 'text-slate-400'
                  }`}
                />
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="relative z-10"
                    >
                      Settings
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
              {isCollapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md">
                  Settings
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* User Profile & Logout Bottom Row */}
      <div className="border-t border-slate-100 p-3 bg-white">
        <motion.div
          whileHover={{ scale: 1.01 }}
          transition={SPRING_TRANSITIONS.tight}
          className={`flex items-center rounded-xl bg-slate-50 border border-slate-100 p-2 ${
            isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'
          }`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800 font-bold text-xs shadow-xs">
              {userName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="truncate text-xs"
                >
                  <p className="font-semibold text-slate-900 truncate">{userName}</p>
                  <p className="text-[10px] text-slate-400 truncate">Online</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            onClick={handleLogout}
            whileHover={{ scale: 1.15, rotate: 6 }}
            whileTap={{ scale: 0.9 }}
            title="Log Out"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </motion.button>
        </motion.div>
      </div>
    </motion.aside>
  );
}
