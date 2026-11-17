import { MotionValue } from 'motion/react';

export type LifecycleStage = 'intro' | 'settled' | 'interactive';

export type MascotState =
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
  lifecycle: LifecycleStage;
  pointer: NormalizedPointer;
  shouldReduceMotion?: boolean;
  className?: string;
}
