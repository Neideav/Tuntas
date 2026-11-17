'use client';

import React from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { CharacterCommonProps } from './types';
import {
  kuroSpringConfig,
  introSpringConfig,
  celebrationSpring,
  smoothStateTransition,
} from './motion-presets';

export const KuroCharacter: React.FC<CharacterCommonProps> = ({
  state,
  lifecycle,
  pointer,
  shouldReduceMotion = false,
}) => {
  // Precision spring tuned to Kuro's agile peeking reflexes
  const springX = useSpring(pointer.x, kuroSpringConfig);
  const springY = useSpring(pointer.y, kuroSpringConfig);

  const isInteractive = lifecycle === 'interactive' && !shouldReduceMotion;

  // STRICT GROUND ANCHOR PRESERVATION:
  // Kuro's base rectangle sits 100% motionless and vertical at y=470!
  // Pointer tracking & peeking is performed by the upper eyes and pupils.
  // Eye group moves with Kuro's head sway at y=235 so the eyes stay aligned on the pillar
  const eyesPointerX = useTransform(springX, (val) =>
    isInteractive ? val * 15.0 : 0
  );
  const eyesPointerY = useTransform(springY, (val) =>
    isInteractive ? val * 3.5 : 0
  );
  const eyesPointerRotate = useTransform(springX, (val) =>
    isInteractive ? val * 1.5 : 0
  );

  // White eyeball (sclera) also actively tracks the cursor!
  const scleraPointerX = useTransform(springX, (val) =>
    isInteractive ? val * 3.2 : 0
  );
  const scleraPointerY = useTransform(springY, (val) =>
    isInteractive ? val * 2.2 : 0
  );

  // Black pupils track cursor further inside the white sclera
  const pupilPointerX = useTransform(springX, (val) =>
    isInteractive ? val * 5.2 : 0
  );
  const pupilPointerY = useTransform(springY, (val) =>
    isInteractive ? val * 3.8 : 0
  );

  // Deterministic WeStud-matched keyframes for all three lifecycle stages
  const bodyVariants = {
    // Stage 0: Pre-intro hidden state (0.0s - 1.8s)
    hidden: {
      x: 0,
      y: -380,
      rotate: 6,
      skewX: 0,
      scaleY: 1.0,
      scaleX: 0.95,
      opacity: 0,
    },
    // Stage 1: Intro sequence (0.0s - 4.4s)
    // 0s-1.8s: offscreen top, hidden
    // 2.5s: enters hanging from top edge, eyes peeking down
    // 3.2s: curves mid-air in flight
    // 3.8s: drops behind Yumi, aligns vertically
    // 4.4s: settled into canonical peeker stance on baseline y=470
    intro: {
      x: [0, 0, -10, -6, 0, 0],
      y: [-380, -380, -230, -30, 0, 0],
      rotate: [6, 6, 8, -8, 0, 0],
      skewX: [0, 0, 0, 0, 0, 0],
      scaleY: [1.0, 1.0, 1.02, 0.98, 1.0, 1.0],
      scaleX: [0.95, 0.95, 0.98, 1.02, 1.0, 1.0],
      opacity: [0, 0, 1, 1, 1, 1],
      transition: {
        type: 'tween' as const,
        duration: 4.4,
        times: [0, 0.41, 0.57, 0.73, 0.86, 1.0],
        ease: 'easeInOut' as const,
      },
    },
    // Stage 2: Settled (canonical proportional rest pose on baseline y=470)
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
      scaleY: 1,
      scaleX: 1,
      rotate: 0,
      x: 0,
      y: 0,
      skewX: 0,
      opacity: 1,
      transition: smoothStateTransition,
    },
    pointerTracking: {
      scaleY: 1,
      rotate: 0,
      x: 0,
      y: 0,
      skewX: 0,
      opacity: 1,
      transition: { duration: 0.2, ease: 'easeOut' as const },
    },
    emailFocus: {
      x: 0,
      y: 0,
      rotate: 0,
      skewX: 0,
      scaleY: 1,
      opacity: 1,
      transition: smoothStateTransition,
    },
    passwordFocus: {
      x: 0,
      y: 0,
      rotate: 0,
      skewX: 0,
      scaleY: 1,
      opacity: 1,
      transition: smoothStateTransition,
    },
    passwordVisible: {
      y: 0,
      x: 0,
      rotate: 0,
      skewX: 0,
      scaleY: 1,
      opacity: 1,
      transition: smoothStateTransition,
    },
    error: {
      x: 0,
      y: 0,
      scaleY: 1,
      rotate: 0,
      skewX: 0,
      opacity: 1,
      transition: { duration: 0.45, ease: 'easeOut' as const },
    },
    success: {
      scaleY: 1.05,
      y: -16,
      x: 0,
      rotate: 0,
      skewX: 0,
      opacity: 1,
      transition: celebrationSpring,
    },
  };

  const activeAnimation =
    lifecycle === 'intro'
      ? 'intro'
      : lifecycle === 'settled'
      ? 'settled'
      : state;

  const isPasswordFocus = lifecycle === 'interactive' && state === 'passwordFocus';
  const isError = lifecycle === 'interactive' && state === 'error';
  const isEmailFocus = lifecycle === 'interactive' && state === 'emailFocus';

  // Base from y=300 to y=470 is strictly L 355 470 L 260 470 L 260 300 in ALL states!
  // The bottom 170px NEVER moves, while the upper column leans and peeks out dynamically.
  const normalKuroPath =
    'M 260 195 C 291 195 323 195 355 195 C 355 240 355 270 355 300 L 355 470 L 260 470 L 260 300 C 260 270 260 240 260 195 Z';
  const emailKuroPath =
    'M 275 198 C 306 198 338 198 370 198 C 365 240 358 270 355 300 L 355 470 L 260 470 L 260 300 C 260 270 268 240 275 198 Z';
  const passwordKuroPath =
    'M 252 230 C 283 230 315 230 347 230 C 350 255 353 280 355 300 L 355 470 L 260 470 L 260 300 C 258 280 254 255 252 230 Z';

  const currentKuroPath =
    isEmailFocus
      ? emailKuroPath
      : isPasswordFocus
      ? passwordKuroPath
      : normalKuroPath;

  // Dynamic continuous bezier morphing for cursor tracking
  // Anchored strictly at the floor baseline (y=470), while the entire pillar flexes organically
  const dynamicKuroPath = useTransform(springX, (val) => {
    if (!isInteractive) return currentKuroPath;
    const sway = val * 18;
    if (isEmailFocus) {
      const topL = 275 + sway * 0.35;
      const topR = 370 + sway * 0.35;
      return `M ${topL} 198 C ${topL + 31} 198 ${topL + 63} 198 ${topR} 198 C ${370 + sway * 0.28} 250 ${362 + sway * 0.18} 330 ${357 + sway * 0.10} 390 C 355 425 355 450 355 470 L 260 470 C 260 450 260 425 ${262 + sway * 0.10} 390 C ${266 + sway * 0.18} 330 ${270 + sway * 0.28} 250 ${topL} 198 Z`;
    }
    if (isPasswordFocus) {
      const topL = 252 + sway * 0.35;
      const topR = 347 + sway * 0.35;
      return `M ${topL} 230 C ${topL + 31} 230 ${topL + 63} 230 ${topR} 230 C ${350 + sway * 0.25} 275 ${352 + sway * 0.15} 345 ${354 + sway * 0.08} 400 C 355 430 355 450 355 470 L 260 470 C 260 450 260 430 ${258 + sway * 0.08} 400 C ${256 + sway * 0.15} 345 ${254 + sway * 0.25} 275 ${topL} 230 Z`;
    }
    // Full body organic flex: pinned strictly at baseline y=470 with vertical tangents at y=440..470
    const topL = 260 + sway;
    const topR = 355 + sway;
    return `M ${topL} 195 C ${topL + 31} 195 ${topL + 63} 195 ${topR} 195 C ${topR} 240 ${355 + sway * 0.70} 290 ${355 + sway * 0.42} 345 C ${355 + sway * 0.18} 400 355 440 355 470 L 260 470 C 260 440 ${260 + sway * 0.18} 400 ${260 + sway * 0.42} 345 C ${260 + sway * 0.70} 290 ${topL} 240 ${topL} 195 Z`;
  });

  return (
    <motion.g
      variants={bodyVariants}
      initial={shouldReduceMotion ? 'settled' : 'hidden'}
      animate={activeAnimation}
      style={{
        transformOrigin: '307px 470px',
      }}
    >
      {/* Main Black Rectangular Body (Morphing upper pillar, baseline flat on y=470 strictly motionless) */}
      <motion.path
        d={dynamicKuroPath}
        fill="#19191D"
        className="transition-colors duration-300"
      />

      {/* ================= UPPER EYES GROUP ================= */}
      {/* Moves and tilts smoothly with cursor parallax, leaving the base completely motionless */}
      <motion.g
        style={{
          x: eyesPointerX,
          y: eyesPointerY,
          rotate: eyesPointerRotate,
          transformOrigin: '332px 235px',
        }}
        animate={
          isEmailFocus
            ? { x: 15, y: 3, rotate: 3 }
            : isPasswordFocus
            ? { x: -8, y: 35, rotate: -3 }
            : isError
            ? { x: -3, y: 3, rotate: -3 }
            : { x: 0, y: 0, rotate: 0 }
        }
        transition={smoothStateTransition}
      >
          {/* Left Eye */}
          <g>
            {isPasswordFocus ? (
              <line
                x1="315"
                y1="235"
                x2="325"
                y2="235"
                stroke="#FFFFFF"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            ) : (
              <motion.circle
                cx="320"
                cy="235"
                r="7"
                fill="#FFFFFF"
                style={
                  lifecycle === 'intro' || isError || isEmailFocus || !isInteractive
                    ? undefined
                    : {
                        x: scleraPointerX,
                        y: scleraPointerY,
                      }
                }
                animate={
                  isError
                    ? { x: -1.5, y: -1.5 }
                    : isEmailFocus
                    ? { x: 2.2, y: 0.2 }
                    : { x: 0, y: 0 }
                }
                transition={{ duration: 0.25 }}
              />
            )}

            {!isPasswordFocus && (
              <motion.circle
                cx="320"
                cy="235"
                r="3.5"
                fill="#19191D"
                style={
                  lifecycle === 'intro' || isError || isEmailFocus || !isInteractive
                    ? undefined
                    : {
                        x: pupilPointerX,
                        y: pupilPointerY,
                      }
                }
                animate={
                  lifecycle === 'intro'
                    ? { x: [0, 0, 0, -1, 0, 0], y: [0, 0, 3, 1.5, 0, 0] }
                    : isError
                    ? { x: -2.5, y: -2.5 }
                    : isEmailFocus
                    ? { x: 3.2, y: 0.2 }
                    : { x: 0, y: 0 }
                }
                transition={
                  lifecycle === 'intro'
                    ? { type: 'tween' as const, duration: 4.4, times: [0, 0.41, 0.57, 0.73, 0.86, 1.0], ease: 'easeInOut' as const }
                    : { duration: 0.25 }
                }
              />
            )}
          </g>

          {/* Right Eye */}
          <g>
            {isPasswordFocus ? (
              <line
                x1="339"
                y1="235"
                x2="349"
                y2="235"
                stroke="#FFFFFF"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            ) : (
              <motion.circle
                cx="344"
                cy="235"
                r="7"
                fill="#FFFFFF"
                style={
                  lifecycle === 'intro' || isError || isEmailFocus || !isInteractive
                    ? undefined
                    : {
                        x: scleraPointerX,
                        y: scleraPointerY,
                      }
                }
                animate={
                  isError
                    ? { x: -1.5, y: -1.5 }
                    : isEmailFocus
                    ? { x: 2.2, y: 0.2 }
                    : { x: 0, y: 0 }
                }
                transition={{ duration: 0.25 }}
              />
            )}

            {!isPasswordFocus && (
              <motion.circle
                cx="344"
                cy="235"
                r="3.5"
                fill="#19191D"
                style={
                  lifecycle === 'intro' || isError || isEmailFocus || !isInteractive
                    ? undefined
                    : {
                        x: pupilPointerX,
                        y: pupilPointerY,
                      }
                }
                animate={
                  lifecycle === 'intro'
                    ? { x: [0, 0, 0, -1, 0, 0], y: [0, 0, 3, 1.5, 0, 0] }
                    : isError
                    ? { x: -2.5, y: -2.5 }
                    : isEmailFocus
                    ? { x: 3.2, y: 0.2 }
                    : { x: 0, y: 0 }
                }
                transition={
                  lifecycle === 'intro'
                    ? { type: 'tween' as const, duration: 4.4, times: [0, 0.41, 0.57, 0.73, 0.86, 1.0], ease: 'easeInOut' as const }
                    : { duration: 0.25 }
                }
              />
            )}
          </g>
        </motion.g>
    </motion.g>
  );
};

export default KuroCharacter;
