// netlify/functions/upload-image.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // service_role key
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  },
  body: JSON.stringify(body)
});

export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

  // Health check
  if (event.queryStringParameters?.ping) return json(200, { ok: true });

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  // Admin check
  const hdrSecret = event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'];
  if (!ADMIN_SECRET || hdrSecret !== ADMIN_SECRET) return json(401, { error: 'Unauthorized' });

  let filename, contentBase64;
  try {
    ({ filename, contentBase64 } = JSON.parse(event.body || '{}'));
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }
  if (!filename || !contentBase64) return json(400, { error: 'filename & contentBase64 required' });

  try {
    const buffer = Buffer.from(contentBase64, 'base64');
    // Upload (upsert true so re-uploads replace previous)
    const { data, error } = await sb
      .storage.from('site-images')
      .upload(filename, buffer, { contentType: 'image/jpeg', upsert: true });

    if (error) throw error;

    const path = data.path; // e.g. "1710000000000-foo.jpg"
    const { data: pub } = sb.storage.from('site-images').getPublicUrl(path);
    return json(200, { siteUrl: pub.publicUrl });
  } catch (e) {
    return json(500, { error: e.message || 'upload failed' });
  }
}
