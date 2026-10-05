import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { angularDelta, DRAG_ANGLE_THRESHOLD, DRAG_PIXEL_THRESHOLD, HOLE_RATIO, releaseSlots } from '../utils/wheel';

type Gesture = { id: number; x: number; y: number; cx: number; cy: number; angle: number;
  rotation: number; travel: number; time: number; velocity: number; dragging: boolean;
  target: HTMLElement; clickTarget: HTMLButtonElement | null };

export function useCircularDrag(onRelease: (slots: number) => void) {
  const [motion, setMotion] = useState({ rotation: 0, dragging: false });
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef(0);
  const suppressClick = useRef(false);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const finish = (event: ReactPointerEvent<HTMLElement>, cancelled = false) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null;
    cancelAnimationFrame(frame.current); frame.current = 0;
    if (current.target.hasPointerCapture(current.id)) current.target.releasePointerCapture(current.id);
    suppressClick.current = true;
    setMotion({ rotation: 0, dragging: false });
    if (cancelled) return;
    if (current.dragging) onRelease(releaseSlots(current.rotation, performance.now() - current.time < 100 ? current.velocity : 0));
    // Capture redirects the native click to the reel. Dispatch the original
    // button's click once, then suppress the native duplicate.
    else current.clickTarget?.click();
  };

  return { ...motion, handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (!event.isPrimary || event.button !== 0 || gesture.current) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      if (Math.hypot(event.clientX - cx, event.clientY - cy) < bounds.width * HOLE_RATIO / 2) return;
      suppressClick.current = false;
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, cx, cy,
        angle: Math.atan2(event.clientY - cy, event.clientX - cx) * 180 / Math.PI,
        rotation: 0, travel: 0, time: performance.now(), velocity: 0, dragging: false,
        target: event.currentTarget, clickTarget: event.target instanceof Element ? event.target.closest('button') : null };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const current = gesture.current;
      if (!current || current.id !== event.pointerId) return;
      const angle = Math.atan2(event.clientY - current.cy, event.clientX - current.cx) * 180 / Math.PI;
      const delta = angularDelta(angle, current.angle);
      const now = performance.now();
      current.velocity = .65 * delta / Math.max(1, now - current.time) + .35 * current.velocity;
      current.angle = angle; current.time = now;
      current.rotation += delta; current.travel += Math.abs(delta);
      current.dragging ||= current.travel >= DRAG_ANGLE_THRESHOLD || Math.hypot(event.clientX - current.x, event.clientY - current.y) >= DRAG_PIXEL_THRESHOLD;
      if (!current.dragging) return;
      event.preventDefault();
      if (!frame.current) frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        setMotion({ rotation: current.rotation, dragging: true });
      });
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => finish(event),
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => finish(event, true),
    onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) => { if (event.target === event.currentTarget) finish(event, true); },
    onClickCapture: (event: ReactMouseEvent<HTMLElement>) => {
      if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
    },
  } };
}
