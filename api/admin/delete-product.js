// api/admin/delete-product.js
// ========================================
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SECRET } = process.env;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Missing Supabase env vars' });
    }

    const headerSecret = req.headers['x-admin-secret'] || req.headers['X-Admin-Secret'] || '';
    if (ADMIN_SECRET && headerSecret !== ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let body = {};
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    } catch {
      body = req.body || {};
    }

    const id = body?.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const url = `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`;
    const r = await fetch(url, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      }
    });

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: data?.message || 'delete failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[delete-product] Crash:', e);
    return res.status(500).json({ error: 'server_error', details: e.message });
  }
}
