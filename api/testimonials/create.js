// api/testimonials/create.js  (Node.js Function – pas de TypeScript)
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body  '{}') : (req.body  {});
    const {
      client_name,
      city = null,
      message,
      rating = null,
      photos = [],
      active = false
    } = body;

    if (!client_name || !message) {
      return res.status(400).json({ error: 'client_name et message sont requis' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const r = (typeof rating === 'number') ? Math.round(rating)
            : (typeof rating === 'string') ? parseInt(rating, 10)
            : null;
    const ratingSafe = (r && r >= 1 && r <= 5) ? r : null;

    const photosArr = Array.isArray(photos)
      ? photos.filter(Boolean)
      : (typeof photos === 'string'
        ? photos.split(/[,\n;|]+/g).map(s => s.trim()).filter(Boolean)
        : []);

    const row = { client_name, city, message, rating: ratingSafe, photos: photosArr, active: !!active };

    const { data, error } = await supabase
      .from('testimonials')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      console.error('[insert testimonials]', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    console.error('[create.js fatal]', e);
    return res.status(500).json({ error: e?.message || 'server error' });
  }
}
