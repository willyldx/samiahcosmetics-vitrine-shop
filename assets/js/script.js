// === Supabase (use module import) ===
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// ⚙️ Renseigne tes clés (celles que tu m’as données)
const SUPABASE_URL = 'https://dzzblqlteirtzyegplgu.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6emJscWx0ZWlydHp5ZWdwbGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjgyMDgsImV4cCI6MjA3NTAwNDIwOH0.WbjNAjF2qxly8QMu-3VJLPQE88UgzkeAn9XPj0lcb1Y'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// === Helpers UI ===
const $ = s => document.querySelector(s)
const $$ = s => Array.from(document.querySelectorAll(s))
const fmt = n => new Intl.NumberFormat('fr-FR').format(n)

// Éléments de la vitrine
const grid = $('#products-grid')
const emptyMsg = $('#emptyMsg')
const searchEl = $('#search')
const catEl = $('#category')
const cityEl = $('#city')

// Éléments de la modale (IDs pm*)
const modal = $('#productModal')
const pmClose = $('#pmClose')
const pmClose2 = $('#pmClose2')
const pmTitle = $('#pmTitle')
const pmPrice = $('#pmPrice')
const pmBadges = $('#pmBadges')
const pmDesc = $('#pmDesc')
const pmCities = $('#pmCities')
const pmWhatsApp = $('#pmWhatsApp')
const pmSlides = $('#pmSlides')
const pmDots = $('#pmDots')
const pmPrev = $('#pmPrev')
const pmNext = $('#pmNext')

// État courant
let allProducts = []
let filtered = []
let currentIndex = -1

// =======================
//  Chargement des produits
// =======================
async function fetchProducts () {
  // On lit les produits actifs + leurs images associées (table product_images)
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, title, price, currency, category, shortDescription, image, cities,
      active, expiresAfterDays, long_description, created_at,
      product_images ( url, sort )
    `)
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erreur Supabase:', error)
    showEmpty(true, `(erreur: ${error.message})`)
    return
  }

  allProducts = Array.isArray(data) ? data : []
  // remplit la liste des catégories
  fillCategories()
  // rend la grille
  applyFiltersAndRender()
}

function fillCategories () {
  const cats = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean))).sort()
  // garde “Toutes”
  const current = catEl.value || 'Toutes'
  catEl.innerHTML = `<option value="Toutes">Toutes les catégories</option>` +
    cats.map(c => `<option>${escapeHtml(c)}</option>`).join('')
  catEl.value = current
}

function applyFiltersAndRender () {
  const q = (searchEl.value || '').toLowerCase().trim()
  const cat = catEl.value || 'Toutes'
  const city = (cityEl.value || 'Toutes').trim()

  filtered = allProducts.filter(p => {
    const okQ = (p.title + ' ' + (p.category || '') + ' ' + (p.shortDescription || '')).toLowerCase().includes(q)
    const okC = (cat === 'Toutes') || (p.category === cat)
    const okCity = (city === 'Toutes') || ((p.cities || []).includes(city))
    return okQ && okC && okCity
  })

  renderGrid()
}

function renderGrid () {
  grid.innerHTML = filtered.map(p => cardTpl(p)).join('')
  // click sur une carte => ouvre la modale
  $$('button[data-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-open')
      const idx = filtered.findIndex(x => x.id === id)
      if (idx >= 0) openModalAt(idx)
    })
  })

  showEmpty(filtered.length === 0)
}

function showEmpty (isEmpty, extra = '') {
  if (!emptyMsg) return
  emptyMsg.style.display = isEmpty ? 'block' : 'none'
  if (extra) emptyMsg.textContent = `Aucun produit pour l’instant ${extra}`.trim()
}

// Carte produit
function cardTpl (p) {
  const price = typeof p.price === 'number' ? `${fmt(p.price)} ${p.currency || 'XAF'}` : ''
  const img = safeFirstImage(p)
  return `
  <div class="card">
    <img src="${escapeAttr(img)}" alt="${escapeAttr(p.title || '')}">
    <div class="p">
      <div class="title">${escapeHtml(p.title || '')}</div>
      <div class="muted">${escapeHtml(p.category || '')}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
        <div style="font-weight:700">${escapeHtml(price)}</div>
        <button class="btn secondary" data-open="${escapeAttr(p.id)}">Voir</button>
      </div>
    </div>
  </div>
  `
}

function safeFirstImage (p) {
  const img = p?.image
  const extras = (p?.product_images || []).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
  const firstExtra = extras[0]?.url
  return img || firstExtra || '/assets/images/placeholder.png'
}

// =======================
//  Modale fiche produit
// =======================
function openModalAt (idx) {
  currentIndex = idx
  const p = filtered[currentIndex]
  if (!p) return

  // titre / prix / badges
  pmTitle.textContent = p.title || ''
  pmPrice.textContent = typeof p.price === 'number' ? `${fmt(p.price)} ${p.currency || 'XAF'}` : ''
  pmBadges.innerHTML = ''
  if (p.category) pmBadges.innerHTML += `<span class="pm-badge">${escapeHtml(p.category)}</span>`
  if (Array.isArray(p.cities) && p.cities.length) {
    pmBadges.innerHTML += `<span class="pm-badge">${escapeHtml(p.cities.slice(0,3).join(', '))}${p.cities.length>3?'…':''}</span>`
  }

  pmDesc.textContent = p.long_description || p.shortDescription || ''
  pmCities.textContent = Array.isArray(p.cities) && p.cities.length
    ? `Villes : ${p.cities.join(', ')}`
    : ''

  // lien WhatsApp
  const msg = encodeURIComponent(`Bonjour Samiah Cosmetics, je suis intéressé(e) par ${p.title || ''} (${typeof p.price==='number' ? fmt(p.price)+' '+(p.currency||'XAF') : ''}).`)
  pmWhatsApp.href = `https://wa.me/23562752105?text=${msg}`

  // images = image principale + product_images triées
  const images = []
  if (p.image) images.push(p.image)
  const extras = (p.product_images || []).slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
  for (const e of extras) if (e?.url && !images.includes(e.url)) images.push(e.url)
  if (!images.length) images.push('/assets/images/placeholder.png')

  // slides + dots
  pmSlides.innerHTML = images.map((url, i) => `<img src="${escapeAttr(url)}" alt="" class="${i===0?'active':''}">`).join('')
  pmDots.innerHTML = images.map((_, i) => `<button data-i="${i}" class="${i===0?'active':''}" aria-label="Aller à l’image ${i+1}"></button>`).join('')

  // interactions dots
  $$('#pmDots button').forEach(btn => {
    btn.onclick = () => setActiveSlide(parseInt(btn.dataset.i, 10))
  })

  // boutons nav
  pmPrev.onclick = () => navigate(-1)
  pmNext.onclick = () => navigate(+1)

  // fermer
  pmClose.onclick = closeModal
  if (pmClose2) pmClose2.onclick = closeModal
  document.addEventListener('keydown', onEscOnce, { once: true })

  // afficher
  modal.classList.add('show')
  modal.setAttribute('aria-hidden', 'false')
}

