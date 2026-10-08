import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Infinity as InfinityIcon,
  Loader2,
  MessageSquareText,
  Minus,
  Plus,
  RefreshCw,
  Store,
  TicketPlus,
  X,
} from 'lucide-react';
import {
  apiErrorCode,
  quotaRequestService,
  type QuotaRequest,
  type QuotaRequestStatus,
} from '../features/quota/quotaRequestService';

type Tab = QuotaRequestStatus | 'ALL';
const TABS: Tab[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'];
const PAGE_SIZE = 10;
const MAX_AMOUNT = 100000;
const REASON_MAX = 500;

const STATUS_STYLES: Record<QuotaRequestStatus, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
  REJECTED: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300',
  CANCELLED: 'border-border bg-muted text-muted-foreground',
};

interface Draft {
  amount: string;
  reason: string;
}

export const QuotaRequestsAdminPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language.startsWith('ar');

  const [tab, setTab] = useState<Tab>('PENDING');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<QuotaRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const formatDate = useCallback(
    (value: string) =>
      new Intl.DateTimeFormat(isArabic ? 'ar-PS' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      ),
    [isArabic],
  );

  const showToast = (text: string, ok = true) => {
    setToast({ text, ok });
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    let active = true;
    const fetchRequests = async () => {
      setLoading(true);
      try {
        const response = await quotaRequestService.getAll({
          page,
          limit: PAGE_SIZE,
          status: tab === 'ALL' ? undefined : tab,
        });
        if (!active) return;
        setItems(response.items ?? []);
        setTotal(response.meta?.total ?? 0);
        setTotalPages(Math.max(1, response.meta?.totalPages ?? 1));
        setPendingCount(response.summary?.pending ?? 0);
        setLoadError(false);
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchRequests();
    return () => {
      active = false;
    };
  }, [page, tab, refreshKey]);

  const draftFor = (request: QuotaRequest): Draft =>
    drafts[request.id] ?? { amount: String(request.requestedAmount), reason: '' };

  const updateDraft = (request: QuotaRequest, patch: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [request.id]: { ...draftFor(request), ...patch } }));

  const stepAmount = (request: QuotaRequest, delta: number) => {
    const current = Number(draftFor(request).amount) || 0;
    updateDraft(request, { amount: String(Math.min(MAX_AMOUNT, Math.max(1, current + delta))) });
  };

  const afterAnswer = (request: QuotaRequest) => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[request.id];
      return next;
    });
    setRefreshKey((value) => value + 1);
    // Tell the sidebar badge to refresh.
    window.dispatchEvent(new Event('quota-requests:changed'));
  };

  const handleError = (error: unknown) => {
    const code = apiErrorCode(error);
    if (code === 'QUOTA_REQUEST_ALREADY_CLOSED') {
      showToast(t('quotaRequests.admin.alreadyClosed'), false);
      setRefreshKey((value) => value + 1);
    } else {
      showToast(t('quotaRequests.admin.actionError'), false);
    }
  };

  const approve = async (request: QuotaRequest) => {
    const draft = draftFor(request);
    const amount = Number(draft.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT) return;
    setBusy({ id: request.id, action: 'approve' });
    try {
      await quotaRequestService.approve(
        request.id,
        amount === request.requestedAmount ? undefined : amount,
        draft.reason.trim() || undefined,
      );
      showToast(t('quotaRequests.admin.approved', { amount }));
      afterAnswer(request);
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(null);
    }
  };

  const reject = async (request: QuotaRequest) => {
    setBusy({ id: request.id, action: 'reject' });
    try {
      await quotaRequestService.reject(request.id, draftFor(request).reason.trim() || undefined);
      showToast(t('quotaRequests.admin.rejected'));
      afterAnswer(request);
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {toast && (
        <div
          role="status"
          className={`fixed end-5 top-5 z-[80] max-w-sm rounded-2xl border px-4 py-3 text-sm font-bold shadow-xl ${
            toast.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
          }`}
        >
          {toast.text}
        </div>
      )}

      <div className="rounded-3xl border border-border bg-gradient-to-r from-primary/15 via-blue-500/10 to-card p-6 shadow-xs sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <TicketPlus className="h-4 w-4" />
              {t('quotaRequests.admin.badge')}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{t('quotaRequests.admin.title')}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('quotaRequests.admin.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-xs transition hover:bg-muted disabled:opacity-50 sm:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('ordersAdmin.refresh', 'Refresh')}
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => {
              setTab(value);
              setPage(1);
            }}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition ${
              tab === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted'
            }`}
          >
            {value === 'ALL' ? t('quotaRequests.all') : t(`quotaRequests.status.${value}`)}
            {value === 'PENDING' && pendingCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === value ? 'bg-white/25' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="text-sm font-bold text-destructive">{t('quotaRequests.loadError')}</p>
          <button onClick={() => setRefreshKey((value) => value + 1)} className="mt-3 text-xs font-bold text-primary hover:underline">
            {t('ordersAdmin.tryAgain', 'Try again')}
          </button>
        </div>
      ) : loading && items.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-12 text-sm font-semibold text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          {t('quotaRequests.loading')}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <Inbox className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-bold text-foreground">
            {tab === 'PENDING' ? t('quotaRequests.admin.emptyPending') : t('quotaRequests.admin.empty')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((request) => {
            const merchant = request.merchant;
            const remaining = merchant ? Math.max(0, (merchant.totalQuota ?? 0) - (merchant.usedLinks ?? 0)) : null;
            const draft = draftFor(request);
            const draftAmount = Number(draft.amount);
            const amountValid = Number.isInteger(draftAmount) && draftAmount >= 1 && draftAmount <= MAX_AMOUNT;
            const isBusy = busy?.id === request.id;
            const isPending = request.status === 'PENDING';

            return (
              <article key={request.id} className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Store className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-extrabold text-foreground">{merchant?.companyName || merchant?.email || '—'}</p>
                      {merchant?.companyName && <p className="truncate text-xs text-muted-foreground">{merchant.email}</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(request.createdAt)}</p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-extrabold ${STATUS_STYLES[request.status]}`}>
                    {t(`quotaRequests.status.${request.status}`)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('quotaRequests.admin.requested')}</p>
                    <p className="mt-1 text-lg font-black text-foreground">{request.requestedAmount.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('quotaRequests.admin.currentQuota')}</p>
                    <p className="mt-1 text-sm font-extrabold text-foreground">
                      {merchant?.isUnlimitedQuota ? (
                        <span className="inline-flex items-center gap-1"><InfinityIcon className="h-4 w-4" />{t('createOrder.unlimited', 'Unlimited')}</span>
                      ) : merchant ? (
                        t('quotaRequests.admin.remainingOf', { remaining: remaining?.toLocaleString(), total: (merchant.totalQuota ?? 0).toLocaleString() })
                      ) : (
                        '—'
                      )}
                    </p>
                  </div>
                  {request.status === 'APPROVED' && request.approvedAmount != null && (
                    <div className="rounded-xl bg-emerald-500/10 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{t('quotaRequests.admin.granted')}</p>
                      <p className="mt-1 text-lg font-black text-emerald-700 dark:text-emerald-300">+{request.approvedAmount.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {request.merchantReason && (
                  <div className="mt-3 rounded-xl border border-border bg-background p-3">
                    <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground"><MessageSquareText className="h-3.5 w-3.5" />{t('quotaRequests.merchantReason')}</p>
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">{request.merchantReason}</p>
                  </div>
                )}
                {!isPending && request.adminReason && (
                  <div className="mt-3 rounded-xl border border-border bg-background p-3">
                    <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground"><MessageSquareText className="h-3.5 w-3.5" />{t('quotaRequests.adminReason')}</p>
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">{request.adminReason}</p>
                  </div>
                )}
                {!isPending && request.reviewedAt && (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {t('quotaRequests.admin.reviewedBy', {
                      who: request.reviewedBy?.companyName || request.reviewedBy?.email || '—',
                      when: formatDate(request.reviewedAt),
                    })}
                  </p>
                )}

                {isPending && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                      <div>
                        <label htmlFor={`amount-${request.id}`} className="mb-1.5 block text-xs font-bold text-foreground">{t('quotaRequests.admin.amountToGrant')}</label>
                        <div className="flex items-center gap-1.5" dir="ltr">
                          <button type="button" onClick={() => stepAmount(request, -1)} disabled={isBusy} className="rounded-xl border border-border p-2.5 text-foreground transition hover:bg-muted disabled:opacity-40" aria-label={t('quotaRequests.admin.decrease')}><Minus className="h-4 w-4" /></button>
                          <input
                            id={`amount-${request.id}`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={MAX_AMOUNT}
                            step={1}
                            value={draft.amount}
                            disabled={isBusy}
                            onChange={(event) => updateDraft(request, { amount: event.target.value })}
                            className={`w-full min-w-0 rounded-xl border bg-background px-3 py-2.5 text-center text-sm font-extrabold text-foreground outline-none focus:ring-2 focus:ring-primary/15 ${amountValid ? 'border-input focus:border-primary' : 'border-red-400'}`}
                          />
                          <button type="button" onClick={() => stepAmount(request, 1)} disabled={isBusy} className="rounded-xl border border-border p-2.5 text-foreground transition hover:bg-muted disabled:opacity-40" aria-label={t('quotaRequests.admin.increase')}><Plus className="h-4 w-4" /></button>
                        </div>
                        {amountValid && draftAmount !== request.requestedAmount && (
                          <p className="mt-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                            {t('quotaRequests.admin.changedHint', { requested: request.requestedAmount.toLocaleString() })}
                          </p>
                        )}
                      </div>
                      <div>
                        <label htmlFor={`reason-${request.id}`} className="mb-1.5 block text-xs font-bold text-foreground">
                          {t('quotaRequests.admin.yourReason')} <span className="font-medium text-muted-foreground">({t('quotaRequests.optional')})</span>
                        </label>
                        <textarea
                          id={`reason-${request.id}`}
                          rows={2}
                          maxLength={REASON_MAX}
                          value={draft.reason}
                          disabled={isBusy}
                          onChange={(event) => updateDraft(request, { reason: event.target.value })}
                          placeholder={t('quotaRequests.admin.reasonPlaceholder')}
                          className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => void reject(request)}
                        disabled={isBusy}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/30 px-4 py-2.5 text-xs font-extrabold text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                      >
                        {isBusy && busy?.action === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        {t('quotaRequests.admin.reject')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void approve(request)}
                        disabled={isBusy || !amountValid}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-md shadow-primary/20 transition hover:brightness-105 disabled:opacity-50"
                      >
                        {isBusy && busy?.action === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {amountValid
                          ? t('quotaRequests.admin.approveAmount', { amount: draftAmount.toLocaleString() })
                          : t('quotaRequests.admin.approve')}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {!loadError && total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{t('quotaRequests.admin.pageInfo', { page, totalPages, total })}</p>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-border p-2 text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40" aria-label={t('ordersAdmin.previous', 'Previous')}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></button>
            <span className="min-w-8 text-center text-xs font-extrabold text-foreground">{page}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-border p-2 text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40" aria-label={t('ordersAdmin.next', 'Next')}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotaRequestsAdminPage;
