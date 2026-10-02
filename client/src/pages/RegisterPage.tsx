import React, { useState } from 'react';
import { registerApi, AuthResponse, RegisterInput } from '../api/authApi';

export interface RegisterPageProps {
  onSuccess?: (auth: AuthResponse) => void;
  onNavigateToLogin?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onSuccess,
  onNavigateToLogin,
  className = '',
  style,
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Мама' | 'Папа' | 'Другое'>('Мама');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyMode, setFamilyMode] = useState<'NEW' | 'INVITE'>('INVITE');
  const [inviteCode, setInviteCode] = useState('7K4-Q9M');
  const [childName, setChildName] = useState('Сын');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Пожалуйста, укажите ваше имя');
      return;
    }
    if (!email.trim() || !password) {
      setError('Пожалуйста, укажите эл. почту и пароль');
      return;
    }
    if (password.length < 8) {
      setError('Пароль должен быть не меньше 8 символов');
      return;
    }
    if (familyMode === 'INVITE' && !inviteCode.trim()) {
      setError('Пожалуйста, введите код приглашения семьи');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: RegisterInput = {
        name: name.trim(),
        role,
        email: email.trim(),
        password,
      };

      if (familyMode === 'INVITE') {
        payload.inviteCode = inviteCode.trim();
      } else {
        payload.childName = childName.trim() || 'Сын';
        payload.familyName = `Семья ${childName.trim() || 'Сына'}`;
        if (recoveryCode.trim()) {
          payload.recoveryCode = recoveryCode.trim();
        }
      }

      const resp = await registerApi(payload);
      if (onSuccess) {
        onSuccess(resp);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="register-page"
      className={`mobile-viewport-wrapper register-screen ${className}`.trim()}
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
        data-testid="register-content"
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

      {/* Header with back button and brand logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '0 4px 6px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            data-testid="btn-back-to-login"
            aria-label="Назад ко входу"
            onClick={onNavigateToLogin}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              backgroundColor: '#FFFFFF',
              color: '#1E2A20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 0,
              cursor: 'pointer',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <h1
            style={{
              margin: 0,
              fontSize: '26px',
              fontWeight: 700,
              letterSpacing: '-0.8px',
            }}
          >
            Регистрация
          </h1>
        </div>
        <img
          src="/logo.svg"
          alt="My little son"
          data-testid="auth-logo-img"
          style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'contain' }}
        />
      </div>

      <form
        data-testid="register-form"
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
      >
        {error && (
          <div
            data-testid="register-error-banner"
            style={{
              backgroundColor: '#FDF1DC',
              border: '1px solid #D08A1E',
              color: '#734107',
              padding: '10px 14px',
              borderRadius: '16px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        {/* Section 1: User name & Role */}
        <section
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="reg-name"
              style={{ fontSize: '13px', color: '#4A5A4C' }}
            >
              Ваше имя
            </label>
            <input
              id="reg-name"
              data-testid="register-name-input"
              type="text"
              autoComplete="given-name"
              placeholder="Как к вам обращаться"
              value={name}
              onChange={(e) => setName(e.target.value)}
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

          <fieldset
            style={{
              margin: 0,
              padding: 0,
              border: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <legend
              style={{
                padding: 0,
                marginBottom: '6px',
                fontSize: '13px',
                color: '#4A5A4C',
              }}
            >
              Кто вы для ребёнка
            </legend>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '6px',
              }}
            >
              {(['Мама', 'Папа', 'Другое'] as const).map((r) => {
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    data-testid={`role-btn-${r}`}
                    aria-pressed={active}
                    onClick={() => setRole(r)}
                    style={{
                      height: '48px',
                      borderRadius: '14px',
                      border: 0,
                      backgroundColor: active ? '#23372A' : '#F1F3EC',
                      color: active ? '#D4F27A' : '#1E2A20',
                      fontFamily: 'inherit',
                      fontSize: '15px',
                      fontWeight: active ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>

        {/* Section 2: Email & Password */}
        <section
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="reg-email"
              style={{ fontSize: '13px', color: '#4A5A4C' }}
            >
              Эл. почта
            </label>
            <input
              id="reg-email"
              data-testid="register-email-input"
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
              htmlFor="reg-pass"
              style={{ fontSize: '13px', color: '#4A5A4C' }}
            >
              Пароль
            </label>
            <input
              id="reg-pass"
              data-testid="register-password-input"
              type="password"
              autoComplete="new-password"
              placeholder="не меньше 8 символов"
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
        </section>

        {/* Section 3: Family Option */}
        <fieldset
          style={{
            margin: 0,
            padding: 0,
            border: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '10px',
          }}
        >
          <legend
            style={{
              padding: '0 0 8px 4px',
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '-0.4px',
            }}
          >
            Семья
          </legend>

          <label
            data-testid="family-mode-new-label"
            style={{
              backgroundColor: familyMode === 'NEW' ? '#23372A' : '#FFFFFF',
              color: familyMode === 'NEW' ? '#F1F4EA' : '#1E2A20',
              borderRadius: '24px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <input
              type="radio"
              name="family"
              data-testid="family-mode-new"
              checked={familyMode === 'NEW'}
              onChange={() => setFamilyMode('NEW')}
              style={{
                width: '22px',
                height: '22px',
                accentColor: '#D4F27A',
                margin: 0,
              }}
            />
            Создать новую семью
          </label>

          <label
            data-testid="family-mode-invite-label"
            style={{
              backgroundColor: familyMode === 'INVITE' ? '#23372A' : '#FFFFFF',
              color: familyMode === 'INVITE' ? '#F1F4EA' : '#1E2A20',
              borderRadius: '24px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <input
              type="radio"
              name="family"
              data-testid="family-mode-invite"
              checked={familyMode === 'INVITE'}
              onChange={() => setFamilyMode('INVITE')}
              style={{
                width: '22px',
                height: '22px',
                accentColor: '#D4F27A',
                margin: 0,
              }}
            />
            Есть приглашение
          </label>

          {familyMode === 'INVITE' ? (
            <div
              data-testid="invite-code-container"
              style={{
                gridColumn: 'span 2',
                backgroundColor: '#FFFFFF',
                borderRadius: '24px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <label
                htmlFor="reg-code"
                style={{ fontSize: '13px', color: '#4A5A4C' }}
              >
                Код приглашения
              </label>
              <input
                id="reg-code"
                data-testid="register-invite-code-input"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                style={{
                  height: '56px',
                  borderRadius: '16px',
                  border: '2px solid #23372A',
                  backgroundColor: '#F1F3EC',
                  padding: '0 16px',
                  fontFamily: 'inherit',
                  fontSize: '20px',
                  fontWeight: 600,
                  letterSpacing: '3px',
                  color: '#1E2A20',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
          ) : (
            <>
              <div
                data-testid="child-name-container"
                style={{
                  gridColumn: 'span 2',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '24px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <label
                  htmlFor="reg-child"
                  style={{ fontSize: '13px', color: '#4A5A4C' }}
                >
                  Имя ребёнка
                </label>
                <input
                  id="reg-child"
                  data-testid="register-child-name-input"
                  type="text"
                  placeholder="Как зовут малыша"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  style={{
                    height: '56px',
                    borderRadius: '16px',
                    border: '2px solid #23372A',
                    backgroundColor: '#F1F3EC',
                    padding: '0 16px',
                    fontFamily: 'inherit',
                    fontSize: '17px',
                    fontWeight: 500,
                    color: '#1E2A20',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div
                data-testid="recovery-code-container"
                style={{
                  gridColumn: 'span 2',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '24px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <label
                  htmlFor="reg-recovery-code"
                  style={{ fontSize: '13px', color: '#4A5A4C' }}
                >
                  Кодовое слово семьи
                </label>
                <input
                  id="reg-recovery-code"
                  data-testid="register-recovery-code"
                  type="text"
                  placeholder="Например: Барсик"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  style={{
                    height: '56px',
                    borderRadius: '16px',
                    border: '2px solid #23372A',
                    backgroundColor: '#F1F3EC',
                    padding: '0 16px',
                    fontFamily: 'inherit',
                    fontSize: '17px',
                    fontWeight: 500,
                    color: '#1E2A20',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #70846F)', marginTop: '4px' }}>
                  Используется для восстановления доступа. Обязательно запомните его — без него восстановить пароль будет невозможно.
                </div>
              </div>
            </>
          )}
        </fieldset>

        {/* Submit button */}
        <button
          type="submit"
          data-testid="register-submit-btn"
          disabled={loading}
          style={{
            height: '60px',
            borderRadius: '20px',
            backgroundColor: '#D4F27A',
            color: '#1E2A20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '17px',
            fontWeight: 600,
            border: 0,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1,
            marginTop: '4px',
            transition: 'opacity 0.2s',
          }}
        >
          {loading ? 'Создание аккаунта...' : 'Создать аккаунт'}
        </button>

        {/* Login navigation link */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '6px',
            fontSize: '15px',
            color: '#4A5A4C',
            marginTop: '4px',
          }}
        >
          Уже есть аккаунт?
          <button
            type="button"
            data-testid="link-to-login"
            onClick={onNavigateToLogin}
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              fontWeight: 600,
              color: '#2F5A3A',
              fontFamily: 'inherit',
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            Войти
          </button>
        </div>
      </form>
      </div>
    </div>
  );
};
