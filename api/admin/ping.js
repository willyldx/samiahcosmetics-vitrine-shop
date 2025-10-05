// /api/admin/ping.js
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  try {
    const adminSecret = req.headers['x-admin-secret'] || '';
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
    const { error } = await sb.from('products').select('id').limit(1);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};
