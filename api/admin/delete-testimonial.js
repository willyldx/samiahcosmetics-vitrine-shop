// api/admin/delete-testimonial.js
// ========================================
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SECRET } = process.env;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Missing env vars' });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const headerSecret = req.headers["x-admin-secret"] || req.headers["X-Admin-Secret"] || "";
    if (ADMIN_SECRET && headerSecret !== ADMIN_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const { id } = body;
    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    const { error } = await sb
      .from("testimonials")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("delete-testimonial error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[delete-testimonial] Crash:', e);
    return res.status(500).json({ error: 'server_error', details: e.message });
  }
}
