const fetch = global.fetch;
// Env vars to set in Netlify → Site settings → Environment variables
// SUPABASE_URL, SUPABASE_SERVICE_KEY (service_role), SUPABASE_BUCKET (e.g. "public")
const { SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_BUCKET = "public" } = process.env;

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return { statusCode: 500, body: "Missing Supabase env vars" };
    }

    const hdrs = event.headers || {};
    // (optionnel) sécuriser avec ton code admin côté client
    const adminSecret = hdrs["x-admin-secret"] || hdrs["X-Admin-Secret"];
    // if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) { return { statusCode: 401, body: "Unauthorized" }; }

    let body;
    try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
    const { filename, contentBase64 } = body;

    if (!filename || !contentBase64) {
      return { statusCode: 400, body: "filename & contentBase64 required" };
    }

    const buffer = Buffer.from(contentBase64, "base64");

    // Upload via REST API (upsert=true pour écraser si existe)
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_BUCKET)}/${encodeURIComponent(filename)}?upsert=true`;
    const resp = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "apikey": SUPABASE_SERVICE_KEY,
        "Content-Type": "application/octet-stream"
      },
      body: buffer
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return { statusCode: resp.status, body: `Supabase upload error: ${txt}` };
    }

    // Public URL (si le bucket est public)
    const siteUrl = `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(SUPABASE_BUCKET)}/${encodeURIComponent(filename)}`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, siteUrl })
    };
  } catch (e) {
    return { statusCode: 500, body: `Server error: ${e.message}` };
  }
};