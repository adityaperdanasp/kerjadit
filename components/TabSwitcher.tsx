'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

const TABS = [
  { href: '/sirka', label: 'Sirka' },
  { href: '/mbg', label: 'MBG' },
];

export default function TabSwitcher() {
  const pathname = usePathname();

  return (
    <div
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '18px 26px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          gap: 2,
          background: 'var(--panel-2)',
          borderRadius: 999,
          padding: 3,
        }}
      >
        {TABS.map((tab) => {
          const active = pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: '6px 18px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 999,
                color: active ? 'var(--text)' : 'var(--text-faint)',
                background: active ? 'var(--panel)' : 'transparent',
                boxShadow: active ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                textDecoration: 'none',
                transition: 'background .15s, color .15s',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <ThemeToggle />
    </div>
  );
}
