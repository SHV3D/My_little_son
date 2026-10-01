import React, { useState, useEffect, useMemo } from 'react';
import { SleepWarning, SleepWarningCode, WarningSeverity } from '@shared/sleepEngine';

export interface WarningBannerProps {
  warnings?: SleepWarning[];
  onAction?: (warning: SleepWarning) => void;
  onDismiss?: (code: SleepWarningCode) => void;
  className?: string;
  style?: React.CSSProperties;
}

const SEVERITY_ORDER: Record<WarningSeverity, number> = {
  alert: 0,
  warning: 1,
  info: 2,
};

const BADGE_TEXT_MAP: Record<WarningSeverity, string> = {
  alert: 'Внимание',
  warning: 'Важно',
  info: 'Совет',
};

const ACTION_LABEL_MAP: Record<string, string> = {
  WAKE_NOW: 'Разбудить сейчас',
  SET_WAKE_TIME: 'Указать время пробуждения',
  SHORT_BRIDGE_NAP: 'Короткий мостик',
  EARLY_BEDTIME: 'Уложить раньше',
  CHECK_TIME: 'Проверить время',
};

const SEVERITY_FALLBACKS: Record<
  WarningSeverity,
  { bg: string; border: string; text: string; badgeBg: string; badgeText: string }
> = {
  alert: {
    bg: 'rgba(234, 163, 146, 0.16)',
    border: '#EAA392',
    text: '#6A2417',
    badgeBg: '#EAA392',
    badgeText: '#1E2A20',
  },
  warning: {
    bg: 'rgba(228, 192, 120, 0.18)',
    border: '#E4C078',
    text: '#5C410F',
    badgeBg: '#E4C078',
    badgeText: '#1E2A20',
  },
  info: {
    bg: 'rgba(212, 242, 122, 0.18)',
    border: '#C4DCA0',
    text: '#23372A',
    badgeBg: '#D4F27A',
    badgeText: '#1E2A20',
  },
};

const renderBadgeIcon = (severity: WarningSeverity) => {
  switch (severity) {
    case 'alert':
      return (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ marginRight: '4px', flexShrink: 0 }}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'warning':
      return (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ marginRight: '4px', flexShrink: 0 }}
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'info':
      return (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ marginRight: '4px', flexShrink: 0 }}
        >
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <path d="M9 18h6" />
          <path d="M10 22h4" />
        </svg>
      );
  }
};

