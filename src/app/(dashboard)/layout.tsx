'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { MotionProvider, PageTransition } from '@/components/animations';
import { SidebarProvider, useSidebar } from '@/components/layout/sidebar-context';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();
  return (
    <div
      className={`min-h-screen bg-[#090d16] text-slate-100 dark transition-[padding] duration-200 ease-out pl-0 ${
        isCollapsed ? 'md:pl-20' : 'md:pl-64'
      }`}
    >
      <Navbar />
      <main className="px-4 py-4 sm:px-6 sm:py-6 md:px-8 w-full">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('tuntas_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    // Verifikasi validitas sesi token dengan backend
    api.get('/auth/me')
      .then((res) => {
        if (res.data?.success) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('tuntas_token');
          localStorage.removeItem('tuntas_user');
          router.replace('/login');
        }
      })
      .catch(() => {
        localStorage.removeItem('tuntas_token');
        localStorage.removeItem('tuntas_user');
        router.replace('/login');
      });
  }, [router]);

  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <MotionProvider>
      <SidebarProvider>
        <div className="min-h-screen bg-[#f8f9fa] text-slate-900">
          <Sidebar />
          <DashboardContent>{children}</DashboardContent>
        </div>
      </SidebarProvider>
    </MotionProvider>
  );
}
