'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface PopoverRect {
  top: number;
  left: number;
  width: number;
  openUpward: boolean;
}

const GAP = 4;
const EST_HEIGHT = 320;

/**
 * Tracks an anchor element's screen position while a popover is open, so the
 * popover can be portaled to <body> and positioned with `fixed` coordinates —
 * this is what lets it escape any ancestor's `overflow-hidden`/`overflow-auto`
 * (a Drawer's scroll body, a table wrapped in `overflow-x-auto`, etc.), which
 * otherwise clips absolutely-positioned dropdowns.
 */
export function usePopoverPosition(anchorRef: React.RefObject<HTMLElement | null>, open: boolean) {
  const [rect, setRect] = useState<PopoverRect | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setRect(null);
      return;
    }
    function update() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      const openUpward = spaceBelow < EST_HEIGHT && spaceAbove > spaceBelow;
      setRect({
        top: openUpward ? r.top - GAP : r.bottom + GAP,
        left: r.left,
        width: r.width,
        openUpward,
      });
    }
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);

  return rect;
}

/** Portals children to document.body — SSR-safe (renders nothing until mounted). */
export function PopoverPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
