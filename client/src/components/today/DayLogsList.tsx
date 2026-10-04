import React from 'react';
import { FormattedSleepEvent } from '../../api/sleepApi';

export interface DayLogRecord {
  id: string;
  title: string; // e.g. "Подъём", "Сон 1 · 1:15", "Сон 2 · идёт"
  author: string; // e.g. "Мама", "Папа"
  time: string; // e.g. "07:10", "09:40 – 10:55", "13:22 – …"
  eventType?: 'WAKEUP' | 'NAP' | 'NIGHT_SLEEP';
  isOngoing?: boolean;
}

export interface DayLogsListProps {
  /**
   * Pre-formatted day log records
   */
  records?: DayLogRecord[];

  /**
   * Raw or formatted sleep events from API to auto-convert
   */
  events?: FormattedSleepEvent[];

  /**
   * Callback when clicking "+ Добавить сон задним числом"
   */
  onAddRetroactiveClick?: () => void;

  /**
   * Optional callback when tapping an event row (for editing or details)
   */
  onRecordClick?: (record: DayLogRecord) => void;

  className?: string;
  style?: React.CSSProperties;
}

export const DEFAULT_DAY_RECORDS: DayLogRecord[] = [
  { id: 'log-1', title: 'Подъём', author: 'Мама', time: '07:10', eventType: 'WAKEUP' },
  { id: 'log-2', title: 'Сон 1 · 1:15', author: 'Папа', time: '09:40 – 10:55', eventType: 'NAP' },
  { id: 'log-3', title: 'Сон 2 · идёт', author: 'Мама', time: '13:22 – …', eventType: 'NAP', isOngoing: true },
];

export function formatEventsToDayLogRecords(events: FormattedSleepEvent[]): DayLogRecord[] {
  return events.map((ev) => {
    let title = ev.title;
    if (!title) {
      if (ev.eventType === 'WAKEUP') {
        title = 'Подъём';
      } else if (ev.eventType === 'NAP') {
        if (ev.isOngoing) {
          title = `Сон ${ev.napNumber ?? 1} · идёт`;
        } else {
          title = `Сон ${ev.napNumber ?? 1}${ev.formattedDuration ? ` · ${ev.formattedDuration}` : ''}`;
        }
      } else {
        title = 'Ночной сон';
      }
    }

    let time = '';
    const start = ev.formattedStartTime || ev.startTime || '';
    if (ev.eventType === 'WAKEUP') {
      time = start;
    } else if (ev.isOngoing) {
      time = `${start} – …`;
    } else {
      const end = ev.formattedEndTime || ev.endTime || '';
      time = end ? `${start} – ${end}` : start;
    }

    return {
      id: ev.id,
      title,
      author: ev.recordedByName || 'Мама',
      time,
      eventType: ev.eventType,
      isOngoing: ev.isOngoing,
    };
  });
}

export const DayLogsList: React.FC<DayLogsListProps> = ({
  records,
  events,
  onAddRetroactiveClick,
  onRecordClick,
  className = '',
  style,
}) => {
  // Determine display records
  let displayRecords: DayLogRecord[];
  if (records && records.length > 0) {
    displayRecords = records;
  } else if (events && events.length > 0) {
    displayRecords = formatEventsToDayLogRecords(events);
  } else {
    // No real records → show an empty state, NOT fake sample data.
    displayRecords = [];
  }

  return (
    <section
      className={`day-logs-list ${className}`.trim()}
      data-testid="day-logs-list"
      style={{
        background: 'var(--color-white, #FFFFFF)',
        borderRadius: '24px',
        padding: '6px 16px 10px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        width: '100%',
        boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30, 42, 32, 0.05))',
        ...style,
      }}
    >
      <div
        data-testid="day-logs-title"
        style={{
          padding: '10px 0 4px',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-muted, #4A5A4C)',
        }}
      >
        Записи за день
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {displayRecords.length === 0 && (
          <div
            data-testid="day-logs-empty"
            style={{
              padding: '16px 0 18px',
              fontSize: '14px',
              color: 'var(--text-muted, #4A5A4C)',
              textAlign: 'center',
            }}
          >
            Пока нет записей за день
          </div>
        )}
        {displayRecords.map((record, index) => {
          const isLast = index === displayRecords.length - 1;
          return (
            <button
              key={record.id || index}
              type="button"
              data-testid="day-log-item"
              onClick={() => onRecordClick?.(record)}
              style={{
                minHeight: '52px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0',
                background: 'none',
                border: '0',
                borderBottom: isLast ? 'none' : '1px solid var(--color-border, #E3E7DA)',
                fontFamily: 'inherit',
                color: 'var(--text-primary, #1E2A20)',
                textAlign: 'left',
                width: '100%',
                cursor: onRecordClick ? 'pointer' : 'default',
                boxSizing: 'border-box',
              }}
            >
              <span
                data-testid="day-log-event-title"
                style={{
                  flexGrow: 1,
                  fontSize: '15px',
                  fontWeight: 400,
                  color: 'var(--text-primary, #1E2A20)',
                }}
              >
                {record.title}
              </span>
              <span
                data-testid="day-log-author"
                style={{
                  padding: '3px 8px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-neutral-bg, #ECEEE6)',
                  fontSize: '12px',
                  color: 'var(--text-muted, #4A5A4C)',
                  fontWeight: 500,
                }}
              >
                {record.author}
              </span>
              <span
                data-testid="day-log-time"
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  width: '104px',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--text-primary, #1E2A20)',
                }}
              >
                {record.time}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        data-testid="add-retroactive-sleep-btn"
        onClick={onAddRetroactiveClick}
        className="bento-interactive"
        style={{
          height: '44px',
          marginTop: '4px',
          borderRadius: '14px',
          border: '1.5px dashed #9AA793',
          background: 'none',
          fontFamily: 'inherit',
          fontSize: '15px',
          fontWeight: 500,
          color: '#2F5A3A',
          cursor: 'pointer',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          transition: 'background-color var(--transition-fast, 0.2s ease)',
        }}
      >
        + Добавить сон задним числом
      </button>
    </section>
  );
};

export default DayLogsList;
