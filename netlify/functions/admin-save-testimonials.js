// netlify/functions/admin-save-testimonials.js
const json = (body, code = 200) => ({
  statusCode: code,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-admin-secret",
    "access-control-allow-methods": "POST, OPTIONS"
  },
  body: JSON.stringify(body),
});

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: json({}).headers };
    }

    if (event.httpMethod !== "POST") {
      return json({ ok: false, error: "Method Not Allowed" }, 405);
    }

    const { ADMIN_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    
    if (!ADMIN_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ ok: false, error: "env_missing" }, 500);
    }

    const headerSecret = event.headers["x-admin-secret"] || event.headers["x-Admin-Secret"] || "";
    if (headerSecret !== ADMIN_SECRET) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    // ✅ CORRECTION : Accepte SOIT testimonial (singulier) SOIT testimonials (pluriel)
    const testimonials = body.testimonials 
      ? (Array.isArray(body.testimonials) ? body.testimonials : [body.testimonials])
      : body.testimonial 
        ? [body.testimonial]
        : [];
    
    if (!testimonials.length) {
      return json({ ok: false, error: "no_testimonials_payload" }, 400);
    }

    let updatedCount = 0;

    for (const t of testimonials) {
      if (!t.id && !t.authorName && !t.client_name) {
        console.warn("testimonial skipped (no id or name)", t);
        continue;
      }

      const row = {
        client_name: t.client_name || t.customerName || t.author || t.authorName || "",
        message: t.message ?? "",
        city: t.city ?? null,
        rating: typeof t.rating === "number" && Number.isFinite(t.rating) ? t.rating : null,
        active: t.active !== false,
      };

      // Gère photo_url (string) OU photos (array)
      if (t.photoUrl && typeof t.photoUrl === "string") {
        row.photo_url = t.photoUrl;
      } else if (t.photo_url && typeof t.photo_url === "string") {
        row.photo_url = t.photo_url;
      } else if (Array.isArray(t.photos) && t.photos.length > 0) {
        row.photos = t.photos;
      }

      // Si ID existe, c'est un update
      if (t.id) {
        row.id = t.id;
      }

      const url = new URL(`${SUPABASE_URL}/rest/v1/testimonials`);
      if (t.id) {
        url.searchParams.set("id", `eq.${t.id}`);
      }

      const method = t.id ? "PATCH" : "POST";

      const r = await fetch(url, {
        method,
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(t.id ? row : [row]),
      });

      if (!r.ok) {
        const text = await r.text();
        console.error("supabase error", r.status, text);
        return json({
          ok: false,
          error: "supabase_error",
          details: text,
        }, r.status);
      }

      updatedCount++;
    }

    return json({ ok: true, count: updatedCount });
  } catch (e) {
    console.error("server error", e);
    return json({
      ok: false,
      error: "server_error",
      details: e.message || String(e),
    }, 500);
  }
}
