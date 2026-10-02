import React, { useState, useEffect, useRef } from 'react';
import { validateEventCollision, SleepEvent } from '@shared/sleepEngine';

export type RetroactiveEventType = 'NAP' | 'WAKEUP' | 'NIGHT_SLEEP';

export interface RetroactiveSavePayload {
  eventType: RetroactiveEventType;
  startTime: string;
  endTime?: string | null;
  date?: string;
  napNumber?: number | null;
}

export interface RetroactiveSleepModalProps {
  isOpen: boolean;
  currentDate?: string;
  defaultEventType?: RetroactiveEventType;
  defaultStartTime?: string;
  defaultEndTime?: string;
  existingEvents?: SleepEvent[] | any[];
  onClose: () => void;
  onSave: (payload: RetroactiveSavePayload) => void;
}

function getTodayISODate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const RetroactiveSleepModal: React.FC<RetroactiveSleepModalProps> = ({
  isOpen,
  currentDate,
  defaultEventType = 'NAP',
  defaultStartTime = '13:00',
  defaultEndTime = '14:30',
  existingEvents = [],
  onClose,
  onSave,
}) => {
  const [eventType, setEventType] = useState<RetroactiveEventType>(defaultEventType);
  const [date, setDate] = useState<string>(currentDate || getTodayISODate());
  const [startTime, setStartTime] = useState<string>(defaultStartTime);
  const [endTime, setEndTime] = useState<string>(defaultEndTime);
  const [napNumber, setNapNumber] = useState<number>(1);

  const collision = validateEventCollision(existingEvents || [], {
    startTime,
    endTime: eventType === 'WAKEUP' ? null : (endTime || null),
    eventType,
    date,
  });

  // Swipe-down tracking
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);
  const isTouchFromDragHandle = useRef<boolean>(false);
  const isTouchFromTop = useRef<boolean>(false);

  useEffect(() => {
    if (currentDate) {
      setDate(currentDate);
    }
  }, [currentDate]);

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

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
    const target = e.target as HTMLElement | null;
    isTouchFromDragHandle.current = Boolean(target?.closest?.('[data-testid="modal-drag-handle"]'));
    isTouchFromTop.current = (e.currentTarget?.scrollTop ?? 0) <= 0;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    touchCurrentY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    const diff = touchCurrentY.current - touchStartY.current;
    const isAtTop = (e.currentTarget?.scrollTop ?? 0) <= 0;
    const canDismiss = isTouchFromDragHandle.current || (isTouchFromTop.current && isAtTop);

    if (canDismiss && diff > 70) {
      onClose();
    }
  };

  const handleSave = () => {
    if (!startTime || collision.hasCollision) return;
    onSave({
      eventType,
      startTime,
      endTime: eventType === 'WAKEUP' ? null : (endTime || null),
      date,
      napNumber: eventType === 'NAP' ? napNumber : null,
    });
  };

  return (
    <div
      className="modal-backdrop"
      data-testid="retroactive-modal-backdrop"
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
        aria-labelledby="retroactive-modal-title"
        data-testid="retroactive-modal"
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

        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 4px',
          }}
        >
          <h2
            id="retroactive-modal-title"
            data-testid="retroactive-modal-title"
            style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '-0.6px',
              color: 'var(--text-primary, #1E2A20)',
            }}
          >
            Добавить сон
          </h2>
          <button
            type="button"
            data-testid="retroactive-close-btn"
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

        {/* Event Type Selector */}
        <div
          data-testid="event-type-selector"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '6px',
            backgroundColor: 'var(--color-white, #FFFFFF)',
            borderRadius: '16px',
            padding: '6px',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30, 42, 32, 0.05))',
          }}
        >
          <button
            type="button"
            data-testid="event-type-nap"
            onClick={() => setEventType('NAP')}
            className="bento-interactive"
            style={{
              height: '40px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: eventType === 'NAP' ? 'var(--color-dark, #23372A)' : 'transparent',
              color: eventType === 'NAP' ? 'var(--color-lime, #D4F27A)' : 'var(--text-primary, #1E2A20)',
              fontSize: '13px',
              fontWeight: eventType === 'NAP' ? 600 : 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
          >
            Дневной сон
          </button>
          <button
            type="button"
            data-testid="event-type-wakeup"
            onClick={() => setEventType('WAKEUP')}
            className="bento-interactive"
            style={{
              height: '40px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: eventType === 'WAKEUP' ? 'var(--color-dark, #23372A)' : 'transparent',
              color: eventType === 'WAKEUP' ? 'var(--color-lime, #D4F27A)' : 'var(--text-primary, #1E2A20)',
              fontSize: '13px',
              fontWeight: eventType === 'WAKEUP' ? 600 : 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
          >
            Подъём
          </button>
          <button
            type="button"
            data-testid="event-type-night"
            onClick={() => setEventType('NIGHT_SLEEP')}
            className="bento-interactive"
            style={{
              height: '40px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: eventType === 'NIGHT_SLEEP' ? 'var(--color-dark, #23372A)' : 'transparent',
              color: eventType === 'NIGHT_SLEEP' ? 'var(--color-lime, #D4F27A)' : 'var(--text-primary, #1E2A20)',
              fontSize: '13px',
              fontWeight: eventType === 'NIGHT_SLEEP' ? 600 : 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
          >
            Ночной сон
          </button>
        </div>

        {/* Date and Time Inputs Card */}
        <div
          style={{
            backgroundColor: 'var(--color-white, #FFFFFF)',
            borderRadius: '24px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30, 42, 32, 0.05))',
            boxSizing: 'border-box',
          }}
        >
          {/* Date Picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="retroactive-date"
              style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #4A5A4C)' }}
            >
              Дата
            </label>
            <input
              id="retroactive-date"
              data-testid="retroactive-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                height: '48px',
                borderRadius: '14px',
                border: '1.5px solid var(--color-border, #E3E7DA)',
                backgroundColor: 'var(--color-neutral-bg, #F6F7F2)',
                padding: '0 12px',
                fontFamily: 'inherit',
                fontSize: '16px',
                fontWeight: 500,
                color: 'var(--text-primary, #1E2A20)',
                outline: 'none',
              }}
            />
          </div>

          {/* Time Picker Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: eventType === 'WAKEUP' ? '1fr' : 'repeat(2, minmax(0, 1fr))',
              gap: '10px',
            }}
          >
            {/* Start Time */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="retroactive-start-time"
                style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #4A5A4C)' }}
              >
                {eventType === 'WAKEUP' ? 'Время подъёма' : 'Начало сна'}
              </label>
              <input
                id="retroactive-start-time"
                data-testid="retroactive-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{
                  height: '52px',
                  borderRadius: '14px',
                  border: '2px solid var(--color-border, #23372A)',
                  backgroundColor: 'var(--color-neutral-bg, #F6F7F2)',
                  padding: '0 12px',
                  fontFamily: 'inherit',
                  fontSize: '22px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1E2A20)',
                  outline: 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
            </div>

            {/* End Time (only if NAP or NIGHT_SLEEP) */}
            {eventType !== 'WAKEUP' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="retroactive-end-time"
                  style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #4A5A4C)' }}
                >
                  Конец сна
                </label>
                <input
                  id="retroactive-end-time"
                  data-testid="retroactive-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  style={{
                    height: '52px',
                    borderRadius: '14px',
                    border: '1.5px solid var(--color-border, #E3E7DA)',
                    backgroundColor: 'var(--color-neutral-bg, #F6F7F2)',
                    padding: '0 12px',
                    fontFamily: 'inherit',
                    fontSize: '22px',
                    fontWeight: 600,
                    color: 'var(--text-primary, #1E2A20)',
                    outline: 'none',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
              </div>
            )}
          </div>

          {/* Nap Number Picker (if eventType === 'NAP') */}
          {eventType === 'NAP' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #4A5A4C)' }}>
                Номер дневного сна
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    data-testid={`nap-number-${num}`}
                    onClick={() => setNapNumber(num)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: napNumber === num ? 'var(--color-dark, #23372A)' : 'var(--color-neutral-bg, #ECEEE6)',
                      color: napNumber === num ? 'var(--color-lime, #D4F27A)' : 'var(--text-primary, #1E2A20)',
                      fontSize: '14px',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Collision Warning Banner */}
        {collision.hasCollision && (
          <div
            role="alert"
            aria-live="polite"
            data-testid="retroactive-collision-warning"
            style={{
              backgroundColor: 'var(--warning-alert-bg, rgba(234, 163, 146, 0.16))',
              border: '1px solid var(--warning-alert-border, #EAA392)',
              color: 'var(--warning-alert-text, #6A2417)',
              borderRadius: '14px',
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 500,
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
            <span>{collision.message || 'Пересечение времени событий'}</span>
          </div>
        )}

        {/* Save Button */}
        <button
          type="button"
          data-testid="retroactive-save-btn"
          disabled={!startTime || collision.hasCollision}
          onClick={handleSave}
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
            cursor: !startTime || collision.hasCollision ? 'not-allowed' : 'pointer',
            opacity: !startTime || collision.hasCollision ? 0.5 : 1,
            width: '100%',
            boxSizing: 'border-box',
            boxShadow: 'var(--shadow-md, 0 4px 16px rgba(35, 55, 42, 0.08))',
            userSelect: 'none',
          }}
        >
          Сохранить запись
        </button>
      </section>
    </div>
  );
};

export default RetroactiveSleepModal;
