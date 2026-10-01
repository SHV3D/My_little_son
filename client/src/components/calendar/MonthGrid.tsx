import React from 'react';
import { CalendarDaySummary } from '../../api/sleepApi';

export interface MonthGridProps {
  /**
   * 4-digit year, e.g. 2026
   */
  year: number;

  /**
   * Month index 1-12, e.g. 9 for September
   */
  month: number;

  /**
   * Currently selected date string in YYYY-MM-DD format
   */
  selectedDate?: string;

  /**
   * Current "today" date string in YYYY-MM-DD format (defaults to actual today)
   */
  todayDate?: string;

  /**
   * List of day summaries for the month
   */
  daysData?: CalendarDaySummary[] | Array<{
    date: string;
    isNormMet?: boolean;
    totalDaySleepMinutes?: number;
    events?: any[];
  }>;

  /**
   * Callback invoked when a user clicks on a day cell
   */
  onSelectDate?: (dateStr: string) => void;

  className?: string;
  style?: React.CSSProperties;
}

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const WEEKDAY_HEADERS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const MonthGrid: React.FC<MonthGridProps> = ({
  year,
  month,
  selectedDate,
  todayDate,
  daysData,
  onSelectDate,
  className = '',
  style,
}) => {
  const currentActualToday = todayDate || new Date().toISOString().slice(0, 10);
  const monthTitle = `${MONTH_NAMES[month - 1] || ''} ${year}`;

  // First day of month (Monday = 0, Sunday = 6)
  const firstDayOfWeek = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  return (
    <section
      data-testid="month-grid"
      className={`month-grid-card ${className}`.trim()}
      style={{
        background: 'var(--color-white, #FFFFFF)',
        borderRadius: '28px',
        padding: '16px 12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Month & Year Title */}
      <div
        data-testid="month-title"
        style={{
          padding: '0 4px',
          fontSize: '17px',
          fontWeight: 600,
          color: 'var(--text-primary, #1E2A20)',
          lineHeight: '1.2',
        }}
      >
        {monthTitle}
      </div>

      {/* Weekday headers: Пн Вт Ср Чт Пт Сб Вс */}
      <div
        data-testid="weekday-headers"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: '4px',
          fontSize: '12px',
          color: 'var(--text-muted, #4A5A4C)',
          textAlign: 'center',
          userSelect: 'none',
        }}
      >
        {WEEKDAY_HEADERS.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>

      {/* 7-column grid of days */}
      <div
        data-testid="days-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: '4px',
        }}
      >
        {/* Leading empty cells */}
        {Array.from({ length: firstDayOfWeek }).map((_, index) => (
          <div
            key={`empty-${index}`}
            data-testid="empty-day-cell"
            style={{ height: '52px' }}
          />
        ))}

        {/* Days of current month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isSelected = selectedDate === dateStr;
          const isToday = currentActualToday === dateStr;

          const daySummary = daysData?.find((item) => item.date === dateStr);
          const hasSleepData =
            daySummary &&
            (daySummary.totalDaySleepMinutes === undefined ||
              daySummary.totalDaySleepMinutes > 0 ||
              (daySummary.events && daySummary.events.length > 0));
          const showNormBar =
            daySummary && typeof daySummary.isNormMet === 'boolean' && hasSleepData;
          const isNormMet = !!daySummary?.isNormMet;

          if (isSelected) {
            return (
              <button
                key={dateStr}
                type="button"
                aria-pressed="true"
                aria-label={`Выбран день ${d}`}
                data-testid="day-cell"
                data-date={dateStr}
                data-selected="true"
                onClick={() => onSelectDate?.(dateStr)}
                style={{
                  height: '52px',
                  borderRadius: '14px',
                  border: 0,
                  background: 'var(--color-dark, #23372A)',
                  fontFamily: 'inherit',
                  color: 'var(--text-primary, #F1F4EA)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: 0,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 600 }}>{d}</span>
                <span
                  data-testid="norm-bar-container"
                  style={{
                    width: '24px',
                    height: '5px',
                    borderRadius: '3px',
                    background: 'var(--color-bar-inactive, #4E6552)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'block',
                  }}
                >
                  {showNormBar && (
                    <span
                      data-testid="norm-bar"
                      data-norm-met={isNormMet ? 'true' : 'false'}
                      style={{
                        display: 'block',
                        width: '100%',
                        height: '100%',
                        borderRadius: '3px',
                        background: isNormMet ? 'var(--color-lime, #D4F27A)' : 'var(--color-warning, #D08A1E)',
                      }}
                    />
                  )}
                </span>
              </button>
            );
          }

          if (isToday) {
            return (
              <button
                key={dateStr}
                type="button"
                aria-label={`Сегодня, день ${d}`}
                data-testid="day-cell"
                data-date={dateStr}
                data-today="true"
                onClick={() => onSelectDate?.(dateStr)}
                style={{
                  height: '52px',
                  borderRadius: '14px',
                  border: 0,
                  background: '#D4F27A',
                  fontFamily: 'inherit',
                  color: '#1E2A20',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: 0,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 700 }}>{d}</span>
                <span style={{ fontSize: '10px', fontWeight: 600, lineHeight: 1 }}>
                  сегодня
                </span>
              </button>
            );
          }

          return (
            <button
              key={dateStr}
              type="button"
              aria-label={`День ${d}`}
              data-testid="day-cell"
              data-date={dateStr}
              onClick={() => onSelectDate?.(dateStr)}
              style={{
                height: '52px',
                borderRadius: '14px',
                border: 0,
                background: 'var(--color-neutral-bg, #F4F5EF)',
                fontFamily: 'inherit',
                color: 'var(--text-primary, #1E2A20)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: 0,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: '15px', fontWeight: 500 }}>{d}</span>
              <span
                data-testid="norm-bar-container"
                style={{
                  width: '24px',
                  height: '5px',
                  borderRadius: '3px',
                  background: 'var(--color-border, #E3E7DA)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'block',
                }}
              >
                {showNormBar && (
                  <span
                    data-testid="norm-bar"
                    data-norm-met={isNormMet ? 'true' : 'false'}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: '100%',
                      borderRadius: '3px',
                      background: isNormMet ? 'var(--color-dark, #23372A)' : '#D08A1E',
                    }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend below grid */}
      <div
        data-testid="month-grid-legend"
        style={{
          display: 'flex',
          gap: '14px',
          padding: '4px 4px 0',
          fontSize: '12px',
          color: 'var(--text-muted, #4A5A4C)',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            data-testid="legend-norm-met"
            style={{
              width: '14px',
              height: '5px',
              borderRadius: '3px',
              background: 'var(--color-dark, #23372A)',
              display: 'inline-block',
            }}
          />
          норма дневного сна
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            data-testid="legend-norm-below"
            style={{
              width: '14px',
              height: '5px',
              borderRadius: '3px',
              background: 'var(--color-warning, #D08A1E)',
              display: 'inline-block',
            }}
          />
          меньше нормы
        </div>
      </div>
    </section>
  );
};

export default MonthGrid;
