import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Link } from 'react-router-dom';
import { Globe, Menu, X, Shield, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { routesConfig } from '../../routes';

export const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(nextLang);
  };

  // Only show nav items that the user is permitted to view
  const navRoutes = routesConfig.filter((route) => {
    if (!route.showInNav) return false;
    if (!route.roles || route.roles.length === 0) return true;
    return user && route.roles.includes(user.role);
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand & Mobile Menu Toggle */}
        <div className="flex items-center gap-3">
          {navRoutes.length > 0 && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-foreground/80 hover:bg-muted sm:hidden"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}

          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-primary-foreground font-bold shadow-xs">
              U
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              {t('app.title')}
            </span>
          </Link>
        </div>

        {/* Desktop Navigation Links (Allowed Routes Only) */}
        <nav className="hidden items-center gap-1 sm:flex">
          {navRoutes.map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              className={({ isActive }) =>
                `relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <span>{route.titleKey ? t(route.titleKey) : route.path}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* User Status Pill if logged in */}
          {isAuthenticated && user && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="capitalize">{t(`app.${user.role}`) || user.role}</span>
            </div>
          )}

          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition shadow-xs"
            title="Switch Language"
          >
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{i18n.language === 'ar' ? 'EN' : 'عربي'}</span>
          </button>

          {/* User Auth Action Button */}
          {isAuthenticated ? (
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition"
              title={t('app.logout')}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('app.logout')}</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90 transition"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{t('nav.login')}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Responsive Navigation Drawer */}
      {mobileMenuOpen && navRoutes.length > 0 && (
        <div className="border-t border-border bg-card px-4 py-3 sm:hidden space-y-2 animate-in slide-in-from-top-2">
          <div className="text-[10px] uppercase font-bold text-muted-foreground px-2">Navigation</div>
          {navRoutes.map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition ${
                  isActive ? 'bg-primary/10 text-primary font-bold' : 'text-foreground hover:bg-muted'
                }`
              }
            >
              <span>{route.titleKey ? t(route.titleKey) : route.path}</span>
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
};
