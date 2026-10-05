import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

function useOverlay(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);
}

/** A sheet that rises from the bottom (centered dialog on wide screens). */
export function Sheet({ label, onClose, children, dir, lang }: {
  label: string; onClose: () => void; children: React.ReactNode; dir: 'rtl' | 'ltr'; lang: string;
}) {
  useOverlay(onClose);
  return createPortal(<div className="s-page s-sheet-back" dir={dir} lang={lang} style={{ minHeight: 0, background: undefined }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="s-sheet" role="dialog" aria-modal="true" aria-label={label}>
      <div className="s-sheet__grip" aria-hidden="true" />
      {children}
    </div>
  </div>, document.body);
}

/** Full screen: a section or the envelope at its real size. */
export function Viewer({ title, closeLabel, onClose, children }: {
  title: string; closeLabel: string; onClose: () => void; children: React.ReactNode;
}) {
  useOverlay(onClose);
  return createPortal(<div className="s-page s-viewer" role="dialog" aria-modal="true" aria-label={title} style={{ minHeight: 0 }}>
    <div className="s-viewer__bar">
      <strong>{title}</strong>
      <button type="button" onClick={onClose} aria-label={closeLabel}><X /></button>
    </div>
    <div className="s-viewer__body">{children}</div>
  </div>, document.body);
}
