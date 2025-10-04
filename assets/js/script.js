// --- Samiah Vitrine — script vitrine + fiche produit ---
// Remplace tout le contenu de /assets/js/script.js par CE fichier

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 1) Supabase client (clé publique côté client = OK)
const SUPABASE_URL = 'https://dzzblqlteirtzyegplgu.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6emJscWx0ZWlydHp5ZWdwbGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjgyMDgsImV4cCI6MjA3NTAwNDIwOH0.WbjNAjF2qxly8QMu-3VJLPQE88UgzkeAn9XPj0lcb1Y'
const sb = createClient(SUPABASE_URL, SUPABASE_ANON)

// 2) Raccourcis DOM (IDs EXACTS attendus dans index.html)
const grid     = document.getElementById('products-grid')
const emptyMsg = document.getElementById('emptyMsg')

// Éléments de la modale (IDs exacts)
const overlay   = document.getElementById('overlay')
const modal     = document.getElementById('productModal')
const mTitle    = document.getElementById('mTitle')
const mMain     = document.getElementById('mMain')
const mThumbs   = document.getElementById('mThumbs')
const mPrice    = document.getElementById('mPrice')
const mCat      = document.getElementById('mCat')
const mDesc     = document.getElementById('mDesc')
const mCities   = document.getElementById('mCities')
const mWhatsApp = document.getElementById('mWhatsApp')
const mPrev     = document.getElementById('mPrev')
const mNext     = document.getElementById('mNext')
const mClose    = document.getElementById('mClose')

// Filtres
const elSearch  = document.getElementById('search')
const elCat     = document.getElementById('category')
const elCity    = document.getElementById('city')

// État local
let allProducts = []      // tous les produits actifs chargés
let viewList    = []      // liste filtrée affichée
let currentIdx  = -1      // index courant dans viewList (pour Préc/Suiv)

// -------- Utils
const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n)
const priceLabel = (p) => (p?.price ? `${fmt(p.price)} ${p.currency || 'XAF'}` : '—')

const asArray = (x) => {
  if (!x) return []
  if (Array.isArray(x)) return x
  // si JSON text
  if (typeof x === 'string') {
    try {
      const v = JSON.parse(x)
      return Array.isArray(v) ? v : []
    } catch { return [] }
  }
  return []
}

function buildImages(product) {
  // image principale + images[]
  const extra = asArray(product.images)
  const all = []
  if (product.image) all.push(product.image)
  for (const u of extra) if (u && !all.includes(u)) all.push(u)
  return all
}

// -------- Chargement initial
async function loadProducts() {
  // On alias la colonne courte pour ne pas casser si le nom diffère (short_description vs shortDescription)
  const select = `
    id,title,price,currency,category,
    short_description as shortDescription,
    image,images,cities,active
  `
  let data = []
  // Essai avec tri sur created_at si dispo, sinon fallback
  let { data: d1, error: e1 } = await sb.from('products')
    .select(select)
    .eq('active', true)
    .order('created_at', { ascending: false })
  if (e1) {
    const { data: d2, error: e2 } = await sb.from('products')
      .select(select)
      .eq('active', true)
    if (e2) {
      showEmpty(`erreur: ${e2.message}`)
      return
    }
    data = d2 || []
  } else {
    data = d1 || []
  }

  allProducts = data.map(p => ({
    ...p,
    shortDescription: p.shortDescription || '',   // safe
    cities: Array.isArray(p.cities) ? p.cities : [],
  }))

  // Construire la liste de catégories (unique)
  const cats = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean))).sort()
  elCat.innerHTML = `<option value="Toutes">Toutes les catégories</option>` +
    cats.map(c => `<option>${escapeHtml(c)}</option>`).join('')

  applyFiltersAndRender()
}

function showEmpty(msg) {
  grid.innerHTML = ''
  if (emptyMsg) {
    emptyMsg.style.display = ''
    if (msg) emptyMsg.textContent = `Aucun produit pour l’instant (${msg})`
  }
}

function hideEmpty() {
  if (emptyMsg) emptyMsg.style.display = 'none'
}

