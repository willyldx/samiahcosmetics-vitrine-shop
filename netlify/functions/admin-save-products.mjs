// netlify/functions/admin-save-products.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // service_role
const ADMIN_SECRET = process.env.ADMIN_SECRET;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    },
    body: JSON.stringify(data)
  };
}

export default async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  if ((event.headers['x-admin-secret'] || '') !== (ADMIN_SECRET || '')) {
    return json(401, { error: 'unauthorized' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const products = Array.isArray(body.products) ? body.products : [];
    if (!products.length) return json(400, { error: 'products[] requis' });

    // 1) Upsert produits
    const rows = products.map(p => ({
      id: p.id,
      title: p.title,
      price: Number.isFinite(p.price) ? p.price : 0,
      currency: p.currency || 'XAF',
      category: p.category || null,
      cities: Array.isArray(p.cities) ? p.cities : [],
      image: p.image || null,
      images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
      short_description: p.shortDescription || '',
      active: p.active !== false,
      published_at: p.publishedAt || new Date().toISOString(),
      expires_after_days: Number.isFinite(p.expiresAfterDays) ? p.expiresAfterDays : null
    }));

    const up = await sb.from('products').upsert(rows, { onConflict: 'id' }).select('id');
    if (up.error) return json(500, { error: up.error.message });

    // 2) Met à jour la table product_images en fonction de images[]
    for (const p of rows) {
      // purge existant
      const del = await sb.from('product_images').delete().eq('product_id', p.id);
      if (del.error && del.error.code !== 'PGRST116') {
        // PGRST116 = no rows found (ok)
        return json(500, { error: del.error.message });
      }

      const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
      if (!imgs.length) continue;

      const toInsert = imgs.map((url, i) => ({
        product_id: p.id,
        url,
        sort: i
      }));
      const ins = await sb.from('product_images').insert(toInsert);
      if (ins.error) return json(500, { error: ins.error.message });
    }

    return json(200, { ok: true, count: rows.length });
  } catch (e) {
    return json(500, { error: e?.message || 'save failed' });
  }
};
