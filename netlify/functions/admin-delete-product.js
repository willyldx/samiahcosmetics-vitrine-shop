// POST /api/admin/delete-product  { id }
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
    const { id } = JSON.parse(event.body || "{}");
    if (!id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "id requis" }) };

    const SB_URL = process.env.SB_URL;
    const SRK    = process.env.SB_SERVICE_ROLE_KEY;

    // Supprimer d'abord les images liées (silencieux si table absente)
    try {
      await fetch(`${SB_URL}/rest/v1/product_images?product_id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { apikey: SRK, Authorization: `Bearer ${SRK}` }
      });
    } catch {}

    // Supprimer le produit
    const resp = await fetch(`${SB_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { apikey: SRK, Authorization: `Bearer ${SRK}` }
    });

    if (!resp.ok) {
      const t = await resp.text();
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: t }) };
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
