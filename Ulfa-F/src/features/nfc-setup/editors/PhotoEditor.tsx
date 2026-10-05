import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Plus } from 'lucide-react';
import type { SetupCopy } from '../copy';
import { SECTION_LIMITS } from '../draftStore';
import type { DraftState, DraftStore } from '../draftStore';
import { liveSectionFor } from '../draftView';
import LiveSection from '../components/LiveSection';
import MediaGrid from './MediaGrid';
import MediaSheet from './MediaSheet';

const EMPTY: Record<string, 'emptyWheel' | 'emptyFilm'> = { photo_wheel: 'emptyWheel', film_strip: 'emptyFilm' };

/**
 * Photos go straight onto the real section (the wheel, the film, the
 * calendar), so what's being built is always what they'll see.
 */
export default function PhotoEditor({ copy, draft, store, sectionKey }: {
  copy: SetupCopy; draft: DraftState; store: DraftStore; sectionKey: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const pendingDay = useRef<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [dropping, setDropping] = useState(false);
  const isCalendar = sectionKey === 'memory_calendar';
  const isWheel = sectionKey === 'photo_wheel';
  const items = draft.media.filter((m) => m.sectionKey === sectionKey);
  const full = items.length >= SECTION_LIMITS[sectionKey].max;
  const live = liveSectionFor(draft, sectionKey);
  const dayFormat = new Intl.DateTimeFormat(draft.language, { day: 'numeric', month: 'short' });

  const add = (files: File[]) => {
    if (!files.length) return;
    const added = store.addFiles(sectionKey, files, isCalendar ? pendingDay.current : null);
    setNotice(added < files.length ? copy.limitReached : '');
    pendingDay.current = null;
  };
  const pick = (day: string | null = null) => { pendingDay.current = day; input.current?.click(); };

  const addRef = useRef(add);
  useEffect(() => { addRef.current = add; });

  // Photos dropped anywhere on the page (desktop) land in this section.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
    const enter = (e: DragEvent) => { if (hasFiles(e)) { depth++; setDropping(true); } };
    const leave = (e: DragEvent) => { if (hasFiles(e) && --depth <= 0) { depth = 0; setDropping(false); } };
    const over = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; setDropping(false);
      addRef.current([...(e.dataTransfer?.files ?? [])]);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const plus = <button type="button" className="s-wheel-add" onClick={() => pick()} disabled={full}
    aria-label={items.length ? copy.addMore : copy.addPhotos}><Plus aria-hidden="true" /></button>;
  const openIndex = items.findIndex((m) => m.key === open);
  const move = (delta: number) => {
    const keys = items.map((m) => m.key);
    const [key] = keys.splice(openIndex, 1);
    keys.splice(openIndex + delta, 0, key);
    store.reorder(sectionKey, keys);
  };

  return <div className="s-editor">
    {items.length || isCalendar
      ? <div className="s-live-frame">
        <LiveSection section={live} language={draft.language} theme={draft.theme} occasion={draft.occasion}
          centerAction={isWheel ? plus : undefined} onAddDay={isCalendar ? (day) => pick(day) : undefined} />
      </div>
      : isWheel
        ? <div className="s-empty s-empty--static"><span className="s-empty__disk">{plus}</span><span>{copy.emptyWheel}</span></div>
        : <button type="button" className="s-empty" onClick={() => pick()}><ImagePlus aria-hidden="true" /><span>{copy[EMPTY[sectionKey]]}</span></button>}

    {isCalendar && <p className="s-note">{copy.calendarTip}</p>}
    <div className="s-toolbar">
      <button type="button" className="s-btn s-btn--line s-btn--small" disabled={full} onClick={() => pick()}>
        <ImagePlus aria-hidden="true" /> {isCalendar ? copy.addByDate : items.length ? copy.addMore : copy.addPhotos}
      </button>
      <span className="s-count" style={{ marginInlineStart: 'auto' }}>{copy.photosCount(items.length)}</span>
    </div>
    {(notice || full) && <p className="s-note" role="status">{notice || copy.limitReached}</p>}

    {items.length > 0 && <>
      <MediaGrid items={items} onOpen={setOpen} onReorder={(keys) => store.reorder(sectionKey, keys)}
        onAdd={() => pick()} addLabel={copy.addMore} addDisabled={full}
        badge={isCalendar ? (m) => (m.memoryDate ? dayFormat.format(new Date(`${m.memoryDate}T00:00:00`)) : null) : undefined} />
      <p className="s-note">{copy.holdToMove}</p>
    </>}

    <input ref={input} type="file" accept="image/*" multiple hidden
      onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ''; }} />
    {open && openIndex >= 0 && <MediaSheet copy={copy} store={store} item={items[openIndex]} index={openIndex} count={items.length}
      withDate={isCalendar} language={draft.language} onMove={move} onClose={() => setOpen(null)} />}
    {dropping && <div className="s-drop">{copy.dropHere}</div>}
  </div>;
}
