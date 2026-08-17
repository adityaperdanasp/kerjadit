export default function MbgPage() {
  return (
    <div
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '24px 26px 60px',
      }}
    >
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '60px 20px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
          MBG
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 8 }}>
          Coming soon.
        </p>
      </div>
    </div>
  );
}
