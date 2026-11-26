'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home,
  Bell,
  CheckSquare,
  Calendar,
  FolderKanban,
  Flame,
  Target,
  BookOpen,
  GraduationCap,
  BarChart3,
  Settings,
  HelpCircle,
  Folder,
  Plus,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  MoreVertical,
  Edit2,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import api from '@/lib/api';
import { SPRING_TRANSITIONS } from '@/lib/animations';
import { useSidebar } from './sidebar-context';
import { HelpModal } from '@/components/ui/HelpModal';
import { showToast } from '@/components/ui/Toast';

// Sidebar Groups Configuration
const navigationGroups = [
  {
    title: 'Workspace',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'Notifications', href: '/notifications', icon: Bell, badgeKey: 'notifications' },
      { name: 'Tasks', href: '/tasks', icon: CheckSquare },
      { name: 'Calendar', href: '/calendar', icon: Calendar },
    ],
  },
  {
    title: 'Management',
    items: [
      { name: 'Projects', href: '/projects', icon: FolderKanban },
      { name: 'Habits', href: '/habits', icon: Flame },
      { name: 'Goals', href: '/goals', icon: Target },
    ],
  },
  {
    title: 'Learning',
    items: [
      { name: 'Learning', href: '/learning', icon: BookOpen },
      { name: 'Examinations', href: '/examinations', icon: GraduationCap },
    ],
  },
  {
    title: 'Insights',
    items: [
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    ],
  },
];

interface CategoryItem {
  id: number;
  name: string;
  color?: string;
  tasks_count?: number;
}

