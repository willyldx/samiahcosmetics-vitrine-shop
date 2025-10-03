module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const key = req.headers['x-admin-secret'];
  if (!key || key !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'unauthorized' });

  try{
    const body = await getJson(req);
    const arr = Array.isArray(body?.products) ? body.products : [];
    if (!arr.length) return res.status(400).json({ error: 'no products' });

    // map camelCase -> snake_case attendu par la DB
    const rows = arr.map(p => ({
      id: p.id,
      title: p.title,
      price: p.price,
      currency: p.currency ?? 'XAF',
      category: p.category ?? null,
      short_description: p.short_description ?? p.shortDescription ?? null,
      image: p.image ?? null,
      images: Array.isArray(p.images) ? p.images : [],
      cities: Array.isArray(p.cities) ? p.cities : [],
      active: p.active !== false,
      published_at: p.published_at ?? p.publishedAt ?? new Date().toISOString(),
      expires_after_days: p.expires_after_days ?? p.expiresAfterDays ?? null,
      created_at: p.created_at ?? p.createdAt ?? new Date().toISOString(),
    }));

    const url = `${process.env.SUPABASE_URL}/rest/v1/products?on_conflict=id`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(rows)
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.message || 'upsert failed' });

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ ok: true, count: data?.length || 0, items: data });
  }catch(e){
    res.status(500).json({ error: e.message || 'server error' });
  }
};

async function getJson(req){
  return await new Promise((resolve, reject)=>{
    let buf=''; req.on('data', c=>buf+=c); req.on('end', ()=>{ try{ resolve(JSON.parse(buf||'{}')); }catch(e){ reject(e); } });
  });
}
