import { fetchSpmData, fetchPettyCash, fetchFinancialStatement, fetchPendingJobs } from '@/lib/sheets';
import MbgTabs from '@/components/MbgTabs';

export const revalidate = 30;

export default async function MbgPage() {
  const [spmGroups, pettyCash, financialStatement, pendingJob] = await Promise.all([
    fetchSpmData(),
    fetchPettyCash(),
    fetchFinancialStatement(),
    fetchPendingJobs(),
  ]);

  return (
    <div className="mbg-theme" style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(16px,4vw,24px) clamp(14px,4vw,26px) 60px' }}>
      <div className="mbg-hero" style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--mbg-accent-a), var(--mbg-accent-b))',
            margin: '0 auto 14px',
          }}
        />
        <h1
          style={{
            fontSize: 'clamp(26px, 7vw, 36px)',
            fontWeight: 800,
            margin: 0,
            color: 'var(--text)',
            letterSpacing: '-.01em',
          }}
        >
          MBG
        </h1>
        <span style={{ fontSize: 13.5, color: 'var(--mbg-accent-text)', fontWeight: 600 }}>
          SPM &amp; Petty Cash — SPPG Cengkareng Timur 2
        </span>
      </div>

      <MbgTabs
        spmGroups={spmGroups}
        pettyCash={pettyCash}
        financialStatement={financialStatement}
        pendingJob={pendingJob}
      />
    </div>
  );
}
