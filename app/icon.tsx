import { ImageResponse } from 'next/og';

export const size = { width: 128, height: 128 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 32% 26%, #2dd4bf 0%, #0d9488 52%, #0f5f57 100%)',
          borderRadius: 30,
          boxShadow: '0 10px 20px rgba(6,60,54,0.55), inset 0 2px 2px rgba(255,255,255,.25)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '55%',
            borderRadius: '30px 30px 60px 60px',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 100%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            display: 'flex',
            fontSize: 76,
            transform: 'rotate(-10deg)',
            filter: 'drop-shadow(0 6px 6px rgba(0,0,0,.35))',
          }}
        >
          💸
        </div>
      </div>
    ),
    { ...size }
  );
}
