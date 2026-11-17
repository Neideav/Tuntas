import React from 'react';

export default function AuthRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="w-full min-h-dvh overflow-x-hidden text-[#19191D]">
      {children}
    </main>
  );
}
