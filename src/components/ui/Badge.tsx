import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'high' | 'medium' | 'low' | 'urgent' | 'todo' | 'in_progress' | 'in_review' | 'completed' | 'default' | 'outline' | 'success' | 'danger' | 'warning';
  size?: 'sm' | 'md';
}

export function Badge({
  className = '',
  variant = 'default',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  const variantMap: Record<string, string> = {
    high: 'bg-rose-50 text-rose-600 font-bold uppercase tracking-wider',
    medium: 'bg-amber-50 text-amber-600 font-bold uppercase tracking-wider',
    low: 'bg-sky-50 text-sky-600 font-bold uppercase tracking-wider',
    urgent: 'bg-red-50 text-red-600 font-bold uppercase tracking-wider',
    todo: 'bg-slate-100 text-slate-700 font-medium',
    in_progress: 'bg-sky-50 text-sky-700 font-medium',
    in_review: 'bg-amber-50 text-amber-700 font-medium',
    completed: 'bg-emerald-50 text-emerald-700 font-medium',
    success: 'bg-emerald-50 text-emerald-700 font-medium',
    danger: 'bg-rose-50 text-rose-700 font-medium',
    warning: 'bg-amber-50 text-amber-700 font-medium',
    default: 'bg-slate-100 text-slate-700 font-medium',
    outline: 'border border-slate-300 text-slate-600 bg-transparent',
  };

  const style = variantMap[variant] || variantMap.default;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium leading-none transition-colors ${sizeClasses} ${style} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

