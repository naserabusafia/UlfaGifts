import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Inbox, Infinity as InfinityIcon, Loader2, Nfc, RefreshCw, Send, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  apiErrorCode,
  quotaRequestService,
  type QuotaRequest,
  type QuotaRequestStatus,
} from '../features/quota/quotaRequestService';
import { formatCount, formatRelative } from '../features/dashboard/format';
import '../features/dashboard/portal.css';

const MAX_AMOUNT = 100000;
const REASON_MAX = 500;

const PILL: Record<QuotaRequestStatus, string> = {
  PENDING: 'pt-pill--wait',
  APPROVED: 'pt-pill--done',
  REJECTED: 'pt-pill--off',
  CANCELLED: 'pt-pill--off',
};

export const MerchantQuotaRequestsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user, refetchProfile } = useAuth();

  const [requests, setRequests] = useState<QuotaRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const isUnlimited = user?.isUnlimitedQuota === true || user?.totalQuota === 'unlimited';
  const total = typeof user?.totalQuota === 'number' ? user.totalQuota : 0;
  const remaining = Math.max(0, total - (user?.usedLinks ?? 0));
  const pending = requests.find((request) => request.status === 'PENDING');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await quotaRequestService.getMine());
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

  // An approved request changes the quota, so show the latest figures.
  useEffect(() => {
    void refetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsedAmount = Number(amount);
  const amountValid = Number.isInteger(parsedAmount) && parsedAmount >= 1 && parsedAmount <= MAX_AMOUNT;
  const canSubmit = amountValid && !submitting && !pending && !isUnlimited;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    setSent(false);
    try {
      const created = await quotaRequestService.create(parsedAmount, reason.trim() || undefined);
      setRequests((current) => [created, ...current]);
      setAmount('');
      setReason('');
      setSent(true);
    } catch (requestError) {
      const code = apiErrorCode(requestError);
      setError(
        code === 'QUOTA_REQUEST_PENDING'
          ? t('quotaRequests.merchant.alreadyPending')
          : code === 'QUOTA_UNLIMITED'
            ? t('quotaRequests.merchant.unlimitedNote')
            : t('quotaRequests.merchant.sendError'),
      );
      if (code === 'QUOTA_REQUEST_PENDING') void load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (request: QuotaRequest) => {
    setCancellingId(request.id);
    setError('');
    try {
      const updated = await quotaRequestService.cancel(request.id);
      setRequests((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setSent(false);
    } catch {
      setError(t('quotaRequests.merchant.cancelError'));
      void load();
    } finally {
      setCancellingId(null);
    }
  };

  const statusLabel = (status: QuotaRequestStatus) => t(`quotaRequests.status.${status}`);

  return (
    <div className="pt pt-narrow">
      <header className="pt-hero pt-rise">
        <div>
          <p className="pt-eyebrow">{t('quotaRequests.merchant.eyebrow')}</p>
          <h1 className="pt-title">{t('quotaRequests.merchant.title')}</h1>
          <p className="pt-lede">{t('quotaRequests.merchant.lede')}</p>
        </div>
      </header>

      <section className="pt-sheet pt-rise" aria-labelledby="quota-request-form">
        <div className="pt-sheet__head">
          <h2 className="pt-h2" id="quota-request-form">{t('quotaRequests.merchant.formTitle')}</h2>
          <span className="pt-inline pt-muted">
            {isUnlimited ? (
              <>
                <InfinityIcon /> {t('portal.merchant.unlimitedHint')}
              </>
            ) : (
              <>
                <Nfc /> {t('quotaRequests.merchant.remaining', { remaining: formatCount(remaining, lang), total: formatCount(total, lang) })}
              </>
            )}
          </span>
        </div>

        {isUnlimited ? (
          <p className="pt-note">{t('quotaRequests.merchant.unlimitedNote')}</p>
        ) : (
          <form className="pt-form" onSubmit={handleSubmit} noValidate>
            {pending && (
              <p className="pt-banner is-ok" role="status">
                {t('quotaRequests.merchant.pendingBanner', { amount: formatCount(pending.requestedAmount, lang) })}
              </p>
            )}
            <div className="pt-field">
              <label htmlFor="quota-amount">{t('quotaRequests.merchant.amount')}</label>
              <input
                id="quota-amount"
                className="pt-input pt-input--plain"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_AMOUNT}
                step={1}
                dir="ltr"
                value={amount}
                disabled={Boolean(pending)}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setSent(false);
                }}
                placeholder="50"
              />
              {amount !== '' && !amountValid && (
                <p className="pt-hint is-wax">{t('quotaRequests.merchant.amountInvalid', { max: formatCount(MAX_AMOUNT, lang) })}</p>
              )}
            </div>
            <div className="pt-field">
              <label htmlFor="quota-reason">
                {t('quotaRequests.merchant.reason')} <span className="pt-muted">({t('quotaRequests.optional')})</span>
              </label>
              <textarea
                id="quota-reason"
                className="pt-input pt-input--area"
                maxLength={REASON_MAX}
                value={reason}
                disabled={Boolean(pending)}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t('quotaRequests.merchant.reasonPlaceholder')}
              />
              <p className="pt-hint">{reason.length} / {REASON_MAX}</p>
            </div>

            {error && <p className="pt-banner is-error" role="alert">{error}</p>}
            {sent && (
              <p className="pt-banner is-ok" role="status">
                <Check /> {t('quotaRequests.merchant.sent')}
              </p>
            )}

            <div className="pt-form__actions">
              <button type="submit" className="pt-btn pt-btn--wax" disabled={!canSubmit}>
                {submitting ? <Loader2 className="pt-spin" /> : <Send />}
                {submitting ? t('quotaRequests.merchant.sending') : t('quotaRequests.merchant.send')}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="pt-sheet pt-rise" aria-labelledby="quota-request-history">
        <div className="pt-sheet__head">
          <h2 className="pt-h2" id="quota-request-history">{t('quotaRequests.merchant.historyTitle')}</h2>
          <button type="button" className="pt-btn pt-btn--ghost pt-btn--sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'pt-spin' : undefined} />
            {t('merchantOrders.refresh')}
          </button>
        </div>

        {loadError && (
          <div className="pt-error" role="alert">
            <span>{t('quotaRequests.loadError')}</span>
          </div>
        )}

        {loading && requests.length === 0 ? (
          <ul className="pt-list" aria-busy="true">
            {Array.from({ length: 2 }, (_, i) => (
              <li key={i} className="pt-row">
                <span className="pt-skel" style={{ width: 48, height: 16 }} />
                <span className="pt-skel" style={{ width: '60%', height: 16 }} />
                <span className="pt-skel" style={{ width: 70, height: 22, borderRadius: 999 }} />
              </li>
            ))}
          </ul>
        ) : requests.length === 0 ? (
          !loadError && (
            <div className="pt-empty">
              <Inbox />
              <p>{t('quotaRequests.merchant.empty')}</p>
            </div>
          )
        ) : (
          <ul className="pt-list">
            {requests.map((request) => {
              const changed =
                request.status === 'APPROVED' &&
                request.approvedAmount != null &&
                request.approvedAmount !== request.requestedAmount;
              return (
                <li key={request.id} className="pt-row pt-row--top">
                  <span className="pt-row__no" dir="ltr">+{formatCount(request.approvedAmount ?? request.requestedAmount, lang)}</span>
                  <div className="pt-row__main">
                    <b>
                      {changed
                        ? t('quotaRequests.merchant.approvedChanged', {
                            approved: formatCount(request.approvedAmount as number, lang),
                            requested: formatCount(request.requestedAmount, lang),
                          })
                        : t('quotaRequests.merchant.requested', { amount: formatCount(request.requestedAmount, lang) })}
                    </b>
                    <div className="pt-row__sub">
                      <span>{formatRelative(request.createdAt, lang)}</span>
                      {request.reviewedAt && (
                        <span>{t('quotaRequests.reviewed', { when: formatRelative(request.reviewedAt, lang) })}</span>
                      )}
                    </div>
                    {request.merchantReason && (
                      <p className="pt-reason">
                        <b>{t('quotaRequests.yourReason')}</b>
                        {request.merchantReason}
                      </p>
                    )}
                    {request.adminReason && (
                      <p className="pt-reason">
                        <b>{t('quotaRequests.adminReason')}</b>
                        {request.adminReason}
                      </p>
                    )}
                  </div>
                  <div className="pt-row__end" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <span className={`pt-pill ${PILL[request.status]}`}>{statusLabel(request.status)}</span>
                    {request.status === 'PENDING' && (
                      <button
                        type="button"
                        className="pt-btn pt-btn--ghost pt-btn--sm"
                        disabled={cancellingId === request.id}
                        onClick={() => void handleCancel(request)}
                      >
                        {cancellingId === request.id ? <Loader2 className="pt-spin" /> : <X />}
                        {t('quotaRequests.merchant.cancel')}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default MerchantQuotaRequestsPage;
