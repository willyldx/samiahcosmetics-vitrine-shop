// GET /api/admin/list-products
const ORIGIN = "https://www.samiahcosmetics.shop";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

export async function handler(event, context) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };
  if (event.httpMethod !== "GET")     return { statusCode: 405, headers: cors, body: "Method Not Allowed" };

  // sécurité
  const secret = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "unauthorized" }) };
  }

  try {
    const SB_URL = process.env.SB_URL;
    const SRK    = process.env.SB_SERVICE_ROLE_KEY;

    const url = `${SB_URL}/rest/v1/products` +
      `?select=id,title,price,currency,category,cities,image,images,short_description,active,created_at,expires_after_days` +
      `&order=created_at.desc`;

    const resp = await fetch(url, {
      headers: { apikey: SRK, Authorization: `Bearer ${SRK}` }
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: t }) };
    }
    const rows = await resp.json();

    // Adapter au format attendu par l’UI admin
    const items = (rows || []).map(r => ({
      id: r.id,
      title: r.title,
      price: r.price,
      currency: r.currency || "XAF",
      category: r.category || "",
      cities: Array.isArray(r.cities) ? r.cities : [],
      image: r.image || "",
      images: r.images ?? [],
      shortDescription: r.short_description || "",
      active: r.active !== false,
      expiresAfterDays: Number.isFinite(r.expires_after_days) ? r.expires_after_days : null,
      publishedAt: r.created_at
    }));

    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
