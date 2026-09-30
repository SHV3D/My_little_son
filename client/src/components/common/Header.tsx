import React from 'react';

export interface HeaderProps {
  title?: string;
  roles?: string[] | string;
  isOnline?: boolean;
  onPillClick?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Среда, 30.09',
  roles = ['Мама', 'Папа'],
  isOnline = true,
  onPillClick,
  theme = 'light',
  onToggleTheme,
  className = '',
  style,
}) => {
  const displayRoles = Array.isArray(roles) ? roles.join(' · ') : roles;

  return (
    <header
      className={`app-header ${className}`.trim()}
      data-testid="app-header"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 4px',
        userSelect: 'none',
        ...style,
      }}
    >
      <h1
        data-testid="header-title"
        style={{
          margin: 0,
          fontSize: '26px',
          fontWeight: 700,
          letterSpacing: '-0.8px',
          color: 'var(--text-primary, #1E2A20)',
          lineHeight: 1.2,
        }}
      >
        {title}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          data-testid="theme-toggle-btn"
          aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          onClick={onToggleTheme}
          className="bento-interactive"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 0,
            backgroundColor: 'var(--color-white, #FFFFFF)',
            color: 'var(--text-primary, #1E2A20)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm, 0 2px 8px rgba(35, 55, 42, 0.04))',
            padding: 0,
          }}
        >
          {theme === 'dark' ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <div
          data-testid="header-roles"
          onClick={onPillClick}
          role={onPillClick ? 'button' : undefined}
          tabIndex={onPillClick ? 0 : undefined}
          className={`status-pill ${onPillClick ? 'bento-interactive' : ''}`.trim()}
          style={{
            padding: '8px 12px',
            borderRadius: '12px',
            backgroundColor: 'var(--color-white, #FFFFFF)',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-muted, #4A5A4C)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: 'var(--shadow-sm, 0 2px 8px rgba(35, 55, 42, 0.04))',
            cursor: onPillClick ? 'pointer' : 'default',
          }}
        >
          {/* Live status dot */}
          <span
            data-testid="online-indicator"
            data-online={isOnline ? 'true' : 'false'}
            className={isOnline ? 'animate-pulse-dot' : ''}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isOnline
                ? 'var(--color-success, #2F6E42)'
                : 'var(--text-subtle, #B7C4B4)',
              display: 'inline-block',
              flexShrink: 0,
            }}
            aria-label={isOnline ? 'В сети' : 'Не в сети'}
          />
          <span>{displayRoles}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
