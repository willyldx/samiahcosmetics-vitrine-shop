// netlify/functions/admin-save-products.js
import { createClient } from '@supabase/supabase-js';

const json = (body, code = 200) => ({
  statusCode: code,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type,x-admin-secret',
  },
  body: JSON.stringify(body),
});

export async function handler(event) {
  // CORS préflight éventuel
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: json({}).headers };
  }

  if (event.httpMethod !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_SECRET) {
    return json({ error: 'Missing environment variables' }, 500);
  }

  const headerSecret = event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'];
  if (!headerSecret || headerSecret !== ADMIN_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!Array.isArray(payload.products)) return json({ error: 'Bad payload: { products: [] } attendu' }, 400);

  const toArray = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === 'string') return v.split(/[,\n;|]+/g).map(s=>s.trim()).filter(Boolean);
    try { return Object.values(v).flat().filter(Boolean); } catch { return []; }
  };

  const rows = payload.products.map(p => {
    const price = Number.isFinite(+p.price) ? Math.round(+p.price) : 0;
    const exp = p.expiresAfterDays;
    return {
      id: String(p.id ?? '').trim(),
      title: String(p.title ?? '').trim(),
      price,
      currency: p.currency || 'XAF',
      category: p.category || null,
      image: p.image || null,
      images: toArray(p.images),
      cities: toArray(p.cities),
      short_description: p.shortDescription || '',
      active: p.active !== false,
      expires_after_days: Number.isFinite(+exp) ? +exp : null,
    };
  }).filter(r => r.id && r.title);

  if (!rows.length) return json({ error: 'Aucun produit valide' }, 400);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await sb
    .from('products')
    .upsert(rows, { onConflict: 'id' })
    .select('id');

  if (error) return json({ error: error.message || 'Supabase error' }, 500);

  return json({ ok: true, count: data?.length ?? 0 });
}