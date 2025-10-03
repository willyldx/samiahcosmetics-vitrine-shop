// === Config Supabase (lecture publique) ===
const SUPABASE_URL = 'https://dzzblqlteirtzyegplgu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6emJscWx0ZWlydHp5ZWdwbGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjgyMDgsImV4cCI6MjA3NTAwNDIwOH0.WbjNAjF2qxly8QMu-3VJLPQE88UgzkeAn9XPj0lcb1Y';

// === util
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const fmt = n => new Intl.NumberFormat('fr-FR').format(n);

let state = {
  products: [],
  byId: new Map(),
  autoTimer: null
};

// construit la requête REST avec jointure product_images
function buildProductsUrl() {
  const select = [
    'id','title','price','currency','category',
    'short_description','image','cities','active',
    'expires_after_days','published_at','created_at',
    'product_images(url,sort)'
  ].join(',');
  const params = new URLSearchParams();
  params.set('select', select);
  params.append('order', 'published_at.desc.nullslast');
  params.append('order', 'created_at.desc.nullslast');
  params.append('product_images.order', 'sort.asc');
  return `${SUPABASE_URL}/rest/v1/products?${params.toString()}`;
}

async function fetchProducts() {
  const r = await fetch(buildProductsUrl(), {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  const rows = await r.json();
  if (!r.ok) throw new Error(rows?.message || 'Erreur de chargement des produits');
  const items = (rows || [])
    .filter(p => p.active !== false) // n’afficher que les actifs
    .map(p => ({
      id: p.id,
      title: p.title,
      price: p.price,
      currency: p.currency || 'XAF',
      category: p.category || '',
      shortDescription: p.short_description || '',
      image: p.image || '',
      cities: Array.isArray(p.cities) ? p.cities : [],
      expiresAfterDays: p.expires_after_days ?? null,
      publishedAt: p.published_at || p.created_at || null,
      gallery: Array.isArray(p.product_images) ? p.product_images.map(x => x.url).filter(Boolean) : []
    }));
  state.products = items;
  state.byId = new Map(items.map(p => [p.id, p]));
  return items;
}

// expiration helpers
function daysLeft(p) {
  if (!p.expiresAfterDays || !p.publishedAt) return null;
  const pub = new Date(p.publishedAt);
  const end = new Date(pub.getTime() + p.expiresAfterDays * 86400_000);
  const diffMs = end - new Date();
  const d = Math.ceil(diffMs / 86400_000);
  return d;
}
function expiresSoon(p) {
  const d = daysLeft(p);
  if (d == null) return null;
  return d <= 1 ? d : null;
}

// rendu des cartes produit
function renderProducts() {
  const grid = $('#products-grid');
  const q = ($('#search')?.value || '').trim().toLowerCase();
  const cat = ($('#category')?.value || 'Toutes');
  const city = ($('#city')?.value || 'Toutes');

  const data = state.products.filter(p => {
    const okQ = (p.title + ' ' + (p.category || '') + ' ' + (p.shortDescription || '')).toLowerCase().includes(q);
    const okC = (cat === 'Toutes') || (p.category === cat);
    const okCity = (city === 'Toutes') || (Array.isArray(p.cities) && p.cities.includes(city));
    return okQ && okC && okCity;
  });

  grid.innerHTML = data.map(p => cardTpl(p)).join('');
  // délégation click
  grid.onclick = (e) => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    const pid = card.getAttribute('data-id');
    openModal(pid);
  };
}

function cardTpl(p) {
  const badge = (() => {
    const soon = expiresSoon(p);
    if (soon === null) return '';
    return `<span class="badge" style="position:absolute;top:8px;left:8px" title="Expire bientôt"><span class="pill">Bientôt expiré</span></span>`;
  })();

  return `
    <div class="card" data-id="${escapeHtml(p.id)}" style="cursor:pointer; position:relative">
      ${badge}
      <img src="${escapeHtml(p.image || '')}" alt="${escapeHtml(p.title)}">
      <div class="p">
        <div class="title">${escapeHtml(p.title)}</div>
        <div class="price">${fmt(p.price)} ${p.currency || 'XAF'}</div>
        <div class="muted" style="font-size:12px;margin-top:4px">${escapeHtml(p.category || '')}</div>
      </div>
    </div>
  `;
}

function escapeHtml(s){return (''+s).replace(/[&<>'"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c]));}

// remplir les catégories dans le select
function fillCategories() {
  const cats = Array.from(new Set(state.products.map(p => p.category).filter(Boolean))).sort();
  const sel = $('#category');
  if (!sel) return;
  sel.innerHTML = `<option value="Toutes">Toutes les catégories</option>` + cats.map(c => `<option>${escapeHtml(c)}</option>`).join('');
}

// auto-refresh doux (20s)
function startAutoRefresh() {
  if (state.autoTimer) clearInterval(state.autoTimer);
  state.autoTimer = setInterval(async () => {
    try {
      await fetchProducts();
      renderProducts();
    } catch(_e) {
      // silencieux
    }
  }, 20000);
}

/* ====== MODAL PRODUIT ====== */
const modal = $('#productModal');
const pmClose = $('#pmClose');
const pmClose2 = $('#pmClose2');
const pmSlides = $('#pmSlides');
const pmDots = $('#pmDots');
const pmPrev = $('#pmPrev');
const pmNext = $('#pmNext');
const pmTitle = $('#pmTitle');
const pmPrice = $('#pmPrice');
const pmBadges = $('#pmBadges');
const pmDesc = $('#pmDesc');
const pmCities = $('#pmCities');
const pmWhatsApp = $('#pmWhatsApp');

let slideIndex = 0;
let currentImages = [];
let currentProduct = null;

function openModal(productId) {
  const p = state.byId.get(productId);
  if (!p) return;
  currentProduct = p;

  // images = [image principale] + galerie
  const imgs = [];
  if (p.image) imgs.push(p.image);
  if (Array.isArray(p.gallery) && p.gallery.length) {
    for (const u of p.gallery) if (u && !imgs.includes(u)) imgs.push(u);
  }
  currentImages = imgs.length ? imgs : [''];

  // remplir infos
  pmTitle.textContent = p.title || '';
  pmPrice.textContent = `${fmt(p.price)} ${p.currency || 'XAF'}`;
  pmDesc.textContent = p.shortDescription || '';
  pmCities.textContent = Array.isArray(p.cities) && p.cities.length ? `Villes: ${p.cities.join(', ')}` : '';

  // badges
  pmBadges.innerHTML = '';
  const soon = expiresSoon(p);
  if (soon !== null) {
    pmBadges.innerHTML += `<span class="pm-badge">Expire bientôt</span>`;
  }

  // WhatsApp CTA
  const msg = `Bonjour Samiah Cosmetics, je suis intéressé(e) par ${p.title} (${fmt(p.price)} ${p.currency || 'XAF'}).`;
  pmWhatsApp.href = `https://wa.me/23562752105?text=${encodeURIComponent(msg)}`;

  // slides
  renderSlides();
  slideIndex = 0;
  setActiveSlide(0);

  // afficher
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';

  // deep link
  location.hash = `#p/${encodeURIComponent(p.id)}`;
}

function closeModal() {
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
  // nettoyage hash si présent
  if (location.hash.startsWith('#p/')) {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

function renderSlides() {
  pmSlides.innerHTML = currentImages.map((u,i)=>
    `<img src="${escapeHtml(u)}" alt="Image ${i+1}" ${i===0?'class="active"':''}>`
  ).join('');
  pmDots.innerHTML = currentImages.map((_,i)=>
    `<button data-i="${i}" ${i===0?'class="active"':''} aria-label="Aller à l’image ${i+1}"></button>`
  ).join('');
}

function setActiveSlide(i) {
  slideIndex = (i + currentImages.length) % currentImages.length;
  $$('#pmSlides img').forEach((img,idx)=> img.classList.toggle('active', idx===slideIndex));
  $$('#pmDots button').forEach((b,idx)=> b.classList.toggle('active', idx===slideIndex));
}

pmPrev?.addEventListener('click', ()=> setActiveSlide(slideIndex-1));
pmNext?.addEventListener('click', ()=> setActiveSlide(slideIndex+1));
pmDots?.addEventListener('click', (e)=>{
  const b = e.target.closest('button[data-i]');
  if (!b) return;
  setActiveSlide(parseInt(b.dataset.i,10));
});
pmClose?.addEventListener('click', closeModal);
pmClose2?.addEventListener('click', closeModal);
modal?.addEventListener('click', (e)=>{ if(e.target===modal) closeModal(); });
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && modal.classList.contains('show')) closeModal(); });

/* ====== INIT ====== */
async function init() {
  // bind filtres
  $('#search')?.addEventListener('input', renderProducts);
  $('#category')?.addEventListener('change', renderProducts);
  $('#city')?.addEventListener('change', renderProducts);

  // 1er chargement
  try{
    await fetchProducts();
  }catch(e){
    console.error(e);
  }
  fillCategories();
  renderProducts();
  startAutoRefresh();

  // deep-link: #p/<id>
  if (location.hash.startsWith('#p/')) {
    const id = decodeURIComponent(location.hash.slice(3));
    if (id) openModal(id);
  }
}

if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init);
