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

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if ((event.headers['x-admin-secret'] || '') !== (ADMIN_SECRET || '')) {
    return json(401, { error: 'unauthorized' });
  }

  try {
    const { data, error } = await sb
      .from('products')
      .select('id,title,price,currency,category,cities,image,images,short_description,active,created_at,published_at,expires_after_days')
      .order('created_at', { ascending: false });

    if (error) return json(500, { error: error.message });

    const items = (data || []).map(p => ({
      id: p.id,
      title: p.title,
      price: p.price,
      currency: p.currency || 'XAF',
      category: p.category || '',
      cities: Array.isArray(p.cities) ? p.cities : [],
      image: p.image || '',
      images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
      shortDescription: p.short_description || '',
      active: p.active !== false,
      publishedAt: p.published_at || p.created_at || null,
      expiresAfterDays: Number.isFinite(p.expires_after_days) ? p.expires_after_days : null
    }));

    return json(200, { items });
  } catch (e) {
    return json(500, { error: e?.message || 'list failed' });
  }
}
