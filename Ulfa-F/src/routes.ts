import React from 'react';
import { type UserRole } from './context/AuthContext';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SuperAdminDashboardPage } from './pages/SuperAdminDashboardPage';
import { MerchantsManagementPage } from './pages/MerchantsManagementPage';
import { OrdersManagementPage } from './pages/OrdersManagementPage';
import { MerchantDashboardPage } from './pages/MerchantDashboardPage';
import { CreateMerchantOrderPage } from './pages/CreateMerchantOrderPage';
import { MerchantOrdersManagementPage } from './pages/MerchantOrdersManagementPage';
import { MerchantQuotaRequestsPage } from './pages/MerchantQuotaRequestsPage';
import { MerchantIntegrationKeysPage } from './pages/MerchantIntegrationKeysPage';
import { QuotaRequestsAdminPage } from './pages/QuotaRequestsAdminPage';
import { ProfilePage } from './pages/ProfilePage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { NfcExperiencePage } from './features/nfc-experience/NfcExperiencePage';
// Loaded only by buyers preparing a gift; recipients never download it.
const SetupPage = React.lazy(() => import('./features/nfc-setup/SetupPage').then((m) => ({ default: m.SetupPage })));

export interface RouteConfigItem {
  path: string;
  element: React.ReactNode;
  roles?: UserRole[];
  titleKey?: string;
  showInNav?: boolean;
  /** Left out of the nav for merchants on an unlimited quota. */
  limitedQuotaOnly?: boolean;
}

export const routesConfig: RouteConfigItem[] = [
  {
    path: '/',
    element: React.createElement(HomePage),
    showInNav: false,
  },
  {
    path: '/login',
    element: React.createElement(LoginPage),
    titleKey: 'nav.login',
    showInNav: false,
  },
  {
    path: '/nfc/:nfcId',
    element: React.createElement(NfcExperiencePage),
    showInNav: false,
  },
  {
    path: '/setup/:token',
    element: React.createElement(React.Suspense, { fallback: null }, React.createElement(SetupPage)),
    showInNav: false,
  },
  {
    path: '/super-admin/dashboard',
    element: React.createElement(SuperAdminDashboardPage),
    roles: ['SUPER_ADMIN', 'admin'],
    titleKey: 'nav.superAdminDashboard',
    showInNav: true,
  },
  {
    path: '/super-admin/merchants',
    element: React.createElement(MerchantsManagementPage),
    roles: ['SUPER_ADMIN', 'admin'],
    titleKey: 'nav.merchantsManagement',
    showInNav: true,
  },
  {
    path: '/super-admin/orders',
    element: React.createElement(OrdersManagementPage),
    roles: ['SUPER_ADMIN', 'admin'],
    titleKey: 'nav.ordersManagement',
    showInNav: true,
  },
  {
    path: '/super-admin/orders/new',
    element: React.createElement(CreateMerchantOrderPage),
    roles: ['SUPER_ADMIN', 'admin'],
    titleKey: 'nav.createOrder',
    showInNav: true,
  },
  {
    path: '/super-admin/quota-requests',
    element: React.createElement(QuotaRequestsAdminPage),
    roles: ['SUPER_ADMIN', 'admin'],
    titleKey: 'nav.quotaRequests',
    showInNav: true,
  },
  {
    path: '/merchant/dashboard',
    element: React.createElement(MerchantDashboardPage),
    roles: ['MERCHANT', 'manager'],
    titleKey: 'nav.merchantDashboard',
    showInNav: true,
  },
  {
    path: '/merchant/orders',
    element: React.createElement(MerchantOrdersManagementPage),
    roles: ['MERCHANT', 'manager'],
    titleKey: 'nav.merchantOrders',
    showInNav: true,
  },
  {
    path: '/merchant/orders/new',
    element: React.createElement(CreateMerchantOrderPage),
    roles: ['MERCHANT', 'manager'],
    titleKey: 'nav.createOrder',
    showInNav: true,
  },
  {
    path: '/merchant/quota',
    element: React.createElement(MerchantQuotaRequestsPage),
    roles: ['MERCHANT', 'manager'],
    titleKey: 'nav.requestQuota',
    showInNav: true,
    limitedQuotaOnly: true,
  },
  {
    path: '/merchant/integrations',
    element: React.createElement(MerchantIntegrationKeysPage),
    roles: ['MERCHANT', 'manager'],
    titleKey: 'nav.integrations',
    showInNav: true,
  },
  {
    path: '/profile',
    element: React.createElement(ProfilePage),
    roles: ['SUPER_ADMIN', 'MERCHANT', 'admin', 'manager', 'user'],
    titleKey: 'nav.profile',
    showInNav: true,
  },
  {
    path: '/unauthorized',
    element: React.createElement(UnauthorizedPage),
    showInNav: false,
  },
  {
    path: '*',
    element: React.createElement(NotFoundPage),
    showInNav: false,
  },
];

export default routesConfig;
