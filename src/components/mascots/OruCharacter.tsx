'use client';

import React from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { CharacterCommonProps } from './types';
import {
  oruSpringConfig,
  introSpringConfig,
  celebrationSpring,
  smoothStateTransition,
} from './motion-presets';

export const OruCharacter: React.FC<CharacterCommonProps> = ({
  state,
  lifecycle,
  pointer,
  shouldReduceMotion = false,
}) => {
  // Precision spring tuned to Oru's bouncy squishy dome
  const springX = useSpring(pointer.x, oruSpringConfig);
  const springY = useSpring(pointer.y, oruSpringConfig);

  const isInteractive = lifecycle === 'interactive' && !shouldReduceMotion;

  // STRICT GROUND ANCHOR PRESERVATION:
  // The bottom dome baseline (y=470) NEVER moves, tilts, or skews!
  // All cursor tracking is accomplished through 3D face parallax inside the fixed dome.
  const facePointerX = useTransform(springX, (val) =>
    isInteractive ? val * 6.5 : 0
  );
  const facePointerY = useTransform(springY, (val) =>
    isInteractive ? val * 4.0 : 0
  );
  const facePointerRotate = useTransform(springX, (val) =>
    isInteractive ? val * 1.8 : 0
  );

  // Eyes tracking pointer
  const eyePointerX = useTransform(springX, (val) => (isInteractive ? val * 3.5 : 0));
  const eyePointerY = useTransform(springY, (val) => (isInteractive ? val * 2.2 : 0));

  // Deterministic WeStud-matched keyframes for all three lifecycle stages
  const bodyVariants = {
    // Stage 0: Pre-intro hidden state (0.0s - 1.8s)
    hidden: {
      x: -160,
      y: 0,
      rotate: 0,
      skewX: 0,
      scaleX: 0.85,
      scaleY: 0.85,
      opacity: 0,
    },
    // Stage 1: Intro sequence (0.0s - 4.4s)
    // 0s-1.8s: offscreen far left, hidden
    // 2.5s: enters firmly on the ground baseline
    // 3.5s: rolls into foreground, expands into full wide dome
    // 4.4s: settled flat on baseline y=470
    intro: {
      x: [-160, -160, -50, 0, 0],
      y: [0, 0, 0, 0, 0],
      rotate: [0, 0, 0, 0, 0],
      skewX: [0, 0, 0, 0, 0],
      scaleX: [0.85, 0.85, 0.92, 0.98, 1.0],
      scaleY: [0.85, 0.85, 0.92, 0.98, 1.0],
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
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotate: 0,
      skewX: 0,
      opacity: 1,
      transition: { duration: 0.2, ease: 'easeOut' as const },
    },
    // Stage 3: Interactive states - BASE REMAINS 100% FIXED ON GROUND (y=470)
    idle: {
      scaleY: 1,
      scaleX: 1,
      y: 0,
      rotate: 0,
      x: 0,
      skewX: 0,
      opacity: 1,
      transition: smoothStateTransition,
    },
    pointerTracking: {
      scaleY: 1,
      scaleX: 1,
      y: 0,
      rotate: 0,
      x: 0,
      skewX: 0,
      opacity: 1,
      transition: { duration: 0.2, ease: 'easeOut' as const },
    },
    emailFocus: {
      x: 0,
      y: 0,
      rotate: 0,
      skewX: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      transition: smoothStateTransition,
    },
    passwordFocus: {
      rotate: 0,
      y: 0,
      scaleY: 1,
      scaleX: 1,
      skewX: 0,
      x: 0,
      opacity: 1,
      transition: smoothStateTransition,
    },
    passwordVisible: {
      y: 0,
      x: 0,
      scaleY: 1,
      scaleX: 1,
      rotate: 0,
      skewX: 0,
      opacity: 1,
      transition: smoothStateTransition,
    },
    error: {
      x: 0,
      y: 0,
      rotate: 0,
      scaleY: 1,
      scaleX: 1,
      skewX: 0,
      opacity: 1,
      transition: { duration: 0.45, ease: 'easeOut' as const },
    },
    success: {
      scaleX: 1.05,
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
  const isPasswordVisible = lifecycle === 'interactive' && state === 'passwordVisible';
  const isError = lifecycle === 'interactive' && state === 'error';
  const isSuccess = lifecycle === 'interactive' && state === 'success';
  const isEmailFocus = lifecycle === 'interactive' && state === 'emailFocus';

  // Base from (30, 470) to (300, 470) is 100% strictly IDENTICAL in all states!
  // The bottom baseline NEVER moves, while the crest squashes and leans forward dynamically.
  const normalOruPath =
    'M 30 470 C 30 398 90 340 165 340 C 240 340 300 398 300 470 Z';
  const emailOruPath =
    'M 30 470 C 30 415 110 342 185 342 C 255 342 300 415 300 470 Z';
  const passwordOruPath =
    'M 30 470 C 30 420 85 360 150 360 C 225 360 300 420 300 470 Z';
  const errorOruPath =
    'M 30 470 C 30 420 90 355 155 355 C 230 355 300 420 300 470 Z';
  const successOruPath =
    'M 30 470 C 30 390 90 328 165 328 C 240 328 300 390 300 470 Z';

  const currentBodyPath =
    isEmailFocus
      ? emailOruPath
      : isPasswordFocus
      ? passwordOruPath
      : isError
      ? errorOruPath
      : isSuccess
      ? successOruPath
      : normalOruPath;

  return (
    <motion.g
      variants={bodyVariants}
      initial={shouldReduceMotion ? 'settled' : 'hidden'}
      animate={activeAnimation}
      style={{
        transformOrigin: '165px 470px',
      }}
    >
      {/* Main Semicircle Dome Body (Morphing crest, baseline on y=470 is 100% static & horizontal) */}
      <motion.path
        d={currentBodyPath}
        animate={{ d: currentBodyPath }}
        transition={smoothStateTransition}
        fill="#FF852E"
        className="transition-colors duration-300"
      />

      {/* ================= UPPER FACIAL GROUP ================= */}
      {/* Moves and rotates smoothly with cursor parallax and body lean, leaving the dome base 100% immobile */}
      <motion.g
        style={{
          x: facePointerX,
          y: facePointerY,
          rotate: facePointerRotate,
          transformOrigin: '165px 412px',
        }}
        animate={
          isEmailFocus
            ? { x: 14, y: 0, rotate: 2 }
            : isPasswordFocus
            ? { x: -3, y: 3, rotate: -2 }
            : isError
            ? { x: -3, y: 2, rotate: -3 }
            : isSuccess
            ? { y: -5 }
            : { x: 0, y: 0, rotate: 0 }
        }
        transition={smoothStateTransition}
      >
          {/* Left Eye */}
          {isPasswordFocus || isPasswordVisible ? (
            <path
              d="M 136 405 Q 142 400 148 405"
              stroke="#19191D"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          ) : isSuccess ? (
            <path
              d="M 136 406 Q 142 398 148 406"
              stroke="#19191D"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          ) : isError ? (
            <path
              d="M 136 407 Q 142 402 148 405"
              stroke="#19191D"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <motion.circle
              cx="142"
              cy="405"
              r={5}
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
                  ? { x: 3.5, y: 0.2 }
                  : { x: 0, y: 0 }
              }
              transition={{ duration: 0.25 }}
            />
          )}

          {/* Right Eye */}
          {isPasswordFocus || isPasswordVisible ? (
            <path
              d="M 194 405 Q 200 400 206 405"
              stroke="#19191D"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          ) : isSuccess ? (
            <path
              d="M 194 406 Q 200 398 206 406"
              stroke="#19191D"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          ) : isError ? (
            <path
              d="M 194 407 Q 200 402 206 405"
              stroke="#19191D"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <motion.circle
              cx="200"
              cy="405"
              r={5}
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
                  ? { x: 3.5, y: 0.2 }
                  : { x: 0, y: 0 }
              }
              transition={{ duration: 0.25 }}
            />
          )}

          {/* Mouth Expressions */}
          {isError ? (
            <path
              d="M 162 426 Q 171 418 180 426"
              stroke="#19191D"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          ) : isSuccess ? (
            <path d="M 156 416 Q 171 438 186 416 Z" fill="#19191D" />
          ) : isPasswordFocus || isPasswordVisible ? (
            <line
              x1="165"
              y1="422"
              x2="177"
              y2="422"
              stroke="#19191D"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ) : isEmailFocus ? (
            <motion.ellipse
              key="oru-mouth-o"
              cx="171"
              cy="421"
              rx="4.8"
              ry="6.2"
              fill="#19191D"
              style={{ transformOrigin: '171px 421px' }}
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            />
          ) : (
            <motion.path
              key="oru-mouth-smile"
              d="M 160 418 Q 171 432 182 418 Z"
              fill="#19191D"
              style={{ transformOrigin: '171px 425px' }}
              initial={{ scale: 0.8, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          )}
        </motion.g>
    </motion.g>
  );
};

export default OruCharacter;
