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
  pointer,
  isIntroComplete = true,
  shouldReduceMotion = false,
}) => {
  // Precision spring tuned to Oru's bouncy squishy dome
  const springX = useSpring(pointer.x, oruSpringConfig);
  const springY = useSpring(pointer.y, oruSpringConfig);

  // Dynamic deformation derived from pointer (matching frame_008)
  const bodyPointerSkewX = useTransform(springX, (val) =>
    shouldReduceMotion ? 0 : val * -6.5
  );
  const bodyPointerX = useTransform(springX, (val) =>
    shouldReduceMotion ? 0 : val * 3.5
  );
  const bodyPointerRotate = useTransform(springX, (val) =>
    shouldReduceMotion ? 0 : val * 2.4
  );
  const bodyPointerScaleX = useTransform(springX, (val) =>
    shouldReduceMotion ? 1 : 1 + Math.abs(val) * 0.04
  );

  // Eyes tracking pointer
  const eyePointerX = useTransform(springX, (val) => val * 3.8);
  const eyePointerY = useTransform(springY, (val) => val * 2.5);

  // Intro bounce-in bean vs settled states
  const bodyIntroVariants = {
    intro: {
      x: -180,
      scaleX: 0.6,
      scaleY: 1.35,
      rotate: -25,
      transition: {
        ...introSpringConfig,
        delay: 0.05,
      },
    },
    idle: {
      scaleY: shouldReduceMotion ? 1 : [1, 1.025, 1],
      y: shouldReduceMotion ? 0 : [0, -3, 0],
      rotate: 0,
      x: 0,
      skewX: 0,
      scaleX: 1,
      transition: {
        scaleY: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const },
        y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const },
        default: smoothStateTransition,
      },
    },
    pointerTracking: {
      scaleY: 1,
      y: 0,
      rotate: 0,
      x: 0,
      scaleX: 1,
      transition: { duration: 0.25, ease: 'easeOut' as const },
    },
    emailFocus: {
      // Stretches right towards email form (matching frame_008)
      x: 6,
      y: -2,
      rotate: 2.0,
      skewX: -6.0,
      scaleX: 1.04,
      transition: smoothStateTransition,
    },
    passwordFocus: {
      // Bashful compression
      rotate: -1.5,
      y: 3,
      scaleY: 0.97,
      skewX: 2,
      transition: smoothStateTransition,
    },
    passwordVisible: {
      // Calm closed eyes posture (matching frame_015)
      y: -2,
      scale: 1.01,
      rotate: 0,
      skewX: -2,
      transition: smoothStateTransition,
    },
    error: {
      // Confused sad slump (matching frame_013)
      x: -4,
      y: 6,
      rotate: -2.5,
      scaleY: 0.96,
      scaleX: 1.04,
      skewX: 3,
      transition: { duration: 0.45, ease: 'easeOut' as const },
    },
    success: {
      // Happy, energetic bounce! (matching frame_017)
      scale: 1.08,
      y: -24,
      scaleY: 1.05,
      x: 0,
      rotate: 0,
      skewX: 0,
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
        transformOrigin: '165px 470px',
      }}
    >
      {/* Sub-group for pointer-driven wobble, skew, and squash/stretch */}
      <motion.g
        style={{
          skewX: bodyPointerSkewX,
          rotate: bodyPointerRotate,
          x: bodyPointerX,
          scaleX: bodyPointerScaleX,
          transformOrigin: '165px 470px',
        }}
      >
        {/* Main Semicircle Dome Body */}
        <path
          d="M 40 470 A 125 125 0 0 1 290 470 Z"
          fill="#FF852E"
          className="transition-colors duration-300"
        />

        {/* ================= LEFT EYE ================= */}
        {isPasswordFocus || isPasswordVisible ? (
          // Bashful/peacefully closed eye (matching frame_011 & frame_015)
          <path
            d="M 136 405 Q 142 400 148 405"
            stroke="#19191D"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
        ) : isSuccess ? (
          // Joyful arched eye
          <path
            d="M 136 406 Q 142 398 148 406"
            stroke="#19191D"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
        ) : isError ? (
          // Sad drooping eye (matching frame_013)
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
              isEmailFocus
                ? undefined
                : {
                    x: eyePointerX,
                    y: eyePointerY,
                  }
            }
            animate={
              isEmailFocus
                ? { x: 3.5, y: 0.2 }
                : undefined
            }
            transition={{ duration: 0.25 }}
          />
        )}

        {/* ================= RIGHT EYE ================= */}
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
              isEmailFocus
                ? undefined
                : {
                    x: eyePointerX,
                    y: eyePointerY,
                  }
            }
            animate={
              isEmailFocus
                ? { x: 3.5, y: 0.2 }
                : undefined
            }
            transition={{ duration: 0.25 }}
          />
        )}

        {/* ================= MOUTH EXPRESSIONS (Matching Reference Frames) ================= */}
        {isError ? (
          // Distinct sad pout mouth from frame_013!
          <path
            d="M 162 426 Q 171 418 180 426"
            stroke="#19191D"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
        ) : isSuccess ? (
          // Big joyful open beaming smile (frame_017)
          <path d="M 156 416 Q 171 438 186 416 Z" fill="#19191D" />
        ) : isPasswordFocus || isPasswordVisible ? (
          // Quiet bashful neutral line (frame_011 & frame_015)
          <line
            x1="165"
            y1="422"
            x2="177"
            y2="422"
            stroke="#19191D"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ) : (
          // Standard cute friendly smile (frame_005)
          <path d="M 160 418 Q 171 432 182 418 Z" fill="#19191D" />
        )}
      </motion.g>
    </motion.g>
  );
};

export default OruCharacter;
