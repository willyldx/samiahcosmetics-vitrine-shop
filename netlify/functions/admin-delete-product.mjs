import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // service_role
const ADMIN_SECRET = process.env.ADMIN_SECRET;

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
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  if ((event.headers['x-admin-secret'] || '') !== (ADMIN_SECRET || '')) {
    return json(401, { error: 'unauthorized' });
  }

  try {
    const { id } = JSON.parse(event.body || '{}');
    if (!id) return json(400, { error: 'id requis' });

    const di = await sb.from('product_images').delete().eq('product_id', id);
    if (di.error && di.error.code !== 'PGRST116') {
      return json(500, { error: di.error.message });
    }

    const dp = await sb.from('products').delete().eq('id', id);
    if (dp.error) return json(500, { error: dp.error.message });

    return json(200, { ok: true, id });
  } catch (e) {
    return json(500, { error: e?.message || 'delete failed' });
  }
}
