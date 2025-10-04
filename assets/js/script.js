// ===== Samiah Vitrine — galerie multi-images + product_images =====
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = 'https://dzzblqlteirtzyegplgu.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6emJscWx0ZWlydHp5ZWdwbGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjgyMDgsImV4cCI6MjA3NTAwNDIwOH0.WbjNAjF2qxly8QMu-3VJLPQE88UgzkeAn9XPj0lcb1Y'
const sb = createClient(SUPABASE_URL, SUPABASE_ANON)

// ---------- helpers ----------
const $  = s => document.querySelector(s)
const $$ = s => Array.from(document.querySelectorAll(s))
const fmt = n => new Intl.NumberFormat('fr-FR').format(n)
const priceLabel = p => (p?.price ? `${fmt(p.price)} ${p.currency||'XAF'}` : '—')
const escapeHtml = s => (''+(s??'')).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const arrayify = v => {
  if (!v) return []
  if (Array.isArray(v)) return v
  if (typeof v === 'string') { try { const x=JSON.parse(v); return Array.isArray(x)?x:[] } catch { return [] } }
  return []
}

// ---------- DOM ----------
const grid     = $('#products-grid')
const emptyMsg = $('#emptyMsg')
const elSearch = $('#search')
const elCat    = $('#category')
const elCity   = $('#city')

// ---------- state ----------
let all = []           // tous les produits
let view = []          // produits filtrés
let idx  = -1          // index du produit ouvert dans la modale
let imgIndex = 0       // index de l'image affichée dans la modale

// ---------- ensure modal structure ----------
function ensureModal(){
  if ($('#productModal') && $('#overlay')) return

  const overlay = document.createElement('div')
  overlay.id='overlay'
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;z-index:1000'
  document.body.appendChild(overlay)

  const modal = document.createElement('div')
  modal.id='productModal'
  modal.setAttribute('role','dialog')
  modal.setAttribute('aria-hidden','true')
  modal.style.cssText='position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:1001'
  modal.innerHTML = `
    <div class="modal-card" style="background:#fff;max-width:980px;width:94%;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.25)">
      <div class="modal-head" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #eee">
        <div id="mTitle" style="font-weight:800">Produit</div>
        <button id="mClose" class="btn" style="appearance:none;border:0;border-radius:10px;background:#1111110d;color:#111;border:1px solid #eaeaea;padding:10px 14px;cursor:pointer">Fermer</button>
      </div>
      <div class="modal-body" style="display:grid;grid-template-columns:1.1fr .9fr;gap:16px;padding:14px">
        <div>
          <div class="gal-main" id="mMainBox" style="position:relative;border:1px solid #eee;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff;aspect-ratio:4/3">
            <img id="mMain" src="" alt="" style="max-width:100%;max-height:100%;display:block">
            <button id="mImgPrev" aria-label="Image précédente"
                    style="position:absolute;left:8px;top:50%;transform:translateY(-50%);appearance:none;border:0;background:#00000066;color:#fff;width:36px;height:36px;border-radius:999px;cursor:pointer;display:none">‹</button>
            <button id="mImgNext" aria-label="Image suivante"
                    style="position:absolute;right:8px;top:50%;transform:translateY(-50%);appearance:none;border:0;background:#00000066;color:#fff;width:36px;height:36px;border-radius:999px;cursor:pointer;display:none">›</button>
          </div>
          <div id="mThumbs" class="gal-thumbs" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div>
        </div>
        <div class="meta">
          <div id="mPrice" style="font-weight:800;font-size:20px">—</div>
          <div id="mCat" class="muted" style="margin-top:4px;color:#6b7280">—</div>
          <div id="mDesc" style="margin-top:8px"></div>
          <div id="mCities" class="muted" style="margin-top:8px;color:#6b7280"></div>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
            <a id="mWhatsApp" class="btn" target="_blank" rel="noopener"
               style="appearance:none;border:0;border-radius:10px;background:#0A0A0A;color:#fff;padding:10px 14px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block">
               Commander via WhatsApp
            </a>
            <button id="mPrev" class="btn" style="appearance:none;border:0;border-radius:10px;background:#1111110d;color:#111;border:1px solid #eaeaea;padding:10px 14px;cursor:pointer">⟨ Préc</button>
            <button id="mNext" class="btn" style="appearance:none;border:0;border-radius:10px;background:#1111110d;color:#111;border:1px solid #eaeaea;padding:10px 14px;cursor:pointer">Suiv ⟩</button>
          </div>
        </div>
      </div>
    </div>`
  document.body.appendChild(modal)
}
ensureModal()

