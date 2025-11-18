// netlify/functions/upload-image.js
// ========================================
const json6 = (body, code = 200) => ({
  statusCode: code,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-admin-secret",
  },
  body: JSON.stringify(body),
});

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: json6({}).headers };
    }
    if (event.httpMethod !== "POST") {
      return json6({ error: "Method Not Allowed" }, 405);
    }

    const { ADMIN_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SB_BUCKET } = process.env;
    if (!ADMIN_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json6({ error: "Server env vars missing" }, 500);
    }

    const clientSecret = event.headers["x-admin-secret"] || event.headers["x-Admin-Secret"] || "";
    if (clientSecret !== ADMIN_SECRET) {
      return json6({ error: "Unauthorized" }, 401);
    }

    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json6({ error: "Invalid JSON body" }, 400);
    }

    const { filename, contentBase64 } = payload;
    if (!filename || !contentBase64) {
      return json6({ error: "filename & contentBase64 required" }, 400);
    }

    // ✅ AMÉLIORATION : Limite de taille (4 MB en base64)
    if (contentBase64.length > 5_500_000) {
      return json6({ error: "Image too large (max 4MB)" }, 413);
    }

    const bin = Buffer.from(contentBase64, "base64");
    const bucket = SB_BUCKET || "product-images";
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(
      bucket
    )}/${encodeURIComponent(filename)}`;

    const r = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
      },
      body: bin,
    });

    if (!r.ok) {
      const txt = await r.text();
      return json6({ error: "Upload failed", details: txt }, 500);
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(
      bucket
    )}/${encodeURIComponent(filename)}`;

    return json6({ ok: true, siteUrl: publicUrl });
  } catch (e) {
    console.error("[upload-image] Crash:", e);
    return json6({ error: "server_error", details: e.message }, 500);
  }
}
