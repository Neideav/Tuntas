'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion } from 'motion/react';
import { LifecycleStage, MascotState, NormalizedPointer } from './types';
import TupiCharacter from './TupiCharacter';
import KuroCharacter from './KuroCharacter';
import YumiCharacter from './YumiCharacter';
import OruCharacter from './OruCharacter';

interface MascotSceneProps {
  state: MascotState;
  className?: string;
  onSceneClick?: () => void;
}

export const MascotScene: React.FC<MascotSceneProps> = ({
  state: parentState,
  className = '',
  onSceneClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = Boolean(useReducedMotion());

  // Explicit, deterministic 3-stage lifecycle:
  // INTRO -> SETTLED -> INTERACTIVE
  const [lifecycle, setLifecycle] = useState<LifecycleStage>(() =>
    shouldReduceMotion ? 'interactive' : 'intro'
  );

  // High-performance Motion Values for pointer coordinates
  // Direct DOM updates: 0 React component re-renders on pointer movements!
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const distanceToForm = useMotionValue(0);
  const isNearForm = useMotionValue(0);

  const pointer: NormalizedPointer = {
    x: pointerX,
    y: pointerY,
    distanceToForm,
    isNearForm,
  };

  // Centralized Lifecycle Progression: INTRO (0s - 4.4s) -> SETTLED (4.4s - 4.7s) -> INTERACTIVE (4.7s+)
  useEffect(() => {
    if (shouldReduceMotion) {
      setLifecycle('interactive');
      return;
    }

    // Stage 1 -> Stage 2: Settle characters into authoritative canonical composition at 4.4s
    const settleTimer = setTimeout(() => {
      setLifecycle('settled');
    }, 4400);

    // Stage 2 -> Stage 3: Enable interactive cursor tracking & form reactions at 4.7s
    const interactiveTimer = setTimeout(() => {
      setLifecycle('interactive');
    }, 4700);

    return () => {
      clearTimeout(settleTimer);
      clearTimeout(interactiveTimer);
    };
  }, [shouldReduceMotion]);

  // Pointer tracking with normalized boundaries and form proximity detection
  useEffect(() => {
    if (shouldReduceMotion) return;

    let frameId: number;

    const handlePointerMove = (clientX: number, clientY: number) => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        if (!containerRef.current) {
          const normX = (clientX / window.innerWidth) * 2 - 1;
          const normY = (clientY / window.innerHeight) * 2 - 1;
          pointerX.set(Math.max(-1, Math.min(1, normX)));
          pointerY.set(Math.max(-1, Math.min(1, normY)));
          return;
        }

        const rect = containerRef.current.getBoundingClientRect();
        // Visual center of character family
        const centerX = rect.left + rect.width * 0.48;
        const centerY = rect.top + rect.height * 0.6;

        const deltaX = clientX - centerX;
        const deltaY = clientY - centerY;

        // Attenuated normalization boundaries for responsive deformation
        const maxDistX = 520;
        const maxDistY = 380;
        const normX = Math.max(-1, Math.min(1, deltaX / maxDistX));
        const normY = Math.max(-1, Math.min(1, deltaY / maxDistY));

        pointerX.set(normX);
        pointerY.set(normY);

        // Proximity detection for authentication form on the right
        if (normX > 0.2) {
          isNearForm.set(1);
          distanceToForm.set(normX);
        } else {
          isNearForm.set(0);
          distanceToForm.set(0);
        }
      });
    };

    const onMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const resetPointer = () => {
      pointerX.set(0);
      pointerY.set(0);
      isNearForm.set(0);
      distanceToForm.set(0);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('mouseleave', resetPointer);
    window.addEventListener('touchend', resetPointer);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('mouseleave', resetPointer);
      window.removeEventListener('touchend', resetPointer);
    };
  }, [pointerX, pointerY, isNearForm, distanceToForm, shouldReduceMotion]);

  // If user focuses input or triggers an action, unlock interactive stage immediately
  useEffect(() => {
    if (parentState !== 'idle') {
      setLifecycle('interactive');
    }
  }, [parentState]);

  return (
    <div
      ref={containerRef}
      onClick={onSceneClick}
      className={`relative w-full h-full flex items-end justify-center select-none overflow-hidden ${className}`}
    >
      {/* 
        Safe, unclipped ViewBox: (0 0 500 480) with preserveAspectRatio="xMidYMax meet"
        - Characters span x=[40, 460] and y=[80, 470].
        - Generous 40px left/right margins and 80px top margin guarantee ZERO clipping.
        - Fixed ground baseline strictly sits at y=470.
      */}
      <motion.svg
        viewBox="0 0 500 480"
        preserveAspectRatio="xMidYMax meet"
        className="w-full h-full object-contain object-bottom drop-shadow-2xs overflow-hidden"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={
          parentState === 'error' && !shouldReduceMotion
            ? { x: [-3, 3, -3, 3, -1, 1, 0] }
            : {}
        }
        transition={{ type: 'tween', duration: 0.45, ease: 'easeInOut' }}
      >
        {/* ================= LAYER 1: TUPI (Purple Character - Background) ================= */}
        <TupiCharacter
          state={parentState}
          lifecycle={lifecycle}
          pointer={pointer}
          shouldReduceMotion={shouldReduceMotion}
        />

        {/* ================= LAYER 2: KURO (Black Character - Middle Peeker) ================= */}
        <KuroCharacter
          state={parentState}
          lifecycle={lifecycle}
          pointer={pointer}
          shouldReduceMotion={shouldReduceMotion}
        />

        {/* ================= LAYER 3: YUMI (Yellow Character - Middle-Right Arch & Arm) ================= */}
        <YumiCharacter
          state={parentState}
          lifecycle={lifecycle}
          pointer={pointer}
          shouldReduceMotion={shouldReduceMotion}
        />

        {/* ================= LAYER 4: ORU (Orange Character - Foreground Dome) ================= */}
        <OruCharacter
          state={parentState}
          lifecycle={lifecycle}
          pointer={pointer}
          shouldReduceMotion={shouldReduceMotion}
        />
      </motion.svg>
    </div>
  );
};

export default MascotScene;
