'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook to track the Visual Viewport.
 * Useful for handling mobile keyboard open/close states and layout shifts.
 */
export function useVisualViewport() {
  const [viewport, setViewport] = useState({
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    offsetTop: 0,
    offsetLeft: 0,
    scale: 1,
    isKeyboardOpen: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    const handleResize = () => {
      const vv = window.visualViewport;
      if (!vv) return;

      // Detection heuristic: if the visual viewport height is significantly less than the layout height
      const isKeyboardPossiblyOpen = vv.height < window.innerHeight * 0.85;

      setViewport({
        height: vv.height,
        width: vv.width,
        offsetTop: vv.offsetTop,
        offsetLeft: vv.offsetLeft,
        scale: vv.scale,
        isKeyboardOpen: isKeyboardPossiblyOpen,
      });

      // Optional: Apply height as a CSS variable for easier use in CSS
      document.documentElement.style.setProperty('--visual-viewport-height', `${vv.height}px`);
      document.documentElement.style.setProperty('--visual-viewport-offset-top', `${vv.offsetTop}px`);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    
    // Initial call
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  return viewport;
}
