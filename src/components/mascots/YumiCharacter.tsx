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
  pointer,
  isIntroComplete = true,
  shouldReduceMotion = false,
}) => {
  // Precision spring tuned to Yumi's curved pill shape
  const springX = useSpring(pointer.x, yumiSpringConfig);
  const springY = useSpring(pointer.y, yumiSpringConfig);

  // Dynamic deformation derived from pointer (matching frame_008)
  const bodyPointerSkewX = useTransform(springX, (val) =>
    shouldReduceMotion ? 0 : val * -6.5
  );
  const bodyPointerX = useTransform(springX, (val) =>
    shouldReduceMotion ? 0 : val * 4.5
  );
  const bodyPointerRotate = useTransform(springX, (val) =>
    shouldReduceMotion ? 0 : val * 2.2
  );
  const armPointerRotate = useTransform(springY, (val) =>
    shouldReduceMotion ? 0 : val * 6.0
  );

  // Eye movement bounded inside face
  const eyePointerX = useTransform(springX, (val) => val * 3.2);
  const eyePointerY = useTransform(springY, (val) => val * 2.5);

  // Intro floor pop vs settled states
  const bodyIntroVariants = {
    intro: {
      y: 90,
      scaleY: 0.45,
      scaleX: 1.25,
      transition: {
        ...introSpringConfig,
        delay: 0.2,
      },
    },
    idle: {
      x: shouldReduceMotion ? 0 : [0, 2, 0, -2, 0],
      y: 0,
      rotate: 0,
      skewX: 0,
      scaleY: 1,
      scaleX: 1,
      transition: {
        x: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' as const, delay: 0.6 },
        default: smoothStateTransition,
      },
    },
    pointerTracking: {
      x: 0,
      y: 0,
      rotate: 0,
      scaleY: 1,
      transition: { duration: 0.25, ease: 'easeOut' as const },
    },
    emailFocus: {
      // Leans toward the form (matching frame_008)
      x: 6,
      y: -2,
      rotate: 1.5,
      skewX: -6.0,
      transition: smoothStateTransition,
    },
    passwordFocus: {
      // Sinks slightly while arm covers eye
      y: 8,
      x: -3,
      rotate: -1.5,
      skewX: 3,
      transition: smoothStateTransition,
    },
    passwordVisible: {
      // Peeking up with curiosity (matching frame_015)
      y: -6,
      x: 3,
      rotate: 0,
      skewX: -2,
      transition: smoothStateTransition,
    },
    error: {
      // Squashed and nervous tilt (matching frame_013)
      x: 4,
      y: 12,
      rotate: 4,
      skewX: 4,
      scaleY: 0.94,
      transition: { duration: 0.45, ease: 'easeOut' as const },
    },
    success: {
      y: -20,
      x: 0,
      rotate: [0, -4, 4, 0],
      skewX: 0,
      scaleY: 1.04,
      transition: celebrationSpring,
    },
  };

  const isPasswordFocus = state === 'passwordFocus';
  const isPasswordVisible = state === 'passwordVisible';
  const isError = state === 'error';
  const isSuccess = state === 'success';
  const isEmailFocus = state === 'emailFocus';

  return (
    <motion.g
      variants={bodyIntroVariants}
      initial={!isIntroComplete ? 'intro' : false}
      animate={state}
      style={{
        transformOrigin: '385px 470px',
      }}
    >
      {/* Sub-group for pointer-driven skew and tilt */}
      <motion.g
        style={{
          skewX: bodyPointerSkewX,
          rotate: bodyPointerRotate,
          x: bodyPointerX,
          transformOrigin: '385px 470px',
        }}
      >
        {/* Main Arch / Pill Body */}
        <path
          d="M 330 325 A 55 55 0 0 1 440 325 L 440 470 L 330 470 Z"
          fill="#F1D20A"
          className="transition-colors duration-300"
        />

        {/* Eye: single friendly dot or squint */}
        {isPasswordFocus ? (
          // Squinting closed eye beneath the covering arm
          <path
            d="M 366 318 Q 372 314 378 318"
            stroke="#19191D"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
        ) : isSuccess ? (
          // Happy arched eye
          <path
            d="M 366 319 Q 372 312 378 319"
            stroke="#19191D"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
        ) : isError ? (
          // Nervous small worried dot
          <circle cx="372" cy="318" r="3.5" fill="#19191D" />
        ) : (
          <motion.circle
            cx="372"
            cy="318"
            r={isPasswordVisible ? 5.5 : 4.5}
            fill="#19191D"
            style={
              isEmailFocus
                ? undefined
                : {
                    x: eyePointerX,
                    y: eyePointerY,
                  }
            }
            animate={
              isEmailFocus
                ? { x: 3.0, y: 0.2 }
                : undefined
            }
            transition={{ duration: 0.25 }}
          />
        )}

        {/* ================= ARM & MOUTH POSE (State-driven & Pointer reactive) ================= */}
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

              {/* Hand / End Mitten (Covers eye when rotated to -124deg) */}
              <circle cx="455" cy="345" r="5" fill="#19191D" />
            </motion.g>
          </motion.g>
        )}
      </motion.g>
    </motion.g>
  );
};

export default YumiCharacter;
