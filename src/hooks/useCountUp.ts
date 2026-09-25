"use client";

import { useEffect, useRef, useState } from "react";

interface UseCountUpOptions {
  duration?: number; // ms
  delay?: number; // ms
  decimals?: number;
}

/**
 * Animates from 0 (or last value) to `target`, easing with cubic-out.
 * Respects `prefers-reduced-motion` — returns the target directly.
 */
export function useCountUp(target: number, options: UseCountUpOptions = {}): number {
  const { duration = 900, delay = 0, decimals = 0 } = options;
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      setValue(target);
      return;
    }
    const prefersReduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (prefersReduced || !Number.isFinite(target)) {
      setValue(target);
      return;
    }

    fromRef.current = value;
    startedAt.current = null;
    const factor = Math.pow(10, decimals);

    const tick = (now: number) => {
      if (startedAt.current === null) startedAt.current = now + delay;
      const elapsed = now - startedAt.current;
      if (elapsed < 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setValue(Math.round(next * factor) / factor);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, delay, decimals]);

  return value;
}
