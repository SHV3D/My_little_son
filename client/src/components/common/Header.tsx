import React from 'react';

export interface HeaderProps {
  title?: string;
  roles?: string[] | string;
  isOnline?: boolean;
  onPillClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Среда, 30.09',
  roles = ['Мама', 'Папа'],
  isOnline = true,
  onPillClick,
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
    </header>
  );
};

export default Header;
