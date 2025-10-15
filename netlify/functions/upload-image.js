export default async (req) => {
  try {
    const ADMIN_SECRET = process.env.ADMIN_SECRET;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const BUCKET = process.env.SB_BUCKET || "site-images";

    if (!ADMIN_SECRET || !SUPABASE_URL || !SERVICE_KEY) {
      return json(500, { error: "Server env vars missing" });
    }

    // Sécurité simple (même schéma que ton admin.html)
    const clientSecret = req.headers.get("x-admin-secret") || "";
    if (clientSecret !== ADMIN_SECRET) {
      return json(401, { error: "Unauthorized" });
    }

    const { filename, contentBase64 } = await req.json();
    if (!filename || !contentBase64) {
      return json(400, { error: "filename & contentBase64 required" });
    }

    const bin = Buffer.from(contentBase64, "base64");

    // Upload binaire direct vers Storage
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BUCKET)}/${encodeURIComponent(filename)}`;

    const up = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "image/jpeg",
        "x-upsert": "true"
      },
      body: bin
    });

    if (!up.ok) {
      const txt = await up.text().catch(()=> "");
      return json(up.status, { error: "upload_failed", details: txt });
    }

    // URL publique (si le bucket est "public")
    const siteUrl = `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(BUCKET)}/${encodeURIComponent(filename)}`;
    return json(200, { ok: true, siteUrl });
  } catch (e) {
    return json(500, { error: e.message || "server_error" });
  }
};

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" }
  });
}