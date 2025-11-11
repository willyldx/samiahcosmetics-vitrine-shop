// /netlify/functions/testimonials-create.js
import { createClient } from '@supabase/supabase-js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};
const corsJson = { ...cors, 'Content-Type': 'application/json' };

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

  try {
    const body = JSON.parse(event.body || '{}');
    const { client_name, city = null, message, rating = null, photos = [], active = false } = body;

    if (!client_name || !message) {
      return { statusCode: 400, headers: corsJson, body: JSON.stringify({ error: 'client_name et message requis' }) };
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const r =
      typeof rating === 'number' ? Math.round(rating) :
      typeof rating === 'string' ? parseInt(rating, 10) : null;
    const ratingSafe = (r && r >= 1 && r <= 5) ? r : null;

    const photosArr = Array.isArray(photos)
      ? photos.filter(Boolean)
      : (typeof photos === 'string' ? photos.split(/[,\n;|]+/g).map(s => s.trim()).filter(Boolean) : []);

    const row = { client_name, city, message, rating: ratingSafe, photos: photosArr, active: !!active };

    const { data, error } = await supabase.from('testimonials').insert(row).select('id').single();
    if (error) return { statusCode: 500, headers: corsJson, body: JSON.stringify({ error: error.message }) };

    return { statusCode: 200, headers: corsJson, body: JSON.stringify({ ok: true, id: data.id }) };
  } catch (e) {
    return { statusCode: 500, headers: corsJson, body: JSON.stringify({ error: e.message || 'server error' }) };
  }
}
