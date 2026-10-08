import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, KeyRound } from 'lucide-react';
import sealImg from '../../components/EnvelopeLetter/seal.png';
import {
  deriveRecoveryKeys, deriveSecretKeys, generateContentKey, KDF_ITERATIONS, randomSalt, unwrapContentKey, wrapContentKey,
} from '../nfc-experience/crypto/keys';
import { normalizeSecret } from '../nfc-experience/crypto/secret';
import type { SecretType } from '../nfc-experience/crypto/secret';
import type { ViewerAuthType } from '../nfc-experience/NfcExperiencePage';
import { ApiError, setupApi } from './api';
import type { LockBody, SetupState } from './api';
import { setupCopy } from './copy';
import type { SetupCopy } from './copy';
import { createDraftStore, useDraft } from './draftStore';
import type { DraftStore } from './draftStore';
import { fillParts, partReady } from './draftView';
import Mark from './components/Mark';
import { Sheet } from './components/Overlays';
import { Intro, KeepStep, LockStep, UnlockStep, WelcomeStep } from './steps/AccessSteps';
import type { GiftLanguage, SecretChoice } from './steps/AccessSteps';
import SectionsStep from './steps/SectionsStep';
import FillStep from './steps/FillStep';
import PreviewStep from './steps/PreviewStep';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import '../nfc-experience/arabic-fonts.css';
import '@fontsource/great-vibes/latin-400.css';
import './setup.css';

type Phase =
  | { name: 'loading' }
  | { name: 'error'; message: string; detail?: string }
  | { name: 'welcome' }
  | { name: 'lock'; mode: 'first' | 'change' | 'recovered' }
  | { name: 'keep'; choice: SecretChoice }
  | { name: 'unlock' }
  | { name: 'editor' };
type EditorStep = 'sections' | 'fill' | 'preview' | 'published' | 'saved';
/** Keys held in memory only while the page is open. */
type Secrets = { contentKey: CryptoKey; authKey: string; salt: string; iterations: number };

/** Setup links look like "1047-382-<uuid>"; the prefix is only for humans. */
const EDIT_TOKEN_TAIL = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toEditToken = (slug: string) => slug.match(EDIT_TOKEN_TAIL)?.[0] ?? slug;

const asLanguage = (value: string | undefined): GiftLanguage => (value?.startsWith('en') ? 'en' : 'ar');

