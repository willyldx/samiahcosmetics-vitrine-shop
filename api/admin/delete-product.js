module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const key = req.headers['x-admin-secret'];
  if (!key || key !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'unauthorized' });

  const body = await new Promise((resolve)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>resolve(JSON.parse(b||'{}'))); });
  const id = body?.id;
  if (!id) return res.status(400).json({ error: 'missing id' });

  const url = `${process.env.SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`;
  const r = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`
    }
  });
  if (!r.ok) {
    const data = await r.json().catch(()=>null);
    return res.status(r.status).json({ error: data?.message || 'delete failed' });
  }
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ ok: true, id });
};
