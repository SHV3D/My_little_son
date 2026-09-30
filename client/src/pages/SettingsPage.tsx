import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BottomNav } from '../components/common/BottomNav';
import { SanityBanner } from '../components/settings/SanityBanner';
import { AgePresetsModal, AgePreset } from '../components/settings/AgePresetsModal';
import {
  fetchSettings,
  updateSettingsApi,
  SettingsResponse,
  ChildSettingsDto,
} from '../api/settingsApi';
import {
  validateSettings,
  ValidationResult,
} from '@shared/sleepEngine';
import { ThemeMode } from '../hooks/useTheme';

export interface SettingsPageProps {
  childId?: string;
  theme?: ThemeMode;
  onThemeChange?: (theme: ThemeMode) => void;
  onSelectTab?: (tab: string) => void;
  onLogout?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_SETTINGS: ChildSettingsDto = {
  id: 'demo-settings-1',
  childId: 'demo-child-1',
  napsPerDay: 3,
  wakeIntervalMinMinutes: 150,
  wakeIntervalMaxMinutes: 180,
  totalWakeMinutes: 600,
  totalDaySleepMinutes: 200,
  targetBedtime: '20:30',
  typicalWakeupTime: '07:00',
};

export const SettingsPage: React.FC<SettingsPageProps> = ({
  childId = 'demo-child-1',
  theme,
  onThemeChange,
  onSelectTab,
  onLogout,
  className = '',
  style,
}) => {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [childName, setChildName] = useState<string>('Сын');
  const [settings, setSettings] = useState<ChildSettingsDto>(DEFAULT_SETTINGS);
  const [internalTheme, setInternalTheme] = useState<ThemeMode>(theme || 'system');

  useEffect(() => {
    if (theme !== undefined) {
      setInternalTheme(theme);
    }
  }, [theme]);

  const currentTheme = theme !== undefined ? theme : internalTheme;

  const handleThemeSelect = (selected: ThemeMode) => {
    setInternalTheme(selected);
    onThemeChange?.(selected);
  };

  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [editingBedtime, setEditingBedtime] = useState(false);
  const [editingMinInterval, setEditingMinInterval] = useState(false);
  const [editingMaxInterval, setEditingMaxInterval] = useState(false);
  const [editingDaySleep, setEditingDaySleep] = useState(false);
  const [editingWakeTime, setEditingWakeTime] = useState(false);

  // Load initial settings from server
  const loadData = useCallback(async () => {
    try {
      const resp = await fetchSettings(childId);
      setData(resp);
      setChildName(resp.child.name);
      setSettings(resp.settings);
    } catch {
      // Fallback to defaults
    }
  }, [childId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save changes to API
  const saveChanges = useCallback(
    async (updatedPartial: Partial<ChildSettingsDto>, newChildName?: string) => {
      const merged = { ...settings, ...updatedPartial };
      setSettings(merged);
      const name = newChildName !== undefined ? newChildName : childName;

      try {
        const resp = await updateSettingsApi(
          {
            childName: name,
            napsPerDay: merged.napsPerDay,
            wakeIntervalMinMinutes: merged.wakeIntervalMinMinutes,
            wakeIntervalMaxMinutes: merged.wakeIntervalMaxMinutes,
            totalDaySleepMinutes: merged.totalDaySleepMinutes,
            totalWakeMinutes: merged.totalWakeMinutes,
            targetBedtime: merged.targetBedtime,
            typicalWakeupTime: merged.typicalWakeupTime,
          },
          childId
        );
        setData(resp);
      } catch {
        // Silently keep local state
      }
    },
    [settings, childName, childId]
  );

  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // Live local validation (validates wakeIntervalMinMinutes and wakeIntervalMaxMinutes accurately against day structure)
  const validation: ValidationResult = useMemo(() => {
    return validateSettings({
      napsPerDay: settings.napsPerDay,
      wakeIntervalMinMinutes: settings.wakeIntervalMinMinutes,
      wakeIntervalMaxMinutes: settings.wakeIntervalMaxMinutes,
      totalDaySleepMinutes: settings.totalDaySleepMinutes,
      typicalWakeupTime: settings.typicalWakeupTime,
      targetBedtime: settings.targetBedtime,
    });
  }, [settings]);

  // Steppers for naps count
  const handleNapsDecrement = () => {
    if (settings.napsPerDay > 1) {
      saveChanges({ napsPerDay: settings.napsPerDay - 1 });
    }
  };

  const handleNapsIncrement = () => {
    if (settings.napsPerDay < 6) {
      saveChanges({ napsPerDay: settings.napsPerDay + 1 });
    }
  };

  // Preset selection
  const handleSelectPreset = (preset: AgePreset) => {
    saveChanges({
      napsPerDay: preset.napsPerDay,
      wakeIntervalMinMinutes: preset.wakeIntervalMinMinutes,
      wakeIntervalMaxMinutes: preset.wakeIntervalMaxMinutes,
      totalDaySleepMinutes: preset.totalDaySleepMinutes,
      totalWakeMinutes: preset.totalWakeMinutes,
      targetBedtime: preset.targetBedtime,
      typicalWakeupTime: preset.typicalWakeupTime,
    });
  };

  // Copy invite link / code
  const handleCopyInvite = async () => {
    const inviteCode = data?.family?.inviteCode || '7K4-Q9M';
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopyFeedback(`Код ${inviteCode} скопирован!`);
    } catch {
      setCopyFeedback(`Код: ${inviteCode}`);
    }
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      setCopyFeedback(null);
    }, 3000);
  };

