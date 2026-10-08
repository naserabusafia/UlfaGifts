import React, { useState } from 'react';
import type { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { Check, Eye, EyeOff, Infinity as InfinityIcon, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { changePasswordApi } from '../features/auth';
import { formatCount } from '../features/dashboard/format';
import '../features/dashboard/portal.css';

const MIN_LENGTH = 8;
const MAX_LENGTH = 72;

type Strength = 0 | 1 | 2 | 3;

/** Rough guide only: length plus a mix of letters, digits and symbols. */
const strengthOf = (password: string): Strength => {
  if (password.length < MIN_LENGTH) return 0;
  const kinds = [/[a-zA-Z؀-ۿ]/, /\d/, /[^a-zA-Z0-9؀-ۿ]/].filter((re) => re.test(password)).length;
  if (password.length >= 12 && kinds >= 2) return 3;
  return kinds >= 2 ? 2 : 1;
};

const PasswordInput: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  visible: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
  describedBy?: string;
}> = ({ id, label, value, onChange, autoComplete, visible, onToggle, showLabel, hideLabel, describedBy }) => (
  <div className="pt-field">
    <label htmlFor={id}>{label}</label>
    <div className="pt-input-wrap">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        maxLength={MAX_LENGTH}
        required
        dir="ltr"
        className="pt-input"
        aria-describedby={describedBy}
      />
      <button type="button" className="pt-input-btn" onClick={onToggle} aria-label={visible ? hideLabel : showLabel} aria-pressed={visible}>
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </div>
  </div>
);

export const ProfilePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const lang = i18n.language;

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'admin';
  const isMerchant = user?.role === 'MERCHANT' || user?.role === 'manager';
  const displayName = user?.companyName || user?.name || user?.email?.split('@')[0] || '';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';
  const roleLabel = isAdmin ? t('portal.side.admin') : isMerchant ? t('portal.side.merchant') : t('portal.side.account');

  const isUnlimited = user?.isUnlimitedQuota === true || user?.totalQuota === 'unlimited';
  const total = typeof user?.totalQuota === 'number' ? user.totalQuota : 0;
  const remaining = Math.max(0, total - (user?.usedLinks ?? 0));

  const strength = strengthOf(next);
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit = current.length > 0 && next.length >= MIN_LENGTH && next === confirm && !saving;

  const memberSince = user?.createdAt
    ? new Intl.DateTimeFormat(lang?.startsWith('ar') ? 'ar-JO-u-nu-latn' : 'en-GB', { year: 'numeric', month: 'long' }).format(new Date(user.createdAt))
    : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaved(false);
    if (next.length < MIN_LENGTH) return setError(t('auth.passwordMin'));
    if (next !== confirm) return setError(t('auth.passwordsMismatch'));

    setSaving(true);
    try {
      await changePasswordApi(current, next);
      setSaved(true);
      setCurrent('');
      setNext('');
      setConfirm('');
      setVisible(false);
    } catch (err) {
      const code = (err as AxiosError<{ code?: string }>).response?.data?.code;
      setError(
        code === 'CURRENT_PASSWORD_INCORRECT'
          ? t('portal.profile.wrongCurrent')
          : code === 'PASSWORD_UNCHANGED'
            ? t('portal.profile.samePassword')
            : t('portal.profile.saveError'),
      );
    } finally {
      setSaving(false);
    }
  };

  const strengthLabels = [t('portal.profile.strengthShort'), t('portal.profile.strengthWeak'), t('portal.profile.strengthOk'), t('portal.profile.strengthStrong')];

  return (
    <div className="pt pt-narrow">
      <header className="pt-hero pt-rise">
        <div className="pt-identity">
          <span className="pt-avatar" aria-hidden="true">{initial}</span>
          <div>
            <p className="pt-eyebrow">{roleLabel}</p>
            <h1 className="pt-title">{displayName}</h1>
            <p className="pt-lede" dir="ltr" style={{ textAlign: 'start' }}>{user?.email}</p>
          </div>
        </div>
      </header>

      <section className="pt-sheet pt-rise" aria-labelledby="profile-account">
        <div className="pt-sheet__head">
          <h2 className="pt-h2" id="profile-account">{t('portal.profile.account')}</h2>
        </div>
        <dl className="pt-facts pt-dl">
          <div className="pt-fact">
            <dt>{t('portal.profile.email')}</dt>
            <dd dir="ltr">{user?.email}</dd>
          </div>
          {user?.companyName && (
            <div className="pt-fact">
              <dt>{t('portal.profile.storeName')}</dt>
              <dd>{user.companyName}</dd>
            </div>
          )}
          <div className="pt-fact">
            <dt>{t('portal.profile.accountType')}</dt>
            <dd>{roleLabel}</dd>
          </div>
          {isMerchant && (
            <div className="pt-fact">
              <dt>{t('portal.merchant.remainingLinks')}</dt>
              <dd>
                {isUnlimited ? (
                  <span className="pt-inline"><InfinityIcon /> {t('portal.merchant.unlimitedHint')}</span>
                ) : (
                  <>
                    <b className="pt-num">{formatCount(remaining, lang)}</b>{' '}
                    <span className="pt-muted">{t('portal.merchant.ofTotal', { total })}</span>
                  </>
                )}
              </dd>
            </div>
          )}
          {memberSince && (
            <div className="pt-fact">
              <dt>{t('portal.profile.memberSince')}</dt>
              <dd>{memberSince}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="pt-sheet pt-rise" aria-labelledby="profile-password">
        <div className="pt-sheet__head">
          <h2 className="pt-h2" id="profile-password">{t('portal.profile.passwordTitle')}</h2>
          <KeyRound className="pt-head-icon" aria-hidden="true" />
        </div>
        <form className="pt-form" onSubmit={handleSubmit} noValidate>
          <PasswordInput
            id="profile-current-password"
            label={t('portal.profile.currentPassword')}
            value={current}
            onChange={(value) => { setCurrent(value); setSaved(false); }}
            autoComplete="current-password"
            visible={visible}
            onToggle={() => setVisible((v) => !v)}
            showLabel={t('portal.profile.show')}
            hideLabel={t('portal.profile.hide')}
          />
          <div className="pt-form__pair">
            <div>
              <PasswordInput
                id="profile-new-password"
                label={t('auth.newPasswordLabel')}
                value={next}
                onChange={(value) => { setNext(value); setSaved(false); }}
                autoComplete="new-password"
                visible={visible}
                onToggle={() => setVisible((v) => !v)}
                showLabel={t('portal.profile.show')}
                hideLabel={t('portal.profile.hide')}
                describedBy="profile-password-hint"
              />
              <div className="pt-strength" data-level={next ? strength : undefined} aria-hidden="true"><i /><i /><i /></div>
              <p className="pt-hint" id="profile-password-hint" aria-live="polite">
                {next ? strengthLabels[strength] : t('portal.profile.rule')}
              </p>
            </div>
            <div>
              <PasswordInput
                id="profile-confirm-password"
                label={t('auth.confirmPasswordLabel')}
                value={confirm}
                onChange={(value) => { setConfirm(value); setSaved(false); }}
                autoComplete="new-password"
                visible={visible}
                onToggle={() => setVisible((v) => !v)}
                showLabel={t('portal.profile.show')}
                hideLabel={t('portal.profile.hide')}
                describedBy="profile-confirm-hint"
              />
              <p className={`pt-hint${mismatch ? ' is-wax' : ''}`} id="profile-confirm-hint" aria-live="polite">
                {mismatch ? t('auth.passwordsMismatch') : confirm && confirm === next ? t('portal.profile.matches') : ' '}
              </p>
            </div>
          </div>

          {error && <p className="pt-banner is-error" role="alert">{error}</p>}
          {saved && <p className="pt-banner is-ok" role="status"><Check /> {t('portal.profile.saved')}</p>}

          <div className="pt-form__actions">
            <button type="submit" className="pt-btn pt-btn--ink" disabled={!canSubmit}>
              {saving ? <Loader2 className="pt-spin" /> : <KeyRound />}
              {saving ? t('portal.profile.saving') : t('portal.profile.savePassword')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default ProfilePage;
