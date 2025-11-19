// netlify/functions/admin-list-products.js
// ========================================
const json = (body, code = 200) => ({
  statusCode: code,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-admin-secret",
    "access-control-allow-methods": "GET, OPTIONS"
  },
  body: JSON.stringify(body),
});

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: json({}).headers };
    }
    if (event.httpMethod !== "GET") {
      return json({ error: "Method Not Allowed" }, 405);
    }

    const { ADMIN_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    
    if (!ADMIN_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "env_missing" }, 500);
    }

    const headerSecret = event.headers["x-admin-secret"] || event.headers["x-Admin-Secret"] || "";
    if (ADMIN_SECRET && headerSecret !== ADMIN_SECRET) {
      return json({ error: "unauthorized" }, 401);
    }

    // CONSTRUCTION DE L'URL POUR SUPABASE (Table PRODUCTS)
    const url = new URL(`${SUPABASE_URL}/rest/v1/products`);
    
    // On sélectionne les bonnes colonnes
    const select = 
      "id,title,price,currency,category,short_description,image,images,cities,active,expires_after_days,published_at,created_at,product_images(url,sort)";
    
    url.searchParams.set("select", select);
    // Tri par date de publication (les plus récents en premier)
    url.searchParams.set("order", "published_at.desc.nullslast,created_at.desc.nullslast");

    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Accept-Profile": "public",
      },
    });

    if (!r.ok) {
      const txt = await r.text();
      return json({ error: "supabase_error", details: txt }, r.status);
    }

    const data = await r.json();

    // NORMALISATION DES DONNÉES (pour que l'admin les lise correctement)
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
      // Gestion fallback images : champ JSON 'images' OU relation 'product_images'
      images: row.images || (Array.isArray(row.product_images) ? row.product_images.map(x => x.url) : []),
    }));

    return json({ items });

  } catch (e) {
    console.error('[admin-list-products] Crash:', e);
    return json({ error: 'server_error', details: e.message }, 500);
  }
}
