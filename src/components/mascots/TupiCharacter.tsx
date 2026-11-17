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

  // GROUND ANCHOR PRESERVATION:
  // skewX and scaleY anchored at (232px 470px) guarantee the bottom edge
  // stays strictly horizontal on y = 470 without any diagonal tilting!
  const bodyPointerSkewX = useTransform(springX, (val) =>
    isInteractive ? val * -11.0 : 0
  );
  const bodyPointerX = useTransform(springX, (val) =>
    isInteractive ? val * 5.0 : 0
  );
  const bodyPointerScaleY = useTransform(springY, (val) =>
    isInteractive ? 1 - val * 0.03 : 1
  );

  // Upper head tilt around (232px 130px) without tilting the base
  const headPointerRotate = useTransform(springX, (val) =>
    isInteractive ? val * 2.2 : 0
  );

  // Pupils strictly bounded within sclera
  const pupilPointerX = useTransform(springX, (val) => (isInteractive ? val * 2.2 : 0));
  const pupilPointerY = useTransform(springY, (val) => (isInteractive ? val * 2.0 : 0));

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
    // Stage 3: Interactive states
    idle: {
      y: 0,
      scaleY: shouldReduceMotion ? 1 : [1, 1.025, 1],
      scaleX: 1,
      rotate: 0,
      skewX: 0,
      x: 0,
      opacity: 1,
      transition: {
        scaleY: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' as const },
        default: smoothStateTransition,
      },
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
      x: 8,
      y: 0,
      skewX: -9,
      scaleY: 1.02,
      rotate: 0,
      opacity: 1,
      transition: smoothStateTransition,
    },
    passwordFocus: {
      x: -6,
      y: 0,
      skewX: 5,
      scaleY: 0.98,
      rotate: 0,
      opacity: 1,
      transition: smoothStateTransition,
    },
    passwordVisible: {
      y: 0,
      x: 2,
      skewX: -4,
      scaleY: 1.01,
      rotate: 0,
      opacity: 1,
      transition: smoothStateTransition,
    },
    error: {
      x: -8,
      y: 0, // Remains grounded on y = 470
      skewX: 4,
      scaleY: 0.95,
      rotate: 0, // Base remains horizontal!
      opacity: 1,
      transition: { duration: 0.45, ease: 'easeOut' as const },
    },
    success: {
      y: -26,
      scaleY: 1.05,
      scaleX: 0.97,
      x: 0,
      rotate: 0,
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

  // Stable canonical rectangular body: strictly anchored to L 305 470 L 160 470!
  const normalBodyPath = 'M 160 80 L 305 80 L 305 470 L 160 470 Z';

  return (
    <motion.g
      variants={bodyVariants}
      initial={shouldReduceMotion ? 'settled' : 'hidden'}
      animate={activeAnimation}
      style={{
        transformOrigin: '232px 470px',
      }}
    >
      {/* Sub-group for pointer-driven skew and scale anchored at fixed base y=470 */}
      <motion.g
        style={{
          skewX: bodyPointerSkewX,
          x: bodyPointerX,
          scaleY: bodyPointerScaleY,
          transformOrigin: '232px 470px',
        }}
      >
        {/* Main Purple Body (Baseline strictly L 305 470 L 160 470) */}
        <path
          d={normalBodyPath}
          fill="#6528F5"
        />

        {/* ================= UPPER HEAD & FACIAL GROUP ================= */}
        {/* Tilts and rotates around (232px 130px) without tilting the base! */}
        <motion.g
          animate={
            isError
              ? { rotate: -10 }
              : isPasswordFocus
              ? { rotate: -3 }
              : isEmailFocus
              ? { rotate: 2.5 }
              : { rotate: 0 }
          }
          style={{
            transformOrigin: '232px 130px',
          }}
          transition={smoothStateTransition}
        >
          <motion.g
            style={{
              rotate: headPointerRotate,
              transformOrigin: '232px 130px',
            }}
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
                <circle cx="224" cy="118" r="4.5" fill="#FFFFFF" />
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
                <circle cx="264" cy="118" r="4.5" fill="#FFFFFF" />
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
      </motion.g>
    </motion.g>
  );
};

export default TupiCharacter;
