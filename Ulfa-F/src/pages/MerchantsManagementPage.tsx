import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { userService } from '../features/dashboard/services/userService';
import { type MerchantUser, type QuotaLog } from '../features/dashboard/types';
import {
  Store,
  Plus,
  History,
  Search,
  RefreshCw,
  Edit,
  Power,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Layers,
  Calendar,
  UserCheck,
  FileText,
  X,
  AlertTriangle,
  UserPlus,
  Infinity as InfinityIcon,
  PieChart,
  SlidersHorizontal,
  KeyRound,
  RotateCcw,
} from 'lucide-react';

export const MerchantsManagementPage: React.FC = () => {
  const { t } = useTranslation();

  // State
  const [merchants, setMerchants] = useState<MerchantUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'PENDING_PASSWORD_SET' | 'UNLIMITED'>('ALL');

  // Modals state
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantUser | null>(null);
  
  // Modal 1: Edit Merchant
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<{
    companyName: string;
    email: string;
    totalQuota: number;
    isUnlimitedQuota: boolean;
    status: 'ACTIVE' | 'INACTIVE' | 'PENDING_PASSWORD_SET';
  }>({
    companyName: '',
    email: '',
    totalQuota: 100,
    isUnlimitedQuota: false,
    status: 'ACTIVE',
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  // Modal 2: Toggle Status / Soft Delete Confirmation
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState<boolean>(false);

  // Modal 3: Add Quota
  const [isAddQuotaOpen, setIsAddQuotaOpen] = useState<boolean>(false);
  const [quotaAmount, setQuotaAmount] = useState<number>(100);
  const [quotaNotes, setQuotaNotes] = useState<string>('');
  const [isSubmittingQuota, setIsSubmittingQuota] = useState<boolean>(false);
  const [addQuotaSuccess, setAddQuotaSuccess] = useState<boolean>(false);

  // Modal 4: Quota Logs
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [quotaLogs, setQuotaLogs] = useState<QuotaLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

  // Modal 5: Create Merchant
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState<{
    companyName: string;
    email: string;
    password?: string;
    totalQuota: number;
    isUnlimitedQuota: boolean;
  }>({
    companyName: '',
    email: '',
    password: '',
    totalQuota: 100,
    isUnlimitedQuota: false,
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  // Modal 6: Reset Password
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState<boolean>(false);
  const [isSubmittingReset, setIsSubmittingReset] = useState<boolean>(false);

  // Initial Data Fetch
  const fetchMerchants = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data: any = await userService.getMerchants(1, 100);
      let items: MerchantUser[] = Array.isArray(data)
        ? data
        : data?.items || data?.data?.items || [];
      
      if (items.length > 0) {
        items = items.map((m) => ({
          ...m,
          status: m.status || (m.isActive === false ? 'INACTIVE' : 'ACTIVE'),
        }));
        setMerchants(items);
      } else {
        // Only set default initial items if merchants state is currently empty
        setMerchants((prev) => (prev.length > 0 ? prev : [
          {
            id: 'mch-101',
            companyName: 'متجر الأنوار للتجارة',
            email: 'alanwar@ulfa.app',
            role: 'MERCHANT',
            isUnlimitedQuota: false,
            totalQuota: 500,
            usedLinks: 120,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'mch-102',
            companyName: 'حلول التقنية المتقدمة',
            email: 'tech@ulfa.app',
            role: 'MERCHANT',
            isUnlimitedQuota: true,
            totalQuota: 0,
            usedLinks: 840,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'mch-103',
            companyName: 'مكتبة الخليج العربي',
            email: 'gulfbooks@ulfa.app',
            role: 'MERCHANT',
            isUnlimitedQuota: false,
            totalQuota: 150,
            usedLinks: 148,
            status: 'INACTIVE',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'mch-104',
            companyName: 'شركة البسمة للخدمات',
            email: 'albasma@ulfa.app',
            role: 'MERCHANT',
            isUnlimitedQuota: false,
            totalQuota: 300,
            usedLinks: 45,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          },
        ]));
      }
    } catch (err: any) {
      console.error('Failed to load merchants:', err);
      setErrorMessage(t('superAdmin.noMerchants', 'Could not fetch merchants list from server.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Filtered merchants
  const filteredMerchants = useMemo(() => {
    return merchants.filter((m) => {
      const matchSearch =
        (m.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.id.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      const mStatus = m.status || (m.isActive === false ? 'INACTIVE' : 'ACTIVE');

      if (statusFilter === 'ACTIVE') return mStatus === 'ACTIVE';
      if (statusFilter === 'INACTIVE') return mStatus === 'INACTIVE';
      if (statusFilter === 'PENDING_PASSWORD_SET') return mStatus === 'PENDING_PASSWORD_SET';
      if (statusFilter === 'UNLIMITED') return m.isUnlimitedQuota;
      return true;
    });
  }, [merchants, searchTerm, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = merchants.length;
    const active = merchants.filter((m) => (m.status || (m.isActive === false ? 'INACTIVE' : 'ACTIVE')) === 'ACTIVE').length;
    const inactive = total - active;
    const unlimited = merchants.filter((m) => m.isUnlimitedQuota).length;
    const totalQuotaSum = merchants.reduce((sum, m) => sum + (m.totalQuota || 0), 0);
    return { total, active, inactive, unlimited, totalQuotaSum };
  }, [merchants]);

  // Handle Edit Merchant Open
  const handleOpenEdit = (merchant: MerchantUser) => {
    setSelectedMerchant(merchant);
    setEditForm({
      companyName: merchant.companyName || '',
      email: merchant.email,
      totalQuota: merchant.totalQuota || 0,
      isUnlimitedQuota: merchant.isUnlimitedQuota || false,
      status: merchant.status || (merchant.isActive === false ? 'INACTIVE' : 'ACTIVE'),
    });
    setIsEditOpen(true);
  };

  // Submit Edit Merchant
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchant) return;
    setIsSubmittingEdit(true);

    const payload = {
      companyName: editForm.companyName.trim(),
      email: editForm.email.trim(),
      totalQuota: Number(editForm.totalQuota),
      isUnlimitedQuota: editForm.isUnlimitedQuota,
      status: editForm.status,
    };

    try {
      const updatedResponse: any = await userService.updateMerchant(selectedMerchant.id, payload);

      setMerchants((prev) =>
        prev.map((m) =>
          m.id === selectedMerchant.id
            ? {
                ...m,
                ...payload,
                ...(typeof updatedResponse === 'object' ? updatedResponse : {}),
                companyName: updatedResponse?.companyName || payload.companyName,
                email: updatedResponse?.email || payload.email,
                totalQuota: updatedResponse?.totalQuota !== undefined ? updatedResponse.totalQuota : payload.totalQuota,
                isUnlimitedQuota: updatedResponse?.isUnlimitedQuota !== undefined ? updatedResponse.isUnlimitedQuota : payload.isUnlimitedQuota,
                status: updatedResponse?.status || payload.status,
                isActive: (updatedResponse?.status || payload.status) === 'ACTIVE',
              }
            : m
        )
      );

      setIsEditOpen(false);
      showToast(t('superAdmin.merchantUpdated', 'Merchant updated successfully'));
    } catch (err: any) {
      console.error('Edit error:', err);
      const msg = err.response?.data?.message || 'Failed to update merchant details';
      showToast(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Soft Delete / Status Toggle Open
  const handleOpenStatusModal = (merchant: MerchantUser) => {
    setSelectedMerchant(merchant);
    setIsStatusModalOpen(true);
  };

  // Submit Status Toggle
  const handleToggleStatusSubmit = async () => {
    if (!selectedMerchant) return;
    setIsSubmittingStatus(true);
    const currentStatus = selectedMerchant.status || (selectedMerchant.isActive === false ? 'INACTIVE' : 'ACTIVE');
    const newStatus: 'ACTIVE' | 'INACTIVE' = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      await userService.toggleMerchantStatus(selectedMerchant.id, newStatus);
      setMerchants((prev) =>
        prev.map((m) =>
          m.id === selectedMerchant.id ? { ...m, status: newStatus, isActive: newStatus === 'ACTIVE' } : m
        )
      );
      setIsStatusModalOpen(false);
      showToast(t('superAdmin.statusUpdated', 'Merchant status updated successfully'));
    } catch (err: any) {
      console.error('Status update error:', err);
      const msg = err.response?.data?.message || 'Failed to update status';
      showToast(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Handle Open Add Quota
  const handleOpenAddQuota = (merchant: MerchantUser) => {
    setSelectedMerchant(merchant);
    setQuotaAmount(100);
    setQuotaNotes('');
    setAddQuotaSuccess(false);
    setIsAddQuotaOpen(true);
  };

  // Submit Add Quota
  const handleAddQuotaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchant || !quotaAmount) return;

    setIsSubmittingQuota(true);
    try {
      await userService.addQuota(selectedMerchant.id, Number(quotaAmount), quotaNotes.trim() || undefined);
      
      // Update local state
      setMerchants((prev) =>
        prev.map((m) =>
          m.id === selectedMerchant.id
            ? { ...m, totalQuota: (m.totalQuota || 0) + Number(quotaAmount) }
            : m
        )
      );

      setAddQuotaSuccess(true);
      setTimeout(() => {
        setIsAddQuotaOpen(false);
        setAddQuotaSuccess(false);
        showToast(t('superAdmin.successAddQuota', 'Quota updated successfully!'));
      }, 1000);
    } catch (err) {
      console.error('Add quota error:', err);
    } finally {
      setIsSubmittingQuota(false);
    }
  };

  // Handle Open History
  const handleOpenHistory = async (merchant: MerchantUser) => {
    setSelectedMerchant(merchant);
    setIsHistoryOpen(true);
    setIsLoadingLogs(true);
    try {
      const res: any = await userService.getQuotaLogs(merchant.id);
      const logsList = Array.isArray(res) ? res : res?.data || [];
      setQuotaLogs(logsList);
    } catch (err) {
      console.error('Failed logs fetch:', err);
      setQuotaLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Handle Create Merchant Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.email) return;

    setIsSubmittingCreate(true);
    try {
      const payload: any = {
        companyName: createForm.companyName.trim(),
        email: createForm.email.trim(),
        totalQuota: Number(createForm.totalQuota),
        isUnlimitedQuota: createForm.isUnlimitedQuota,
        status: 'PENDING_PASSWORD_SET',
      };
      if (createForm.password?.trim()) {
        payload.password = createForm.password.trim();
      }

      const newMch: MerchantUser = await userService.createMerchant(payload);

      const formattedNew: MerchantUser = {
        ...newMch,
        id: newMch?.id || `mch-${Date.now()}`,
        companyName: newMch?.companyName || createForm.companyName.trim() || createForm.email.split('@')[0],
        email: newMch?.email || createForm.email.trim(),
        role: 'MERCHANT',
        isUnlimitedQuota: newMch?.isUnlimitedQuota ?? createForm.isUnlimitedQuota,
        totalQuota: newMch?.totalQuota ?? Number(createForm.totalQuota),
        usedLinks: newMch?.usedLinks ?? 0,
        status: newMch?.status || 'PENDING_PASSWORD_SET',
        isActive: true,
        createdAt: newMch?.createdAt || new Date().toISOString(),
      };

      setMerchants((prev) => [formattedNew, ...prev]);
      setIsCreateOpen(false);
      setCreateForm({ companyName: '', email: '', password: '', totalQuota: 100, isUnlimitedQuota: false });
      showToast(t('superAdmin.merchantCreated', 'Merchant account created successfully'));
    } catch (err: any) {
      console.error('Create error:', err);
      const msg = err.response?.data?.message || 'Failed to create merchant account';
      showToast(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Handle Open Reset Password Modal
  const handleOpenResetPasswordModal = (merchant: MerchantUser) => {
    setSelectedMerchant(merchant);
    setIsResetPasswordOpen(true);
  };

  // Submit Reset Password
  const handleResetPasswordSubmit = async () => {
    if (!selectedMerchant) return;
    setIsSubmittingReset(true);
    try {
      await userService.resetMerchantPassword(selectedMerchant.id);
      setMerchants((prev) =>
        prev.map((m) =>
          m.id === selectedMerchant.id ? { ...m, status: 'PENDING_PASSWORD_SET' } : m
        )
      );
      setIsResetPasswordOpen(false);
      showToast(t('superAdmin.resetSuccessToast', 'Password reset to Merchant123! successfully.'));
    } catch (err: any) {
      console.error('Reset password error:', err);
      const msg = err.response?.data?.message || 'Failed to reset password';
      showToast(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmittingReset(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-xl animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-3xl border border-border bg-gradient-to-r from-primary/15 via-purple-500/10 to-card p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <ShieldCheck className="h-4 w-4" />
              <span>{t('superAdmin.badge', 'Super Admin Portal')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
              <Store className="h-7 w-7 text-primary" />
              <span>{t('superAdmin.merchantsManagement', 'Merchants & Quota Management')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t(
                'superAdmin.merchantsSubtitle',
                'Comprehensive management of active merchants, status toggles, edits, and quota allocation.'
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>{t('superAdmin.addNewMerchant', 'Add Merchant')}</span>
            </button>
            <button
              onClick={fetchMerchants}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 text-primary ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-semibold text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Stats Overview Grid - Mobile First Responsive */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Merchants */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('superAdmin.totalUsers', 'Total Merchants')}
            </span>
            <div className="rounded-xl bg-primary/10 p-1.5 text-primary">
              <Store className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-foreground">{stats.total}</p>
        </div>

        {/* Active Merchants */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('superAdmin.active', 'Active')}
            </span>
            <div className="rounded-xl bg-emerald-500/10 p-1.5 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.active}
          </p>
        </div>

        {/* Inactive Merchants */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('superAdmin.inactive', 'Inactive')}
            </span>
            <div className="rounded-xl bg-destructive/10 p-1.5 text-destructive">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-destructive">{stats.inactive}</p>
        </div>

        {/* Total Allocated Quota */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('superAdmin.totalQuota', 'Total Quota')}
            </span>
            <div className="rounded-xl bg-purple-500/10 p-1.5 text-purple-500">
              <PieChart className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-foreground">
            {stats.totalQuotaSum.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Control Toolbar: Search & Filter Tabs */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:right-3.5 rtl:left-auto" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t(
              'superAdmin.searchMerchants',
              'Search merchants by company name or email...'
            )}
            className="w-full rounded-xl border border-border bg-background py-2.5 ps-10 pe-4 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rtl:left-3 rtl:right-auto"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground me-1 shrink-0 hidden sm:block" />
          {[
            { id: 'ALL', label: t('superAdmin.filterAll', 'All') },
            { id: 'ACTIVE', label: t('superAdmin.filterActive', 'Active') },
            { id: 'PENDING_PASSWORD_SET', label: t('superAdmin.pendingPasswordSet', 'Pending Password Set') },
            { id: 'INACTIVE', label: t('superAdmin.filterInactive', 'Inactive') },
            { id: 'UNLIMITED', label: t('superAdmin.filterUnlimited', 'Unlimited') },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Merchants Content List - Mobile First (Cards for Mobile, Table for Desktop) */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary me-2" />
            <span className="text-xs font-semibold">Loading merchants data...</span>
          </div>
        ) : filteredMerchants.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground space-y-2">
            <Store className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="font-bold text-sm">
              {t('superAdmin.noMerchants', 'No matching merchants found.')}
            </p>
            <p className="text-xs text-muted-foreground">Try clearing search or filter terms.</p>
          </div>
        ) : (
          <>
            {/* MOBILE VIEW (Visible on screens < 768px) */}
            <div className="grid grid-cols-1 gap-3.5 md:hidden">
              {filteredMerchants.map((merchant) => {
                const isActive = (merchant.status || (merchant.isActive === false ? 'INACTIVE' : 'ACTIVE')) === 'ACTIVE';
                const used = merchant.usedLinks || 0;
                const total = merchant.totalQuota || 0;
                const available = merchant.isUnlimitedQuota ? '∞' : Math.max(0, total - used);
                const percent = merchant.isUnlimitedQuota ? 0 : total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

                return (
                  <div
                    key={merchant.id}
                    className={`rounded-2xl border bg-card p-4 space-y-3.5 shadow-xs transition ${
                      isActive ? 'border-border' : 'border-destructive/30 bg-destructive/5'
                    }`}
                  >
                    {/* Top Row: Merchant Info & Status Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5 overflow-hidden">
                        <h3 className="font-extrabold text-foreground text-sm truncate">
                          {merchant.companyName || merchant.email.split('@')[0]}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono truncate">{merchant.email}</p>
                        <span className="inline-block text-[10px] text-muted-foreground/80 font-mono">
                          ID: {merchant.id}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <button
                        onClick={() => handleOpenStatusModal(merchant)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold shrink-0 transition cursor-pointer ${
                          merchant.status === 'PENDING_PASSWORD_SET'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : isActive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                        }`}
                      >
                        {merchant.status === 'PENDING_PASSWORD_SET' ? (
                          <>
                            <KeyRound className="h-3 w-3" />
                            <span>{t('superAdmin.pendingPasswordSet', 'Pending Password Set')}</span>
                          </>
                        ) : isActive ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{t('superAdmin.active', 'Active')}</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" />
                            <span>{t('superAdmin.inactive', 'Inactive')}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Quota Progress Bar & Stats */}
                    <div className="rounded-xl border border-border/70 bg-background/60 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-muted-foreground">{t('superAdmin.totalQuota', 'Quota')}</span>
                        {merchant.isUnlimitedQuota ? (
                          <span className="inline-flex items-center gap-1 font-extrabold text-purple-600 dark:text-purple-400">
                            <InfinityIcon className="h-3.5 w-3.5" /> Unlimited
                          </span>
                        ) : (
                          <span className="font-extrabold text-foreground">
                            {used} / {total} (Avail: {available})
                          </span>
                        )}
                      </div>

                      {!merchant.isUnlimitedQuota && (
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              percent > 85 ? 'bg-amber-500' : 'bg-primary'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Mobile Action Buttons Grid */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      <button
                        onClick={() => handleOpenEdit(merchant)}
                        className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background py-2 text-[10px] font-bold text-foreground hover:bg-muted transition cursor-pointer"
                      >
                        <Edit className="h-3.5 w-3.5 text-primary" />
                        <span>{t('superAdmin.editMerchant', 'Edit')}</span>
                      </button>

                      <button
                        onClick={() => handleOpenStatusModal(merchant)}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2 text-[10px] font-bold transition cursor-pointer ${
                          isActive
                            ? 'border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20'
                            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        <Power className="h-3.5 w-3.5" />
                        <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                      </button>

                      <button
                        onClick={() => handleOpenAddQuota(merchant)}
                        className="flex flex-col items-center justify-center gap-1 rounded-xl bg-primary py-2 text-[10px] font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5 stroke-[3]" />
                        <span>{t('superAdmin.addQuota', '+Quota')}</span>
                      </button>

                      <button
                        onClick={() => handleOpenHistory(merchant)}
                        className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background py-2 text-[10px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                      >
                        <History className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{t('superAdmin.quotaHistory', 'Logs')}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP VIEW (Visible on screens >= 768px) */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-muted/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3">{t('superAdmin.merchant', 'Merchant')}</th>
                    <th className="px-4 py-3">{t('superAdmin.status', 'Status')}</th>
                    <th className="px-4 py-3">{t('superAdmin.totalQuota', 'Total Quota')}</th>
                    <th className="px-4 py-3">{t('superAdmin.usedLinks', 'Used')}</th>
                    <th className="px-4 py-3">{t('superAdmin.availableLinks', 'Available')}</th>
                    <th className="px-4 py-3 text-right">{t('superAdmin.actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {filteredMerchants.map((merchant) => {
                    const isActive = (merchant.status || (merchant.isActive === false ? 'INACTIVE' : 'ACTIVE')) === 'ACTIVE';
                    const available = merchant.isUnlimitedQuota
                      ? '∞'
                      : Math.max(0, (merchant.totalQuota || 0) - (merchant.usedLinks || 0));

                    return (
                      <tr
                        key={merchant.id}
                        className={`hover:bg-muted/40 transition ${
                          !isActive ? 'bg-destructive/5' : ''
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-foreground">
                            {merchant.companyName || merchant.email.split('@')[0]}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {merchant.email}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => handleOpenStatusModal(merchant)}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold transition cursor-pointer ${
                              merchant.status === 'PENDING_PASSWORD_SET'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : isActive
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-destructive/10 text-destructive border border-destructive/20'
                            }`}
                          >
                            {merchant.status === 'PENDING_PASSWORD_SET' ? (
                              <>
                                <KeyRound className="h-3 w-3" />
                                <span>{t('superAdmin.pendingPasswordSet', 'Pending Password Set')}</span>
                              </>
                            ) : isActive ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                <span>{t('superAdmin.active', 'Active')}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3" />
                                <span>{t('superAdmin.inactive', 'Inactive')}</span>
                              </>
                            )}
                          </button>
                        </td>

                        <td className="px-4 py-3.5">
                          {merchant.isUnlimitedQuota ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-extrabold text-purple-600 dark:text-purple-400">
                              ∞ Unlimited
                            </span>
                          ) : (
                            <span className="font-extrabold text-foreground">{merchant.totalQuota || 0}</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-muted-foreground">{merchant.usedLinks || 0}</span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{available}</span>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(merchant)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
                              title="Edit Merchant"
                            >
                              <Edit className="h-3.5 w-3.5 text-primary" />
                              <span>{t('superAdmin.editMerchant', 'Edit')}</span>
                            </button>

                            <button
                              onClick={() => handleOpenStatusModal(merchant)}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                                isActive
                                  ? 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20'
                                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                              }`}
                              title="Toggle Account Status"
                            >
                              <Power className="h-3.5 w-3.5" />
                              <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                            </button>

                            <button
                              onClick={() => handleOpenAddQuota(merchant)}
                              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5 stroke-[3]" />
                              <span>{t('superAdmin.addQuota', 'Add Quota')}</span>
                            </button>

                            <button
                              onClick={() => handleOpenHistory(merchant)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
                            >
                              <History className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{t('superAdmin.quotaHistory', 'Logs')}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal 1: Edit Merchant Details Modal */}
      {isEditOpen && selectedMerchant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 relative text-foreground max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsEditOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                <Edit className="h-3.5 w-3.5" />
                <span>Super Admin Edit Control</span>
              </div>
              <h3 className="text-lg font-bold tracking-tight">
                {t('superAdmin.editMerchantTitle', 'Edit Merchant Details')}
              </h3>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              {/* Company Name */}
              <div className="space-y-1">
                <label className="font-bold text-foreground">
                  {t('superAdmin.companyName', 'Company / Store Name')}
                </label>
                <input
                  type="text"
                  required
                  value={editForm.companyName}
                  onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="font-bold text-foreground">
                  {t('superAdmin.email', 'Email Address')}
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Quota & Unlimited Segmented Control */}
              <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-3.5 space-y-3">
                <label className="font-bold text-foreground flex items-center justify-between">
                  <span>{t('superAdmin.unlimitedQuotaLabel', 'Quota Type')}</span>
                  {editForm.isUnlimitedQuota && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-extrabold text-purple-600 dark:text-purple-400">
                      <InfinityIcon className="h-3 w-3" /> Unlimited
                    </span>
                  )}
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, isUnlimitedQuota: false })}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 font-bold transition cursor-pointer ${
                      !editForm.isUnlimitedQuota
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span>محدودة (Limited)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, isUnlimitedQuota: true })}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 font-bold transition cursor-pointer ${
                      editForm.isUnlimitedQuota
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 shadow-xs'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <InfinityIcon className="h-4 w-4" />
                    <span>غير محدودة (Unlimited)</span>
                  </button>
                </div>

                {!editForm.isUnlimitedQuota && (
                  <div className="space-y-1 pt-1 animate-in fade-in">
                    <label className="font-bold text-foreground">
                      {t('superAdmin.totalQuota', 'Total Quota Limit')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.totalQuota}
                      onChange={(e) =>
                        setEditForm({ ...editForm, totalQuota: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2 font-extrabold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              {/* Account Status Switch */}
              <div className="space-y-1">
                <label className="font-bold text-foreground">
                  {t('superAdmin.status', 'Account Status')}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, status: 'ACTIVE' })}
                    className={`flex items-center justify-center gap-1 rounded-xl border p-2 text-[11px] font-bold transition cursor-pointer ${
                      editForm.status === 'ACTIVE'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{t('superAdmin.active', 'Active')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, status: 'PENDING_PASSWORD_SET' })}
                    className={`flex items-center justify-center gap-1 rounded-xl border p-2 text-[11px] font-bold transition cursor-pointer ${
                      editForm.status === 'PENDING_PASSWORD_SET'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>{t('superAdmin.pendingPasswordSet', 'Pending Pass')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, status: 'INACTIVE' })}
                    className={`flex items-center justify-center gap-1 rounded-xl border p-2 text-[11px] font-bold transition cursor-pointer ${
                      editForm.status === 'INACTIVE'
                        ? 'border-destructive bg-destructive/10 text-destructive'
                        : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>{t('superAdmin.inactive', 'Inactive')}</span>
                  </button>
                </div>
              </div>

              {/* Reset Password Action Box Inside Edit Modal */}
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between gap-2">
                <div className="space-y-0.5 overflow-hidden">
                  <div className="font-bold text-amber-700 dark:text-amber-300 text-xs flex items-center gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                    <span>{t('superAdmin.resetPasswordTitle', 'Reset Password')}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {t('superAdmin.resetPasswordTip', 'Reset password to default (Merchant123!)')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditOpen(false);
                    if (selectedMerchant) handleOpenResetPasswordModal(selectedMerchant);
                  }}
                  className="rounded-xl border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/30 transition shrink-0 cursor-pointer"
                >
                  {t('superAdmin.resetPassword', 'Reset')}
                </button>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 font-semibold text-muted-foreground hover:bg-muted transition cursor-pointer"
                >
                  {t('superAdmin.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground hover:bg-primary/90 transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{t('superAdmin.saveChanges', 'Save Changes')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Toggle Status / Soft Delete Confirmation Modal */}
      {isStatusModalOpen && selectedMerchant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 relative text-foreground">
            <button
              onClick={() => setIsStatusModalOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {(() => {
              const currentActive =
                (selectedMerchant.status || (selectedMerchant.isActive === false ? 'INACTIVE' : 'ACTIVE')) === 'ACTIVE';

              return (
                <>
                  <div className="space-y-2 text-center sm:text-left">
                    <div
                      className={`mx-auto sm:mx-0 flex h-12 w-12 items-center justify-center rounded-2xl ${
                        currentActive
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-emerald-500/10 text-emerald-500'
                      }`}
                    >
                      {currentActive ? (
                        <AlertTriangle className="h-6 w-6" />
                      ) : (
                        <CheckCircle2 className="h-6 w-6" />
                      )}
                    </div>
                    <h3 className="text-lg font-bold tracking-tight">
                      {currentActive
                        ? t('superAdmin.deactivateMerchant', 'Deactivate Merchant (Soft Delete)')
                        : t('superAdmin.activateMerchant', 'Reactivate Account')}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {currentActive
                        ? t(
                            'superAdmin.deactivateConfirm',
                            'Are you sure you want to deactivate merchant {{name}}? Their portal access will be temporarily suspended.',
                            { name: selectedMerchant.companyName || selectedMerchant.email }
                          )
                        : t(
                            'superAdmin.activateConfirm',
                            'Are you sure you want to reactivate merchant {{name}}?',
                            { name: selectedMerchant.companyName || selectedMerchant.email }
                          )}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsStatusModalOpen(false)}
                      className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition cursor-pointer"
                    >
                      {t('superAdmin.cancel', 'Cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleStatusSubmit}
                      disabled={isSubmittingStatus}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md transition cursor-pointer disabled:opacity-50 ${
                        currentActive
                          ? 'bg-destructive hover:bg-destructive/90'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      {isSubmittingStatus && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <span>
                        {currentActive
                          ? t('superAdmin.deactivateMerchant', 'Deactivate')
                          : t('superAdmin.activateMerchant', 'Activate')}
                      </span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal 3: Add Quota Modal */}
      {isAddQuotaOpen && selectedMerchant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl space-y-5 relative text-foreground">
            <button
              onClick={() => setIsAddQuotaOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                <Layers className="h-3.5 w-3.5" />
                <span>Quota Adjustment</span>
              </div>
              <h3 className="text-lg font-bold tracking-tight">
                {t('superAdmin.addQuotaModalTitle', 'Assign Quota to {{name}}', {
                  name: selectedMerchant.companyName || selectedMerchant.email,
                })}
              </h3>
            </div>

            {addQuotaSuccess ? (
              <div className="flex flex-col items-center justify-center py-6 space-y-2 text-center text-emerald-500">
                <CheckCircle2 className="h-12 w-12 stroke-[2]" />
                <p className="font-bold text-sm">
                  {t('superAdmin.successAddQuota', 'Quota updated successfully!')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleAddQuotaSubmit} className="space-y-4">
                {/* Presets */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Quick Amount Presets:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[10, 50, 100, 500, -10, -50].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setQuotaAmount(val)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
                          quotaAmount === val
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border text-foreground hover:bg-muted'
                        }`}
                      >
                        {val > 0 ? `+${val}` : val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount input */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    {t('superAdmin.amountLabel', 'Quota Amount Units (+/-)')}
                  </label>
                  <input
                    type="number"
                    required
                    value={quotaAmount}
                    onChange={(e) => setQuotaAmount(Number(e.target.value))}
                    placeholder={t('superAdmin.amountPlaceholder', 'e.g. 100 or -50')}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm font-extrabold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Notes input */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    {t('superAdmin.notesLabel', 'Adjustment Reason / Notes (Optional)')}
                  </label>
                  <textarea
                    rows={2}
                    value={quotaNotes}
                    onChange={(e) => setQuotaNotes(e.target.value)}
                    placeholder={t('superAdmin.notesPlaceholder', 'e.g. Monthly package renewal')}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddQuotaOpen(false)}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition cursor-pointer"
                  >
                    {t('superAdmin.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingQuota}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingQuota && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{t('superAdmin.confirmAddQuota', 'Submit Quota Adjustment')}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal 4: Quota Logs Modal */}
      {isHistoryOpen && selectedMerchant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-xl space-y-5 relative text-foreground max-h-[85vh] flex flex-col">
            <button
              onClick={() => setIsHistoryOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-bold text-purple-500">
                <History className="h-3.5 w-3.5" />
                <span>Audit Trail</span>
              </div>
              <h3 className="text-lg font-bold tracking-tight">
                {t('superAdmin.historyModalTitle', 'Quota Transaction History - {{name}}', {
                  name: selectedMerchant.companyName || selectedMerchant.email,
                })}
              </h3>
            </div>

            {/* Quota Logs Table */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-background">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="sticky top-0 bg-muted text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3">{t('superAdmin.date', 'Date & Time')}</th>
                    <th className="px-4 py-3">{t('superAdmin.amount', 'Amount Added')}</th>
                    <th className="px-4 py-3">{t('superAdmin.admin', 'Admin')}</th>
                    <th className="px-4 py-3">{t('superAdmin.notes', 'Notes / Reason')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {isLoadingLogs ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span>Loading quota history logs...</span>
                        </div>
                      </td>
                    </tr>
                  ) : quotaLogs.length > 0 ? (
                    quotaLogs.map((log) => {
                      const isPositive = log.amount > 0;
                      const formattedDate = new Date(log.createdAt).toLocaleString();
                      return (
                        <tr key={log.id} className="hover:bg-muted/30 transition">
                          <td className="px-4 py-3 text-muted-foreground font-mono whitespace-nowrap flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>{formattedDate}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-black ${
                                isPositive
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-destructive/10 text-destructive'
                              }`}
                            >
                              {isPositive ? `+${log.amount}` : log.amount}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1 text-foreground font-semibold">
                              <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span>{log.admin?.email || log.adminId}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {log.notes ? (
                              <div className="flex items-center gap-1 text-xs">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span>{log.notes}</span>
                              </div>
                            ) : (
                              <span className="italic text-muted-foreground/60">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        {t('superAdmin.noLogs', 'No quota transactions recorded for this merchant.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
              >
                {t('superAdmin.close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Create Merchant Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 relative text-foreground">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                <UserPlus className="h-3.5 w-3.5" />
                <span>New Merchant Account</span>
              </div>
              <h3 className="text-lg font-bold tracking-tight">
                {t('superAdmin.createMerchantTitle', 'Add New Merchant to System')}
              </h3>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-foreground">
                  {t('superAdmin.companyName', 'Company / Store Name')}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Al-Nour Trading"
                  value={createForm.companyName}
                  onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">
                  {t('superAdmin.email', 'Email Address')}
                </label>
                <input
                  type="email"
                  required
                  placeholder="merchant@domain.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground flex items-center justify-between">
                  <span>{t('login.passwordLabel', 'Password')} (Optional)</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Default: Merchant123!</span>
                </label>
                <input
                  type="password"
                  placeholder="Leave empty for default password (Merchant123!)"
                  value={createForm.password || ''}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Quota & Unlimited Segmented Control */}
              <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-3.5 space-y-3">
                <label className="font-bold text-foreground flex items-center justify-between">
                  <span>{t('superAdmin.unlimitedQuotaLabel', 'Quota Type')}</span>
                  {createForm.isUnlimitedQuota && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-extrabold text-purple-600 dark:text-purple-400">
                      <InfinityIcon className="h-3 w-3" /> Unlimited
                    </span>
                  )}
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, isUnlimitedQuota: false })}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 font-bold transition cursor-pointer ${
                      !createForm.isUnlimitedQuota
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span>محدودة (Limited)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, isUnlimitedQuota: true })}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 font-bold transition cursor-pointer ${
                      createForm.isUnlimitedQuota
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 shadow-xs'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <InfinityIcon className="h-4 w-4" />
                    <span>غير محدودة (Unlimited)</span>
                  </button>
                </div>

                {!createForm.isUnlimitedQuota && (
                  <div className="space-y-1 pt-1 animate-in fade-in">
                    <label className="font-bold text-foreground">
                      {t('superAdmin.totalQuota', 'Initial Quota Units')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={createForm.totalQuota}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, totalQuota: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2 font-extrabold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 font-semibold text-muted-foreground hover:bg-muted transition cursor-pointer"
                >
                  {t('superAdmin.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground hover:bg-primary/90 transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCreate && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{t('superAdmin.addNewMerchant', 'Create Merchant')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Reset Password Confirmation Modal */}
      {isResetPasswordOpen && selectedMerchant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-card p-6 shadow-2xl space-y-5 relative text-foreground">
            <button
              onClick={() => setIsResetPasswordOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-3 text-center sm:text-left">
              <div className="mx-auto sm:mx-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <RotateCcw className="h-7 w-7 stroke-[2]" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-extrabold tracking-tight text-foreground">
                  {t('superAdmin.resetPasswordTitle', 'Reset Merchant Password')}
                </h3>
                <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                  {t(
                    'superAdmin.resetPasswordConfirm',
                    'Reset merchant password to default (Merchant123!)?'
                  )}
                </p>
                <div className="pt-1 text-xs font-mono font-bold text-foreground">
                  {selectedMerchant.companyName || selectedMerchant.email}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetPasswordOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition cursor-pointer"
              >
                {t('superAdmin.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={isSubmittingReset}
                onClick={handleResetPasswordSubmit}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-amber-700 transition shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSubmittingReset && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{t('superAdmin.confirmReset', 'Confirm Reset')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MerchantsManagementPage;
