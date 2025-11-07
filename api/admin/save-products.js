// /api/admin/save-products.js (ou équivalent)

// Helper pour appeler l'API REST de Supabase
async function supabaseFetch(endpoint, options = {}) {
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env;

  // On accepte les deux noms possibles, au cas où
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
  let json = null;
  if (rawText) {
    try {
      json = JSON.parse(rawText);
    } catch {
      json = null;
    }
  }

  if (!r.ok) {
    console.error(`Supabase fetch failed (${r.status}) for ${endpoint}:`, json || rawText);
    throw new Error(
      (json && (json.message || json.error)) ||
        rawText ||
        `Supabase API error (${r.status})`
    );
  }

  // Si on demande un retour minimal, il n'y a pas de body exploitable
  const prefer = options.headers?.Prefer || "";
  if (r.status === 204 || prefer.includes("return=minimal")) {
    return { ok: true };
  }

  return json;
}

// Handler principal
export default async function handler(req, res) {
  try {
    console.log("save-products: incoming request", { method: req.method });

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    // --- Auth admin ---
    const headerSecret =
      req.headers["x-admin-secret"] ||
      req.headers["X-Admin-Secret"] ||
      "";
    const expectedSecret = process.env.ADMIN_SECRET || "";

    // Si ADMIN_SECRET est défini, on l'exige. S'il est vide, on laisse passer (dev).
    if (expectedSecret && headerSecret !== expectedSecret) {
      console.warn("save-products: invalid admin secret");
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // --- Body parsing (sécurisé) ---
    let body = req.body;

    // Au cas où Vercel envoie le body en string brut
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.error("save-products: invalid JSON body", e);
        return res.status(400).json({ ok: false, error: "Invalid JSON body" });
      }
    }

    const products = Array.isArray(body?.products) ? body.products : [];
    console.log("save-products: products length", products.length);

    if (!products.length) {
      return res.status(400).json({ ok: false, error: "No products payload" });
    }

    let updatedCount = 0;

    for (const p of products) {
      console.log("save-products: processing product", {
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
        // on stocke la galerie dans la colonne "images" pour le site public
        images: galleryUrls,
        short_description: p.shortDescription ?? "",
        active: p.active !== false,
        expires_after_days:
          typeof p.expiresAfterDays === "number" ? p.expiresAfterDays : null,
        published_at: p.publishedAt ?? new Date().toISOString(),
      };

      // Upsert du produit
      await supabaseFetch("products?on_conflict=id", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify([productRow]),
      });

      // On supprime les anciennes images liées au produit
      await supabaseFetch(
        `product_images?product_id=eq.${encodeURIComponent(p.id)}`,
        {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        }
      );

      // Puis on recrée les lignes de la galerie si besoin
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

    console.log("save-products: done", { updatedCount });

    return res.status(200).json({ ok: true, count: updatedCount });
  } catch (e) {
    console.error("API Error in save-products:", e);
    return res.status(500).json({
      ok: false,
      error: "Function crashed",
      details: e?.message || String(e),
    });
  }
}
