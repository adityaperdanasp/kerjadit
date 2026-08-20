import { NextResponse } from 'next/server';
import {
  fetchAllContacts,
  fetchAllTasks,
  fetchAiBriefing,
  saveAiBriefing,
  updateBriefingItems,
  type BriefingItem,
} from '@/lib/notion';
import { sumopodChat } from '@/lib/sumopod';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const briefing = await fetchAiBriefing();
  return NextResponse.json({ ok: true, ...briefing });
}

export async function PATCH(request: Request) {
  const { items } = await request.json();
  if (!Array.isArray(items)) {
    return NextResponse.json({ ok: false, error: 'items harus array' }, { status: 400 });
  }
  try {
    await updateBriefingItems(items as BriefingItem[]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST() {
  try {
    const [contacts, tasks] = await Promise.all([fetchAllContacts(), fetchAllTasks()]);
    const today = todayStr();

    const staleDeals = contacts
      .filter((c) => (c.statusDeal === 'Hot' || c.statusDeal === 'Warm') && (c.hariSejakChat ?? 0) > 7)
      .sort((a, b) => (b.hariSejakChat ?? 0) - (a.hariSejakChat ?? 0))
      .slice(0, 6)
      .map((c) => ({ nama: c.nama, perusahaan: c.perusahaan, status: c.statusDeal, hariSejakChat: c.hariSejakChat }));

    const overdueTasks = tasks
      .filter((t) => !t.done && t.dueDate && t.dueDate < today)
      .slice(0, 6)
      .map((t) => ({ text: t.text, group: t.group, dueDate: t.dueDate }));

    const pendingTasks = tasks
      .filter((t) => !t.done)
      .slice(0, 8)
      .map((t) => ({ text: t.text, group: t.group }));

    const coldProspects = contacts
      .filter((c) => !c.statusDeal)
      .sort((a, b) => (b.hariSejakChat ?? 0) - (a.hariSejakChat ?? 0))
      .slice(0, 8)
      .map((c) => ({ nama: c.nama, perusahaan: c.perusahaan, industri: c.industri, hariSejakChat: c.hariSejakChat }));

    const lostWithContext = contacts
      .filter((c) => c.statusDeal === 'Lost' && (c.ringkasan || c.saran))
      .slice(0, 5)
      .map((c) => ({ nama: c.nama, perusahaan: c.perusahaan, ringkasan: c.ringkasan, saran: c.saran }));

    const digest = { staleDeals, overdueTasks, pendingTasks, coldProspects, lostWithContext };

    const prompt = `Kamu asisten CRM buat sales B2B di Indonesia. Berdasarkan data JSON di bawah (data asli dari CRM, bukan contoh), buatkan TEPAT 5 poin "yang harus dikerjain hari ini", prioritas paling penting duluan.

ATURAN PENTING:
- Jawab HANYA dengan JSON array, tanpa teks lain, tanpa markdown code fence.
- Tiap item: {"icon": emoji, "tag": "DATA" atau "AI", "title": string singkat (maks 12 kata), "detail": string 1 kalimat}
- Tag "DATA" kalau item itu murni fakta dari data yang dikasih (contoh: follow-up klien spesifik, task spesifik yang masih pending).
- Tag "AI" kalau item itu saran/ide hasil analisis kamu (contoh: saran program alternatif, sudut obrolan, strategi outreach).
- JANGAN pernah mengarang berita, kebijakan, atau kejadian spesifik seolah itu fakta terkini — kamu tidak punya akses internet. Kalau mau saran "riset dulu", bilang sebagai topik yang worth dicari tau, bukan klaim berita yang udah terjadi.
- SEBUT nama klien/task asli dari data kalau ada (jangan generik) — data ini dari CRM sungguhan, prioritaskan spesifik daripada generik.
- Kalau staleDeals/overdueTasks kosong, itu artinya emang lagi gak ada — jangan dianggap "tidak ada data", tapi manfaatkan pendingTasks/coldProspects/lostWithContext buat ngisi 5 poinnya.
- Bahasa Indonesia santai, kayak chat ke temen kerja, bukan formal.

DATA (staleDeals = deal Hot/Warm belum di-follow >7 hari, overdueTasks = task lewat deadline, pendingTasks = task yang belum selesai, coldProspects = kontak belum masuk pipeline diurutkan paling lama gak dichat, lostWithContext = deal yang lost beserta ringkasan/alasan):
${JSON.stringify(digest, null, 2)}`;

    const raw = await sumopodChat(prompt);
    const cleaned = raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    const rawItems = JSON.parse(cleaned);

    if (!Array.isArray(rawItems)) throw new Error('Model tidak mengembalikan array');

    const items: BriefingItem[] = rawItems.map((it, i) => ({
      id: `${Date.now()}-${i}`,
      icon: it.icon,
      tag: it.tag,
      title: it.title,
      detail: it.detail,
      status: 'todo',
    }));

    const generatedAt = new Date().toISOString();
    await saveAiBriefing(items, generatedAt);

    return NextResponse.json({ ok: true, items, generatedAt });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
