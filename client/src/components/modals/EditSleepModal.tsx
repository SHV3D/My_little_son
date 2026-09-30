import React, { useState, useEffect, useRef } from 'react';
import { UpdateSleepEventInput } from '../../api/sleepApi';

export interface EditSleepModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: any | null; // FormattedSleepEvent or DayLogRecord
  childId?: string;
  onSave?: (eventId: string, data: UpdateSleepEventInput) => Promise<void> | void;
  onDelete?: (eventId: string) => Promise<void> | void;
  className?: string;
  style?: React.CSSProperties;
}

function getTodayISODate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseEventData(event: any) {
  if (!event) {
    return {
      id: '',
      date: getTodayISODate(),
      eventType: 'NAP' as const,
      startTime: '13:00',
      endTime: '14:30',
      napNumber: 1,
      isOngoing: false,
    };
  }

  let eventType: 'WAKEUP' | 'NAP' | 'NIGHT_SLEEP' = 'NAP';
  if (event.eventType === 'WAKEUP' || event.eventType === 'NAP' || event.eventType === 'NIGHT_SLEEP') {
    eventType = event.eventType;
  } else if (typeof event.title === 'string') {
    const t = event.title.toLowerCase();
    if (t.includes('подъём') || t.includes('подъем') || t.includes('пробужд')) {
      eventType = 'WAKEUP';
    } else if (t.includes('ночн')) {
      eventType = 'NIGHT_SLEEP';
    } else {
      eventType = 'NAP';
    }
  }

  let date = event.date || '';
  if (!date && typeof event.startTime === 'string' && event.startTime.includes('T')) {
    date = event.startTime.slice(0, 10);
  }
  if (!date) {
    date = getTodayISODate();
  }

  // Extract start time
  let startTime = '';
  if (event.startTime) {
    if (event.startTime.includes('T')) {
      const match = event.startTime.match(/T(\d{2}:\d{2})/);
      if (match) startTime = match[1];
    } else {
      const match = event.startTime.match(/\b\d{1,2}:\d{2}\b/);
      if (match) startTime = match[0].padStart(5, '0');
    }
  } else if (event.formattedStartTime) {
    startTime = event.formattedStartTime;
  }

  // Extract end time
  let endTime: string = '';
  if (event.endTime) {
    if (event.endTime.includes('T')) {
      const match = event.endTime.match(/T(\d{2}:\d{2})/);
      if (match) endTime = match[1];
    } else {
      const match = event.endTime.match(/\b\d{1,2}:\d{2}\b/);
      if (match) endTime = match[0].padStart(5, '0');
    }
  } else if (event.formattedEndTime) {
    endTime = event.formattedEndTime;
  }

  // Fallback to parsing event.time (e.g. "09:40 – 10:55", "07:10", "13:22 – …")
  if ((!startTime || (!endTime && eventType !== 'WAKEUP')) && typeof event.time === 'string') {
    const times = event.time.match(/\b\d{1,2}:\d{2}\b/g);
    if (times && times.length > 0) {
      if (!startTime) startTime = times[0].padStart(5, '0');
      if (!endTime && times.length > 1) endTime = times[1].padStart(5, '0');
    }
  }

  if (!startTime) {
    startTime = '12:00';
  }

  let isOngoing = Boolean(event.isOngoing);
  if (!isOngoing && eventType !== 'WAKEUP') {
    if (
      event.endTime === null ||
      event.time?.includes('…') ||
      event.time?.includes('идёт') ||
      event.title?.includes('идёт')
    ) {
      isOngoing = true;
    }
  }

  let napNumber = typeof event.napNumber === 'number' ? event.napNumber : null;
  if (!napNumber && typeof event.title === 'string') {
    const numMatch = event.title.match(/Сон\s+(\d+)/i);
    if (numMatch) {
      napNumber = parseInt(numMatch[1], 10);
    }
  }
  if (!napNumber) {
    napNumber = 1;
  }

  return {
    id: event.id || '',
    date,
    eventType,
    startTime,
    endTime: isOngoing ? '' : (endTime || ''),
    napNumber,
    isOngoing,
  };
}

function calculateDurationText(
  eventType: 'WAKEUP' | 'NAP' | 'NIGHT_SLEEP',
  startTime: string,
  endTime: string,
  isOngoing: boolean
): string {
  if (eventType === 'WAKEUP') {
    return 'Момент пробуждения';
  }
  if (isOngoing) {
    return 'Сон идёт';
  }
  if (!startTime || !endTime) {
    return '—';
  }
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) {
    return '—';
  }
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 1440;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours > 0 && mins > 0) {
    return `Длительность: ${hours} ч ${mins} мин`;
  }
  if (hours > 0) {
    return `Длительность: ${hours} ч`;
  }
  return `Длительность: ${mins} мин`;
}

