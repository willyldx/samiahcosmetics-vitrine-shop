// netlify/functions/upload-image.js

const json = (code, body) => ({
  statusCode: code,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-admin-secret",
    "access-control-allow-methods": "OPTIONS,POST",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  // Préflight CORS
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  try {
    const { ADMIN_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SB_BUCKET } =
      process.env;
    const BUCKET = SB_BUCKET || "site-images";

    if (!ADMIN_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Server env vars missing" });
    }

    const headerSecret =
      event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"] || "";
    if (headerSecret !== ADMIN_SECRET) {
      return json(401, { error: "Unauthorized" });
    }

    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const { filename, contentBase64 } = payload;
    if (!filename || !contentBase64) {
      return json(400, { error: "filename & contentBase64 required" });
    }

    const bin = Buffer.from(contentBase64, "base64");

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(
      BUCKET
    )}/${encodeURIComponent(filename)}`;

    const up = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
      },
      body: bin,
    });

    const upText = await up.text();
    if (!up.ok) {
      let errJson;
      try {
        errJson = JSON.parse(upText);
      } catch {
        errJson = { __text: upText };
      }
      return json(500, {
        error: "Upload failed",
        details: errJson,
        status: up.status,
      });
    }

    // URL publique (bucket configuré en "public" côté Supabase)
    const siteUrl = `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(
      BUCKET
    )}/${encodeURIComponent(filename)}`;

    return json(200, { ok: true, siteUrl });
  } catch (e) {
    return json(500, { error: "Function crashed", details: String(e) });
  }
};
