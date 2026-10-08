import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Lock, Loader2, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import userService from '../../features/dashboard/services/userService';

export const FirstLoginPasswordModal: React.FC = () => {
  const { t } = useTranslation();
  const { user, refetchProfile } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Show modal only if user is logged in and status is PENDING_PASSWORD_SET
  if (!user || user.status !== 'PENDING_PASSWORD_SET') {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || newPassword.length < 8) {
      setError(t('auth.passwordMin', 'Password must be at least 8 characters long'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordsMismatch', 'Passwords do not match'));
      return;
    }

    setIsSubmitting(true);

    try {
      await userService.changeFirstLoginPassword(user.id, newPassword);
      setIsSuccess(true);

      setTimeout(async () => {
        await refetchProfile();
      }, 1200);
    } catch (err: any) {
      console.error('Password change failed:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to update password';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md rounded-3xl border border-primary/30 bg-card p-6 sm:p-8 shadow-2xl space-y-6 relative text-foreground">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="h-7 w-7 stroke-[2]" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">
            {t('auth.setPasswordTitle', 'Set New Password')}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed px-2">
            {t(
              'auth.setPasswordSubtitle',
              'Welcome to Ulfa Platform! Please set a new password to secure your account and proceed.'
            )}
          </p>
        </div>

        {isSuccess ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
              {t('auth.passwordChangedSuccess', 'Password updated and account activated successfully!')}
            </h3>
            <p className="text-xs text-muted-foreground font-medium">
              {t('auth.redirectingToDashboard', 'Redirecting to dashboard...')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                {t('auth.newPasswordLabel', 'New Password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:right-3.5 rtl:left-auto" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-border bg-background py-2.5 ps-10 pe-4 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                {t('auth.confirmPasswordLabel', 'Confirm New Password')}
              </label>
              <div className="relative">
                <ShieldCheck className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:right-3.5 rtl:left-auto" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-border bg-background py-2.5 ps-10 pe-4 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-extrabold text-primary-foreground shadow-lg hover:bg-primary/90 transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('auth.savingBtn', 'Saving & Activating...')}</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  <span>{t('auth.savePasswordBtn', 'Save Password & Continue')}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export const PendingPasswordModal = FirstLoginPasswordModal;
export default FirstLoginPasswordModal;
