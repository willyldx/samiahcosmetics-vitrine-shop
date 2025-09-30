
# Samiah Cosmetics — Vitrine + WhatsApp (starter)

Site statique prêt pour Vercel. Modifiez `data/products.json` pour ajouter des produits (titre, prix, image, catégorie, villes).

## Déploiement sur Vercel
1. Créez un dépôt GitHub et uploadez tout le dossier.
2. Sur Vercel: **New Project** → Importez votre repo → Framework: **Other** → Output directory: `.`
3. Une fois déployé, allez dans **Settings → Domains** et ajoutez `samiahcosmetics.com`.
4. Chez Namecheap (DNS), créez :
   - **A** @ → `76.76.21.21`
   - **CNAME** `www` → `cname.vercel-dns.com`
5. Attendez la propagation (quelques minutes) → HTTPS auto.

## Édition du catalogue
- Fichier: `data/products.json`.
- Les boutons **WhatsApp** se remplissent automatiquement avec le nom et le prix.
