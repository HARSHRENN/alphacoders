import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/** GSAP stays in the web bundle; Android uses the native sibling component. */
export function MotionView({ children }: { children: React.ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        element.current,
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.24,
          ease: 'power2.out',
          clearProps: 'opacity,transform',
        },
      );
    });
    return () => media.revert();
  }, []);
  return (
    <div ref={element} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {children}
    </div>
  );
}
