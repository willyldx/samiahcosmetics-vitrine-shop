// netlify/functions/admin-save-testimonials.js

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type,x-admin-secret",
    },
  });

export default async (req) => {
  try {
    // CORS préflight (si besoin)
    if (req.method === "OPTIONS") {
      return json(204, {});
    }

    if (req.method !== "POST") {
      return json(405, { ok: false, error: "Method Not Allowed" });
    }

    const ADMIN_SECRET = process.env.ADMIN_SECRET;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!ADMIN_SECRET || !SUPABASE_URL || !SERVICE_KEY) {
      console.error("admin-save-testimonials: env missing", {
        hasAdmin: !!ADMIN_SECRET,
        hasUrl: !!SUPABASE_URL,
        hasKey: !!SERVICE_KEY,
      });
      return json(500, { ok: false, error: "env_missing" });
    }

    const headerSecret = req.headers.get("x-admin-secret") || "";
    if (headerSecret !== ADMIN_SECRET) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("admin-save-testimonials: invalid JSON body", e);
      return json(400, { ok: false, error: "invalid_json" });
    }

    const testimonials = Array.isArray(body?.testimonials)
      ? body.testimonials
      : [];

    if (!testimonials.length) {
      return json(400, { ok: false, error: "no_testimonials_payload" });
    }

    let updatedCount = 0;

    for (const t of testimonials) {
      if (!t.id) {
        console.warn(
          "admin-save-testimonials: testimonial without id skipped",
          t
        );
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

      const url = new URL(`${SUPABASE_URL}/rest/v1/testimonials`);
      url.searchParams.set("on_conflict", "id");

      const r = await fetch(url, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify([row]),
      });

      const text = await r.text();
      if (!r.ok) {
        console.error(
          "admin-save-testimonials: supabase error",
          r.status,
          text
        );
        return json(r.status, {
          ok: false,
          error: "supabase_error",
          details: text,
        });
      }

      updatedCount++;
    }

    return json(200, { ok: true, count: updatedCount });
  } catch (e) {
    console.error("admin-save-testimonials: server error", e);
    return json(500, {
      ok: false,
      error: "server_error",
      details: e.message || String(e),
    });
  }
};
