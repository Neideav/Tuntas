"use client";

import React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/animations";

interface StaggerContainerProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  staggerDelay?: number;
  delayChildren?: number;
  className?: string;
}

export function StaggerContainer({
  children,
  staggerDelay = 0.04,
  delayChildren = 0,
  className = "",
  ...props
}: StaggerContainerProps) {
  return (
    <motion.div
      variants={staggerContainer(staggerDelay, delayChildren)}
      initial="initial"
      animate="animate"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
}

export function StaggerItem({ children, className = "", ...props }: StaggerItemProps) {
  return (
    <motion.div variants={staggerItem} className={className} {...props}>
      {children}
    </motion.div>
  );
}

