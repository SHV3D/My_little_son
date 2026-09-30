import React, { useEffect } from 'react';

export interface AgePreset {
  id: string;
  ageTitle: string;
  ageSubtitle: string;
  napsPerDay: number;
  wakeIntervalMinMinutes: number;
  wakeIntervalMaxMinutes: number;
  totalDaySleepMinutes: number;
  totalWakeMinutes: number;
  targetBedtime: string;
  typicalWakeupTime: string;
}

export const AGE_PRESETS: AgePreset[] = [
  {
    id: '3-5m',
    ageTitle: '3–5 месяцев',
    ageSubtitle: 'Короткие интервалы, частые сны',
    napsPerDay: 4,
    wakeIntervalMinMinutes: 90,
    wakeIntervalMaxMinutes: 120,
    totalDaySleepMinutes: 240, // 4:00
    totalWakeMinutes: 480, // 8:00
    targetBedtime: '20:00',
    typicalWakeupTime: '07:00',
  },
  {
    id: '6-8m',
    ageTitle: '6–8 месяцев',
    ageSubtitle: 'Классический режим на 3 сна',
    napsPerDay: 3,
    wakeIntervalMinMinutes: 150,
    wakeIntervalMaxMinutes: 180,
    totalDaySleepMinutes: 200, // 3:20
    totalWakeMinutes: 600, // 10:00
    targetBedtime: '20:30',
    typicalWakeupTime: '07:00',
  },
  {
    id: '9-11m',
    ageTitle: '9–11 месяцев',
    ageSubtitle: 'Переход на 2 сна',
    napsPerDay: 2,
    wakeIntervalMinMinutes: 180,
    wakeIntervalMaxMinutes: 225,
    totalDaySleepMinutes: 165, // 2:45
    totalWakeMinutes: 645, // 10:45
    targetBedtime: '20:30',
    typicalWakeupTime: '07:00',
  },
  {
    id: '12-18m',
    ageTitle: '12–18 месяцев',
    ageSubtitle: 'Один длинный обеденный сон',
    napsPerDay: 1,
    wakeIntervalMinMinutes: 270,
    wakeIntervalMaxMinutes: 330,
    totalDaySleepMinutes: 135, // 2:15
    totalWakeMinutes: 690, // 11:30
    targetBedtime: '21:00',
    typicalWakeupTime: '07:30',
  },
];

export interface AgePresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (preset: AgePreset) => void;
  currentNaps?: number;
}

export const AgePresetsModal: React.FC<AgePresetsModalProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
  currentNaps,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="age-presets-modal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        backgroundColor: 'rgba(18, 28, 21, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          boxSizing: 'border-box',
          backgroundColor: '#ECEEE6',
          borderRadius: '32px 32px 0 0',
          padding: '12px 16px max(32px, env(safe-area-inset-bottom, 32px))',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.15)',
          maxHeight: '85vh',
          overflowY: 'auto',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: '40px',
            height: '4px',
            borderRadius: '2px',
            backgroundColor: '#C5CCBC',
            alignSelf: 'center',
            marginBottom: '4px',
          }}
        />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 700,
                color: '#1E2A20',
                letterSpacing: '-0.5px',
              }}
            >
              Возрастные нормы
            </h2>
            <div style={{ fontSize: '13px', color: '#4A5A4C', marginTop: '2px' }}>
              Выберите возраст сына для быстрой настройки
            </div>
          </div>
          <button
            type="button"
            data-testid="close-presets-modal"
            aria-label="Закрыть"
            onClick={onClose}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              border: 0,
              backgroundColor: '#FFFFFF',
              color: '#1E2A20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Presets List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {AGE_PRESETS.map((preset) => {
            const isCurrent = currentNaps === preset.napsPerDay;
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`preset-card-${preset.id}`}
                onClick={() => {
                  onSelectPreset(preset);
                  onClose();
                }}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '20px',
                  border: isCurrent ? '2px solid #23372A' : '1px solid #E3E7DA',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: '#1E2A20' }}>
                    {preset.ageTitle}
                  </span>
                  <span
                    style={{
                      backgroundColor: isCurrent ? '#23372A' : '#D4F27A',
                      color: isCurrent ? '#F1F4EA' : '#1E2A20',
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: '10px',
                    }}
                  >
                    {preset.napsPerDay} {preset.napsPerDay === 1 ? 'сон' : preset.napsPerDay < 5 ? 'сна' : 'снов'}
                  </span>
                </div>

                <div style={{ fontSize: '13px', color: '#4A5A4C' }}>
                  {preset.ageSubtitle}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    marginTop: '2px',
                    fontSize: '12px',
                    color: '#4A5A4C',
                  }}
                >
                  <span style={{ backgroundColor: '#F4F5EF', padding: '3px 8px', borderRadius: '8px' }}>
                    Интервал {Math.floor(preset.wakeIntervalMinMinutes / 60)}:
                    {String(preset.wakeIntervalMinMinutes % 60).padStart(2, '0')}–
                    {Math.floor(preset.wakeIntervalMaxMinutes / 60)}:
                    {String(preset.wakeIntervalMaxMinutes % 60).padStart(2, '0')}
                  </span>
                  <span style={{ backgroundColor: '#F4F5EF', padding: '3px 8px', borderRadius: '8px' }}>
                    Сон {Math.floor(preset.totalDaySleepMinutes / 60)} ч{' '}
                    {preset.totalDaySleepMinutes % 60 > 0 ? `${preset.totalDaySleepMinutes % 60} м` : ''}
                  </span>
                  <span style={{ backgroundColor: '#F4F5EF', padding: '3px 8px', borderRadius: '8px' }}>
                    Отбой {preset.targetBedtime}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
