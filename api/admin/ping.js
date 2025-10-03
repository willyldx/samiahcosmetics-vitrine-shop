export default async function handler(req, res) {
  const ok =
    !!process.env.SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE &&
    !!process.env.ADMIN_SECRET;
  res.status(ok ? 200 : 500).json({
    ok,
    present: {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
      ADMIN_SECRET: !!process.env.ADMIN_SECRET
    }
  });
}
