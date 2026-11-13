"use client";

import React from "react";
import { MotionConfig } from "motion/react";

interface MotionProviderProps {
  children: React.ReactNode;
}

/**
 * Root Animation Configuration Provider
 * Sets system-wide reduced motion policy:
 * automatically respects user's OS preference (`prefers-reduced-motion`).
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  );
}

