import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  onSelectTab?: (tab: string) => void;
  onEditDay?: (date: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({
  initialYear = 2026,
  initialMonth = 9,
  initialSelectedDate = '2026-09-29',
  initialData,
  childId = 'demo-child-1',
  onSelectTab,
  onEditDay,
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

  return (
    <div
      data-testid="calendar-page"
      data-loading={isLoading ? 'true' : 'false'}
      className={`calendar-page-container ${className}`.trim()}
      style={{
        width: '100%',
        maxWidth: '390px',
        minHeight: '100vh',
        margin: '0 auto',
        boxSizing: 'border-box',
        backgroundColor: '#ECEEE6',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Geologica', system-ui, sans-serif",
        color: '#1E2A20',
        opacity: isLoading ? 0.7 : 1,
        transition: 'opacity 0.2s ease',
        ...style,
      }}
    >
      <div
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: 'max(24px, env(safe-area-inset-top, 24px)) 16px 16px',
        }}
      >
        {/* Header with Title and Month navigation buttons */}
        <div
          data-testid="calendar-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 4px 4px',
          }}
        >
          <h1
            data-testid="calendar-title"
            style={{
              margin: 0,
              fontSize: '26px',
              fontWeight: 700,
              letterSpacing: '-0.8px',
            }}
          >
            Календарь
          </h1>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              aria-label="Предыдущий месяц"
              data-testid="prev-month-btn"
              onClick={handlePrevMonth}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                border: 0,
                background: '#FFFFFF',
                color: '#1E2A20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                userSelect: 'none',
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
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                border: 0,
                background: '#FFFFFF',
                color: '#1E2A20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                userSelect: 'none',
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
          onEditClick={() => onEditDay?.(selectedDate)}
        />
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNav activeTab="calendar" onSelectTab={onSelectTab} />
    </div>
  );
};

export default CalendarPage;
