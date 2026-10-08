import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Infinity as InfinityIcon,
  Gift,
  Link2,
  Loader2,
  PackagePlus,
  Phone,
  Plus,
  Store,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  merchantOrderService,
  type CreatedMerchantOrder,
  type LinkMode,
} from '../features/orders/services/merchantOrderService';
import { CustomerPhoneInput } from '../features/orders/components/CustomerPhoneInput';
import { GiftPieces } from '../features/orders/components/GiftPieces';
import { orderService } from '../features/orders/services/orderService';
import { userService } from '../features/dashboard/services/userService';
import type { MerchantUser } from '../features/dashboard/types';

interface ApiErrorBody {
  code?: string;
  message?: string | string[];
  available?: number;
}

const emptyItem = () => ({ productName: '' });

export const CreateMerchantOrderPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, refetchProfile } = useAuth();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [externalOrderId, setExternalOrderId] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [linkMode, setLinkMode] = useState<LinkMode>('SEPARATE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdOrder, setCreatedOrder] = useState<CreatedMerchantOrder | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');

  // A super admin creates the same full order, for a merchant they pick.
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'admin';
  const ordersPath = isAdmin ? '/super-admin/orders' : '/merchant/orders';
  const [merchants, setMerchants] = useState<MerchantUser[]>([]);
  const [merchantsLoading, setMerchantsLoading] = useState(isAdmin);
  const [merchantId, setMerchantId] = useState('');
  const [chargeQuota, setChargeQuota] = useState(true);
  const selectedMerchant = merchants.find((merchant) => merchant.id === merchantId);

  const loadMerchants = useCallback(async () => {
    try {
      const response = await userService.getMerchants(1, 1000);
      setMerchants(response.items || []);
    } catch {
      setMerchants([]);
    } finally {
      setMerchantsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Data fetching intentionally updates the page state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAdmin) void loadMerchants();
  }, [isAdmin, loadMerchants]);

  const quotaOwner = isAdmin ? selectedMerchant : user;
  const isUnlimited = isAdmin
    ? selectedMerchant?.isUnlimitedQuota === true
    : user?.isUnlimitedQuota === true || user?.totalQuota === 'unlimited';
  // null = no limit to enforce (unlimited, or an admin order that skips the quota).
  const availableQuota = useMemo(() => {
    if (isUnlimited || (isAdmin && (!chargeQuota || !quotaOwner))) return null;
    const total = typeof quotaOwner?.totalQuota === 'number' ? quotaOwner.totalQuota : 0;
    return Math.max(0, total - (quotaOwner?.usedLinks || 0));
  }, [chargeQuota, isAdmin, isUnlimited, quotaOwner]);
  const noLimit = availableQuota === null;
  const isShared = linkMode === 'SHARED' && items.length > 1;
  // Quota counts links: a shared link is one link for all the gifts.
  const linksNeeded = isShared ? 1 : items.length;
  const exceedsQuota = availableQuota !== null && linksNeeded > availableQuota;
  const canAddItem =
    items.length < 50 &&
    (availableQuota === null || (linkMode === 'SHARED' ? availableQuota >= 1 : items.length < availableQuota));

  const updateItem = (index: number, productName: string) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, productName } : item,
      ),
    );
  };

  const addItem = () => {
    if (canAddItem) {
      setItems((current) => [...current, emptyItem()]);
    }
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const cleanItems = items.map((item) => ({ productName: item.productName.trim() }));
    if (
      (isAdmin && !merchantId) ||
      !customerName.trim() ||
      !customerPhone.trim() ||
      cleanItems.some((item) => !item.productName)
    ) return;
    if (exceedsQuota) {
      setError(t('createOrder.quotaError', 'You do not have enough NFC quota for these items.'));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        externalOrderId: externalOrderId.trim() || undefined,
        items: cleanItems,
        ...(cleanItems.length > 1 ? { linkMode } : {}),
      };
      const result = isAdmin
        ? await merchantOrderService.createAdminOrder({ ...payload, merchantId, chargeQuota })
        : await merchantOrderService.createOrder(payload);
      setCreatedOrder(result);
      if (isAdmin) await loadMerchants();
      else await refetchProfile();
    } catch (requestError) {
      const body = (requestError as AxiosError<ApiErrorBody>).response?.data;
      if (body?.code === 'NFC_QUOTA_EXCEEDED') {
        setError(
          t('createOrder.quotaAvailableError', 'Not enough quota. Only {{count}} NFC links are available.', {
            count: body.available ?? 0,
          }),
        );
      } else if (body?.code === 'MERCHANT_ACCOUNT_NOT_ACTIVE') {
        setError(t('createOrder.merchantNotActive'));
      } else {
        const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
        setError(message || t('createOrder.submitError', 'The order could not be created. Please try again.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyLink = async (linkId: string, url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedItemId(linkId);
    window.setTimeout(() => setCopiedItemId(null), 1800);
  };

  // For orders the merchant prepares on the spot: close it straight from here.
  const markCompleted = async () => {
    if (!createdOrder) return;
    setIsCompleting(true);
    setCompleteError('');
    try {
      if (isAdmin) await orderService.updateOrder(createdOrder.id, { status: 'COMPLETED' });
      else await merchantOrderService.updateOrderStatus(createdOrder.id, 'COMPLETED');
      setCreatedOrder({ ...createdOrder, status: 'COMPLETED' });
    } catch {
      setCompleteError(t('createOrder.completeError'));
    } finally {
      setIsCompleting(false);
    }
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setExternalOrderId('');
    setItems([emptyItem()]);
    setLinkMode('SEPARATE');
    setChargeQuota(true);
    setCreatedOrder(null);
    setCompleteError('');
    setError('');
  };

  if (createdOrder) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-10">
        <div className="overflow-hidden rounded-3xl border border-emerald-200 bg-card shadow-sm dark:border-emerald-900">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 py-7 text-white sm:px-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20"><CheckCircle2 className="h-7 w-7" /></div>
            <h1 className="mt-4 text-2xl font-black">{t('createOrder.successTitle', 'Order created successfully')}</h1>
            <p className="mt-1 text-sm text-emerald-50">{t('createOrder.successSubtitle', 'The NFC setup links are ready to share with your customer.')}</p>
          </div>

          <div className="space-y-5 p-5 sm:p-8">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-muted p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('createOrder.customer', 'Customer')}</p><p className="mt-1 font-extrabold text-foreground">{createdOrder.customerName}</p></div>
              <div className="rounded-2xl bg-muted p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('createOrder.customerPhone', 'Customer phone')}</p><a href={`tel:${createdOrder.customerPhone}`} dir="ltr" className="mt-1 inline-flex items-center gap-1.5 font-extrabold text-primary"><Phone className="h-3.5 w-3.5" />{createdOrder.customerPhone}</a></div>
              <div className="rounded-2xl bg-muted p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('createOrder.orderId', 'Order ID')}</p><p className="mt-1 font-mono text-xs font-bold text-foreground">#{createdOrder.orderNumber}</p></div>
              <div className="rounded-2xl bg-muted p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('createOrder.remaining', 'Remaining quota')}</p><p className="mt-1 font-extrabold text-foreground">{createdOrder.quota.unlimited ? '∞' : createdOrder.quota.remaining}</p></div>
              {isAdmin && selectedMerchant && <div className="rounded-2xl bg-muted p-4 sm:col-span-2"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('createOrder.merchant')}</p><p className="mt-1 font-extrabold text-foreground">{selectedMerchant.companyName || selectedMerchant.email}</p>{!chargeQuota && <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">{t('createOrder.freeLinksDone')}</p>}</div>}
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground"><Link2 className="h-4 w-4 text-primary" />{t('createOrder.generatedLinks', 'Generated NFC links')}</h2><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">{createdOrder.items.length}</span></div>
              <div className="space-y-3">
                {createdOrder.items.map((item) => {
                  return (
                    <div key={item.id} className="rounded-2xl border border-border p-4">
                      <div className="min-w-0"><GiftPieces item={item} />{(item.giftCount ?? 1) > 1 && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary"><Gift className="h-3.5 w-3.5" />{t('createOrder.sharedLinkNote', 'Write this link on all {{count}} gifts', { count: item.giftCount })}</p>}</div>
                      <div className="mt-3 space-y-2">
                        <div><p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{t('createOrder.setupLink', 'Setup link')}</p><div className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate rounded-xl bg-muted px-3 py-2 font-mono text-[10px] text-muted-foreground">{item.setupUrl}</span><button type="button" onClick={() => void copyLink(`${item.id}-setup`, item.setupUrl)} className="rounded-xl border border-border p-2.5 text-foreground transition hover:bg-muted" aria-label={t('createOrder.copySetup', 'Copy setup link')}>{copiedItemId === `${item.id}-setup` ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</button><a href={item.setupUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-border p-2.5 text-foreground transition hover:bg-muted" aria-label={t('createOrder.openSetup', 'Open setup link')}><ExternalLink className="h-4 w-4" /></a></div></div>
                        <div><p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{t('createOrder.viewLink', 'View link')}</p><div className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate rounded-xl bg-blue-500/8 px-3 py-2 font-mono text-[10px] text-blue-700 dark:text-blue-300">{item.viewUrl}</span><button type="button" onClick={() => void copyLink(`${item.id}-view`, item.viewUrl)} className="rounded-xl border border-border p-2.5 text-foreground transition hover:bg-muted" aria-label={t('createOrder.copyView', 'Copy view link')}>{copiedItemId === `${item.id}-view` ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</button><a href={item.viewUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-border p-2.5 text-foreground transition hover:bg-muted" aria-label={t('createOrder.openView', 'Open view link')}><Eye className="h-4 w-4" /></a></div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {createdOrder.status === 'COMPLETED' ? (
              <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5 shrink-0" />{t('createOrder.completedDone')}</div>
            ) : (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="text-sm font-extrabold text-foreground">{t('createOrder.completeNowTitle')}</p><p className="mt-0.5 text-xs text-muted-foreground">{t('createOrder.completeNowHint')}</p>{completeError && <p role="alert" className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-300">{completeError}</p>}</div>
                <button type="button" onClick={() => void markCompleted()} disabled={isCompleting} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:opacity-60">{isCompleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{t('createOrder.markCompleted')}</button>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Link to={ordersPath} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold text-foreground transition hover:bg-muted"><ArrowLeft className="h-4 w-4 rtl:rotate-180" />{t('createOrder.viewOrders', 'View all orders')}</Link>
              <button type="button" onClick={resetForm} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground"><Plus className="h-4 w-4" />{t('createOrder.createAnother', 'Create another order')}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={isAdmin ? ordersPath : '/merchant/dashboard'} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition hover:text-primary"><ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />{isAdmin ? t('createOrder.backOrders') : t('createOrder.backDashboard', 'Back to dashboard')}</Link>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">{t('createOrder.title', 'Create New Order')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{isAdmin ? t('createOrder.adminSubtitle') : t('createOrder.subtitle', 'Generate a secure setup link for every NFC item in the order.')}</p>
        </div>
        <div className={`inline-flex w-fit items-center gap-2 rounded-2xl border px-4 py-3 ${exceedsQuota ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' : 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300'}`}>
          {noLimit ? <InfinityIcon className="h-5 w-5" /> : <Link2 className="h-4 w-4" />}
          <div><p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{isAdmin ? t('createOrder.merchantQuota') : t('createOrder.availableQuota', 'Available NFC quota')}</p><p className="text-sm font-black">{isAdmin && !selectedMerchant ? '—' : isUnlimited ? t('createOrder.unlimited', 'Unlimited') : isAdmin && !chargeQuota ? t('createOrder.notCharged') : availableQuota}</p></div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-gradient-to-r from-primary/8 to-indigo-500/5 px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><PackagePlus className="h-5 w-5" /></div><div><h2 className="font-extrabold text-foreground">{t('createOrder.orderDetails', 'Order details')}</h2><p className="text-xs text-muted-foreground">{t('createOrder.requiredHint', 'Customer name, phone, and at least one item are required.')}</p></div></div>
        </div>

        <div className="space-y-6 p-5 sm:p-7">
          {isAdmin && (
            <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold text-foreground"><Store className="h-3.5 w-3.5 text-primary" />{t('createOrder.merchant')} <span className="text-red-500">*</span></span>
                <select required value={merchantId} disabled={merchantsLoading} onChange={(event) => setMerchantId(event.target.value)} className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10">
                  <option value="" disabled>{merchantsLoading ? t('createOrder.loadingMerchants') : t('createOrder.selectMerchant')}</option>
                  {merchants.map((merchant) => {
                    const left = Math.max(0, (merchant.totalQuota || 0) - (merchant.usedLinks || 0));
                    const inactive = Boolean(merchant.status && merchant.status !== 'ACTIVE');
                    return <option key={merchant.id} value={merchant.id} disabled={inactive}>{merchant.companyName || merchant.email} · {merchant.isUnlimitedQuota ? '∞' : t('createOrder.linksLeft', { count: left })}{inactive ? ` · ${t('createOrder.notActive')}` : ''}</option>;
                  })}
                </select>
              </label>
              {selectedMerchant && !selectedMerchant.isUnlimitedQuota && (
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input type="checkbox" checked={chargeQuota} onChange={(event) => setChargeQuota(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
                  <span className="min-w-0"><span className="block text-xs font-extrabold text-foreground">{t('createOrder.chargeQuota')}</span><span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{chargeQuota ? t('createOrder.chargeQuotaHint') : t('createOrder.freeLinksHint')}</span></span>
                </label>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-extrabold text-foreground">{t('createOrder.customerName', 'Customer name')} <span className="text-red-500">*</span></span><input autoFocus required maxLength={120} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder={t('createOrder.customerPlaceholder', 'e.g. John Doe')} className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>
            <div className="block sm:col-span-2"><label htmlFor="create-customer-phone" className="mb-1.5 block text-xs font-extrabold text-foreground">{t('createOrder.customerPhone', 'Customer phone')} <span className="text-red-500">*</span></label><CustomerPhoneInput id="create-customer-phone" value={customerPhone} onChange={setCustomerPhone} countryCodeLabel={t('createOrder.countryCode', 'Country code')} phoneNumberLabel={t('createOrder.phoneNumber', 'Phone number')} placeholder={t('createOrder.customerPhonePlaceholder', '591234567')} hint={t('createOrder.customerPhoneHint', 'For +970/+972 enter 9 digits starting with 5. For +962 enter 9 digits starting with 7.')} /></div>
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-extrabold text-foreground">{t('createOrder.externalId', 'External order ID')} <span className="font-medium text-muted-foreground">({t('createOrder.optional', 'optional')})</span></span><input maxLength={120} value={externalOrderId} onChange={(event) => setExternalOrderId(event.target.value)} placeholder={t('createOrder.externalIdPlaceholder', 'e.g. SHOP-9921')} className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-extrabold text-foreground">{t('createOrder.items', 'NFC items')}</h3><p className="mt-0.5 text-xs text-muted-foreground">{isShared ? t('createOrder.itemsHintShared', 'All gifts share one link, so one quota unit is used.') : t('createOrder.itemsHint', 'One quota unit is used for each item.')}</p></div><span dir="ltr" className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground" title={t('createOrder.linksUsed', 'Links used')}>{linksNeeded} / {noLimit ? '∞' : availableQuota}</span></div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2 rounded-2xl border border-border bg-background p-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">{index + 1}</div>
                  <input required maxLength={120} value={item.productName} onChange={(event) => updateItem(index, event.target.value)} placeholder={t('createOrder.itemPlaceholder', 'Item name, e.g. Silver necklace')} className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60" />
                  <button type="button" disabled={items.length === 1} onClick={() => removeItem(index)} className="rounded-xl p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/30" aria-label={t('createOrder.removeItem', 'Remove item')}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <button type="button" disabled={!canAddItem} onClick={addItem} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 px-4 py-3 text-xs font-extrabold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" />{t('createOrder.addItem', 'Add another item')}</button>

            {items.length > 1 && (
              <fieldset className="mt-5">
                <legend className="text-sm font-extrabold text-foreground">{t('createOrder.linkModeTitle', 'How should the gifts be linked?')}</legend>
                <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                  {([
                    { mode: 'SEPARATE' as const, Icon: Link2, title: t('createOrder.linkModeSeparate', 'A link for each gift'), hint: t('createOrder.linkModeSeparateHint', 'Each gift gets its own setup and message. Uses {{count}} links.', { count: items.length }) },
                    { mode: 'SHARED' as const, Icon: Gift, title: t('createOrder.linkModeShared', 'One link for all gifts'), hint: t('createOrder.linkModeSharedHint', 'The customer prepares one message and every gift opens it. Uses 1 link.') },
                  ]).map(({ mode, Icon, title, hint }) => (
                    <label key={mode} className={`flex cursor-pointer gap-3 rounded-2xl border p-3.5 transition ${linkMode === mode ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-border hover:border-primary/40'}`}>
                      <input type="radio" name="link-mode" value={mode} checked={linkMode === mode} onChange={() => setLinkMode(mode)} className="mt-1 accent-[var(--primary)]" />
                      <span className="min-w-0"><span className="flex items-center gap-1.5 text-sm font-extrabold text-foreground"><Icon className="h-4 w-4 text-primary" />{title}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{hint}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>

          {(error || exceedsQuota) && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error || (isAdmin ? t('createOrder.merchantQuotaError') : t('createOrder.quotaError', 'You do not have enough NFC quota for these items.'))}{!error && !isAdmin && <> <Link to="/merchant/quota" className="underline">{t('createOrder.requestQuota')}</Link></>}</div>}
        </div>

        <div className="flex flex-col gap-3 border-t border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-xs text-muted-foreground">{t('createOrder.totalItems', 'Total items: {{count}}', { count: items.length })}</p>
          <button type="submit" disabled={isSubmitting || exceedsQuota || availableQuota === 0 || (isAdmin && !merchantId)} className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-primary-foreground shadow-md shadow-primary/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}{isSubmitting ? t('createOrder.generating', 'Generating links...') : t('createOrder.generate', 'Generate NFC links')}</button>
        </div>
      </form>
    </div>
  );
};

export default CreateMerchantOrderPage;
