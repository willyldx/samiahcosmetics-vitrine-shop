// netlify/functions/admin-save-products.js

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

// Helper REST Supabase
async function supabaseFetch(endpoint, options = {}) {
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env;

  const serviceKey = SUPABASE_SERVICE_ROLE || SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !serviceKey) {
    console.error("supabaseFetch: missing env vars", {
      hasUrl: !!SUPABASE_URL,
      hasServiceKey: !!serviceKey,
    });
    throw new Error("Missing Supabase env vars");
  }

  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const method = options.method || "GET";
  console.log("supabaseFetch →", { endpoint, method });

  const r = await fetch(url, { ...options, headers });
  const rawText = await r.text();

  let data = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
  }

  if (!r.ok) {
    console.error(
      `Supabase fetch failed (${r.status}) for ${endpoint}:`,
      data || rawText
    );
    throw new Error(
      (data && (data.message || data.error)) ||
        rawText ||
        `Supabase API error (${r.status})`
    );
  }

  const prefer = options.headers?.Prefer || "";
  if (r.status === 204 || prefer.includes("return=minimal")) {
    return { ok: true };
  }

  return data;
}

exports.handler = async (event) => {
  // CORS
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  try {
    const { ADMIN_SECRET } = process.env;
    const headerSecret =
      event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"] || "";

    if (ADMIN_SECRET && headerSecret !== ADMIN_SECRET) {
      console.warn("admin-save-products: invalid admin secret");
      return json(401, { ok: false, error: "Unauthorized" });
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      console.error("admin-save-products: invalid JSON body", e);
      return json(400, { ok: false, error: "Invalid JSON body" });
    }

    const products = Array.isArray(body?.products) ? body.products : [];
    console.log("admin-save-products: products length", products.length);

    if (!products.length) {
      return json(400, { ok: false, error: "No products payload" });
    }

    let updatedCount = 0;

    for (const p of products) {
      console.log("admin-save-products: processing product", {
        id: p.id,
        title: p.title,
      });

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

      // Upsert dans products
      await supabaseFetch("products?on_conflict=id", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify([productRow]),
      });

      // Supprimer anciennes images
      await supabaseFetch(
        `product_images?product_id=eq.${encodeURIComponent(p.id)}`,
        {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        }
      );

      // Recréer la galerie si nécessaire
      if (galleryUrls.length > 0) {
        const galleryRows = galleryUrls.map((url, index) => ({
          product_id: p.id,
          url,
          sort: index,
        }));

        await supabaseFetch("product_images", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(galleryRows),
        });
      }

      updatedCount++;
    }

    console.log("admin-save-products: done", { updatedCount });

    return json(200, { ok: true, count: updatedCount });
  } catch (e) {
    console.error("API Error in admin-save-products:", e);
    return json(500, {
      ok: false,
      error: "Function crashed",
      details: e?.message || String(e),
    });
  }
};
