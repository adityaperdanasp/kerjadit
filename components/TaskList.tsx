'use client';

import { useMemo, useState } from 'react';
import type { Contact, Task } from '@/lib/notion';

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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function TaskList({
  initialTasks,
  contacts,
}: {
  initialTasks: Task[];
  contacts: Contact[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [draftGroup, setDraftGroup] = useState('');
  const [draftText, setDraftText] = useState('');
  const [adding, setAdding] = useState(false);

  const contactsById = useMemo(() => {
    const m = new Map<string, Contact>();
    for (const c of contacts) m.set(c.id, c);
    return m;
  }, [contacts]);

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

  function patchLocal(id: string, fields: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)));
  }

  function handleFieldChange(id: string, fields: Record<string, unknown>) {
    patchLocal(id, fields as Partial<Task>);
    apiUpdate(id, fields);
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
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
                <TaskItem
                  key={t.id}
                  task={t}
                  contact={t.contactId ? contactsById.get(t.contactId) : undefined}
                  contacts={contacts}
                  onFieldChange={handleFieldChange}
                  onRemove={removeTask}
                />
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskItem({
  task,
  contact,
  contacts,
  onFieldChange,
  onRemove,
}: {
  task: Task;
  contact?: Contact;
  contacts: Contact[];
  onFieldChange: (id: string, fields: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
}) {
  const [text, setText] = useState(task.text);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const overdue = !!task.dueDate && !task.done && task.dueDate < todayStr();

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return contacts.filter((c) => c.nama.toLowerCase().includes(q)).slice(0, 8);
  }, [query, contacts]);

  return (
    <li style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text.trim() && text !== task.text) onFieldChange(task.id, { text: text.trim() });
          }}
          style={{
            width: '100%',
            fontSize: 13.5,
            border: '1px solid transparent',
            borderRadius: 6,
            padding: '2px 4px',
            background: 'transparent',
            color: task.done ? 'var(--text-faint)' : 'var(--text)',
            textDecoration: task.done ? 'line-through' : 'none',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Due</span>
            <input
              type="date"
              value={task.dueDate || ''}
              onChange={(e) => onFieldChange(task.id, { dueDate: e.target.value || null })}
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
            checked={task.done}
            onChange={(e) => onFieldChange(task.id, { done: e.target.checked })}
            style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
          />
          <button
            onClick={() => onRemove(task.id)}
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

      <div style={{ marginTop: 3 }}>
        {contact ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              background: 'var(--panel-2)',
              color: 'var(--text-dim)',
              padding: '2px 8px',
              borderRadius: 100,
            }}
          >
            🔗 {contact.nama}
            {contact.hariSejakChat != null && (
              <span style={{ color: 'var(--text-faint)' }}>· {contact.hariSejakChat}h</span>
            )}
            <span
              onClick={() => onFieldChange(task.id, { contactId: null })}
              style={{ cursor: 'pointer', marginLeft: 2 }}
            >
              ✕
            </span>
          </span>
        ) : pickerOpen ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
              placeholder="Cari kontak…"
              style={{
                fontSize: 11.5,
                padding: '3px 6px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                width: 180,
              }}
            />
            {matches.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  zIndex: 10,
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  marginTop: 2,
                  width: 220,
                  maxHeight: 180,
                  overflowY: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,.08)',
                }}
              >
                {matches.map((c) => (
                  <div
                    key={c.id}
                    onMouseDown={() => {
                      onFieldChange(task.id, { contactId: c.id });
                      setPickerOpen(false);
                      setQuery('');
                    }}
                    style={{
                      padding: '6px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {c.nama}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setPickerOpen(true)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-faint)',
              cursor: 'pointer',
              fontSize: 11,
              padding: 0,
            }}
          >
            + link kontak
          </button>
        )}
      </div>
    </li>
  );
}
