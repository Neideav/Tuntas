import type { Variants } from "motion/react";
import { ANIMATION_DURATIONS, ANIMATION_EASINGS, SPRING_TRANSITIONS } from "./tokens";

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      duration: ANIMATION_DURATIONS.page,
      ease: ANIMATION_EASINGS.decelerate,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: ANIMATION_DURATIONS.button,
      ease: ANIMATION_EASINGS.accelerate,
    },
  },
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: ANIMATION_DURATIONS.page,
      ease: ANIMATION_EASINGS.decelerate,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: ANIMATION_DURATIONS.button,
      ease: ANIMATION_EASINGS.accelerate,
    },
  },
};

export const fadeDown: Variants = {
  initial: { opacity: 0, y: -12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: ANIMATION_DURATIONS.page,
      ease: ANIMATION_EASINGS.decelerate,
    },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: {
      duration: ANIMATION_DURATIONS.button,
      ease: ANIMATION_EASINGS.accelerate,
    },
  },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: SPRING_TRANSITIONS.tight,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: ANIMATION_DURATIONS.button,
      ease: ANIMATION_EASINGS.accelerate,
    },
  },
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: SPRING_TRANSITIONS.snappy,
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: ANIMATION_DURATIONS.button },
  },
};

export const staggerContainer = (
  staggerChildren: number = ANIMATION_DURATIONS.staggerDelay,
  delayChildren: number = 0
): Variants => ({
  initial: {},
  animate: {
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: SPRING_TRANSITIONS.tight,
  },
};

export const modalBackdrop: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: ANIMATION_DURATIONS.modal, ease: ANIMATION_EASINGS.decelerate },
  },
  exit: {
    opacity: 0,
    transition: { duration: ANIMATION_DURATIONS.button, ease: ANIMATION_EASINGS.accelerate },
  },
};

export const modalDialog: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: SPRING_TRANSITIONS.snappy,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 6,
    transition: { duration: ANIMATION_DURATIONS.button, ease: ANIMATION_EASINGS.accelerate },
  },
};

export const listItemVariants: Variants = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: SPRING_TRANSITIONS.tight,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15, ease: "easeOut" },
  },
};
