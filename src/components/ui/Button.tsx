"use client";

import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { SPRING_TRANSITIONS } from '@/lib/animations';

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  className = '',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  leftIcon,
  rightIcon,
  children,
  ...props
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50 disabled:pointer-events-none rounded-xl select-none cursor-pointer';

  const sizeClasses: Record<string, string> = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-6 text-base gap-2.5',
    icon: 'h-10 w-10 p-0 shrink-0',
  };

  const variantClasses: Record<string, string> = {
    primary: 'bg-sky-600 text-white hover:bg-sky-700 shadow-sm shadow-sky-600/20',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200/60',
    outline: 'border border-slate-300 text-slate-700 bg-white hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/20',
  };

  const isInteractive = !disabled && !loading;

  return (
    <motion.button
      whileHover={isInteractive ? { scale: size === 'icon' ? 1.05 : 1.015 } : undefined}
      whileTap={isInteractive ? { scale: 0.97 } : undefined}
      transition={SPRING_TRANSITIONS.tight}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.primary} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      {children}
      {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </motion.button>
  );
}
