// netlify/functions/admin-delete-testimonial.js
// ========================================
const json2 = (body, code = 200) => ({
  statusCode: code,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-admin-secret",
    "access-control-allow-methods": "POST, OPTIONS"
  },
  body: JSON.stringify(body),
});

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: json2({}).headers };
    }
    if (event.httpMethod !== "POST") {
      return json2({ error: "Method Not Allowed" }, 405);
    }

    const { ADMIN_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!ADMIN_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json2({ error: "env_missing" }, 500);
    }

    const headerSecret = event.headers["x-admin-secret"] || event.headers["x-Admin-Secret"] || "";
    if (headerSecret !== ADMIN_SECRET) {
      return json2({ error: "unauthorized" }, 401);
    }

    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json2({ error: "invalid_json" }, 400);
    }

    const { id } = payload;
    if (!id) return json2({ error: "missing_id" }, 400);

    // ✅ CORRECTION : parenthèses + format Netlify
    const url = new URL(`${SUPABASE_URL}/rest/v1/testimonials`);
    url.searchParams.set("id", `eq.${id}`);

    const r = await fetch(url, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!r.ok) {
      const txt = await r.text();
      return json2({ error: "supabase_error", details: txt }, r.status);
    }

    return json2({ ok: true });
  } catch (e) {
    console.error("[admin-delete-testimonial] Crash:", e);
    return json2({ error: "server_error", details: e.message }, 500);
  }
}
