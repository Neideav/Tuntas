"use client";

import React from "react";
import { AnimatePresence, motion, type HTMLMotionProps } from "motion/react";
import { listItemVariants } from "@/lib/animations";

interface AnimatedListProps {
  children: React.ReactNode;
  className?: string;
  mode?: "sync" | "popLayout" | "wait";
}

export function AnimatedList({
  children,
  className = "",
  mode = "popLayout",
}: AnimatedListProps) {
  return (
    <div className={className}>
      <AnimatePresence mode={mode}>{children}</AnimatePresence>
    </div>
  );
}

interface AnimatedItemProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  layoutId?: string;
}

export function AnimatedItem({
  children,
  className = "",
  layoutId,
  ...props
}: AnimatedItemProps) {
  return (
    <motion.div
      layout
      layoutId={layoutId}
      variants={listItemVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

