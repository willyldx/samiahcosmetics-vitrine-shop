export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, ADMIN_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }
  if (req.headers['x-admin-secret'] !== (ADMIN_SECRET || '')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let body = {};
  try { body = JSON.parse(req.body || '{}'); } catch { body = req.body || {}; }
  const products = Array.isArray(body.products) ? body.products : [];

  const rows = products.map(p => ({
    id: p.id,
    title: p.title,
    price: p.price,
    currency: p.currency || 'XAF',
    category: p.category || null,
    short_description: p.shortDescription || null,
    image: p.image || null,
    cities: Array.isArray(p.cities) ? p.cities : [],
    active: p.active !== false,
    expires_after_days: (p.expiresAfterDays ?? null),
    published_at: p.publishedAt || new Date().toISOString(),
    // created_at: laissé au défaut côté DB si la colonne existe
  }));

  const h = {
    'apikey': SUPABASE_SERVICE_ROLE,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    // upsert sur la pk id
    'Prefer': 'resolution=merge-duplicates'
  };

  const url = `${SUPABASE_URL}/rest/v1/products?on_conflict=id`;
  const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(rows) });
  const data = await r.json().catch(() => ({}));

  if (!r.ok) return res.status(r.status).json({ error: data?.message || 'save failed' });

  res.status(200).json({ ok: true, count: Array.isArray(data) ? data.length : rows.length });
}
