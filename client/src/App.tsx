import { useState } from 'react';
import { TodayAwakePage } from './pages/TodayAwakePage';

export default function App() {
  const [, setActiveTab] = useState<string>('today');

  return (
    <TodayAwakePage
      onSelectTab={(tab) => setActiveTab(tab)}
      onFellAsleepClick={() => {
        // Will open fell asleep modal (Task 8)
      }}
    />
  );
}
