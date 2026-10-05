import { useId } from 'react';
import type { SetupCopy } from '../copy';
import type { DraftMedia, DraftStore } from '../draftStore';
import { Sheet } from '../components/Overlays';

/** One photo, large: its words, its day, its place, or remove it. */
export default function MediaSheet({ copy, store, item, index, count, withDate, language, onMove, onClose }: {
  copy: SetupCopy; store: DraftStore; item: DraftMedia; index: number; count: number; withDate: boolean;
  language: 'ar' | 'en'; onMove: (delta: number) => void; onClose: () => void;
}) {
  const id = useId();
  return <Sheet label={item.caption || copy.caption} onClose={onClose} dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
    <img className="s-sheet__photo" src={item.url} alt="" />
    <div className="s-sheet__body">
      <div className="s-field">
        <label className="s-label" htmlFor={`${id}-caption`}>{copy.caption}</label>
        <input id={`${id}-caption`} className="s-input" value={item.caption} maxLength={200}
          placeholder={copy.captionPlaceholder} onChange={(e) => store.setCaption(item.key, e.target.value)} />
      </div>
      {withDate && <div className="s-field">
        <label className="s-label" htmlFor={`${id}-day`}>{copy.memoryDate}</label>
        <input id={`${id}-day`} className="s-input" type="date" value={item.memoryDate ?? ''}
          onChange={(e) => e.target.value && store.setMemoryDate(item.key, e.target.value)} />
      </div>}
      {item.status === 'error' && <div className="s-sheet__row">
        <span className="s-error">{copy.failed}</span>
        <button type="button" className="s-link" onClick={() => store.retry(item.key)}>{copy.retryUpload}</button>
      </div>}
      <div className="s-sheet__row">
        {!withDate && <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="s-btn s-btn--line s-btn--small" disabled={index === 0} onClick={() => onMove(-1)}>{copy.moveEarlier}</button>
          <button type="button" className="s-btn s-btn--line s-btn--small" disabled={index === count - 1} onClick={() => onMove(1)}>{copy.moveLater}</button>
        </div>}
        <button type="button" className="s-text s-danger" onClick={() => { store.remove(item.key); onClose(); }}>{copy.remove}</button>
      </div>
      <button type="button" className="s-btn" onClick={onClose}>{copy.done}</button>
    </div>
  </Sheet>;
}
