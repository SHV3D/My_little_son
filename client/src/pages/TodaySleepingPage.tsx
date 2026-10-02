import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/common/Header';
import { BottomNav } from '../components/common/BottomNav';
import { WarningBanner } from '../components/common/WarningBanner';
import { SleepingHeroCard } from '../components/today/SleepingHeroCard';
import { DayLogsList, DayLogRecord } from '../components/today/DayLogsList';
import {
  SleepActionModal,
  SleepActionConfirmPayload,
  RetroactiveSleepModal,
  RetroactiveSavePayload,
  getCurrentTimeHHMM,
} from '../components/modals';
import { useFamilySync } from '../hooks/useFamilySync';
import {
  fetchScheduleStatus,
  DayStatusResponse,
  recordWokeUpApi,
  recordRetroactiveApi,
  SleepWarning,
  SleepWarningCode,
} from '../api/sleepApi';
import { formatDurationRussian } from '@shared/sleepEngine';

export interface TodaySleepingPageProps {
  /**
   * Action trigger when tapping the big "Проснулся" button
   */
  onWokeUpClick?: () => void;

  /**
   * Action trigger when tapping "+ Добавить сон задним числом"
   */
  onAddRetroactiveClick?: () => void;

  /**
   * Optional callback when tapping a day log record
   */
  onRecordClick?: (record: DayLogRecord) => void;

  /**
   * Optional callback to edit a day log record
   */
  onEditRecord?: (record: any) => void;

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

  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;

  className?: string;
  style?: React.CSSProperties;
}

