import { MotionValue } from 'motion/react';

export type MascotState =
  | 'intro'
  | 'idle'
  | 'pointerTracking'
  | 'emailFocus'
  | 'passwordFocus'
  | 'passwordVisible'
  | 'error'
  | 'success';

export interface NormalizedPointer {
  x: MotionValue<number>;
  y: MotionValue<number>;
  distanceToForm: MotionValue<number>;
  isNearForm: MotionValue<number>;
}

export interface CharacterCommonProps {
  state: MascotState;
  pointer: NormalizedPointer;
  isIntroComplete?: boolean;
  shouldReduceMotion?: boolean;
  className?: string;
}
