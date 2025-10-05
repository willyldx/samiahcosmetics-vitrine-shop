// /api/admin/save-products.js
// Serverless Vercel sans dépendances (utilise l'API REST de Supabase)

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' }); return;
    }

    // Sécurité simple
    const adminSecret = req.headers['x-admin-secret'] || '';
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      res.status(401).json({ error: 'Unauthorized' }); return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const products = Array.isArray(body.products) ? body.products : [];
    if (!products.length) {
      res.status(400).json({ error: 'No products payload' }); return;
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;
    if (!url || !key) {
      res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE' }); return;
    }

    // Map → colonnes de ta table (snake_case)
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
      published_at: p.publishedAt ?? new Date().toISOString(),
    }));

    // Upsert via REST (on_conflict=id)
    const endpoint = `${url}/rest/v1/products?on_conflict=id`;
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,          // service_role
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(rows)
    });

    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = { __text: text }; }

    if (!r.ok) {
      res.status(r.status).json({ error: 'Supabase REST failed', details: json });
      return;
    }

    res.status(200).json({ ok: true, count: Array.isArray(json) ? json.length : 0 });
  } catch (e) {
    res.status(500).json({ error: 'Function crashed', details: String(e && e.stack || e) });
  }
};
