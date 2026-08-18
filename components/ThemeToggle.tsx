'use client';

import { useLayoutEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // Re-apply after React's dev-mode Strict Mode remount clears the
  // attribute the inline script set; no-op in production.
  useLayoutEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'var(--panel-2)',
        color: 'var(--text)',
        cursor: 'pointer',
        fontSize: 15,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
