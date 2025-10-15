export default async (req) => {
  try {
    const ADMIN_SECRET = process.env.ADMIN_SECRET;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!ADMIN_SECRET || !SUPABASE_URL || !SERVICE_KEY) return j(500, { error:"env_missing" });

    if ((req.headers.get("x-admin-secret")||"") !== ADMIN_SECRET) return j(401, { error:"unauthorized" });

    const url = new URL(`${SUPABASE_URL}/rest/v1/products`);
    url.searchParams.set("select", "id,title,price,currency,category,cities,image,images,short_description,active,created_at,expires_after_days");

    const r = await fetch(url, {
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Accept-Profile": "public"
      }
    });
    if (!r.ok) return j(r.status, { error: await r.text() });
    const items = await r.json();
    return j(200, { items });
  } catch(e){ return j(500, { error: e.message }); }
};
const j = (s,o)=> new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json'}});