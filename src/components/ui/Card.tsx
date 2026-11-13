'use client';

import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { SPRING_TRANSITIONS } from '@/lib/animations';

export interface CardProps extends HTMLMotionProps<'div'> {
  interactive?: boolean;
}

export function Card({
  className = '',
  interactive = false,
  children,
  ...props
}: CardProps) {
  return (
    <motion.div
      whileHover={interactive ? { y: -2, transition: SPRING_TRANSITIONS.tight } : undefined}
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm transition-shadow hover:shadow-md ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-5 pb-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-5 pt-0 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-5 pt-3 border-t border-slate-100 flex items-center ${className}`} {...props}>
      {children}
    </div>
  );
}
