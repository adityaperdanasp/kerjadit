import { fetchAllTasks, FISIOTERAPI_DATA_SOURCE_ID } from '@/lib/notion';
import TaskList from '@/components/TaskList';

export const revalidate = 30;

export default async function FisioterapiPage() {
  const tasks = await fetchAllTasks(FISIOTERAPI_DATA_SOURCE_ID);
  return (
    <div className="fisioterapi-theme" style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(16px,4vw,24px) clamp(14px,4vw,26px) 60px' }}>
      <div className="fisioterapi-hero">
        <div className="fisioterapi-badge">Pulih Fisioterapi</div>
        <h1
          style={{
            fontSize: 'clamp(26px, 7vw, 36px)',
            fontWeight: 800,
            margin: 0,
            color: 'var(--fisio-navy)',
            letterSpacing: '-.01em',
          }}
        >
          Fisioterapi
        </h1>
        <span style={{ fontSize: 13.5, color: 'var(--fisio-teal)', fontWeight: 600 }}>Task list Fisioterapi</span>
      </div>

      <TaskList initialTasks={tasks} contacts={[]} apiBase="/api/fisioterapi-tasks" allowContactLink={false} />
    </div>
  );
}
