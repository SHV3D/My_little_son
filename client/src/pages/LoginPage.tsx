import React, { useState } from 'react';
import { loginApi, AuthResponse, setAuthToken, setStoredUser } from '../api/authApi';
import { PasswordResetModal } from '../components/modals/PasswordResetModal';
import { authenticateWithBiometrics, hasSavedBiometrics } from '../utils/biometrics';

export interface LoginPageProps {
  onSuccess?: (auth: AuthResponse) => void;
  onNavigateToRegister?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccess,
  onNavigateToRegister,
  className = '',
  style,
}) => {
  const [email, setEmail] = useState('mama@mail.ru');
  const [password, setPassword] = useState('password123');
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

  const handleQuickDemo = (role: 'mama' | 'papa') => {
    if (role === 'mama') {
      setEmail('mama@mail.ru');
      setPassword('password123');
    } else {
      setEmail('papa@mail.ru');
      setPassword('password123');
    }
  };

  const handleBiometricLogin = async () => {
    if (loading) return;
    setError(null);

    if (!hasSavedBiometrics()) {
      setError('Сначала включите вход по биометрии в Настройках');
      return;
    }

    setLoading(true);
    try {
      const result = await authenticateWithBiometrics();
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
          family: {
            id: result.user.familyId || 'demo-family-1',
            name: 'Семья',
            inviteCode: '',
          },
          child: null,
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
        backgroundColor: '#ECEEE6',
        fontFamily: "'Geologica', system-ui, sans-serif",
        color: '#1E2A20',
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
          borderRadius: '18px',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '15px',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          marginBottom: '10px',
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
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '150px',
          }}
        >
          <img
            src="/logo.svg"
            alt="Logo"
            data-testid="auth-logo-img"
            style={{ width: '84px', height: '84px', borderRadius: '20px', objectFit: 'contain' }}
          />
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div
            style={{
              flexGrow: 1,
              borderRadius: '24px',
              backgroundColor: '#D4F27A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1E2A20',
            }}
          >
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
          </div>

          <div
            style={{
              flexGrow: 1,
              borderRadius: '24px',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '14px',
                borderRadius: '4px',
                backgroundColor: '#23372A',
              }}
            />
            <div
              style={{
                width: '8px',
                height: '24px',
                borderRadius: '4px',
                backgroundColor: '#23372A',
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
                backgroundColor: '#23372A',
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
          backgroundColor: '#FFFFFF',
          borderRadius: '28px',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '-0.5px',
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
            style={{ fontSize: '13px', color: '#4A5A4C' }}
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
              border: 0,
              backgroundColor: '#F1F3EC',
              padding: '0 16px',
              fontFamily: 'inherit',
              fontSize: '17px',
              color: '#1E2A20',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            htmlFor="login-pass"
            style={{ fontSize: '13px', color: '#4A5A4C' }}
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
              border: 0,
              backgroundColor: '#F1F3EC',
              padding: '0 16px',
              fontFamily: 'inherit',
              fontSize: '17px',
              color: '#1E2A20',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              data-testid="quick-login-mama"
              onClick={() => handleQuickDemo('mama')}
              style={{
                background: 'none',
                border: 0,
                padding: '4px 8px',
                borderRadius: '8px',
                backgroundColor: '#F1F3EC',
                fontSize: '12px',
                color: '#4A5A4C',
                cursor: 'pointer',
              }}
            >
              Демо: Мама
            </button>
            <button
              type="button"
              data-testid="quick-login-papa"
              onClick={() => handleQuickDemo('papa')}
              style={{
                background: 'none',
                border: 0,
                padding: '4px 8px',
                borderRadius: '8px',
                backgroundColor: '#F1F3EC',
                fontSize: '12px',
                color: '#4A5A4C',
                cursor: 'pointer',
              }}
            >
              Демо: Папа
            </button>
          </div>

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
              color: '#2F5A3A',
              textDecoration: 'none',
              cursor: 'pointer',
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
              backgroundColor: '#23372A',
              color: '#F1F4EA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '17px',
              fontWeight: 600,
              border: 0,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s',
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
              backgroundColor: 'var(--color-white, #FFFFFF)',
              border: '1px solid var(--color-border, #E3E7DA)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: loading ? 'default' : 'pointer',
              flexShrink: 0,
              padding: 0,
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 0.2s',
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
              style={{ color: '#23372A' }}
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
