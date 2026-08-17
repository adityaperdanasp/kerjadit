'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/sirka', label: 'Sirka' },
  { href: '/mbg', label: 'MBG' },
];

export default function TabSwitcher() {
  const pathname = usePathname();

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '18px 26px 0' }}>
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)' }}>
        {TABS.map((tab) => {
          const active = pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                color: active ? 'var(--text)' : 'var(--text-faint)',
                borderBottom: active ? '2px solid var(--text)' : '2px solid transparent',
                marginBottom: -1,
                textDecoration: 'none',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
