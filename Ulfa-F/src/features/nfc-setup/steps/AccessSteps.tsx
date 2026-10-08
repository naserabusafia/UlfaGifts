import { useId, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import sealImg from '../../../components/EnvelopeLetter/seal.png';
import { normalizeSecret, secretProblem } from '../../nfc-experience/crypto/secret';
import type { SecretType } from '../../nfc-experience/crypto/secret';
import { generateRecoveryCode } from '../../nfc-experience/crypto/keys';
import type { SetupCopy } from '../copy';
import SecretField from '../components/SecretField';

export type SecretChoice = { type: SecretType; prompt: string; normalized: string };
export type GiftLanguage = 'ar' | 'en';

export function Intro({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  return <header className="s-intro">
    <p className="s-eyebrow">{eyebrow}</p>
    <h1 className="s-title">{title}</h1>
    {lede && <p className="s-lede">{lede}</p>}
  </header>;
}

export function WelcomeStep({ copy, language, onLanguage, onStart }: {
  copy: SetupCopy; language: GiftLanguage; onLanguage: (language: GiftLanguage) => void; onStart: () => void;
}) {
  return <section>
    <img className="s-seal" src={sealImg} alt="" />
    <Intro eyebrow={copy.welcomeEyebrow} title={copy.welcomeTitle} lede={copy.welcomeBody} />
    <div className="s-field">
      <span className="s-label" id="gift-language">{copy.giftLanguage}</span>
      <div className="s-segment" role="group" aria-labelledby="gift-language">
        <button type="button" aria-pressed={language === 'ar'} onClick={() => onLanguage('ar')} lang="ar">العربية</button>
        <button type="button" aria-pressed={language === 'en'} onClick={() => onLanguage('en')} lang="en">English</button>
      </div>
    </div>
    <p className="s-privacy"><LockKeyhole aria-hidden="true" /> {copy.welcomePrivacy}</p>
    <div className="s-actions">
      <button type="button" className="s-btn" onClick={onStart}>{copy.start}</button>
    </div>
  </section>;
}

export function LockStep({ copy, isNew, onBack, onDone, busy, error }: {
  copy: SetupCopy; isNew: boolean; onBack?: () => void; onDone: (choice: SecretChoice) => void; busy?: boolean; error?: string;
}) {
  const [type, setType] = useState<SecretType>('PIN');
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [again, setAgain] = useState('');
  const [problem, setProblem] = useState('');
  const ids = useId();
  const choose = (next: SecretType) => { setType(next); setAnswer(''); setAgain(''); setProblem(''); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeSecret(type, answer);
    const issue = secretProblem(type, normalized);
    if (type === 'TEXT' && !prompt.trim()) return setProblem(copy.problems.required);
    if (issue) return setProblem(copy.problems[issue]);
    if (normalized !== normalizeSecret(type, again)) return setProblem(copy.mismatch);
    onDone({ type, prompt: prompt.trim(), normalized });
  };
  const shown = problem || error;
  return <form onSubmit={submit} noValidate>
    <Intro eyebrow={copy.lockEyebrow} title={isNew ? copy.lockTitle : copy.changeLockTitle} lede={copy.lockBody} />
    <div className="s-fields">
      <div>
        <div className="s-tabs" role="tablist" aria-label={copy.lockTitle}>
          {(['PIN', 'DATE', 'TEXT'] as const).map((option) =>
            <button key={option} type="button" role="tab" className="s-tab" aria-selected={type === option}
              onClick={() => choose(option)}>{copy.types[option]}</button>)}
        </div>
        <p className="s-note" style={{ marginTop: 10 }}>{copy.typeHints[type]}</p>
      </div>
      <div className="s-field">
        <label className="s-label" htmlFor={`${ids}-prompt`}>
          {type === 'TEXT' ? copy.question : <>{copy.hint} <small>· {copy.optional}</small></>}
        </label>
        <input id={`${ids}-prompt`} className="s-input" maxLength={200} value={prompt}
          placeholder={type === 'TEXT' ? copy.questionPlaceholder : copy.hintPlaceholder}
          onChange={(e) => { setPrompt(e.target.value); setProblem(''); }} />
      </div>
      <div className="s-two">
        <SecretField type={type} id={`${ids}-answer`} label={type === 'PIN' ? copy.pin : type === 'DATE' ? copy.date : copy.answer}
          value={answer} onChange={(v) => { setAnswer(v); setProblem(''); }} invalid={!!shown} />
        <SecretField type={type} id={`${ids}-again`} label={type === 'PIN' ? copy.pinAgain : copy.answerAgain}
          value={again} onChange={(v) => { setAgain(v); setProblem(''); }} invalid={!!shown} />
      </div>
      {type === 'TEXT' && <p className="s-note">{copy.answerNote}</p>}
      {shown && <p className="s-error" role="alert">{shown}</p>}
    </div>
    <div className="s-actions">
      {onBack && <button type="button" className="s-text" onClick={onBack}>{copy.back}</button>}
      <button type="submit" className="s-btn" disabled={busy}>{busy ? copy.securing : isNew ? copy.continue : copy.lockGift}</button>
    </div>
  </form>;
}

export function KeepStep({ copy, busy, error, onBack, onConfirm }: {
  copy: SetupCopy; busy: boolean; error: string; onBack: () => void; onConfirm: (recoveryCode: string) => void;
}) {
  const [code] = useState(generateRecoveryCode);
  const [agreed, setAgreed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { /* clipboard blocked: the code stays selectable */ }
  };
  const save = () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`Ulfa — ${copy.keepTitle}\n${code}\n`], { type: 'text/plain' }));
    link.download = 'ulfa-spare-key.txt';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  return <section>
    <Intro eyebrow={copy.keepEyebrow} title={copy.keepTitle} lede={copy.keepBody} />
    <div className="s-ticket">
      <code data-testid="recovery-code">{code}</code>
      <div className="s-ticket__tools">
        <button type="button" className="s-link" onClick={copyCode}>{copied ? copy.copied : copy.copy}</button>
        <button type="button" className="s-link" onClick={save}>{copy.download}</button>
      </div>
    </div>
    <p className="s-note" style={{ marginTop: 10, textAlign: 'center' }}>{copy.screenshotTip}</p>
    <label className="s-check">
      <input type="checkbox" checked={agreed} onChange={() => setAgreed(!agreed)} />
      <span>{copy.keepConfirm}</span>
    </label>
    {error && <p className="s-error" role="alert" style={{ marginTop: 14 }}>{error}</p>}
    <div className="s-actions">
      <button type="button" className="s-text" onClick={onBack} disabled={busy}>{copy.back}</button>
      <button type="button" className="s-btn" disabled={busy || !agreed} onClick={() => onConfirm(code)}>
        {busy ? copy.securing : copy.lockGift}</button>
    </div>
  </section>;
}

