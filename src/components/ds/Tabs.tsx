'use client';

export interface TabDef {
  key: string;
  label: string;
  /** Dark count bubble after the label (e.g. "Items 2"). */
  count?: number;
}

interface TabsProps {
  tabs: TabDef[];
  activeKey: string;
  onChange: (key: string) => void;
  /**
   * 'underline' (default): 14px, active weight 500 #111927 with a 2px #9DA4AE bottom border.
   * 'segmented': outlined buttons, the active one filled dark (Listed Products / Requests, offer types).
   */
  variant?: 'underline' | 'segmented';
}

export function Tabs({ tabs, activeKey, onChange, variant = 'underline' }: TabsProps) {
  if (variant === 'segmented') {
    return (
      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <button
              type="button"
              key={tab.key}
              role="tab"
              aria-selected={active}
              className={`h-9 rounded-6 border px-4 text-14 ${
                active ? 'border-dark bg-dark font-medium text-white' : 'border-line bg-white text-ink hover:border-ink-muted'
              }`}
              onClick={() => onChange(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" className="flex gap-5 border-b border-line-secondary">
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            type="button"
            key={tab.key}
            role="tab"
            aria-selected={active}
            className={`-mb-px flex items-center gap-2 border-b-2 pb-2.5 pt-2 text-14 ${
              active ? 'border-ink-disabled font-medium text-ink' : 'border-transparent text-ink-tertiary hover:text-ink'
            }`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="min-w-5 rounded-6 bg-ink px-1.5 text-center text-12 font-medium text-white">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
