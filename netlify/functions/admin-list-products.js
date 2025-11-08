// netlify/functions/admin-list-products.js

const json = (code, body) => ({
  statusCode: code,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-admin-secret",
    "access-control-allow-methods": "OPTIONS,GET",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  // CORS
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  if (event.httpMethod !== "GET") {
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

    const url = new URL(`${SUPABASE_URL}/rest/v1/products`);
    url.searchParams.set(
      "select",
      "id,title,price,currency,category,cities,image,images,short_description,active,created_at,expires_after_days"
    );

    const r = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Accept-Profile": "public",
      },
    });

    const text = await r.text();
    let data;
    try {
      data = text ? JSON.parse(text) : [];
    } catch {
      return json(r.status, { error: "invalid_json_from_supabase", raw: text });
    }

    if (!r.ok) {
      return json(r.status, { error: "supabase_error", details: data });
    }

    return json(200, { items: Array.isArray(data) ? data : [] });
  } catch (e) {
    return json(500, { error: "Function crashed", details: String(e) });
  }
};