export function UnlockStep({ copy, type, prompt, busy, error, title, body, onUnlock, onRecover }: {
  copy: SetupCopy; type: SecretType; prompt: string | null; busy: boolean; error: string;
  title?: string; body?: string; onUnlock: (answer: string) => void; onRecover?: (code: string) => void;
}) {
  const [mode, setMode] = useState<'secret' | 'recovery'>('secret');
  const [answer, setAnswer] = useState('');
  const [code, setCode] = useState('');
  const id = useId();
  if (mode === 'recovery' && onRecover) {
    return <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) onRecover(code); }}>
      <Intro eyebrow={copy.lockEyebrow} title={copy.recoverTitle} lede={copy.recoverBody} />
      <div className="s-field">
        <label className="s-label" htmlFor={`${id}-code`}>{copy.recoveryInput}</label>
        <input id={`${id}-code`} className="s-input s-input--code" autoComplete="off" autoFocus
          value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-…" />
      </div>
      {error && <p className="s-error" role="alert" style={{ marginTop: 14 }}>{error}</p>}
      <div className="s-actions">
        <button type="button" className="s-text" onClick={() => setMode('secret')}>{copy.useSecret}</button>
        <button type="submit" className="s-btn" disabled={busy || !code.trim()}>{busy ? copy.unlocking : copy.continue}</button>
      </div>
    </form>;
  }
  return <form onSubmit={(e) => { e.preventDefault(); if (answer) onUnlock(answer); }}>
    <Intro eyebrow={copy.lockEyebrow} title={title ?? copy.unlockTitle} lede={body ?? copy.unlockBody} />
    <div className="s-fields">
      {prompt && <p className="s-h2" style={{ fontWeight: 400, fontStyle: 'italic' }}>“{prompt}”</p>}
      <SecretField type={type} id={`${id}-answer`} label={type === 'PIN' ? copy.pin : type === 'DATE' ? copy.date : copy.answer}
        value={answer} onChange={setAnswer} autoFocus invalid={!!error} />
      {error && <p className="s-error" role="alert">{error}</p>}
      {onRecover && <button type="button" className="s-link" style={{ justifySelf: 'start' }}
        onClick={() => setMode('recovery')}>{copy.forgot}</button>}
    </div>
    <div className="s-actions">
      <button type="submit" className="s-btn" disabled={busy || !answer}>{busy ? copy.unlocking : copy.unlock}</button>
    </div>
  </form>;
}
