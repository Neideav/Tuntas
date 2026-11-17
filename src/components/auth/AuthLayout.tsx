'use client';

import React, { useEffect } from 'react';
import { AuthCharacters, AuthInteractionState } from './AuthCharacters';
import { TuntasLogo } from './TuntasLogo';

interface AuthLayoutProps {
  children: React.ReactNode;
  interactionState: AuthInteractionState;
  title?: string;
  subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  interactionState,
  title = 'Welcome back!',
  subtitle = 'Please enter your details',
}) => {
  // Sync body and html background so overscroll or browser bars match seamlessly
  useEffect(() => {
    const originalBodyBg = document.body.style.backgroundColor;
    const originalHtmlBg = document.documentElement.style.backgroundColor;
    const htmlHadDark = document.documentElement.classList.contains('dark');

    document.body.style.backgroundColor = '#EAEAEA';
    document.documentElement.style.backgroundColor = '#EAEAEA';
    if (htmlHadDark) {
      document.documentElement.classList.remove('dark');
    }

    return () => {
      document.body.style.backgroundColor = originalBodyBg;
      document.documentElement.style.backgroundColor = originalHtmlBg;
      if (htmlHadDark) {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  return (
    <div className="w-full min-h-dvh h-screen flex flex-col lg:flex-row overflow-x-hidden selection:bg-[#6528F5] selection:text-white">
      {/* ================= LEFT PANEL: FULLSCREEN ILLUSTRATION (~55%) ================= */}
      <div className="w-full lg:w-[55%] h-[360px] sm:h-[420px] lg:h-full bg-[#EAEAEA] relative overflow-hidden flex flex-col justify-between p-6 sm:p-10 lg:p-12 shrink-0">
        {/* Top Branding Pill */}
        <div className="flex items-center gap-2 z-10">
          <span className="text-[11px] font-black tracking-widest uppercase text-[#19191D]/60 bg-white/80 backdrop-blur-xs px-3.5 py-1 rounded-full border border-black/5 shadow-2xs">
            Tuntas Platform
          </span>
        </div>

        {/* Massive Interactive Mascot Scene anchored to the bottom edge */}
        <div className="w-full flex-1 flex items-end justify-center z-10 min-h-0 pt-4 pb-0">
          <AuthCharacters
            state={interactionState}
            className="w-full h-full max-w-[880px] 2xl:max-w-[1020px] max-h-[720px] 2xl:max-h-[840px]"
          />
        </div>

        {/* Subtle baseline line along the floor */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/5" />
      </div>

      {/* ================= RIGHT PANEL: AUTHENTICATION FORM (~45%) ================= */}
      <div className="w-full lg:w-[45%] min-h-[520px] lg:h-full bg-[#FFFFFF] flex flex-col justify-between p-6 sm:p-10 lg:p-14 overflow-y-auto">
        {/* Top: Geometric Logo */}
        <div className="flex justify-center pt-2 shrink-0">
          <TuntasLogo className="h-9 w-9 text-[#19191D]" />
        </div>

        {/* Middle: Centered Form Container (Max 420px for ideal form ergonomics) */}
        <div className="w-full max-w-[420px] mx-auto my-auto py-6 sm:py-8 space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#19191D] tracking-tight">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-[#858585] font-normal">
              {subtitle}
            </p>
          </div>

          {/* Form Content */}
          {children}
        </div>

        {/* Bottom: Subtle Footer */}
        <div className="text-center text-[11px] text-[#A0A0A0] pt-4 shrink-0">
          © {new Date().getFullYear()} Tuntas. Educational Productivity System.
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
