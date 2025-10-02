export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if ((req.headers['x-admin-secret'] || '') !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE;
  if (!base || !key) return res.status(500).json({ error: 'Supabase env missing' });

  let body; try { body = await readJson(req); } catch { return res.status(400).json({ error: 'JSON invalide' }); }
  const id = (body?.id || '').trim();
  if (!id) return res.status(400).json({ error: 'id requis' });

  const url = `${base}/rest/v1/products?id=eq.${encodeURIComponent(id)}`;
  const r = await fetch(url, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) return res.status(r.status).json({ error: 'Delete failed' });
  res.status(200).json({ ok: true });
}
function readJson(req){ return new Promise((resolve,reject)=>{ let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{ resolve(JSON.parse(d||'{}')); }catch(e){ reject(e); } }); }); }
