// api/admin/save-testimonial.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const headerSecret = req.headers["x-admin-secret"] || req.headers["X-Admin-Secret"];
  if (!ADMIN_SECRET || headerSecret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let payload;
  try {
    payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const {
    id,
    name,
    client_name,
    city,
    location,
    rating,
    note,
    message,
    quote,
    text,
    photos,
    images,
    photo_urls,
    active
  } = payload || {};

  // Normalisation vers les colonnes de la table "testimonials"
  const row = {
    client_name: client_name || name || null,
    city: city || location || null,
    rating: typeof rating === "number" ? rating
          : typeof note === "number"    ? note
          : null,
    message: message || quote || text || "",
    // photos -> colonne JSONB "photos"
    photos: Array.isArray(photos)
      ? photos
      : Array.isArray(images)
        ? images
        : Array.isArray(photo_urls)
          ? photo_urls
          : photos || images || photo_urls || null,
    active: active !== false
  };

  let result;
  if (id) {
    // update / upsert
    result = await sb
      .from("testimonials")
      .upsert({ id, ...row }, { onConflict: "id" })
      .select()
      .single();
  } else {
    // insert
    result = await sb
      .from("testimonials")
      .insert(row)
      .select()
      .single();
  }

  const { data, error } = result;
  if (error) {
    console.error("save-testimonial error:", error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ item: data });
}
