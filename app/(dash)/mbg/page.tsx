import { fetchSpmData, fetchPettyCash, fetchFinancialStatement } from '@/lib/sheets';
import MbgTabs from '@/components/MbgTabs';

export const revalidate = 30;

export default async function MbgPage() {
  const [spmGroups, pettyCash, financialStatement] = await Promise.all([
    fetchSpmData(),
    fetchPettyCash(),
    fetchFinancialStatement(),
  ]);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(16px,4vw,24px) clamp(14px,4vw,26px) 60px' }}>
      <div style={{ marginBottom: 22, textAlign: 'center' }}>
        <h1
          style={{
            fontSize: 'clamp(22px, 6vw, 30px)',
            fontWeight: 800,
            margin: 0,
            color: 'var(--text)',
            letterSpacing: '-.01em',
          }}
        >
          MBG
        </h1>
        <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>
          SPM &amp; Petty Cash — SPPG Cengkareng Timur 2
        </span>
      </div>

      <MbgTabs spmGroups={spmGroups} pettyCash={pettyCash} financialStatement={financialStatement} />
    </div>
  );
}
