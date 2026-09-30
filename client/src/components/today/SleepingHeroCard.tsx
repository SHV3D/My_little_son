import React, { useState, useEffect } from 'react';
import { AwakeBatteryBar } from '../bento/AwakeBatteryBar';
import { formatDurationRussian } from '@shared/sleepEngine';

export interface SleepingHeroCardProps {
  /**
   * Nap number (e.g. 2) or custom title (e.g. "сон 2")
   */
  napNumber?: number | string;

  /**
   * Static or initial sleep duration string, e.g. "0:25"
   */
  sleepDuration?: string;

  /**
   * Time when child fell asleep, e.g. "13:22" or "уснул в 13:22"
   */
  sleepStartTime?: string;

  /**
   * Timestamp when sleep started for live ticking
   */
  sleepTimestamp?: string | number | Date;

  /**
   * Planned duration of this nap in minutes (e.g. 90)
   */
  plannedDurationMinutes?: number;

  /**
   * Pre-formatted planned nap duration string, e.g. "1 ч 30 мин" or "план сна 1 ч 30 мин"
   */
  plannedDurationText?: string;

  /**
   * Active segments count on battery bar (0 to 7). If omitted, dynamically calculated.
   */
  batteryLevel?: number;

  /**
   * Whether to enable smooth real-time timer ticking (default true)
   */
  liveTick?: boolean;

  className?: string;
  style?: React.CSSProperties;
}

function parseTimeToElapsedSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.replace(/^уснул\s+в\s*/i, '').trim();
  const [hStr, mStr] = clean.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return 0;

  const now = new Date();
  const sleepDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  let diffSec = Math.floor((now.getTime() - sleepDate.getTime()) / 1000);
  if (diffSec < 0) {
    diffSec += 86400; // Account for day wrap if fell asleep yesterday
  }
  return Math.max(0, diffSec);
}

function parseDurationStringToSeconds(durationStr: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(':');
  if (parts.length === 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return ((isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m)) * 60;
  }
  return 0;
}

function formatSecondsToHoursAndMinutes(totalSeconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

export const SleepingHeroCard: React.FC<SleepingHeroCardProps> = ({
  napNumber = 2,
  sleepDuration = '0:25',
  sleepStartTime = '13:22',
  sleepTimestamp,
  plannedDurationMinutes = 90,
  plannedDurationText,
  batteryLevel,
  liveTick = true,
  className = '',
  style,
}) => {
  // Determine initial elapsed seconds
  const computeInitialSeconds = (): number => {
    if (sleepTimestamp) {
      const ms =
        typeof sleepTimestamp === 'string' || typeof sleepTimestamp === 'number'
          ? new Date(sleepTimestamp).getTime()
          : sleepTimestamp.getTime();
      return Math.max(0, Math.floor((Date.now() - ms) / 1000));
    }
    if (sleepStartTime && !sleepDuration) {
      return parseTimeToElapsedSeconds(sleepStartTime);
    }
    if (sleepDuration) {
      return parseDurationStringToSeconds(sleepDuration);
    }
    return 25 * 60; // 0:25 default matching mockup
  };

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(computeInitialSeconds);

  // Sync when inputs change
  useEffect(() => {
    setElapsedSeconds(computeInitialSeconds());
  }, [sleepDuration, sleepStartTime, sleepTimestamp]);

  // Live timer tick every second without causing parent re-render
  useEffect(() => {
    if (!liveTick) return;

    const timer = setInterval(() => {
      if (sleepTimestamp) {
        const ms =
          typeof sleepTimestamp === 'string' || typeof sleepTimestamp === 'number'
            ? new Date(sleepTimestamp).getTime()
            : sleepTimestamp.getTime();
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - ms) / 1000)));
      } else {
        setElapsedSeconds((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [liveTick, sleepTimestamp]);

  // Format timer display
  const displayTimer =
    sleepDuration && !liveTick
      ? sleepDuration
      : formatSecondsToHoursAndMinutes(elapsedSeconds);

  // Format start time text
  const cleanStartTime = sleepStartTime
    ? sleepStartTime.replace(/^уснул\s+в\s*/i, '').trim()
    : '13:22';
  const displayStartTime = `уснул в ${cleanStartTime}`;

  // Format planned duration text
  let displayPlannedText = 'план сна 1 ч 30 мин';
  if (plannedDurationText) {
    displayPlannedText = plannedDurationText.startsWith('план сна')
      ? plannedDurationText
      : `план сна ${plannedDurationText}`;
  } else if (plannedDurationMinutes) {
    displayPlannedText = `план сна ${formatDurationRussian(plannedDurationMinutes)}`;
  }

  // Format status pill text: "Спит · сон N"
  let statusText = 'Спит · сон 2';
  if (napNumber !== undefined && napNumber !== null) {
    const napStr = String(napNumber).trim();
    if (napStr.toLowerCase().startsWith('спит')) {
      statusText = napStr;
    } else if (napStr.toLowerCase().startsWith('сон')) {
      statusText = `Спит · ${napStr}`;
    } else {
      statusText = `Спит · сон ${napStr}`;
    }
  }

  // Progress towards planned nap duration (battery calculation)
  const plannedMins = plannedDurationMinutes ?? 90;
  const elapsedMins = elapsedSeconds / 60;
  const progressRatio = plannedMins > 0 ? elapsedMins / plannedMins : 0;
  const calculatedBatteryLevel = Math.max(0, Math.min(7, Math.round(progressRatio * 7)));

  const computedBatteryLevel =
    batteryLevel !== undefined ? batteryLevel : calculatedBatteryLevel;

  return (
    <section
      className={`sleeping-hero-card ${className}`.trim()}
      data-testid="sleeping-hero-card"
      style={{
        gridColumn: 'span 2',
        background: '#23372A',
        color: '#F1F4EA',
        borderRadius: '28px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxSizing: 'border-box',
        width: '100%',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Top row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          data-testid="sleeping-status-pill"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: '10px',
            backgroundColor: '#F1F4EA',
            color: '#1E2A20',
            fontSize: '13px',
            fontWeight: 600,
            lineHeight: 1.2,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="#23372A"
            aria-hidden="true"
          >
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
          </svg>
          <span>{statusText}</span>
        </div>
        <div
          data-testid="sleep-start-time"
          style={{
            fontSize: '13px',
            color: '#B7C4B4',
            fontWeight: 400,
          }}
        >
          {displayStartTime}
        </div>
      </div>

      {/* Middle row: Big timer + 7-segment battery */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <div
          data-testid="sleep-timer"
          style={{
            fontSize: '64px',
            fontWeight: 600,
            letterSpacing: '-3px',
            lineHeight: 0.9,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {displayTimer}
        </div>
        <AwakeBatteryBar level={computedBatteryLevel} />
      </div>

      {/* Bottom row: Planned sleep duration */}
      <div
        data-testid="sleep-planned-duration"
        style={{
          fontSize: '14px',
          color: '#B7C4B4',
          fontWeight: 400,
        }}
      >
        {displayPlannedText}
      </div>
    </section>
  );
};

export default SleepingHeroCard;
