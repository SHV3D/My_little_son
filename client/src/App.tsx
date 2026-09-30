import { useState, useEffect, useCallback } from 'react';
import { TodayAwakePage } from './pages/TodayAwakePage';
import { TodaySleepingPage } from './pages/TodaySleepingPage';
import { fetchScheduleStatus, DayStatusResponse } from './api/sleepApi';
import { useFamilySync } from './hooks/useFamilySync';

export default function App() {
  const [, setActiveTab] = useState<string>('today');
  const [status, setStatus] = useState<DayStatusResponse | null>(null);

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

  if (status?.state === 'SLEEPING') {
    return (
      <TodaySleepingPage
        initialData={status}
        onSelectTab={(tab) => setActiveTab(tab)}
        onWokeUpClick={() => {
          // Will open woke up modal (Task 8)
        }}
        onAddRetroactiveClick={() => {
          // Will open retroactive sleep modal (Task 8)
        }}
      />
    );
  }

  return (
    <TodayAwakePage
      initialData={status || undefined}
      onSelectTab={(tab) => setActiveTab(tab)}
      onFellAsleepClick={() => {
        // Will open fell asleep modal (Task 8)
      }}
    />
  );
}
