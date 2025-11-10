// api/admin/list-testimonials.js
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    // --- Auth admin (même logique que produits)
    const headerSecret =
      req.headers["x-admin-secret"] ||
      req.headers["X-Admin-Secret"] ||
      "";
    const expectedSecret = process.env.ADMIN_SECRET || "";

    if (expectedSecret && headerSecret !== expectedSecret) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // --- Supabase env
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

    // --- Appel REST vers la table testimonials
    const url = new URL(`${SUPABASE_URL}/rest/v1/testimonials`);
    // adapte les colonnes si ton SQL est différent
    url.searchParams.set(
      "select",
      "id,author,message,city,rating,active,created_at"
    );
    url.searchParams.set("order", "created_at.desc");

    const r = await fetch(url.toString(), {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
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
      return res.status(r.status).json({
        ok: false,
        error: "Supabase error",
        details: text,
      });
    }

    return res.status(200).json({ ok: true, items: data });
  } catch (e) {
    console.error("list-testimonials error", e);
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: e.message || String(e),
    });
  }
}
