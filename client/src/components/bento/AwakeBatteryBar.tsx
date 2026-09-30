import React from 'react';

export interface AwakeBatteryBarProps {
  level: number;
  maxLevel?: number;
  activeColor?: string;
  inactiveColor?: string;
  height?: number | string;
  barWidth?: number | string;
  gap?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

// 7 vertical bar heights stepping from 20% to 100% matching the Bento design specification
const DEFAULT_HEIGHTS = ['20%', '35%', '50%', '65%', '72%', '85%', '100%'];

export const AwakeBatteryBar: React.FC<AwakeBatteryBarProps> = ({
  level,
  maxLevel = 7,
  activeColor = 'var(--color-lime, #D4F27A)',
  inactiveColor = 'var(--color-bar-inactive, #4E6552)',
  height = '56px',
  barWidth = '8px',
  gap = '4px',
  className = '',
  style,
}) => {
  // Clamp level between 0 and maxLevel
  const safeLevel = Math.max(0, Math.min(maxLevel, Math.round(level)));

  return (
    <div
      className={`awake-battery-bar ${className}`.trim()}
      data-testid="awake-battery-bar"
      data-level={safeLevel}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: typeof gap === 'number' ? `${gap}px` : gap,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
    >
      {Array.from({ length: maxLevel }).map((_, index) => {
        const isActive = index < safeLevel;
        const barHeight = DEFAULT_HEIGHTS[index] || `${Math.round(((index + 1) / maxLevel) * 100)}%`;
        const barColor = isActive ? activeColor : inactiveColor;

        return (
          <div
            key={index}
            data-testid="battery-bar"
            data-index={index}
            data-active={isActive ? 'true' : 'false'}
            className={`battery-bar ${isActive ? 'active battery-bar-active' : 'inactive battery-bar-inactive'}`}
            style={{
              width: typeof barWidth === 'number' ? `${barWidth}px` : barWidth,
              height: barHeight,
              borderRadius: '4px',
              backgroundColor: barColor,
              transition: 'background-color var(--transition-fast, 0.2s ease), height var(--transition-fast, 0.2s ease)',
            }}
          />
        );
      })}
    </div>
  );
};

export default AwakeBatteryBar;
