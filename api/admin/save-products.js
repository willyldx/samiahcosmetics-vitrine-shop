export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if ((req.headers['x-admin-secret'] || '') !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE;
  if (!base || !key) return res.status(500).json({ error: 'Supabase env missing' });

  let body; try { body = await readJson(req); } catch { return res.status(400).json({ error: 'JSON invalide' }); }
  const arr = Array.isArray(body?.products) ? body.products : [];
  if (!arr.length) return res.status(400).json({ error: 'products[] requis' });

  const rows = arr.map(p => ({
    id: p.id,
    title: p.title,
    price: p.price,
    currency: p.currency ?? 'XAF',
    category: p.category ?? null,
    short_description: p.shortDescription ?? null,
    image: p.image ?? null,
    cities: Array.isArray(p.cities) ? p.cities : [],
    active: p.active !== false,
    published_at: p.publishedAt ?? new Date().toISOString(),
    expires_after_days: (typeof p.expiresAfterDays === 'number') ? p.expiresAfterDays : null
  }));

  const url = `${base}/rest/v1/products?on_conflict=id`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(rows)
  });
  const out = await r.json().catch(()=>null);
  if (!r.ok) return res.status(r.status).json(out || { error: 'Upsert failed' });
  res.status(200).json({ ok: true, count: out?.length ?? null });
}
function readJson(req){ return new Promise((resolve,reject)=>{ let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{ resolve(JSON.parse(d||'{}')); }catch(e){ reject(e); } }); }); }
