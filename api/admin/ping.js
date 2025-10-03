module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const key = req.headers['x-admin-secret'];
  if (!key || key !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'unauthorized' });
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ ok: true });
};
