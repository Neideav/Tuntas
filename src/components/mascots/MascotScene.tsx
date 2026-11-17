'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion } from 'motion/react';
import { MascotState, NormalizedPointer } from './types';
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
  const [isIntroComplete, setIsIntroComplete] = useState(false);

  // High-performance Motion Values for pointer coordinates
  // Direct DOM transform updates: 0 React re-renders on mousemove!
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

  // Coordinated entrance animation on first page load
  useEffect(() => {
    if (shouldReduceMotion) {
      setIsIntroComplete(true);
      return;
    }

    const timer = setTimeout(() => {
      setIsIntroComplete(true);
    }, 750);

    return () => clearTimeout(timer);
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

        // Calculate proximity to authentication form (right side of canvas)
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

  // If intro has not yet completed, state is 'intro', otherwise active form state
  const activeState = !isIntroComplete && !shouldReduceMotion ? 'intro' : parentState;

  return (
    <div
      ref={containerRef}
      onClick={onSceneClick}
      className={`relative w-full h-full flex items-end justify-center select-none overflow-hidden ${className}`}
    >
      <motion.svg
        viewBox="0 0 540 470"
        className="w-full h-auto max-h-[520px] drop-shadow-2xs"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={
          activeState === 'error' && !shouldReduceMotion
            ? { x: [-3, 3, -3, 3, -1, 1, 0] }
            : {}
        }
        transition={{ duration: 0.45 }}
      >
        {/* ================= LAYER 1: TUPI (Purple Character - Background) ================= */}
        <TupiCharacter
          state={activeState}
          pointer={pointer}
          isIntroComplete={isIntroComplete}
          shouldReduceMotion={shouldReduceMotion}
        />

        {/* ================= LAYER 2: KURO (Black Character - Middle Peeker) ================= */}
        <KuroCharacter
          state={activeState}
          pointer={pointer}
          isIntroComplete={isIntroComplete}
          shouldReduceMotion={shouldReduceMotion}
        />

        {/* ================= LAYER 3: YUMI (Yellow Character - Middle-Right Arch & Arm) ================= */}
        <YumiCharacter
          state={activeState}
          pointer={pointer}
          isIntroComplete={isIntroComplete}
          shouldReduceMotion={shouldReduceMotion}
        />

        {/* ================= LAYER 4: ORU (Orange Character - Foreground Dome) ================= */}
        <OruCharacter
          state={activeState}
          pointer={pointer}
          isIntroComplete={isIntroComplete}
          shouldReduceMotion={shouldReduceMotion}
        />
      </motion.svg>
    </div>
  );
};

export default MascotScene;