export function SetupPage() {
  const { token: slug = '' } = useParams();
  const token = toEditToken(slug);
  const api = useMemo(() => setupApi(token), [token]);
  const [state, setState] = useState<SetupState | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  // The page's language and the gift's language are separate choices.
  const [uiLanguage, setUiLanguage] = useState<GiftLanguage>('ar');
  const [giftLanguage, setGiftLanguage] = useState<GiftLanguage>('ar');
  const [store, setStore] = useState<DraftStore | null>(null);
  const [step, setStep] = useState<EditorStep>('sections');
  const [part, setPart] = useState('letter');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reauthing, setReauthing] = useState(false);
  const [notice, setNotice] = useState('');
  const secrets = useRef<Secrets | null>(null);
  const reauth = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  const copy = setupCopy[uiLanguage];

  const fail = useCallback((err: unknown, wrong?: string) => {
    const c = setupCopy[uiLanguage];
    if (err instanceof ApiError && err.status === 429) return setError(c.tooMany);
    if (err instanceof ApiError && err.status === 403 && wrong) return setError(wrong);
    setError(err instanceof ApiError && err.status !== 0 && wrong ? wrong : c.networkError);
  }, [uiLanguage]);

  useEffect(() => {
    let active = true;
    // When the 2-hour session runs out, requests wait here until the buyer
    // opens the gift again; uploads then simply continue.
    api.onSessionExpired(() => {
      if (!reauth.current) {
        let resolve = () => undefined as void;
        const promise = new Promise<void>((r) => { resolve = r; });
        reauth.current = { promise, resolve };
        setError('');
        setReauthing(true);
      }
      return reauth.current.promise;
    });
    api.state().then((next) => {
      if (!active) return;
      setState(next);
      setUiLanguage(asLanguage(next.language));
      setGiftLanguage(asLanguage(next.language));
      setPhase(next.hasSecret ? { name: 'unlock' } : { name: 'welcome' });
    }).catch((err: unknown) => {
      if (!active) return;
      const c = setupCopy.ar;
      const paused = err instanceof ApiError && err.status === 403;
      setPhase({ name: 'error', message: err instanceof ApiError && err.status === 404 ? c.invalidLink
        : paused ? c.inactive : c.networkError,
        // The store's own note, when it left one while pausing the gift.
        detail: paused && err.reason ? err.reason : undefined });
    });
    return () => { active = false; };
  }, [api]);

  // Every visit starts at the sections, so the order and what's on can be changed first.
  const openEditor = useCallback(async (language?: GiftLanguage) => {
    const next = createDraftStore(api, secrets.current!.contentKey);
    await next.load(await api.draft());
    if (language && language !== next.get()!.language) await next.setLanguage(language).catch(() => undefined);
    setStore(next);
    setStep('sections');
    setPhase({ name: 'editor' });
  }, [api]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Uploads keep the page open; removed photos are deleted before it closes.
  useEffect(() => {
    if (!store) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      if (store.busyCount() > 0) { event.preventDefault(); event.returnValue = ''; }
    };
    const onHide = () => store.flushDeletes();
    window.addEventListener('beforeunload', onLeave);
    window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('beforeunload', onLeave); window.removeEventListener('pagehide', onHide); };
  }, [store]);

  /** Sets or changes the lock: wraps the (new or existing) content key with it. */
  const lock = async (choice: SecretChoice, recoveryCode?: string, changed = false) => {
    setBusy(true); setError('');
    try {
      const salt = randomSalt();
      const keys = await deriveSecretKeys(choice.normalized, salt, KDF_ITERATIONS);
      const contentKey = secrets.current?.contentKey ?? await generateContentKey();
      const body: LockBody = {
        viewerAuthType: choice.type, viewerAuthPrompt: choice.prompt || undefined, authKey: keys.authKey,
        keySalt: salt, kdfIterations: KDF_ITERATIONS, wrappedKey: await wrapContentKey(contentKey, keys.kek),
      };
      if (recoveryCode) {
        const recovery = await deriveRecoveryKeys(recoveryCode);
        body.recoveryWrappedKey = await wrapContentKey(contentKey, recovery.kek);
        body.recoveryAuthKey = recovery.authKey;
      }
      const result = await api.lock(body);
      api.setSession(result.session);
      setState(result);
      secrets.current = { contentKey, authKey: keys.authKey, salt, iterations: KDF_ITERATIONS };
      if (changed) setNotice(copy.lockChanged);
      if (store) setPhase({ name: 'editor' });
      else await openEditor(giftLanguage);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const unlockWith = async (answer: string) => {
    const { keySalt, kdfIterations } = state!.encryption!;
    const keys = await deriveSecretKeys(normalizeSecret(state!.viewerAuthType!, answer), keySalt, kdfIterations);
    const session = await api.session(keys.authKey);
    api.setSession(session.session);
    return { keys, session, keySalt, kdfIterations };
  };

  const unlock = async (answer: string) => {
    setBusy(true); setError('');
    try {
      const { keys, session, keySalt, kdfIterations } = await unlockWith(answer);
      const contentKey = await unwrapContentKey(session.wrappedKey, keys.kek);
      secrets.current = { contentKey, authKey: keys.authKey, salt: keySalt, iterations: kdfIterations };
      await openEditor();
    } catch (err) {
      fail(err, copy.wrongSecret);
    } finally {
      setBusy(false);
    }
  };

  const reunlock = async (answer: string) => {
    setBusy(true); setError('');
    try {
      await unlockWith(answer);
      reauth.current?.resolve();
      reauth.current = null;
      setReauthing(false);
    } catch (err) {
      fail(err, copy.wrongSecret);
    } finally {
      setBusy(false);
    }
  };

  const recover = async (code: string) => {
    setBusy(true); setError('');
    try {
      const keys = await deriveRecoveryKeys(code);
      const result = await api.recover(keys.authKey);
      api.setSession(result.session);
      const contentKey = await unwrapContentKey(result.recoveryWrappedKey, keys.kek);
      secrets.current = { contentKey, authKey: '', salt: '', iterations: 0 };
      setPhase({ name: 'lock', mode: 'recovered' });
    } catch (err) {
      fail(err, copy.wrongRecovery);
    } finally {
      setBusy(false);
    }
  };

  const verifyLocally = useCallback(async (type: ViewerAuthType, answer: string) => {
    const s = secrets.current;
    if (!s || type === 'NONE') return false;
    return (await deriveSecretKeys(normalizeSecret(type, answer), s.salt, s.iterations)).authKey === s.authKey;
  }, []);

  const changeGiftLanguage = (language: GiftLanguage) => {
    setGiftLanguage(language);
    void store?.setLanguage(language).catch(() => setGiftLanguage(store.get()!.language));
  };

  const secretType = (state?.viewerAuthType ?? 'PIN') as SecretType;
  const changeLock = () => { setError(''); setPhase({ name: 'lock', mode: 'change' }); window.scrollTo({ top: 0 }); };
  const body = (() => {
    switch (phase.name) {
      case 'loading':
        return <div className="s-center" role="status">{copy.loading}</div>;
      case 'error':
        return <section><Intro eyebrow={copy.brand} title={phase.message} lede={phase.detail} />
          <button type="button" className="s-btn" onClick={() => window.location.reload()}>{copy.retry}</button></section>;
      case 'welcome':
        return <WelcomeStep copy={copy} language={giftLanguage} onLanguage={setGiftLanguage}
          onStart={() => setPhase({ name: 'lock', mode: 'first' })} />;
      case 'lock':
        return <LockStep copy={copy} isNew={phase.mode === 'first'} busy={busy} error={phase.mode === 'first' ? '' : error}
          onBack={phase.mode === 'first' ? () => setPhase({ name: 'welcome' })
            : phase.mode === 'change' ? () => setPhase({ name: 'editor' }) : undefined}
          onDone={(choice) => (phase.mode === 'first' ? setPhase({ name: 'keep', choice }) : void lock(choice, undefined, phase.mode === 'change'))} />;
      case 'keep':
        return <KeepStep copy={copy} busy={busy} error={error} onBack={() => setPhase({ name: 'lock', mode: 'first' })}
          onConfirm={(code) => void lock(phase.choice, code)} />;
      case 'unlock':
        return <UnlockStep copy={copy} type={secretType} prompt={state?.viewerAuthPrompt ?? null}
          busy={busy} error={error} onUnlock={(answer) => void unlock(answer)} onRecover={(code) => void recover(code)} />;
      case 'editor':
        return store ? <EditorView copy={copy} store={store} step={step} setStep={setStep} part={part} setPart={setPart}
          authType={secretType} prompt={state?.viewerAuthPrompt ?? null} nfcId={state?.nfcId ?? ''}
          onLanguage={changeGiftLanguage} verify={verifyLocally} onChangeLock={changeLock}
          publish={async () => {
            const next = await api.publish();
            setState((current) => (current ? { ...current, published: next.published } : current));
          }} /> : null;
    }
  })();

  const stepNumber = phase.name === 'editor' ? ({ sections: 2, fill: 3, preview: 4, published: 4, saved: 4 } as const)[step]
    : ['lock', 'keep'].includes(phase.name) ? 1 : 0;
  const inPreview = phase.name === 'editor' && step === 'preview';
  return <div className={`s-page${inPreview ? ' is-preview' : ''}`} dir={uiLanguage === 'ar' ? 'rtl' : 'ltr'} lang={uiLanguage}>
    {!inPreview && <header className="s-header">
      <div className="s-header__row">
        <Mark label={copy.brand} />
        {stepNumber > 0 && <span className="s-header__step">
          {copy.stepOf(stepNumber, 4)} · <b>{copy.steps[stepNumber - 1]}</b>
        </span>}
        <div className="s-header__tools">
          {store && <SavingIndicator copy={copy} store={store} />}
          {phase.name === 'editor' && <button type="button" className="s-text" onClick={changeLock}
            aria-label={copy.changeSecret}><KeyRound aria-hidden="true" /></button>}
          <button type="button" className="s-text" lang={uiLanguage === 'ar' ? 'en' : 'ar'}
            onClick={() => setUiLanguage(uiLanguage === 'ar' ? 'en' : 'ar')}>{copy.uiLanguage}</button>
        </div>
      </div>
      <div className="s-progress" aria-hidden="true"><i style={{ width: `${(stepNumber / 4) * 100}%` }} /></div>
    </header>}
    <main className="s-main">{body}</main>
    {store && <UndoToast copy={copy} store={store} />}
    {notice && <div className="s-toast" role="status"><Check aria-hidden="true" /><span>{notice}</span></div>}
    {reauthing && <Sheet label={copy.expiredTitle} onClose={() => undefined} dir={uiLanguage === 'ar' ? 'rtl' : 'ltr'} lang={uiLanguage}>
      <UnlockStep copy={copy} type={secretType} prompt={state?.viewerAuthPrompt ?? null} busy={busy} error={error}
        title={copy.expiredTitle} body={copy.expiredBody} onUnlock={(answer) => void reunlock(answer)} />
    </Sheet>}
  </div>;
}

/** There is no save button, so the header always says where saving stands. */
function SavingIndicator({ copy, store }: { copy: SetupCopy; store: DraftStore }) {
  const draft = useDraft(store);
  const left = draft.media.filter((m) => m.status === 'processing' || m.status === 'uploading').length;
  if (left) return <span className="s-saving" role="status">{copy.uploading(left)}</span>;
  if (draft.letterSave === 'saving') return <span className="s-saving" role="status">{copy.saving}</span>;
  if (draft.letterSave === 'error') return <span className="s-saving is-error" role="status">{copy.saveError}</span>;
  return <span className="s-saving is-saved" role="status"><Check aria-hidden="true" />{copy.autoSaved}</span>;
}

function UndoToast({ copy, store }: { copy: SetupCopy; store: DraftStore }) {
  const draft = useDraft(store);
  if (!draft.removed) return null;
  return <div className="s-toast" role="status">
    <span>{copy.removed}</span>
    <button type="button" onClick={() => store.undoRemove()}>{copy.undo}</button>
  </div>;
}

function EditorView({ copy, store, step, setStep, part, setPart, authType, prompt, nfcId, onLanguage, verify, onChangeLock, publish }: {
  copy: SetupCopy; store: DraftStore; step: EditorStep; setStep: (step: EditorStep) => void;
  part: string; setPart: (part: string) => void; authType: SecretType; prompt: string | null; nfcId: string;
  onLanguage: (language: GiftLanguage) => void; onChangeLock: () => void;
  verify: (type: ViewerAuthType, answer: string) => Promise<boolean>; publish: () => Promise<void>;
}) {
  const draft = useDraft(store);
  if (step === 'preview') {
    return <PreviewStep copy={copy} draft={draft} authType={authType} prompt={prompt} verify={verify}
      onEdit={() => setStep('fill')}
      onFinish={async () => {
        await store.flushLetter();
        while (store.busyCount() > 0) await new Promise((r) => window.setTimeout(r, 400));
        setStep('saved');
        window.scrollTo({ top: 0 });
      }}
      onPublish={async () => {
        await store.flushLetter();
        while (store.busyCount() > 0) await new Promise((r) => window.setTimeout(r, 400));
        await publish();
        store.setPublished(true);
        setStep('published');
        window.scrollTo({ top: 0 });
      }} />;
  }
  if (step === 'published') {
    return <section className="s-done">
      <img className="s-seal" src={sealImg} alt="" />
      <Intro eyebrow={copy.publishedEyebrow} title={copy.publishedTitle} lede={copy.publishedBody} />
      <div className="s-remember">
        <span className="s-note">{copy.remember}</span>
        <b>{copy.types[authType]} — {copy.typeHints[authType]}</b>
        {prompt && <span className="s-note">{copy.hintShown}: “{prompt}”</span>}
      </div>
      <p className="s-note">{copy.changesLive}</p>
      <div className="s-actions">
        <button type="button" className="s-text" onClick={() => { setPart(fillParts(draft)[0]); setStep('fill'); }}>{copy.keepEditing}</button>
        <a className="s-btn" href={`/nfc/${encodeURIComponent(nfcId)}`} target="_blank" rel="noreferrer">{copy.openGift}</a>
      </div>
    </section>;
  }
  if (step === 'saved') {
    const count = (key: string) => draft.media.filter((m) => m.sectionKey === key).length;
    const shown = fillParts(draft).filter((key) => partReady(draft, key));
    return <section className="s-done">
      <img className="s-seal" src={sealImg} alt="" />
      <Intro eyebrow={copy.savedEyebrow} title={copy.savedTitle} lede={copy.savedBody} />
      <ol className="s-summary">
        {shown.map((key) => <li key={key}>
          <Check aria-hidden="true" />
          <b>{key === 'letter' ? copy.letterName : copy.sectionInfo[key]?.name ?? key}</b>
          {key !== 'letter' && <span>{key === 'voice_note' ? copy.notesCount(count(key)) : copy.photosCount(count(key))}</span>}
        </li>)}
      </ol>
      <p className="s-note">{copy.changesLive}</p>
      <div className="s-actions">
        <button type="button" className="s-text" onClick={() => setStep('sections')}>{copy.keepEditing}</button>
        <a className="s-btn" href={`/nfc/${encodeURIComponent(nfcId)}`} target="_blank" rel="noreferrer">{copy.openGift}</a>
      </div>
    </section>;
  }
  if (step === 'sections') {
    return <SectionsStep copy={copy} language={draft.language} theme={draft.theme} occasion={draft.occasion}
      sections={draft.sections} onChange={(sections) => store.setSections(sections)} onLanguage={onLanguage}
      lockLabel={`${copy.types[authType]} — ${copy.typeHints[authType]}`} onChangeLock={onChangeLock}
      onNext={() => { setPart('letter'); setStep('fill'); window.scrollTo({ top: 0 }); }} />;
  }
  return <FillStep copy={copy} draft={draft} store={store} part={part} onPart={setPart}
    onBack={() => setStep('sections')} onNext={() => { void store.flushLetter(); setStep('preview'); }} />;
}
