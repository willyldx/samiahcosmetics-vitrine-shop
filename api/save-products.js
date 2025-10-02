// /api/save-products.js
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let body;
  try { body = await readJson(req); } catch { return res.status(400).json({ error: 'JSON invalide' }); }
  const products = body && body.products;
  if (!Array.isArray(products)) {
    return res.status(400).json({ error: 'Payload invalide: "products" doit être un tableau' });
  }

  const owner  = process.env.REPO_OWNER  || process.env.VERCEL_GIT_REPO_OWNER;
  const repo   = process.env.REPO_NAME   || process.env.VERCEL_GIT_REPO_SLUG;
  const branch = process.env.TARGET_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'main';
  const path   = process.env.PRODUCTS_PATH || 'data/products.json';
  const token  = process.env.GITHUB_TOKEN;

  const missing = [];
  if (!owner) missing.push('REPO_OWNER');
  if (!repo) missing.push('REPO_NAME');
  if (!token) missing.push('GITHUB_TOKEN');
  if (!process.env.ADMIN_SECRET) missing.push('ADMIN_SECRET');
  if (missing.length) return res.status(500).json({ error: 'Config manquante', missing });

  const contentB64 = Buffer.from(JSON.stringify(products, null, 2) + '\n', 'utf8').toString('base64');

  try {
    // 1) lire le SHA existant (si fichier déjà présent)
    let sha;
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
    const getResp = await fetch(getUrl, { headers: { Authorization: `token ${token}`, 'User-Agent': 'vercel-fn' } });
    if (getResp.ok) { const j = await getResp.json(); sha = j && j.sha; }
    else if (getResp.status !== 404) {
      return res.status(getResp.status).json(await safeJson(getResp));
    }

    // 2) PUT (create/update)
    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const putResp = await fetch(putUrl, {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'vercel-fn' },
      body: JSON.stringify({ message: 'chore(admin): publish products.json via Admin Pro', content: contentB64, branch, ...(sha ? { sha } : {}) })
    });

    if (!putResp.ok) return res.status(putResp.status).json(await safeJson(putResp));
    const result = await putResp.json();
    return res.status(200).json({ ok: true, commit: (result && result.commit && result.commit.sha) || null });
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
