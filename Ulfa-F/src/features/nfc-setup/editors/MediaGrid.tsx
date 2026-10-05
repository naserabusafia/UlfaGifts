import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import type { DraftMedia } from '../draftStore';

const LONG_PRESS_MS = 320;
const MOUSE_SLOP = 6;
const TOUCH_SLOP = 8;

type Drag = { key: string; order: string[]; x: number; y: number; w: number; h: number; src: string };

/**
 * Photos as a grid. Tap opens one; hold and drag moves it (on touch a long
 * press, so a normal swipe still scrolls the page).
 */
export default function MediaGrid({ items, onOpen, onReorder, onAdd, addLabel, addDisabled, badge }: {
  items: DraftMedia[]; onOpen: (key: string) => void; onReorder: (keys: string[]) => void;
  onAdd: () => void; addLabel: string; addDisabled: boolean; badge?: (item: DraftMedia) => string | null;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const cleanup = useRef<() => void>(() => undefined);
  useEffect(() => () => cleanup.current(), []);

  const byKey = new Map(items.map((m) => [m.key, m]));
  const keys = drag?.order ?? items.map((m) => m.key);

  const update = (next: Drag | null) => { dragRef.current = next; setDrag(next); };

  const begin = (event: React.PointerEvent<HTMLButtonElement>, item: DraftMedia) => {
    if (event.button !== 0) return;
    const tile = event.currentTarget.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY };
    const offset = { x: event.clientX - tile.left, y: event.clientY - tile.top };
    const touch = event.pointerType !== 'mouse';
    let started = false;
    let timer = 0;

    const lift = (x: number, y: number) => {
      started = true;
      suppressClick.current = true;
      navigator.vibrate?.(10);
      update({ key: item.key, order: items.map((m) => m.key), x: x - offset.x, y: y - offset.y,
        w: tile.width, h: tile.height, src: item.thumbnailUrl });
    };
    const move = (e: PointerEvent) => {
      const distance = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (!started) {
        if (touch) { if (distance > TOUCH_SLOP) end(); return; } // a scroll, not a drag
        if (distance < MOUSE_SLOP) return;
        lift(e.clientX, e.clientY);
      }
      const current = dragRef.current;
      if (!current) return;
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-tile]')?.dataset.tile;
      let order = current.order;
      if (over && over !== current.key) {
        order = order.filter((k) => k !== current.key);
        order.splice(current.order.indexOf(over), 0, current.key);
      }
      update({ ...current, order, x: e.clientX - offset.x, y: e.clientY - offset.y });
    };
    const blockScroll = (e: TouchEvent) => { if (started) e.preventDefault(); };
    const end = () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
      document.removeEventListener('touchmove', blockScroll);
      cleanup.current = () => undefined;
      const current = dragRef.current;
      if (started && current) {
        const original = items.map((m) => m.key);
        if (current.order.some((k, i) => k !== original[i])) onReorder(current.order);
      }
      update(null);
      // Let the click that follows a drag be ignored.
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    };
    if (touch) timer = window.setTimeout(() => lift(start.x, start.y), LONG_PRESS_MS);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    document.addEventListener('touchmove', blockScroll, { passive: false });
    cleanup.current = end;
  };

  return <>
    <ul className="s-grid">
      {keys.map((key) => {
        const item = byKey.get(key);
        if (!item) return null;
        const busy = item.status === 'processing' || item.status === 'uploading';
        const label = badge?.(item);
        return <li key={key}>
          <button type="button" className={`s-tile${drag?.key === key ? ' is-lifted' : ''}`} data-tile={key}
            onPointerDown={(e) => begin(e, item)} onContextMenu={(e) => e.preventDefault()}
            onClick={() => { if (!suppressClick.current) onOpen(key); }}
            aria-label={item.caption || label || undefined}>
            <img src={item.thumbnailUrl} alt="" loading="lazy" decoding="async" draggable={false} />
            {busy && <span className="s-tile__state"><span className="s-spinner" /></span>}
            {item.status === 'error' && <span className="s-tile__state is-error"><AlertCircle /></span>}
            {label && <span className="s-tile__badge">{label}</span>}
          </button>
        </li>;
      })}
      <li>
        <button type="button" className="s-tile s-tile--add" onClick={onAdd} disabled={addDisabled} aria-label={addLabel}>
          <Plus aria-hidden="true" />
        </button>
      </li>
    </ul>
    {drag && <div className="s-ghost" style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }} aria-hidden="true">
      <img src={drag.src} alt="" />
    </div>}
  </>;
}