function formatRussianHeaderDate(dateString?: string): string {
  let date: Date;
  if (dateString) {
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

export const TodaySleepingPage: React.FC<TodaySleepingPageProps> = ({
  onWokeUpClick,
  onAddRetroactiveClick,
  onRecordClick,
  onEditRecord,
  onSelectTab,
  childId = 'demo-child-1',
  familyId = 'demo-family-1',
  initialData,
  theme,
  onToggleTheme,
  className = '',
  style,
}) => {
  const [statusData, setStatusData] = useState<DayStatusResponse | undefined>(initialData);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isRetroactiveModalOpen, setIsRetroactiveModalOpen] = useState(false);
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<SleepWarningCode>>(new Set());

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchScheduleStatus(childId);
      setStatusData(data);
    } catch {
      // Graceful fallback to retain current data
    }
  }, [childId]);

  const handleOpenWokeUp = () => {
    if (onWokeUpClick) {
      onWokeUpClick();
    } else {
      setIsActionModalOpen(true);
    }
  };

  const handleAction = (warning: SleepWarning) => {
    if (warning.actionType === 'WAKE_NOW' || warning.actionType === 'SET_WAKE_TIME') {
      handleOpenWokeUp();
    }
  };

  const handleAddRetroactiveBtnClick = () => {
    if (onAddRetroactiveClick) {
      onAddRetroactiveClick();
    } else {
      setIsRetroactiveModalOpen(true);
    }
  };

  const handleConfirmWokeUp = async (payload: SleepActionConfirmPayload) => {
    setIsActionModalOpen(false);
    const time = payload.time || statusData?.currentTime || getCurrentTimeHHMM();

    // Optimistic UI update
    setStatusData((prev) =>
      prev
        ? {
            ...prev,
            state: 'AWAKE',
            schedule: {
              ...prev.schedule,
              state: 'AWAKE',
              lastWakeTime: time,
              completedNapsCount: (prev.schedule?.completedNapsCount || 0) + 1,
            },
          }
        : undefined
    );

    try {
      await recordWokeUpApi(childId, time, payload.source);
      await loadStatus();
    } catch {
      await loadStatus();
    }
  };

  const handleSaveRetroactive = async (payload: RetroactiveSavePayload) => {
    setIsRetroactiveModalOpen(false);
    try {
      await recordRetroactiveApi({
        childId,
        date: payload.date || statusData?.date,
        eventType: payload.eventType,
        startTime: payload.startTime,
        endTime: payload.endTime,
        napNumber: payload.napNumber,
      });
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

  useEffect(() => {
    if (initialData) {
      setStatusData(initialData);
    }
  }, [initialData]);

  const schedule = statusData?.schedule;

  // Header Title
  const headerDate = formatRussianHeaderDate(statusData?.date);

  // Wake deadline values
  const wakeDeadlineTime = schedule?.wakeDeadlineTime || '14:52';
  const wakeDeadlineSubtext = schedule?.wakeDeadlineMessage
    ? 'иначе сдвинется отбой'
    : 'иначе сдвинется отбой';

  // Bedtime values
  const bedtimeTime = schedule?.projectedBedtime || schedule?.targetBedtime || '20:25';
  const bedtimeStatus =
    schedule?.bedtimeStatusMessage ||
    (schedule?.isBedtimeShifted ? 'пересчитано' : 'пересчитано');

  // Subsequent nap values
  const firstSubsequent = schedule?.subsequentNaps?.[0];
  const subsequentNapTitle = firstSubsequent
    ? `Потом: сон ${firstSubsequent.napNumber}`
    : 'Потом: сон 3';
  const subsequentNapDetails = firstSubsequent
    ? `${firstSubsequent.formattedWindow || `${firstSubsequent.plannedStartTime} – ${firstSubsequent.plannedEndTime}`} · ${firstSubsequent.formattedDuration}`
    : '17:20 – 17:55 · 35 мин';

  // Planned current nap duration text
  const plannedDurationText = schedule?.plannedCurrentNapDurationMinutes
    ? formatDurationRussian(schedule.plannedCurrentNapDurationMinutes)
    : '1 ч 30 мин';

  // Check if wake deadline is exceeded or abnormally long nap warning exists
  const isWakeNow = Boolean(
    schedule?.isWakeDeadlineExceeded ||
    (schedule?.warnings || statusData?.warnings || []).some(
      (w) => w.code === 'ABNORMALLY_LONG_NAP' || w.actionType === 'WAKE_NOW'
    )
  );

  const activeWarnings = (schedule?.warnings || statusData?.warnings || []).filter(
    (w) => !dismissedWarnings.has(w.code)
  );

  return (
    <div
      className={`today-sleeping-page mobile-viewport-wrapper ${className}`.trim()}
      data-testid="today-sleeping-page"
      style={{
        width: '100%',
        maxWidth: '430px',
        minHeight: '100vh',
        margin: '0 auto',
        backgroundColor: 'var(--bg-primary, #ECEEE6)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Geologica', system-ui, sans-serif",
        color: 'var(--text-primary, #1E2A20)',
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
          theme={theme}
          onToggleTheme={onToggleTheme}
        />

        {/* Bento Grid */}
        <div
          data-testid="sleeping-metrics-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '10px',
          }}
        >
          {/* Card 0: Sleeping Hero Card (Span 2) */}
          <div
            data-testid="sleeping-hero-area"
            style={{
              gridColumn: 'span 2',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
            }}
          >
            <SleepingHeroCard
              napNumber={schedule?.currentNapNumber ?? 2}
              sleepStartTime={schedule?.sleepStartTime || '13:22'}
              sleepDuration={schedule?.formattedSleepDuration || '0:25'}
              plannedDurationMinutes={schedule?.plannedCurrentNapDurationMinutes ?? 90}
              plannedDurationText={plannedDurationText}
              style={{ gridColumn: undefined }}
            />
            {isWakeNow && (
              <div
                role="status"
                data-testid="sleeping-wake-now-badge"
                style={{
                  position: 'absolute',
                  bottom: '18px',
                  right: '18px',
                  backgroundColor: 'var(--warning-alert-badge-bg, #EAA392)',
                  color: 'var(--warning-alert-badge-text, #1E2A20)',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '12px',
                  padding: '4px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  lineHeight: 1.2,
                  zIndex: 2,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                }}
              >
                Пора будить
              </div>
            )}
          </div>

          {/* Warning Banner */}
          <WarningBanner
            warnings={activeWarnings}
            onDismiss={(code) => setDismissedWarnings((prev) => new Set([...prev, code]))}
            onAction={handleAction}
            style={{ gridColumn: 'span 2', marginTop: 12, marginBottom: 12 }}
          />

          {/* Card 1: Wake Deadline Card (Lime) */}
          <section
            data-testid="card-wake-deadline"
            style={{
              background: '#D4F27A',
              borderRadius: '24px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              minHeight: '120px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#1E2A20' }}>
              Разбудить до
            </div>
            <div
              data-testid="wake-deadline-time"
              style={{
                fontSize: '30px',
                fontWeight: 700,
                letterSpacing: '-1px',
                fontVariantNumeric: 'tabular-nums',
                color: '#1E2A20',
              }}
            >
              {wakeDeadlineTime}
            </div>
            <div
              data-testid="wake-deadline-subtext"
              style={{ fontSize: '13px', color: '#3E4E40' }}
            >
              {wakeDeadlineSubtext}
            </div>
          </section>

          {/* Card 2: Bedtime Card (White) */}
          <section
            data-testid="card-bedtime"
            style={{
              background: 'var(--color-white, #FFFFFF)',
              borderRadius: '24px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxSizing: 'border-box',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30, 42, 32, 0.05))',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #4A5A4C)' }}>
              Ночной сон
            </div>
            <div
              data-testid="bedtime-time"
              style={{
                fontSize: '30px',
                fontWeight: 700,
                letterSpacing: '-1px',
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--text-primary, #1E2A20)',
              }}
            >
              {bedtimeTime}
            </div>
            <div
              data-testid="bedtime-status"
              style={{ fontSize: '13px', color: 'var(--text-muted, #4A5A4C)' }}
            >
              {bedtimeStatus}
            </div>
          </section>

          {/* Card 3: Subsequent Nap Card (Span 2 White) */}
          <section
            data-testid="card-subsequent-nap"
            style={{
              gridColumn: 'span 2',
              background: 'var(--color-white, #FFFFFF)',
              borderRadius: '24px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxSizing: 'border-box',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30, 42, 32, 0.05))',
            }}
          >
            <div
              data-testid="subsequent-nap-title"
              style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #4A5A4C)', flexGrow: 1 }}
            >
              {subsequentNapTitle}
            </div>
            <div
              data-testid="subsequent-nap-details"
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-primary, #1E2A20)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {subsequentNapDetails}
            </div>
          </section>
        </div>

        {/* Big Action Button "Проснулся" */}
        <button
          type="button"
          data-testid="woke-up-btn"
          onClick={handleOpenWokeUp}
          className="bento-interactive"
          aria-label="Зафиксировать, что ребёнок проснулся"
          style={{
            height: '64px',
            minHeight: '64px',
            flexShrink: 0,
            borderRadius: '22px',
            backgroundColor: '#D4F27A',
            color: '#1E2A20',
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
            boxShadow: 'var(--shadow-md, 0 4px 16px rgba(35, 55, 42, 0.08))',
            userSelect: 'none',
            transition: 'transform var(--transition-fast, 0.2s ease), background-color var(--transition-fast, 0.2s ease)',
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
          <span>Проснулся</span>
        </button>

        {/* Day Logs List */}
        <DayLogsList
          events={statusData?.events}
          onAddRetroactiveClick={handleAddRetroactiveBtnClick}
          onRecordClick={onEditRecord || onRecordClick}
        />
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab="today" onSelectTab={onSelectTab} />

      {/* Sleep Action Modal (Woke Up) */}
      <SleepActionModal
        isOpen={isActionModalOpen}
        type="WOKE_UP"
        currentTime={statusData?.currentTime}
        onClose={() => setIsActionModalOpen(false)}
        onConfirm={handleConfirmWokeUp}
      />

      {/* Retroactive Sleep Modal */}
      <RetroactiveSleepModal
        isOpen={isRetroactiveModalOpen}
        currentDate={statusData?.date}
        existingEvents={statusData?.events}
        onClose={() => setIsRetroactiveModalOpen(false)}
        onSave={handleSaveRetroactive}
      />
    </div>
  );
};

export default TodaySleepingPage;
