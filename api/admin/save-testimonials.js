// api/admin/save-testimonials.js

// Petit helper pour appeler l'API REST Supabase
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

  const r = await fetch(url, { ...options, headers });
  const text = await r.text();

  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!r.ok) {
    console.error(`Supabase fetch failed (${r.status}) for ${endpoint}:`, text);
    throw new Error(
      (json && (json.message || json.error)) ||
        text ||
        `Supabase API error (${r.status})`
    );
  }

  const prefer = options.headers?.Prefer || "";
  if (r.status === 204 || prefer.includes("return=minimal")) {
    return { ok: true };
  }

  return json;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    // --- Auth admin (comme pour save-products)
    const headerSecret =
      req.headers["x-admin-secret"] ||
      req.headers["X-Admin-Secret"] ||
      "";
    const expectedSecret = process.env.ADMIN_SECRET || "";

    if (expectedSecret && headerSecret !== expectedSecret) {
      console.warn("save-testimonials: invalid admin secret");
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // --- Body
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.error("save-testimonials: invalid JSON body", e);
        return res
          .status(400)
          .json({ ok: false, error: "Invalid JSON body" });
      }
    }

    const testimonials = Array.isArray(body?.testimonials)
      ? body.testimonials
      : [];

    if (!testimonials.length) {
      return res
        .status(400)
        .json({ ok: false, error: "No testimonials payload" });
    }

    let updatedCount = 0;

    for (const t of testimonials) {
      if (!t.id) {
        // Pour l’instant on exige un id côté admin (on gérera l’auto-id plus tard si tu veux)
        console.warn("save-testimonials: testimonial without id skipped");
        continue;
      }

      const row = {
        id: t.id,
        author: t.author ?? "",
        message: t.message ?? "",
        city: t.city ?? null,
        rating:
          typeof t.rating === "number" && Number.isFinite(t.rating)
            ? t.rating
            : null,
        active: t.active !== false,
      };

      await supabaseFetch("testimonials?on_conflict=id", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify([row]),
      });

      updatedCount++;
    }

    return res.status(200).json({ ok: true, count: updatedCount });
  } catch (e) {
    console.error("API Error in save-testimonials:", e);
    return res.status(500).json({
      ok: false,
      error: "Function crashed",
      details: e?.message || String(e),
    });
  }
}
