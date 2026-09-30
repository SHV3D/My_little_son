import React, { useState, useEffect } from 'react';
import { AwakeBatteryBar } from '../bento/AwakeBatteryBar';
import { calculateBatteryStep } from '@shared/sleepEngine';

export interface AwakeHeroCardProps {
  /**
   * Static or initial duration string, e.g. "2:10"
   */
  awakeDuration?: string;

  /**
   * Last wake time string, e.g. "10:55" or "с 10:55"
   */
  lastWakeTime?: string;

  /**
   * Last wake timestamp (ISO string, Date, or epoch milliseconds) for live counting
   */
  lastWakeTimestamp?: string | number | Date;

  /**
   * Wake interval range string, e.g. "2:30–3:00"
   */
  intervalString?: string;

  /**
   * Active battery level (1 to 7). If omitted, dynamically calculated.
   */
  batteryLevel?: number;

  /**
   * Maximum wake interval in minutes for battery calculation (default 180 min)
   */
  maxWakeIntervalMinutes?: number;

  /**
   * Whether to enable smooth real-time timer ticking (default true)
   */
  liveTick?: boolean;

  className?: string;
  style?: React.CSSProperties;
}

function parseTimeToElapsedSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.replace(/^с\s*/, '').trim();
  const [hStr, mStr] = clean.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return 0;

  const now = new Date();
  const wakeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  let diffSec = Math.floor((now.getTime() - wakeDate.getTime()) / 1000);
  if (diffSec < 0) {
    diffSec += 86400; // Account for day wrap if wake was yesterday
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

export const AwakeHeroCard: React.FC<AwakeHeroCardProps> = ({
  awakeDuration = '2:10',
  lastWakeTime = '10:55',
  lastWakeTimestamp,
  intervalString = '2:30–3:00',
  batteryLevel,
  maxWakeIntervalMinutes = 180,
  liveTick = true,
  className = '',
  style,
}) => {
  // Determine initial elapsed seconds
  const computeInitialSeconds = (): number => {
    if (lastWakeTimestamp) {
      const ms = typeof lastWakeTimestamp === 'string' || typeof lastWakeTimestamp === 'number'
        ? new Date(lastWakeTimestamp).getTime()
        : lastWakeTimestamp.getTime();
      return Math.max(0, Math.floor((Date.now() - ms) / 1000));
    }
    if (lastWakeTime && !awakeDuration) {
      return parseTimeToElapsedSeconds(lastWakeTime);
    }
    if (awakeDuration) {
      return parseDurationStringToSeconds(awakeDuration);
    }
    return 130 * 60; // 2h 10m default
  };

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(computeInitialSeconds);

  // Sync when props change
  useEffect(() => {
    setElapsedSeconds(computeInitialSeconds());
  }, [awakeDuration, lastWakeTime, lastWakeTimestamp]);

  // Live timer tick every second without causing parent re-render
  useEffect(() => {
    if (!liveTick) return;

    const timer = setInterval(() => {
      if (lastWakeTimestamp) {
        const ms = typeof lastWakeTimestamp === 'string' || typeof lastWakeTimestamp === 'number'
          ? new Date(lastWakeTimestamp).getTime()
          : lastWakeTimestamp.getTime();
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - ms) / 1000)));
      } else {
        setElapsedSeconds((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [liveTick, lastWakeTimestamp]);

  // Format timer display
  const displayTimer = awakeDuration && !liveTick
    ? awakeDuration
    : formatSecondsToHoursAndMinutes(elapsedSeconds);

  // Format wake time text
  const cleanWakeTime = lastWakeTime ? lastWakeTime.replace(/^с\s*/, '').trim() : '10:55';
  const displayWakeText = `с ${cleanWakeTime}`;

  // Format interval text
  const cleanInterval = intervalString ? intervalString.replace(/^интервал\s*/, '').trim() : '2:30–3:00';
  const displayIntervalText = `интервал ${cleanInterval}`;

  // Calculate battery level if not explicitly provided
  const computedBatteryLevel = batteryLevel !== undefined
    ? batteryLevel
    : calculateBatteryStep(Math.floor(elapsedSeconds / 60), maxWakeIntervalMinutes);

  return (
    <section
      className={`awake-hero-card ${className}`.trim()}
      data-testid="awake-hero-card"
      style={{
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
          data-testid="awake-status-pill"
          style={{
            padding: '6px 10px',
            borderRadius: '10px',
            backgroundColor: '#D4F27A',
            color: '#1E2A20',
            fontSize: '13px',
            fontWeight: 600,
            lineHeight: 1.2,
          }}
        >
          Бодрствует
        </div>
        <div
          data-testid="last-wake-time"
          style={{
            fontSize: '13px',
            color: '#B7C4B4',
            fontWeight: 400,
          }}
        >
          {displayWakeText}
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
          data-testid="awake-timer"
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

      {/* Bottom row: interval */}
      <div
        data-testid="wake-interval"
        style={{
          fontSize: '14px',
          color: '#B7C4B4',
          fontWeight: 400,
        }}
      >
        {displayIntervalText}
      </div>
    </section>
  );
};

export default AwakeHeroCard;
