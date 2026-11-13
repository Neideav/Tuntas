"use client";

import React, { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * Animated Number Counter
 * Interpolates numeric changes smoothly using Motion's animate()
 * Reflects actual real-time state without artificial delays.
 */
export function AnimatedNumber({
  value,
  duration = 0.4,
  format = (n) => Math.round(n).toLocaleString(),
  prefix = "",
  suffix = "",
  className = "",
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const controls = animate(prevValueRef.current, value, {
      duration,
      ease: [0.2, 0.0, 0, 1.0],
      onUpdate: (latest) => {
        setDisplayValue(latest);
      },
    });

    prevValueRef.current = value;
    return () => controls.stop();
  }, [value, duration]);

  return <span className={className}>{prefix}{format(displayValue)}{suffix}</span>;
}

