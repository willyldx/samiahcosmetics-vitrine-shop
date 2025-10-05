// /api/admin/save-products.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // petit verrou idiot mais utile : secret admin côté client
  const adminSecret = req.headers['x-admin-secret'];
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { products } = req.body || {};
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'Bad payload: products[] attendu' });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE // service role côté serveur
    );

    // Normalisation -> colonnes de la table products
    const rows = products.map((p) => ({
      id: String(p.id || '').trim(),
      title: p.title ?? null,
      price: Number.isFinite(p.price) ? p.price : 0,
      currency: p.currency ?? 'XAF',
      category: p.category ?? null,
      image: p.image ?? null,
      // ⬇️ le point clé : on écrit bien le JSON d’URLs
      images: Array.isArray(p.images) ? p.images : [],

      // selon ton schéma (snake_case)
      short_description: p.shortDescription ?? null,
      cities: Array.isArray(p.cities) ? p.cities : [],
      active: p.active !== false,
      expires_after_days: Number.isFinite(p.expiresAfterDays) ? p.expiresAfterDays : null,
      published_at: p.publishedAt ?? new Date().toISOString(),
      // created_at: laissé au DEFAULT côté DB
    })).filter(r => r.id); // on ignore les items sans id

    if (!rows.length) {
      return res.status(200).json({ items: 0 });
    }

    const { data, error } = await supabase
      .from('products')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      return res.status(500).json({ error: error.message, details: error });
    }

    return res.status(200).json({ ok: true, count: data?.length ?? 0 });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
