import { useState, useEffect, useCallback } from 'react';
import { TodayAwakePage } from './pages/TodayAwakePage';
import { TodaySleepingPage } from './pages/TodaySleepingPage';
import { CalendarPage } from './pages/CalendarPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { clearAuthSession, getStoredUser } from './api/authApi';
import {
  fetchScheduleStatus,
  DayStatusResponse,
  recordFellAsleepApi,
  recordWokeUpApi,
  recordRetroactiveApi,
  updateSleepEventApi,
  deleteSleepEventApi,
  UpdateSleepEventInput,
} from './api/sleepApi';
import {
  SleepActionModal,
  SleepActionConfirmPayload,
  RetroactiveSleepModal,
  RetroactiveSavePayload,
  getCurrentTimeHHMM,
} from './components/modals';
import { EditSleepModal } from './components/modals/EditSleepModal';
import { useFamilySync } from './hooks/useFamilySync';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [authView, setAuthView] = useState<'app' | 'login' | 'register'>('app');
  const [activeTab, setActiveTab] = useState<string>('today');
  const [status, setStatus] = useState<DayStatusResponse | null>(null);

  const [activeModal, setActiveModal] = useState<
    | { type: 'FELL_ASLEEP' }
    | { type: 'WOKE_UP' }
    | { type: 'RETROACTIVE' }
    | null
  >(null);

  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState<number>(0);

  const activeFamilyId = getStoredUser()?.familyId || 'demo-family-1';

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchScheduleStatus();
      setStatus(data);
    } catch {
      // Graceful fallback to default awake view
    }
  }, []);

  useFamilySync({
    familyId: activeFamilyId,
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

  const handleOpenEditModal = (event: any) => {
    let fullEvent = event;
    if (status?.events && event?.id) {
      const found = status.events.find((e) => e.id === event.id);
      if (found) {
        fullEvent = { ...found, ...event };
      }
    }
    setEditingEvent(fullEvent);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (eventId: string, data: UpdateSleepEventInput) => {
    const childId = status?.child?.id || 'demo-child-1';
    try {
      const result = await updateSleepEventApi(eventId, data, childId);
      if (result?.status && (!status?.date || result.status.date === status.date)) {
        setStatus(result.status);
      } else {
        await loadStatus();
      }
    } catch (err) {
      console.error('Failed to update sleep event:', err);
      await loadStatus();
    } finally {
      setCalendarRefreshKey((k) => k + 1);
      setIsEditModalOpen(false);
      setEditingEvent(null);
    }
  };

  const handleDeleteEdit = async (eventId: string) => {
    const childId = status?.child?.id || 'demo-child-1';
    try {
      await deleteSleepEventApi(eventId, childId);
      await loadStatus();
    } catch (err) {
      console.error('Failed to delete sleep event:', err);
      await loadStatus();
    } finally {
      setCalendarRefreshKey((k) => k + 1);
      setIsEditModalOpen(false);
      setEditingEvent(null);
    }
  };

  if (authView === 'login') {
    return (
      <LoginPage
        onSuccess={() => {
          setAuthView('app');
          loadStatus();
        }}
        onNavigateToRegister={() => setAuthView('register')}
      />
    );
  }

  if (authView === 'register') {
    return (
      <RegisterPage
        onSuccess={() => {
          setAuthView('app');
          loadStatus();
        }}
        onNavigateToLogin={() => setAuthView('login')}
      />
    );
  }

  return (
    <>
      {activeTab === 'calendar' ? (
        <CalendarPage
          childId={status?.child?.id || 'demo-child-1'}
          theme={resolvedTheme}
          onToggleTheme={toggleTheme}
          onSelectTab={(tab) => setActiveTab(tab)}
          onEditDay={() => setActiveModal({ type: 'RETROACTIVE' })}
          onEditRecord={handleOpenEditModal}
          refreshKey={calendarRefreshKey}
        />
      ) : activeTab === 'settings' ? (
        <SettingsPage
          childId={status?.child?.id || 'demo-child-1'}
          theme={theme}
          onThemeChange={setTheme}
          onSelectTab={(tab) => setActiveTab(tab)}
          onLogout={() => {
            clearAuthSession();
            setAuthView('login');
          }}
        />
      ) : status?.state === 'SLEEPING' ? (
        <TodaySleepingPage
          initialData={status}
          theme={resolvedTheme}
          onToggleTheme={toggleTheme}
          onSelectTab={(tab) => setActiveTab(tab)}
          onWokeUpClick={() => setActiveModal({ type: 'WOKE_UP' })}
          onAddRetroactiveClick={() => setActiveModal({ type: 'RETROACTIVE' })}
          onEditRecord={handleOpenEditModal}
        />
      ) : (
        <TodayAwakePage
          initialData={status || undefined}
          theme={resolvedTheme}
          onToggleTheme={toggleTheme}
          onSelectTab={(tab) => setActiveTab(tab)}
          onFellAsleepClick={() => setActiveModal({ type: 'FELL_ASLEEP' })}
          onAddRetroactiveClick={() => setActiveModal({ type: 'RETROACTIVE' })}
          onEditRecord={handleOpenEditModal}
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
        existingEvents={status?.events || []}
        onClose={() => setActiveModal(null)}
        onSave={handleRetroactiveSave}
      />

      {/* Edit Sleep Modal */}
      <EditSleepModal
        isOpen={isEditModalOpen}
        event={editingEvent}
        existingEvents={status?.events || []}
        childId={status?.child?.id || 'demo-child-1'}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingEvent(null);
        }}
        onSave={handleSaveEdit}
        onDelete={handleDeleteEdit}
      />
    </>
  );
}
