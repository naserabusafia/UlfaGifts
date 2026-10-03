import React, { useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Infinity as InfinityIcon,
  Link2,
  Loader2,
  PackagePlus,
  Phone,
  Plus,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  merchantOrderService,
  type CreatedMerchantOrder,
} from '../features/orders/services/merchantOrderService';
import { CustomerPhoneInput } from '../features/orders/components/CustomerPhoneInput';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdOrder, setCreatedOrder] = useState<CreatedMerchantOrder | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  const isUnlimited = user?.isUnlimitedQuota === true || user?.totalQuota === 'unlimited';
  const availableQuota = useMemo(() => {
    if (isUnlimited) return null;
    const total = typeof user?.totalQuota === 'number' ? user.totalQuota : 0;
    return Math.max(0, total - (user?.usedLinks || 0));
  }, [isUnlimited, user?.totalQuota, user?.usedLinks]);
  const exceedsQuota = availableQuota !== null && items.length > availableQuota;

  const updateItem = (index: number, productName: string) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, productName } : item,
      ),
    );
  };

  const addItem = () => {
    if (items.length < 50 && (availableQuota === null || items.length < availableQuota)) {
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
      const result = await merchantOrderService.createOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        externalOrderId: externalOrderId.trim() || undefined,
        items: cleanItems,
      });
      setCreatedOrder(result);
      await refetchProfile();
    } catch (requestError) {
      const body = (requestError as AxiosError<ApiErrorBody>).response?.data;
      if (body?.code === 'NFC_QUOTA_EXCEEDED') {
        setError(
          t('createOrder.quotaAvailableError', 'Not enough quota. Only {{count}} NFC links are available.', {
            count: body.available ?? 0,
          }),
        );
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

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setExternalOrderId('');
    setItems([emptyItem()]);
    setCreatedOrder(null);
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
              <div className="rounded-2xl bg-muted p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('createOrder.orderId', 'Order ID')}</p><p className="mt-1 font-mono text-xs font-bold text-foreground">{createdOrder.id.slice(0, 13)}</p></div>
              <div className="rounded-2xl bg-muted p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('createOrder.remaining', 'Remaining quota')}</p><p className="mt-1 font-extrabold text-foreground">{createdOrder.quota.unlimited ? '∞' : createdOrder.quota.remaining}</p></div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground"><Link2 className="h-4 w-4 text-primary" />{t('createOrder.generatedLinks', 'Generated NFC links')}</h2><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">{createdOrder.items.length}</span></div>
              <div className="space-y-3">
                {createdOrder.items.map((item) => {
                  return (
                    <div key={item.id} className="rounded-2xl border border-border p-4">
                      <div className="min-w-0"><p className="font-extrabold text-foreground">{item.productName}</p></div>
                      <div className="mt-3 space-y-2">
                        <div><p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{t('createOrder.setupLink', 'Setup link')}</p><div className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate rounded-xl bg-muted px-3 py-2 font-mono text-[10px] text-muted-foreground">{item.setupUrl}</span><button type="button" onClick={() => void copyLink(`${item.id}-setup`, item.setupUrl)} className="rounded-xl border border-border p-2.5 text-foreground transition hover:bg-muted" aria-label={t('createOrder.copySetup', 'Copy setup link')}>{copiedItemId === `${item.id}-setup` ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</button><a href={item.setupUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-border p-2.5 text-foreground transition hover:bg-muted" aria-label={t('createOrder.openSetup', 'Open setup link')}><ExternalLink className="h-4 w-4" /></a></div></div>
                        <div><p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{t('createOrder.viewLink', 'View link')}</p><div className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate rounded-xl bg-blue-500/8 px-3 py-2 font-mono text-[10px] text-blue-700 dark:text-blue-300">{item.viewUrl}</span><button type="button" onClick={() => void copyLink(`${item.id}-view`, item.viewUrl)} className="rounded-xl border border-border p-2.5 text-foreground transition hover:bg-muted" aria-label={t('createOrder.copyView', 'Copy view link')}>{copiedItemId === `${item.id}-view` ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</button><a href={item.viewUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-border p-2.5 text-foreground transition hover:bg-muted" aria-label={t('createOrder.openView', 'Open view link')}><Eye className="h-4 w-4" /></a></div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link to="/merchant/orders" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold text-foreground transition hover:bg-muted"><ArrowLeft className="h-4 w-4 rtl:rotate-180" />{t('createOrder.viewOrders', 'View all orders')}</Link>
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
          <Link to="/merchant/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition hover:text-primary"><ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />{t('createOrder.backDashboard', 'Back to dashboard')}</Link>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">{t('createOrder.title', 'Create New Order')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('createOrder.subtitle', 'Generate a secure setup link for every NFC item in the order.')}</p>
        </div>
        <div className={`inline-flex w-fit items-center gap-2 rounded-2xl border px-4 py-3 ${exceedsQuota ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' : 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300'}`}>
          {isUnlimited ? <InfinityIcon className="h-5 w-5" /> : <Link2 className="h-4 w-4" />}
          <div><p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{t('createOrder.availableQuota', 'Available NFC quota')}</p><p className="text-sm font-black">{isUnlimited ? t('createOrder.unlimited', 'Unlimited') : availableQuota}</p></div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-gradient-to-r from-primary/8 to-indigo-500/5 px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><PackagePlus className="h-5 w-5" /></div><div><h2 className="font-extrabold text-foreground">{t('createOrder.orderDetails', 'Order details')}</h2><p className="text-xs text-muted-foreground">{t('createOrder.requiredHint', 'Customer name, phone, and at least one item are required.')}</p></div></div>
        </div>

        <div className="space-y-6 p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-extrabold text-foreground">{t('createOrder.customerName', 'Customer name')} <span className="text-red-500">*</span></span><input autoFocus required maxLength={120} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder={t('createOrder.customerPlaceholder', 'e.g. John Doe')} className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>
            <div className="block sm:col-span-2"><label htmlFor="create-customer-phone" className="mb-1.5 block text-xs font-extrabold text-foreground">{t('createOrder.customerPhone', 'Customer phone')} <span className="text-red-500">*</span></label><CustomerPhoneInput id="create-customer-phone" value={customerPhone} onChange={setCustomerPhone} countryCodeLabel={t('createOrder.countryCode', 'Country code')} phoneNumberLabel={t('createOrder.phoneNumber', 'Phone number')} placeholder={t('createOrder.customerPhonePlaceholder', '591234567')} hint={t('createOrder.customerPhoneHint', 'For +970/+972 enter 9 digits starting with 5. For +962 enter 9 digits starting with 7.')} /></div>
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-extrabold text-foreground">{t('createOrder.externalId', 'External order ID')} <span className="font-medium text-muted-foreground">({t('createOrder.optional', 'optional')})</span></span><input maxLength={120} value={externalOrderId} onChange={(event) => setExternalOrderId(event.target.value)} placeholder={t('createOrder.externalIdPlaceholder', 'e.g. SHOP-9921')} className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-extrabold text-foreground">{t('createOrder.items', 'NFC items')}</h3><p className="mt-0.5 text-xs text-muted-foreground">{t('createOrder.itemsHint', 'One quota unit is used for each item.')}</p></div><span dir="ltr" className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{items.length} / {isUnlimited ? '∞' : availableQuota}</span></div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2 rounded-2xl border border-border bg-background p-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">{index + 1}</div>
                  <input required maxLength={120} value={item.productName} onChange={(event) => updateItem(index, event.target.value)} placeholder={t('createOrder.itemPlaceholder', 'Item name, e.g. Silver necklace')} className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60" />
                  <button type="button" disabled={items.length === 1} onClick={() => removeItem(index)} className="rounded-xl p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/30" aria-label={t('createOrder.removeItem', 'Remove item')}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <button type="button" disabled={items.length >= 50 || (availableQuota !== null && items.length >= availableQuota)} onClick={addItem} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 px-4 py-3 text-xs font-extrabold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" />{t('createOrder.addItem', 'Add another item')}</button>
          </div>

          {(error || exceedsQuota) && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error || t('createOrder.quotaError', 'You do not have enough NFC quota for these items.')}</div>}
        </div>

        <div className="flex flex-col gap-3 border-t border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-xs text-muted-foreground">{t('createOrder.totalItems', 'Total items: {{count}}', { count: items.length })}</p>
          <button type="submit" disabled={isSubmitting || exceedsQuota || availableQuota === 0} className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-primary-foreground shadow-md shadow-primary/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}{isSubmitting ? t('createOrder.generating', 'Generating links...') : t('createOrder.generate', 'Generate NFC links')}</button>
        </div>
      </form>
    </div>
  );
};

export default CreateMerchantOrderPage;
