'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SpmGroup, PettyCashRow, FinTable, PendingJobGroup, PendingJobItem } from '@/lib/sheets';
import { PENDING_JOB_COLS } from '@/lib/sheets';

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
    <div style={panelStyle} className="mbg-glass-card">
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
    <div style={panelStyle} className="mbg-glass-card">
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
      <div style={panelStyle} className="mbg-glass-card">
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
    <div style={panelStyle} className="mbg-glass-card">
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

async function apiCreateJob(group: string, text: string): Promise<PendingJobItem | null> {
  const res = await fetch('/api/mbg/pending-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group, text }),
  });
  const data = await res.json();
  return data.ok ? data.job : null;
}

function apiUpdateCell(sheetRow: number, col: number, value: string) {
  fetch('/api/mbg/pending-job/cell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetRow, col, value }),
  });
}

function apiDeleteJob(sheetRow: number) {
  fetch(`/api/mbg/pending-job/${sheetRow}`, { method: 'DELETE' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function PendingJobTable({
  initialGroups,
  error,
}: {
  initialGroups: PendingJobGroup[];
  error: boolean;
}) {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Writes go straight to the sheet, but this route's RSC payload stays in the client
  // cache — so leaving /mbg and coming back would re-mount this table from a pre-write
  // snapshot and look like the edits were lost. Refreshing clears that cached payload.
  // Debounced because a single PIC edit or checkbox toggle shouldn't trigger a refetch
  // of every other MBG tab's data. useState(initialGroups) ignores the new props, so an
  // in-flight refresh never clobbers what's on screen.
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 1500);
  }, [router]);

  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const [groups, setGroups] = useState(initialGroups);
  const [search, setSearch] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftText, setDraftText] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const filtered = search.trim()
    ? groups
        .map((g) => ({
          group: g.group,
          items: g.items.filter((t) => t.text.toLowerCase().includes(search.trim().toLowerCase())),
        }))
        .filter((g) => g.items.length > 0)
    : groups;

  function patchItem(groupName: string, id: string, fields: Partial<PendingJobItem>) {
    setGroups((prev) =>
      prev.map((g) =>
        g.group !== groupName
          ? g
          : { ...g, items: g.items.map((t) => (t.id === id ? { ...t, ...fields } : t)) }
      )
    );
  }

  function toggleDone(groupName: string, item: PendingJobItem) {
    const done = !item.done;
    patchItem(groupName, item.id, { done });
    apiUpdateCell(item.sheetRow, PENDING_JOB_COLS.done, done ? 'TRUE' : 'FALSE');
    scheduleRefresh();
  }

  function updatePic(groupName: string, item: PendingJobItem, pic: string) {
    patchItem(groupName, item.id, { pic });
    apiUpdateCell(item.sheetRow, PENDING_JOB_COLS.pic, pic);
    scheduleRefresh();
  }

  function updateDueDate(groupName: string, item: PendingJobItem, dueDate: string) {
    patchItem(groupName, item.id, { dueDate: dueDate || null });
    apiUpdateCell(item.sheetRow, PENDING_JOB_COLS.dueDate, dueDate);
    scheduleRefresh();
  }

  function removeJob(groupName: string, item: PendingJobItem) {
    setGroups((prev) =>
      prev.map((g) => (g.group !== groupName ? g : { ...g, items: g.items.filter((t) => t.id !== item.id) }))
    );
    apiDeleteJob(item.sheetRow);
    scheduleRefresh();
  }

  function renameGroup(oldName: string, newName: string) {
    const target = groups.find((g) => g.group === oldName);
    setGroups((prev) => prev.map((g) => (g.group !== oldName ? g : { ...g, group: newName })));
    target?.items.forEach((item) => apiUpdateCell(item.sheetRow, PENDING_JOB_COLS.group, newName));
    scheduleRefresh();
  }

  async function addJob(groupName: string, text: string) {
    const job = await apiCreateJob(groupName, text);
    if (!job) return false;
    setGroups((prev) => prev.map((g) => (g.group !== groupName ? g : { ...g, items: [...g.items, job] })));
    scheduleRefresh();
    return true;
  }

  async function handleAddGroup() {
    const title = draftTitle.trim();
    const text = draftText.trim();
    if (adding) return;
    if (!title || !text) {
      setAddError(!title ? 'Isi judul pekerjaan dulu.' : 'Isi task pertamanya dulu.');
      return;
    }
    setAddError('');
    setAdding(true);
    const job = await apiCreateJob(title, text);
    if (job) {
      setGroups((prev) => [...prev, { group: title, items: [job] }]);
      setDraftTitle('');
      setDraftText('');
      scheduleRefresh();
    }
    setAdding(false);
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

      {error ? (
        <p style={{ fontSize: 12, color: 'var(--red)' }}>Gagal ambil data Pending Job.</p>
      ) : (
        <>
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
                if (e.key === 'Enter') handleAddGroup();
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
              onClick={handleAddGroup}
              disabled={adding}
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
            <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              {search.trim() ? 'Nggak ada job yang cocok.' : 'Belum ada pekerjaan.'}
            </p>
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
                              <PicInput
                                value={job.pic}
                                onCommit={(pic) => updatePic(group, job, pic)}
                              />
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Due</span>
                              <input
                                type="date"
                                value={job.dueDate || ''}
                                onChange={(e) => updateDueDate(group, job, e.target.value)}
                                style={{
                                  fontSize: 11.5,
                                  padding: '3px 6px',
                                  borderRadius: 6,
                                  border: '1px solid var(--border)',
                                  color: overdue ? '#fff' : 'var(--text-dim)',
                                  background: overdue ? 'var(--red)' : 'var(--panel)',
                                  maxWidth: 130,
                                }}
                              />
                            </label>
                            <input
                              type="checkbox"
                              checked={job.done}
                              onChange={() => toggleDone(group, job)}
                              style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                            />
                            <button
                              onClick={() => removeJob(group, job)}
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
        </>
      )}
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

function PicInput({ value, onCommit }: { value: string; onCommit: (pic: string) => void }) {
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);

  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value.slice(0, 10))}
      onBlur={() => {
        if (text !== value) onCommit(text);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
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
  );
}

function QuickAddJob({ group, onAdd }: { group: string; onAdd: (text: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    const t = text.trim();
    if (!t || saving) return;
    setSaving(true);
    await onAdd(t);
    setText('');
    setSaving(false);
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
        disabled={saving}
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
