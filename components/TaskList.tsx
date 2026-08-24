'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Contact, Task } from '@/lib/notion';

async function apiCreate(apiBase: string, text: string, group: string): Promise<Task | null> {
  const res = await fetch(apiBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, group }),
  });
  const data = await res.json();
  return data.ok ? data.task : null;
}

async function apiUpdate(apiBase: string, id: string, fields: Record<string, unknown>) {
  await fetch(`${apiBase}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
}

async function apiDelete(apiBase: string, id: string) {
  await fetch(`${apiBase}/${id}`, { method: 'DELETE' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function TaskList({
  initialTasks,
  contacts,
  apiBase = '/api/tasks',
  allowContactLink = true,
}: {
  initialTasks: Task[];
  contacts: Contact[];
  apiBase?: string;
  allowContactLink?: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [draftGroup, setDraftGroup] = useState('');
  const [draftText, setDraftText] = useState('');
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [addError, setAddError] = useState('');

  const contactsById = useMemo(() => {
    const m = new Map<string, Contact>();
    for (const c of contacts) m.set(c.id, c);
    return m;
  }, [contacts]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? tasks.filter((t) => t.text.toLowerCase().includes(q) || t.group.toLowerCase().includes(q))
      : tasks;
    const order: string[] = [];
    const map = new Map<string, Task[]>();
    for (const t of filtered) {
      if (!map.has(t.group)) {
        map.set(t.group, []);
        order.push(t.group);
      }
      map.get(t.group)!.push(t);
    }
    return order.map((g) => ({ group: g, items: map.get(g)! }));
  }, [tasks, search]);

  const existingGroups = useMemo(() => Array.from(new Set(tasks.map((t) => t.group))), [tasks]);

  async function addTask(group: string, text: string) {
    const g = group.trim();
    const t = text.trim();
    if (!g || !t) return false;
    const task = await apiCreate(apiBase, t, g);
    if (task) setTasks((prev) => [...prev, task]);
    return !!task;
  }

  async function handleAdd() {
    const group = draftGroup.trim();
    const text = draftText.trim();
    if (adding) return;
    if (!group || !text) {
      setAddError(!group ? 'Isi nama klien / project dulu.' : 'Isi task-nya dulu.');
      return;
    }
    setAddError('');
    setAdding(true);
    setDraftText('');
    await addTask(group, text);
    setAdding(false);
  }

  function patchLocal(id: string, fields: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)));
  }

  function handleFieldChange(id: string, fields: Record<string, unknown>) {
    patchLocal(id, fields as Partial<Task>);
    apiUpdate(apiBase, id, fields);
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    apiDelete(apiBase, id);
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
          Task
        </h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari task / klien…"
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
        <GroupPicker
          value={draftGroup}
          onChange={(v) => {
            setDraftGroup(v);
            if (addError) setAddError('');
          }}
          existingGroups={existingGroups}
          error={addError.includes('klien')}
        />
        <input
          value={draftText}
          onChange={(e) => {
            setDraftText(e.target.value);
            if (addError) setAddError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder="Task baru…"
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

      {addError && (
        <p style={{ fontSize: 11.5, color: 'var(--red)', margin: '0 0 12px' }}>{addError}</p>
      )}

      {groups.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          {search.trim() ? 'Nggak ada task yang cocok.' : 'Belum ada task.'}
        </p>
      )}

      <div className="task-groups">
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
                  allowContactLink={allowContactLink}
                  onFieldChange={handleFieldChange}
                  onRemove={removeTask}
                />
              ))}
            </ol>
            <QuickAddTask group={group} onAdd={(text) => addTask(group, text)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickAddTask({
  group,
  onAdd,
}: {
  group: string;
  onAdd: (text: string) => Promise<boolean>;
}) {
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

function TaskItem({
  task,
  contact,
  contacts,
  allowContactLink,
  onFieldChange,
  onRemove,
}: {
  task: Task;
  contact?: Contact;
  contacts: Contact[];
  allowContactLink: boolean;
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
        <div className="task-item-scroll">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              if (text.trim() && text !== task.text) onFieldChange(task.id, { text: text.trim() });
            }}
            style={{
              display: 'block',
              fontSize: 13.5,
              border: '1px solid transparent',
              borderRadius: 6,
              padding: '2px 4px',
              background: 'transparent',
              color: task.done ? 'var(--text-faint)' : 'var(--text)',
              textDecoration: task.done ? 'line-through' : 'none',
            }}
          />
        </div>
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

      {allowContactLink && (
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
      )}
    </li>
  );
}

function GroupPicker({
  value,
  onChange,
  existingGroups,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  existingGroups: string[];
  error: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const q = value.trim().toLowerCase();
  const matches = existingGroups.filter((g) => g.toLowerCase().includes(q));
  const exactMatch = existingGroups.some((g) => g.toLowerCase() === q);
  const showCreateOption = value.trim() && !exactMatch;

  return (
    <div ref={ref} style={{ position: 'relative', width: 200 }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Pilih atau ketik klien baru…"
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 8,
          border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
          fontSize: 13,
        }}
      />
      {open && (matches.length > 0 || showCreateOption) && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 20,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {showCreateOption && (
            <div
              onMouseDown={() => setOpen(false)}
              style={{
                padding: '8px 10px',
                fontSize: 12.5,
                fontWeight: 700,
                color: 'var(--teal)',
                cursor: 'pointer',
                borderBottom: matches.length > 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              + Buat klien baru: &ldquo;{value.trim()}&rdquo;
            </div>
          )}
          {matches.map((g) => (
            <div
              key={g}
              onMouseDown={() => {
                onChange(g);
                setOpen(false);
              }}
              style={{
                padding: '8px 10px',
                fontSize: 12.5,
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              {g}
            </div>
          ))}
          {matches.length === 0 && !showCreateOption && (
            <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-faint)' }}>
              Belum ada klien.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
