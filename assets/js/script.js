// Samiah Vitrine — vitrine + fiche produit (fix alias Supabase)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = 'https://dzzblqlteirtzyegplgu.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6emJscWx0ZWlydHp5ZWdwbGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjgyMDgsImV4cCI6MjA3NTAwNDIwOH0.WbjNAjF2qxly8QMu-3VJLPQE88UgzkeAn9XPj0lcb1Y'
const sb = createClient(SUPABASE_URL, SUPABASE_ANON)

// ---- DOM (IDs requis dans index.html)
const grid     = document.getElementById('products-grid')
const emptyMsg = document.getElementById('emptyMsg')

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

const elSearch = document.getElementById('search')
const elCat    = document.getElementById('category')
const elCity   = document.getElementById('city')

let allProducts = []
let viewList = []
let currentIdx = -1

const fmt = n => new Intl.NumberFormat('fr-FR').format(n)
const priceLabel = p => (p?.price ? `${fmt(p.price)} ${p.currency || 'XAF'}` : '—')

const escapeHtml = s => (''+(s??'')).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))

const asArray = (x)=>{
  if (!x) return []
  if (Array.isArray(x)) return x
  if (typeof x === 'string') {
    try { const v = JSON.parse(x); return Array.isArray(v) ? v : [] } catch { return [] }
  }
  return []
}
const buildImages = p => {
  const arr = []
  if (p.image) arr.push(p.image)
  for (const u of asArray(p.images)) if (u && !arr.includes(u)) arr.push(u)
  return arr
}

// ---- Affichage "vide"
function showEmpty(msg) {
  grid.innerHTML = ''
  if (emptyMsg) {
    emptyMsg.style.display = ''
    emptyMsg.textContent = msg ? `Aucun produit pour l’instant (erreur: ${msg})` : 'Aucun produit pour l’instant.'
  }
}
function hideEmpty(){ if (emptyMsg) emptyMsg.style.display='none' }

// ---- Chargement robuste (alias + fallback)
async function loadProducts(){
  const selects = [
    // 1) alias correct PostgREST : colonne:alias
    'id,title,price,currency,category,short_description:shortDescription,image,images,cities,active,created_at',
    // 2) si ta colonne s’appelle déjà shortDescription
    'id,title,price,currency,category,shortDescription,image,images,cities,active,created_at'
  ]

  let data=null, lastErr=null
  for (const cols of selects){
    // tentative avec tri sur created_at
    let r = await sb.from('products').select(cols).eq('active', true).order('created_at', { ascending:false })
    if (r.error && /created_at/i.test(r.error.message||'')) {
      // table sans created_at : on ré-essaie sans tri
      r = await sb.from('products').select(cols).eq('active', true)
    }
    if (!r.error){ data = r.data||[]; break }
    lastErr = r.error
  }

  if (!data){
    showEmpty(lastErr?.message || 'chargement')
    return
  }

  allProducts = data.map(p=>({
    ...p,
    shortDescription: p.shortDescription || '',
    cities: Array.isArray(p.cities) ? p.cities : []
  }))

  // Remplir catégories
  const cats = Array.from(new Set(allProducts.map(p=>p.category).filter(Boolean))).sort()
  elCat.innerHTML = `<option value="Toutes">Toutes les catégories</option>` + cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('')

  applyFiltersAndRender()
}

// ---- Rendu Grille
function applyFiltersAndRender(){
  const q    = (elSearch?.value || '').toLowerCase().trim()
  const cat  = elCat?.value || 'Toutes'
  const city = elCity?.value || 'Toutes'

  viewList = allProducts.filter(p=>{
    const okQ = !q || (p.title + ' ' + (p.category||'') + ' ' + (p.shortDescription||'')).toLowerCase().includes(q)
    const okC = (cat==='Toutes') || p.category===cat
    const okV = (city==='Toutes') || (Array.isArray(p.cities) && p.cities.includes(city))
    return okQ && okC && okV
  })

  if (!viewList.length) { showEmpty(); return }
  hideEmpty()
  grid.innerHTML = viewList.map((p,i)=>cardTpl(p,i)).join('')
}

function cardTpl(p,i){
  const img = buildImages(p)[0] || '/assets/images/placeholder.png'
  return `
  <div class="card product-card" data-index="${i}" style="cursor:pointer">
    <img src="${img}" alt="${escapeHtml(p.title)}">
    <div class="p">
      <div class="t">${escapeHtml(p.title)}</div>
      <div class="muted">${escapeHtml(p.category||'')}</div>
      <div class="muted" style="font-weight:700">${priceLabel(p)}</div>
    </div>
  </div>`
}

// ---- Modale
function openModalAt(i){
  if (!modal || !overlay) { alert('Fiche produit indisponible (modale manquante).'); return }
  if (i<0 || i>=viewList.length) return
  currentIdx = i
  const p = viewList[i]
  const imgs = buildImages(p)
  mTitle && (mTitle.textContent = p.title || 'Produit')
  mMain  && (mMain.src = imgs[0] || '/assets/images/placeholder.png')
  mPrice && (mPrice.textContent = priceLabel(p))
  mCat   && (mCat.textContent = p.category || '')
  mDesc  && (mDesc.textContent = p.shortDescription || '')
  mCities&& (mCities.textContent = (Array.isArray(p.cities)&&p.cities.length) ? `Villes: ${p.cities.join(', ')}` : '')

  const waMsg = encodeURIComponent(`Bonjour Samiah Cosmetics, je suis intéressé(e) par ${p.title} (${priceLabel(p)}).`)
  if (mWhatsApp) mWhatsApp.href = `https://wa.me/23562752105?text=${waMsg}`

  if (mThumbs) {
    mThumbs.innerHTML = imgs.map((u,k)=>`<img data-k="${k}" src="${u}" alt="" style="width:72px;height:72px;object-fit:cover;border:1px solid #eee;border-radius:8px;cursor:pointer">`).join('')
  }

  overlay.style.display='block'
  modal.style.display='flex'
}
function closeModal(){ if(!modal||!overlay) return; modal.style.display='none'; overlay.style.display='none'; currentIdx=-1 }
function nextModal(dir=+1){ if(currentIdx<0) return; const n=currentIdx+dir; if(n>=0 && n<viewList.length) openModalAt(n) }

// ---- Events
function bind(){
  elSearch?.addEventListener('input', applyFiltersAndRender)
  elCat?.addEventListener('change', applyFiltersAndRender)
  elCity?.addEventListener('change', applyFiltersAndRender)

  grid?.addEventListener('click', e=>{
    const card = e.target.closest('.product-card')
    if (!card) return
    const i = parseInt(card.dataset.index,10)
    if (Number.isFinite(i)) openModalAt(i)
  })

  mThumbs?.addEventListener('click', e=>{
    const t = e.target.closest('img[data-k]')
    if (!t) return
    const k = parseInt(t.dataset.k,10)
    const p = viewList[currentIdx]
    const imgs = buildImages(p)
    if (imgs[k] && mMain) mMain.src = imgs[k]
  })

  mPrev?.addEventListener('click', ()=>nextModal(-1))
  mNext?.addEventListener('click', ()=>nextModal(+1))
  mClose?.addEventListener('click', closeModal)
  overlay?.addEventListener('click', closeModal)

  document.addEventListener('keydown', e=>{
    if (e.key==='Escape') closeModal()
    if (e.key==='ArrowLeft')  nextModal(-1)
    if (e.key==='ArrowRight') nextModal(+1)
  })
}

bind()
loadProducts()
