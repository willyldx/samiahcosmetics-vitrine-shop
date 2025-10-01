// api/save-products.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth très simple (à améliorer si besoin)
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let products = [];
  try {
    const body = await parseJSON(req);
    if (!Array.isArray(body.products)) {
      return res.status(400).json({ error: 'Payload invalide: "products" doit être un tableau' });
    }
    products = body.products;
  } catch (e) {
    return res.status(400).json({ error: 'JSON invalide' });
  }

  const {
    GITHUB_TOKEN,
    REPO_OWNER,
    REPO_NAME,
    TARGET_BRANCH = 'main',
    PRODUCTS_PATH = 'data/products.json',
  } = process.env;

  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
    return res.status(500).json({ error: 'Config manquante côté serveur' });
  }

  const content = JSON.stringify(products, null, 2) + '\n';
  const message = `chore(admin): publish products.json via Admin Pro`;

  try {
    // 1) Récupérer le sha du fichier courant (si existe)
    const getUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${PRODUCTS_PATH}?ref=${TARGET_BRANCH}`;
    const getResp = await fetch(getUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'vercel-fn' },
    });

    let sha = undefined;
    if (getResp.ok) {
      const json = await getResp.json();
      sha = json.sha;
    }

    // 2) Créer / mettre à jour le fichier
    const putUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${PRODUCTS_PATH}`;
    const putBody = {
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch: TARGET_BRANCH,
      sha, // si undefined => création ; sinon maj
    };

    const putResp = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'vercel-fn',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(putBody),
    });

    if (!putResp.ok) {
      const err = await safeJson(putResp);
      return res.status(putResp.status).json({ error: 'GitHub error', details: err });
    }

    const result = await putResp.json();
    return res.status(200).json({ ok: true, commit: result.commit?.sha });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: String(e) });
  }
}

function parseJSON(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch (e) { reject(e); }
    });
  });
}

async function safeJson(resp) {
  try { return await resp.json(); } catch { return await resp.text(); }
}
