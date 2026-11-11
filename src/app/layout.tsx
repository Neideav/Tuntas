import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tuntas — Integrated Productivity & Learning Platform',
  description: 'Enterprise task management, project execution, calendar, and dedicated examination platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className="bg-[#090d16] text-slate-100 antialiased selection:bg-cyan-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}

