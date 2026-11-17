'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { RouteProgressBar } from '@/components/layout/RouteProgressBar';
import { MotionProvider, PageTransition } from '@/components/animations';
import { SidebarProvider, useSidebar } from '@/components/layout/sidebar-context';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();
  const pathname = usePathname();

  return (
    <div
      className={`min-h-screen transition-[padding] duration-200 ease-out pl-0 ${
        isCollapsed ? 'md:pl-20' : 'md:pl-64'
      }`}
    >
      <Navbar />
      <main className="px-4 py-4 sm:px-6 sm:py-6 md:px-8 w-full">
        <PageTransition key={pathname}>{children}</PageTransition>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('tuntas_token');
    }
    return false;
  });
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('tuntas_token');
    if (!token) {
      setIsAuthenticated(false);
      router.replace('/login');
      return;
    }

    // Verify validity with backend asynchronously
    api.get('/auth/me')
      .then((res) => {
        if (res.data?.success) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('tuntas_token');
          localStorage.removeItem('tuntas_user');
          setIsAuthenticated(false);
          router.replace('/login');
        }
      })
      .catch(() => {
        localStorage.removeItem('tuntas_token');
        localStorage.removeItem('tuntas_user');
        setIsAuthenticated(false);
        router.replace('/login');
      });
  }, [router]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <MotionProvider>
      <SidebarProvider>
        <RouteProgressBar />
        <div className="min-h-screen bg-[#f8f9fa] text-slate-900">
          <Sidebar />
          <DashboardContent>{children}</DashboardContent>
        </div>
      </SidebarProvider>
    </MotionProvider>
  );
}
