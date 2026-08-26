import { fetchAllTasks, AIRMOON_DATA_SOURCE_ID } from '@/lib/notion';
import TaskList from '@/components/TaskList';

export const revalidate = 30;

export default async function AirmoonPage() {
  const tasks = await fetchAllTasks(AIRMOON_DATA_SOURCE_ID);
  return (
    <div className="airmoon-theme" style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(16px,4vw,24px) clamp(14px,4vw,26px) 60px' }}>
      <div className="airmoon-hero">
        <div style={{ fontSize: 30, marginBottom: 8 }}>🌙</div>
        <h1
          style={{
            fontSize: 'clamp(26px, 7vw, 36px)',
            fontWeight: 800,
            margin: 0,
            color: '#fff',
            letterSpacing: '-.01em',
          }}
        >
          Airmoon
        </h1>
        <span style={{ fontSize: 13.5, color: 'var(--airmoon-accent)', fontWeight: 600 }}>Task list Airmoon</span>
      </div>

      <TaskList initialTasks={tasks} contacts={[]} apiBase="/api/airmoon-tasks" allowContactLink={false} />
    </div>
  );
}
