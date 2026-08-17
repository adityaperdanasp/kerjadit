'use client';

import { useMemo, useState } from 'react';
import { INDUSTRY_OPTIONS, type Contact } from '@/lib/notion';

const STATUSES = ['Hot', 'Warm', 'Cold', 'Win', 'Lost'] as const;
type Status = (typeof STATUSES)[number];

function formatRupiah(n: number | null | undefined) {
  return 'Rp ' + (n || 0).toLocaleString('id-ID');
}
function parseRupiah(str: string) {
  const digits = str.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

async function patchContact(id: string, fields: Record<string, unknown>) {
  await fetch(`/api/contacts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
}

export default function Board({ initialContacts }: { initialContacts: Contact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState('');
  const [clusterFilter, setClusterFilter] = useState('Semua');
  const [dragId, setDragId] = useState<string | null>(null);

  const pool = useMemo(() => {
    let unassigned = contacts.filter((c) => !c.statusDeal);
    if (clusterFilter !== 'Semua') {
      unassigned = unassigned.filter((c) => (c.cluster || 'Cold') === clusterFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      unassigned = unassigned.filter(
        (c) => c.nama.toLowerCase().includes(q) || c.perusahaan.toLowerCase().includes(q)
      );
    }
    return unassigned;
  }, [contacts, search, clusterFilter]);

  const byStatus = useMemo(() => {
    const map: Record<Status, Contact[]> = { Hot: [], Warm: [], Cold: [], Win: [], Lost: [] };
    for (const c of contacts) {
      if (c.statusDeal && STATUSES.includes(c.statusDeal as Status)) {
        map[c.statusDeal as Status].push(c);
      }
    }
    return map;
  }, [contacts]);

  const stats = useMemo(() => {
    const winValue = byStatus.Win.reduce((s, c) => s + (c.quotationNominal || 0), 0);
    const hotValue = byStatus.Hot.reduce((s, c) => s + (c.quotationNominal || 0), 0);
    const profit = Math.round(hotValue * 0.35);
    return { winValue, hotValue, winProfit: profit, hotProfit: profit };
  }, [byStatus]);

  function updateLocal(id: string, fields: Partial<Contact>) {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...fields } : c)));
  }

  function handleFieldChange(id: string, fields: Record<string, unknown>) {
    updateLocal(id, fields as Partial<Contact>);
    patchContact(id, fields);
  }

  function handleDrop(status: Status) {
    if (!dragId) return;
    updateLocal(dragId, { statusDeal: status });
    patchContact(dragId, { statusDeal: status });
    setDragId(null);
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 26px 60px' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
          Pipeline B2B
        </h1>
        <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
          Drag kontak ke kolom status untuk mulai kelola deal
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatCard label="Win Value" value={formatRupiah(stats.winValue)} bg="var(--teal)" />
        <StatCard label="Hot Value" value={formatRupiah(stats.hotValue)} bg="var(--orange)" />
        <StatCard
          label="Win Profit"
          sub="(35% dari Hot Value)"
          value={formatRupiah(stats.winProfit)}
        />
        <StatCard
          label="Est Hot Profit"
          sub="(35% dari Hot Value)"
          value={formatRupiah(stats.hotProfit)}
        />
      </div>

      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
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
            Belum Diklasifikasi
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={clusterFilter}
              onChange={(e) => setClusterFilter(e.target.value)}
              style={{
                padding: '6px 9px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 12.5,
                background: 'var(--panel)',
                color: 'var(--text)',
              }}
            >
              <option value="Semua">Semua Cluster</option>
              <option value="Hot">Hot</option>
              <option value="Warm">Warm</option>
              <option value="Cold">Cold</option>
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / perusahaan…"
              style={{
                width: 220,
                padding: '6px 9px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 12.5,
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {pool.length} kontak
          </span>
        </div>
        <div style={{ maxHeight: 340, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={thStyle}>Nama</th>
                <th style={thStyle}>Industri</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Hari</th>
              </tr>
            </thead>
            <tbody>
              {pool.map((c) => (
                <PoolRow key={c.id} contact={c} onDragStart={() => setDragId(c.id)} onFieldChange={handleFieldChange} />
              ))}
            </tbody>
          </table>
          {pool.length === 0 && (
            <p style={{ fontSize: 11.5, color: 'var(--text-faint)', padding: '10px 4px' }}>
              Tidak ada kontak yang cocok.
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            deals={byStatus[status]}
            onDrop={() => handleDrop(status)}
            onFieldChange={handleFieldChange}
          />
        ))}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: 10.5,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  color: 'var(--text-faint)',
  padding: '6px 8px',
  borderBottom: '1px solid var(--border)',
};
const tdStyle: React.CSSProperties = {
  padding: '8px 8px',
  verticalAlign: 'top',
};

function StatCard({
  label,
  sub,
  value,
  bg,
}: {
  label: string;
  sub?: string;
  value: string;
  bg?: string;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: '16px 18px',
        background: bg || 'var(--panel)',
        color: bg ? '#fff' : 'var(--text)',
        border: bg ? 'none' : '1px solid var(--border)',
      }}
    >
      <div style={{ fontSize: 11, opacity: bg ? 0.85 : 1, color: bg ? '#fff' : 'var(--text-faint)' }}>
        {label}
        {sub && (
          <span style={{ display: 'block', fontSize: 9.5, fontWeight: 500, opacity: 0.75, marginTop: 1 }}>
            {sub}
          </span>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

function Column({
  status,
  deals,
  onDrop,
  onFieldChange,
}: {
  status: Status;
  deals: Contact[];
  onDrop: () => void;
  onFieldChange: (id: string, fields: Record<string, unknown>) => void;
}) {
  const [over, setOver] = useState(false);
  const colorMap: Record<Status, string> = {
    Hot: 'var(--red)',
    Warm: 'var(--orange)',
    Cold: 'var(--blue)',
    Win: 'var(--green)',
    Lost: 'var(--text-faint)',
  };
  const emojiMap: Record<Status, string> = {
    Hot: '🔥',
    Warm: '🟡',
    Cold: '❄️',
    Win: '✅',
    Lost: '⬜',
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDrop();
      }}
      style={{
        background: over ? 'var(--panel-2)' : 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 12,
        minHeight: 160,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '.04em',
            color: colorMap[status],
          }}
        >
          {emojiMap[status]} {status}
        </span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: 'var(--text-faint)',
            background: 'var(--panel-2)',
            padding: '2px 7px',
            borderRadius: 100,
          }}
        >
          {deals.length}
        </span>
      </div>

      {deals.map((c) => (
        <DealCard key={c.id} contact={c} onFieldChange={onFieldChange} />
      ))}
      {deals.length === 0 && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            textAlign: 'center',
            padding: '18px 6px',
            border: '1px dashed var(--border)',
            borderRadius: 10,
          }}
        >
          Drop di sini
        </div>
      )}
    </div>
  );
}

function DealCard({
  contact,
  onFieldChange,
}: {
  contact: Contact;
  onFieldChange: (id: string, fields: Record<string, unknown>) => void;
}) {
  const [quotationText, setQuotationText] = useState(
    contact.quotationNominal ? formatRupiah(contact.quotationNominal) : ''
  );
  const [onboardPlan, setOnboardPlan] = useState(contact.onboardPlan);
  const [nama, setNama] = useState(contact.nama);
  const [perusahaan, setPerusahaan] = useState(contact.perusahaan);

  return (
    <div
      style={{
        background: 'var(--panel-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 11px',
        marginBottom: 8,
        fontSize: 12,
      }}
    >
      <input
        value={nama}
        onChange={(e) => setNama(e.target.value)}
        onBlur={() => onFieldChange(contact.id, { nama })}
        style={{ ...nameInputStyle, marginBottom: 4 }}
      />
      <input
        value={perusahaan}
        onChange={(e) => setPerusahaan(e.target.value)}
        onBlur={() => onFieldChange(contact.id, { perusahaan })}
        placeholder="Nama perusahaan"
        style={{ ...nameInputStyle, fontWeight: 400, fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}
      />
      <Field label="Industri">
        <select
          value={contact.industri || 'Unknown'}
          onChange={(e) => onFieldChange(contact.id, { industri: e.target.value })}
          style={fieldInputStyle}
        >
          {INDUSTRY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Quotation">
        <input
          value={quotationText}
          onChange={(e) => setQuotationText(e.target.value)}
          onBlur={() => {
            const n = parseRupiah(quotationText);
            setQuotationText(n ? formatRupiah(n) : '');
            onFieldChange(contact.id, { quotationNominal: n });
          }}
          placeholder="Rp 0"
          style={fieldInputStyle}
        />
      </Field>
      <Field label="Onboard Plan">
        <input
          value={onboardPlan}
          onChange={(e) => setOnboardPlan(e.target.value)}
          onBlur={() => onFieldChange(contact.id, { onboardPlan })}
          placeholder="mis. Q3 2026"
          style={fieldInputStyle}
        />
      </Field>
      {contact.ringkasan && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {contact.ringkasan}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 4 }}>
      <label
        style={{
          color: 'var(--text-faint)',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '.03em',
          flexShrink: 0,
          paddingTop: 2,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const fieldInputStyle: React.CSSProperties = {
  flex: 1,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--panel)',
  color: 'var(--text)',
  fontSize: 11.5,
  padding: '4px 6px',
  textAlign: 'right',
};

const nameInputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid transparent',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--text)',
  fontWeight: 700,
  fontSize: 13,
  padding: '2px 4px',
};

function PoolRow({
  contact,
  onDragStart,
  onFieldChange,
}: {
  contact: Contact;
  onDragStart: () => void;
  onFieldChange: (id: string, fields: Record<string, unknown>) => void;
}) {
  const [nama, setNama] = useState(contact.nama);

  return (
    <tr draggable onDragStart={onDragStart} style={{ cursor: 'grab', borderBottom: '1px solid var(--border)' }}>
      <td style={tdStyle}>
        <input
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          onBlur={() => onFieldChange(contact.id, { nama })}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ ...nameInputStyle, marginBottom: 2 }}
        />
        {contact.perusahaan && (
          <div style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-faint)', padding: '0 4px' }}>
            {contact.perusahaan}
          </div>
        )}
      </td>
      <td style={tdStyle}>
        <select
          value={contact.industri || 'Unknown'}
          onChange={(e) => onFieldChange(contact.id, { industri: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            fontSize: 11,
            padding: '3px 6px',
            borderRadius: 100,
            background: 'var(--panel-2)',
            color: 'var(--text-dim)',
            border: '1px solid var(--border)',
          }}
        >
          {INDUSTRY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </td>
      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {contact.hariSejakChat ?? '-'}
      </td>
    </tr>
  );
}
