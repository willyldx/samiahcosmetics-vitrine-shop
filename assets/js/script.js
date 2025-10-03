/********** Config Supabase **********/
const SUPABASE_URL = 'https://dzzblqlteirtzyegplgu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6emJscWx0ZWlydHp5ZWdwbGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjgyMDgsImV4cCI6MjA3NTAwNDIwOH0.WbjNAjF2qxly8QMu-3VJLPQE88UgzkeAn9XPj0lcb1Y';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const fmt = n => new Intl.NumberFormat('fr-FR').format(n);

let state = { products: [], byId: new Map(), autoTimer: null };

/********** Build REST query **********/
function productsUrl() {
  const select = [
    'id','title','price','currency','category',
    'short_description','image','cities','active',
    'expires_after_days','published_at','created_at',
    'product_images(url,sort)'
  ].join(',');
  const p = new URLSearchParams();
  p.set('select', select);
  p.append('order', 'published_at.desc.nullslast');
  p.append('order', 'created_at.desc.nullslast');
  p.append('product_images.order', 'sort.asc');
  return `${SUPABASE_URL}/rest/v1/products?${p.toString()}`;
}

async function fetchProducts() {
  const r = await fetch(productsUrl(), {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  const rows = await r.json();
  if (!r.ok) throw new Error(rows?.message || 'Erreur de chargement des produits');

  const items = (rows||[])
    .filter(p => p.active !== false)
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
  console.log('[vitrine] produits chargés :', items.length);
  return items;
}

/********** Helpers expiration **********/
function daysLeft(p){
  if(!p.expiresAfterDays || !p.publishedAt) return null;
  const pub = new Date(p.publishedAt);
  const end = new Date(pub.getTime()+p.expiresAfterDays*86400_000);
  const diffMs = end - new Date();
  return Math.ceil(diffMs/86400_000);
}
function expiresSoon(p){
  const d = daysLeft(p);
  return (d!=null && d<=1) ? d : null;
}

/********** Rendu catalogue **********/
function escapeHtml(s){return (''+s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function cardTpl(p){
  const soon = expiresSoon(p);
  const badge = soon!=null ? `<span class="pm-badge" style="position:absolute;top:8px;left:8px">Bientôt expiré</span>` : '';
  return `
  <div class="card" data-id="${escapeHtml(p.id)}" style="cursor:pointer;position:relative">
    ${badge}
    <img src="${escapeHtml(p.image||'')}" alt="${escapeHtml(p.title)}">
    <div class="p">
      <div class="title">${escapeHtml(p.title)}</div>
      <div class="price">${fmt(p.price)} ${p.currency||'XAF'}</div>
      <div class="muted" style="font-size:12px;margin-top:4px">${escapeHtml(p.category||'')}</div>
    </div>
  </div>`;
}

function renderProducts(){
  const grid = $('#products-grid');
  if(!grid) return;

  const q = ($('#search')?.value||'').trim().toLowerCase();
  const cat = ($('#category')?.value||'Toutes');
  const city = ($('#city')?.value||'Toutes');

  const data = state.products.filter(p=>{
    const okQ = (p.title+' '+(p.category||'')+' '+(p.shortDescription||'')).toLowerCase().includes(q);
    const okC = (cat==='Toutes') || (p.category===cat);
    const okCity = (city==='Toutes') || (Array.isArray(p.cities) && p.cities.includes(city));
    return okQ && okC && okCity;
  });

  grid.innerHTML = data.map(cardTpl).join('');

  // ouvrir le modal au clic
  grid.onclick = (e)=>{
    const card = e.target.closest('[data-id]');
    if(!card) return;
    openModal(card.getAttribute('data-id'));
  };
}

function fillCategories(){
  const sel = $('#category'); if(!sel) return;
  const cats = Array.from(new Set(state.products.map(p=>p.category).filter(Boolean))).sort();
  sel.innerHTML = `<option value="Toutes">Toutes les catégories</option>` + cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
}

/********** Modal **********/
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

let slideIndex = 0, currentImages = [], currentProduct = null;

function ensureModal(){
  const ok = modal && pmClose && pmClose2 && pmSlides && pmDots && pmPrev && pmNext && pmTitle && pmPrice && pmBadges && pmDesc && pmCities && pmWhatsApp;
  if(!ok){
    console.error('[vitrine] IDs du modal introuvables — vérifie le bloc HTML du modal.');
  }
  return ok;
}

function openModal(productId){
  if(!ensureModal()) return;

  const p = state.byId.get(productId);
  if(!p){
    console.warn('[vitrine] produit introuvable pour id:', productId);
    return;
  }
  currentProduct = p;

  // images
  const imgs = [];
  if(p.image) imgs.push(p.image);
  if(Array.isArray(p.gallery)) for(const u of p.gallery){ if(u && !imgs.includes(u)) imgs.push(u); }
  currentImages = imgs.length ? imgs : [''];

  // infos
  pmTitle.textContent = p.title || '—';
  pmPrice.textContent = `${fmt(p.price)} ${p.currency||'XAF'}`;
  pmDesc.textContent = p.shortDescription || '';
  pmCities.textContent = (Array.isArray(p.cities)&&p.cities.length) ? `Villes: ${p.cities.join(', ')}` : '';
  pmBadges.innerHTML = expiresSoon(p)!=null ? `<span class="pm-badge">Expire bientôt</span>` : '';

  const msg = `Bonjour Samiah Cosmetics, je suis intéressé(e) par ${p.title} (${fmt(p.price)} ${p.currency||'XAF'}).`;
  pmWhatsApp.href = `https://wa.me/23562752105?text=${encodeURIComponent(msg)}`;

  // slides
  renderSlides();
  setActiveSlide(0);

  // show
  modal.classList.add('show');
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';

  // deep link
  location.hash = `#p/${encodeURIComponent(p.id)}`;

  console.log('[vitrine] modal ouvert:', { id:p.id, images: currentImages });
}

function closeModal(){
  if(!modal) return;
  modal.classList.remove('show');
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
  if(location.hash.startsWith('#p/')){
    history.replaceState(null,'',location.pathname+location.search);
  }
}

function renderSlides(){
  pmSlides.innerHTML = currentImages.map((u,i)=>`<img src="${escapeHtml(u)}" alt="Image ${i+1}" ${i===0?'class="active"':''}>`).join('');
  pmDots.innerHTML = currentImages.map((_,i)=>`<button data-i="${i}" ${i===0?'class="active"':''} aria-label="Aller à l’image ${i+1}"></button>`).join('');
}

function setActiveSlide(i){
  if(!currentImages.length) return;
  slideIndex = (i + currentImages.length) % currentImages.length;
  $$('#pmSlides img').forEach((img,idx)=> img.classList.toggle('active', idx===slideIndex));
  $$('#pmDots button').forEach((b,idx)=> b.classList.toggle('active', idx===slideIndex));
}

pmPrev?.addEventListener('click', ()=> setActiveSlide(slideIndex-1));
pmNext?.addEventListener('click', ()=> setActiveSlide(slideIndex+1));
pmDots?.addEventListener('click', e=>{
  const b = e.target.closest('button[data-i]');
  if(b) setActiveSlide(parseInt(b.dataset.i,10));
});
pmClose?.addEventListener('click', closeModal);
pmClose2?.addEventListener('click', closeModal);
modal?.addEventListener('click', e=>{ if(e.target===modal) closeModal(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && modal.classList.contains('show')) closeModal(); });

/********** Init + auto refresh **********/
function startAutoRefresh(){
  if(state.autoTimer) clearInterval(state.autoTimer);
  state.autoTimer = setInterval(async ()=>{
    try{ await fetchProducts(); renderProducts(); }catch(_e){}
  }, 20000);
}

async function init(){
  $('#search')?.addEventListener('input', renderProducts);
  $('#category')?.addEventListener('change', renderProducts);
  $('#city')?.addEventListener('change', renderProducts);

  try{ await fetchProducts(); }catch(e){ console.error(e); }
  fillCategories();
  renderProducts();
  startAutoRefresh();

  // open deep link if present
  if(location.hash.startsWith('#p/')){
    const id = decodeURIComponent(location.hash.slice(3));
    if(id) openModal(id);
  }
}
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init);
