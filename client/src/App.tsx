import { useState, useEffect, useCallback } from 'react';
import { TodayAwakePage } from './pages/TodayAwakePage';
import { TodaySleepingPage } from './pages/TodaySleepingPage';
import { CalendarPage } from './pages/CalendarPage';
import { BottomNav } from './components/common/BottomNav';
import {
  fetchScheduleStatus,
  DayStatusResponse,
  recordFellAsleepApi,
  recordWokeUpApi,
  recordRetroactiveApi,
} from './api/sleepApi';
import {
  SleepActionModal,
  SleepActionConfirmPayload,
  RetroactiveSleepModal,
  RetroactiveSavePayload,
  getCurrentTimeHHMM,
} from './components/modals';
import { useFamilySync } from './hooks/useFamilySync';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('today');
  const [status, setStatus] = useState<DayStatusResponse | null>(null);

  const [activeModal, setActiveModal] = useState<
    | { type: 'FELL_ASLEEP' }
    | { type: 'WOKE_UP' }
    | { type: 'RETROACTIVE' }
    | null
  >(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchScheduleStatus();
      setStatus(data);
    } catch {
      // Graceful fallback to default awake view
    }
  }, []);

  useFamilySync({
    familyId: 'demo-family-1',
    onSleepStatusChanged: () => {
      loadStatus();
    },
    onSettingsUpdated: () => {
      loadStatus();
    },
  });

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleFellAsleepConfirm = async (payload: SleepActionConfirmPayload) => {
    setActiveModal(null);
    const time = payload.time || status?.currentTime || getCurrentTimeHHMM();

    // Optimistic UI: immediate transition to SLEEPING
    if (status) {
      setStatus({
        ...status,
        state: 'SLEEPING',
        schedule: {
          ...status.schedule,
          state: 'SLEEPING',
          sleepStartTime: time,
          currentNapNumber: (status.schedule?.completedNapsCount || 0) + 1,
        },
      });
    }

    try {
      await recordFellAsleepApi(status?.child?.id || 'demo-child-1', time, payload.source);
      await loadStatus();
    } catch {
      await loadStatus();
    }
  };

  const handleWokeUpConfirm = async (payload: SleepActionConfirmPayload) => {
    setActiveModal(null);
    const time = payload.time || status?.currentTime || getCurrentTimeHHMM();

    // Optimistic UI: immediate transition to AWAKE
    if (status) {
      setStatus({
        ...status,
        state: 'AWAKE',
        schedule: {
          ...status.schedule,
          state: 'AWAKE',
          lastWakeTime: time,
          completedNapsCount: (status.schedule?.completedNapsCount || 0) + 1,
        },
      });
    }

    try {
      await recordWokeUpApi(status?.child?.id || 'demo-child-1', time, payload.source);
      await loadStatus();
    } catch {
      await loadStatus();
    }
  };

  const handleRetroactiveSave = async (payload: RetroactiveSavePayload) => {
    setActiveModal(null);
    try {
      await recordRetroactiveApi({
        childId: status?.child?.id || 'demo-child-1',
        date: payload.date || status?.date,
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

  return (
    <>
      {activeTab === 'calendar' ? (
        <CalendarPage
          childId={status?.child?.id || 'demo-child-1'}
          onSelectTab={(tab) => setActiveTab(tab)}
          onEditDay={() => setActiveModal({ type: 'RETROACTIVE' })}
        />
      ) : activeTab === 'settings' ? (
        <div
          data-testid="settings-page"
          style={{
            maxWidth: '390px',
            minHeight: '100vh',
            margin: '0 auto',
            backgroundColor: '#ECEEE6',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ padding: '24px 16px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 700 }}>Настройки</h1>
          </div>
          <BottomNav activeTab="settings" onSelectTab={(tab) => setActiveTab(tab)} />
        </div>
      ) : status?.state === 'SLEEPING' ? (
        <TodaySleepingPage
          initialData={status}
          onSelectTab={(tab) => setActiveTab(tab)}
          onWokeUpClick={() => setActiveModal({ type: 'WOKE_UP' })}
          onAddRetroactiveClick={() => setActiveModal({ type: 'RETROACTIVE' })}
        />
      ) : (
        <TodayAwakePage
          initialData={status || undefined}
          onSelectTab={(tab) => setActiveTab(tab)}
          onFellAsleepClick={() => setActiveModal({ type: 'FELL_ASLEEP' })}
        />
      )}


      {/* Sleep Action Modals */}
      <SleepActionModal
        isOpen={activeModal?.type === 'FELL_ASLEEP'}
        type="FELL_ASLEEP"
        currentTime={status?.currentTime}
        onClose={() => setActiveModal(null)}
        onConfirm={handleFellAsleepConfirm}
      />

      <SleepActionModal
        isOpen={activeModal?.type === 'WOKE_UP'}
        type="WOKE_UP"
        currentTime={status?.currentTime}
        onClose={() => setActiveModal(null)}
        onConfirm={handleWokeUpConfirm}
      />

      <RetroactiveSleepModal
        isOpen={activeModal?.type === 'RETROACTIVE'}
        currentDate={status?.date}
        onClose={() => setActiveModal(null)}
        onSave={handleRetroactiveSave}
      />
    </>
  );
}
