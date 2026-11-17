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
  pointer,
  isIntroComplete = true,
  shouldReduceMotion = false,
}) => {
  // Precision spring tuned to Kuro's quick agile peeking reflexes
  const springX = useSpring(pointer.x, kuroSpringConfig);
  const springY = useSpring(pointer.y, kuroSpringConfig);

  // Dynamic deformation derived from pointer (matching frame_008)
  const bodyPointerSkewX = useTransform(springX, (val) =>
    shouldReduceMotion ? 0 : val * -7.5
  );
  const bodyPointerX = useTransform(springX, (val) =>
    shouldReduceMotion ? 0 : val * 6.5
  );
  const bodyPointerRotate = useTransform(springX, (val) =>
    shouldReduceMotion ? 0 : val * 2.0
  );

  // Pupils strictly bounded within sclera
  const pupilPointerX = useTransform(springX, (val) => val * 3.2);
  const pupilPointerY = useTransform(springY, (val) => val * 2.8);

  // Intro ceiling drop vs settled state variants
  const bodyIntroVariants = {
    intro: {
      y: -360,
      scaleY: 1.2,
      scaleX: 0.9,
      rotate: 8,
      transition: {
        ...introSpringConfig,
        delay: 0.15,
      },
    },
    idle: {
      y: shouldReduceMotion ? 0 : [0, -4, 0],
      rotate: 0,
      x: 0,
      skewX: 0,
      scaleY: 1,
      scaleX: 1,
      transition: {
        y: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' as const, delay: 0.3 },
        default: smoothStateTransition,
      },
    },
    pointerTracking: {
      y: 0,
      rotate: 0,
      x: 0,
      scaleY: 1,
      transition: { duration: 0.25, ease: 'easeOut' as const },
    },
    emailFocus: {
      // Peeks forward and steps right to inspect email (frame_008)
      x: 10,
      y: -3,
      rotate: 1.8,
      skewX: -6.5,
      transition: smoothStateTransition,
    },
    passwordFocus: {
      // Slides left and hides partially behind Tupi (frame_011)
      x: -12,
      y: 6,
      rotate: -2.5,
      skewX: 4,
      transition: smoothStateTransition,
    },
    passwordVisible: {
      // Pops out alertly (frame_015)
      y: -5,
      x: 6,
      rotate: 0.5,
      skewX: -3,
      scale: 1.02,
      transition: smoothStateTransition,
    },
    error: {
      // Sinks down worriedly looking up at Tupi (frame_013)
      y: 18,
      x: -4,
      rotate: -1.5,
      skewX: 2,
      transition: { duration: 0.45, ease: 'easeOut' as const },
    },
    success: {
      // Jumps forward and celebrates (frame_017)
      y: -26,
      x: 0,
      rotate: 0,
      skewX: 0,
      scale: 1.05,
      transition: celebrationSpring,
    },
  };

  const isPasswordFocus = state === 'passwordFocus';
  const isError = state === 'error';
  const isEmailFocus = state === 'emailFocus';
  const isPasswordVisible = state === 'passwordVisible';

  return (
    <motion.g
      variants={bodyIntroVariants}
      initial={!isIntroComplete ? 'intro' : false}
      animate={state}
      style={{
        transformOrigin: '307px 470px',
      }}
    >
      {/* Sub-group for pointer-driven skew, tilt, and peeking parallax */}
      <motion.g
        style={{
          skewX: bodyPointerSkewX,
          rotate: bodyPointerRotate,
          x: bodyPointerX,
          transformOrigin: '307px 470px',
        }}
      >
        {/* Main Black Rectangular Body */}
        <rect
          x="260"
          y="195"
          width="95"
          height="275"
          fill="#19191D"
          className="transition-colors duration-300"
        />

        {/* ================= LEFT EYE ================= */}
        <g>
          {isPasswordFocus ? (
            // Squinting closed eye slit (frame_011)
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

          {/* Left Pupil */}
          {!isPasswordFocus && (
            <motion.circle
              cx="320"
              cy="235"
              r="3.5"
              fill="#19191D"
              style={
                isError || isEmailFocus
                  ? undefined
                  : {
                      x: pupilPointerX,
                      y: pupilPointerY,
                    }
              }
              animate={
                isError
                  ? { x: -2.5, y: -2.5 } // Looks up worriedly at Tupi (frame_013)
                  : isEmailFocus
                  ? { x: 3.2, y: 0.2 }
                  : undefined
              }
              transition={{ duration: 0.25 }}
            />
          )}
        </g>

        {/* ================= RIGHT EYE ================= */}
        <g>
          {isPasswordFocus ? (
            // Squinting closed eye slit (frame_011)
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

          {/* Right Pupil */}
          {!isPasswordFocus && (
            <motion.circle
              cx="344"
              cy="235"
              r="3.5"
              fill="#19191D"
              style={
                isError || isEmailFocus
                  ? undefined
                  : {
                      x: pupilPointerX,
                      y: pupilPointerY,
                    }
              }
              animate={
                isError
                  ? { x: -2.5, y: -2.5 }
                  : isEmailFocus
                  ? { x: 3.2, y: 0.2 }
                  : undefined
              }
              transition={{ duration: 0.25 }}
            />
          )}
        </g>
      </motion.g>
    </motion.g>
  );
};

export default KuroCharacter;
