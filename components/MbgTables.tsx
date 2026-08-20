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

type MockJob = {
  id: string;
  text: string;
  pic: string;
  dueDate: string | null;
  done: boolean;
};

type MockJobGroup = {
  group: string;
  items: MockJob[];
};

const MOCK_PENDING_JOBS: MockJobGroup[] = [
  {
    group: 'SPM Agustus',
    items: [
      { id: 'pj-1', text: 'Lengkapi nota yang belum di-upload', pic: 'Budi', dueDate: '2026-08-22', done: false },
      { id: 'pj-2', text: 'Follow up approval maker ke yayasan', pic: 'Sari', dueDate: '2026-08-18', done: false },
      { id: 'pj-3', text: 'Rekap SPM ke Financial Statement', pic: 'Andi', dueDate: null, done: true },
    ],
  },
  {
    group: 'Petty Cash',
    items: [
      { id: 'pj-4', text: 'Rekonsiliasi saldo minggu ini', pic: '', dueDate: '2026-08-21', done: false },
      { id: 'pj-5', text: 'Input nota belanja dapur', pic: '', dueDate: null, done: false },
    ],
  },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

let mockJobSeq = 0;
function newJobId() {
  mockJobSeq += 1;
  return `pj-new-${Date.now()}-${mockJobSeq}`;
}

export function PendingJobTable() {
  const [groups, setGroups] = useState(MOCK_PENDING_JOBS);
  const [search, setSearch] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftText, setDraftText] = useState('');
  const [addError, setAddError] = useState('');

  const filtered = search.trim()
    ? groups
        .map((g) => ({
          group: g.group,
          items: g.items.filter((t) => t.text.toLowerCase().includes(search.trim().toLowerCase())),
        }))
        .filter((g) => g.items.length > 0)
    : groups;

  function toggleDone(groupName: string, id: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.group !== groupName
          ? g
          : { ...g, items: g.items.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }
      )
    );
  }

  function removeJob(groupName: string, id: string) {
    setGroups((prev) =>
      prev.map((g) => (g.group !== groupName ? g : { ...g, items: g.items.filter((t) => t.id !== id) }))
    );
  }

  function updatePic(groupName: string, id: string, pic: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.group !== groupName ? g : { ...g, items: g.items.map((t) => (t.id === id ? { ...t, pic } : t)) }
      )
    );
  }

  function renameGroup(oldName: string, newName: string) {
    setGroups((prev) => prev.map((g) => (g.group !== oldName ? g : { ...g, group: newName })));
  }

  function addJob(groupName: string, text: string) {
    const t = text.trim();
    if (!t) return false;
    const job: MockJob = { id: newJobId(), text: t, pic: '', dueDate: null, done: false };
    setGroups((prev) => prev.map((g) => (g.group !== groupName ? g : { ...g, items: [...g.items, job] })));
    return true;
  }

  function addJobGroup() {
    const title = draftTitle.trim();
    const text = draftText.trim();
    if (!title || !text) {
      setAddError(!title ? 'Isi judul pekerjaan dulu.' : 'Isi task pertamanya dulu.');
      return;
    }
    setAddError('');
    setGroups((prev) => [
      ...prev,
      { group: title, items: [{ id: newJobId(), text, pic: '', dueDate: null, done: false }] },
    ]);
    setDraftTitle('');
    setDraftText('');
  }

  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '.05em',
            color: 'var(--text-faint)',
            margin: 0,
            fontWeight: 700,
          }}
        >
          Pending Job
        </h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari job…"
          style={{
            width: 200,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 12.5,
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: addError ? 6 : 18, flexWrap: 'wrap' }}>
        <input
          value={draftTitle}
          onChange={(e) => {
            setDraftTitle(e.target.value);
            if (addError) setAddError('');
          }}
          placeholder="Judul pekerjaan baru…"
          style={{
            width: 200,
            padding: '8px 10px',
            borderRadius: 8,
            border: `1px solid ${addError.includes('judul') ? 'var(--red)' : 'var(--border)'}`,
            fontSize: 13,
          }}
        />
        <input
          value={draftText}
          onChange={(e) => {
            setDraftText(e.target.value);
            if (addError) setAddError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addJobGroup();
          }}
          placeholder="Task pertama…"
          style={{
            flex: 1,
            minWidth: 180,
            padding: '8px 10px',
            borderRadius: 8,
            border: `1px solid ${addError.includes('task') ? 'var(--red)' : 'var(--border)'}`,
            fontSize: 13,
          }}
        />
        <button
          onClick={addJobGroup}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--teal)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Tambah
        </button>
      </div>

      {addError && <p style={{ fontSize: 11.5, color: 'var(--red)', margin: '0 0 12px' }}>{addError}</p>}

      {filtered.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Nggak ada job yang cocok.</p>
      )}

      <div className="task-groups">
        {filtered.map(({ group, items }) => (
          <div key={group}>
            <GroupTitle group={group} onRename={(newName) => renameGroup(group, newName)} />
            <ol style={{ margin: 0, paddingLeft: 22, listStyle: 'decimal' }}>
              {items.map((job) => {
                const overdue = !!job.dueDate && !job.done && job.dueDate < todayStr();
                return (
                  <li key={job.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div className="task-item-scroll">
                        <span
                          style={{
                            display: 'block',
                            fontSize: 13.5,
                            padding: '2px 4px',
                            color: job.done ? 'var(--text-faint)' : 'var(--text)',
                            textDecoration: job.done ? 'line-through' : 'none',
                          }}
                        >
                          {job.text}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>PIC</span>
                          <input
                            value={job.pic}
                            onChange={(e) => updatePic(group, job.id, e.target.value.slice(0, 10))}
                            maxLength={10}
                            placeholder="—"
                            style={{
                              width: 86,
                              fontSize: 11.5,
                              padding: '3px 6px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              color: 'var(--text-dim)',
                              background: 'var(--panel)',
                            }}
                          />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Due</span>
                          <span
                            style={{
                              fontSize: 11.5,
                              padding: '3px 6px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              color: overdue ? '#fff' : 'var(--text-dim)',
                              background: overdue ? 'var(--red)' : 'var(--panel)',
                            }}
                          >
                            {job.dueDate || '—'}
                          </span>
                        </label>
                        <input
                          type="checkbox"
                          checked={job.done}
                          onChange={() => toggleDone(group, job.id)}
                          style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                        />
                        <button
                          onClick={() => removeJob(group, job.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-faint)',
                            cursor: 'pointer',
                            fontSize: 13,
                            padding: '0 2px',
                            flexShrink: 0,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <QuickAddJob group={group} onAdd={(text) => addJob(group, text)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupTitle({ group, onRename }: { group: string; onRename: (newName: string) => void }) {
  const [text, setText] = useState(group);

  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const t = text.trim();
        if (t && t !== group) onRename(t);
        else setText(group);
      }}
      placeholder="Judul pekerjaan…"
      style={{
        display: 'block',
        fontSize: 14.5,
        fontWeight: 800,
        margin: '0 0 6px',
        padding: '2px 4px',
        color: 'var(--text)',
        textDecoration: 'underline',
        textUnderlineOffset: 3,
        border: '1px solid transparent',
        borderRadius: 6,
        background: 'transparent',
        width: 'auto',
        minWidth: 160,
      }}
    />
  );
}

function QuickAddJob({ group, onAdd }: { group: string; onAdd: (text: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  function submit() {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          marginLeft: 22,
          marginTop: 4,
          border: 'none',
          background: 'transparent',
          color: 'var(--teal)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 700,
          padding: 0,
        }}
      >
        + Tambah task
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 6, marginLeft: 22, marginTop: 4 }}>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') {
            setText('');
            setOpen(false);
          }
        }}
        onBlur={() => {
          if (!text.trim()) setOpen(false);
        }}
        placeholder={`Task baru untuk ${group}…`}
        style={{
          flex: 1,
          fontSize: 12.5,
          padding: '5px 8px',
          borderRadius: 6,
          border: '1px solid var(--border)',
        }}
      />
      <button
        onClick={submit}
        style={{
          fontSize: 12,
          padding: '5px 12px',
          borderRadius: 6,
          border: 'none',
          background: 'var(--teal)',
          color: '#fff',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        +
      </button>
    </div>
  );
}
