// api/admin/save-products.js
// ========================================
async function supabaseFetch(endpoint, options = {}) {
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
  const rawText = await r.text();
  
  let json = null;
  if (rawText) {
    try {
      json = JSON.parse(rawText);
    } catch {}
  }

  if (!r.ok) {
    console.error(`Supabase fetch failed (${r.status}) for ${endpoint}:`, json || rawText);
    throw new Error(
      (json && (json.message || json.error)) || rawText || `Supabase API error (${r.status})`
    );
  }

  const prefer = options.headers?.Prefer || "";
  if (r.status === 204 || prefer.includes("return=minimal")) {
    return { ok: true };
  }

  return json;
}

const DEFAULT_CITY = "N'Djamena";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const headerSecret = req.headers["x-admin-secret"] || req.headers["X-Admin-Secret"] || "";
    const expectedSecret = process.env.ADMIN_SECRET || "";

    if (expectedSecret && headerSecret !== expectedSecret) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ ok: false, error: "Invalid JSON body" });
      }
    }

    const products = Array.isArray(body?.products) ? body.products : [];

    if (!products.length) {
      return res.status(400).json({ ok: false, error: "No products payload" });
    }

    let updatedCount = 0;

    for (const p of products) {
      const galleryUrls = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
      const cities = Array.isArray(p.cities) && p.cities.length ? p.cities : [DEFAULT_CITY];

      const productRow = {
        id: p.id,
        title: p.title ?? "",
        price: Number.isFinite(p.price) ? p.price : 0,
        currency: p.currency ?? "XAF",
        category: p.category ?? null,
        cities,
        image: p.image ?? null,
        images: galleryUrls,
        short_description: p.shortDescription ?? "",
        active: p.active !== false,
        expires_after_days: typeof p.expiresAfterDays === "number" ? p.expiresAfterDays : null,
        published_at: p.publishedAt ?? new Date().toISOString(),
      };

      await supabaseFetch("products?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([productRow]),
      });

      await supabaseFetch(`product_images?product_id=eq.${encodeURIComponent(p.id)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });

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

    return res.status(200).json({ ok: true, count: updatedCount });
  } catch (e) {
    console.error("save-products error:", e);
    return res.status(500).json({
      ok: false,
      error: "Function crashed",
      details: e.message,
    });
  }
}
