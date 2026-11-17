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
  pointer,
  isIntroComplete = true,
  shouldReduceMotion = false,
}) => {
  // Precision spring tuned to Tupi's elastic block mass
  const springX = useSpring(pointer.x, tupiSpringConfig);
  const springY = useSpring(pointer.y, tupiSpringConfig);

  // Dynamic deformation derived from pointer:
  // When pointer moves right towards form, Tupi skews and leans towards it (matching frame_008)
  const bodyPointerSkewX = useTransform(springX, (val) =>
    shouldReduceMotion ? 0 : val * -11.0
  );
  const bodyPointerX = useTransform(springX, (val) =>
    shouldReduceMotion ? 0 : val * 5.0
  );
  const bodyPointerRotate = useTransform(springX, (val) =>
    shouldReduceMotion ? 0 : val * 1.8
  );
  const bodyPointerScaleY = useTransform(springY, (val) =>
    shouldReduceMotion ? 1 : 1 - val * 0.03
  );

  // Pupil movement strictly bounded inside eye boundary
  const pupilPointerX = useTransform(springX, (val) => val * 2.2);
  const pupilPointerY = useTransform(springY, (val) => val * 2.0);

  // Intro entrance vs settled states
  const bodyIntroVariants = {
    intro: {
      y: 120,
      scaleY: 0.5,
      scaleX: 1.2,
      rotate: -35,
      transition: introSpringConfig,
    },
    idle: {
      y: shouldReduceMotion ? 0 : [0, -5, 0],
      scaleY: 1,
      scaleX: 1,
      rotate: 0,
      x: 0,
      skewX: 0,
      transition: {
        y: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' as const },
        default: smoothStateTransition,
      },
    },
    pointerTracking: {
      y: 0,
      scaleY: 1,
      scaleX: 1,
      rotate: 0,
      x: 0,
      transition: { duration: 0.25, ease: 'easeOut' as const },
    },
    emailFocus: {
      // Leans eagerly toward the email input (matching frame_008)
      x: 8,
      y: -2,
      rotate: 2,
      skewX: -9,
      scaleY: 1.02,
      transition: smoothStateTransition,
    },
    passwordFocus: {
      // Leans backward politely away from password (matching frame_011)
      x: -6,
      y: 4,
      rotate: -2.5,
      skewX: 5,
      scaleY: 0.98,
      transition: smoothStateTransition,
    },
    passwordVisible: {
      // Skeptical judge posture looking at visible password (matching frame_015)
      y: -4,
      x: 2,
      rotate: 0.5,
      skewX: -4,
      scaleY: 1.01,
      transition: smoothStateTransition,
    },
    error: {
      // Bent waist & drooping tilt (matching frame_013)
      x: -12,
      y: 14,
      rotate: -12,
      skewX: 6,
      scaleY: 0.94,
      transition: { duration: 0.45, ease: 'easeOut' as const },
    },
    success: {
      // Joyful upward stretch celebration (matching frame_017)
      y: -24,
      scaleY: 1.05,
      scaleX: 0.97,
      x: 0,
      rotate: 0,
      skewX: 0,
      transition: celebrationSpring,
    },
  };

  const isPasswordVisible = state === 'passwordVisible';
  const isError = state === 'error';
  const isPasswordFocus = state === 'passwordFocus';
  const isEmailFocus = state === 'emailFocus';
  const isSuccess = state === 'success';

  // SVG path morphing for body deformation:
  // Normal straight block vs Bent error posture (from frame_013)
  const normalBodyPath = 'M 160 80 L 305 80 L 305 470 L 160 470 L 160 320 L 160 200 Z';
  const errorBodyPath = 'M 175 80 L 315 105 L 305 470 L 255 470 L 235 320 L 160 260 Z';

  return (
    <motion.g
      variants={bodyIntroVariants}
      initial={!isIntroComplete ? 'intro' : false}
      animate={state}
      style={{
        transformOrigin: '232px 470px',
      }}
    >
      {/* Sub-group for pointer-driven skew, tilt, and vertical stretch */}
      <motion.g
        style={{
          skewX: bodyPointerSkewX,
          rotate: bodyPointerRotate,
          x: bodyPointerX,
          scaleY: bodyPointerScaleY,
          transformOrigin: '232px 470px',
        }}
      >
        {/* Main Purple Body with Path Interpolation */}
        <motion.path
          d={isError ? errorBodyPath : normalBodyPath}
          fill="#6528F5"
          animate={{ d: isError ? errorBodyPath : normalBodyPath }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />

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

        {/* ================= LEFT EYE ================= */}
        <g>
          {isPasswordVisible ? (
            // Skeptical narrow slit eye (frame_015)
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
            <circle cx="224" cy="118" r="4.5" fill="#FFFFFF" />
          )}

          {/* Left Pupil */}
          {!isPasswordVisible && (
            <motion.circle
              cx="224"
              cy="118"
              r="2.5"
              fill="#19191D"
              style={
                isPasswordFocus || isEmailFocus || isError
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
                  : undefined
              }
              transition={{ duration: 0.25 }}
            />
          )}
        </g>

        {/* ================= RIGHT EYE ================= */}
        <g>
          {isPasswordVisible ? (
            // Skeptical narrow slit eye (frame_015)
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
            <circle cx="264" cy="118" r="4.5" fill="#FFFFFF" />
          )}

          {/* Right Pupil */}
          {!isPasswordVisible && (
            <motion.circle
              cx="264"
              cy="118"
              r="2.5"
              fill="#19191D"
              style={
                isPasswordFocus || isEmailFocus || isError
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
                  : undefined
              }
              transition={{ duration: 0.25 }}
            />
          )}
        </g>

        {/* Vertical Stoic Nose */}
        <rect x="241" y="110" width="6.5" height="34" rx="3.25" fill="#19191D" />

        {/* Mouth Expression (Reactive across states matching reference frames) */}
        {isError && (
          // Sad frowned mouth (frame_013)
          <motion.path
            d="M 239 154 Q 244 148 249 154"
            stroke="#19191D"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
          />
        )}
        {isPasswordVisible && (
          // Disapproving judging frown (frame_015)
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
          // Content smiling mouth (frame_017)
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
