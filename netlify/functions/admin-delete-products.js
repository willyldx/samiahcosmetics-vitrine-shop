// netlify/functions/admin-delete-product.js

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
  if (event.httpMethod !== "POST") {
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

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const { id } = payload;
  if (!id) return json({ error: "missing_id" }, 400);

  const url = new URL(`${SUPABASE_URL}/rest/v1/products`);
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
    return json({ error: txt }, r.status);
  }

  return json({ ok: true });
}
