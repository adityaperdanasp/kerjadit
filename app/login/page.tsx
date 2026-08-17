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
        background:
          'radial-gradient(1100px 520px at -8% -12%, #cdeee6 0%, transparent 55%), radial-gradient(1000px 500px at 108% 6%, #ffe1c2 0%, transparent 52%), #f4f6f9',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '32px 28px',
          width: 320,
          boxShadow: '0 8px 30px rgba(0,0,0,.08)',
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px', color: '#12172a' }}>
          Pipeline B2B
        </h1>
        <p style={{ fontSize: 12.5, color: '#8b93a8', margin: '0 0 20px' }}>
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
            border: '1px solid #dde2ea',
            fontSize: 14,
            marginBottom: 12,
          }}
        />
        {error && <p style={{ color: '#d6432b', fontSize: 12.5, margin: '0 0 12px' }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: '#0d9488',
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
