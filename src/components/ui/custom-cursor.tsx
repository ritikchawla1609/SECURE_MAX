'use client';

import * as React from 'react';

export function CustomCursor() {
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const isEnabled = localStorage.getItem('securemax_cursor_halo') === 'true';
    if (!isEnabled) return;

    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!hasFinePointer || prefersReducedMotion) {
      return;
    }

    setMounted(true);

    const onMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest('button') ||
          target.closest('a') ||
          target.closest('[role="button"]') ||
          target.closest('input') ||
          target.closest('select') ||
          target.closest('textarea'))
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    const onMouseLeave = () => setIsVisible(false);
    const onMouseEnter = () => setIsVisible(true);

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
    };
  }, [isVisible]);

  if (!mounted || !isVisible) return null;

  return (
    <div
      className="pointer-events-none fixed z-[9999] transition-transform duration-75 ease-out -translate-x-1/2 -translate-y-1/2 will-change-transform"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div
        className={`rounded-full border transition-all duration-150 ${
          isHovering
            ? 'w-8 h-8 border-blue-400 bg-blue-500/15 scale-105'
            : 'w-6 h-6 border-blue-400/40 bg-blue-500/5 scale-100'
        }`}
      />
    </div>
  );
}
