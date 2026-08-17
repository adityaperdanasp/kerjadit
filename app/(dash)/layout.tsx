import TabSwitcher from '@/components/TabSwitcher';

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TabSwitcher />
      {children}
    </>
  );
}
