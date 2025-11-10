// netlify/functions/admin-list-products.js

const json = (body, code = 200) => ({
  statusCode: code,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-admin-secret",
  },
  body: JSON.stringify(body),
});

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: json({}).headers };
  }
  if (event.httpMethod !== "GET") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  const { ADMIN_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } =
    process.env;
  if (!ADMIN_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "env_missing" }, 500);
  }

  const headerSecret =
    event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"] || "";
  if (headerSecret !== ADMIN_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  const url = new URL(`${SUPABASE_URL}/rest/v1/products`);
  url.searchParams.set(
    "select",
    "id,title,price,currency,category,cities,image,images,short_description,active,created_at,expires_after_days"
  );

  const r = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Accept-Profile": "public",
    },
  });

  if (!r.ok) {
    const txt = await r.text();
    return json({ error: txt }, r.status);
  }

  const items = await r.json();
  return json({ items });
}
