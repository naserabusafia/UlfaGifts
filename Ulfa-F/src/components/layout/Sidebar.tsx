import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Link } from 'react-router-dom';
import {
  Home,
  ShieldCheck,
  User,
  Shield,
  Store,
  Globe,
  LogOut,
  LayoutDashboard,
  Menu,
  ShoppingCart,
  PackagePlus,
  X,
} from 'lucide-react';
import { routesConfig } from '../../routes';
import { useAuth } from '../../context/AuthContext';

const iconMap: Record<string, React.ElementType> = {
  '/': Home,
  '/super-admin/dashboard': ShieldCheck,
  '/super-admin/merchants': Store,
  '/super-admin/orders': ShoppingCart,
  '/merchant/dashboard': Store,
  '/merchant/orders': ShoppingCart,
  '/merchant/orders/new': PackagePlus,
  '/profile': User,
};

export const Sidebar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(nextLang);
  };

  // Only render menu items that the logged in user has access to
  const navRoutes = routesConfig.filter((route) => {
    if (!route.showInNav) return false;
    if (!route.roles || route.roles.length === 0) return true;
    return user && route.roles.includes(user.role);
  });

  return (
    <>
      {/* Mobile Top Header with Hamburger Button */}
      <div className="flex md:hidden items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 py-3 sticky top-0 z-40">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-primary-foreground font-bold shadow-xs">
            U
          </div>
          <span className="text-base font-extrabold text-foreground tracking-tight">
            {t('app.title')}
          </span>
        </Link>

        {/* Hamburger Menu Toggle Button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-xl border border-border p-2 text-foreground/80 hover:bg-muted focus:outline-none transition"
          aria-label="Toggle Burger Menu"
        >
          {mobileOpen ? <X className="h-5 w-5 text-primary" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Main Sidebar (Desktop persistent left panel + Mobile collapsible drawer) */}
      <aside
        className={`w-full border-b border-border bg-card/60 backdrop-blur-md p-4 md:w-64 md:min-h-screen md:border-b-0 md:border-e flex flex-col justify-between shrink-0 ${
          mobileOpen ? 'block' : 'hidden md:flex'
        }`}
      >
        <div className="space-y-6">
          {/* Brand Logo & Title (Desktop Only) */}
          <Link to="/" className="hidden md:flex items-center gap-2.5 px-2 py-1">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-primary-foreground font-bold shadow-sm shadow-primary/20">
              U
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-extrabold tracking-tight text-foreground leading-none">
                {t('app.title')}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium mt-1">
                Portal Dashboard
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="space-y-2">
            <div className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              {t('nav.home', 'Navigation')}
            </div>

            <nav className="flex flex-col gap-1.5">
              {navRoutes.map((route) => {
                const Icon = iconMap[route.path] || LayoutDashboard;

                return (
                  <NavLink
                    key={route.path}
                    to={route.path}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                        isActive
                          ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                          : 'text-foreground/90 hover:bg-muted hover:text-foreground'
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{route.titleKey ? t(route.titleKey) : route.path}</span>
                    </div>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Footer Controls: Language Switcher, User Card, & Logout */}
        <div className="mt-6 space-y-3 pt-4 border-t border-border">
          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="w-full flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition shadow-xs"
            title="Switch Language"
          >
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span>{t('app.language')}</span>
            </div>
            <span className="text-primary font-bold">{i18n.language === 'ar' ? 'EN' : 'عربي'}</span>
          </button>

          {/* Logged In User Info & Logout Button */}
          {isAuthenticated && user && (
            <div className="rounded-2xl border border-border bg-card p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                    <Shield className="h-3.5 w-3.5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-foreground truncate">
                      {user.name || user.email}
                    </p>
                    <p className="text-[10px] text-muted-foreground capitalize truncate">
                      {user.role}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{t('app.logout')}</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
