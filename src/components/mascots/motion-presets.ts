// Precision spring physics parameters tuned specifically for WeStud-inspired elastic body deformation

// TUPI (Purple Character): Elastic rectangular body, leaning skew & squash
export const tupiSpringConfig = {
  stiffness: 220,
  damping: 24,
  mass: 0.85,
};

// KURO (Black Character): Peeking drop-in and agile peeking lag
export const kuroSpringConfig = {
  stiffness: 300,
  damping: 24,
  mass: 0.5,
};

// YUMI (Yellow Character): Soft arch curve and nervous wavy arm
export const yumiSpringConfig = {
  stiffness: 260,
  damping: 22,
  mass: 0.65,
};

// ORU (Orange Character): Bouncy squishy dome, elastic squash-and-stretch
export const oruSpringConfig = {
  stiffness: 230,
  damping: 18,
  mass: 0.6,
};

// Deterministic intro entrance spring: smooth, damped, never overshoots wildly
export const introSpringConfig = {
  type: 'spring' as const,
  stiffness: 200,
  damping: 22,
  mass: 0.8,
};

// Clean celebration spring
export const celebrationSpring = {
  type: 'spring' as const,
  stiffness: 360,
  damping: 18,
};

export const snappySpring = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 24,
};

export const smoothStateTransition = {
  duration: 0.35,
  ease: [0.22, 1, 0.36, 1] as const,
};
