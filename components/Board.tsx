'use client';

import { useMemo, useState } from 'react';
import { INDUSTRY_OPTIONS, type Contact, type BriefingItem } from '@/lib/notion';

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

export default function Board({
  initialContacts,
  initialBriefing,
}: {
  initialContacts: Contact[];
  initialBriefing: { items: BriefingItem[] | null; generatedAt: string | null };
}) {
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

  const staleDeals = useMemo(() => {
    return [...byStatus.Hot, ...byStatus.Warm]
      .filter((c) => (c.hariSejakChat ?? 0) > 7)
      .sort((a, b) => (b.hariSejakChat ?? 0) - (a.hariSejakChat ?? 0));
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
    <div className="sirka-theme" style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(16px,4vw,24px) clamp(14px,4vw,26px) 60px' }}>
      <div className="sirka-hero">
        <SirkaMark />
        <h1
          style={{
            fontSize: 'clamp(26px, 7vw, 36px)',
            fontWeight: 800,
            margin: 0,
            color: 'var(--sirka-orange)',
            letterSpacing: '-.01em',
          }}
        >
          Sirka
        </h1>
        <span style={{ fontSize: 13.5, color: 'var(--text-faint)' }}>
          Drag kontak ke kolom status untuk mulai kelola deal
        </span>
      </div>

      <AiBriefing initialItems={initialBriefing.items} initialGeneratedAt={initialBriefing.generatedAt} />

      {staleDeals.length > 0 && (
        <div
          style={{
            background: 'var(--warn-bg)',
            border: '1px solid var(--warn-border)',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--warn-text)', marginBottom: 6 }}>
            ⚠️ {staleDeals.length} deal belum di-follow-up &gt;7 hari
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {staleDeals.map((c) => (
              <span
                key={c.id}
                style={{
                  fontSize: 11.5,
                  background: 'var(--panel)',
                  border: '1px solid var(--warn-border)',
                  color: 'var(--warn-text)',
                  padding: '3px 9px',
                  borderRadius: 100,
                }}
              >
                {c.nama} · {c.hariSejakChat}h
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="stats-grid" style={{ marginBottom: 20 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

      <div className="status-grid">
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

const STATUS_ORDER = ['todo', 'in_progress', 'done'] as const;
const STATUS_CONFIG: Record<(typeof STATUS_ORDER)[number], { label: string; color: string; bg: string }> = {
  todo: { label: 'Belum', color: 'var(--text-faint)', bg: 'var(--panel-2)' },
  in_progress: { label: 'On Progress', color: '#fff', bg: 'var(--orange)' },
  done: { label: 'Done', color: '#fff', bg: 'var(--green)' },
};

function AiBriefing({
  initialItems,
  initialGeneratedAt,
}: {
  initialItems: BriefingItem[] | null;
  initialGeneratedAt: string | null;
}) {
  const [items, setItems] = useState<BriefingItem[] | null>(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(initialGeneratedAt);

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai-briefing', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Gagal generate');
      setItems(data.items);
      setGeneratedAt(data.generatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal generate');
    } finally {
      setLoading(false);
    }
  }

  function cycleStatus(id: string) {
    if (!items) return;
    const next = items.map((it) =>
      it.id === id
        ? { ...it, status: STATUS_ORDER[(STATUS_ORDER.indexOf(it.status) + 1) % STATUS_ORDER.length] }
        : it
    );
    setItems(next);
    setError('');
    fetch('/api/ai-briefing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: next }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
      })
      .catch(() => setError('Gagal simpan status — cek koneksi, nanti coba klik lagi.'));
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, var(--panel) 0%, var(--panel-2) 100%)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>🤖 AI Briefing</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {generatedAt
              ? `Terakhir digenerate ${new Date(generatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
              : 'Belum pernah digenerate'}
          </div>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--panel)',
            color: 'var(--teal)',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Mikir…' : items ? '↻ Generate ulang' : '✨ Generate briefing hari ini'}
        </button>
      </div>

      {error && <p style={{ fontSize: 11.5, color: 'var(--red)', margin: '0 0 8px' }}>{error}</p>}

      {!items && !loading && !error && (
        <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
          Klik generate buat liat 5 hal yang perlu lo perhatiin hari ini, berdasarkan data kontak & task asli.
        </p>
      )}

      {items && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item) => {
            const done = item.status === 'done';
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: 18, lineHeight: 1, opacity: done ? 0.5 : 1 }}>{item.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: done ? 'var(--text-faint)' : 'var(--text)',
                        textDecoration: done ? 'line-through' : 'none',
                      }}
                    >
                      {item.title}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '.03em',
                        color: item.tag === 'AI' ? 'var(--teal)' : 'var(--text-faint)',
                        background: item.tag === 'AI' ? 'rgba(13,148,136,.12)' : 'var(--panel-2)',
                        padding: '1px 6px',
                        borderRadius: 100,
                      }}
                    >
                      {item.tag}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--text-faint)',
                      marginTop: 2,
                      textDecoration: done ? 'line-through' : 'none',
                    }}
                  >
                    {item.detail}
                  </div>
                </div>
                <button
                  onClick={() => cycleStatus(item.id)}
                  style={{
                    flexShrink: 0,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 100,
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    color: STATUS_CONFIG[item.status].color,
                    background: STATUS_CONFIG[item.status].bg,
                  }}
                >
                  {STATUS_CONFIG[item.status].label}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SirkaMark() {
  const dots = 12;
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" style={{ display: 'block', margin: '0 auto 12px' }}>
      {Array.from({ length: dots }).map((_, i) => {
        const angle = (i / dots) * Math.PI * 2;
        const r = 12;
        // Rounded to a fixed precision so the server-rendered string and the
        // client-computed number always serialize identically — raw
        // Math.cos/sin output can differ in the last float digit between
        // Node's SSR and the browser, which trips a hydration mismatch.
        const cx = Number((17 + r * Math.cos(angle)).toFixed(2));
        const cy = Number((17 + r * Math.sin(angle)).toFixed(2));
        const size = 1.5 + (i % 3) * 0.7;
        return <circle key={i} cx={cx} cy={cy} r={size} fill="var(--sirka-orange)" opacity={0.4 + (i % 4) * 0.15} />;
      })}
    </svg>
  );
}

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
