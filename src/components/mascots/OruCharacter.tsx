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

  // GROUND ANCHOR PRESERVATION:
  // Using skewX and bottom-anchored scaleX/scaleY at (165px 470px)
  // guarantees the flat bottom baseline M 40 470 ... 290 470 Z remains 100% horizontal!
  const bodyPointerSkewX = useTransform(springX, (val) =>
    isInteractive ? val * -6.5 : 0
  );
  const bodyPointerX = useTransform(springX, (val) =>
    isInteractive ? val * 3.5 : 0
  );
  const bodyPointerScaleX = useTransform(springX, (val) =>
    isInteractive ? 1 + Math.abs(val) * 0.04 : 1
  );
  const bodyPointerScaleY = useTransform(springY, (val) =>
    isInteractive ? 1 - val * 0.03 : 1
  );

  // Facial elements tilt around (165px 412px) without tilting the flat bottom edge
  const facePointerRotate = useTransform(springX, (val) =>
    isInteractive ? val * 2.2 : 0
  );

  // Eyes tracking pointer
  const eyePointerX = useTransform(springX, (val) => (isInteractive ? val * 3.8 : 0));
  const eyePointerY = useTransform(springY, (val) => (isInteractive ? val * 2.5 : 0));

  // Deterministic WeStud-matched keyframes for all three lifecycle stages
  const bodyVariants = {
    // Stage 0: Pre-intro hidden state (0.0s - 1.8s)
    hidden: {
      x: -180,
      y: -70,
      rotate: 20,
      skewX: 0,
      scale: 0.50,
      opacity: 0,
    },
    // Stage 1: Intro sequence (0.0s - 4.4s)
    // 0s-1.8s: offscreen far left, hidden
    // 2.5s: enters as rounded pill floating at mid-left
    // 3.5s: rolls into foreground, expands into wide dome
    // 4.4s: settled flat on baseline y=470
    intro: {
      x: [-180, -180, -75, 0, 0],
      y: [-70, -70, -45, 0, 0],
      rotate: [20, 20, 16, 0, 0],
      skewX: [0, 0, 0, 0, 0],
      scale: [0.50, 0.50, 0.62, 0.98, 1.0],
      opacity: [0, 0, 1, 1, 1],
      transition: {
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
      scale: 1,
      opacity: 1,
      transition: { duration: 0.2, ease: 'easeOut' as const },
    },
    // Stage 3: Interactive states
    idle: {
      scaleY: shouldReduceMotion ? 1 : [1, 1.025, 1],
      scaleX: 1,
      y: 0,
      rotate: 0,
      x: 0,
      skewX: 0,
      opacity: 1,
      transition: {
        scaleY: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const },
        default: smoothStateTransition,
      },
    },
    pointerTracking: {
      scaleY: 1,
      scaleX: 1,
      y: 0,
      rotate: 0,
      x: 0,
      opacity: 1,
      transition: { duration: 0.2, ease: 'easeOut' as const },
    },
    emailFocus: {
      x: 6,
      y: 0,
      rotate: 0,
      skewX: -6.0,
      scaleX: 1.04,
      scaleY: 0.98,
      opacity: 1,
      transition: smoothStateTransition,
    },
    passwordFocus: {
      rotate: 0,
      y: 0,
      scaleY: 0.96, // Squashes down into the floor
      scaleX: 1.03,
      skewX: 2,
      x: -2,
      opacity: 1,
      transition: smoothStateTransition,
    },
    passwordVisible: {
      y: 0,
      x: 0,
      scaleY: 1.01,
      rotate: 0,
      skewX: -2,
      opacity: 1,
      transition: smoothStateTransition,
    },
    error: {
      x: -4,
      y: 0, // Remains grounded
      rotate: 0,
      scaleY: 0.95,
      scaleX: 1.04,
      skewX: 3,
      opacity: 1,
      transition: { duration: 0.45, ease: 'easeOut' as const },
    },
    success: {
      scale: 1.08,
      y: -24,
      scaleY: 1.05,
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

  return (
    <motion.g
      variants={bodyVariants}
      initial={shouldReduceMotion ? 'settled' : 'hidden'}
      animate={activeAnimation}
      style={{
        transformOrigin: '165px 470px',
      }}
    >
      {/* Sub-group for pointer-driven skew and scale anchored at fixed base y=470 */}
      <motion.g
        style={{
          skewX: bodyPointerSkewX,
          x: bodyPointerX,
          scaleX: bodyPointerScaleX,
          scaleY: bodyPointerScaleY,
          transformOrigin: '165px 470px',
        }}
      >
        {/* Main Semicircle Dome Body (Flat base on y=470) */}
        <path
          d="M 40 470 A 125 125 0 0 1 290 470 Z"
          fill="#FF852E"
          className="transition-colors duration-300"
        />

        {/* ================= UPPER FACIAL GROUP ================= */}
        {/* Tilts around (165px 412px) without rotating the flat baseline */}
        <motion.g
          style={{
            rotate: facePointerRotate,
            transformOrigin: '165px 412px',
          }}
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
          ) : (
            <path d="M 160 418 Q 171 432 182 418 Z" fill="#19191D" />
          )}
        </motion.g>
      </motion.g>
    </motion.g>
  );
};

export default OruCharacter;
