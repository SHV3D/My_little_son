import React, { useState, useEffect } from 'react';
import { resetPasswordApi } from '../../api/authApi';

export interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (email: string) => void;
  initialEmail?: string;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail);
      setRecoveryCode('');
      setNewPassword('');
      setError(null);
      setIsSuccess(false);
    }
  }, [isOpen, initialEmail]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Укажите эл. почту');
      return;
    }
    if (!recoveryCode.trim()) {
      setError('Укажите кодовое слово семьи');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('Пароль должен содержать не менее 6 символов');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await resetPasswordApi({
        email: email.trim(),
        recoveryCode: recoveryCode.trim(),
        newPassword,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Ошибка сброса пароля');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    if (onSuccess) {
      onSuccess(email.trim());
    }
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      data-testid="reset-password-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(18, 28, 21, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        boxSizing: 'border-box',
        animation: 'bento-fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-modal-title"
        data-testid="reset-password-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: 'var(--bg-primary, #ECEEE6)',
          borderRadius: '32px 32px 0 0',
          padding: '12px 16px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxSizing: 'border-box',
          boxShadow: '0 -8px 32px rgba(18, 28, 21, 0.24)',
          fontFamily: "'Geologica', system-ui, sans-serif",
          color: 'var(--text-primary, #1E2A20)',
          animation: 'bento-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            alignSelf: 'center',
            width: '40px',
            height: '5px',
            borderRadius: '3px',
            backgroundColor: 'var(--color-border, #C5CCBC)',
            marginBottom: '4px',
          }}
        />

        {/* Header with Title & Close button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 4px',
          }}
        >
          <h2
            id="reset-password-modal-title"
            data-testid="reset-password-title"
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '-0.5px',
              color: 'var(--text-primary, #1E2A20)',
            }}
          >
            Восстановление пароля
          </h2>
          <button
            type="button"
            data-testid="reset-password-close-btn"
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-white, #FFFFFF)',
              color: 'var(--text-primary, #1E2A20)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30, 42, 32, 0.05))',
            }}
          >
            ✕
          </button>
        </div>

        {isSuccess ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              marginTop: '8px',
            }}
          >
            <div
              data-testid="reset-password-success"
              style={{
                backgroundColor: 'var(--color-lime, #D4F27A)',
                color: '#1E2A20',
                borderRadius: '20px',
                padding: '20px 16px',
                textAlign: 'center',
                fontWeight: 600,
                fontSize: '16px',
                lineHeight: 1.4,
              }}
            >
              Пароль успешно изменён! Теперь вы можете войти.
            </div>

            <button
              type="button"
              data-testid="reset-password-done-btn"
              onClick={handleFinish}
              style={{
                height: '56px',
                borderRadius: '20px',
                backgroundColor: 'var(--color-dark, #23372A)',
                color: 'var(--color-creamy, #F1F4EA)',
                border: 0,
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Войти с новым паролем
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {error && (
              <div
                data-testid="reset-password-error"
                style={{
                  backgroundColor: '#FDE8E8',
                  color: '#9B1C1C',
                  borderRadius: '16px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                backgroundColor: 'var(--color-white, #FFFFFF)',
                borderRadius: '20px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <label
                htmlFor="reset-email"
                style={{ fontSize: '13px', color: '#4A5A4C' }}
              >
                Эл. почта
              </label>
              <input
                id="reset-email"
                data-testid="reset-password-email"
                type="email"
                autoComplete="email"
                placeholder="name@mail.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  height: '48px',
                  borderRadius: '14px',
                  border: '1px solid var(--color-border, #E3E7DA)',
                  backgroundColor: '#F1F3EC',
                  padding: '0 14px',
                  fontFamily: 'inherit',
                  fontSize: '16px',
                  color: '#1E2A20',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div
              style={{
                backgroundColor: 'var(--color-white, #FFFFFF)',
                borderRadius: '20px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <label
                htmlFor="reset-code"
                style={{ fontSize: '13px', color: '#4A5A4C' }}
              >
                Кодовое слово семьи
              </label>
              <input
                id="reset-code"
                data-testid="reset-password-code"
                type="text"
                placeholder="Например: солнышко"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                style={{
                  height: '48px',
                  borderRadius: '14px',
                  border: '1px solid var(--color-border, #E3E7DA)',
                  backgroundColor: '#F1F3EC',
                  padding: '0 14px',
                  fontFamily: 'inherit',
                  fontSize: '16px',
                  color: '#1E2A20',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div
              style={{
                backgroundColor: 'var(--color-white, #FFFFFF)',
                borderRadius: '20px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <label
                htmlFor="reset-new-password"
                style={{ fontSize: '13px', color: '#4A5A4C' }}
              >
                Новый пароль
              </label>
              <input
                id="reset-new-password"
                data-testid="reset-password-new-password"
                type="password"
                autoComplete="new-password"
                placeholder="не меньше 6 символов"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{
                  height: '48px',
                  borderRadius: '14px',
                  border: '1px solid var(--color-border, #E3E7DA)',
                  backgroundColor: '#F1F3EC',
                  padding: '0 14px',
                  fontFamily: 'inherit',
                  fontSize: '16px',
                  color: '#1E2A20',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              data-testid="reset-password-submit-btn"
              disabled={loading}
              style={{
                height: '56px',
                borderRadius: '20px',
                backgroundColor: 'var(--color-dark, #23372A)',
                color: 'var(--color-creamy, #F1F4EA)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 600,
                border: 0,
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.7 : 1,
                marginTop: '4px',
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? 'Сохранение...' : 'Сохранить новый пароль'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
};
