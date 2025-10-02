// /api/debug-config.js
export default function handler(req, res) {
  res.status(200).json({
    present: {
      GITHUB_TOKEN: !!process.env.GITHUB_TOKEN,
      REPO_OWNER:   !!process.env.REPO_OWNER || !!process.env.VERCEL_GIT_REPO_OWNER,
      REPO_NAME:    !!process.env.REPO_NAME  || !!process.env.VERCEL_GIT_REPO_SLUG,
      TARGET_BRANCH: !!process.env.TARGET_BRANCH,
      PRODUCTS_PATH: !!process.env.PRODUCTS_PATH,
      ADMIN_SECRET: !!process.env.ADMIN_SECRET
    },
    repo: {
      owner: process.env.REPO_OWNER || process.env.VERCEL_GIT_REPO_OWNER || null,
      name:  process.env.REPO_NAME  || process.env.VERCEL_GIT_REPO_SLUG || null,
      branch: process.env.TARGET_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || null
    }
  });
}
