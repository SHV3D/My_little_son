import React from 'react';

export type SleepBlockType = 'sleep' | 'planned' | 'night' | 'inProgress';

export interface SleepInterval {
  id?: string | number;
  start: string | number; // "09:35" or minutes (575)
  end: string | number;   // "10:50" or minutes (650)
  type?: SleepBlockType;
  label?: string;
  color?: string;
}

export interface DayTimelineBarProps {
  intervals?: SleepInterval[];
  dayStart?: string | number; // default "07:00" (420 min)
  dayEnd?: string | number;   // default "21:00" (1260 min)
  barHeight?: number | string; // default 24px
  showTicks?: boolean;
  ticks?: string[];
  className?: string;
  style?: React.CSSProperties;
}

export function parseTimeToMinutes(time: string | number): number {
  if (typeof time === 'number') {
    return time;
  }
  // Check for ISO string
  if (time.includes('T')) {
    const d = new Date(time);
    return d.getHours() * 60 + d.getMinutes();
  }
  const parts = time.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export const DayTimelineBar: React.FC<DayTimelineBarProps> = ({
  intervals = [],
  dayStart = '07:00',
  dayEnd = '21:00',
  barHeight = 24,
  showTicks = true,
  ticks = ['07:00', '10:30', '14:00', '17:30', '21:00'],
  className = '',
  style,
}) => {
  const startMin = parseTimeToMinutes(dayStart);
  const endMin = parseTimeToMinutes(dayEnd);
  const totalMin = Math.max(1, endMin - startMin);

  return (
    <div
      className={`day-timeline-wrapper ${className}`.trim()}
      data-testid="day-timeline-bar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        width: '100%',
        ...style,
      }}
    >
      {/* Timeline track */}
      <div
        className="day-timeline-track"
        data-testid="timeline-track"
        style={{
          position: 'relative',
          height: typeof barHeight === 'number' ? `${barHeight}px` : barHeight,
          borderRadius: '8px',
          backgroundColor: 'var(--color-dark-secondary, #34493B)',
          overflow: 'hidden',
        }}
      >
        {intervals.map((interval, index) => {
          const iStart = parseTimeToMinutes(interval.start);
          const iEnd = parseTimeToMinutes(interval.end);

          // Clamped calculation
          const clampedStart = Math.max(startMin, Math.min(endMin, iStart));
          const clampedEnd = Math.max(startMin, Math.min(endMin, iEnd));
          const offsetMin = clampedStart - startMin;
          const durationMin = Math.max(0, clampedEnd - clampedStart);

          const leftPercent = Math.max(0, Math.min(100, (offsetMin / totalMin) * 100));
          const widthPercent = Math.max(0, Math.min(100 - leftPercent, (durationMin / totalMin) * 100));

          const type = interval.type || 'sleep';

          let blockBg = interval.color || 'var(--color-lime, #D4F27A)';
          let blockBorder = 'none';
          let borderRadius = '6px';

          if (type === 'planned') {
            blockBg = interval.color || 'rgba(212, 242, 122, 0.28)';
            blockBorder = '1.5px dashed var(--color-lime, #D4F27A)';
          } else if (type === 'night') {
            blockBg = interval.color || '#F1F4EA';
            // If night sleep reaches the right edge, make rounded edge flush
            if (leftPercent + widthPercent >= 99) {
              borderRadius = '0 8px 8px 0';
            }
          }

          return (
            <div
              key={interval.id ?? index}
              data-testid="sleep-interval-block"
              data-type={type}
              data-left={`${leftPercent.toFixed(2)}%`}
              data-width={`${widthPercent.toFixed(2)}%`}
              className={`timeline-interval-block timeline-interval--${type}`}
              style={{
                position: 'absolute',
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                top: 0,
                bottom: 0,
                backgroundColor: blockBg,
                border: blockBorder,
                borderRadius,
                boxSizing: 'border-box',
                transition: 'left var(--transition-normal, 0.25s), width var(--transition-normal, 0.25s)',
              }}
              title={interval.label || `${interval.start} - ${interval.end}`}
            />
          );
        })}
      </div>

      {/* Time ticks */}
      {showTicks && (
        <div
          className="day-timeline-ticks"
          data-testid="timeline-ticks"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--text-subtle, #B7C4B4)',
          }}
        >
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      )}
    </div>
  );
};

export default DayTimelineBar;
