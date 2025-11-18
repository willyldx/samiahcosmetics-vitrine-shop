// api/ping.js
// ========================================
export default async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      ADMIN_SECRET: !!process.env.ADMIN_SECRET,
    },
  });
}
