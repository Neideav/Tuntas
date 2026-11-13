import { SPRING_TRANSITIONS } from "./tokens";

export const microInteractions = {
  // Button tap & hover physics
  buttonPress: {
    whileHover: { scale: 1.015 },
    whileTap: { scale: 0.97 },
    transition: SPRING_TRANSITIONS.tight,
  },
  // Subdued press for secondary or ghost buttons
  subtlePress: {
    whileHover: { scale: 1.01 },
    whileTap: { scale: 0.98 },
    transition: SPRING_TRANSITIONS.tight,
  },
  // Icon action buttons
  iconButtonPress: {
    whileHover: { scale: 1.08 },
    whileTap: { scale: 0.92 },
    transition: SPRING_TRANSITIONS.tight,
  },
  // Card hover lift
  cardLift: {
    whileHover: { y: -2, transition: SPRING_TRANSITIONS.tight },
  },
  // Checkbox completion pop
  checkPop: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: SPRING_TRANSITIONS.tight,
  },
} as const;

