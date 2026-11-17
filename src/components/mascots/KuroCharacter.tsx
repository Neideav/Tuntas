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
  const eyesPointerX = useTransform(springX, (val) =>
    isInteractive ? val * 6.5 : 0
  );
  const eyesPointerY = useTransform(springY, (val) =>
    isInteractive ? val * 4.0 : 0
  );
  const eyesPointerRotate = useTransform(springX, (val) =>
    isInteractive ? val * 1.5 : 0
  );

  // Pupils strictly bounded within sclera
  const pupilPointerX = useTransform(springX, (val) => (isInteractive ? val * 3.2 : 0));
  const pupilPointerY = useTransform(springY, (val) => (isInteractive ? val * 2.8 : 0));

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
        d={currentKuroPath}
        animate={{ d: currentKuroPath }}
        transition={smoothStateTransition}
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
              <circle cx="320" cy="235" r="7" fill="#FFFFFF" />
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
              <circle cx="344" cy="235" r="7" fill="#FFFFFF" />
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
