// POST /api/admin/save-products
const ORIGIN = "https://www.samiahcosmetics.shop";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };

  // sécurité
  const secret = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "unauthorized" }) };
  }

  try {
    const { products } = JSON.parse(event.body || "{}");
    if (!Array.isArray(products)) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "payload invalide: {products: [...]}" }) };
    }

    const SB_URL = process.env.SB_URL;
    const SRK    = process.env.SB_SERVICE_ROLE_KEY;

    // Mapper vers colonnes DB
    const rows = products.map(p => ({
      id: p.id,
      title: p.title ?? "",
      price: Number.isFinite(p.price) ? p.price : 0,
      currency: p.currency || "XAF",
      category: p.category || null,
      cities: Array.isArray(p.cities) ? p.cities : [],
      image: p.image || null,
      images: p.images ?? [],                       // jsonb recommandé côté DB
      short_description: p.shortDescription || null,
      active: p.active !== false,
      expires_after_days: Number.isFinite(p.expiresAfterDays) ? p.expiresAfterDays : null,
      created_at: p.publishedAt || new Date().toISOString()
    }));

    // Upsert bulk via REST
    const url = `${SB_URL}/rest/v1/products?on_conflict=id`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SRK,
        Authorization: `Bearer ${SRK}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(rows)
    });

    if (!resp.ok) {
      const t = await resp.text();
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: t }) };
    }

    const saved = await resp.json();
    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, count: saved.length })
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
