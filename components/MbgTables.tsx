'use client';

import { useState } from 'react';
import type { SpmGroup, PettyCashRow, FinTable } from '@/lib/sheets';

async function saveFinancialCell(sheetRow: number, sheetCol: number, value: string) {
  await fetch('/api/mbg/financial-cell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetRow, sheetCol, value }),
  });
}

function EditableCell({
  value,
  sheetRow,
  sheetCol,
  align,
}: {
  value: string;
  sheetRow: number;
  sheetCol: number;
  align: 'left' | 'right';
}) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);

  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text === value || saving) return;
        setSaving(true);
        saveFinancialCell(sheetRow, sheetCol, text).finally(() => setSaving(false));
      }}
      style={{
        width: '100%',
        minWidth: 60,
        border: '1px solid transparent',
        borderRadius: 4,
        padding: '2px 4px',
        fontSize: 12.5,
        textAlign: align,
        background: saving ? 'var(--panel-2)' : 'transparent',
        color: 'var(--text)',
        fontFamily: 'inherit',
      }}
    />
  );
}

const panelStyle: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 16,
  marginBottom: 16,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: 10.5,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  color: 'var(--text-faint)',
  padding: '6px 8px',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = {
  padding: '7px 8px',
  fontSize: 12.5,
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
};

function StatusBadge({ value }: { value: string }) {
  const ok = value.trim().toUpperCase() === 'SUDAH';
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 100,
        color: ok ? '#fff' : 'var(--text-faint)',
        background: ok ? 'var(--green)' : 'var(--panel-2)',
      }}
    >
      {value.trim() || 'Belum'}
    </span>
  );
}

function NotaLink({ url }: { url: string }) {
  if (!url.trim()) return <span style={{ color: 'var(--text-faint)' }}>-</span>;
  return (
    <a
      href={url.trim()}
      target="_blank"
      rel="noopener noreferrer"
      style={{ fontSize: 11.5, color: 'var(--teal)', fontWeight: 700, textDecoration: 'none' }}
    >
      🧾 Lihat
    </a>
  );
}

export function SpmMonthTable({ group }: { group: SpmGroup }) {
  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: 'var(--text)' }}>{group.label}</h2>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{group.rows.length} transaksi</span>
      </div>
      {group.error ? (
        <p style={{ fontSize: 12, color: 'var(--red)' }}>Gagal ambil data tab {group.label}.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Kode</th>
                <th style={thStyle}>Keterangan</th>
                <th style={thStyle}>Maker</th>
                <th style={thStyle}>Approved</th>
                <th style={thStyle}>Nota</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontWeight: 700 }}>{r.kode}</td>
                  <td style={tdStyle}>{r.keterangan}</td>
                  <td style={tdStyle}>
                    <StatusBadge value={r.maker} />
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge value={r.approved} />
                  </td>
                  <td style={tdStyle}>
                    <NotaLink url={r.linkNota} />
                  </td>
                </tr>
              ))}
              {group.rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, color: 'var(--text-faint)', textAlign: 'center' }}>
                    Tidak ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function looksNumeric(v: string) {
  const s = v.trim();
  if (!s) return false;
  return /^-?[\d.,]+%?$/.test(s);
}

function FinTableCard({ table }: { table: FinTable }) {
  const numericCols = table.header.map((_, i) =>
    table.rows.some((r) => looksNumeric(r[i] || '')) && table.rows.every((r) => !r[i] || looksNumeric(r[i]))
  );
  const tall = table.rows.length > 15;

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: 'var(--text)' }}>{table.title}</h2>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{table.rows.length} baris</span>
      </div>
      <div style={{ overflowX: 'auto', ...(tall ? { maxHeight: 420, overflowY: 'auto' } : {}) }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {table.header.map((h, i) => (
                <th key={i} style={{ ...thStyle, textAlign: numericCols[i] ? 'right' : 'left' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => {
              const isTotalRow = !table.editableRows[i];
              const indent = (r[1] || '').match(/^(\s+)/)?.[1]?.length || 0;
              return (
                <tr key={i} style={isTotalRow ? { background: 'var(--panel-2)' } : undefined}>
                  {table.header.map((_, ci) => (
                    <td
                      key={ci}
                      style={{
                        ...tdStyle,
                        textAlign: numericCols[ci] ? 'right' : 'left',
                        fontWeight: isTotalRow ? 800 : 400,
                        paddingLeft: ci === 1 && indent ? 8 + indent * 6 : 8,
                      }}
                    >
                      {isTotalRow ? (
                        r[ci] || ''
                      ) : (
                        <EditableCell
                          value={r[ci] || ''}
                          sheetRow={table.rowSheetRows[i]}
                          sheetCol={table.colSheetCols[ci]}
                          align={numericCols[ci] ? 'right' : 'left'}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            {table.rows.length === 0 && (
              <tr>
                <td colSpan={table.header.length} style={{ ...tdStyle, color: 'var(--text-faint)', textAlign: 'center' }}>
                  Tidak ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FinancialStatementView({ tables, error }: { tables: FinTable[]; error: boolean }) {
  if (error) {
    return (
      <div style={panelStyle}>
        <p style={{ fontSize: 12, color: 'var(--red)' }}>Gagal ambil data Financial Statement.</p>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <a
          href="https://docs.google.com/spreadsheets/d/1ogYGnj4HP5CthXg4nVZzh9l4CXpOcGEHn0jzJnJHcS8/edit?gid=74504632#gid=74504632"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--teal)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Buka di Google Sheets ↗
        </a>
      </div>
      {tables.map((t, i) => (
        <FinTableCard key={i} table={t} />
      ))}
    </div>
  );
}

export function PettyCashTable({
  title,
  rows,
  error,
}: {
  title: string;
  rows: PettyCashRow[];
  error: boolean;
}) {
  return (
    <div style={panelStyle}>
      <h2 style={{ fontSize: 13, fontWeight: 800, margin: '0 0 10px', color: 'var(--text)' }}>{title}</h2>
      {error ? (
        <p style={{ fontSize: 12, color: 'var(--red)' }}>Gagal ambil data Petty Cash.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Tanggal</th>
                <th style={thStyle}>Keterangan</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Debit</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Kredit</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Saldo</th>
                <th style={thStyle}>Nota</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isBalanceRow = /saldo/i.test(r.tanggal);
                return (
                  <tr key={i} style={isBalanceRow ? { background: 'var(--panel-2)' } : undefined}>
                    <td style={{ ...tdStyle, fontWeight: isBalanceRow ? 800 : 400, whiteSpace: 'nowrap' }}>
                      {r.tanggal}
                    </td>
                    <td style={tdStyle}>{r.keterangan}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{r.debit}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{r.kredit}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800 }}>{r.saldo}</td>
                    <td style={tdStyle}>
                      <NotaLink url={r.linkNota} />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, color: 'var(--text-faint)', textAlign: 'center' }}>
                    Tidak ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
