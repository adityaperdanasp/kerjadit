'use client';

import { useEffect, useRef, useState } from 'react';
import type { SpmGroup, PettyCashRow, FinTable, PendingJobGroup } from '@/lib/sheets';
import { SpmMonthTable, PettyCashTable, FinancialStatementView, PendingJobTable } from './MbgTables';

const FINANCIAL_STATEMENT_LABEL = 'Financial Statement';
const PETTY_CASH_LABEL = 'Petty Cash';
const PENDING_JOB_LABEL = 'Pending Job';

const MONTH_ABBR: Record<string, string> = {
  Januari: 'Jan',
  Februari: 'Feb',
  Maret: 'Mar',
  April: 'Apr',
  Mei: 'May',
  Juni: 'Jun',
  Juli: 'Jul',
  Agustus: 'Aug',
  September: 'Sept',
  Oktober: 'Oct',
  November: 'Nov',
  Desember: 'Dec',
};

function shortMonthLabel(label: string): string {
  return MONTH_ABBR[label] || label.slice(0, 4);
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 16px',
    fontSize: 13,
    fontWeight: 700,
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    color: active ? '#fff' : 'var(--text-faint)',
    background: active ? 'linear-gradient(135deg, var(--mbg-accent-a), var(--mbg-accent-b))' : 'transparent',
    boxShadow: active ? '0 2px 8px rgba(99,102,241,.35)' : 'none',
  };
}

export default function MbgTabs({
  spmGroups,
  pettyCash,
  financialStatement,
  pendingJob,
}: {
  spmGroups: SpmGroup[];
  pettyCash: { title: string; rows: PettyCashRow[]; error: boolean };
  financialStatement: { tables: FinTable[]; error: boolean };
  pendingJob: { groups: PendingJobGroup[]; error: boolean };
}) {
  const monthLabels = spmGroups.map((g) => g.label);
  const defaultValue = monthLabels[monthLabels.length - 1] || monthLabels[0] || PETTY_CASH_LABEL;
  const [active, setActive] = useState(defaultValue);
  const [monthOpen, setMonthOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMonthOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const isMonthActive = monthLabels.includes(active);
  const monthPillLabel = isMonthActive ? active : monthLabels[monthLabels.length - 1] || '';

  return (
    <div>
      <div
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          gap: 2,
          background: 'var(--mbg-glass-bg)',
          border: '1px solid var(--mbg-glass-border)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 999,
          padding: 3,
          marginBottom: 16,
        }}
      >
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button onClick={() => setMonthOpen((v) => !v)} style={pillStyle(isMonthActive)}>
            {shortMonthLabel(monthPillLabel)}
            <span style={{ fontSize: 9, marginLeft: 2 }}>▾</span>
          </button>
          {monthOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,.14)',
                overflow: 'hidden',
                zIndex: 20,
                minWidth: 130,
              }}
            >
              {monthLabels.map((label) => (
                <div
                  key={label}
                  onClick={() => {
                    setActive(label);
                    setMonthOpen(false);
                  }}
                  style={{
                    padding: '9px 14px',
                    fontSize: 13,
                    fontWeight: active === label ? 800 : 500,
                    cursor: 'pointer',
                    color: active === label ? 'var(--text)' : 'var(--text-dim)',
                    background: active === label ? 'var(--panel-2)' : 'transparent',
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => setActive(PETTY_CASH_LABEL)} style={pillStyle(active === PETTY_CASH_LABEL)}>
          {PETTY_CASH_LABEL}
        </button>

        <button
          onClick={() => setActive(FINANCIAL_STATEMENT_LABEL)}
          style={pillStyle(active === FINANCIAL_STATEMENT_LABEL)}
        >
          FS
        </button>

        <button onClick={() => setActive(PENDING_JOB_LABEL)} style={pillStyle(active === PENDING_JOB_LABEL)}>
          {PENDING_JOB_LABEL}
        </button>
      </div>

      {spmGroups
        .filter((g) => g.label === active)
        .map((g) => (
          <SpmMonthTable key={g.label} group={g} />
        ))}

      {active === FINANCIAL_STATEMENT_LABEL && (
        <FinancialStatementView tables={financialStatement.tables} error={financialStatement.error} />
      )}

      {active === PETTY_CASH_LABEL && (
        <PettyCashTable title={pettyCash.title} rows={pettyCash.rows} error={pettyCash.error} />
      )}

      {active === PENDING_JOB_LABEL && (
        <PendingJobTable initialGroups={pendingJob.groups} error={pendingJob.error} />
      )}
    </div>
  );
}
