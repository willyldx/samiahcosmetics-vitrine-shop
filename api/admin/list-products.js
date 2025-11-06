// /api/admin/list-products.js
// FORMAT MODERNE (ESM)
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, ADMIN_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }
  if (req.headers['x-admin-secret'] !== (ADMIN_SECRET || '')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const select =
      'id,title,price,currency,category,short_description,image,images,cities,active,expires_after_days,published_at,created_at,' +
      'product_images(url,sort)'; // On s'assure de lire 'images'

    const { data, error } = await sb
      .from('products')
      .select(select)
      .order('published_at', { ascending: false, nulls: 'last' })
      .order('created_at', { ascending: false, nulls: 'last' })
      .order('sort', { foreignTable: 'product_images', ascending: true });

    if (error) {
      console.error('Supabase list error:', error);
      return res.status(500).json({ error: error.message });
    }

    const items = (data || []).map(row => ({
      id: row.id,
      title: row.title,
      price: row.price,
      currency: row.currency || 'XAF',
      category: row.category || '',
      shortDescription: row.short_description || '',
      image: row.image || '',
      cities: row.cities || [],
      active: row.active !== false,
      expiresAfterDays: row.expires_after_days ?? null,
      publishedAt: row.published_at || null,
      // L'admin lit 'images' (pour la compatibilité)
      images: row.images || (Array.isArray(row.product_images) ? row.product_images.map(x => x.url) : []),
    }));
    
    return res.status(200).json({ items });

  } catch (e) {
    console.error('List-products handler error:', e);
    return res.status(500).json({ error: 'Function crashed', details: String(e) });
  }
};