// -------- Rendu catalogue
function applyFiltersAndRender() {
  const q    = (elSearch?.value || '').toLowerCase().trim()
  const cat  = elCat?.value || 'Toutes'
  const city = elCity?.value || 'Toutes'

  viewList = allProducts.filter(p => {
    const okQ   = !q || (p.title + ' ' + (p.category || '') + ' ' + (p.shortDescription || '')).toLowerCase().includes(q)
    const okCat = (cat === 'Toutes') || p.category === cat
    const okCity = (city === 'Toutes') || (Array.isArray(p.cities) && p.cities.includes(city))
    return okQ && okCat && okCity
  })

  if (!viewList.length) {
    showEmpty() // message par défaut
    return
  }
  hideEmpty()

  grid.innerHTML = viewList.map((p, i) => cardTpl(p, i)).join('')
}

function escapeHtml(s) {
  return ('' + (s ?? '')).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]))
}

function cardTpl(p, i) {
  const img = (buildImages(p)[0] || '/assets/images/placeholder.png')
  return `
  <div class="card product-card" data-index="${i}" style="cursor:pointer">
    <img src="${img}" alt="${escapeHtml(p.title)}">
    <div class="p">
      <div class="t">${escapeHtml(p.title)}</div>
      <div class="muted">${escapeHtml(p.category || '')}</div>
      <div class="muted" style="font-weight:700">${priceLabel(p)}</div>
    </div>
  </div>`
}

// -------- Fiche produit (modale)
function openModalAt(index) {
  if (!modal || !overlay) {
    alert('Fiche produit indisponible (modale manquante).')
    return
  }
  if (index < 0 || index >= viewList.length) return
  currentIdx = index

  const p = viewList[currentIdx]
  const imgs = buildImages(p)
  const main = imgs[0] || '/assets/images/placeholder.png'

  // Texte
  mTitle && (mTitle.textContent = p.title || 'Produit')
  mMain  && (mMain.src = main)
  mPrice && (mPrice.textContent = priceLabel(p))
  mCat   && (mCat.textContent = p.category || '')
  mDesc  && (mDesc.textContent = p.shortDescription || '')
  mCities && (mCities.textContent = Array.isArray(p.cities) && p.cities.length
              ? `Villes: ${p.cities.join(', ')}`
              : '')

  // WhatsApp
  const waMsg = encodeURIComponent(`Bonjour Samiah Cosmetics, je suis intéressé(e) par ${p.title} (${priceLabel(p)}).`)
  if (mWhatsApp) {
    mWhatsApp.href = `https://wa.me/23562752105?text=${waMsg}`
  }

  // Vignettes
  if (mThumbs) {
    mThumbs.innerHTML = imgs.map((u, k) =>
      `<img data-k="${k}" src="${u}" alt="" style="width:72px;height:72px;object-fit:cover;border:1px solid #eee;border-radius:8px;cursor:pointer">`
    ).join('')
  }

  // Affichage
  overlay.style.display = 'block'
  modal.style.display   = 'flex'
}

function closeModal() {
  if (!modal || !overlay) return
  modal.style.display   = 'none'
  overlay.style.display = 'none'
  currentIdx = -1
}

function nextModal(dir = +1) {
  if (currentIdx < 0) return
  const n = currentIdx + dir
  if (n >= 0 && n < viewList.length) {
    openModalAt(n)
  }
}

// -------- Écouteurs
function bindEvents() {
  if (elSearch) elSearch.addEventListener('input', applyFiltersAndRender)
  if (elCat)    elCat.addEventListener('change', applyFiltersAndRender)
  if (elCity)   elCity.addEventListener('change', applyFiltersAndRender)

  // Délégation sur la grille
  grid?.addEventListener('click', (e) => {
    const card = e.target.closest('.product-card')
    if (!card) return
    const i = parseInt(card.dataset.index, 10)
    if (!Number.isFinite(i)) return
    openModalAt(i)
  })

  // Thumbs
  mThumbs?.addEventListener('click', (e) => {
    const img = e.target.closest('img[data-k]')
    if (!img) return
    const k = parseInt(img.dataset.k, 10)
    const p = viewList[currentIdx]
    const imgs = buildImages(p)
    if (imgs[k] && mMain) mMain.src = imgs[k]
  })

  // Nav + Close
  mPrev?.addEventListener('click', () => nextModal(-1))
  mNext?.addEventListener('click', () => nextModal(+1))
  mClose?.addEventListener('click', closeModal)
  overlay?.addEventListener('click', closeModal)

  // ESC ferme
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal()
    if (e.key === 'ArrowLeft')  nextModal(-1)
    if (e.key === 'ArrowRight') nextModal(+1)
  })
}

// -------- Init
bindEvents()
loadProducts()
