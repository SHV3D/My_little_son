import React from 'react';
import { CalendarDaySummary } from '../../api/sleepApi';
import { DayTimelineBar, SleepInterval } from '../bento/DayTimelineBar';

export interface DayDetailCardProps {
  /**
   * Day summary data from API
   */
  day?: CalendarDaySummary | null;

  /**
   * Selected date string (YYYY-MM-DD) if day data is not provided or still loading
   */
  date?: string;

  /**
   * Default target day sleep in minutes (default 200 = 3h 20m)
   */
  targetDaySleepMinutes?: number;

  /**
   * Default target naps count (default 3)
   */
  targetNapsCount?: number;

  /**
   * Default target bedtime (default "20:30")
   */
  targetBedtime?: string;

  /**
   * Callback when clicking "Изменить"
   */
  onEditClick?: () => void;

  /**
   * Optional callback when clicking an event row
   */
  onEventClick?: (event: any) => void;

  /**
   * Optional callback to edit a record
   */
  onEditRecord?: (event: any) => void;

  className?: string;
  style?: React.CSSProperties;
}

const DAYS_OF_WEEK = [
  'Воскресенье',
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
];

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export function formatRussianDateHeader(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  const dateObj = new Date(y, (m || 1) - 1, d || 1);
  const dayName = DAYS_OF_WEEK[dateObj.getDay()];
  const monthName = MONTHS_GENITIVE[(m || 1) - 1];
  return `${dayName}, ${d} ${monthName}`;
}

