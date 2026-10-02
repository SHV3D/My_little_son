import React, { useState, useEffect } from 'react';

export type TabId = 'today' | 'calendar' | 'settings';

export interface TabItem {
  id: TabId;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

export interface BottomNavProps {
  activeTab?: TabId | string;
  onSelectTab?: (tab: any) => void;
  className?: string;
  style?: React.CSSProperties;
}

const normalizeTab = (tab?: string): TabId => {
  if (!tab) return 'today';
  const lower = tab.toLowerCase();
  if (lower === 'calendar' || lower === 'календарь') return 'calendar';
  if (lower === 'settings' || lower === 'настройки') return 'settings';
  return 'today';
};

const TABS: TabItem[] = [
  {
    id: 'today',
    label: 'Сегодня',
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    id: 'calendar',
    label: 'Календарь',
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Настройки',
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
    ),
  },
];

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab: propActiveTab,
  onSelectTab,
  className = '',
  style,
}) => {
  const [internalTab, setInternalTab] = useState<TabId>(normalizeTab(propActiveTab));

  useEffect(() => {
    if (propActiveTab !== undefined) {
      setInternalTab(normalizeTab(propActiveTab));
    }
  }, [propActiveTab]);

  const activeTabId = propActiveTab !== undefined ? normalizeTab(propActiveTab) : internalTab;

  const handleTabClick = (tab: TabItem) => {
    setInternalTab(tab.id);
    if (onSelectTab) {
      // Pass tab.id or original format matching input if it was string
      onSelectTab(tab.id);
    }
  };

  return (
    <nav
      className={`bottom-nav-container ${className}`.trim()}
      data-testid="bottom-nav"
      role="tablist"
      style={{
        flexShrink: 0,
        minHeight: '88px',
        height: '88px',
        width: '100%',
        boxSizing: 'border-box',
        padding: '6px 16px max(24px, env(safe-area-inset-bottom, 24px))',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '8px',
        backgroundColor: 'var(--bg-primary, #ECEEE6)',
        userSelect: 'none',
        ...style,
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTabId === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            data-testid={`tab-${tab.id}`}
            data-active={isActive ? 'true' : 'false'}
            onClick={() => handleTabClick(tab)}
            className={`bottom-nav-tab ${isActive ? 'active' : 'inactive'}`}
            style={{
              flexShrink: 0,
              minHeight: '52px',
              height: '52px',
              border: 0,
              borderRadius: '16px',
              backgroundColor: isActive ? 'var(--color-white, #FFFFFF)' : 'transparent',
              color: isActive ? 'var(--text-primary, #1E2A20)' : 'var(--text-muted, #4A5A4C)',
              fontSize: '12px',
              fontWeight: isActive ? 600 : 500,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              cursor: 'pointer',
              boxShadow: isActive
                ? 'var(--shadow-sm, 0 2px 8px rgba(35, 55, 42, 0.04))'
                : 'none',
              transition:
                'background-color var(--transition-normal, 0.25s), color var(--transition-normal, 0.25s), transform var(--transition-fast, 0.15s)',
            }}
          >
            {tab.icon(isActive)}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
