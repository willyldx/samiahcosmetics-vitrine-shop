// api/admin/delete-testimonial.js
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

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { id } = body || {};
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
}
