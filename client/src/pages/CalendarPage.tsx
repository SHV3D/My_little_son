import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '../components/common/Header';
import { MonthGrid } from '../components/calendar/MonthGrid';
import { DayDetailCard } from '../components/calendar/DayDetailCard';
import { BottomNav } from '../components/common/BottomNav';
import { fetchMonthSummary, MonthSummaryResponse } from '../api/sleepApi';

export interface CalendarPageProps {
  initialYear?: number;
  initialMonth?: number;
  initialSelectedDate?: string;
  initialData?: MonthSummaryResponse;
  childId?: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onSelectTab?: (tab: string) => void;
  onEditDay?: (date: string) => void;
  onEditRecord?: (record: any) => void;
  refreshKey?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({
  initialYear = 2026,
  initialMonth = 9,
  initialSelectedDate = '2026-09-29',
  initialData,
  childId = 'demo-child-1',
  theme,
  onToggleTheme,
  onSelectTab,
  onEditDay,
  onEditRecord,
  refreshKey,
  className = '',
  style,
}) => {
  const [year, setYear] = useState<number>(initialData?.year ?? initialYear);
  const [month, setMonth] = useState<number>(initialData?.month ?? initialMonth);
  const [selectedDate, setSelectedDate] = useState<string>(initialSelectedDate);
  const [monthData, setMonthData] = useState<MonthSummaryResponse | null>(initialData || null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const hasLoadedInitial = useRef<boolean>(!!initialData);

  const loadMonth = useCallback(
    async (targetYear: number, targetMonth: number) => {
      try {
        setIsLoading(true);
        const data = await fetchMonthSummary(childId, targetYear, targetMonth);
        setMonthData(data);
      } catch {
        // Graceful error fallback
      } finally {
        setIsLoading(false);
      }
    },
    [childId]
  );

  useEffect(() => {
    if (hasLoadedInitial.current) {
      hasLoadedInitial.current = false;
      return;
    }
    loadMonth(year, month);
  }, [year, month, loadMonth]);

  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== 0) {
      loadMonth(year, month);
    }
  }, [refreshKey, year, month, loadMonth]);

  const handlePrevMonth = () => {
    let nextY = year;
    let nextM = month - 1;
    if (nextM < 1) {
      nextM = 12;
      nextY -= 1;
    }
    setYear(nextY);
    setMonth(nextM);
    setSelectedDate(`${nextY}-${String(nextM).padStart(2, '0')}-01`);
  };

  const handleNextMonth = () => {
    let nextY = year;
    let nextM = month + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    setYear(nextY);
    setMonth(nextM);
    setSelectedDate(`${nextY}-${String(nextM).padStart(2, '0')}-01`);
  };

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  // Find summary for selected day
  const selectedDay = monthData?.days?.find((d) => d.date === selectedDate);

  const handleEditClick = () => {
    if (selectedDay?.events && selectedDay.events.length > 0 && onEditRecord) {
      onEditRecord(selectedDay.events[0]);
    } else if (onEditDay) {
      onEditDay(selectedDate);
    }
  };

  return (
    <div
      data-testid="calendar-page"
      data-loading={isLoading ? 'true' : 'false'}
      className={`calendar-page mobile-viewport-wrapper ${className}`.trim()}
      style={{
        width: '100%',
        maxWidth: '430px',
        height: '100%',
        overflow: 'hidden',
        margin: '0 auto',
        boxSizing: 'border-box',
        backgroundColor: 'var(--bg-primary, #ECEEE6)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Geologica', system-ui, sans-serif",
        color: 'var(--text-primary, #1E2A20)',
        opacity: isLoading ? 0.7 : 1,
        transition: 'opacity 0.2s ease',
        ...style,
      }}
    >
      {/* App Header with Title, Roles, and Theme Toggle */}
      <Header
        title="Календарь"
        titleTestId="calendar-title"
        roles={['Мама', 'Папа']}
        isOnline={true}
        theme={theme}
        onToggleTheme={onToggleTheme}
        style={{ flexShrink: 0, padding: 'max(20px, env(safe-area-inset-top, 20px)) 16px 8px' }}
      />

      <div
        className="screen-content"
        style={{
          flex: '1 1 auto',
          overflowY: 'auto',
          padding: '8px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxSizing: 'border-box',
        }}
      >
        {/* Month Navigation Row */}
        <div
          data-testid="calendar-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '2px 4px 0',
          }}
        >
          <span
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-muted, #4A5A4C)',
            }}
          >
            История сна
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              aria-label="Предыдущий месяц"
              data-testid="prev-month-btn"
              onClick={handlePrevMonth}
              className="bento-interactive"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                border: 0,
                background: 'var(--color-white, #FFFFFF)',
                color: 'var(--text-primary, #1E2A20)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30, 42, 32, 0.05))',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Следующий месяц"
              data-testid="next-month-btn"
              onClick={handleNextMonth}
              className="bento-interactive"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                border: 0,
                background: 'var(--color-white, #FFFFFF)',
                color: 'var(--text-primary, #1E2A20)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30, 42, 32, 0.05))',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Month Grid Card */}
        <MonthGrid
          year={year}
          month={month}
          selectedDate={selectedDate}
          daysData={monthData?.days}
          onSelectDate={handleSelectDate}
        />

        {/* Day Detail Card */}
        <DayDetailCard
          day={selectedDay}
          date={selectedDate}
          targetDaySleepMinutes={monthData?.targetDaySleepMinutes}
          targetNapsCount={monthData?.targetNapsCount}
          targetBedtime={monthData?.targetBedtime}
          onEventClick={onEditRecord}
          onEditClick={handleEditClick}
        />
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNav activeTab="calendar" onSelectTab={onSelectTab} style={{ flexShrink: 0 }} />
    </div>
  );
};

export default CalendarPage;
