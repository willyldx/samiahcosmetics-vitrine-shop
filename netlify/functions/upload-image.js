// netlify/functions/upload-image.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET        = process.env.SUPABASE_BUCKET || "site-images";
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { Allow: "POST" }, body: "Method Not Allowed" };
  }
  try {
    const { filename, contentBase64 } = JSON.parse(event.body || "{}");
    if (!filename || !contentBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: "filename & contentBase64 requis" }) };
    }

    const b64 = contentBase64.includes(",") ? contentBase64.split(",")[1] : contentBase64;
    const buf = Buffer.from(b64, "base64");
    const ext = (filename.split(".").pop() || "jpg").toLowerCase();
    const ct  = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    // upload (upsert pour écraser si même nom)
    const { error } = await sb.storage.from(BUCKET).upload(filename, buf, { contentType: ct, upsert: true });
    if (error) throw error;

    const siteUrl = ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(filename)};
    return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: true, siteUrl }) };
  } catch (e) {
    return { statusCode: 500, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: e.message || String(e) }) };
  }
}
