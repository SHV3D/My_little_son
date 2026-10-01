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

  const actionText =
    currentWarning.actionRecommendation ||
    (currentWarning.actionType === 'WAKE_NOW'
      ? 'Разбудить сейчас'
      : currentWarning.actionType === 'SET_WAKE_TIME'
      ? 'Указать время'
      : currentWarning.actionType === 'EARLY_BEDTIME'
      ? 'Ранний отбой'
      : currentWarning.actionType === 'SHORT_BRIDGE_NAP'
      ? 'Мостиковый сон'
      : currentWarning.actionType === 'CHECK_TIME'
      ? 'Проверить время'
      : null);

  const bannerStyle: React.CSSProperties = {
    borderRadius: '20px',
    padding: '14px 16px',
    background: `var(--warning-${severity}-bg, rgba(234, 163, 146, 0.16))`,
    border: `1px solid var(--warning-${severity}-border, rgba(214, 115, 96, 0.35))`,
    color: `var(--warning-${severity}-text, #6A2417)`,
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
    background: `var(--warning-${severity}-badge-bg, #EAA392)`,
    color: `var(--warning-${severity}-badge-text, #1E2A20)`,
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
    width: '24px',
    height: '24px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    padding: 0,
    outline: 'none',
    transition: 'background 0.15s ease',
  };

  const actionBtnStyle: React.CSSProperties = {
    background: `var(--warning-${severity}-badge-bg, #EAA392)`,
    color: `var(--warning-${severity}-badge-text, #1E2A20)`,
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
      data-testid="warning-banner"
      data-severity={severity}
    >
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '6px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1,
            minWidth: 0,
          }}
        >
          <span data-testid="warning-banner-badge" style={badgeStyle}>
            {BADGE_TEXT_MAP[severity] || 'Совет'}
          </span>
          <h4
            data-testid="warning-banner-title"
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 600,
              lineHeight: 1.25,
              color: 'inherit',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
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
                gap: '4px',
                background: 'rgba(0, 0, 0, 0.04)',
                borderRadius: '9999px',
                padding: '2px 4px',
              }}
            >
              <button
                type="button"
                data-testid="warning-banner-prev"
                aria-label="Предыдущее предупреждение"
                onClick={handlePrev}
                style={{
                  ...iconBtnStyle,
                  width: '20px',
                  height: '20px',
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
                  padding: '0 2px',
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
                  width: '20px',
                  height: '20px',
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

      {/* Action / Recommendation */}
      {actionText && (
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            data-testid="warning-banner-action"
            onClick={handleAction}
            style={actionBtnStyle}
          >
            <span>{actionText}</span>
            <span style={{ fontSize: '12px', lineHeight: 1 }}>→</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default WarningBanner;