export const EditSleepModal: React.FC<EditSleepModalProps> = ({
  isOpen,
  onClose,
  event,
  childId: _childId,
  onSave,
  onDelete,
  className,
  style,
}) => {
  const [eventType, setEventType] = useState<'WAKEUP' | 'NAP' | 'NIGHT_SLEEP'>('NAP');
  const [date, setDate] = useState<string>(getTodayISODate());
  const [startTime, setStartTime] = useState<string>('12:00');
  const [endTime, setEndTime] = useState<string>('');
  const [napNumber, setNapNumber] = useState<number>(1);
  const [isOngoing, setIsOngoing] = useState<boolean>(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Swipe-down tracking
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);
  const isTouchFromDragHandle = useRef<boolean>(false);
  const isTouchFromTop = useRef<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const parsed = parseEventData(event);
      setEventType(parsed.eventType);
      setDate(parsed.date);
      setStartTime(parsed.startTime);
      setEndTime(parsed.endTime);
      setNapNumber(parsed.napNumber);
      setIsOngoing(parsed.isOngoing);
      setIsConfirmingDelete(false);
      setIsSubmitting(false);
      setIsDeleting(false);
    }
  }, [isOpen, event]);

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

  const handleSave = async () => {
    if (!startTime) return;
    const eventId = event?.id;
    if (!eventId) return;

    const payload: UpdateSleepEventInput = {
      eventType,
      startTime,
      endTime: eventType === 'WAKEUP' ? null : (isOngoing ? null : (endTime || null)),
      napNumber: eventType === 'NAP' ? napNumber : null,
      date,
    };

    if (onSave) {
      setIsSubmitting(true);
      try {
        await onSave(eventId, payload);
        onClose();
      } catch (err) {
        console.error('Failed to update sleep event:', err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDelete = async () => {
    const eventId = event?.id;
    if (!eventId || !onDelete) return;

    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(eventId);
      onClose();
    } catch (err) {
      console.error('Failed to delete sleep event:', err);
    } finally {
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      data-testid="edit-sleep-modal-backdrop"
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
        aria-labelledby="edit-sleep-title"
        data-testid="edit-sleep-modal"
        className={className}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: '#ECEEE6',
          borderRadius: '32px 32px 0 0',
          padding: '10px 16px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxSizing: 'border-box',
          boxShadow: '0 -8px 32px rgba(18, 28, 21, 0.24)',
          fontFamily: "'Geologica', system-ui, sans-serif",
          color: '#1E2A20',
          animation: 'bento-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          maxHeight: '90vh',
          overflowY: 'auto',
          ...style,
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
            backgroundColor: '#C5CCBC',
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
            id="edit-sleep-title"
            data-testid="edit-sleep-title"
            style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '-0.6px',
              color: '#1E2A20',
            }}
          >
            Редактировать запись
          </h2>
          <button
            type="button"
            data-testid="edit-sleep-close-btn"
            onClick={onClose}
            aria-label="Закрыть"
            className="bento-interactive"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              backgroundColor: '#FFFFFF',
              color: '#1E2A20',
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
          data-testid="edit-sleep-type-selector"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '6px',
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '6px',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30, 42, 32, 0.05))',
          }}
        >
          <button
            type="button"
            data-testid="edit-sleep-type-wakeup"
            onClick={() => setEventType('WAKEUP')}
            className="bento-interactive"
            style={{
              height: '40px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: eventType === 'WAKEUP' ? '#23372A' : 'transparent',
              color: eventType === 'WAKEUP' ? '#D4F27A' : '#1E2A20',
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
            data-testid="edit-sleep-type-nap"
            onClick={() => setEventType('NAP')}
            className="bento-interactive"
            style={{
              height: '40px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: eventType === 'NAP' ? '#23372A' : 'transparent',
              color: eventType === 'NAP' ? '#D4F27A' : '#1E2A20',
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
            data-testid="edit-sleep-type-night"
            onClick={() => setEventType('NIGHT_SLEEP')}
            className="bento-interactive"
            style={{
              height: '40px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: eventType === 'NIGHT_SLEEP' ? '#23372A' : 'transparent',
              color: eventType === 'NIGHT_SLEEP' ? '#D4F27A' : '#1E2A20',
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
            backgroundColor: '#FFFFFF',
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
              htmlFor="edit-sleep-date"
              style={{ fontSize: '13px', fontWeight: 500, color: '#4A5A4C' }}
            >
              Дата
            </label>
            <input
              id="edit-sleep-date"
              data-testid="edit-sleep-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                height: '48px',
                borderRadius: '14px',
                border: '1.5px solid #E3E7DA',
                backgroundColor: '#F6F7F2',
                padding: '0 12px',
                fontFamily: 'inherit',
                fontSize: '16px',
                fontWeight: 500,
                color: '#1E2A20',
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
                htmlFor="edit-sleep-start-time"
                style={{ fontSize: '13px', fontWeight: 500, color: '#4A5A4C' }}
              >
                {eventType === 'WAKEUP' ? 'Время подъёма' : 'Начало сна'}
              </label>
              <input
                id="edit-sleep-start-time"
                data-testid="edit-sleep-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{
                  height: '52px',
                  borderRadius: '14px',
                  border: '2px solid #23372A',
                  backgroundColor: '#F6F7F2',
                  padding: '0 12px',
                  fontFamily: 'inherit',
                  fontSize: '22px',
                  fontWeight: 600,
                  color: '#1E2A20',
                  outline: 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
            </div>

            {/* End Time (only if NAP or NIGHT_SLEEP) */}
            {eventType !== 'WAKEUP' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="edit-sleep-end-time"
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: isOngoing ? '#A6B8A5' : '#4A5A4C',
                  }}
                >
                  Конец сна
                </label>
                <input
                  id="edit-sleep-end-time"
                  data-testid="edit-sleep-end-time"
                  type="time"
                  value={endTime}
                  disabled={isOngoing}
                  onChange={(e) => setEndTime(e.target.value)}
                  style={{
                    height: '52px',
                    borderRadius: '14px',
                    border: '1.5px solid #E3E7DA',
                    backgroundColor: isOngoing ? '#ECEEE6' : '#F6F7F2',
                    padding: '0 12px',
                    fontFamily: 'inherit',
                    fontSize: '22px',
                    fontWeight: 600,
                    color: isOngoing ? '#889886' : '#1E2A20',
                    outline: 'none',
                    fontVariantNumeric: 'tabular-nums',
                    opacity: isOngoing ? 0.6 : 1,
                  }}
                />
              </div>
            )}
          </div>

          {/* Ongoing toggle for sleep events */}
          {eventType !== 'WAKEUP' && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                color: '#4A5A4C',
                paddingTop: '2px',
              }}
            >
              <input
                type="checkbox"
                data-testid="edit-sleep-ongoing-toggle"
                checked={isOngoing}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsOngoing(checked);
                  if (checked) {
                    setEndTime('');
                  }
                }}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: '#23372A',
                  cursor: 'pointer',
                }}
              />
              <span>Сон ещё идёт</span>
            </label>
          )}

          {/* Nap Number Picker (if eventType === 'NAP') */}
          {eventType === 'NAP' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '4px',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#4A5A4C' }}>
                Номер дневного сна
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    data-testid={`edit-sleep-nap-number-${num}`}
                    onClick={() => setNapNumber(num)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: napNumber === num ? '#23372A' : '#ECEEE6',
                      color: napNumber === num ? '#D4F27A' : '#1E2A20',
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

          {/* Duration Badge Preview */}
          <div
            data-testid="edit-sleep-duration-preview"
            style={{
              padding: '8px 12px',
              borderRadius: '12px',
              backgroundColor: isOngoing ? 'rgba(212, 242, 122, 0.25)' : '#F4F5EF',
              color: '#1E2A20',
              fontSize: '13px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              alignSelf: 'flex-start',
            }}
          >
            <span style={{ fontSize: '15px' }}>{isOngoing ? '⏳' : '⏱️'}</span>
            <span>{calculateDurationText(eventType, startTime, endTime, isOngoing)}</span>
          </div>
        </div>

        {/* Action buttons: Save & Delete */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <button
            type="button"
            data-testid="edit-sleep-save-btn"
            disabled={isSubmitting || !startTime}
            onClick={handleSave}
            className="bento-interactive"
            style={{
              width: '100%',
              height: '52px',
              borderRadius: '16px',
              backgroundColor: '#D4F27A',
              color: '#1E2A20',
              border: 'none',
              fontSize: '16px',
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: isSubmitting || !startTime ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || !startTime ? 0.6 : 1,
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30, 42, 32, 0.05))',
            }}
          >
            {isSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
          </button>

          <button
            type="button"
            data-testid="edit-sleep-delete-btn"
            disabled={isDeleting}
            onClick={handleDelete}
            className="bento-interactive"
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '16px',
              backgroundColor: isConfirmingDelete ? 'rgba(220, 60, 50, 0.12)' : 'transparent',
              color: '#C53929',
              border: '1.5px solid rgba(197, 57, 41, 0.35)',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {isDeleting ? 'Удаление...' : isConfirmingDelete ? 'Точно удалить?' : 'Удалить запись'}
          </button>
        </div>
      </section>
    </div>
  );
};
