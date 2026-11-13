'use client';

import React from 'react';
import { motion } from 'motion/react';
import { SPRING_TRANSITIONS } from '@/lib/animations';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  layoutId?: string;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  className = '',
  layoutId = 'active-tab-indicator',
}: TabsProps) {
  return (
    <div className={`flex items-center gap-1 border-b border-slate-200 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`group relative flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer select-none ${
              isActive
                ? 'text-sky-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.icon && (
              <span
                className={`transition-colors ${
                  isActive ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              >
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                  isActive
                    ? 'bg-sky-100 text-sky-700'
                    : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                }`}
              >
                {tab.badge}
              </span>
            )}
            {/* Smooth animated active pill slider */}
            {isActive && (
              <motion.span
                layoutId={layoutId}
                transition={SPRING_TRANSITIONS.tight}
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
