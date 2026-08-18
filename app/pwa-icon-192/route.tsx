import { ImageResponse } from 'next/og';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 32% 26%, #2dd4bf 0%, #0d9488 52%, #0f5f57 100%)',
        }}
      >
        <div style={{ display: 'flex', fontSize: 118, transform: 'rotate(-10deg)' }}>💸</div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