function closeModal () {
  modal.classList.remove('show')
  modal.setAttribute('aria-hidden', 'true')
}

function onEscOnce (e) {
  if (e.key === 'Escape') closeModal()
}

function setActiveSlide (idx) {
  const imgs = $$('#pmSlides img')
  const dots = $$('#pmDots button')
  if (!imgs.length) return
  imgs.forEach((im, i) => im.classList.toggle('active', i === idx))
  dots.forEach((d, i) => d.classList.toggle('active', i === idx))
}

function navigate (dir) {
  // navigation d’images
  const imgs = $$('#pmSlides img')
  if (imgs.length) {
    const cur = imgs.findIndex(im => im.classList.contains('active'))
    const next = (cur + dir + imgs.length) % imgs.length
    setActiveSlide(next)
    return
  }
  // navigation de produit (si besoin)
}

// =======================
//  Filtre & évènements
// =======================
searchEl?.addEventListener('input', applyFiltersAndRender)
catEl?.addEventListener('change', applyFiltersAndRender)
cityEl?.addEventListener('change', applyFiltersAndRender)

// =======================
//  Realtime (auto refresh)
// =======================
function setupRealtime () {
  // produits
  supabase
    .channel('realtime:products')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchProducts())
    .subscribe()

  // images
  supabase
    .channel('realtime:product_images')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'product_images' }, () => fetchProducts())
    .subscribe()
}

// =======================
//  Utils
// =======================
function escapeHtml (s) {
  return (s || '').toString().replace(/[&<>"']/g, c => (
    { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
  ))
}
function escapeAttr (s) {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

// Démarrage
fetchProducts()
setupRealtime()
