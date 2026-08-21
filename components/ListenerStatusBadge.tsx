'use client';

import { useEffect, useState } from 'react';

const HEARTBEAT_STALE_AFTER_MS = 10 * 60 * 1000;
// A working listener should see at least one message across all contacts well within
// a day — this catches the "socket looks connected but every message silently fails
// to decrypt" failure mode, which a heartbeat-only check can't (see 2026-08-21 incident:
// heartbeat stayed green for a week while message capture was actually dead).
const MESSAGE_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

type Status = { lastHeartbeat: string | null; lastMessageCaptured: string | null };

export default function ListenerStatusBadge() {
  const [status, setStatus] = useState<Status | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/listener-status');
        const data = await res.json();
        if (!cancelled) setStatus({ lastHeartbeat: data.lastHeartbeat, lastMessageCaptured: data.lastMessageCaptured });
      } catch {
        if (!cancelled) setStatus({ lastHeartbeat: null, lastMessageCaptured: null });
      }
    }
    load();
    const interval = setInterval(load, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (status === undefined) return null;

  const { lastHeartbeat, lastMessageCaptured } = status;
  const heartbeatAlive = !!lastHeartbeat && Date.now() - new Date(lastHeartbeat).getTime() < HEARTBEAT_STALE_AFTER_MS;
  const messageFresh =
    !!lastMessageCaptured && Date.now() - new Date(lastMessageCaptured).getTime() < MESSAGE_STALE_AFTER_MS;

  let label: string;
  let dotColor: string;
  let tone: string;
  if (!heartbeatAlive) {
    label = lastHeartbeat ? 'WA mati' : 'WA ?';
    dotColor = 'var(--red)';
    tone = 'var(--text-dim)';
  } else if (!messageFresh) {
    label = 'WA bermasalah';
    dotColor = 'var(--orange)';
    tone = 'var(--warn-text)';
  } else {
    label = 'WA aktif';
    dotColor = 'var(--green)';
    tone = 'var(--text-dim)';
  }

  const titleLines = [
    lastHeartbeat ? `Heartbeat terakhir: ${new Date(lastHeartbeat).toLocaleString('id-ID')}` : 'Belum ada heartbeat',
    lastMessageCaptured
      ? `Pesan terakhir ke-capture: ${new Date(lastMessageCaptured).toLocaleString('id-ID')}`
      : 'Belum ada pesan ke-capture',
  ];

  return (
    <span
      title={titleLines.join('\n')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 700,
        background: 'var(--panel-2)',
        color: tone,
        border: '1px solid var(--border)',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: dotColor,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
