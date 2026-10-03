import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

const DRAG_THRESHOLD = 9;

export function useHorizontalDrag(onRelease: (distance: number) => void) {
  const [distance, setDistance] = useState(0);
  const gesture = useRef<{ id: number; x: number; y: number; dx: number; dragging: boolean; target: HTMLElement } | null>(null);
  const frame = useRef(0);
  const suppressClick = useRef(false);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const finish = (event: ReactPointerEvent<HTMLElement>, cancelled = false) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    setDistance(0);
    if (current.target.hasPointerCapture(current.id)) current.target.releasePointerCapture(current.id);
    if (current.dragging) {
      suppressClick.current = true;
      if (!cancelled) onRelease(current.dx);
    }
  };

  return {
    distance,
    handlers: {
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (!event.isPrimary || event.button !== 0 || gesture.current) return;
        suppressClick.current = false;
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dragging: false, target: event.currentTarget };
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        const current = gesture.current;
        if (!current || current.id !== event.pointerId) return;
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;
        if (!current.dragging) {
          if (Math.abs(dy) > DRAG_THRESHOLD && Math.abs(dy) > Math.abs(dx)) { gesture.current = null; return; }
          if (Math.abs(dx) < DRAG_THRESHOLD) return;
          current.dragging = true;
          current.target.setPointerCapture(event.pointerId);
        }
        current.dx = dx;
        event.preventDefault();
        if (!frame.current) frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          setDistance(current.dx);
        });
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => finish(event),
      onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => finish(event, true),
      // Touch starts with implicit capture on the image. Transferring capture to
      // the drag surface also bubbles a lost-capture event from that image.
      onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.target === event.currentTarget) finish(event, true);
      },
      onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
        if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
      },
    },
  };
}
