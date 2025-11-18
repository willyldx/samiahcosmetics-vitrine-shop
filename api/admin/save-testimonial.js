// api/admin/save-testimonial.js
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
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const { testimonial } = body;
    if (!testimonial) {
      return res.status(400).json({ error: "Missing testimonial object" });
    }

    if (!testimonial.authorName && !testimonial.client_name) {
      return res.status(400).json({ error: "client_name is required" });
    }
    if (!testimonial.message) {
      return res.status(400).json({ error: "message is required" });
    }

    // Gère photoUrl (string) → photos (array)
    let photosArray = null;
    if (testimonial.photoUrl) {
      photosArray = [testimonial.photoUrl];
    }

    const row = {
      client_name: testimonial.authorName || testimonial.client_name,
      city: testimonial.city || null,
      rating: typeof testimonial.rating === "number" ? testimonial.rating : null,
      message: testimonial.message,
      photos: photosArray,
      active: testimonial.active !== false
    };

    let result;
    if (testimonial.id) {
      result = await sb
        .from("testimonials")
        .update(row)
        .eq("id", testimonial.id)
        .select()
        .single();
    } else {
      result = await sb
        .from("testimonials")
        .insert(row)
        .select()
        .single();
    }

    const { data, error } = result;
    
    if (error) {
      console.error("[save-testimonial] error:", error);
      return res.status(500).json({ 
        error: error.message,
        details: error.details,
        hint: error.hint 
      });
    }

    const normalized = {
      ...data,
      authorName: data.client_name,
      photoUrl: Array.isArray(data.photos) && data.photos[0] ? data.photos[0] : null
    };
    
    return res.status(200).json({ item: normalized });
  } catch (e) {
    console.error('[save-testimonial] Crash:', e);
    return res.status(500).json({ error: 'server_error', details: e.message });
  }
}
