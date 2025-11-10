// netlify/functions/admin-save-products.js

const json = (body, code = 200) => ({
  statusCode: code,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-admin-secret",
  },
  body: JSON.stringify(body),
});

async function sbFetch(endpoint, options = {}) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase env vars");
  }
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const r = await fetch(url, { ...options, headers });
  const txt = await r.text();
  let data = null;
  if (txt) {
    try {
      data = JSON.parse(txt);
    } catch {
      data = null;
    }
  }
  if (!r.ok) {
    throw new Error(
      (data && (data.message || data.error)) || txt || `Supabase error ${r.status}`
    );
  }
  if (
    r.status === 204 ||
    (options.headers && options.headers.Prefer?.includes("return=minimal"))
  ) {
    return { ok: true };
  }
  return data;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: json({}).headers };
  }
  if (event.httpMethod !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  const { ADMIN_SECRET } = process.env;
  const headerSecret =
    event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"] || "";

  if (ADMIN_SECRET && headerSecret !== ADMIN_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const products = Array.isArray(body.products) ? body.products : [];
  if (!products.length) {
    return json({ error: "No products payload" }, 400);
  }

  let updatedCount = 0;

  for (const p of products) {
    const galleryUrls = Array.isArray(p.images)
      ? p.images.filter(Boolean)
      : [];

    const productRow = {
      id: p.id,
      title: p.title ?? "",
      price: Number.isFinite(p.price) ? p.price : 0,
      currency: p.currency ?? "XAF",
      category: p.category ?? null,
      cities: Array.isArray(p.cities) ? p.cities : [],
      image: p.image ?? null,
      images: galleryUrls,
      short_description: p.shortDescription ?? "",
      active: p.active !== false,
      expires_after_days:
        typeof p.expiresAfterDays === "number" ? p.expiresAfterDays : null,
      published_at: p.publishedAt ?? new Date().toISOString(),
    };

    // upsert produit
    await sbFetch("products?on_conflict=id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([productRow]),
    });

    // reset galerie liée
    await sbFetch(
      `product_images?product_id=eq.${encodeURIComponent(p.id)}`,
      {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      }
    );

    if (galleryUrls.length) {
      const galleryRows = galleryUrls.map((url, index) => ({
        product_id: p.id,
        url,
        sort: index,
      }));

      await sbFetch("product_images", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(galleryRows),
      });
    }
    updatedCount++;
  }

  return json({ ok: true, count: updatedCount });
}
