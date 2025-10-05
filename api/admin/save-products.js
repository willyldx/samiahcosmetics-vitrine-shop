// /api/admin/save-products.js
// Node.js Serverless Function (Vercel)
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    // Sécurité simple côté serveur
    const adminSecret = req.headers['x-admin-secret'] || '';
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Body
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const products = Array.isArray(body.products) ? body.products : [];
    if (!products.length) {
      res.status(400).json({ error: 'No products payload' });
      return;
    }

    // Supabase (service role)
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;
    if (!url || !key) {
      res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE' });
      return;
    }
    const sb = createClient(url, key);

    // Map vers colonnes exactes de la table
    const rows = products.map(p => ({
      id: p.id,
      title: p.title ?? '',
      price: Number.isFinite(p.price) ? p.price : 0,
      currency: p.currency ?? 'XAF',
      category: p.category ?? null,
      cities: Array.isArray(p.cities) ? p.cities : [],
      image: p.image ?? null,
      images: Array.isArray(p.images) ? p.images : [],
      short_description: p.shortDescription ?? '',
      active: p.active !== false,
      expires_after_days: (typeof p.expiresAfterDays === 'number') ? p.expiresAfterDays : null,
      // s’il n’y a pas de publishedAt côté client, on en met un
      published_at: p.publishedAt ?? new Date().toISOString(),
    }));

    // Upsert par id
    const { data, error } = await sb
      .from('products')
      .upsert(rows, { onConflict: 'id' })
      .select('id');

    if (error) {
      // On renvoie l’erreur détaillée au client
      res.status(500).json({ error: error.message || 'Supabase upsert failed', details: error });
      return;
    }

    res.status(200).json({ ok: true, count: data?.length || 0 });
  } catch (e) {
    // Filet de sécurité : on renvoie le stack pour debug
    res.status(500).json({ error: 'Function crashed', details: String(e && e.stack || e) });
  }
};