export const DayDetailCard: React.FC<DayDetailCardProps> = ({
  day,
  date,
  targetDaySleepMinutes = 200,
  targetNapsCount = 3,
  targetBedtime = '20:30',
  onEditClick,
  onEventClick,
  onEditRecord,
  className = '',
  style,
}) => {
  const effectiveDate = day?.date || date || '';
  const dateTitle = formatRussianDateHeader(effectiveDate);

  // 1. Day sleep summary
  const formattedDaySleep = day?.formattedTotalDaySleep || '0:00';
  let formattedDiff = day?.formattedDifference || '';
  let diffColor = '#2F6E42';

  if (day) {
    if (day.differenceFromNormMinutes !== undefined) {
      if (day.differenceFromNormMinutes === 0) {
        formattedDiff = 'норма';
        diffColor = '#2F6E42';
      } else if (day.differenceFromNormMinutes > 0) {
        formattedDiff = `+${day.differenceFromNormMinutes} мин`;
        diffColor = '#2F6E42';
      } else {
        formattedDiff = `−${Math.abs(day.differenceFromNormMinutes)} мин`;
        diffColor = '#9A5A12';
      }
    } else if (formattedDiff) {
      formattedDiff = formattedDiff.replace('-', '−');
      if (formattedDiff.startsWith('−')) {
        diffColor = '#9A5A12';
      } else {
        diffColor = '#2F6E42';
      }
    }
  } else {
    formattedDiff = `−${targetDaySleepMinutes} мин`;
    diffColor = '#9A5A12';
  }

  // 2. Naps count summary
  const napsCount = day?.napsCount ?? 0;
  const effectiveTargetNaps = day?.targetNapsCount ?? targetNapsCount;
  let napsStatusText = 'по плану';
  let napsStatusColor = '#2F6E42';

  if (napsCount >= effectiveTargetNaps && napsCount > 0) {
    napsStatusText = 'по плану';
    napsStatusColor = '#2F6E42';
  } else if (napsCount < effectiveTargetNaps) {
    napsStatusText = 'меньше плана';
    napsStatusColor = '#9A5A12';
  } else {
    napsStatusText = 'по плану';
    napsStatusColor = '#2F6E42';
  }

  // 3. Bedtime summary
  const bedtime = day?.bedtime || '—';
  const effectiveTargetBedtime = day?.targetBedtime || targetBedtime;

  // 4. Timeline intervals calculation
  const intervals: SleepInterval[] = [];
  const events = day?.events || [];

  events.forEach((ev) => {
    if (ev.eventType === 'NAP' && ev.startTime) {
      const s = ev.formattedStartTime || ev.startTime;
      const e = ev.formattedEndTime || ev.endTime || s;
      intervals.push({
        id: ev.id,
        start: s,
        end: e,
        type: 'sleep',
        label: `${ev.title || 'Сон'}: ${s} – ${e}`,
      });
    } else if (ev.eventType === 'NIGHT_SLEEP' && ev.startTime) {
      const s = ev.formattedStartTime || ev.startTime;
      intervals.push({
        id: ev.id,
        start: s,
        end: '21:00',
        type: 'night',
        label: `Ночной сон: ${s}`,
      });
    }
  });

  // If no night sleep in events but day.bedtime exists, add night interval
  if (!events.some((e) => e.eventType === 'NIGHT_SLEEP') && day?.bedtime) {
    intervals.push({
      id: 'bedtime-interval',
      start: day.bedtime,
      end: '21:00',
      type: 'night',
      label: `Ночной сон: ${day.bedtime}`,
    });
  }

  // 5. Events list items
  interface EventRowItem {
    id: string;
    label: string;
    value: string;
    rawEvent?: any;
    eventType?: 'WAKEUP' | 'NAP' | 'NIGHT_SLEEP';
    startTime?: string;
    endTime?: string | null;
    date?: string;
    napNumber?: number | null;
    durationMinutes?: number | null;
    formattedStartTime?: string;
    formattedEndTime?: string | null;
    formattedDuration?: string;
  }
  const eventRows: EventRowItem[] = [];

  // Wakeup
  const wakeupEvent = events.find((e) => e.eventType === 'WAKEUP');
  if (wakeupEvent) {
    eventRows.push({
      ...wakeupEvent,
      id: wakeupEvent.id,
      label: 'Подъём',
      value: wakeupEvent.formattedStartTime || wakeupEvent.startTime,
      date: wakeupEvent.date || effectiveDate,
      rawEvent: wakeupEvent,
    });
  } else if (day?.wakeupTime) {
    const raw = {
      id: 'wakeup-row',
      eventType: 'WAKEUP' as const,
      startTime: day.wakeupTime,
      date: effectiveDate,
    };
    eventRows.push({
      ...raw,
      id: 'wakeup-row',
      label: 'Подъём',
      value: day.wakeupTime,
      rawEvent: raw,
    });
  }

  // Naps
  const naps = events.filter((e) => e.eventType === 'NAP');
  naps.forEach((ev, idx) => {
    const title = ev.title || `Сон ${ev.napNumber || idx + 1}`;
    const s = ev.formattedStartTime || ev.startTime;
    const e = ev.formattedEndTime || ev.endTime;
    const dur = ev.formattedDuration ? ` · ${ev.formattedDuration}` : '';
    const val = e ? `${s} – ${e}${dur}` : s;
    eventRows.push({
      ...ev,
      id: ev.id,
      label: title,
      value: val,
      date: ev.date || effectiveDate,
      rawEvent: ev,
    });
  });

  // Night sleep
  const nightEvent = events.find((e) => e.eventType === 'NIGHT_SLEEP');
  if (nightEvent) {
    eventRows.push({
      ...nightEvent,
      id: nightEvent.id,
      label: 'Ночной сон',
      value: nightEvent.formattedStartTime || nightEvent.startTime,
      date: nightEvent.date || effectiveDate,
      rawEvent: nightEvent,
    });
  } else if (day?.bedtime) {
    const raw = {
      id: 'bedtime-row',
      eventType: 'NIGHT_SLEEP' as const,
      startTime: day.bedtime,
      date: effectiveDate,
    };
    eventRows.push({
      ...raw,
      id: 'bedtime-row',
      label: 'Ночной сон',
      value: day.bedtime,
      rawEvent: raw,
    });
  }

  return (
    <div
      data-testid="day-detail-container"
      className={`day-detail-container ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        ...style,
      }}
    >
      {/* Day header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 4px 0',
        }}
      >
        <h2
          data-testid="day-detail-title"
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '-0.4px',
            color: '#1E2A20',
          }}
        >
          {dateTitle}
        </h2>
        <button
          type="button"
          data-testid="edit-day-btn"
          onClick={() => {
            if (onEditClick) {
              onEditClick();
            } else if (eventRows.length > 0) {
              const handler = onEventClick || onEditRecord;
              handler?.(eventRows[0]);
            }
          }}
          style={{
            height: '44px',
            padding: '0 14px',
            borderRadius: '14px',
            border: 0,
            background: '#FFFFFF',
            fontFamily: 'inherit',
            fontSize: '14px',
            fontWeight: 500,
            color: '#1E2A20',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          Изменить
        </button>
      </div>

      {/* 3 Summary cards */}
      <div
        data-testid="day-summary-cards"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '10px',
        }}
      >
        {/* Card 1: Днём */}
        <section
          data-testid="summary-card-day-sleep"
          style={{
            background: '#FFFFFF',
            borderRadius: '22px',
            padding: '14px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: '12px', color: '#4A5A4C' }}>Днём</div>
          <div
            data-testid="day-sleep-duration"
            style={{
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '-0.5px',
              color: '#1E2A20',
            }}
          >
            {formattedDaySleep}
          </div>
          <div
            data-testid="day-sleep-diff"
            style={{ fontSize: '12px', color: diffColor, fontWeight: 500 }}
          >
            {formattedDiff}
          </div>
        </section>

        {/* Card 2: Снов */}
        <section
          data-testid="summary-card-naps"
          style={{
            background: '#FFFFFF',
            borderRadius: '22px',
            padding: '14px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: '12px', color: '#4A5A4C' }}>Снов</div>
          <div
            data-testid="naps-count"
            style={{
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '-0.5px',
              color: '#1E2A20',
            }}
          >
            {`${napsCount} / ${effectiveTargetNaps}`}
          </div>
          <div
            data-testid="naps-status"
            style={{ fontSize: '12px', color: napsStatusColor, fontWeight: 500 }}
          >
            {napsStatusText}
          </div>
        </section>

        {/* Card 3: Отбой */}
        <section
          data-testid="summary-card-bedtime"
          style={{
            background: '#FFFFFF',
            borderRadius: '22px',
            padding: '14px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: '12px', color: '#4A5A4C' }}>Отбой</div>
          <div
            data-testid="bedtime-value"
            style={{
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '-0.5px',
              color: '#1E2A20',
            }}
          >
            {bedtime}
          </div>
          <div
            data-testid="bedtime-target"
            style={{ fontSize: '12px', color: '#4A5A4C' }}
          >
            {`цель ${effectiveTargetBedtime}`}
          </div>
        </section>
      </div>

      {/* Dark Bento Daily Timeline card */}
      <section
        data-testid="daily-timeline-card"
        style={{
          background: '#23372A',
          color: '#F1F4EA',
          borderRadius: '24px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxSizing: 'border-box',
        }}
      >
        {/* Timeline Bar Component */}
        <DayTimelineBar
          intervals={intervals}
          dayStart="07:00"
          dayEnd="21:00"
          barHeight={24}
          showTicks={true}
          ticks={['07:00', '10:30', '14:00', '17:30', '21:00']}
        />

        {/* Detailed list of day events */}
        <div
          data-testid="day-events-list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            fontSize: '15px',
          }}
        >
          {eventRows.length > 0 ? (
            eventRows.map((item) => {
              const isClickable = Boolean(onEventClick || onEditRecord);
              const handleRowClick = () => {
                const handler = onEventClick || onEditRecord;
                handler?.(item);
              };

              return (
                <div
                  key={item.id}
                  data-testid="day-event-row"
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={handleRowClick}
                  onKeyDown={(e) => {
                    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleRowClick();
                    }
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: isClickable ? 'pointer' : 'default',
                    borderRadius: '8px',
                    padding: '3px 6px',
                    margin: '0 -6px',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <span
                    data-testid="event-label"
                    style={{ color: '#B7C4B4', userSelect: 'none' }}
                  >
                    {item.label}
                  </span>
                  <span data-testid="event-value" style={{ fontWeight: 600 }}>
                    {item.value}
                  </span>
                </div>
              );
            })
          ) : (
            <div
              data-testid="empty-events-msg"
              style={{
                color: '#B7C4B4',
                fontSize: '14px',
                textAlign: 'center',
                padding: '8px 0',
              }}
            >
              Нет записей о сне за этот день
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default DayDetailCard;
