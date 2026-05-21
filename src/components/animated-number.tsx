"use client";
import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
  duration?: number;
}

export function AnimatedNumber({ value, suffix, duration = 900 }: AnimatedNumberProps) {
  const [displayed, setDisplayed] = useState(0);
  const raf = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // only animate on mount
    started.current = true;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(value * eased));
      if (progress < 1) {
        raf.current = requestAnimationFrame(tick);
      }
    };

    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{displayed.toLocaleString("fr-FR")}{suffix}</>;
}
