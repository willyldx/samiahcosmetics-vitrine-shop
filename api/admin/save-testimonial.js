// api/admin/save-testimonial.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

export default async function handler(req, res) {
  console.log("[save-testimonial] Start", { method: req.method });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth
  const headerSecret = req.headers["x-admin-secret"] || req.headers["X-Admin-Secret"];
  if (!ADMIN_SECRET || headerSecret !== ADMIN_SECRET) {
    console.warn("[save-testimonial] Unauthorized");
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Parse body
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch (e) {
    console.error("[save-testimonial] Invalid JSON", e);
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { testimonial } = body;
  if (!testimonial) {
    return res.status(400).json({ error: "Missing testimonial object" });
  }

  // Validation
  if (!testimonial.authorName && !testimonial.client_name) {
    return res.status(400).json({ error: "client_name is required" });
  }
  if (!testimonial.message) {
    return res.status(400).json({ error: "message is required" });
  }

  // Normalisation : on mappe authorName -> client_name
  const row = {
    client_name: testimonial.authorName || testimonial.client_name,
    city: testimonial.city || null,
    rating: typeof testimonial.rating === "number" ? testimonial.rating : null,
    message: testimonial.message,
    photo_url: testimonial.photoUrl || null,  // ✅ String, pas array
    active: testimonial.active !== false
  };

  console.log("[save-testimonial] Row to save:", row);

  let result;
  if (testimonial.id) {
    // UPDATE
    result = await sb
      .from("testimonials")
      .update(row)
      .eq("id", testimonial.id)
      .select()
      .single();
  } else {
    // INSERT
    result = await sb
      .from("testimonials")
      .insert(row)
      .select()
      .single();
  }

  const { data, error } = result;
  
  if (error) {
    console.error("[save-testimonial] Supabase error:", error);
    return res.status(500).json({ 
      error: error.message,
      details: error.details,
      hint: error.hint 
    });
  }

  console.log("[save-testimonial] Success", data);
  return res.status(200).json({ item: data });
}
