import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/common/Header';
import { BottomNav } from '../components/common/BottomNav';
import { AwakeHeroCard } from '../components/today/AwakeHeroCard';
import { BentoMetricsGrid } from '../components/today/BentoMetricsGrid';
import { SleepActionModal, SleepActionConfirmPayload, getCurrentTimeHHMM } from '../components/modals/SleepActionModal';
import { useFamilySync } from '../hooks/useFamilySync';
import { fetchScheduleStatus, DayStatusResponse, recordFellAsleepApi } from '../api/sleepApi';
import { formatMinutesToHoursAndMinutes } from '@shared/sleepEngine';

export interface TodayAwakePageProps {
  /**
   * Action trigger when tapping the big "Уснул" button (e.g. to open modal sheet)
   */
  onFellAsleepClick?: () => void;

  /**
   * Navigation handler for bottom navigation tabs
   */
  onSelectTab?: (tab: string) => void;

  /**
   * Child ID for status queries (defaults to 'demo-child-1')
   */
  childId?: string;

  /**
   * Family ID for WebSocket presence and sync
   */
  familyId?: string;

  /**
   * Preloaded initial data (optional, useful for testing or fast initial load)
   */
  initialData?: DayStatusResponse;

  className?: string;
  style?: React.CSSProperties;
}

function formatRussianHeaderDate(dateString?: string): string {
  let date: Date;
  if (dateString) {
    // If "YYYY-MM-DD"
    const [y, m, d] = dateString.split('-').map(Number);
    date = new Date(y, (m || 1) - 1, d || 1);
  } else {
    date = new Date();
  }

  const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const dayName = days[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dayName}, ${dd}.${mm}`;
}

export const TodayAwakePage: React.FC<TodayAwakePageProps> = ({
  onFellAsleepClick,
  onSelectTab,
  childId = 'demo-child-1',
  familyId = 'demo-family-1',
  initialData,
  className = '',
  style,
}) => {
  const [statusData, setStatusData] = useState<DayStatusResponse | undefined>(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchScheduleStatus(childId);
      setStatusData(data);
    } catch {
      // Graceful fallback to retain current data or mock defaults
    }
  }, [childId]);

  const handleFellAsleepBtnClick = () => {
    if (onFellAsleepClick) {
      onFellAsleepClick();
    } else {
      setIsModalOpen(true);
    }
  };

  const handleConfirmFellAsleep = async (payload: SleepActionConfirmPayload) => {
    setIsModalOpen(false);
    const time = payload.time || statusData?.currentTime || getCurrentTimeHHMM();

    // Optimistic UI update
    setStatusData((prev) =>
      prev
        ? {
            ...prev,
            state: 'SLEEPING',
            schedule: {
              ...prev.schedule,
              state: 'SLEEPING',
              sleepStartTime: time,
              currentNapNumber: (prev.schedule?.completedNapsCount || 0) + 1,
            },
          }
        : undefined
    );

    try {
      await recordFellAsleepApi(childId, time, payload.source);
      await loadStatus();
    } catch {
      await loadStatus();
    }
  };

  // Real-time synchronization
  const { isConnected, onlineRoles } = useFamilySync({
    familyId,
    onSleepStatusChanged: () => {
      loadStatus();
    },
    onSettingsUpdated: () => {
      loadStatus();
    },
  });

  // Fetch status on mount
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const schedule = statusData?.schedule;

  // Header Title
  const headerDate = formatRussianHeaderDate(statusData?.date);

  // Calculate day sleep progress
  let daySleepPercent: number | undefined;
  if (schedule?.targetDaySleepMinutes && schedule?.completedDaySleepMinutes != null) {
    daySleepPercent = Math.round(
      (schedule.completedDaySleepMinutes / schedule.targetDaySleepMinutes) * 100
    );
  }

  // Subsequent nap info
  const firstSubsequent = schedule?.subsequentNaps?.[0];
  const subsequentNapTitle = firstSubsequent
    ? `Потом: сон ${firstSubsequent.napNumber}`
    : undefined;
  const subsequentNapDetails = firstSubsequent
    ? `${firstSubsequent.formattedWindow} · ${firstSubsequent.formattedDuration}`
    : undefined;

  return (
    <div
      className={`today-awake-page mobile-viewport-wrapper ${className}`.trim()}
      data-testid="today-awake-page"
      style={{
        width: '100%',
        maxWidth: '430px',
        minHeight: '100vh',
        margin: '0 auto',
        backgroundColor: '#ECEEE6',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Geologica', system-ui, sans-serif",
        color: '#1E2A20',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div
        className="screen-content"
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          padding: 'max(20px, env(safe-area-inset-top, 20px)) 16px 16px',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <Header
          title={headerDate}
          roles={onlineRoles.length > 0 ? onlineRoles : ['Мама', 'Папа']}
          isOnline={isConnected}
        />

        {/* Hero Card: Awake state */}
        <AwakeHeroCard
          awakeDuration={schedule?.formattedAwakeDuration}
          lastWakeTime={schedule?.lastWakeTime}
          intervalString="2:30–3:00"
          batteryLevel={schedule?.batteryStep}
        />

        {/* Bento Metrics 5-card Grid */}
        <BentoMetricsGrid
          nextNapTime={schedule?.nextNap?.targetStartTime}
          nextNapCountdown={schedule?.nextNap?.formattedCountdown}
          nextNapDuration={schedule?.nextNap?.formattedDuration}
          bedtime={schedule?.projectedBedtime || schedule?.targetBedtime}
          bedtimeStatus={schedule?.bedtimeStatusMessage}
          daySleepCurrent={
            schedule?.completedDaySleepMinutes != null
              ? formatMinutesToHoursAndMinutes(schedule.completedDaySleepMinutes)
              : undefined
          }
          daySleepTarget={
            schedule?.targetDaySleepMinutes != null
              ? formatMinutesToHoursAndMinutes(schedule.targetDaySleepMinutes)
              : undefined
          }
          daySleepPercent={daySleepPercent}
          completedNapsCount={schedule?.completedNapsCount}
          totalNapsCount={schedule?.targetNapsCount}
          remainingNapsText={schedule?.formattedRemainingNaps}
          subsequentNapTitle={subsequentNapTitle}
          subsequentNapDetails={subsequentNapDetails}
        />

        {/* Flexible spacer */}
        <div style={{ flexGrow: 1, minHeight: '16px' }} />

        {/* Big Action Button "Уснул" */}
        <button
          type="button"
          data-testid="fell-asleep-btn"
          onClick={handleFellAsleepBtnClick}
          className="bento-interactive"
          aria-label="Зафиксировать, что ребёнок уснул"
          style={{
            height: '64px',
            borderRadius: '22px',
            backgroundColor: '#23372A',
            color: '#F1F4EA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontSize: '18px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            boxSizing: 'border-box',
            textDecoration: 'none',
            boxShadow: 'var(--shadow-md, 0 4px 16px rgba(35, 55, 42, 0.12))',
            userSelect: 'none',
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#D4F27A"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
          </svg>
          <span>Уснул</span>
        </button>
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab="today" onSelectTab={onSelectTab} />

      {/* Sleep Action Modal (Fell Asleep) */}
      <SleepActionModal
        isOpen={isModalOpen}
        type="FELL_ASLEEP"
        currentTime={statusData?.currentTime}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmFellAsleep}
      />
    </div>
  );
};

export default TodayAwakePage;
