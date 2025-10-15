export default async () => {
  return new Response(JSON.stringify({
    ok: true,
    env: {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      ADMIN_SECRET: !!process.env.ADMIN_SECRET
    }
  }), { headers: { "content-type": "application/json" }});
};
