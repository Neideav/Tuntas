'use client';

import React from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { CharacterCommonProps } from './types';
import {
  yumiSpringConfig,
  introSpringConfig,
  celebrationSpring,
  smoothStateTransition,
} from './motion-presets';

export const YumiCharacter: React.FC<CharacterCommonProps> = ({
  state,
  lifecycle,
  pointer,
  shouldReduceMotion = false,
}) => {
  // Precision spring tuned to Yumi's curved pill shape
  const springX = useSpring(pointer.x, yumiSpringConfig);
  const springY = useSpring(pointer.y, yumiSpringConfig);

  const isInteractive = lifecycle === 'interactive' && !shouldReduceMotion;

  // STRICT GROUND ANCHOR PRESERVATION:
  // The bottom edge of Yumi (L 440 470 L 330 470) strictly sits motionless and vertical at y=470!
  // All cursor tracking is performed by the upper head, eye, and arm.
  const headPointerX = useTransform(springX, (val) =>
    isInteractive ? val * 5.0 : 0
  );
  const headPointerY = useTransform(springY, (val) =>
    isInteractive ? val * 3.5 : 0
  );
  const headPointerRotate = useTransform(springX, (val) =>
    isInteractive ? val * 1.8 : 0
  );
  const armPointerRotate = useTransform(springY, (val) =>
    isInteractive ? val * 6.0 : 0
  );

  // Eye movement bounded inside face
  const eyePointerX = useTransform(springX, (val) => (isInteractive ? val * 3.2 : 0));
  const eyePointerY = useTransform(springY, (val) => (isInteractive ? val * 2.5 : 0));

  // Deterministic WeStud-matched keyframes for all three lifecycle stages
  const bodyVariants = {
    // Stage 0: Pre-intro hidden state (0.0s - 1.8s)
    hidden: {
      x: 0,
      y: 0,
      rotate: 0,
      skewX: 0,
      scaleY: 0.35,
      scaleX: 1.05,
      opacity: 0,
    },
    // Stage 1: Intro sequence (0.0s - 4.4s)
    // 0s-1.8s: resting flat on baseline, hidden
    // 2.5s: compact semicircle arch on baseline
    // 3.5s: extruding upward into full arch
    // 4.4s: settled into canonical stance on baseline y=470
    intro: {
      x: [0, 0, 0, 0, 0],
      y: [0, 0, 0, 0, 0],
      rotate: [0, 0, 0, 0, 0],
      skewX: [0, 0, 0, 0, 0],
      scaleY: [0.35, 0.35, 0.45, 0.96, 1.0],
      scaleX: [1.05, 1.05, 1.05, 1.0, 1.0],
      opacity: [0, 0, 1, 1, 1],
      transition: {
        type: 'tween' as const,
        duration: 4.4,
        times: [0, 0.41, 0.57, 0.82, 1.0],
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
      rotate: 0,
      skewX: 0,
      x: 0,
      y: 0,
      opacity: 1,
      transition: smoothStateTransition,
    },
    pointerTracking: {
      scaleY: 1,
      rotate: 0,
      x: 0,
      y: 0,
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
      y: -16,
      x: 0,
      rotate: 0,
      skewX: 0,
      scaleY: 1.04,
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
  const isPasswordVisible = lifecycle === 'interactive' && state === 'passwordVisible';
  const isError = lifecycle === 'interactive' && state === 'error';
  const isSuccess = lifecycle === 'interactive' && state === 'success';
  const isEmailFocus = lifecycle === 'interactive' && state === 'emailFocus';

  // Base from y=360 to y=470 is strictly L 440 470 L 330 470 L 330 360 in ALL states!
  // The bottom 110px NEVER moves, while the upper arch leans forward towards the form.
  const normalYumiPath =
    'M 330 360 C 330 310 355 270 385 270 C 415 270 440 310 440 360 L 440 470 L 330 470 L 330 360 Z';
  const emailYumiPath =
    'M 330 360 C 334 310 368 272 398 272 C 428 272 448 315 440 360 L 440 470 L 330 470 L 330 360 Z';
  const passwordYumiPath =
    'M 330 360 C 328 310 348 270 376 270 C 404 270 435 310 440 360 L 440 470 L 330 470 L 330 360 Z';

  const currentYumiPath =
    isEmailFocus
      ? emailYumiPath
      : isPasswordFocus
      ? passwordYumiPath
      : normalYumiPath;

  return (
    <motion.g
      variants={bodyVariants}
      initial={shouldReduceMotion ? 'settled' : 'hidden'}
      animate={activeAnimation}
      style={{
        transformOrigin: '385px 470px',
      }}
    >
      {/* Main Arch / Pill Body (Morphing upper head, baseline L 440 470 L 330 470 Z strictly motionless on y=470) */}
      <motion.path
        d={currentYumiPath}
        animate={{ d: currentYumiPath }}
        transition={smoothStateTransition}
        fill="#F1D20A"
        className="transition-colors duration-300"
      />

      {/* ================= UPPER HEAD & EYE GROUP ================= */}
      {/* Tilts and moves smoothly with cursor parallax without moving the base */}
      <motion.g
        style={{
          x: headPointerX,
          y: headPointerY,
          rotate: headPointerRotate,
          transformOrigin: '385px 330px',
        }}
        animate={
          isEmailFocus
            ? { x: 13, y: 2, rotate: 3 }
            : isPasswordFocus
            ? { x: -9, y: 0, rotate: -3 }
            : isError
            ? { x: -3, y: 2, rotate: -3 }
            : isSuccess
            ? { y: -5 }
            : { x: 0, y: 0, rotate: 0 }
        }
        transition={smoothStateTransition}
      >
          {/* Eye */}
          {isPasswordFocus ? (
            <path
              d="M 366 318 Q 372 314 378 318"
              stroke="#19191D"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          ) : isSuccess ? (
            <path
              d="M 366 319 Q 372 312 378 319"
              stroke="#19191D"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          ) : isError ? (
            <circle cx="372" cy="318" r="3.5" fill="#19191D" />
          ) : (
            <motion.circle
              cx="372"
              cy="318"
              r={isPasswordVisible ? 5.5 : 4.5}
              fill="#19191D"
              style={
                isEmailFocus || !isInteractive
                  ? undefined
                  : {
                      x: eyePointerX,
                      y: eyePointerY,
                    }
              }
              animate={
                isEmailFocus
                  ? { x: 3.0, y: 0.2 }
                  : { x: 0, y: 0 }
              }
              transition={{ duration: 0.25 }}
            />
          )}
        </motion.g>

        {/* ================= ARM & MOUTH POSE ================= */}
        {isError ? (
          // Nervous wavy squiggly line from frame_013!
          <motion.path
            d="M 385 345 Q 398 338 412 346 Q 426 354 440 344 Q 450 338 458 345"
            stroke="#19191D"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3 }}
          />
        ) : (
          <motion.g
            style={{
              transformOrigin: '385px 345px',
            }}
            animate={
              isPasswordFocus
                ? { rotate: -124, transition: { type: 'spring', stiffness: 320, damping: 22 } }
                : isPasswordVisible
                ? { rotate: -92, transition: { type: 'spring', stiffness: 280, damping: 20 } }
                : isSuccess
                ? { rotate: -38, transition: celebrationSpring }
                : { rotate: 0 }
            }
          >
            <motion.g
              style={
                !isPasswordFocus && !isPasswordVisible && !isSuccess
                  ? { rotate: armPointerRotate, transformOrigin: '385px 345px' }
                  : undefined
              }
            >
              {/* Stick Arm Bar */}
              <line
                x1="385"
                y1="345"
                x2="455"
                y2="345"
                stroke="#19191D"
                strokeWidth="6.5"
                strokeLinecap="round"
              />

              {/* Hand Mitten */}
              <circle cx="455" cy="345" r="5" fill="#19191D" />
            </motion.g>
          </motion.g>
        )}
    </motion.g>
  );
};

export default YumiCharacter;
