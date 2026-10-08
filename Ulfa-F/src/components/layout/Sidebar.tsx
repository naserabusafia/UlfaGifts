import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Link } from 'react-router-dom';
import {
  Home,
  ShieldCheck,
  User,
  Store,
  Globe,
  LogOut,
  LayoutDashboard,
  Menu,
  ShoppingCart,
  PackagePlus,
  TicketPlus,
  KeyRound,
  X,
} from 'lucide-react';
import { routesConfig } from '../../routes';
import './sidebar.css';
import { useAuth } from '../../context/AuthContext';
import { quotaRequestService } from '../../features/quota/quotaRequestService';

const iconMap: Record<string, React.ElementType> = {
  '/': Home,
  '/super-admin/dashboard': ShieldCheck,
  '/super-admin/merchants': Store,
  '/super-admin/orders': ShoppingCart,
  '/merchant/dashboard': Store,
  '/merchant/orders': ShoppingCart,
  '/merchant/orders/new': PackagePlus,
  '/super-admin/orders/new': PackagePlus,
  '/super-admin/quota-requests': TicketPlus,
  '/merchant/quota': TicketPlus,
  '/merchant/integrations': KeyRound,
  '/profile': User,
};

export const Sidebar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingQuota, setPendingQuota] = useState(0);
  const isAdminRole = user?.role === 'SUPER_ADMIN' || user?.role === 'admin';

  // Admins see how many quota requests are waiting, refreshed now and then
  // and whenever the requests page answers one.
  useEffect(() => {
    if (!isAdminRole) return;
    let active = true;
    const refresh = () => {
      quotaRequestService
        .pendingCount()
        .then((count) => { if (active) setPendingQuota(count); })
        .catch(() => undefined);
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('quota-requests:changed', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('quota-requests:changed', refresh);
    };
  }, [isAdminRole]);

  // While the mobile drawer is open: the page behind stays put, Escape closes it,
  // and growing to desktop width closes it too.
  useEffect(() => {
    if (!mobileOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false); };
    const desktop = window.matchMedia('(min-width: 768px)');
    const onWide = () => { if (desktop.matches) setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    desktop.addEventListener('change', onWide);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
      desktop.removeEventListener('change', onWide);
    };
  }, [mobileOpen]);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(nextLang);
  };

  // Only render menu items that the logged in user has access to
  const navRoutes = routesConfig.filter((route) => {
    if (!route.showInNav) return false;
    if (route.limitedQuotaOnly && (user?.isUnlimitedQuota || user?.totalQuota === 'unlimited')) return false;
    if (!route.roles || route.roles.length === 0) return true;
    return user && route.roles.includes(user.role);
  });

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'admin';
  const isMerchant = user?.role === 'MERCHANT' || user?.role === 'manager';
  const homePath = isAdmin ? '/super-admin/dashboard' : isMerchant ? '/merchant/dashboard' : '/';
  const portalLabel = isAdmin ? t('portal.side.admin') : isMerchant ? t('portal.side.merchant') : t('portal.side.account');
  const displayName = user?.companyName || user?.name || user?.email || '';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <>
      {/* Mobile top bar with menu toggle */}
      <div className="ps-mobilebar">
        <Link to={homePath} className="ps-brand" onClick={() => setMobileOpen(false)}>
          <span className="ps-wordmark">Ulfa</span>
          <span className="ps-portal">{portalLabel}</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="ps-iconbtn"
          aria-label="Toggle Burger Menu"
          aria-expanded={mobileOpen}
          aria-controls="portal-sidebar"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && <div className="ps-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />}

      {/* Sidebar: persistent on desktop, fixed drawer on mobile */}
      <aside id="portal-sidebar" className={`ps-side ${mobileOpen ? 'is-open' : ''}`}>
        <div className="ps-top">
          <div className="ps-drawer-head">
            <Link to={homePath} className="ps-brand ps-brand--drawer" onClick={() => setMobileOpen(false)}>
              <span className="ps-wordmark">Ulfa</span>
              <span className="ps-portal">{portalLabel}</span>
            </Link>
            <button onClick={() => setMobileOpen(false)} className="ps-iconbtn" aria-label={t('merchantOrders.close', 'Close')}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <Link to={homePath} className="ps-brand">
            <span className="ps-wordmark">Ulfa</span>
            <span className="ps-portal">{portalLabel}</span>
          </Link>

          <nav className="ps-nav" aria-label={t('nav.home', 'Navigation')}>
            {navRoutes.map((route) => {
              const Icon = iconMap[route.path] || LayoutDashboard;

              return (
                <NavLink
                  key={route.path}
                  to={route.path}
                  end
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `ps-link ${isActive ? 'is-active' : ''}`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  <span>{route.titleKey ? t(route.titleKey) : route.path}</span>
                  {route.path === '/super-admin/quota-requests' && pendingQuota > 0 && (
                    <span className="ps-badge" aria-label={t('quotaRequests.pendingBadge', { count: pendingQuota })}>{pendingQuota}</span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="ps-foot">
          <button onClick={toggleLanguage} className="ps-lang" title="Switch Language">
            <Globe className="h-4 w-4" strokeWidth={1.75} />
            <span>{t('app.language')}</span>
            <b>{i18n.language === 'ar' ? 'EN' : 'عربي'}</b>
          </button>

          {isAuthenticated && user && (
            <div className="ps-user">
              <span className="ps-avatar" aria-hidden="true">{initial}</span>
              <div className="ps-user__text">
                <b>{displayName}</b>
                <small>{user.email !== displayName ? user.email : portalLabel}</small>
              </div>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="ps-iconbtn ps-logout"
                title={t('app.logout')}
                aria-label={t('app.logout')}
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
