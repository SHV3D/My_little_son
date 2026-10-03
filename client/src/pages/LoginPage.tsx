import React, { useState } from 'react';
import { loginApi, AuthResponse, setAuthToken, setStoredUser } from '../api/authApi';
import { PasswordResetModal } from '../components/modals/PasswordResetModal';
import { authenticateWithBiometrics, isBiometricsEnabled, getBiometricEmail } from '../utils/biometrics';
import { useTheme } from '../hooks/useTheme';

export interface LoginPageProps {
  onSuccess?: (auth: AuthResponse) => void;
  onNavigateToRegister?: () => void;
  className?: string;
  style?: React.CSSProperties;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccess,
  onNavigateToRegister,
  className = '',
  style,
  theme: propTheme,
  onToggleTheme,
}) => {
  const themeHook = useTheme();
  const currentTheme = propTheme || themeHook.resolvedTheme;
  const handleToggleTheme = onToggleTheme || themeHook.toggleTheme;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resp = await loginApi({ email, password });
      if (onSuccess) {
        onSuccess(resp);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (loading) return;
    setError(null);

    const savedEmail = getBiometricEmail();
    if (!isBiometricsEnabled() || !savedEmail) {
      setError('Сначала включите вход по биометрии в Настройках');
      return;
    }

    setLoading(true);
    try {
      const result = await authenticateWithBiometrics(savedEmail);
      if (!result) {
        setError('Биометрическая аутентификация не выполнена');
        return;
      }
      setAuthToken(result.token);
      setStoredUser(result.user as any);
      if (onSuccess) {
        onSuccess({
          user: result.user as any,
          token: result.token,
          family: result.family || {
            id: result.user.familyId || 'demo-family-1',
            name: 'Семья',
            inviteCode: '',
          },
          child: result.child ?? null,
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Ошибка биометрической аутентификации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="login-page"
      className={`mobile-viewport-wrapper login-screen ${className}`.trim()}
      style={{
        maxWidth: '430px',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        margin: '0 auto',
        boxSizing: 'border-box',
        backgroundColor: 'var(--bg-primary, #ECEEE6)',
        fontFamily: "'Geologica', system-ui, sans-serif",
        color: 'var(--text-primary, #1E2A20)',
        ...style,
      }}
    >
      <div
        className="screen-content"
        data-testid="login-content"
        style={{
          flex: '1 1 auto',
          overflowY: 'auto',
          padding: '16px 16px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
      {/* Top Brand Strip */}
      <div
        data-testid="brand-top-strip"
        style={{
          backgroundColor: 'var(--color-dark, #23372A)',
          color: 'var(--color-lime, #D4F27A)',
          borderRadius: '20px',
          padding: '14px 18px',
          minHeight: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '16px',
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          marginBottom: '4px',
        }}
      >
        My little sun
      </div>

      {/* Top Bento Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '10px',
        }}
      >
        <section
          style={{
            gridColumn: 'span 2',
            backgroundColor: '#23372A',
            color: '#F1F4EA',
            borderRadius: '28px',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '160px',
          }}
        >
          <img
            src="/logo.svg"
            alt="Logo"
            data-testid="auth-logo-img"
            style={{ width: '144px', height: '144px', borderRadius: '24px', objectFit: 'contain' }}
          />
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            data-testid="auth-theme-toggle-btn"
            aria-label={currentTheme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
            onClick={(e: React.MouseEvent) => {
              (window as any).__themeTransitionX = e.clientX;
              (window as any).__themeTransitionY = e.clientY;
              handleToggleTheme();
            }}
            className="bento-interactive"
            style={{
              flexGrow: 1,
              borderRadius: '24px',
              backgroundColor: currentTheme === 'dark' ? '#2E4233' : '#D4F27A',
              color: currentTheme === 'dark' ? '#D4F27A' : '#1E2A20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 0,
              cursor: 'pointer',
              padding: 0,
              boxShadow: 'var(--shadow-sm, 0 2px 8px rgba(35, 55, 42, 0.04))',
              transition: 'background-color 0.25s, color 0.25s, transform 0.15s',
            }}
          >
            {currentTheme === 'dark' ? (
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
              </svg>
            )}
          </button>

          <div
            style={{
              flexGrow: 1,
              borderRadius: '24px',
              backgroundColor: 'var(--color-white, #FFFFFF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'background-color 0.25s',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '14px',
                borderRadius: '4px',
                backgroundColor: currentTheme === 'dark' ? 'rgba(212, 242, 122, 0.45)' : '#23372A',
                transition: 'background-color 0.25s',
              }}
            />
            <div
              style={{
                width: '8px',
                height: '24px',
                borderRadius: '4px',
                backgroundColor: currentTheme === 'dark' ? 'rgba(212, 242, 122, 0.65)' : '#23372A',
                transition: 'background-color 0.25s',
              }}
            />
            <div
              style={{
                width: '8px',
                height: '18px',
                borderRadius: '4px',
                backgroundColor: '#D4F27A',
              }}
            />
            <div
              style={{
                width: '8px',
                height: '30px',
                borderRadius: '4px',
                backgroundColor: currentTheme === 'dark' ? 'rgba(212, 242, 122, 0.85)' : '#23372A',
                transition: 'background-color 0.25s',
              }}
            />
          </div>
        </div>
      </div>

      {/* Login Form */}
      <form
        data-testid="login-form"
        onSubmit={handleSubmit}
        style={{
          backgroundColor: 'var(--color-white, #FFFFFF)',
          borderRadius: '28px',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          border: currentTheme === 'dark' ? '1px solid var(--color-border, #2C3F30)' : 'none',
          transition: 'background-color 0.25s, border-color 0.25s',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '-0.5px',
            color: 'var(--text-primary, #1E2A20)',
          }}
        >
          Вход
        </h1>

        {resetSuccessMessage && (
          <div
            data-testid="login-reset-success-banner"
            style={{
              backgroundColor: '#E8F5E9',
              border: '1px solid #2E7D32',
              color: '#1B5E20',
              padding: '10px 14px',
              borderRadius: '14px',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {resetSuccessMessage}
          </div>
        )}

        {error && (
          <div
            data-testid="login-error-banner"
            style={{
              backgroundColor: '#FDF1DC',
              border: '1px solid #D08A1E',
              color: '#734107',
              padding: '10px 14px',
              borderRadius: '14px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            htmlFor="login-email"
            style={{ fontSize: '13px', color: 'var(--text-muted, #4A5A4C)' }}
          >
            Эл. почта
          </label>
          <input
            id="login-email"
            data-testid="login-email-input"
            type="email"
            autoComplete="email"
            placeholder="name@mail.ru"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              height: '56px',
              borderRadius: '16px',
              border: currentTheme === 'dark' ? '1px solid var(--color-border, #2C3F30)' : '1px solid var(--color-border, #E3E7DA)',
              backgroundColor: 'var(--color-light-sage, #F1F3EC)',
              padding: '0 16px',
              fontFamily: 'inherit',
              fontSize: '17px',
              color: 'var(--text-primary, #1E2A20)',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'background-color 0.25s, color 0.25s, border-color 0.25s',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            htmlFor="login-pass"
            style={{ fontSize: '13px', color: 'var(--text-muted, #4A5A4C)' }}
          >
            Пароль
          </label>
          <input
            id="login-pass"
            data-testid="login-password-input"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              height: '56px',
              borderRadius: '16px',
              border: currentTheme === 'dark' ? '1px solid var(--color-border, #2C3F30)' : '1px solid var(--color-border, #E3E7DA)',
              backgroundColor: 'var(--color-light-sage, #F1F3EC)',
              padding: '0 16px',
              fontFamily: 'inherit',
              fontSize: '17px',
              color: 'var(--text-primary, #1E2A20)',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'background-color 0.25s, color 0.25s, border-color 0.25s',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <a
            href="#forgot"
            data-testid="forgot-password-btn"
            onClick={(e) => {
              e.preventDefault();
              setIsResetModalOpen(true);
            }}
            style={{
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              fontSize: '14px',
              fontWeight: 500,
              color: currentTheme === 'dark' ? 'var(--color-lime, #D4F27A)' : 'var(--color-link, #2F5A3A)',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'color 0.25s',
            }}
          >
            Забыли пароль?
          </a>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="submit"
            data-testid="login-submit-btn"
            disabled={loading}
            style={{
              flex: 1,
              height: '60px',
              borderRadius: '20px',
              backgroundColor: currentTheme === 'dark' ? '#2E4233' : '#23372A',
              color: currentTheme === 'dark' ? '#D4F27A' : '#F1F4EA',
              border: currentTheme === 'dark' ? '1px solid #3E5444' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '17px',
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s, background-color 0.25s, color 0.25s',
            }}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>

          <button
            type="button"
            data-testid="biometric-login-btn"
            onClick={handleBiometricLogin}
            aria-label="Войти по биометрии"
            disabled={loading}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '20px',
              backgroundColor: currentTheme === 'dark' ? '#2E4233' : 'var(--color-white, #FFFFFF)',
              border: currentTheme === 'dark' ? '1px solid #3E5444' : '1px solid var(--color-border, #E3E7DA)',
              color: currentTheme === 'dark' ? '#D4F27A' : '#23372A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: loading ? 'default' : 'pointer',
              flexShrink: 0,
              padding: 0,
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 0.2s, background-color 0.25s, border-color 0.25s, color 0.25s',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: currentTheme === 'dark' ? '#D4F27A' : '#23372A' }}
            >
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <circle cx="9" cy="9" r="1" fill="currentColor" />
              <circle cx="15" cy="9" r="1" fill="currentColor" />
              <path d="M10 13c.5.5 1.5.5 2 0" />
              <path d="M9 16c1.5 1 4.5 1 6 0" />
            </svg>
          </button>
        </div>
      </form>

      <div style={{ flexGrow: 1 }} />

      {/* Register Navigation Button */}
      <button
        type="button"
        data-testid="btn-to-register"
        onClick={onNavigateToRegister}
        style={{
          height: '60px',
          borderRadius: '20px',
          backgroundColor: '#D4F27A',
          color: '#1E2A20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontSize: '16px',
          fontWeight: 600,
          border: 0,
          cursor: 'pointer',
        }}
      >
        Нет аккаунта? Зарегистрироваться
      </button>

      <PasswordResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        initialEmail={email}
        onSuccess={(newEmail) => {
          if (newEmail) {
            setEmail(newEmail);
          }
          setPassword('');
          setResetSuccessMessage('Пароль успешно изменён! Войдите с новым паролем.');
        }}
      />
      </div>
    </div>
  );
};
