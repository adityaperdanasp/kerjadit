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
  const dropdownOptions = [...spmGroups.map((g) => g.label), PETTY_CASH_LABEL];
  const defaultValue = spmGroups[spmGroups.length - 1]?.label || dropdownOptions[0];
  const [active, setActive] = useState(defaultValue);
  const [dropdownValue, setDropdownValue] = useState(defaultValue);

  function handleDropdownChange(value: string) {
    setDropdownValue(value);
    setActive(value);
  }

  const financialActive = active === FINANCIAL_STATEMENT_LABEL;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <select
          value={dropdownValue}
          onChange={(e) => handleDropdownChange(e.target.value)}
          style={{
            padding: '8px 12px',
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--panel)',
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          {dropdownOptions.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>

        <button
          onClick={() => setActive(FINANCIAL_STATEMENT_LABEL)}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            border: `1px solid ${financialActive ? 'var(--teal)' : 'var(--border)'}`,
            background: financialActive ? 'var(--panel)' : 'transparent',
            color: financialActive ? 'var(--teal)' : 'var(--text-faint)',
            cursor: 'pointer',
          }}
        >
          Financial Statement
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
    </div>
  );
}
