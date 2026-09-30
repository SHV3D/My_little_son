import React from 'react';
import { ValidationResult } from '@shared/sleepEngine';

export interface SanityBannerProps {
  validation?: ValidationResult | null;
  className?: string;
  style?: React.CSSProperties;
}

export const SanityBanner: React.FC<SanityBannerProps> = ({
  validation,
  className = '',
  style,
}) => {
  if (!validation) return null;

  const isValid = validation.isValid;

  return (
    <section
      data-testid="sanity-banner"
      role="status"
      aria-live="polite"
      className={`sanity-banner ${className}`.trim()}
      style={{
        gridColumn: 'span 2',
        borderRadius: '24px',
        padding: '14px 16px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        fontSize: '14px',
        lineHeight: 1.4,
        backgroundColor: isValid ? '#D4F27A' : '#FDF1DC',
        color: isValid ? '#1E2A20' : '#734107',
        border: isValid ? 'none' : '1px solid #D08A1E',
        transition: 'all 0.25s ease',
        ...style,
      }}
    >
      {isValid ? (
        <svg
          data-testid="sanity-icon-valid"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, marginTop: '1px' }}
        >
          <path d="M5 12l5 5 9-10" />
        </svg>
      ) : (
        <svg
          data-testid="sanity-icon-warning"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#D08A1E"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, marginTop: '1px' }}
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )}

      <span data-testid="sanity-message" style={{ fontWeight: 400 }}>
        {validation.message}
        {isValid && (
          <span style={{ opacity: 0.85 }}>
            {' '}Если настройки противоречат друг другу, здесь появится подсказка.
          </span>
        )}
      </span>
    </section>
  );
};
