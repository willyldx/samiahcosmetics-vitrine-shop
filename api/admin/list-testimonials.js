// api/admin/list-testimonials.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const headerSecret = req.headers["x-admin-secret"] || req.headers["X-Admin-Secret"];
  if (!ADMIN_SECRET || headerSecret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { data, error } = await sb
    .from("testimonials")
    .select("id, client_name, city, rating, message, photos, active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("list-testimonials error:", error);
    return res.status(500).json({ error: error.message });
  }

  // ✅ On normalise pour l'admin : photos[0] → photoUrl
  const items = (data || []).map(t => ({
    id: t.id,
    authorName: t.client_name,
    city: t.city,
    rating: t.rating,
    message: t.message,
    photoUrl: Array.isArray(t.photos) && t.photos.length > 0 
      ? t.photos[0] 
      : null,
    active: t.active,
    createdAt: t.created_at
  }));

  return res.status(200).json({ items });
}
