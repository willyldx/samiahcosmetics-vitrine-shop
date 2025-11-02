// /api/admin/save-products.js
// Serverless Vercel (utilise l'API REST de Supabase)
// VERSION CORRIGÉE (Suggestion 2) : gère la table product_images

// Helper pour les appels fetch à Supabase
async function supabaseFetch(endpoint, options = {}) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error('Missing Supabase env vars');
  }

  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  
  const headers = {
    'apikey': SUPABASE_SERVICE_ROLE,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const r = await fetch(url, { ...options, headers });

  if (!r.ok) {
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { __text: text }; }
    console.error(`Supabase fetch failed (${r.status}) for ${endpoint}:`, json);
    throw new Error(json?.message || json?.error || text || 'Supabase API error');
  }

  // DELETE ne renvoie rien, POST avec 'return=minimal' non plus
  if (r.status === 204 || options.headers?.Prefer === 'return=minimal') {
    return { ok: true };
  }
  
  // GET ou POST (par défaut) renvoie du JSON
  return await r.json();
}

// Handler principal
// (Utilise 'export default' car ton package.json est 'type: module')
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Sécurité
    const adminSecret = req.headers['x-admin-secret'] || '';
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Note: Vercel parse le JSON automatiquement pour toi (contrairement à Netlify)
    const body = req.body || {};
    const products = Array.isArray(body.products) ? body.products : [];
    if (!products.length) {
      return res.status(400).json({ error: 'No products payload' });
    }

    let updatedCount = 0;

    // On traite les produits un par un pour gérer les relations
    for (const p of products) {
      
      // 1. Préparer le produit principal (SANS le champ 'images')
      const productRow = {
        id: p.id,
        title: p.title ?? '',
        price: Number.isFinite(p.price) ? p.price : 0,
        currency: p.currency ?? 'XAF',
        category: p.category ?? null,
        cities: Array.isArray(p.cities) ? p.cities : [],
        image: p.image ?? null,
        // 'images' (la colonne) n'est pas incluse ici, elle n'est pas utilisée par le site
        short_description: p.shortDescription ?? '',
        active: p.active !== false,
        expires_after_days: (typeof p.expiresAfterDays === 'number') ? p.expiresAfterDays : null,
        published_at: p.publishedAt ?? new Date().toISOString(),
      };

      // 2. Upsert le produit principal
      await supabaseFetch('products?on_conflict=id', {
        method: 'POST',
        headers: {
          'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify([productRow]) // API attend un tableau
      });

      // 3. Supprimer les anciennes images de la galerie
      await supabaseFetch(`product_images?product_id=eq.${encodeURIComponent(p.id)}`, {
        method: 'DELETE',
        headers: {
          'Prefer': 'return=minimal',
        }
      });

      // 4. Insérer les nouvelles images de la galerie (p.images)
      // p.images vient de admin-pro.html (c'est le tableau extraUrls)
      const galleryUrls = Array.isArray(p.images) ? p.images : [];
      if (galleryUrls.length > 0) {
        const galleryRows = galleryUrls.map((url, index) => ({
          product_id: p.id,
          url: url,
          sort: index // On sauvegarde l'ordre
        }));

        await supabaseFetch('product_images', {
          method: 'POST',
          headers: {
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(galleryRows)
        });
      }
      
      updatedCount++;
    } // fin de la boucle for

    res.status(200).json({ ok: true, count: updatedCount });

  } catch (e) {
    console.error('API Error in save-products:', e);
    res.status(500).json({ error: 'Function crashed', details: String(e && e.stack || e) });
  }
}
