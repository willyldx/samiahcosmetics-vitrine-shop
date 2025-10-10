import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY; // service_role
const BUCKET_NAME   = process.env.BUCKET_NAME || 'site-images';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    },
    body: JSON.stringify(data)
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

  const u = new URL(event.rawUrl || `http://x${event.path}`);
  if (u.searchParams.get('ping')) {
    return json(200, { ok: true, bucket: BUCKET_NAME });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const { filename, contentBase64 } = JSON.parse(event.body || '{}');
    if (!filename || !contentBase64) return json(400, { error: 'filename et contentBase64 requis' });

    const b64 = contentBase64.replace(/^data:[^,]+,/, '');
    const buffer = Buffer.from(b64, 'base64');
    if (!buffer.length) return json(400, { error: 'Image vide' });
    if (buffer.length > 8 * 1024 * 1024) return json(413, { error: 'Fichier trop volumineux (>8Mo)' });

    const lower = filename.toLowerCase();
    let contentType = 'image/jpeg';
    if (lower.endsWith('.png'))  contentType = 'image/png';
    if (lower.endsWith('.webp')) contentType = 'image/webp';

    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm   = String(now.getUTCMonth() + 1).padStart(2, '0');
    const safe = lower.replace(/[^a-z0-9._-]+/g, '-');
    let path   = `${yyyy}/${mm}/${Date.now()}-${safe}`;

    let up = await sb.storage.from(BUCKET_NAME).upload(path, buffer, {
      cacheControl: '3600',
      contentType,
      upsert: false
    });
    if (up.error && up.error.statusCode === '409') {
      path = `${yyyy}/${mm}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`;
      up = await sb.storage.from(BUCKET_NAME).upload(path, buffer, {
        cacheControl: '3600',
        contentType,
        upsert: false
      });
    }
    if (up.error) return json(500, { error: up.error.message });

    const { data: pub } = sb.storage.from(BUCKET_NAME).getPublicUrl(path);
    return json(200, { ok: true, siteUrl: pub.publicUrl, path });
  } catch (e) {
    return json(500, { error: e?.message || 'Upload failed' });
  }
}
