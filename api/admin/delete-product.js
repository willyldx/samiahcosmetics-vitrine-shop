export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, ADMIN_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }
  if (req.headers['x-admin-secret'] !== (ADMIN_SECRET || '')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let body = {};
  try { body = JSON.parse(req.body || '{}'); } catch { body = req.body || {}; }
  const id = body?.id;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const h = {
    'apikey': SUPABASE_SERVICE_ROLE,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`,
  };

  const url = `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`;
  const r = await fetch(url, { method: 'DELETE', headers: h });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    return res.status(r.status).json({ error: data?.message || 'delete failed' });
  }

  res.status(200).json({ ok: true });
}
