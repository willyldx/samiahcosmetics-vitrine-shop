// netlify/functions/admin-list-testimonials.js
// ========================================
const json4 = (body, code = 200) => ({
  statusCode: code,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-admin-secret",
  },
  body: JSON.stringify(body),
});

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: json4({}).headers };
    }
    if (event.httpMethod !== "GET") {
      return json4({ error: "Method Not Allowed" }, 405);
    }

    const { ADMIN_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!ADMIN_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json4({ error: "env_missing" }, 500);
    }

    const headerSecret = event.headers["x-admin-secret"] || event.headers["x-Admin-Secret"] || "";
    if (headerSecret !== ADMIN_SECRET) {
      return json4({ error: "unauthorized" }, 401);
    }

    // ✅ CORRECTION : client_name au lieu de author
    const url = new URL(`${SUPABASE_URL}/rest/v1/testimonials`);
    url.searchParams.set(
      "select",
      "id,client_name,message,city,rating,photos,photo_url,active,created_at"
    );
    url.searchParams.set("order", "created_at.desc");

    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Accept-Profile": "public",
      },
    });

    if (!r.ok) {
      const txt = await r.text();
      return json4({ error: "supabase_error", details: txt }, r.status);
    }

    const items = await r.json();
    return json4({ items });
  } catch (e) {
    console.error("[admin-list-testimonials] Crash:", e);
    return json4({ error: "server_error", details: e.message }, 500);
  }
}