const PRESET_COLORS = [
  '#0284c7', // Sky Blue
  '#3b82f6', // Royal Blue
  '#8b5cf6', // Violet
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isCollapsed, toggleSidebar, isMobileOpen, closeMobile } = useSidebar();

  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);

  // Category Actions State
  const [activeCategoryMenu, setActiveCategoryMenu] = useState<number | null>(null);
  const [categoryModal, setCategoryModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    category?: CategoryItem;
  }>({ isOpen: false, mode: 'create' });
  const [modalCatName, setModalCatName] = useState('');
  const [modalCatColor, setModalCatColor] = useState('#0284c7');
  const [savingCategory, setSavingCategory] = useState(false);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);

  // Sync user data and fetch categories + notifications
  const loadInitialData = useCallback(async () => {
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
      const [userRes, catRes, notifRes] = await Promise.allSettled([
        api.get('/auth/me'),
        api.get('/categories'),
        api.get('/notifications'),
      ]);

      if (userRes.status === 'fulfilled' && userRes.value.data?.success) {
        const u = userRes.value.data.data;
        if (u.name) setUserName(u.name);
        if (u.email) setUserEmail(u.email);
        localStorage.setItem('tuntas_user', JSON.stringify(u));
      }

      if (catRes.status === 'fulfilled' && catRes.value.data?.success) {
        setCategories(catRes.value.data.data || []);
      }

      if (notifRes.status === 'fulfilled' && notifRes.value.data?.success) {
        const data = notifRes.value.data.data;
        if (Array.isArray(data)) {
          setUnreadCount(data.filter((n: any) => !n.is_read).length);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadInitialData();

    // Listen to custom profile update event from settings
    const handleProfileUpdated = (e: any) => {
      if (e.detail?.name) setUserName(e.detail.name);
      if (e.detail?.email) setUserEmail(e.detail.email);
    };

    window.addEventListener('tuntas:profile-updated', handleProfileUpdated);
    return () => {
      window.removeEventListener('tuntas:profile-updated', handleProfileUpdated);
    };
  }, [loadInitialData]);

  // Click outside listener for popups
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (workspaceRef.current && !workspaceRef.current.contains(e.target as Node)) {
        setIsWorkspaceMenuOpen(false);
      }
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) {
        setActiveCategoryMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsWorkspaceMenuOpen(false);
        setActiveCategoryMenu(null);
        if (isMobileOpen) closeMobile();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileOpen, closeMobile]);

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

  // Category CRUD Handlers
  const openCreateCategory = () => {
    setModalCatName('');
    setModalCatColor('#0284c7');
    setCategoryModal({ isOpen: true, mode: 'create' });
    setActiveCategoryMenu(null);
  };

  const openEditCategory = (cat: CategoryItem) => {
    setModalCatName(cat.name);
    setModalCatColor(cat.color || '#0284c7');
    setCategoryModal({ isOpen: true, mode: 'edit', category: cat });
    setActiveCategoryMenu(null);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCatName.trim()) return;

    try {
      setSavingCategory(true);
      if (categoryModal.mode === 'create') {
        const res = await api.post('/categories', {
          name: modalCatName.trim(),
          color: modalCatColor,
        });
        if (res.data?.success) {
          setCategories((prev) => [...prev, res.data.data]);
        }
      } else if (categoryModal.mode === 'edit' && categoryModal.category) {
        const res = await api.put(`/categories/${categoryModal.category.id}`, {
          name: modalCatName.trim(),
          color: modalCatColor,
        });
        if (res.data?.success) {
          setCategories((prev) =>
            prev.map((c) => (c.id === categoryModal.category!.id ? { ...c, ...res.data.data } : c))
          );
        }
      }
      setCategoryModal({ isOpen: false, mode: 'create' });
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save category.', 'error');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category? Associated items will remain unassigned.')) return;
    try {
      await api.delete(`/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setActiveCategoryMenu(null);
      showToast('Category deleted successfully.', 'info');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete category.', 'error');
    }
  };

  // Nav Item click on mobile
  const handleNavClick = () => {
    if (isMobileOpen) {
      closeMobile();
    }
  };

  // Check if general tasks route is active (not filtering by category)
  const isGeneralTasksActive =
    pathname === '/tasks' && (!searchParams || !searchParams.get('category'));

  // Content of the sidebar
  const sidebarContent = (
    <div className="flex flex-col h-full overflow-hidden bg-white select-none">
      {/* Top Header: Workspace Title & Collapse/Close Toggle */}
      <div
        className={`flex items-center pt-5 pb-3 transition-all ${
          isCollapsed ? 'justify-center px-2' : 'justify-between px-5'
        }`}
      >
        <AnimatePresence initial={false} mode="wait">
          {!isCollapsed && (
            <motion.span
              key="workspace-label"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="text-base font-bold text-slate-900 tracking-tight"
            >
              Workspace
            </motion.span>
          )}
        </AnimatePresence>

        {/* Desktop Collapse / Mobile Close Button */}
        <div className="flex items-center gap-1">
          <button
            onClick={closeMobile}
            className="md:hidden rounded-lg p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Close menu"
          >
            <X className="h-5 w-5" />
          </button>

          <button
            onClick={toggleSidebar}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:inline-flex rounded-lg p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Workspace Selector Card with Functional Dropdown */}
      <div className="px-3 pb-3 relative" ref={workspaceRef}>
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          transition={SPRING_TRANSITIONS.tight}
          onClick={() => setIsWorkspaceMenuOpen((prev) => !prev)}
          className={`flex items-center rounded-2xl bg-white border border-slate-200 p-2.5 cursor-pointer hover:border-slate-300 shadow-2xs transition-colors ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white font-bold text-sm shadow-xs">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 6h3.5l3 8 2.5-6h2l2.5 6 3-8H20l-4.5 12h-2L11 12l-2.5 6h-2L4 6z" />
              </svg>
            </div>
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="truncate text-xs text-left"
                >
                  <p className="font-bold text-slate-900 truncate">Personal Workspace</p>
                  <p className="text-[11px] text-slate-400 truncate">{userEmail || 'Active Workspace'}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {!isCollapsed && <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 mr-0.5" />}
        </motion.div>

        {/* Workspace Dropdown Popover */}
        <AnimatePresence>
          {isWorkspaceMenuOpen && !isCollapsed && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute left-3 right-3 top-full mt-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 text-xs space-y-1"
            >
              <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1">
                <span className="font-bold text-slate-800 block">Personal Workspace</span>
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                  Single-User Mode (Active)
                </span>
              </div>
              <Link
                href="/settings"
                onClick={() => {
                  setIsWorkspaceMenuOpen(false);
                  handleNavClick();
                }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
              >
                <Settings className="h-3.5 w-3.5 text-slate-400" />
                <span>Workspace Settings</span>
              </Link>
              <Link
                href="/categories"
                onClick={() => {
                  setIsWorkspaceMenuOpen(false);
                  handleNavClick();
                }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
              >
                <Folder className="h-3.5 w-3.5 text-slate-400" />
                <span>Manage Categories</span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-3 space-y-5 py-2 no-scrollbar">
        {/* Main Navigation Groups (Workspace, Management, Learning, Insights) */}
        {navigationGroups.map((group) => (
          <div key={group.title}>
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                >
                  {group.title}
                </motion.p>
              )}
            </AnimatePresence>

            <nav className="space-y-0.5">
              {group.items.map((item) => {
                let isActive = false;
                if (item.href === '/dashboard') {
                  isActive = pathname === '/dashboard';
                } else if (item.href === '/tasks') {
                  isActive = isGeneralTasksActive;
                } else {
                  isActive =
                    pathname === item.href ||
                    (pathname?.startsWith(item.href) && !pathname?.startsWith('/tasks'));
                }

                const Icon = item.icon;

                return (
                  <div key={item.name} className="relative group">
                    <motion.div
                      whileHover={{ x: isCollapsed ? 0 : 2 }}
                      whileTap={{ scale: 0.98 }}
                      transition={SPRING_TRANSITIONS.tight}
                    >
                      <Link
                        href={item.href}
                        onClick={handleNavClick}
                        className={`relative flex items-center rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                          isCollapsed ? 'justify-center' : 'justify-between'
                        } ${
                          isActive
                            ? 'text-white font-bold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="active-sidebar-pill"
                            className="absolute inset-0 bg-slate-900 rounded-xl shadow-xs -z-0"
                            transition={SPRING_TRANSITIONS.tight}
                          />
                        )}

                        <div className="relative z-10 flex items-center gap-2.5 truncate">
                          <Icon
                            className={`h-4 w-4 shrink-0 transition-colors ${
                              isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'
                            }`}
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
                                {item.name}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Unread Notifications Badge */}
                        {item.badgeKey === 'notifications' && unreadCount > 0 && (
                          <span
                            className={`relative z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-2xs ${
                              isCollapsed ? 'absolute -top-1 -right-1' : ''
                            }`}
                          >
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                    </motion.div>

                    {/* Tooltip on collapsed state */}
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
        ))}

        {/* Dynamic CATEGORIES Section */}
        <div>
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between px-3 mb-1.5"
              >
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Categories
                </p>
                <button
                  onClick={openCreateCategory}
                  title="Create Category"
                  className="p-0.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1 relative" ref={categoryMenuRef}>
            {categories.map((cat) => {
              const isCategoryActive =
                pathname === '/tasks' && searchParams?.get('category') === String(cat.id);

              return (
                <div key={cat.id} className="relative group">
                  <div
                    className={`flex items-center justify-between rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isCategoryActive
                        ? 'bg-slate-900 text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent'
                    }`}
                  >
                    <Link
                      href={`/tasks?category=${cat.id}`}
                      onClick={handleNavClick}
                      className="flex items-center gap-2.5 truncate flex-1"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color || '#0284c7' }}
                      />
                      <AnimatePresence initial={false}>
                        {!isCollapsed && (
                          <motion.span
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -4 }}
                            className="truncate"
                          >
                            {cat.name}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>

                    {!isCollapsed && (
                      <div className="flex items-center gap-1 shrink-0">
                        {cat.tasks_count !== undefined && cat.tasks_count > 0 && (
                          <span className="text-[10px] font-semibold text-slate-400 px-1.5 py-0.2 rounded-full bg-slate-100">
                            {cat.tasks_count}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveCategoryMenu(activeCategoryMenu === cat.id ? null : cat.id);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition cursor-pointer"
                          title="Category actions"
                        >
                          <MoreVertical className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Category Action Dropdown Menu */}
                  <AnimatePresence>
                    {activeCategoryMenu === cat.id && !isCollapsed && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full mt-1 w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 text-xs space-y-0.5"
                      >
                        <button
                          onClick={() => {
                            router.push(`/tasks?category=${cat.id}`);
                            setActiveCategoryMenu(null);
                            handleNavClick();
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 transition cursor-pointer text-left"
                        >
                          <Folder className="h-3.5 w-3.5 text-slate-400" />
                          <span>View Tasks</span>
                        </button>
                        <button
                          onClick={() => openEditCategory(cat)}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 transition cursor-pointer text-left"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer text-left"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* Create Category action button */}
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
              <button
                type="button"
                onClick={openCreateCategory}
                className={`w-full flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer ${
                  isCollapsed ? 'justify-center' : ''
                }`}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      Create Category
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          </div>
        </div>

        {/* SUPPORT Section — Settings appears strictly ONCE! */}
        <div>
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-3 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
              >
                Support
              </motion.p>
            )}
          </AnimatePresence>

          <div className="space-y-0.5">
            {/* Help & Support Button */}
            <motion.div whileHover={{ x: isCollapsed ? 0 : 2 }} whileTap={{ scale: 0.98 }}>
              <button
                type="button"
                onClick={() => setIsHelpOpen(true)}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer ${
                  isCollapsed ? 'justify-center' : ''
                }`}
              >
                <HelpCircle className="h-4 w-4 text-slate-400 shrink-0" />
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      Help & Support
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>

            {/* Settings Link (The ONLY Settings entry in the sidebar!) */}
            <motion.div whileHover={{ x: isCollapsed ? 0 : 2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/settings"
                onClick={handleNavClick}
                className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  isCollapsed ? 'justify-center' : ''
                } ${
                  pathname === '/settings'
                    ? 'text-white font-bold'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                {pathname === '/settings' && (
                  <motion.span
                    layoutId="active-sidebar-pill"
                    className="absolute inset-0 bg-slate-900 rounded-xl shadow-xs -z-0"
                    transition={SPRING_TRANSITIONS.tight}
                  />
                )}
                <Settings
                  className={`relative z-10 h-4 w-4 shrink-0 transition-colors ${
                    pathname === '/settings' ? 'text-white' : 'text-slate-400'
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
            </motion.div>
          </div>
        </div>
      </div>

      {/* ACCOUNT Section (Anchored at the bottom) */}
      <div className="border-t border-slate-100 p-3 bg-white mt-auto">
        <div
          className={`flex items-center rounded-xl bg-slate-50 border border-slate-100 p-2 ${
            isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'
          }`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800 font-bold text-xs shadow-2xs">
              {userName
                ? userName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()
                : 'U'}
            </div>
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <div className="truncate text-xs text-left">
                  <p className="font-semibold text-slate-900 truncate">{userName}</p>
                  <p className="text-[10px] text-slate-400 truncate">{userEmail || 'Authenticated'}</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleLogout}
            title="Log Out"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Create / Edit Category Modal */}
      <AnimatePresence>
        {categoryModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCategoryModal({ isOpen: false, mode: 'create' })}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 z-10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-900">
                  {categoryModal.mode === 'create' ? 'Create New Category' : 'Edit Category'}
                </h3>
                <button
                  onClick={() => setCategoryModal({ isOpen: false, mode: 'create' })}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCategory} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Work, Research, Personal"
                    value={modalCatName}
                    onChange={(e) => setModalCatName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Badge Color
                  </label>
                  <div className="flex items-center gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setModalCatColor(c)}
                        style={{ backgroundColor: c }}
                        className={`h-6 w-6 rounded-full flex items-center justify-center transition cursor-pointer ${
                          modalCatColor === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'opacity-85'
                        }`}
                      >
                        {modalCatColor === c && <Check className="h-3 w-3 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCategoryModal({ isOpen: false, mode: 'create' })}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCategory || !modalCatName.trim()}
                    className="px-4 py-1.5 rounded-xl bg-[#19191D] hover:bg-black active:bg-[#111113] disabled:opacity-50 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition cursor-pointer"
                  >
                    {savingCategory ? 'Saving...' : categoryModal.mode === 'create' ? 'Create' : 'Save'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Fixed Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 256 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="hidden md:flex fixed inset-y-0 left-0 z-40 flex-col border-r border-slate-200/80 bg-white shadow-xs overflow-hidden select-none"
      >
        {sidebarContent}
      </motion.aside>

      {/* 2. Mobile Drawer & Backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMobile}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            />

            {/* Sliding Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="relative w-72 max-w-[85vw] h-full bg-white shadow-2xl z-10 border-r border-slate-200 overflow-hidden"
            >
              {sidebarContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
