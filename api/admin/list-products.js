module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const key = req.headers['x-admin-secret'];
  if (!key || key !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'unauthorized' });

  const url = `${process.env.SUPABASE_URL}/rest/v1/products?select=*&order=created_at.desc,nullslast`;
  const r = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`
    }
  });
  const data = await r.json();
  if (!r.ok) return res.status(r.status).json({ error: data?.message || 'fetch failed' });

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ items: data });
};
