"use client";

import React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { fadeIn, fadeUp, fadeDown, slideInRight } from "@/lib/animations";

interface FadeInProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  direction?: "up" | "down" | "right" | "none";
  delay?: number;
  className?: string;
}

export function FadeIn({
  children,
  direction = "up",
  delay = 0,
  className = "",
  ...props
}: FadeInProps) {
  const variantMap = {
    up: fadeUp,
    down: fadeDown,
    right: slideInRight,
    none: fadeIn,
  };

  const selectedVariant = variantMap[direction];

  return (
    <motion.div
      variants={selectedVariant}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

