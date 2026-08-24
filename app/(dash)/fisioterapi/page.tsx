import { fetchAllTasks, FISIOTERAPI_DATA_SOURCE_ID } from '@/lib/notion';
import TaskList from '@/components/TaskList';

export const revalidate = 30;

export default async function FisioterapiPage() {
  const tasks = await fetchAllTasks(FISIOTERAPI_DATA_SOURCE_ID);
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
          Fisioterapi
        </h1>
        <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>Task list Fisioterapi</span>
      </div>

      <TaskList initialTasks={tasks} contacts={[]} apiBase="/api/fisioterapi-tasks" allowContactLink={false} />
    </div>
  );
}