  const formatDurationDisplay = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h} ч ${String(m).padStart(2, '0')} м`;
  };

  // Helper formatting for interval pills
  const formatIntervalMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  const familyMembers = data?.family?.members && data.family.members.length > 0
    ? data.family.members
    : [
        { id: 'user-mom-1', name: 'Мама', role: 'Мама', email: 'mama@mail.ru' },
        { id: 'user-dad-1', name: 'Папа', role: 'Папа', email: 'papa@mail.ru' },
      ];

  return (
    <div
      data-testid="settings-page"
      className={`mobile-viewport-wrapper settings-screen ${className}`.trim()}
      style={{
        maxWidth: '430px',
        minHeight: '100vh',
        margin: '0 auto',
        boxSizing: 'border-box',
        backgroundColor: '#ECEEE6',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Geologica', system-ui, sans-serif",
        color: '#1E2A20',
        ...style,
      }}
    >
      <div
        className="screen-content"
        style={{
          flexGrow: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '56px 16px 24px',
        }}
      >
        <h1
          style={{
            margin: '0 0 4px 4px',
            fontSize: '26px',
            fontWeight: 700,
            letterSpacing: '-0.8px',
          }}
        >
          Настройки
        </h1>

        {/* Section 1: Child */}
        <section
          data-testid="section-child"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '6px 16px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              minHeight: '56px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              borderBottom: '1px solid #E3E7DA',
            }}
          >
            <label
              htmlFor="child-name"
              style={{ flexGrow: 1, fontSize: '16px', fontWeight: 500 }}
            >
              Имя ребёнка
            </label>
            <input
              id="child-name"
              data-testid="child-name-input"
              type="text"
              placeholder="Как зовут сына"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              onBlur={() => saveChanges({}, childName)}
              style={{
                width: '160px',
                height: '44px',
                border: 0,
                backgroundColor: 'transparent',
                textAlign: 'right',
                fontFamily: 'inherit',
                fontSize: '16px',
                fontWeight: 500,
                color: '#1E2A20',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="button"
            data-testid="btn-age-presets"
            onClick={() => setIsPresetsOpen(true)}
            style={{
              minHeight: '60px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: 0,
              backgroundColor: 'transparent',
              border: 0,
              fontFamily: 'inherit',
              color: '#1E2A20',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <span style={{ fontSize: '16px', fontWeight: 500 }}>
                Подставить значения по возрасту
              </span>
              <span style={{ fontSize: '13px', color: '#4A5A4C' }}>
                типичный режим, потом можно поправить
              </span>
            </span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: '#4A5A4C' }}
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </section>

        {/* Section 2: Day Routine */}
        <h2
          style={{
            margin: '10px 0 0 4px',
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '-0.4px',
          }}
        >
          Режим дня
        </h2>

        <div
          data-testid="section-routine"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '10px',
          }}
        >
          {/* Card 1: Naps count (Dark Bento) */}
          <section
            data-testid="naps-count-card"
            style={{
              backgroundColor: '#23372A',
              color: '#F1F4EA',
              borderRadius: '24px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '13px', color: '#B7C4B4' }}>Дневных снов</div>
            <div
              data-testid="naps-count-value"
              style={{
                fontSize: '40px',
                fontWeight: 600,
                letterSpacing: '-1.5px',
                lineHeight: 1,
              }}
            >
              {settings.napsPerDay}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                data-testid="naps-decrement"
                aria-label="Меньше"
                onClick={handleNapsDecrement}
                style={{
                  flexGrow: 1,
                  height: '44px',
                  borderRadius: '14px',
                  border: 0,
                  backgroundColor: '#34493B',
                  color: '#F1F4EA',
                  fontSize: '22px',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                −
              </button>
              <button
                type="button"
                data-testid="naps-increment"
                aria-label="Больше"
                onClick={handleNapsIncrement}
                style={{
                  flexGrow: 1,
                  height: '44px',
                  borderRadius: '14px',
                  border: 0,
                  backgroundColor: '#D4F27A',
                  color: '#1E2A20',
                  fontSize: '22px',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                }}
              >
                +
              </button>
            </div>
          </section>

          {/* Card 2: Bedtime */}
          <div
            data-testid="bedtime-card"
            onClick={() => setEditingBedtime(true)}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              color: '#1E2A20',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '13px', color: '#4A5A4C' }}>Отход к ночному сну</span>
            {editingBedtime ? (
              <input
                data-testid="bedtime-input"
                type="time"
                autoFocus
                value={settings.targetBedtime}
                onChange={(e) => {
                  if (e.target.value) {
                    saveChanges({ targetBedtime: e.target.value });
                  }
                }}
                onBlur={() => setEditingBedtime(false)}
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  letterSpacing: '-1px',
                  border: '1px solid #23372A',
                  borderRadius: '8px',
                  padding: '2px 4px',
                  width: '100%',
                  fontFamily: 'inherit',
                }}
              />
            ) : (
              <span
                data-testid="bedtime-value"
                style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-1px' }}
              >
                {settings.targetBedtime}
              </span>
            )}
            <span style={{ fontSize: '13px', color: '#4A5A4C' }}>
              план подстраивается под это время
            </span>
          </div>

          {/* Card 3: Wake interval (colSpan 2) */}
          <section
            data-testid="wake-interval-card"
            style={{
              gridColumn: 'span 2',
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontSize: '16px', fontWeight: 500 }}>Интервал между снами</div>
              <div style={{ fontSize: '13px', color: '#4A5A4C' }}>
                от пробуждения до отхода к следующему сну
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button
                  type="button"
                  data-testid="min-interval-btn"
                  onClick={() => setEditingMinInterval(!editingMinInterval)}
                  style={{
                    width: '100%',
                    height: '52px',
                    borderRadius: '16px',
                    border: 0,
                    backgroundColor: '#ECEEE6',
                    fontFamily: 'inherit',
                    fontSize: '17px',
                    fontWeight: 600,
                    color: '#1E2A20',
                    cursor: 'pointer',
                  }}
                >
                  от {formatIntervalMinutes(settings.wakeIntervalMinMinutes)}
                </button>
                {editingMinInterval && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      data-testid="min-interval-minus"
                      onClick={() =>
                        saveChanges({
                          wakeIntervalMinMinutes: Math.max(30, settings.wakeIntervalMinMinutes - 15),
                        })
                      }
                      style={{
                        flex: 1,
                        height: '32px',
                        borderRadius: '8px',
                        border: 0,
                        backgroundColor: '#E3E7DA',
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                    >
                      −15м
                    </button>
                    <button
                      type="button"
                      data-testid="min-interval-plus"
                      onClick={() =>
                        saveChanges({
                          wakeIntervalMinMinutes: Math.min(
                            settings.wakeIntervalMaxMinutes,
                            settings.wakeIntervalMinMinutes + 15
                          ),
                        })
                      }
                      style={{
                        flex: 1,
                        height: '32px',
                        borderRadius: '8px',
                        border: 0,
                        backgroundColor: '#E3E7DA',
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                    >
                      +15м
                    </button>
                  </div>
                )}
              </div>

              <div
                style={{
                  width: '12px',
                  height: '2px',
                  backgroundColor: '#9AA793',
                  alignSelf: editingMinInterval || editingMaxInterval ? 'flex-start' : 'center',
                  marginTop: editingMinInterval || editingMaxInterval ? '26px' : '0',
                }}
              />

              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button
                  type="button"
                  data-testid="max-interval-btn"
                  onClick={() => setEditingMaxInterval(!editingMaxInterval)}
                  style={{
                    width: '100%',
                    height: '52px',
                    borderRadius: '16px',
                    border: 0,
                    backgroundColor: '#ECEEE6',
                    fontFamily: 'inherit',
                    fontSize: '17px',
                    fontWeight: 600,
                    color: '#1E2A20',
                    cursor: 'pointer',
                  }}
                >
                  до {formatIntervalMinutes(settings.wakeIntervalMaxMinutes)}
                </button>
                {editingMaxInterval && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      data-testid="max-interval-minus"
                      onClick={() =>
                        saveChanges({
                          wakeIntervalMaxMinutes: Math.max(
                            settings.wakeIntervalMinMinutes,
                            settings.wakeIntervalMaxMinutes - 15
                          ),
                        })
                      }
                      style={{
                        flex: 1,
                        height: '32px',
                        borderRadius: '8px',
                        border: 0,
                        backgroundColor: '#E3E7DA',
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                    >
                      −15м
                    </button>
                    <button
                      type="button"
                      data-testid="max-interval-plus"
                      onClick={() =>
                        saveChanges({
                          wakeIntervalMaxMinutes: settings.wakeIntervalMaxMinutes + 15,
                        })
                      }
                      style={{
                        flex: 1,
                        height: '32px',
                        borderRadius: '8px',
                        border: 0,
                        backgroundColor: '#E3E7DA',
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                    >
                      +15м
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Card 4: Total day sleep */}
          <div
            data-testid="total-day-sleep-card"
            onClick={() => setEditingDaySleep(!editingDaySleep)}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              color: '#1E2A20',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '13px', color: '#4A5A4C' }}>Дневной сон всего</span>
            <span
              data-testid="total-day-sleep-value"
              style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.8px' }}
            >
              {formatDurationDisplay(settings.totalDaySleepMinutes)}
            </span>
            <span style={{ fontSize: '13px', color: '#4A5A4C' }}>сумма всех снов</span>

            {editingDaySleep && (
              <div
                style={{ display: 'flex', gap: '4px', marginTop: '6px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  data-testid="day-sleep-minus"
                  onClick={() =>
                    saveChanges({
                      totalDaySleepMinutes: Math.max(30, settings.totalDaySleepMinutes - 15),
                    })
                  }
                  style={{
                    flex: 1,
                    height: '32px',
                    borderRadius: '8px',
                    border: 0,
                    backgroundColor: '#ECEEE6',
                    cursor: 'pointer',
                  }}
                >
                  −15м
                </button>
                <button
                  type="button"
                  data-testid="day-sleep-plus"
                  onClick={() =>
                    saveChanges({
                      totalDaySleepMinutes: settings.totalDaySleepMinutes + 15,
                    })
                  }
                  style={{
                    flex: 1,
                    height: '32px',
                    borderRadius: '8px',
                    border: 0,
                    backgroundColor: '#ECEEE6',
                    cursor: 'pointer',
                  }}
                >
                  +15м
                </button>
              </div>
            )}
          </div>

          {/* Card 5: Total awake time */}
          <div
            data-testid="total-wake-card"
            onClick={() => setEditingWakeTime(!editingWakeTime)}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              color: '#1E2A20',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '13px', color: '#4A5A4C' }}>Бодрствование за день</span>
            <span
              data-testid="total-wake-value"
              style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.8px' }}
            >
              {formatDurationDisplay(settings.totalWakeMinutes)}
            </span>
            <span style={{ fontSize: '13px', color: '#4A5A4C' }}>от подъёма до отбоя</span>

            {editingWakeTime && (
              <div
                style={{ display: 'flex', gap: '4px', marginTop: '6px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  data-testid="wake-time-minus"
                  onClick={() =>
                    saveChanges({
                      totalWakeMinutes: Math.max(120, settings.totalWakeMinutes - 15),
                    })
                  }
                  style={{
                    flex: 1,
                    height: '32px',
                    borderRadius: '8px',
                    border: 0,
                    backgroundColor: '#ECEEE6',
                    cursor: 'pointer',
                  }}
                >
                  −15м
                </button>
                <button
                  type="button"
                  data-testid="wake-time-plus"
                  onClick={() =>
                    saveChanges({
                      totalWakeMinutes: settings.totalWakeMinutes + 15,
                    })
                  }
                  style={{
                    flex: 1,
                    height: '32px',
                    borderRadius: '8px',
                    border: 0,
                    backgroundColor: '#ECEEE6',
                    cursor: 'pointer',
                  }}
                >
                  +15м
                </button>
              </div>
            )}
          </div>

          {/* Card 6: SanityBanner */}
          <SanityBanner validation={validation} />
        </div>

        {/* Section: Appearance */}
        <h2
          style={{
            margin: '10px 0 0 4px',
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '-0.4px',
          }}
        >
          Оформление
        </h2>

        <section
          data-testid="theme-settings-card"
          style={{
            backgroundColor: 'var(--color-white, #FFFFFF)',
            borderRadius: '24px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-muted, #4A5A4C)',
            }}
          >
            Оформление
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '8px',
              backgroundColor: 'var(--color-neutral-bg, #F4F5EF)',
              padding: '4px',
              borderRadius: '16px',
            }}
          >
            <button
              type="button"
              data-testid="theme-option-light"
              onClick={() => handleThemeSelect('light')}
              style={{
                height: '40px',
                borderRadius: '12px',
                border: 0,
                backgroundColor: currentTheme === 'light' ? 'var(--color-lime, #D4F27A)' : 'transparent',
                color: currentTheme === 'light' ? '#1E2A20' : 'var(--text-muted, #4A5A4C)',
                fontWeight: currentTheme === 'light' ? 600 : 500,
                fontSize: '14px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Светлая
            </button>
            <button
              type="button"
              data-testid="theme-option-dark"
              onClick={() => handleThemeSelect('dark')}
              style={{
                height: '40px',
                borderRadius: '12px',
                border: 0,
                backgroundColor: currentTheme === 'dark' ? 'var(--color-lime, #D4F27A)' : 'transparent',
                color: currentTheme === 'dark' ? '#1E2A20' : 'var(--text-muted, #4A5A4C)',
                fontWeight: currentTheme === 'dark' ? 600 : 500,
                fontSize: '14px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Тёмная
            </button>
            <button
              type="button"
              data-testid="theme-option-system"
              onClick={() => handleThemeSelect('system')}
              style={{
                height: '40px',
                borderRadius: '12px',
                border: 0,
                backgroundColor: currentTheme === 'system' ? 'var(--color-lime, #D4F27A)' : 'transparent',
                color: currentTheme === 'system' ? '#1E2A20' : 'var(--text-muted, #4A5A4C)',
                fontWeight: currentTheme === 'system' ? 600 : 500,
                fontSize: '14px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Системная
            </button>
          </div>
        </section>

        {/* Section 3: Family */}
        <h2
          style={{
            margin: '10px 0 0 4px',
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '-0.4px',
          }}
        >
          Семья
        </h2>

        <section
          data-testid="section-family"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '6px 16px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {familyMembers.map((member) => {
            const isMom = member.role.toLowerCase() === 'мама' || member.role.toLowerCase() === 'mom';
            const isDad = member.role.toLowerCase() === 'папа' || member.role.toLowerCase() === 'dad';
            const avatarBg = isMom ? '#D4F27A' : '#23372A';
            const avatarColor = isMom ? '#1E2A20' : '#F1F4EA';
            const initial = member.name ? member.name.charAt(0).toUpperCase() : (isMom ? 'М' : 'П');
            const testId = isMom ? 'family-member-mom' : isDad ? 'family-member-dad' : `family-member-${member.id}`;

            return (
              <div
                key={member.id}
                data-testid={testId}
                style={{
                  minHeight: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderBottom: '1px solid #E3E7DA',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '12px',
                    backgroundColor: avatarBg,
                    color: avatarColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '15px',
                  }}
                >
                  {initial}
                </div>
                <div style={{ flexGrow: 1, fontSize: '16px', fontWeight: 500 }}>
                  {member.name}{' '}
                  {isMom && <span style={{ color: '#4A5A4C', fontWeight: 400 }}>· вы</span>}
                </div>
                <div style={{ fontSize: '13px', color: '#4A5A4C' }}>записи и настройки</div>
              </div>
            );
          })}

          {/* Invite button */}
          <button
            type="button"
            data-testid="btn-invite-family"
            onClick={handleCopyInvite}
            style={{
              minHeight: '56px',
              padding: 0,
              backgroundColor: 'transparent',
              border: 0,
              fontFamily: 'inherit',
              fontSize: '16px',
              fontWeight: 500,
              color: '#2F5A3A',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>+ Пригласить по ссылке</span>
            {copyFeedback && (
              <span
                data-testid="invite-copy-feedback"
                style={{
                  fontSize: '13px',
                  backgroundColor: '#D4F27A',
                  color: '#1E2A20',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  fontWeight: 600,
                }}
              >
                {copyFeedback}
              </span>
            )}
          </button>

          {onLogout && (
            <button
              type="button"
              data-testid="btn-logout"
              onClick={onLogout}
              style={{
                minHeight: '44px',
                padding: '4px 0',
                backgroundColor: 'transparent',
                border: 0,
                borderTop: '1px solid #E3E7DA',
                fontFamily: 'inherit',
                fontSize: '14px',
                fontWeight: 500,
                color: '#6E422F',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              Сменить аккаунт / Выйти
            </button>
          )}
        </section>
      </div>

      {/* Age Presets Modal */}
      <AgePresetsModal
        isOpen={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
        onSelectPreset={handleSelectPreset}
        currentNaps={settings.napsPerDay}
      />

      {/* Bottom Navigation */}
      <BottomNav activeTab="settings" onSelectTab={onSelectTab} />
    </div>
  );
};
