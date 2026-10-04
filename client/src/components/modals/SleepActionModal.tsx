import React, { useState, useEffect, useRef } from 'react';

export type SleepActionType = 'FELL_ASLEEP' | 'WOKE_UP';

export interface SleepActionConfirmPayload {
  source: 'NOW' | 'MANUAL';
  time?: string;
  isNightSleep?: boolean;
}

export interface SleepActionModalProps {
  isOpen: boolean;
  type: SleepActionType;
  currentTime?: string;
  initialTime?: string;
  defaultOffsetMinutes?: number;
  onClose: () => void;
  onConfirm: (payload: SleepActionConfirmPayload) => void;
}

export function subtractMinutes(timeStr: string, minutes: number): string {
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return timeStr;

  let totalM = h * 60 + m - minutes;
  totalM = ((totalM % 1440) + 1440) % 1440;
  const newH = Math.floor(totalM / 60);
  const newM = totalM % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export function getCurrentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

const CHIP_OFFSETS = [5, 10, 15, 30] as const;

export const SleepActionModal: React.FC<SleepActionModalProps> = ({
  isOpen,
  type,
  currentTime,
  initialTime,
  defaultOffsetMinutes = 15,
  onClose,
  onConfirm,
}) => {
  const [nowTime, setNowTime] = useState<string>(currentTime || getCurrentTimeHHMM());
  const [nightSleep, setNightSleep] = useState<boolean>(false);
  const [activeOffset, setActiveOffset] = useState<number | null>(
    defaultOffsetMinutes > 0 ? defaultOffsetMinutes : null
  );
  const [selectedTime, setSelectedTime] = useState<string>(() => {
    const base = currentTime || getCurrentTimeHHMM();
    if (initialTime) return initialTime;
    if (defaultOffsetMinutes > 0) {
      return subtractMinutes(base, defaultOffsetMinutes);
    }
    return base;
  });

  // Track drag for swipe down gesture
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      const base = currentTime || getCurrentTimeHHMM();
      setNowTime(base);
      if (initialTime) {
        setSelectedTime(initialTime);
        setActiveOffset(null);
      } else if (defaultOffsetMinutes > 0) {
        setSelectedTime(subtractMinutes(base, defaultOffsetMinutes));
        setActiveOffset(defaultOffsetMinutes);
      } else {
        setSelectedTime(base);
        setActiveOffset(null);
      }
    }
  }, [isOpen, currentTime, initialTime, defaultOffsetMinutes]);

  // Keep live time ticking if currentTime prop is not specified
  useEffect(() => {
    if (currentTime || !isOpen) return;

    const interval = setInterval(() => {
      setNowTime(getCurrentTimeHHMM());
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTime, isOpen]);

  // Escape key listener
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

  if (!isOpen) {
    return null;
  }

  const titleText = type === 'FELL_ASLEEP' ? 'Уснул' : 'Проснулся';
  const saveButtonText =
    type === 'FELL_ASLEEP'
      ? `Сохранить: уснул в ${selectedTime}`
      : `Сохранить: проснулся в ${selectedTime}`;
  const footerText =
    type === 'FELL_ASLEEP'
      ? 'Так же работает кнопка «Проснулся»'
      : 'Так же работает кнопка «Уснул»';

  const handleChipClick = (offset: number) => {
    setActiveOffset(offset);
    setSelectedTime(subtractMinutes(nowTime, offset));
  };

  const handleManualTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSelectedTime(val);

    const match = CHIP_OFFSETS.find(
      (offset) => subtractMinutes(nowTime, offset) === val
    );
    setActiveOffset(match ?? null);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    const diff = touchCurrentY.current - touchStartY.current;
    if (diff > 70) {
      onClose();
    }
  };

  return (
    <div
      className="modal-backdrop"
      data-testid="sleep-action-modal-backdrop"
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
        aria-labelledby="sleep-action-modal-title"
        data-testid="sleep-action-modal"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: 'var(--bg-primary, #ECEEE6)',
          borderRadius: '32px 32px 0 0',
          padding: '10px 16px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxSizing: 'border-box',
          boxShadow: '0 -8px 32px rgba(18, 28, 21, 0.24)',
          fontFamily: "'Geologica', system-ui, sans-serif",
          color: 'var(--text-primary, #1E2A20)',
          animation: 'bento-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {/* Drag pill */}
        <div
          data-testid="modal-drag-handle"
          style={{
            alignSelf: 'center',
            width: '40px',
            height: '5px',
            borderRadius: '3px',
            backgroundColor: 'var(--color-border, #C5CCBC)',
            marginBottom: '4px',
            cursor: 'grab',
          }}
        />

        {/* Header with Title and Close Button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 4px',
          }}
        >
          <h2
            id="sleep-action-modal-title"
            data-testid="modal-title"
            style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '-0.6px',
              color: 'var(--text-primary, #1E2A20)',
            }}
          >
            {titleText}
          </h2>
          <button
            type="button"
            data-testid="modal-close-btn"
            onClick={onClose}
            aria-label="Закрыть"
            className="bento-interactive"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              backgroundColor: 'var(--color-white, #FFFFFF)',
              color: 'var(--text-primary, #1E2A20)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30, 42, 32, 0.05))',
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
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Night-sleep toggle (only when logging "fell asleep") */}
        {type === 'FELL_ASLEEP' && (
          <button
            type="button"
            data-testid="night-sleep-toggle"
            aria-pressed={nightSleep}
            onClick={() => setNightSleep((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 16px',
              borderRadius: '18px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: nightSleep ? '#23372A' : 'var(--color-white, #FFFFFF)',
              color: nightSleep ? '#F1F4EA' : 'var(--text-primary, #1E2A20)',
              boxShadow: 'var(--shadow-sm, 0 2px 8px rgba(35,55,42,0.08))',
              marginBottom: '4px',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '8px',
                flexShrink: 0,
                border: nightSleep ? 'none' : '2px solid #C3CEBE',
                backgroundColor: nightSleep ? '#D4F27A' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {nightSleep && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E2A20" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '15px', fontWeight: 600 }}>🌙 Ночной сон</span>
              <span style={{ fontSize: '12px', opacity: 0.7 }}>Подъём — по времени из настроек, не по интервалу</span>
            </span>
          </button>
        )}

        {/* One-tap Button ("Сейчас") */}
        <button
          type="button"
          data-testid="action-now-btn"
          onClick={() => onConfirm({ source: 'NOW', time: nowTime, ...(type === 'FELL_ASLEEP' && nightSleep ? { isNightSleep: true } : {}) })}
          className="bento-interactive"
          style={{
            height: '88px',
            borderRadius: '24px',
            backgroundColor: '#23372A',
            color: '#F1F4EA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 22px',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
            boxSizing: 'border-box',
            boxShadow: 'var(--shadow-md, 0 4px 16px rgba(35, 55, 42, 0.12))',
            userSelect: 'none',
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '13px', color: '#B7C4B4' }}>одним нажатием</span>
            <span style={{ fontSize: '20px', fontWeight: 600 }}>Сейчас</span>
          </span>
          <span
            data-testid="action-now-time"
            style={{
              padding: '8px 14px',
              borderRadius: '14px',
              backgroundColor: '#D4F27A',
              color: '#1E2A20',
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '-0.5px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {nowTime}
          </span>
        </button>

        {/* Custom Time Card */}
        <div
          data-testid="custom-time-card"
          style={{
            backgroundColor: 'var(--color-white, #FFFFFF)',
            borderRadius: '24px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxSizing: 'border-box',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30, 42, 32, 0.05))',
          }}
        >
          <label
            htmlFor="sleep-time"
            style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #4A5A4C)' }}
          >
            Или указать время
          </label>
          <input
            id="sleep-time"
            data-testid="manual-time-input"
            type="time"
            value={selectedTime}
            onChange={handleManualTimeChange}
            style={{
              height: '64px',
              borderRadius: '16px',
              border: '2px solid var(--color-border, #23372A)',
              backgroundColor: 'var(--color-neutral-bg, #F6F7F2)',
              padding: '0 16px',
              fontFamily: 'inherit',
              fontSize: '30px',
              fontWeight: 600,
              color: 'var(--text-primary, #1E2A20)',
              boxSizing: 'border-box',
              width: '100%',
              outline: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
          />

          {/* 4 Offset Chips */}
          <div
            data-testid="offset-chips-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '6px',
            }}
          >
            {CHIP_OFFSETS.map((offset) => {
              const isActive = activeOffset === offset;
              return (
                <button
                  key={offset}
                  type="button"
                  data-testid={`offset-chip-${offset}`}
                  data-offset={offset}
                  data-active={isActive ? 'true' : 'false'}
                  aria-pressed={isActive}
                  onClick={() => handleChipClick(offset)}
                  className="bento-interactive"
                  style={{
                    height: '44px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: isActive ? 'var(--color-dark, #23372A)' : 'var(--color-neutral-bg, #ECEEE6)',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--color-lime, #D4F27A)' : 'var(--text-primary, #1E2A20)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition:
                      'background-color var(--transition-fast, 0.15s ease), color var(--transition-fast, 0.15s ease)',
                  }}
                >
                  {`−${offset} мин`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Save Button */}
        <button
          type="button"
          data-testid="action-save-btn"
          onClick={() => onConfirm({ source: 'MANUAL', time: selectedTime, ...(type === 'FELL_ASLEEP' && nightSleep ? { isNightSleep: true } : {}) })}
          className="bento-interactive"
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
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            boxSizing: 'border-box',
            boxShadow: 'var(--shadow-md, 0 4px 16px rgba(35, 55, 42, 0.08))',
            userSelect: 'none',
          }}
        >
          {saveButtonText}
        </button>

        {/* Footer text */}
        <div
          data-testid="modal-footer-text"
          style={{
            fontSize: '13px',
            color: 'var(--text-muted, #4A5A4C)',
            textAlign: 'center',
            paddingTop: '2px',
          }}
        >
          {footerText}
        </div>
      </section>
    </div>
  );
};

export default SleepActionModal;
