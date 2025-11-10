// netlify/functions/admin-list-testimonials.js

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });

export default async (req) => {
  try {
    const ADMIN_SECRET = process.env.ADMIN_SECRET;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!ADMIN_SECRET || !SUPABASE_URL || !SERVICE_KEY) {
      return json(500, { ok: false, error: "env_missing" });
    }

    const headerSecret = req.headers.get("x-admin-secret") || "";
    if (headerSecret !== ADMIN_SECRET) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    const url = new URL(`${SUPABASE_URL}/rest/v1/testimonials`);
    // adapte les colonnes à ton schéma réel si besoin
    url.searchParams.set(
      "select",
      "id,author,message,city,rating,active,created_at"
    );
    url.searchParams.set("order", "created_at.desc");

    const r = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Accept-Profile": "public",
      },
    });

    const text = await r.text();
    let data = [];
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = [];
      }
    }

    if (!r.ok) {
      console.error("Supabase list testimonials error", r.status, text);
      return json(r.status, {
        ok: false,
        error: "supabase_error",
        details: text,
      });
    }

    return json(200, { ok: true, items: data });
  } catch (e) {
    console.error("admin-list-testimonials error", e);
    return json(500, {
      ok: false,
      error: "server_error",
      details: e.message || String(e),
    });
  }
};
