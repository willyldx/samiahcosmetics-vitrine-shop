// netlify/functions/admin-delete-product.js

const json = (code, body) => ({
  statusCode: code,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-admin-secret",
    "access-control-allow-methods": "OPTIONS,POST",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  // CORS
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  try {
    const {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      ADMIN_SECRET,
    } = process.env;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_SECRET) {
      return json(500, { error: "env_missing" });
    }

    const headerSecret =
      event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"] || "";
    if (headerSecret !== ADMIN_SECRET) {
      return json(401, { error: "unauthorized" });
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const { id } = body;
    if (!id) {
      return json(400, { error: "missing_id" });
    }

    const url = new URL(`${SUPABASE_URL}/rest/v1/products`);
    url.searchParams.set("id", `eq.${id}`);

    const r = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    const text = await r.text();
    if (!r.ok) {
      return json(r.status, { error: "supabase_error", raw: text });
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: "Function crashed", details: String(e) });
  }
};
