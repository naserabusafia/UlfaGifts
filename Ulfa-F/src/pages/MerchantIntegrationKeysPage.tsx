import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Copy, KeyRound, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  integrationKeysService,
  type CreatedIntegrationKey,
  type IntegrationKey,
} from '../features/integrations/integrationKeysService';
import { formatRelative } from '../features/dashboard/format';
import '../features/dashboard/portal.css';

const LABEL_MAX = 80;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

/** Copies a value and briefly shows a check mark on its button. */
const CopyButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="pt-btn pt-btn--ghost pt-btn--sm"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => setCopied(false));
      }}
    >
      {copied ? <Check /> : <Copy />}
      {label}
    </button>
  );
};

export const MerchantIntegrationKeysPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [keys, setKeys] = useState<IntegrationKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedIntegrationKey | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setKeys(await integrationKeysService.list());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Data fetching intentionally updates the page state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const canCreate = label.trim().length > 0 && !creating;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    setError('');
    try {
      const key = await integrationKeysService.create(label.trim());
      setCreated(key);
      setKeys((current) => [key, ...current]);
      setLabel('');
    } catch {
      setError(t('integrationKeys.createError'));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (key: IntegrationKey) => {
    setRevokingId(key.id);
    setError('');
    try {
      await integrationKeysService.revoke(key.id);
      setKeys((current) => current.filter((item) => item.id !== key.id));
      if (created?.id === key.id) setCreated(null);
      setConfirmId(null);
    } catch {
      setError(t('integrationKeys.revokeError'));
      void load();
    } finally {
      setRevokingId(null);
    }
  };

  const envSnippet = created ? `ULFA_API_URL=${API_BASE_URL}\nULFA_API_KEY=${created.apiKey}` : '';

  return (
    <div className="pt pt-narrow">
      <header className="pt-hero pt-rise">
        <div>
          <p className="pt-eyebrow">{t('integrationKeys.eyebrow')}</p>
          <h1 className="pt-title">{t('integrationKeys.title')}</h1>
          <p className="pt-lede">{t('integrationKeys.lede')}</p>
        </div>
      </header>

      <section className="pt-sheet pt-rise" aria-labelledby="integration-key-form">
        <div className="pt-sheet__head">
          <h2 className="pt-h2" id="integration-key-form">{t('integrationKeys.formTitle')}</h2>
        </div>

        {created ? (
          <div className="pt-form">
            <p className="pt-banner is-error" role="alert">
              <AlertTriangle /> {t('integrationKeys.showOnce')}
            </p>
            <div className="pt-field">
              <label htmlFor="integration-new-key">{t('integrationKeys.newKey', { label: created.label })}</label>
              <input
                id="integration-new-key"
                className="pt-input pt-input--plain"
                dir="ltr"
                readOnly
                value={created.apiKey}
                onFocus={(event) => event.currentTarget.select()}
              />
            </div>
            <div className="pt-field">
              <label htmlFor="integration-env">{t('integrationKeys.envTitle')}</label>
              <textarea
                id="integration-env"
                className="pt-input pt-input--area"
                dir="ltr"
                readOnly
                rows={2}
                value={envSnippet}
                onFocus={(event) => event.currentTarget.select()}
              />
              <p className="pt-hint">{t('integrationKeys.envHint')}</p>
            </div>
            <div className="pt-form__actions">
              <CopyButton value={created.apiKey} label={t('integrationKeys.copyKey')} />
              <CopyButton value={envSnippet} label={t('integrationKeys.copyEnv')} />
              <button type="button" className="pt-btn pt-btn--wax" onClick={() => setCreated(null)}>
                <Check /> {t('integrationKeys.saved')}
              </button>
            </div>
          </div>
        ) : (
          <form className="pt-form" onSubmit={handleCreate} noValidate>
            <div className="pt-field">
              <label htmlFor="integration-label">{t('integrationKeys.label')}</label>
              <input
                id="integration-label"
                className="pt-input pt-input--plain"
                maxLength={LABEL_MAX}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={t('integrationKeys.labelPlaceholder')}
              />
              <p className="pt-hint">{t('integrationKeys.labelHint')}</p>
            </div>
            <div className="pt-form__actions">
              <button type="submit" className="pt-btn pt-btn--wax" disabled={!canCreate}>
                {creating ? <Loader2 className="pt-spin" /> : <Plus />}
                {creating ? t('integrationKeys.creating') : t('integrationKeys.create')}
              </button>
            </div>
          </form>
        )}
        {error && (
          <p className="pt-banner is-error" role="alert" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
      </section>

      <section className="pt-sheet pt-rise" aria-labelledby="integration-key-list">
        <div className="pt-sheet__head">
          <h2 className="pt-h2" id="integration-key-list">{t('integrationKeys.listTitle')}</h2>
          <button type="button" className="pt-btn pt-btn--ghost pt-btn--sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'pt-spin' : undefined} />
            {t('merchantOrders.refresh')}
          </button>
        </div>

        {loadError && (
          <div className="pt-error" role="alert">
            <span>{t('integrationKeys.loadError')}</span>
          </div>
        )}

        {loading && keys.length === 0 ? (
          <ul className="pt-list" aria-busy="true">
            {Array.from({ length: 2 }, (_, i) => (
              <li key={i} className="pt-row">
                <span className="pt-skel" style={{ width: 32, height: 16 }} />
                <span className="pt-skel" style={{ width: '60%', height: 16 }} />
                <span className="pt-skel" style={{ width: 70, height: 22, borderRadius: 999 }} />
              </li>
            ))}
          </ul>
        ) : keys.length === 0 ? (
          !loadError && (
            <div className="pt-empty">
              <KeyRound />
              <p>{t('integrationKeys.empty')}</p>
            </div>
          )
        ) : (
          <ul className="pt-list">
            {keys.map((key) => (
              <li key={key.id} className="pt-row pt-row--top">
                <span className="pt-row__no" aria-hidden="true">
                  <KeyRound />
                </span>
                <div className="pt-row__main">
                  <b>{key.label}</b>
                  <div className="pt-row__sub">
                    <span dir="ltr">{key.keyPrefix}…</span>
                    <span>{t('integrationKeys.createdAt', { when: formatRelative(key.createdAt, lang) })}</span>
                    <span>
                      {key.lastUsedAt
                        ? t('integrationKeys.lastUsed', { when: formatRelative(key.lastUsedAt, lang) })
                        : t('integrationKeys.neverUsed')}
                    </span>
                  </div>
                  {confirmId === key.id && <p className="pt-reason">{t('integrationKeys.revokeWarning')}</p>}
                </div>
                <div className="pt-row__end" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  {confirmId === key.id ? (
                    <>
                      <button
                        type="button"
                        className="pt-btn pt-btn--wax pt-btn--sm"
                        disabled={revokingId === key.id}
                        onClick={() => void handleRevoke(key)}
                      >
                        {revokingId === key.id ? <Loader2 className="pt-spin" /> : <Trash2 />}
                        {t('integrationKeys.confirmRevoke')}
                      </button>
                      <button
                        type="button"
                        className="pt-btn pt-btn--ghost pt-btn--sm"
                        disabled={revokingId === key.id}
                        onClick={() => setConfirmId(null)}
                      >
                        {t('integrationKeys.keep')}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="pt-btn pt-btn--ghost pt-btn--sm" onClick={() => setConfirmId(key.id)}>
                      <Trash2 />
                      {t('integrationKeys.revoke')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default MerchantIntegrationKeysPage;
