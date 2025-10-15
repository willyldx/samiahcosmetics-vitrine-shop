export default async (req) => {
  try {
    const ADMIN_SECRET = process.env.ADMIN_SECRET;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!ADMIN_SECRET || !SUPABASE_URL || !SERVICE_KEY) return j(500, { error:"env_missing" });

    if ((req.headers.get("x-admin-secret")||"") !== ADMIN_SECRET) return j(401, { error:"unauthorized" });

    const { id } = await req.json();
    if (!id) return j(400, { error:"missing_id" });

    const url = new URL(`${SUPABASE_URL}/rest/v1/products`);
    url.searchParams.set("id", `eq.${id}`);

    const r = await fetch(url, {
      method: "DELETE",
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`
      }
    });
    if (!r.ok) return j(r.status, { error: await r.text() });
    return j(200, { ok:true });
  } catch(e){ return j(500, { error: e.message }); }
};
const j = (s,o)=> new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json'}});