// refs modale
const overlay   = $('#overlay')
const modal     = $('#productModal')
const mTitle    = $('#mTitle')
const mMain     = $('#mMain')
const mMainBox  = $('#mMainBox')
const mImgPrev  = $('#mImgPrev')
const mImgNext  = $('#mImgNext')
const mThumbs   = $('#mThumbs')
const mPrice    = $('#mPrice')
const mCat      = $('#mCat')
const mDesc     = $('#mDesc')
const mCities   = $('#mCities')
const mWhatsApp = $('#mWhatsApp')
const mPrev     = $('#mPrev')
const mNext     = $('#mNext')
const mClose    = $('#mClose')

// ---------- helpers images ----------
function imagesOf(p){
  const out = []
  if (p.image) out.push(p.image)
  // images intégrées dans products.images
  for (const u of arrayify(p.images)) if (u && !out.includes(u)) out.push(u)
  // images venant de product_images (injectées dans p._imagesExt)
  for (const u of (p._imagesExt || [])) if (u && !out.includes(u)) out.push(u)
  return out
}

function showEmpty(msg){
  grid.innerHTML=''
  if (emptyMsg){ emptyMsg.style.display=''; emptyMsg.textContent = msg ? `Aucun produit pour l’instant (erreur: ${msg})` : 'Aucun produit pour l’instant.' }
}
function hideEmpty(){ if (emptyMsg) emptyMsg.style.display='none' }

// ---------- chargement ----------
async function load(){
  // 1) produits (snake_case par défaut, fallback si besoin)
  let { data, error } = await sb
    .from('products')
    .select('id,title,price,currency,category,short_description,image,images,cities,active,created_at')
    .eq('active', true)
    .order('created_at', { ascending:false })

  if (error && /created_at/i.test(error.message||'')) {
    ({ data, error } = await sb
      .from('products')
      .select('id,title,price,currency,category,short_description,image,images,cities,active')
      .eq('active', true))
  }
  if (error) {
    const r = await sb.from('products').select('*').eq('active', true)
    data  = r.data || []
    error = r.error || null
  }
  if (error){ showEmpty(error.message); return }

  // 2) images supplémentaires via product_images (en un seul call)
  const ids = (data||[]).map(p=>p.id).filter(Boolean)
  let imagesMap = {}
  if (ids.length){
    const im = await sb
      .from('product_images')
      .select('product_id,url,sort,created_at')
      .in('product_id', ids)
      .order('sort', { ascending:true })
      .order('created_at', { ascending:true })
    if (!im.error){
      for (const row of im.data || []){
        if(!imagesMap[row.product_id]) imagesMap[row.product_id] = []
        if (row.url) imagesMap[row.product_id].push(row.url)
      }
    }
  }

  all = (data||[]).map(p => ({
    ...p,
    shortDescription: p.short_description || p.shortDescription || '',
    cities: Array.isArray(p.cities) ? p.cities : [],
    _imagesExt: imagesMap[p.id] || []
  }))

  const cats = Array.from(new Set(all.map(p=>p.category).filter(Boolean))).sort()
  if (elCat) elCat.innerHTML = `<option value="Toutes">Toutes les catégories</option>` + cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('')

  filterAndRender()
}

// ---------- rendu ----------
function filterAndRender(){
  const q    = (elSearch?.value||'').toLowerCase().trim()
  const cat  = elCat?.value || 'Toutes'
  const city = elCity?.value || 'Toutes'
  view = all.filter(p=>{
    const okQ = !q || (p.title+' '+(p.category||'')+' '+(p.shortDescription||'')).toLowerCase().includes(q)
    const okC = (cat==='Toutes') || p.category===cat
    const okV = (city==='Toutes') || (Array.isArray(p.cities)&&p.cities.includes(city))
    return okQ && okC && okV
  })
  if (!view.length){ showEmpty(); return }
  hideEmpty()
  grid.innerHTML = view.map((p,i)=>cardTpl(p,i)).join('')
}

