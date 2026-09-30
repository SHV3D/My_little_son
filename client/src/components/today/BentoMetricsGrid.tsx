import React from 'react';

export interface BentoMetricsGridProps {
  /**
   * Target time of next recommended nap, e.g. "13:25"
   */
  nextNapTime?: string;

  /**
   * Countdown to next nap, e.g. "через ~20 мин"
   */
  nextNapCountdown?: string;

  /**
   * Planned duration of next nap, e.g. "1 ч 30 мин"
   */
  nextNapDuration?: string;

  /**
   * Full subtext line for Card 1 (defaults to "${nextNapCountdown} · ${nextNapDuration}")
   */
  nextNapSubtext?: string;

  /**
   * Projected bedtime, e.g. "20:30"
   */
  bedtime?: string;

  /**
   * Bedtime status text, e.g. "цель отбоя" or "пересчитано"
   */
  bedtimeStatus?: string;

  /**
   * Daytime sleep completed formatted time, e.g. "1:15"
   */
  daySleepCurrent?: string;

  /**
   * Target daytime sleep formatted time, e.g. "3:20"
   */
  daySleepTarget?: string;

  /**
   * Progress percentage for daytime sleep (0 to 100)
   */
  daySleepPercent?: number;

  /**
   * Number of completed naps today (e.g. 1)
   */
  completedNapsCount?: number;

  /**
   * Target total naps for the day (e.g. 3)
   */
  totalNapsCount?: number;

  /**
   * Remaining naps text, e.g. "ещё 2 из 3"
   */
  remainingNapsText?: string;

  /**
   * Subsequent nap label, e.g. "Потом: сон 3"
   */
  subsequentNapTitle?: string;

  /**
   * Subsequent nap time window & duration, e.g. "17:25 – 18:00 · 35 мин"
   */
  subsequentNapDetails?: string;

  className?: string;
  style?: React.CSSProperties;
}

export const BentoMetricsGrid: React.FC<BentoMetricsGridProps> = ({
  nextNapTime = '13:25',
  nextNapCountdown = 'через ~20 мин',
  nextNapDuration = '1 ч 30 мин',
  nextNapSubtext,
  bedtime = '20:30',
  bedtimeStatus = 'цель отбоя',
  daySleepCurrent = '1:15',
  daySleepTarget = '3:20',
  daySleepPercent = 38,
  completedNapsCount = 1,
  totalNapsCount = 3,
  remainingNapsText = 'ещё 2 из 3',
  subsequentNapTitle = 'Потом: сон 3',
  subsequentNapDetails = '17:25 – 18:00 · 35 мин',
  className = '',
  style,
}) => {
  const displayNextNapSubtext = nextNapSubtext || `${nextNapCountdown} · ${nextNapDuration}`;
  const clampedProgress = Math.max(0, Math.min(100, Math.round(daySleepPercent)));

  return (
    <div
      className={`bento-metrics-grid ${className}`.trim()}
      data-testid="bento-metrics-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '10px',
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Card 1: Следующий сон (Lime) */}
      <section
        data-testid="card-next-nap"
        style={{
          background: '#D4F27A',
          color: '#1E2A20',
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
          Следующий сон
        </div>
        <div
          data-testid="next-nap-time"
          style={{
            fontSize: '30px',
            fontWeight: 700,
            letterSpacing: '-1px',
            lineHeight: 1.1,
          }}
        >
          {nextNapTime}
        </div>
        <div
          data-testid="next-nap-subtext"
          style={{
            fontSize: '13px',
            color: '#3E4E40',
            fontWeight: 400,
            marginTop: 'auto',
          }}
        >
          {displayNextNapSubtext}
        </div>
      </section>

      {/* Card 2: Ночной сон (White) */}
      <section
        data-testid="card-bedtime"
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          minHeight: '120px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#4A5A4C' }}>
          Ночной сон
        </div>
        <div
          data-testid="bedtime-time"
          style={{
            fontSize: '30px',
            fontWeight: 700,
            letterSpacing: '-1px',
            color: '#1E2A20',
            lineHeight: 1.1,
          }}
        >
          {bedtime}
        </div>
        <div
          data-testid="bedtime-status"
          style={{
            fontSize: '13px',
            color: '#4A5A4C',
            fontWeight: 400,
            marginTop: 'auto',
          }}
        >
          {bedtimeStatus}
        </div>
      </section>

      {/* Card 3: Днём (White with Progress Bar) */}
      <section
        data-testid="card-day-sleep"
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#4A5A4C' }}>
          Днём
        </div>
        <div
          data-testid="day-sleep-text"
          style={{
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '-0.5px',
            color: '#1E2A20',
            lineHeight: 1.2,
          }}
        >
          {daySleepCurrent}{' '}
          <span style={{ fontSize: '15px', fontWeight: 500, color: '#4A5A4C' }}>
            / {daySleepTarget}
          </span>
        </div>
        <div
          data-testid="day-sleep-progress-bar"
          style={{
            height: '8px',
            borderRadius: '4px',
            backgroundColor: '#E3E7DA',
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
          }}
        >
          <div
            data-testid="day-sleep-progress-fill"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${clampedProgress}%`,
              backgroundColor: '#23372A',
              borderRadius: '4px',
              transition: 'width 0.3s ease-in-out',
            }}
          />
        </div>
      </section>

      {/* Card 4: Осталось снов (White with status squares) */}
      <section
        data-testid="card-remaining-naps"
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#4A5A4C' }}>
          Осталось снов
        </div>
        <div
          data-testid="naps-status-boxes"
          style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
          }}
        >
          {Array.from({ length: totalNapsCount }).map((_, index) => {
            const isCompleted = index < completedNapsCount;
            return (
              <div
                key={index}
                data-testid="nap-status-box"
                data-index={index}
                data-status={isCompleted ? 'completed' : 'remaining'}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '9px',
                  backgroundColor: isCompleted ? '#23372A' : 'transparent',
                  border: isCompleted ? 'none' : '2px dashed #23372A',
                  boxSizing: 'border-box',
                }}
              />
            );
          })}
        </div>
        <div
          data-testid="remaining-naps-text"
          style={{
            fontSize: '13px',
            color: '#4A5A4C',
            fontWeight: 400,
          }}
        >
          {remainingNapsText}
        </div>
      </section>

      {/* Card 5: Потом: сон 3 (colSpan 2) */}
      <section
        data-testid="card-subsequent-nap"
        style={{
          gridColumn: 'span 2',
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxSizing: 'border-box',
        }}
      >
        <div
          data-testid="subsequent-nap-title"
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#4A5A4C',
            flexGrow: 1,
          }}
        >
          {subsequentNapTitle}
        </div>
        <div
          data-testid="subsequent-nap-details"
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#1E2A20',
          }}
        >
          {subsequentNapDetails}
        </div>
      </section>
    </div>
  );
};

export default BentoMetricsGrid;
