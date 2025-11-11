// /api/testimonials/create.ts  (Node runtime)
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
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const {
      client_name,
      city = null,
      message,
      rating = null,          // 1..5 ou null
      photos = [],            // tableau d’URLs ou vide
      active = false          // on laisse false par défaut; tu actives via le bouton Publier
    } = body;

    if (!client_name || !message) {
      return res.status(400).json({ error: 'client_name et message sont requis' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!  // service-role : bypass RLS pour insert contrôlé
    );

    // Normalisation types
    const ratingInt =
      typeof rating === 'number' ? Math.round(rating) :
      typeof rating === 'string' ? parseInt(rating, 10) : null;
    const ratingSafe = (ratingInt && ratingInt >= 1 && ratingInt <= 5) ? ratingInt : null;

    const photosArr = Array.isArray(photos)
      ? photos.filter(Boolean)
      : typeof photos === 'string'
        ? photos.split(/[,\n;|]+/g).map(s => s.trim()).filter(Boolean)
        : [];

    const row = {
      client_name,
      city,
      message,
      rating: ratingSafe,
      photos: photosArr,
      active: !!active
    };

    const { data, error } = await supabase
      .from('testimonials')
      .insert(row)
      .select('id, client_name, active')
      .single();

    if (error) {
      // Log lisible dans Vercel
      console.error('[insert testimonials] ', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (e: any) {
    console.error('[create.ts fatal] ', e);
    return res.status(500).json({ error: e?.message || 'server error' });
  }
}
