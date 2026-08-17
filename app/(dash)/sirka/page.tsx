import { fetchAllContacts } from '@/lib/notion';
import Board from '@/components/Board';

export const revalidate = 30;

export default async function SirkaPage() {
  const contacts = await fetchAllContacts();
  return <Board initialContacts={contacts} />;
}
