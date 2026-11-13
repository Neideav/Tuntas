"use client";

import React from "react";
import { motion } from "motion/react";
import { fadeUp } from "@/lib/animations";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Lightweight Page Transition wrapper
 * Provides subtle opacity + translateY entrance without blocking Next.js streaming or navigation.
 */
export function PageTransition({ children, className = "" }: PageTransitionProps) {
  return (
    <motion.div
      variants={fadeUp}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}

