'use client';

import { useEffect, useState } from 'react';

const STALE_AFTER_MS = 10 * 60 * 1000;

export default function ListenerStatusBadge() {
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/listener-status');
        const data = await res.json();
        if (!cancelled) setLastHeartbeat(data.lastHeartbeat);
      } catch {
        if (!cancelled) setLastHeartbeat(null);
      }
    }
    load();
    const interval = setInterval(load, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (lastHeartbeat === undefined) return null;

  const alive = !!lastHeartbeat && Date.now() - new Date(lastHeartbeat).getTime() < STALE_AFTER_MS;
  const label = alive ? 'WA aktif' : lastHeartbeat ? 'WA mati' : 'WA ?';

  return (
    <span
      title={lastHeartbeat ? `Heartbeat terakhir: ${new Date(lastHeartbeat).toLocaleString('id-ID')}` : 'Belum ada heartbeat'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 700,
        background: 'var(--panel-2)',
        color: 'var(--text-dim)',
        border: '1px solid var(--border)',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: alive ? 'var(--green)' : 'var(--red)',
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
