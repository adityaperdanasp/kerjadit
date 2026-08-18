'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = '/';
    } else {
      setError('Password salah.');
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--body-gradient), var(--bg)',
        fontFamily: 'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--panel)',
          borderRadius: 16,
          padding: '32px 28px',
          width: 320,
          boxShadow: '0 8px 30px rgba(0,0,0,.08)',
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px', color: 'var(--text)' }}>
          Pipeline B2B
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', margin: '0 0 20px' }}>
          Masukkan password untuk lanjut
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--panel)',
            color: 'var(--text)',
            fontSize: 14,
            marginBottom: 12,
          }}
        />
        {error && <p style={{ color: 'var(--red)', fontSize: 12.5, margin: '0 0 12px' }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--teal)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Memeriksa…' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}
