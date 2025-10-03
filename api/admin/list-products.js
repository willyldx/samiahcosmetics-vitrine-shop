export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, ADMIN_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }
  // Auth simple admin
  if (req.headers['x-admin-secret'] !== (ADMIN_SECRET || '')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const h = {
    'apikey': SUPABASE_SERVICE_ROLE,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`,
  };

  // ordre par published_at puis created_at si présent
  const qs =
    'select=*&order=published_at.desc.nullslast,created_at.desc.nullslast';

  const url = `${SUPABASE_URL}/rest/v1/products?${qs}`;
  const r = await fetch(url, { headers: h });
  const data = await r.json();

  if (!r.ok) return res.status(r.status).json({ error: data?.message || 'fetch failed' });

  // map vers camelCase pour l’admin
  const items = (data || []).map(row => ({
    id: row.id,
    title: row.title,
    price: row.price,
    currency: row.currency,
    category: row.category,
    shortDescription: row.short_description || '',
    image: row.image || '',
    cities: row.cities || [],
    active: row.active !== false,
    expiresAfterDays: row.expires_after_days ?? null,
    publishedAt: row.published_at || null,
  }));

  res.status(200).json({ items });
}
