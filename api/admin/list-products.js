export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if ((req.headers['x-admin-secret'] || '') !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE;
  if (!base || !key) return res.status(500).json({ error: 'Supabase env missing' });

  const url = `${base}/rest/v1/products?select=*&order=published_at.desc`;
  const r = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const data = await r.json().catch(()=>[]);
  if (!r.ok) return res.status(r.status).json(data);

  const items = data.map(p => ({
    id: p.id, title: p.title, price: p.price, currency: p.currency || 'XAF',
    category: p.category || '', shortDescription: p.short_description || '',
    image: p.image || '', cities: Array.isArray(p.cities)?p.cities:[],
    active: p.active !== false,
    publishedAt: p.published_at || null,
    expiresAfterDays: p.expires_after_days ?? null
  }));
  res.status(200).json({ items });
}
