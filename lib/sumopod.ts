const SUMOPOD_BASE_URL = 'https://ai.sumopod.com/v1';
const MODEL = 'claude-haiku-4-5';

export async function sumopodChat(prompt: string): Promise<string> {
  const res = await fetch(`${SUMOPOD_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUMOPOD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Sumopod error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
