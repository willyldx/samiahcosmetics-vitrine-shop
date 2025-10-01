export default function handler(req, res) {
  const keys = ['GITHUB_TOKEN','REPO_OWNER','REPO_NAME','TARGET_BRANCH','PRODUCTS_PATH','ADMIN_SECRET'];
  const present = Object.fromEntries(keys.map(k => [k, !!process.env[k]]));
  res.status(200).json({ present });
}
