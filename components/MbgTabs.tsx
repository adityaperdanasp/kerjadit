'use client';

import { useState } from 'react';
import type { SpmGroup, PettyCashRow } from '@/lib/sheets';
import { SpmMonthTable, PettyCashTable } from './MbgTables';

export default function MbgTabs({
  spmGroups,
  pettyCash,
}: {
  spmGroups: SpmGroup[];
  pettyCash: { title: string; rows: PettyCashRow[]; error: boolean };
}) {
  const tabs = [...spmGroups.map((g) => g.label), 'Petty Cash'];
  const [active, setActive] = useState(tabs[tabs.length - 2] || tabs[0]);

  return (
    <div>
      <div
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          gap: 2,
          background: 'var(--panel-2)',
          borderRadius: 999,
          padding: 3,
          marginBottom: 16,
        }}
      >
        {tabs.map((label) => {
          const isActive = active === label;
          return (
            <button
              key={label}
              onClick={() => setActive(label)}
              style={{
                padding: '6px 16px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                color: isActive ? 'var(--text)' : 'var(--text-faint)',
                background: isActive ? 'var(--panel)' : 'transparent',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {spmGroups
        .filter((g) => g.label === active)
        .map((g) => (
          <SpmMonthTable key={g.label} group={g} />
        ))}

      {active === 'Petty Cash' && (
        <PettyCashTable title={pettyCash.title} rows={pettyCash.rows} error={pettyCash.error} />
      )}
    </div>
  );
}
