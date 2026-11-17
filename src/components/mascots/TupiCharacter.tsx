'use client';

import React from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { CharacterCommonProps } from './types';
import {
  tupiSpringConfig,
  introSpringConfig,
  celebrationSpring,
  smoothStateTransition,
} from './motion-presets';

export const TupiCharacter: React.FC<CharacterCommonProps> = ({
  state,
  lifecycle,
  pointer,
  shouldReduceMotion = false,
}) => {
  // Precision spring tuned to Tupi's elastic block mass
  const springX = useSpring(pointer.x, tupiSpringConfig);
  const springY = useSpring(pointer.y, tupiSpringConfig);

  // Pointer tracking is enabled ONLY in interactive lifecycle stage
  const isInteractive = lifecycle === 'interactive' && !shouldReduceMotion;

  // STRICT GROUND ANCHOR PRESERVATION:
  // The bottom part of Tupi (y = 280 to y = 470) NEVER moves, tilts, or skews!
  // All body deformation (like bending in emailFocus from frame_009) is achieved
  // via continuous bezier path morphing above y = 280, keeping the bottom 190px 100% static!
  // Facial group follows Tupi's head sway at y=118 so features stay naturally aligned on the tower
  const headPointerX = useTransform(springX, (val) =>
    isInteractive ? val * 19.5 : 0
  );
  const headPointerY = useTransform(springY, (val) =>
    isInteractive ? val * 3.5 : 0
  );
  const headPointerRotate = useTransform(springX, (val) =>
    isInteractive ? val * 1.5 : 0
  );

  // White eyeball (sclera) also actively tracks the cursor!
  const scleraPointerX = useTransform(springX, (val) =>
    isInteractive ? val * 2.2 : 0
  );
  const scleraPointerY = useTransform(springY, (val) =>
    isInteractive ? val * 1.8 : 0
  );

  // Black pupils track cursor further inside the white sclera
  const pupilPointerX = useTransform(springX, (val) =>
    isInteractive ? val * 3.8 : 0
  );
  const pupilPointerY = useTransform(springY, (val) =>
    isInteractive ? val * 2.8 : 0
  );

  // Deterministic WeStud-matched keyframes for all three lifecycle stages
  const bodyVariants = {
    // Stage 0: Pre-intro hidden state (0.0s - 1.8s)
    hidden: {
      x: -180,
      y: 35,
      rotate: 18,
      skewX: 0,
      scaleY: 0.60,
      scaleX: 1.02,
      opacity: 0,
    },
    // Stage 1: Intro sequence (0.0s - 4.4s)
    // 0s-1.8s: offscreen lower-left, tilted, hidden
    // 2.5s: enters at lower-left, squat tilted block
    // 3.5s: upright, stretching up to full height
    // 4.4s: settled into canonical guardian position
    intro: {
      x: [-180, -180, -55, 0, 0],
      y: [35, 35, 25, 0, 0],
      rotate: [18, 18, 14, 0, 0],
      skewX: [0, 0, 0, 0, 0],
      scaleY: [0.60, 0.60, 0.68, 0.98, 1.0],
      scaleX: [1.02, 1.02, 1.04, 1.0, 1.0],
      opacity: [0, 0, 1, 1, 1],
      transition: {
        type: 'tween' as const,
        duration: 4.4,
        times: [0, 0.41, 0.57, 0.82, 1.0],
        ease: 'easeInOut' as const,
      },
    },
    // Stage 2: Settled (authoritative canonical rest pose on baseline y=470)
    settled: {
      y: 0,
      scaleY: 1,
      scaleX: 1,
      rotate: 0,
      skewX: 0,
      x: 0,
      opacity: 1,
      transition: { duration: 0.2, ease: 'easeOut' as const },
    },
    // Stage 3: Interactive states - BASE REMAINS 100% FIXED ON GROUND (y=470)
    idle: {
      y: 0,
      scaleY: 1,
      scaleX: 1,
      rotate: 0,
      skewX: 0,
      x: 0,
      opacity: 1,
      transition: smoothStateTransition,
    },
    pointerTracking: {
      y: 0,
      scaleY: 1,
      scaleX: 1,
      rotate: 0,
      x: 0,
      opacity: 1,
      transition: { duration: 0.2, ease: 'easeOut' as const },
    },
    emailFocus: {
      x: 0,
      y: 0,
      skewX: 0,
      scaleY: 1,
      scaleX: 1,
      rotate: 0,
      opacity: 1,
      transition: smoothStateTransition,
    },
    passwordFocus: {
      x: 0,
      y: 0,
      skewX: 0,
      scaleY: 1,
      scaleX: 1,
      rotate: 0,
      opacity: 1,
      transition: smoothStateTransition,
    },
    passwordVisible: {
      y: 0,
      x: 0,
      skewX: 0,
      scaleY: 1,
      scaleX: 1,
      rotate: 0,
      opacity: 1,
      transition: smoothStateTransition,
    },
    error: {
      x: 0,
      y: 0,
      skewX: 0,
      scaleY: 1,
      scaleX: 1,
      rotate: 0,
      opacity: 1,
      transition: { duration: 0.45, ease: 'easeOut' as const },
    },
    success: {
      y: -16,
      scaleY: 1.05,
      scaleX: 0.97,
      x: 0,
      rotate: 0,
      skewX: 0,
      opacity: 1,
      transition: celebrationSpring,
    },
  };

  // Determine active animation target based on lifecycle stage
  const activeAnimation =
    lifecycle === 'intro'
      ? 'intro'
      : lifecycle === 'settled'
      ? 'settled'
      : state;

  const isPasswordVisible = lifecycle === 'interactive' && state === 'passwordVisible';
  const isError = lifecycle === 'interactive' && state === 'error';
  const isPasswordFocus = lifecycle === 'interactive' && state === 'passwordFocus';
  const isEmailFocus = lifecycle === 'interactive' && state === 'emailFocus';
  const isSuccess = lifecycle === 'interactive' && state === 'success';

  // Base from y=280 to y=470 is strictly L 305 470 L 160 470 L 160 280 in ALL states!
  // This guarantees the bottom 190px is 100% motionless, vertical, and horizontal!
  const normalBodyPath =
    'M 160 80 C 208 80 256 80 305 80 C 305 146 305 213 305 280 L 305 470 L 160 470 L 160 280 C 160 213 160 146 160 80 Z';
  const emailBodyPath =
    'M 205 95 C 248 106 292 118 335 130 C 322 180 310 230 305 280 L 305 470 L 160 470 L 160 280 C 162 230 178 160 205 95 Z';
  const passwordBodyPath =
    'M 140 85 C 185 80 230 80 275 85 C 280 150 290 215 305 280 L 305 470 L 160 470 L 160 280 C 152 215 144 150 140 85 Z';
  const errorBodyPath =
    'M 175 105 C 220 115 265 125 310 135 C 310 185 308 235 305 280 L 305 470 L 160 470 L 160 280 C 160 235 168 185 175 105 Z';

  const currentBodyPath =
    isEmailFocus
      ? emailBodyPath
      : isPasswordFocus
      ? passwordBodyPath
      : isError
      ? errorBodyPath
      : normalBodyPath;

  // Dynamic continuous bezier morphing for cursor tracking
  // Anchored strictly at the floor baseline (y=470), while the entire torso & head flexes organically
  const dynamicTupiPath = useTransform(springX, (val) => {
    if (!isInteractive) return currentBodyPath;
    const sway = val * 22;
    if (isEmailFocus) {
      const topL = 205 + sway * 0.35;
      const topR = 335 + sway * 0.35;
      return `M ${topL} 95 C ${topL + 43} 106 ${topL + 87} 118 ${topR} 130 C ${335 + sway * 0.28} 190 ${320 + sway * 0.20} 290 ${310 + sway * 0.10} 370 C 307 420 305 450 305 470 L 160 470 C 160 450 162 420 ${165 + sway * 0.10} 370 C ${172 + sway * 0.20} 290 ${185 + sway * 0.28} 190 ${topL} 95 Z`;
    }
    if (isPasswordFocus) {
      const topL = 140 + sway * 0.35;
      const topR = 275 + sway * 0.35;
      return `M ${topL} 85 C ${topL + 45} 80 ${topL + 90} 80 ${topR} 85 C ${275 + sway * 0.25} 170 ${285 + sway * 0.18} 270 ${295 + sway * 0.10} 370 C 302 420 305 450 305 470 L 160 470 C 160 450 158 420 ${155 + sway * 0.10} 370 C ${150 + sway * 0.18} 270 ${145 + sway * 0.25} 170 ${topL} 85 Z`;
    }
    if (isError) {
      const topL = 175 + sway * 0.35;
      const topR = 310 + sway * 0.35;
      return `M ${topL} 105 C ${topL + 45} 115 ${topL + 90} 125 ${topR} 135 C ${310 + sway * 0.25} 185 ${308 + sway * 0.18} 275 ${306 + sway * 0.10} 370 C 305 420 305 450 305 470 L 160 470 C 160 450 160 420 ${162 + sway * 0.10} 370 C ${165 + sway * 0.18} 275 ${168 + sway * 0.25} 185 ${topL} 105 Z`;
    }
    // Full body organic flex: pinned strictly at baseline y=470 with vertical tangents at y=440..470
    const topL = 160 + sway;
    const topR = 305 + sway;
    return `M ${topL} 80 C ${topL + 48} 80 ${topL + 96} 80 ${topR} 80 C ${topR} 150 ${305 + sway * 0.70} 220 ${305 + sway * 0.42} 290 C ${305 + sway * 0.16} 365 305 435 305 470 L 160 470 C 160 435 ${160 + sway * 0.16} 365 ${160 + sway * 0.42} 290 C ${160 + sway * 0.70} 220 ${topL} 150 ${topL} 80 Z`;
  });

  return (
    <motion.g
      variants={bodyVariants}
      initial={shouldReduceMotion ? 'settled' : 'hidden'}
      animate={activeAnimation}
      style={{
        transformOrigin: '232px 470px',
      }}
    >
      {/* Main Purple Body (Morphing upper arch, bottom 190px is 100% static & vertical) */}
      <motion.path
        d={dynamicTupiPath}
        fill="#6528F5"
      />

      {/* ================= UPPER HEAD & FACIAL GROUP ================= */}
      {/* Moves and tilts smoothly with body bend and cursor without touching the base */}
      <motion.g
        style={{
          x: headPointerX,
          y: headPointerY,
          rotate: headPointerRotate,
          transformOrigin: '232px 130px',
        }}
        animate={
          isError
            ? { x: 15, y: 24, rotate: 8 }
            : isPasswordFocus
            ? { x: -25, y: 5, rotate: -6 }
            : isEmailFocus
            ? { x: 38, y: 18, rotate: 14 }
            : { x: 0, y: 0, rotate: 0 }
        }
        transition={smoothStateTransition}
      >
            {/* Eyebrows */}
            <motion.line
              x1="220"
              y1="109"
              x2="228"
              y2="109"
              stroke="#19191D"
              strokeWidth="2"
              strokeLinecap="round"
              animate={
                isError
                  ? { y1: 111, y2: 107, rotate: 12 }
                  : isPasswordVisible
                  ? { y1: 108, y2: 110, rotate: -8 }
                  : isPasswordFocus
                  ? { y1: 107, y2: 110, rotate: -6 }
                  : isSuccess
                  ? { y1: 106, y2: 106 }
                  : { y1: 109, y2: 109, rotate: 0 }
              }
              transition={{ duration: 0.3 }}
            />
            <motion.line
              x1="260"
              y1="109"
              x2="268"
              y2="109"
              stroke="#19191D"
              strokeWidth="2"
              strokeLinecap="round"
              animate={
                isError
                  ? { y1: 107, y2: 111, rotate: -12 }
                  : isPasswordVisible
                  ? { y1: 110, y2: 108, rotate: 8 }
                  : isPasswordFocus
                  ? { y1: 110, y2: 107, rotate: 6 }
                  : isSuccess
                  ? { y1: 106, y2: 106 }
                  : { y1: 109, y2: 109, rotate: 0 }
              }
              transition={{ duration: 0.3 }}
            />

            {/* Left Eye */}
            <g>
              {isPasswordVisible ? (
                <line
                  x1="220"
                  y1="118"
                  x2="228"
                  y2="118"
                  stroke="#FFFFFF"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              ) : (
                <motion.circle
                  cx="224"
                  cy="118"
                  r="4.5"
                  fill="#FFFFFF"
                  style={
                    isPasswordFocus || isEmailFocus || isError || !isInteractive
                      ? undefined
                      : {
                          x: scleraPointerX,
                          y: scleraPointerY,
                        }
                  }
                  animate={
                    isError
                      ? { x: -0.8, y: 1.0 }
                      : isPasswordFocus
                      ? { x: -1.2, y: -1.2 }
                      : isEmailFocus
                      ? { x: 1.5, y: 0.3 }
                      : { x: 0, y: 0 }
                  }
                  transition={{ duration: 0.25 }}
                />
              )}

              {!isPasswordVisible && (
                <motion.circle
                  cx="224"
                  cy="118"
                  r="2.5"
                  fill="#19191D"
                  style={
                    isPasswordFocus || isEmailFocus || isError || !isInteractive
                      ? undefined
                      : {
                          x: pupilPointerX,
                          y: pupilPointerY,
                        }
                  }
                  animate={
                    isError
                      ? { x: -1.2, y: 1.5 }
                      : isPasswordFocus
                      ? { x: -1.8, y: -1.8 }
                      : isEmailFocus
                      ? { x: 2.2, y: 0.4 }
                      : { x: 0, y: 0 }
                  }
                  transition={{ duration: 0.25 }}
                />
              )}
            </g>

            {/* Right Eye */}
            <g>
              {isPasswordVisible ? (
                <line
                  x1="260"
                  y1="118"
                  x2="268"
                  y2="118"
                  stroke="#FFFFFF"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              ) : (
                <motion.circle
                  cx="264"
                  cy="118"
                  r="4.5"
                  fill="#FFFFFF"
                  style={
                    isPasswordFocus || isEmailFocus || isError || !isInteractive
                      ? undefined
                      : {
                          x: scleraPointerX,
                          y: scleraPointerY,
                        }
                  }
                  animate={
                    isError
                      ? { x: -0.8, y: 1.0 }
                      : isPasswordFocus
                      ? { x: -1.2, y: -1.2 }
                      : isEmailFocus
                      ? { x: 1.5, y: 0.3 }
                      : { x: 0, y: 0 }
                  }
                  transition={{ duration: 0.25 }}
                />
              )}

              {!isPasswordVisible && (
                <motion.circle
                  cx="264"
                  cy="118"
                  r="2.5"
                  fill="#19191D"
                  style={
                    isPasswordFocus || isEmailFocus || isError || !isInteractive
                      ? undefined
                      : {
                          x: pupilPointerX,
                          y: pupilPointerY,
                        }
                  }
                  animate={
                    isError
                      ? { x: -1.2, y: 1.5 }
                      : isPasswordFocus
                      ? { x: -1.8, y: -1.8 }
                      : isEmailFocus
                      ? { x: 2.2, y: 0.4 }
                      : { x: 0, y: 0 }
                  }
                  transition={{ duration: 0.25 }}
                />
              )}
            </g>

            {/* Vertical Stoic Nose */}
            <rect x="241" y="110" width="6.5" height="34" rx="3.25" fill="#19191D" />

            {/* Mouth Expressions */}
            {isError && (
              <motion.path
                d="M 239 154 Q 244 148 249 154"
                stroke="#19191D"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              />
            )}
            {isPasswordVisible && (
              <motion.path
                d="M 240 153 Q 244 149 248 153"
                stroke="#19191D"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              />
            )}
            {isSuccess && (
              <motion.path
                d="M 239 152 Q 244 157 249 152"
                stroke="#19191D"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              />
            )}
        </motion.g>
    </motion.g>
  );
};

export default TupiCharacter;
