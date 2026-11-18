import { getStore } from "@netlify/blobs";

const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const int = (v, min, max) => { v = Math.floor(Number(v)); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min; };
const str = (v, n) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").slice(0, n);

export default async (req) => {
  const store = getStore({ name: "hogoneko-ranking", consistency: "strong" });
  const board = (await store.get("board", { type: "json" })) || {};

  if (req.method === "GET") {
    return json(Object.entries(board).map(([id, e]) => ({ id, ...e.d })));
  }
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const id = str(b.id, 40), key = String(b.key || "");
  if (!/^[a-z0-9-]{16,40}$/.test(id) || key.length < 16 || key.length > 80) return json({ error: "bad id" }, 400);

  const h = await sha(key), cur = board[id];
  if (cur && cur.h !== h) return json({ error: "forbidden" }, 403);
  if (!cur && Object.keys(board).length >= 3000) return json({ error: "full" }, 507);

  const d = b.data || {};
  board[id] = {
    h,
    d: {
      house: str(d.house, 14) || "保護ねこハウス",
      title: str(d.title, 20),
      allDay: int(d.allDay, 0, 100000),
      kinds: int(d.kinds, 0, 100),
      total: int(d.total, 0, 100),
      adopted: int(d.adopted, 0, 10000),
      donatedCats: int(d.donatedCats, 0, 1000000),
      day: int(d.day, 0, 100000),
      at: Date.now(),
    },
  };
  await store.setJSON("board", board);
  return json({ ok: true });
};

export const config = { path: "/api/ranking" };
