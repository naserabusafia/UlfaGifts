import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play } from 'lucide-react';
import type { ExperienceSection } from '../types/experience';
import { sectionMedia } from '../utils/sections';
import { ULFA_PATH } from '../PulseLogo';
import SectionHeading from './SectionHeading';
import './memory-sections.css';

const BAR_COUNT = 44;
const SEEK_STEP_SECONDS = 5;

// Stable placeholder bars until (or if) the audio can be decoded.
function seededPeaks(seed: string) {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507) ^ i;
    return .25 + ((hash >>> 0) % 1000) / 1000 * .75;
  });
}

function useWaveform(url: string | undefined, seed: string) {
  const fallback = useMemo(() => seededPeaks(seed), [seed]);
  const [decoded, setDecoded] = useState<{ url: string; peaks: number[] } | null>(null);
  useEffect(() => {
    if (!url) return;
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const controller = new AbortController();
    let context: AudioContext | null = null;
    fetch(url, { signal: controller.signal })
      .then((response) => response.arrayBuffer())
      .then((data) => { context = new AudioCtx(); return context.decodeAudioData(data); })
      .then((buffer) => {
        const samples = buffer.getChannelData(0);
        const size = Math.floor(samples.length / BAR_COUNT) || 1;
        const levels = Array.from({ length: BAR_COUNT }, (_, bar) => {
          let sum = 0;
          for (let i = bar * size; i < (bar + 1) * size && i < samples.length; i++) sum += samples[i] * samples[i];
          return Math.sqrt(sum / size);
        });
        const max = Math.max(...levels) || 1;
        if (!controller.signal.aborted) setDecoded({ url, peaks: levels.map((level) => .18 + .82 * (level / max)) });
      })
      .catch(() => undefined)
      .finally(() => { void context?.close().catch(() => undefined); });
    return () => controller.abort();
  }, [url]);
  return decoded && decoded.url === url ? decoded.peaks : fallback;
}

export default function VoiceNote({ section, language }: { section: ExperienceSection; language: 'ar' | 'en' }) {
  const { t } = useTranslation(undefined, { lng: language });
  const headingId = useId();
  const notes = useMemo(() => sectionMedia(section), [section]);
  const [selected, setSelected] = useState(0);
  const note = notes[selected] ?? notes[0];
  const audio = useRef<HTMLAudioElement>(null);
  const probing = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const peaks = useWaveform(note?.url, note?.id ?? '');
  const twoDigits = useMemo(() => new Intl.NumberFormat(language, { minimumIntegerDigits: 2 }), [language]);
  const plain = useMemo(() => new Intl.NumberFormat(language), [language]);
  const clock = (seconds: number) => {
    const whole = Math.max(0, Math.floor(seconds));
    return `${plain.format(Math.floor(whole / 60))}:${twoDigits.format(whole % 60)}`;
  };

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => { setTime(audio.current?.currentTime ?? 0); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  if (!note) return null;
  const progress = duration ? Math.min(1, time / duration) : 0;
  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => setPlaying(false));
    else element.pause();
  };
  const seekTo = (seconds: number) => {
    const element = audio.current;
    if (!element || !duration) return;
    element.currentTime = Math.max(0, Math.min(duration, seconds));
    setTime(element.currentTime);
  };
  const seekPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    seekTo(((event.clientX - rect.left) / rect.width) * duration);
  };
  const seekKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowRight: SEEK_STEP_SECONDS, ArrowUp: SEEK_STEP_SECONDS,
      ArrowLeft: -SEEK_STEP_SECONDS, ArrowDown: -SEEK_STEP_SECONDS };
    if (event.key in moves) { event.preventDefault(); seekTo(time + moves[event.key]); }
    else if (event.key === 'Home') { event.preventDefault(); seekTo(0); }
    else if (event.key === 'End') { event.preventDefault(); seekTo(duration); }
  };
  const choose = (index: number) => {
    audio.current?.pause();
    setSelected(index); setTime(0); setDuration(0);
  };

  return <section className={`memory-section memory-section--light voice-note${playing ? ' is-playing' : ''}`}
    aria-labelledby={section.title ? headingId : undefined} aria-label={section.title ? undefined : t('memorySections.voiceNote')}>
    <SectionHeading section={section} id={headingId} language={language} />
    <div className="voice-note__body">
      <div className="voice-note__turntable" aria-hidden="true">
        <div className="voice-note__record">
          <span className="voice-note__label">
            <svg viewBox="-2 -2 131.5 86.5"><path d={ULFA_PATH} /></svg>
          </span>
        </div>
        <svg className="voice-note__arm" viewBox="0 0 100 140">
          <circle cx="12" cy="10" r="9" className="voice-note__arm-base" />
          <circle cx="12" cy="10" r="3.5" className="voice-note__arm-pin" />
          <path d="M12 10 L40 95 Q44 112 60 122" className="voice-note__arm-rod" />
          <rect x="54" y="116" width="16" height="11" rx="2" transform="rotate(30 62 121)" className="voice-note__arm-head" />
        </svg>
      </div>
      <div className="voice-note__player" dir="ltr">
        <button type="button" className="voice-note__play" onClick={toggle}
          aria-label={playing ? t('memorySections.pause') : t('memorySections.play')}>
          {playing ? <Pause /> : <Play />}
        </button>
        <div className="voice-note__wave" role="slider" tabIndex={0} aria-label={t('memorySections.position')}
          aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(time)}
          aria-valuetext={`${clock(time)} / ${clock(duration)}`} onPointerDown={seekPointer} onKeyDown={seekKey}>
          {peaks.map((peak, i) => <span key={i} className={i / BAR_COUNT < progress ? 'is-played' : undefined}
            style={{ height: `${Math.round(peak * 100)}%` }} />)}
        </div>
        <span className="voice-note__time">{clock(playing || time ? time : duration)}</span>
      </div>
      {notes.length > 1 && <div className="voice-note__list" role="group" aria-label={t('memorySections.voiceNotes')}>
        {notes.map((item, index) => <button key={item.id} type="button" aria-pressed={index === selected}
          onClick={() => choose(index)}>
          {item.caption || t('memorySections.voiceNumber', { number: plain.format(index + 1) })}
        </button>)}
      </div>}
      <audio ref={audio} src={note.url} preload="metadata"
        onLoadedMetadata={(event) => {
          const element = event.currentTarget;
          // Browser recordings (WebM) carry no duration; seeking past the end makes it known.
          if (Number.isFinite(element.duration)) setDuration(element.duration);
          else { probing.current = true; element.currentTime = 1e101; }
        }}
        onDurationChange={(event) => {
          const element = event.currentTarget;
          if (!probing.current || !Number.isFinite(element.duration)) return;
          probing.current = false;
          setDuration(element.duration);
          element.currentTime = 0;
        }}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => { if (!probing.current) setTime(event.currentTarget.currentTime); }}
        onEnded={(event) => { setPlaying(false); event.currentTarget.currentTime = 0; setTime(0); }} />
    </div>
  </section>;
}
