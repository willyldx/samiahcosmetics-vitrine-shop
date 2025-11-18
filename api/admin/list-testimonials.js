// api/admin/list-testimonials.js
// ========================================
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
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

    const { data, error } = await sb
      .from("testimonials")
      .select("id, client_name, city, rating, message, photos, photo_url, active, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("list-testimonials error:", error);
      return res.status(500).json({ error: error.message });
    }

    // Normalise pour l'admin
    const items = (data || []).map(t => ({
      id: t.id,
      authorName: t.client_name,
      city: t.city,
      rating: t.rating,
      message: t.message,
      photoUrl: t.photo_url || (Array.isArray(t.photos) && t.photos[0]) || null,
      active: t.active,
      createdAt: t.created_at
    }));

    return res.status(200).json({ items });
  } catch (e) {
    console.error('[list-testimonials] Crash:', e);
    return res.status(500).json({ error: 'server_error', details: e.message });
  }
}
