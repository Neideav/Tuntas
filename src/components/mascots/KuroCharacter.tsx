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

  // GROUND ANCHOR PRESERVATION:
  // Using skewX and horizontal slide anchored at (307px 470px)
  // keeps the bottom edge perfectly horizontal on y = 470!
  const bodyPointerSkewX = useTransform(springX, (val) =>
    isInteractive ? val * -7.5 : 0
  );
  const bodyPointerX = useTransform(springX, (val) =>
    isInteractive ? val * 6.5 : 0
  );
  const bodyPointerScaleY = useTransform(springY, (val) =>
    isInteractive ? 1 - val * 0.02 : 1
  );

  // Upper eyes tilt around (332px 235px) without rotating the base
  const eyesPointerRotate = useTransform(springX, (val) =>
    isInteractive ? val * 2.0 : 0
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
    // Stage 3: Interactive states
    idle: {
      scaleY: shouldReduceMotion ? 1 : [1, 1.02, 1],
      rotate: 0,
      x: 0,
      y: 0,
      skewX: 0,
      opacity: 1,
      transition: {
        scaleY: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' as const, delay: 0.3 },
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
      x: 10,
      y: 0,
      rotate: 0,
      skewX: -6.5,
      scaleY: 1.02,
      opacity: 1,
      transition: smoothStateTransition,
    },
    passwordFocus: {
      x: -12,
      y: 0,
      rotate: 0,
      skewX: 4,
      scaleY: 0.98,
      opacity: 1,
      transition: smoothStateTransition,
    },
    passwordVisible: {
      y: 0,
      x: 6,
      rotate: 0,
      skewX: -3,
      scaleY: 1.01,
      opacity: 1,
      transition: smoothStateTransition,
    },
    error: {
      x: -4,
      y: 0, // Remains grounded
      scaleY: 0.92, // Sinks down via squash anchored at y=470!
      rotate: 0,
      skewX: 2,
      opacity: 1,
      transition: { duration: 0.45, ease: 'easeOut' as const },
    },
    success: {
      y: -26,
      x: 0,
      rotate: 0,
      skewX: 0,
      scale: 1.05,
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

  return (
    <motion.g
      variants={bodyVariants}
      initial={shouldReduceMotion ? 'settled' : 'hidden'}
      animate={activeAnimation}
      style={{
        transformOrigin: '307px 470px',
      }}
    >
      {/* Sub-group for pointer-driven skew and scale anchored at fixed base y=470 */}
      <motion.g
        style={{
          skewX: bodyPointerSkewX,
          x: bodyPointerX,
          scaleY: bodyPointerScaleY,
          transformOrigin: '307px 470px',
        }}
      >
        {/* Main Black Rectangular Body (Baseline flat on y=470) */}
        <rect
          x="260"
          y="195"
          width="95"
          height="275"
          fill="#19191D"
          className="transition-colors duration-300"
        />

        {/* ================= UPPER EYES GROUP ================= */}
        {/* Tilts subtly around eye center (332px 235px) without tilting base */}
        <motion.g
          style={{
            rotate: eyesPointerRotate,
            transformOrigin: '332px 235px',
          }}
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
                    ? { duration: 4.4, times: [0, 0.41, 0.57, 0.73, 0.86, 1.0], ease: 'easeInOut' as const }
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
                    ? { duration: 4.4, times: [0, 0.41, 0.57, 0.73, 0.86, 1.0], ease: 'easeInOut' as const }
                    : { duration: 0.25 }
                }
              />
            )}
          </g>
        </motion.g>
      </motion.g>
    </motion.g>
  );
};

export default KuroCharacter;
