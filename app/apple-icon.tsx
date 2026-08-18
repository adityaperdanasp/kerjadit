import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
        <div style={{ display: 'flex', fontSize: 112, transform: 'rotate(-10deg)' }}>💸</div>
      </div>
    ),
    { ...size }
  );
}
