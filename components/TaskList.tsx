'use client';

import { useMemo, useState } from 'react';
import type { Task } from '@/lib/notion';

async function apiCreate(text: string, group: string): Promise<Task | null> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, group }),
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
  const [draftGroup, setDraftGroup] = useState('');
  const [draftText, setDraftText] = useState('');
  const [adding, setAdding] = useState(false);

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!map.has(t.group)) {
        map.set(t.group, []);
        order.push(t.group);
      }
      map.get(t.group)!.push(t);
    }
    return order.map((g) => ({ group: g, items: map.get(g)! }));
  }, [tasks]);

  const existingGroups = useMemo(() => Array.from(new Set(tasks.map((t) => t.group))), [tasks]);

  async function handleAdd() {
    const group = draftGroup.trim();
    const text = draftText.trim();
    if (!group || !text || adding) return;
    setAdding(true);
    setDraftText('');
    const task = await apiCreate(text, group);
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
        padding: 18,
        marginTop: 20,
      }}
    >
      <h2
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '.05em',
          color: 'var(--text-faint)',
          margin: '0 0 14px',
          fontWeight: 700,
        }}
      >
        Task
      </h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          value={draftGroup}
          onChange={(e) => setDraftGroup(e.target.value)}
          placeholder="Klien / project…"
          list="task-group-options"
          style={{
            width: 200,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 13,
          }}
        />
        <datalist id="task-group-options">
          {existingGroups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <input
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder="Task baru…"
          style={{
            flex: 1,
            minWidth: 180,
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

      {groups.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Belum ada task.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {groups.map(({ group, items }) => (
          <div key={group}>
            <h3
              style={{
                fontSize: 14.5,
                fontWeight: 800,
                margin: '0 0 6px',
                color: 'var(--text)',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              {group}
            </h3>
            <ol style={{ margin: 0, paddingLeft: 22, listStyle: 'decimal' }}>
              {items.map((t) => (
                <li key={t.id} style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13.5,
                        color: t.done ? 'var(--text-faint)' : 'var(--text)',
                        textDecoration: t.done ? 'line-through' : 'none',
                        lineHeight: 1.5,
                      }}
                    >
                      {t.text}
                    </span>
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={(e) => toggleDone(t.id, e.target.checked)}
                      style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0, marginTop: 3 }}
                    />
                    <button
                      onClick={() => removeTask(t.id)}
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
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
