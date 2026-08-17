'use client';

import { useState } from 'react';
import type { Task } from '@/lib/notion';

async function apiCreate(text: string): Promise<Task | null> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  return data.ok ? data.task : null;
}

async function apiUpdate(id: string, fields: Record<string, unknown>) {
  await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
}

async function apiDelete(id: string) {
  await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
}

export default function TaskList({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    const text = draft.trim();
    if (!text || adding) return;
    setAdding(true);
    setDraft('');
    const task = await apiCreate(text);
    if (task) setTasks((prev) => [...prev, task]);
    setAdding(false);
  }

  function toggleDone(id: string, done: boolean) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
    apiUpdate(id, { done });
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    apiDelete(id);
  }

  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 16,
        marginTop: 20,
      }}
    >
      <h2
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '.05em',
          color: 'var(--text-faint)',
          margin: '0 0 12px',
          fontWeight: 700,
        }}
      >
        Task
      </h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder="Tambah task baru…"
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 13,
          }}
        />
        <button
          onClick={handleAdd}
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

      {tasks.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Belum ada task.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {tasks.map((t) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 4px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <input
              type="checkbox"
              checked={t.done}
              onChange={(e) => toggleDone(t.id, e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
            />
            <span
              style={{
                flex: 1,
                fontSize: 13.5,
                color: t.done ? 'var(--text-faint)' : 'var(--text)',
                textDecoration: t.done ? 'line-through' : 'none',
              }}
            >
              {t.text}
            </span>
            <button
              onClick={() => removeTask(t.id)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-faint)',
                cursor: 'pointer',
                fontSize: 13,
                padding: '2px 6px',
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
