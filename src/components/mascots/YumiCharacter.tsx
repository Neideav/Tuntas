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

  // GROUND ANCHOR PRESERVATION:
  // Using skewX and scaleY anchored at (385px 470px)
  // keeps the bottom edge L 440 470 L 330 470 perfectly horizontal on y = 470!
  const bodyPointerSkewX = useTransform(springX, (val) =>
    isInteractive ? val * -6.5 : 0
  );
  const bodyPointerX = useTransform(springX, (val) =>
    isInteractive ? val * 4.5 : 0
  );
  const bodyPointerScaleY = useTransform(springY, (val) =>
    isInteractive ? 1 - val * 0.02 : 1
  );

  // Upper head tilt around (385px 330px) without tilting the base
  const headPointerRotate = useTransform(springX, (val) =>
    isInteractive ? val * 2.2 : 0
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
    // Stage 3: Interactive states
    idle: {
      scaleY: shouldReduceMotion ? 1 : [1, 1.02, 1],
      rotate: 0,
      skewX: 0,
      x: 0,
      y: 0,
      opacity: 1,
      transition: {
        scaleY: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' as const, delay: 0.6 },
        default: smoothStateTransition,
      },
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
      x: 6,
      y: 0,
      rotate: 0,
      skewX: -6.0,
      scaleY: 1.02,
      opacity: 1,
      transition: smoothStateTransition,
    },
    passwordFocus: {
      x: -3,
      y: 0,
      rotate: 0,
      skewX: 3,
      scaleY: 0.96, // Squashes down with base fixed
      opacity: 1,
      transition: smoothStateTransition,
    },
    passwordVisible: {
      y: 0,
      x: 3,
      rotate: 0,
      skewX: -2,
      scaleY: 1.01,
      opacity: 1,
      transition: smoothStateTransition,
    },
    error: {
      x: 4,
      y: 0, // Remains grounded
      scaleY: 0.94,
      rotate: 0,
      skewX: 3,
      opacity: 1,
      transition: { duration: 0.45, ease: 'easeOut' as const },
    },
    success: {
      y: -22,
      x: 0,
      rotate: [0, -4, 4, 0],
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

  return (
    <motion.g
      variants={bodyVariants}
      initial={shouldReduceMotion ? 'settled' : 'hidden'}
      animate={activeAnimation}
      style={{
        transformOrigin: '385px 470px',
      }}
    >
      {/* Sub-group for pointer-driven skew and scale anchored at fixed base y=470 */}
      <motion.g
        style={{
          skewX: bodyPointerSkewX,
          x: bodyPointerX,
          scaleY: bodyPointerScaleY,
          transformOrigin: '385px 470px',
        }}
      >
        {/* Main Arch / Pill Body (Baseline L 440 470 L 330 470 Z) */}
        <path
          d="M 330 325 A 55 55 0 0 1 440 325 L 440 470 L 330 470 Z"
          fill="#F1D20A"
          className="transition-colors duration-300"
        />

        {/* ================= UPPER HEAD & EYE GROUP ================= */}
        {/* Tilts around (385px 330px) without rotating the base */}
        <motion.g
          style={{
            rotate: headPointerRotate,
            transformOrigin: '385px 330px',
          }}
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
    </motion.g>
  );
};

export default YumiCharacter;
