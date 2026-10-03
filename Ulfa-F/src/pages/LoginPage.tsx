import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Mail, Lock, Loader2, AlertCircle, CheckCircle2, ArrowRight, ShieldAlert, X } from 'lucide-react';
import { useAuth, type UserRole } from '../context/AuthContext';
import type { AxiosError } from 'axios';

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { login, isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI & Validation State
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);

  /**
   * Helper function for role-based redirection
   */
  const handleRoleRedirection = (role: UserRole) => {
    const fromPath = (location.state as { from?: { pathname: string } })?.from?.pathname;

    if (fromPath && fromPath !== '/login') {
      navigate(fromPath, { replace: true });
      return;
    }

    switch (role) {
      case 'SUPER_ADMIN':
      case 'admin':
        navigate('/super-admin/dashboard', { replace: true });
        break;
      case 'MERCHANT':
      case 'manager':
      case 'user':
        navigate('/merchant/dashboard', { replace: true });
        break;
      default:
        navigate('/unauthorized', { replace: true });
        break;
    }
  };

  /**
   * Validate inputs before API call
   */
  const validateForm = (): boolean => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');
    setApiError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setEmailError(t('login.invalidEmail'));
      isValid = false;
    }

    if (!password || password.length < 6) {
      setPasswordError(t('login.passwordRequired'));
      isValid = false;
    }

    return isValid;
  };

  /**
   * Form Submission Handler calling signin endpoint
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setApiError('');

    try {
      const loggedInUser = await login({
        email: email.trim(),
        password: password,
      });

      if ((loggedInUser as any).status === 'INACTIVE' || (loggedInUser as any).isActive === false) {
        logout();
        setIsInactiveModalOpen(true);
        return;
      }

      handleRoleRedirection(loggedInUser.role);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string; error?: string }>;
      const serverMsg =
        axiosErr.response?.data?.message ||
        axiosErr.response?.data?.error ||
        (err as Error)?.message ||
        '';

      if (serverMsg.includes('ACCOUNT_INACTIVE') || serverMsg.includes('INACTIVE')) {
        setIsInactiveModalOpen(true);
      } else {
        setApiError(serverMsg || t('login.loginError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6 pt-4 sm:pt-8 px-2 sm:px-0">
      {/* Header section */}
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-tr from-primary to-indigo-600 text-primary-foreground shadow-md shadow-primary/20">
          <LogIn className="h-7 w-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {t('login.title')}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground px-4">
          {t('login.subtitle')}
        </p>
      </div>

      {/* If User is already authenticated */}
      {isAuthenticated && user ? (
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('login.loggedAsInfo')}</p>
            <p className="text-base font-bold text-foreground">{user.email}</p>
            <span className="inline-block text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full capitalize">
              Role: {user.role}
            </span>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => handleRoleRedirection(user.role)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-xs cursor-pointer"
            >
              <span>Dashboard</span>
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </button>
            <button
              onClick={logout}
              className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            >
              {t('app.logout')}
            </button>
          </div>
        </div>
      ) : (
        /* Login Form Card */
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-5">
          {apiError && (
            <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                {t('login.emailLabel')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:right-3.5 rtl:left-auto" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('login.emailPlaceholder')}
                  className="w-full rounded-2xl border border-border bg-background py-2.5 ps-10 pe-4 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {emailError && <p className="text-[11px] font-semibold text-destructive">{emailError}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                {t('login.passwordLabel')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:right-3.5 rtl:left-auto" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.passwordPlaceholder')}
                  className="w-full rounded-2xl border border-border bg-background py-2.5 ps-10 pe-4 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {passwordError && <p className="text-[11px] font-semibold text-destructive">{passwordError}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('login.signingIn')}</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>{t('login.submitBtn')}</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Inactive Merchant Account Alert Dialog */}
      {isInactiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-5 relative text-foreground">
            <button
              onClick={() => setIsInactiveModalOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-3 text-center sm:text-left">
              <div className="mx-auto sm:mx-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <ShieldAlert className="h-7 w-7 stroke-[2]" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-destructive tracking-tight">
                  {t('login.inactiveModalTitle', 'Merchant Account Inactive')}
                </h3>
                <p className="text-xs font-semibold text-foreground/90 leading-relaxed">
                  {t(
                    'login.inactiveModalMessage',
                    'This merchant account has been temporarily suspended by the system administrator. Access has been blocked and no authentication token was issued.'
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground font-medium">
                {t(
                  'login.inactiveModalContact',
                  'Please contact system support or your super admin to reactivate your account.'
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsInactiveModalOpen(false)}
                className="w-full sm:w-auto rounded-xl bg-destructive px-5 py-2.5 text-xs font-extrabold text-white hover:bg-destructive/90 transition shadow-md cursor-pointer"
              >
                {t('login.dismiss', 'Dismiss')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
