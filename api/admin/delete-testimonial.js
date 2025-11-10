// api/admin/delete-testimonial.js

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const headerSecret =
      req.headers["x-admin-secret"] ||
      req.headers["X-Admin-Secret"] ||
      "";
    const expectedSecret = process.env.ADMIN_SECRET || "";

    if (expectedSecret && headerSecret !== expectedSecret) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res
          .status(400)
          .json({ ok: false, error: "Invalid JSON body" });
      }
    }

    const id = body?.id;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Missing id" });
    }

    const {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE,
      SUPABASE_SERVICE_ROLE_KEY,
    } = process.env;
    const serviceKey = SUPABASE_SERVICE_ROLE || SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !serviceKey) {
      return res
        .status(500)
        .json({ ok: false, error: "Missing Supabase env vars" });
    }

    const url = new URL(`${SUPABASE_URL}/rest/v1/testimonials`);
    url.searchParams.set("id", `eq.${id}`);

    const r = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    const text = await r.text();
    if (!r.ok) {
      console.error("delete-testimonial supabase error", r.status, text);
      return res.status(r.status).json({
        ok: false,
        error: "supabase_error",
        details: text,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("API Error in delete-testimonial:", e);
    return res.status(500).json({
      ok: false,
      error: "Function crashed",
      details: e?.message || String(e),
    });
  }
}