export const WarningBanner: React.FC<WarningBannerProps> = ({
  warnings,
  onAction,
  onDismiss,
  className = '',
  style,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const sortedWarnings = useMemo(() => {
    if (!warnings || warnings.length === 0) return [];
    return [...warnings].sort((a, b) => {
      const pA = SEVERITY_ORDER[a.severity] ?? 99;
      const pB = SEVERITY_ORDER[b.severity] ?? 99;
      return pA - pB;
    });
  }, [warnings]);

  useEffect(() => {
    if (currentIndex >= sortedWarnings.length) {
      setCurrentIndex(Math.max(0, sortedWarnings.length - 1));
    }
  }, [sortedWarnings.length, currentIndex]);

  if (sortedWarnings.length === 0) {
    return null;
  }

  const safeIndex = Math.min(currentIndex, sortedWarnings.length - 1);
  const currentWarning = sortedWarnings[safeIndex];
  const severity = currentWarning.severity;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : sortedWarnings.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < sortedWarnings.length - 1 ? prev + 1 : 0));
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss?.(currentWarning.code);
  };

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction?.(currentWarning);
  };

  const tokenPrefix = severity === 'warning' ? 'warn' : severity;
  const fallbacks = SEVERITY_FALLBACKS[severity] ?? SEVERITY_FALLBACKS.info;

  const actionLabel = currentWarning.actionType
    ? ACTION_LABEL_MAP[currentWarning.actionType] || 'Действие'
    : null;

  const bannerStyle: React.CSSProperties = {
    borderRadius: '20px',
    padding: '14px 16px',
    background: `var(--warning-${tokenPrefix}-bg, ${fallbacks.bg})`,
    border: `1px solid var(--warning-${tokenPrefix}-border, ${fallbacks.border})`,
    borderColor: `var(--warning-${tokenPrefix}-border, ${fallbacks.border})`,
    color: `var(--warning-${tokenPrefix}-text, ${fallbacks.text})`,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    position: 'relative',
    transition: 'background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease',
    ...style,
  };

  const badgeStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    borderRadius: '10px',
    padding: '3px 8px',
    background: `var(--warning-${tokenPrefix}-badge-bg, ${fallbacks.badgeBg})`,
    color: `var(--warning-${tokenPrefix}-badge-text, ${fallbacks.badgeText})`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    lineHeight: 1.2,
    letterSpacing: '0.02em',
  };

  const iconBtnStyle: React.CSSProperties = {
    border: 'none',
    background: 'rgba(0, 0, 0, 0.06)',
    color: 'inherit',
    cursor: 'pointer',
    borderRadius: '9999px',
    minWidth: '36px',
    minHeight: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    padding: '8px',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'background 0.15s ease',
  };

  const actionBtnStyle: React.CSSProperties = {
    background: `var(--warning-${tokenPrefix}-badge-bg, ${fallbacks.badgeBg})`,
    color: `var(--warning-${tokenPrefix}-badge-text, ${fallbacks.badgeText})`,
    border: 'none',
    borderRadius: '12px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'transform 0.1s ease, opacity 0.15s ease',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
  };

  return (
    <div
      className={`warning-banner warning-banner--${severity} ${className}`.trim()}
      style={bannerStyle}
      role={severity === 'alert' ? 'alert' : 'status'}
      aria-live={severity === 'alert' ? 'assertive' : 'polite'}
      data-testid="warning-banner"
      data-severity={severity}
    >
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '6px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            flex: 1,
            minWidth: 0,
          }}
        >
          <span data-testid="warning-banner-badge" style={badgeStyle}>
            {renderBadgeIcon(severity)}
            <span>{BADGE_TEXT_MAP[severity] || 'Совет'}</span>
          </span>
          <h4
            data-testid="warning-banner-title"
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 600,
              lineHeight: 1.25,
              color: 'inherit',
              wordBreak: 'break-word',
            }}
          >
            {currentWarning.title}
          </h4>
        </div>

        {/* Controls: Counter / Prev / Next / Close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          {sortedWarnings.length > 1 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                background: 'rgba(0, 0, 0, 0.04)',
                borderRadius: '9999px',
                padding: '2px',
              }}
            >
              <button
                type="button"
                data-testid="warning-banner-prev"
                aria-label="Предыдущее предупреждение"
                onClick={handlePrev}
                style={{
                  ...iconBtnStyle,
                  minWidth: '36px',
                  minHeight: '36px',
                  padding: '8px',
                  fontSize: '11px',
                  background: 'transparent',
                }}
              >
                ◀
              </button>
              <span
                data-testid="warning-banner-counter"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  opacity: 0.8,
                  padding: '0 4px',
                }}
              >
                {safeIndex + 1} / {sortedWarnings.length}
              </span>
              <button
                type="button"
                data-testid="warning-banner-next"
                aria-label="Следующее предупреждение"
                onClick={handleNext}
                style={{
                  ...iconBtnStyle,
                  minWidth: '36px',
                  minHeight: '36px',
                  padding: '8px',
                  fontSize: '11px',
                  background: 'transparent',
                }}
              >
                ▶
              </button>
            </div>
          )}

          <button
            type="button"
            data-testid="warning-banner-close"
            aria-label="Закрыть"
            onClick={handleClose}
            style={iconBtnStyle}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Message Body */}
      <p
        data-testid="warning-banner-message"
        style={{
          margin: 0,
          fontSize: '13px',
          fontWeight: 400,
          lineHeight: 1.4,
          color: 'inherit',
          opacity: 0.95,
        }}
      >
        {currentWarning.message}
      </p>

      {/* Advice / Recommendation */}
      {currentWarning.actionRecommendation && (
        <div
          data-testid="warning-banner-recommendation"
          style={{
            marginTop: '8px',
            fontSize: '12px',
            lineHeight: 1.35,
            opacity: 0.9,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            fontWeight: 500,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '13px', lineHeight: 1.2, flexShrink: 0 }}>
            💡
          </span>
          <span>{currentWarning.actionRecommendation}</span>
        </div>
      )}

      {/* Action Button */}
      {actionLabel && (
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            data-testid="warning-banner-action"
            onClick={handleAction}
            style={actionBtnStyle}
          >
            <span>{actionLabel}</span>
            <span style={{ fontSize: '12px', lineHeight: 1 }} aria-hidden="true">
              →
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default WarningBanner;
