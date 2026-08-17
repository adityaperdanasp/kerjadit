import { fetchAllContacts, fetchAllTasks } from '@/lib/notion';
import Board from '@/components/Board';
import TaskList from '@/components/TaskList';

export const revalidate = 30;

export default async function SirkaPage() {
  const [contacts, tasks] = await Promise.all([fetchAllContacts(), fetchAllTasks()]);
  return (
    <>
      <Board initialContacts={contacts} />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 26px 60px' }}>
        <TaskList initialTasks={tasks} />
      </div>
    </>
  );
}
