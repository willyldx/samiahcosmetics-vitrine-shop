// /api/upload-image.js
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let payload;
  try { payload = await readJson(req); } catch { return res.status(400).json({ error: 'JSON invalide' }); }
  let { filename, contentBase64 } = payload || {};
  if (!filename || !contentBase64) {
    return res.status(400).json({ error: 'filename et contentBase64 requis' });
  }
  if (contentBase64.includes(',')) contentBase64 = contentBase64.split(',')[1]; // support data URL

  const owner  = process.env.REPO_OWNER  || process.env.VERCEL_GIT_REPO_OWNER;
  const repo   = process.env.REPO_NAME   || process.env.VERCEL_GIT_REPO_SLUG;
  const branch = process.env.TARGET_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'main';
  const token  = process.env.GITHUB_TOKEN;
  const dir    = process.env.UPLOADS_DIR || 'assets/uploads';

  const missing = [];
  if (!owner) missing.push('REPO_OWNER');
  if (!repo) missing.push('REPO_NAME');
  if (!token) missing.push('GITHUB_TOKEN');
  if (!process.env.ADMIN_SECRET) missing.push('ADMIN_SECRET');
  if (missing.length) return res.status(500).json({ error: 'Config manquante', missing });

  try {
    const safe = String(filename).replace(/[^a-z0-9._-]+/gi, '_');
    const path = `${dir}/${safe}`;

    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const r = await fetch(putUrl, {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'vercel-fn' },
      body: JSON.stringify({ message: `chore(admin): upload ${safe}`, content: contentBase64, branch })
    });

    if (!r.ok) return res.status(r.status).json(await safeJson(r));
    return res.status(200).json({ ok: true, siteUrl: `/${path}` });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: String(e) });
  }
};

function readJson(req){
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => (d += c));
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (e) { reject(e); } });
  });
}
async function safeJson(r){ try { return await r.json(); } catch { return { text: await r.text() }; } }
