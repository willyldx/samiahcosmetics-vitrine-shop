// /api/upload-image.js
// FORMAT STABLE (CommonJS)
const { Buffer } = require('buffer');

function mimeFromExt(ext) {
  const e = ext.toLowerCase();
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, ADMIN_SECRET, SUPABASE_BUCKET } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return res.status(500).json({ error: 'Missing Supabase env vars' });
    }
    const adminSecret = req.headers['x-admin-secret'] || '';
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      if (process.env.ADMIN_SECRET === '' && adminSecret === '') {} else {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const body = req.body || {}; // Vercel parse le body pour nous
    const { filename, contentBase64 } = body;
    
    if (!filename || !contentBase64) {
      return res.status(400).json({ error: 'Missing filename or contentBase64' });
    }
    const ext = (filename.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase();
    const contentType = mimeFromExt(ext);
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth()+1).padStart(2,'0');
    const d = String(now.getUTCDate()).padStart(2,'0');
    const safeName = filename.replace(/[^a-z0-9._-]/gi, '_');
    const path = `${y}/${m}/${d}/${Date.now()}-${safeName}`;
    const binary = Buffer.from(contentBase64, 'base64');
    const bucket = SUPABASE_BUCKET || 'product-images';
    const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(path)}`;
    const h = {
      'apikey': SUPABASE_SERVICE_ROLE,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': contentType,
      'x-upsert': 'true'
    };
    const r = await fetch(url, { method: 'PUT', headers: h, body: binary });
    if (!r.ok) {
      const data = await r.json().catch(() => ({ text: r.statusText }));
      console.error("Supabase upload error:", data);
      return res.status(r.status).json({ error: data?.message || data?.text || 'upload failed' });
    }
    const data = await r.json();
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
    return res.status(200).json({
      ok: true,
      path,
      siteUrl: publicUrl
    });
  } catch (e) {
    console.error("Upload function crashed:", e);
    return res.status(500).json({ error: 'Function crashed', details: e.message });
  }
}
