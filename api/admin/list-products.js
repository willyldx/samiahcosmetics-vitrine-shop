export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, ADMIN_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }
  if (req.headers['x-admin-secret'] !== (ADMIN_SECRET || '')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const h = {
    apikey: SUPABASE_SERVICE_ROLE,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
  };

  // Récupère les produits + images associées triées par "sort"
  const select =
    'id,title,price,currency,category,short_description,image,cities,active,expires_after_days,published_at,created_at,' +
    'product_images(url,sort)';
  const url =
    `${SUPABASE_URL}/rest/v1/products?select=${encodeURIComponent(select)}` +
    `&order=published_at.desc.nullslast,created_at.desc.nullslast` +
    `&product_images.order=sort.asc`;

  const r = await fetch(url, { headers: h });
  const rows = await r.json();
  if (!r.ok) return res.status(r.status).json({ error: rows?.message || 'fetch failed' });

  const items = (rows || []).map(row => ({
    id: row.id,
    title: row.title,
    price: row.price,
    currency: row.currency || 'XAF',
    category: row.category || '',
    shortDescription: row.short_description || '',
    image: row.image || '',
    cities: row.cities || [],
    active: row.active !== false,
    expiresAfterDays: row.expires_after_days ?? null,
    publishedAt: row.published_at || null,
    gallery: Array.isArray(row.product_images) ? row.product_images.map(x => x.url) : [],
  }));

  res.status(200).json({ items });
}