function cardTpl(p,i){
  const img = imagesOf(p)[0] || '/assets/images/placeholder.png'
  return `
    <div class="card product-card" data-i="${i}" style="cursor:pointer">
      <img src="${img}" alt="${escapeHtml(p.title)}">
      <div class="p">
        <div class="t">${escapeHtml(p.title)}</div>
        <div class="muted">${escapeHtml(p.category||'')}</div>
        <div class="muted" style="font-weight:700">${priceLabel(p)}</div>
      </div>
    </div>`
}

// ---------- modale / galerie ----------
function renderGallery(p){
  const imgs = imagesOf(p)
  imgIndex = Math.max(0, Math.min(imgIndex, Math.max(0, imgs.length-1)))
  if (mMain) mMain.src = imgs[imgIndex] || '/assets/images/placeholder.png'

  // flèches d’image visibles seulement si >1
  const showArrows = imgs.length > 1
  if (mImgPrev) mImgPrev.style.display = showArrows ? 'block' : 'none'
  if (mImgNext) mImgNext.style.display = showArrows ? 'block' : 'none'

  // vignettes
  if (mThumbs) {
    mThumbs.innerHTML = imgs.map((u,k)=>`
      <img data-k="${k}" src="${u}" alt=""
           style="width:72px;height:72px;object-fit:cover;border:1px solid ${k===imgIndex?'#111':'#eee'};border-radius:8px;cursor:pointer">
    `).join('')
  }
}
function showImage(k){ const p=view[idx]; if(!p) return; imgIndex=k; renderGallery(p) }
function nextImage(d){ const p=view[idx]; if(!p) return; const imgs=imagesOf(p); if(!imgs.length) return; imgIndex=(imgIndex+d+imgs.length)%imgs.length; renderGallery(p) }

function openAt(i){
  if (!modal || !overlay) { alert('Fiche produit indisponible (modale manquante).'); return }
  if (i<0 || i>=view.length) return
  idx=i
  const p=view[i]

  if (mTitle) mTitle.textContent = p.title || 'Produit'
  if (mPrice) mPrice.textContent = priceLabel(p)
  if (mCat)   mCat.textContent   = p.category || ''
  if (mDesc)  mDesc.textContent  = p.shortDescription || ''
  if (mCities)mCities.textContent= (p.cities?.length? `Villes: ${p.cities.join(', ')}` : '')
  if (mWhatsApp){
    const msg = encodeURIComponent(`Bonjour Samiah Cosmetics, je suis intéressé(e) par ${p.title} (${priceLabel(p)}).`)
    mWhatsApp.href = `https://wa.me/23562752105?text=${msg}`
  }

  imgIndex = 0
  renderGallery(p)

  overlay.style.display='block'
  modal.style.display='flex'
}
function closeModal(){ if(!modal||!overlay) return; modal.style.display='none'; overlay.style.display='none'; idx=-1 }

// ---------- events ----------
grid?.addEventListener('click', e=>{
  const card=e.target.closest('.product-card'); if(!card) return
  const i=parseInt(card.dataset.i,10); if(Number.isFinite(i)) openAt(i)
})
mThumbs?.addEventListener('click', e=>{
  const t=e.target.closest('img[data-k]'); if(!t) return
  const k=parseInt(t.dataset.k,10); if(Number.isFinite(k)) showImage(k)
})
mImgPrev?.addEventListener('click', ()=>nextImage(-1))
mImgNext?.addEventListener('click', ()=>nextImage(+1))

const nextProduct = d => { if(idx<0) return; const n=idx+d; if(n>=0 && n<view.length) openAt(n) }
mPrev?.addEventListener('click', ()=>nextProduct(-1))
mNext?.addEventListener('click', ()=>nextProduct(+1))

mClose?.addEventListener('click', closeModal)
overlay?.addEventListener('click', closeModal)
document.addEventListener('keydown', e=>{
  if(e.key==='Escape') closeModal()
  if(e.key==='ArrowLeft')  nextImage(-1)
  if(e.key==='ArrowRight') nextImage(+1)
})

elSearch?.addEventListener('input', filterAndRender)
elCat?.addEventListener('change', filterAndRender)
elCity?.addEventListener('change', filterAndRender)

// go!
load()
