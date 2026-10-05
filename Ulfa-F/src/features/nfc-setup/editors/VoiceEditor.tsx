import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FileAudio, Mic, Square, Trash2 } from 'lucide-react';
import type { SetupCopy } from '../copy';
import { MAX_AUDIO_BYTES, SECTION_LIMITS } from '../draftStore';
import type { DraftState, DraftStore } from '../draftStore';
import { liveSectionFor } from '../draftView';
import LiveSection from '../components/LiveSection';
import { audioDuration, MAX_RECORDING_SECONDS, micPermission, startRecording } from '../media/recorder';
import type { MicPermission, Recording } from '../media/recorder';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** Record (the browser asks for the microphone) or use a file; heard on the real record player. */
export default function VoiceEditor({ copy, draft, store }: { copy: SetupCopy; draft: DraftState; store: DraftStore }) {
  const [permission, setPermission] = useState<MicPermission | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const stopRef = useRef<() => void>(() => undefined);
  const items = draft.media.filter((m) => m.sectionKey === 'voice_note');
  const full = items.length >= SECTION_LIMITS.voice_note.max;

  useEffect(() => { void micPermission().then(setPermission); }, []);
  useEffect(() => () => recording?.cancel(), [recording]);
  useEffect(() => {
    if (!recording) return;
    const started = performance.now();
    let frame = 0;
    const tick = () => { setElapsed((performance.now() - started) / 1000); setLevel(recording.level()); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [recording]);

  const stop = async () => {
    if (!recording) return;
    const result = await recording.stop();
    setRecording(null);
    if (!store.addAudio(result.blob, result.mime, copy.noteFallback(items.length + 1))) setNotice(copy.audioTooBig);
  };
  useEffect(() => { stopRef.current = () => { void stop(); }; });

  const record = async () => {
    setNotice('');
    try {
      setRecording(await startRecording(() => stopRef.current()));
      setPermission('granted');
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      setPermission(denied ? 'denied' : 'unsupported');
    }
  };

  const pick = async (file?: File) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    if (file.size > MAX_AUDIO_BYTES) return setNotice(copy.audioTooBig);
    const duration = await audioDuration(file);
    if (duration !== null && duration > MAX_RECORDING_SECONDS + 1) return setNotice(copy.audioTooLong);
    setNotice('');
    store.addAudio(file, file.type || 'audio/mpeg', file.name.replace(/\.[^.]+$/, '').slice(0, 40));
  };
  const move = (index: number, delta: number) => {
    const keys = items.map((m) => m.key);
    const [key] = keys.splice(index, 1);
    keys.splice(index + delta, 0, key);
    store.reorder('voice_note', keys);
  };

  return <div className="s-editor">
    {items.length
      ? <div className="s-live-frame"><LiveSection section={liveSectionFor(draft, 'voice_note')}
          language={draft.language} theme={draft.theme} occasion={draft.occasion} /></div>
      : <div className="s-empty s-empty--static"><Mic aria-hidden="true" /><span>{copy.emptyVoice}</span></div>}

    {recording
      ? <div className="s-recorder" role="status">
        <span className="s-recorder__dot" style={{ transform: `scale(${1 + level * 0.9})` }} aria-hidden="true" />
        <span>{copy.recordingFor(clock(elapsed))} / {clock(MAX_RECORDING_SECONDS)}</span>
        <button type="button" className="s-btn s-btn--small" onClick={() => void stop()}><Square aria-hidden="true" /> {copy.stopRecording}</button>
      </div>
      : <div className="s-toolbar">
        <button type="button" className="s-btn s-btn--small" onClick={() => void record()} disabled={full || permission === 'unsupported'}>
          <Mic aria-hidden="true" /> {copy.record}</button>
        <button type="button" className="s-btn s-btn--line s-btn--small" onClick={() => input.current?.click()} disabled={full}>
          <FileAudio aria-hidden="true" /> {copy.chooseFile}</button>
        <span className="s-count" style={{ marginInlineStart: 'auto' }}>{items.length} / {SECTION_LIMITS.voice_note.max}</span>
        <input ref={input} type="file" accept="audio/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
      </div>}
    {permission === 'prompt' && !recording && <p className="s-note">{copy.micIntro}</p>}
    {permission === 'denied' && <p className="s-error" role="alert" style={{ fontWeight: 400 }}>{copy.micDenied}</p>}
    {permission === 'unsupported' && <p className="s-note">{copy.micUnsupported}</p>}
    {(notice || full) && <p className="s-note" role="status">{notice || copy.limitReached}</p>}

    {items.length > 0 && <ul className="s-notes">
      {items.map((item, index) => <li key={item.key} className={`s-note-row${item.status === 'ready' ? '' : ' is-busy'}`}>
        <input className="s-input" style={{ minHeight: 44 }} value={item.caption} maxLength={40} aria-label={copy.noteName}
          placeholder={copy.noteNamePlaceholder} onChange={(e) => store.setCaption(item.key, e.target.value)} />
        <span style={{ display: 'flex' }}>
          <button type="button" className="s-iconbtn" disabled={index === 0} onClick={() => move(index, -1)} aria-label={copy.moveEarlier}><ArrowUp /></button>
          <button type="button" className="s-iconbtn" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label={copy.moveLater}><ArrowDown /></button>
          <button type="button" className="s-iconbtn is-danger" onClick={() => store.remove(item.key)} aria-label={copy.remove}><Trash2 /></button>
        </span>
        <audio src={item.url} controls preload="metadata" />
        {item.status === 'error' && <button type="button" className="s-link" onClick={() => store.retry(item.key)}>{copy.failed} · {copy.retryUpload}</button>}
      </li>)}
    </ul>}
  </div>;
}
