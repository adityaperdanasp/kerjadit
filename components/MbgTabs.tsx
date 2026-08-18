'use client';

import { useState } from 'react';
import type { SpmGroup, PettyCashRow, FinTable } from '@/lib/sheets';
import { SpmMonthTable, PettyCashTable, FinancialStatementView } from './MbgTables';

const FINANCIAL_STATEMENT_LABEL = 'Financial Statement';
const PETTY_CASH_LABEL = 'Petty Cash';

export default function MbgTabs({
  spmGroups,
  pettyCash,
  financialStatement,
}: {
  spmGroups: SpmGroup[];
  pettyCash: { title: string; rows: PettyCashRow[]; error: boolean };
  financialStatement: { tables: FinTable[]; error: boolean };
}) {
  const tabs = [...spmGroups.map((g) => g.label), PETTY_CASH_LABEL, FINANCIAL_STATEMENT_LABEL];
  const [active, setActive] = useState(spmGroups[spmGroups.length - 1]?.label || tabs[0]);

  return (
    <div>
      <select
        value={active}
        onChange={(e) => setActive(e.target.value)}
        style={{
          display: 'block',
          width: 220,
          padding: '8px 12px',
          fontSize: 13,
          fontWeight: 700,
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--panel)',
          color: 'var(--text)',
          cursor: 'pointer',
          marginBottom: 16,
        }}
      >
        {tabs.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </select>

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
    </div>
  );
}
