import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  ExternalLink,
  Eye,
  FilterX,
  Link2,
  Loader2,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { orderService } from '../features/orders';
import type {
  OrderStatus,
  OrdersSummary,
  SystemOrder,
} from '../features/orders';
import { userService } from '../features/dashboard/services/userService';
import type { MerchantUser } from '../features/dashboard/types';
import { CustomerPhoneInput } from '../features/orders/components/CustomerPhoneInput';
import { GiftPieces } from '../features/orders/components/GiftPieces';
import { normalizeCustomerPhoneForForm } from '../features/orders/utils/customerPhone';

const STATUSES: OrderStatus[] = ['PENDING', 'COMPLETED', 'CANCELLED'];

const EMPTY_SUMMARY: OrdersSummary = {
  total: 0,
  pending: 0,
  completed: 0,
  cancelled: 0,
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
  CANCELLED: 'border-border bg-muted text-muted-foreground',
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
    const message = response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return fallback;
};

export const OrdersManagementPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isArabic = i18n.language.startsWith('ar');

  const [orders, setOrders] = useState<SystemOrder[]>([]);
  const [merchants, setMerchants] = useState<MerchantUser[]>([]);
  const [summary, setSummary] = useState<OrdersSummary>(EMPTY_SUMMARY);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [merchantFilter, setMerchantFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedOrder, setSelectedOrder] = useState<SystemOrder | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    merchantId: '',
    customerName: '',
    customerPhone: '',
    externalOrderId: '',
    status: 'PENDING' as OrderStatus,
  });

  const statusLabel = useCallback(
    (status: OrderStatus) => {
      const labels: Record<OrderStatus, string> = {
        PENDING: t('ordersAdmin.pending', 'Pending'),
        COMPLETED: t('ordersAdmin.completed', 'Completed'),
        CANCELLED: t('ordersAdmin.cancelled'),
      };
      return labels[status];
    },
    [t],
  );

  const formatDate = useCallback(
    (value: string) =>
      new Intl.DateTimeFormat(isArabic ? 'ar-PS' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value)),
    [isArabic],
  );

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const fetchMerchants = async () => {
      if (orderService.isMockMode) {
        setMerchants(orderService.getMockMerchants());
        return;
      }

      try {
        const response = await userService.getMerchants(1, 1000);
        setMerchants(response.items || []);
      } catch {
        setMerchants([]);
      }
    };
    void fetchMerchants();
  }, []);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await orderService.getOrders({
        page,
        limit,
        search: debouncedSearch || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        merchantId: merchantFilter === 'ALL' ? undefined : merchantFilter,
        dateFrom: dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined,
        dateTo: dateTo ? `${dateTo}T23:59:59.999Z` : undefined,
      });
      setOrders(response.items || []);
      setSummary(response.summary || EMPTY_SUMMARY);
      setTotal(response.meta?.total || 0);
      setTotalPages(Math.max(response.meta?.totalPages || 1, 1));
    } catch (error) {
      setOrders([]);
      setErrorMessage(
        getApiErrorMessage(
          error,
          t('ordersAdmin.loadError', 'Could not load orders from the server.'),
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, debouncedSearch, limit, merchantFilter, page, statusFilter, t]);

  useEffect(() => {
    // Data fetching intentionally updates the page state when filters or refresh change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOrders();
  }, [fetchOrders, refreshKey]);

  const filtersActive = Boolean(
    searchTerm || statusFilter !== 'ALL' || merchantFilter !== 'ALL' || dateFrom || dateTo,
  );

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setMerchantFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleOpenDetails = async (order: SystemOrder) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
    setIsLoadingDetails(true);
    try {
      setSelectedOrder(await orderService.getOrder(order.id));
    } catch (error) {
      showToast(
        getApiErrorMessage(error, t('ordersAdmin.detailsError', 'Could not load order details.')),
      );
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleOpenEdit = (order: SystemOrder) => {
    setSelectedOrder(order);
    setEditForm({
      merchantId: order.merchant?.id || '',
      customerName: order.customerName,
      customerPhone: normalizeCustomerPhoneForForm(order.customerPhone),
      externalOrderId: order.externalOrderId || '',
      status: order.status,
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOrder) return;
    setIsSubmitting(true);
    try {
      await orderService.updateOrder(selectedOrder.id, editForm);
      setIsEditOpen(false);
      showToast(t('ordersAdmin.updateSuccess', 'Order updated successfully.'));
      setRefreshKey((value) => value + 1);
    } catch (error) {
      showToast(
        getApiErrorMessage(error, t('ordersAdmin.updateError', 'Could not update the order.')),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickStatus = async (order: SystemOrder, status: OrderStatus) => {
    if (order.status === status) return;
    setUpdatingOrderId(order.id);
    try {
      await orderService.updateOrder(order.id, { status });
      showToast(t('ordersAdmin.statusSuccess', 'Order status updated.'));
      setRefreshKey((value) => value + 1);
    } catch (error) {
      showToast(
        getApiErrorMessage(error, t('ordersAdmin.updateError', 'Could not update the order.')),
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrder) return;
    setIsSubmitting(true);
    try {
      await orderService.deleteOrder(selectedOrder.id);
      setIsDeleteOpen(false);
      showToast(t('ordersAdmin.deleteSuccess', 'Order deleted successfully.'));
      if (orders.length === 1 && page > 1) setPage((value) => value - 1);
      else setRefreshKey((value) => value + 1);
    } catch (error) {
      showToast(
        getApiErrorMessage(error, t('ordersAdmin.deleteError', 'Could not delete the order.')),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = useMemo(
    () => [
      {
        label: t('ordersAdmin.totalOrders', 'Total Orders'),
        value: summary.total,
        icon: ShoppingCart,
        className: 'bg-primary/10 text-primary',
      },
      {
        label: t('ordersAdmin.pending', 'Pending'),
        value: summary.pending,
        icon: Clock3,
        className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      },
      {
        label: t('ordersAdmin.completed', 'Completed'),
        value: summary.completed,
        icon: CheckCircle2,
        className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      },
      {
        label: t('ordersAdmin.cancelled'),
        value: summary.cancelled ?? 0,
        icon: Ban,
        className: 'bg-muted text-muted-foreground',
      },
    ],
    [summary, t],
  );

  return (
    <div className="space-y-6 pb-12 font-sans">
      {toastMessage && (
        <div className="fixed end-5 top-5 z-[80] max-w-sm rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 shadow-xl dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          {toastMessage}
        </div>
      )}

      <div className="rounded-3xl border border-border bg-gradient-to-r from-primary/15 via-blue-500/10 to-card p-6 shadow-xs sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <PackageSearch className="h-4 w-4" />
              {t('ordersAdmin.badge', 'System Orders')}
            </div>
            {orderService.isMockMode && (
              <span className="mb-2 ms-2 inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-xs font-extrabold text-amber-700 dark:text-amber-300">
                {t('ordersAdmin.mockMode', 'Temporary mock data')}
              </span>
            )}
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {t('ordersAdmin.title', 'Orders Management')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t(
                'ordersAdmin.subtitle',
                'Track every order in the system, inspect its details, update its status, or remove it.',
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {orderService.isMockMode && (
              <button
                type="button"
                onClick={() => {
                  orderService.resetMockOrders();
                  setPage(1);
                  setRefreshKey((value) => value + 1);
                  showToast(t('ordersAdmin.mockResetSuccess', 'Mock orders restored.'));
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <RefreshCw className="h-4 w-4" />
                {t('ordersAdmin.resetMock', 'Reset mock data')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-xs transition hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {t('ordersAdmin.refresh', 'Refresh')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/super-admin/orders/new')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {t('ordersAdmin.addOrder', 'Add Order')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-muted-foreground">{stat.label}</span>
                <span className={`rounded-xl p-2 ${stat.className}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black text-foreground">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative md:col-span-2 xl:col-span-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('ordersAdmin.searchPlaceholder', 'Search customer, order, or merchant...')}
              className="w-full rounded-xl border border-input bg-background py-2.5 pe-3 ps-10 text-xs text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as 'ALL' | OrderStatus);
              setPage(1);
            }}
            className="rounded-xl border border-input bg-background px-3 py-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
          >
            <option value="ALL">{t('ordersAdmin.allStatuses', 'All statuses')}</option>
            {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>

          <select
            value={merchantFilter}
            onChange={(event) => {
              setMerchantFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-input bg-background px-3 py-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
          >
            <option value="ALL">{t('ordersAdmin.allMerchants', 'All merchants')}</option>
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.companyName || merchant.email}
              </option>
            ))}
          </select>

          <label className="relative">
            <CalendarDays className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              aria-label={t('ordersAdmin.dateFrom', 'From date')}
              className="w-full rounded-xl border border-input bg-background py-2.5 pe-3 ps-10 text-xs text-foreground outline-none focus:border-primary"
            />
          </label>

          <label className="relative">
            <CalendarDays className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
              aria-label={t('ordersAdmin.dateTo', 'To date')}
              className="w-full rounded-xl border border-input bg-background py-2.5 pe-3 ps-10 text-xs text-foreground outline-none focus:border-primary"
            />
          </label>
        </div>

        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            <FilterX className="h-4 w-4" />
            {t('ordersAdmin.clearFilters', 'Clear filters')}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <p className="text-sm font-bold text-foreground">
            {t('ordersAdmin.ordersList', 'Orders')} <span className="text-muted-foreground">({total})</span>
          </p>
          <select
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground"
            aria-label={t('ordersAdmin.rowsPerPage', 'Rows per page')}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>

        {errorMessage ? (
          <div className="p-10 text-center">
            <p className="text-sm font-bold text-destructive">{errorMessage}</p>
            <button onClick={() => setRefreshKey((value) => value + 1)} className="mt-3 text-xs font-bold text-primary hover:underline">
              {t('ordersAdmin.tryAgain', 'Try again')}
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm font-semibold text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            {t('ordersAdmin.loading', 'Loading orders...')}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <PackageSearch className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-bold text-foreground">{t('ordersAdmin.empty', 'No matching orders found.')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('ordersAdmin.emptyHint', 'Try changing or clearing the filters.')}</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-start text-xs">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 text-start font-extrabold">{t('ordersAdmin.order', 'Order')}</th>
                    <th className="px-5 py-3 text-start font-extrabold">{t('ordersAdmin.customer', 'Customer')}</th>
                    <th className="px-5 py-3 text-start font-extrabold">{t('ordersAdmin.merchant', 'Merchant')}</th>
                    <th className="px-5 py-3 text-start font-extrabold">{t('ordersAdmin.createdAt', 'Created')}</th>
                    <th className="px-5 py-3 text-start font-extrabold">{t('ordersAdmin.status', 'Status')}</th>
                    <th className="px-5 py-3 text-end font-extrabold">{t('ordersAdmin.actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => (
                    <tr key={order.id} className="transition hover:bg-muted/35">
                      <td className="px-5 py-4">
                        <p className="font-bold text-foreground">{order.externalOrderId || `#${order.orderNumber}`}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{order.id}</p>
                      </td>
                      <td className="px-5 py-4"><p className="font-semibold text-foreground">{order.customerName}</p><p dir="ltr" className="mt-0.5 text-start text-[10px] text-muted-foreground">{order.customerPhone || '—'}</p></td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-foreground">{order.merchant?.companyName || '—'}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{order.merchant?.email || '—'}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{formatDate(order.createdAt)}</td>
                      <td className="px-5 py-4">
                        <div className="relative inline-flex items-center">
                          {updatingOrderId === order.id && <Loader2 className="me-2 h-3.5 w-3.5 animate-spin text-primary" />}
                          <select
                            value={order.status}
                            disabled={updatingOrderId === order.id}
                            onChange={(event) => void handleQuickStatus(order, event.target.value as OrderStatus)}
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-extrabold outline-none ${STATUS_STYLES[order.status]}`}
                          >
                            {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => void handleOpenDetails(order)} title={t('ordersAdmin.view', 'View')} className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"><Eye className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleOpenEdit(order)} title={t('ordersAdmin.edit', 'Edit')} className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-blue-500/10 hover:text-blue-600"><Edit3 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => { setSelectedOrder(order); setIsDeleteOpen(true); }} title={t('ordersAdmin.delete', 'Delete')} className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border lg:hidden">
              {orders.map((order) => (
                <div key={order.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-foreground">{order.externalOrderId || `#${order.orderNumber}`}</p>
                      <p className="mt-1 text-xs font-semibold text-foreground">{order.customerName}</p>
                      <p dir="ltr" className="mt-0.5 text-start text-[10px] text-muted-foreground">{order.customerPhone || '—'}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${STATUS_STYLES[order.status]}`}>{statusLabel(order.status)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div><p className="text-muted-foreground">{t('ordersAdmin.merchant', 'Merchant')}</p><p className="mt-0.5 font-bold text-foreground">{order.merchant?.companyName || order.merchant?.email || '—'}</p></div>
                    <div><p className="text-muted-foreground">{t('ordersAdmin.createdAt', 'Created')}</p><p className="mt-0.5 font-bold text-foreground">{formatDate(order.createdAt)}</p></div>
                  </div>
                  <select
                    value={order.status}
                    disabled={updatingOrderId === order.id}
                    onChange={(event) => void handleQuickStatus(order, event.target.value as OrderStatus)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-bold text-foreground"
                  >
                    {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                  </select>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => void handleOpenDetails(order)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-border py-2 text-xs font-bold text-foreground"><Eye className="h-3.5 w-3.5" />{t('ordersAdmin.view', 'View')}</button>
                    <button onClick={() => handleOpenEdit(order)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-border py-2 text-xs font-bold text-foreground"><Edit3 className="h-3.5 w-3.5" />{t('ordersAdmin.edit', 'Edit')}</button>
                    <button onClick={() => { setSelectedOrder(order); setIsDeleteOpen(true); }} className="inline-flex items-center justify-center gap-1 rounded-xl border border-destructive/30 py-2 text-xs font-bold text-destructive"><Trash2 className="h-3.5 w-3.5" />{t('ordersAdmin.delete', 'Delete')}</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!isLoading && !errorMessage && total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row sm:px-5">
            <p className="text-xs text-muted-foreground">
              {t('ordersAdmin.pageInfo', 'Page {{page}} of {{totalPages}} · {{total}} orders', { page, totalPages, total })}
            </p>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-border p-2 text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40" aria-label={t('ordersAdmin.previous', 'Previous')}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></button>
              <span className="min-w-8 text-center text-xs font-extrabold text-foreground">{page}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-border p-2 text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40" aria-label={t('ordersAdmin.next', 'Next')}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></button>
            </div>
          </div>
        )}
      </div>

      {isDetailsOpen && selectedOrder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsDetailsOpen(false); }}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-xl font-extrabold text-foreground">{t('ordersAdmin.detailsTitle', 'Order Details')}</h2><p className="mt-1 font-mono text-[10px] text-muted-foreground">{selectedOrder.id}</p></div>
              <button onClick={() => setIsDetailsOpen(false)} className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            {isLoadingDetails ? (
              <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    [t('ordersAdmin.externalOrderId', 'External order ID'), selectedOrder.externalOrderId || '—'],
                    [t('ordersAdmin.customer', 'Customer'), selectedOrder.customerName],
                    [t('ordersAdmin.customerPhone', 'Customer phone'), selectedOrder.customerPhone || '—'],
                    [t('ordersAdmin.merchant', 'Merchant'), selectedOrder.merchant?.companyName || '—'],
                    [t('ordersAdmin.merchantEmail', 'Merchant email'), selectedOrder.merchant?.email || '—'],
                    [t('ordersAdmin.createdAt', 'Created'), formatDate(selectedOrder.createdAt)],
                    [t('ordersAdmin.status', 'Status'), statusLabel(selectedOrder.status)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-border bg-background p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-bold text-foreground">{value}</p></div>
                  ))}
                </div>
                <div>
                  <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-extrabold text-foreground"><Link2 className="h-4 w-4 text-primary" />{t('ordersAdmin.generatedItems', 'Generated NFC items')}</h3><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{selectedOrder.nfcItems?.length || 0}</span></div>
                  {selectedOrder.nfcItems?.length ? (
                    <div className="space-y-2">{selectedOrder.nfcItems.map((item) => <div key={item.id} className="rounded-2xl border border-border p-3"><div className="flex items-start justify-between gap-3"><div><GiftPieces item={item} className="text-sm font-bold text-foreground" />{(item.giftCount ?? 1) > 1 && <p className="mt-1.5 text-[10px] font-bold text-primary">{t('merchantOrders.sharedLink', { count: item.giftCount })}</p>}<p className="mt-1 font-mono text-[10px] text-muted-foreground">NFC: {item.nfcId}</p>{item.quotaCharged === false && <p className="mt-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">{t('ordersAdmin.freeLink')}</p>}</div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.isLocked ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'}`}>{item.isLocked ? t('ordersAdmin.locked', 'Locked') : t('ordersAdmin.active', 'Active')}</span></div>{(item.setupUrl || item.viewUrl) && <div className="mt-2 flex flex-wrap gap-2">{item.setupUrl && <a href={item.setupUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-bold text-foreground hover:bg-muted"><ExternalLink className="h-3 w-3" />{t('createOrder.setupLink', 'Setup link')}</a>}{item.viewUrl && <a href={item.viewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-bold text-foreground hover:bg-muted"><Eye className="h-3 w-3" />{t('createOrder.viewLink', 'View link')}</a>}</div>}</div>)}</div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{t('ordersAdmin.noItems', 'No NFC items have been generated for this order.')}</div>
                  )}
                </div>
                <button onClick={() => { setIsDetailsOpen(false); handleOpenEdit(selectedOrder); }} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-extrabold text-primary-foreground"><Edit3 className="h-4 w-4" />{t('ordersAdmin.editOrder', 'Edit Order')}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {isEditOpen && selectedOrder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) setIsEditOpen(false); }}>
          <form onSubmit={handleSaveEdit} className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between"><h2 className="text-xl font-extrabold text-foreground">{t('ordersAdmin.editOrder', 'Edit Order')}</h2><button type="button" onClick={() => setIsEditOpen(false)} className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div>
            <div className="mt-5 space-y-4">
              <label className="block"><span className="mb-1.5 block text-xs font-bold text-foreground">{t('ordersAdmin.merchant', 'Merchant')}</span><select required value={editForm.merchantId} onChange={(event) => setEditForm((form) => ({ ...form, merchantId: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary">{merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.companyName || merchant.email}</option>)}</select></label>
              <label className="block"><span className="mb-1.5 block text-xs font-bold text-foreground">{t('ordersAdmin.customer', 'Customer')}</span><input required value={editForm.customerName} onChange={(event) => setEditForm((form) => ({ ...form, customerName: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" /></label>
              <div className="block"><label htmlFor="edit-customer-phone" className="mb-1.5 block text-xs font-bold text-foreground">{t('ordersAdmin.customerPhone', 'Customer phone')}</label><CustomerPhoneInput id="edit-customer-phone" value={editForm.customerPhone} onChange={(customerPhone) => setEditForm((form) => ({ ...form, customerPhone }))} countryCodeLabel={t('ordersAdmin.countryCode', 'Country code')} phoneNumberLabel={t('ordersAdmin.phoneNumber', 'Phone number')} placeholder={t('ordersAdmin.customerPhonePlaceholder', '591234567')} hint={t('ordersAdmin.customerPhoneHint', 'For +970/+972 enter 9 digits starting with 5. For +962 enter 9 digits starting with 7.')} /></div>
              <label className="block"><span className="mb-1.5 block text-xs font-bold text-foreground">{t('ordersAdmin.externalOrderId', 'External order ID')}</span><input value={editForm.externalOrderId} onChange={(event) => setEditForm((form) => ({ ...form, externalOrderId: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-bold text-foreground">{t('ordersAdmin.status', 'Status')}</span><select value={editForm.status} onChange={(event) => setEditForm((form) => ({ ...form, status: event.target.value as OrderStatus }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary">{STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3"><button type="button" disabled={isSubmitting} onClick={() => setIsEditOpen(false)} className="rounded-xl border border-border px-4 py-3 text-xs font-bold text-foreground hover:bg-muted">{t('ordersAdmin.cancel', 'Cancel')}</button><button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-extrabold text-primary-foreground disabled:opacity-60">{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}{t('ordersAdmin.save', 'Save Changes')}</button></div>
          </form>
        </div>
      )}

      {isDeleteOpen && selectedOrder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><Trash2 className="h-6 w-6" /></div>
            <h2 className="mt-4 text-lg font-extrabold text-foreground">{t('ordersAdmin.deleteTitle', 'Delete Order?')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('ordersAdmin.deleteConfirm', 'This permanently deletes order {{order}} and its generated items. This action cannot be undone.', { order: selectedOrder.externalOrderId || `#${selectedOrder.orderNumber}` })}</p>
            <div className="mt-6 grid grid-cols-2 gap-3"><button disabled={isSubmitting} onClick={() => setIsDeleteOpen(false)} className="rounded-xl border border-border px-4 py-3 text-xs font-bold text-foreground hover:bg-muted">{t('ordersAdmin.cancel', 'Cancel')}</button><button disabled={isSubmitting} onClick={() => void handleDelete()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3 text-xs font-extrabold text-destructive-foreground disabled:opacity-60">{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}{t('ordersAdmin.confirmDelete', 'Delete Permanently')}</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersManagementPage;
