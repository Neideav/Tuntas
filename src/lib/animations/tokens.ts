/**
 * Centralized Animation Design Tokens for Tuntas
 * Follows professional SaaS animation standards with natural spring physics
 * and strict duration bounds (no excessive delays).
 */

export const ANIMATION_DURATIONS = {
  button: 0.15,        // 150ms: snappy press and release
  hover: 0.15,         // 150ms: micro-emphasis
  tooltip: 0.12,       // 120ms: instant readability
  dropdown: 0.18,      // 180ms: menus and selects
  modal: 0.24,         // 240ms: overlays and dialogs
  drawer: 0.28,        // 280ms: slide-out panels
  page: 0.2,           // 200ms: seamless navigation
  staggerDelay: 0.04,  // 40ms per item: non-blocking sequence
  layout: 0.22,        // 220ms: list reordering / filtering
} as const;

export const ANIMATION_EASINGS = {
  // Standard CSS cubic-bezier for natural, subtle acceleration & deceleration
  standard: [0.2, 0.0, 0, 1.0] as const,
  decelerate: [0.0, 0.0, 0.2, 1] as const,
  accelerate: [0.4, 0.0, 1, 1] as const,
};

export const SPRING_TRANSITIONS = {
  // Tight spring for buttons, tabs, toggles
  tight: {
    type: "spring" as const,
    stiffness: 450,
    damping: 30,
    mass: 0.8,
  },
  // Snappy spring for cards, lists, layout shifts
  snappy: {
    type: "spring" as const,
    stiffness: 380,
    damping: 26,
  },
  // Gentle spring for modals, banners, larger surfaces
  gentle: {
    type: "spring" as const,
    stiffness: 260,
    damping: 22,
  },
} as const;

