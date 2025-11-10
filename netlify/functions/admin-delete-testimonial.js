// netlify/functions/admin-delete-testimonial.js

const j = (status, body) =>
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
    // CORS préflight
    if (req.method === "OPTIONS") {
      return j(204, {});
    }

    if (req.method !== "POST") {
      return j(405, { ok: false, error: "Method Not Allowed" });
    }

    const ADMIN_SECRET = process.env.ADMIN_SECRET;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!ADMIN_SECRET || !SUPABASE_URL || !SERVICE_KEY) {
      console.error("admin-delete-testimonial: env_missing", {
        hasAdmin: !!ADMIN_SECRET,
        hasUrl: !!SUPABASE_URL,
        hasKey: !!SERVICE_KEY,
      });
      return j(500, { ok: false, error: "env_missing" });
    }

    const headerSecret = req.headers.get("x-admin-secret") || "";
    if (headerSecret !== ADMIN_SECRET) {
      return j(401, { ok: false, error: "unauthorized" });
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("admin-delete-testimonial: invalid_json", e);
      return j(400, { ok: false, error: "invalid_json" });
    }

    const id = body?.id;
    if (!id) {
      return j(400, { ok: false, error: "missing_id" });
    }

    const url = new URL(`${SUPABASE_URL}/rest/v1/testimonials`);
    url.searchParams.set("id", `eq.${id}`);

    const r = await fetch(url, {
      method: "DELETE",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });

    const text = await r.text();
    if (!r.ok) {
      console.error(
        "admin-delete-testimonial: supabase error",
        r.status,
        text
      );
      return j(r.status, {
        ok: false,
        error: "supabase_error",
        details: text,
      });
    }

    return j(200, { ok: true });
  } catch (e) {
    console.error("admin-delete-testimonial: server_error", e);
    return j(500, {
      ok: false,
      error: "server_error",
      details: e.message || String(e),
    });
  }
};
