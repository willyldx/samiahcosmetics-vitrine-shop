// =======================
// Samiah — Vitrine (Logic: Amazon Style Centered Modal)
// =======================
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// --- Config Supabase
const SB_URL = "https://dzzblqlteirtzyegplgu.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6emJscWx0ZWlydHp5ZWdwbGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjgyMDgsImV4cCI6MjA3NTAwNDIwOH0.WbjNAjF2qxly8QMu-3VJLPQE88UgzkeAn9XPj0lcb1Y";
const sb = createClient(SB_URL, SB_KEY);

// --- DOM Elements
const gridEl   = document.getElementById("products-grid");
const emptyEl  = document.getElementById("emptyMsg");
const qEl      = document.getElementById("search");
const catEl    = document.getElementById("category");
const cityEl   = document.getElementById("city");

// Témoignages
const testiGrid  = document.getElementById("testiGrid");
const testiEmpty = document.getElementById("testiEmpty");

// Modale (Fiche Produit)
const overlay  = document.getElementById("overlay");
const mTitle   = document.getElementById("mTitle");
const mMain    = document.getElementById("mMain");
const mThumbs  = document.getElementById("mThumbs");
const mPrice   = document.getElementById("mPrice");
const mCat     = document.getElementById("mCat");
const mDesc    = document.getElementById("mDesc");
const mCities  = document.getElementById("mCities");
const mWhats   = document.getElementById("mWhatsApp");
const mPrev    = document.getElementById("mPrev");
const mNext    = document.getElementById("mNext");
const mClose   = document.getElementById("mClose");
const mActions = document.querySelector(".modal-actions"); // Pour le bouton partage

// Plein écran (Lightbox - Optionnel)
const fsOverlay = document.getElementById("fsOverlay");
const fsImg     = document.getElementById("fsImg");
const fsClose   = document.getElementById("fsClose");

// --- État
let PRODUCTS = [];
let IMAGES_MAP = {};       
let currentGallery = [];   
let currentIndex = 0;

/* ===== TRI & PAGINATION ===== */
let PAGE      = parseInt(localStorage.getItem("v_page") || "1", 10);
let PAGE_SIZE = parseInt(localStorage.getItem("v_pageSize") || "12", 10);
let SORT      = localStorage.getItem("v_sort") || "newest";

// --- Utils
const fmtXAF = n => new Intl.NumberFormat("fr-FR").format(n) + " XAF";
const escapeHtml = s => (s ?? "").toString().replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
const escapeAttr = s => escapeHtml(s).replace(/"/g,"&quot;");
const uniq = arr => { const seen=new Set(), out=[]; for (const u of arr) if (u && !seen.has(u)) { seen.add(u); out.push(u); } return out; };

const toArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "object") {
    if (Array.isArray(v.urls)) return v.urls.filter(Boolean);
    try { return Object.values(v).flat().map(x => (typeof x === "string" ? x : null)).filter(Boolean); } catch {}
    return [];
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (s.startsWith("[") || s.startsWith("{")) { try { return toArray(JSON.parse(s)); } catch {} }
    return s.split(/[,\n;|]+/g).map(x => x.trim()).filter(Boolean);
  }
  return [];
};

// =======================
// PARTAGE / URL
// =======================
function getPidFromURL(){ try { return new URL(location.href).searchParams.get("p"); } catch { return null; } }
function buildShareUrl(id){ const u = new URL(location.href); u.searchParams.set("p", id); return u.toString(); }

async function copyToClipboard(text){
  try { await navigator.clipboard.writeText(text); alert("Lien copié ✅"); }
  catch { prompt("Copiez le lien :", text); }
}

function ensureShareButton(){
  let btn = document.getElementById("mShare");
  // On ajoute le bouton partager dans la "Buy Box" (modal-actions)
  if (!btn && mActions){
    btn = document.createElement("button");
    btn.id = "mShare";
    btn.className = "nav-btn"; // Style discret défini dans le CSS
    btn.style.width = "100%";
    btn.style.marginTop = "8px";
    btn.type = "button";
    btn.textContent = "Partager ce produit";
    mActions.appendChild(btn);
  }
  return btn;
}

// =======================
// Chargement Données
// =======================
async function loadProducts() {
  const { data, error } = await sb
    .from("products")
    .select("id,title,price,currency,category,cities,image,images,short_description,active,created_at,expires_after_days")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) { console.error("Error:", error); render([], `erreur: ${error.message}`); return; }

  const now = Date.now();
  PRODUCTS = (data || []).map(p => ({
    ...p, shortDescription: p.short_description ?? ""
  })).filter(p => {
    const d = Number.isFinite(p.expires_after_days) ? p.expires_after_days : null;
    if (!d || d <= 0) return true;
    const created = p.created_at ? Date.parse(p.created_at) : now;
    return (created + d * 86400000) > now;
  });

  const ids = PRODUCTS.map(p => p.id).filter(Boolean);
  if (ids.length) {
    const im = await sb.from("product_images").select("product_id,url,sort,created_at").in("product_id", ids).order("sort");
    if (!im.error) {
      for (const r of (im.data || [])) (IMAGES_MAP[r.product_id] ||= []).push(r.url);
    }
  }

  fillCategories(PRODUCTS);
  ensureControls();
  render(PRODUCTS);
  maybeOpenFromURL();
}

// =======================
// Rendu Liste
// =======================
function fillCategories(list){
  if (!catEl) return;
  const set = new Set();
  for (const p of list) if (p.category) set.add(p.category);
  catEl.innerHTML = ['<option value="Toutes">Toutes les catégories</option>']
    .concat([...set].sort().map(c => `<option>${escapeHtml(c)}</option>`))
    .join("");
}

function ensureControls(){
  if (!gridEl || document.getElementById("listControls")) return;
  // Barre de contrôles (Tri / Pagination) inchangée
  const html = `
    <div id="listControls" style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;justify-content:space-between;margin:10px 0 12px">
      <div style="display:flex;align-items:center;gap:8px">
        <select id="sortSel" style="padding:8px;border:1px solid #eaeaea;border-radius:8px">
          <option value="newest">Nouveautés</option>
          <option value="price_asc">Prix ↑</option>
          <option value="price_desc">Prix ↓</option>
          <option value="title_az">A→Z</option>
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span id="pageInfo" class="muted">—</span>
        <button id="prevPage" class="btn secondary">Préc</button>
        <button id="nextPage" class="btn secondary">Suiv</button>
      </div>
    </div>
  `;
  gridEl.insertAdjacentHTML("beforebegin", html);

  const sortSel = document.getElementById("sortSel");
  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");

  sortSel.value = SORT;
  sortSel.addEventListener("change", () => { SORT = sortSel.value; localStorage.setItem("v_sort", SORT); PAGE = 1; render(PRODUCTS); });
  prevBtn.addEventListener("click", () => { PAGE = Math.max(1, PAGE - 1); localStorage.setItem("v_page", String(PAGE)); render(PRODUCTS); });
  nextBtn.addEventListener("click", () => { PAGE = PAGE + 1; localStorage.setItem("v_page", String(PAGE)); render(PRODUCTS); });
}

function sortList(arr){
  const out = arr.slice();
  switch (SORT) {
    case "price_asc": out.sort((a,b) => (a.price||0) - (b.price||0)); break;
    case "price_desc": out.sort((a,b) => (b.price||0) - (a.price||0)); break;
    case "title_az": out.sort((a,b) => (a.title||"").localeCompare(b.title||"")); break;
    case "newest": default: out.sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  }
  return out;
}

function paginate(arr){
  const total = arr.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (PAGE > totalPages) PAGE = totalPages; if (PAGE < 1) PAGE = 1;
  
  const start = (PAGE - 1) * PAGE_SIZE;
  const items = arr.slice(start, start + PAGE_SIZE);

  const pageInfo = document.getElementById("pageInfo");
  const prevBtn  = document.getElementById("prevPage");
  const nextBtn  = document.getElementById("nextPage");

  if (pageInfo) pageInfo.textContent = `${total ? start+1 : 0}–${Math.min(start+PAGE_SIZE, total)} / ${total}`;
  if (prevBtn) prevBtn.disabled = PAGE <= 1;
  if (nextBtn) nextBtn.disabled = PAGE >= totalPages;

  return items;
}

function render(list, errorText=""){
  if (!gridEl) return;
  const q = (qEl?.value || "").toLowerCase().trim();
  const cat = (catEl?.value || "Toutes");
  const city = (cityEl?.value || "Toutes");

  const filtered = list.filter(p => {
    const okQ = !q || (p.title + " " + (p.category||"")).toLowerCase().includes(q);
    const okC = (cat === "Toutes") || (p.category === cat);
    const okCit = (city === "Toutes") || ((p.cities||[]).includes(city));
    return okQ && okC && okCit;
  });

  const pageData = paginate(sortList(filtered));
  gridEl.innerHTML = pageData.map(cardTpl).join("");

  if (filtered.length === 0) {
    if (emptyEl) { emptyEl.style.display = "block"; emptyEl.textContent = "Aucun produit trouvé."; }
  } else {
    if (emptyEl) emptyEl.style.display = "none";
  }

  // Clic carte -> Ouvrir Modale
  gridEl.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      const p = PRODUCTS.find(x => String(x.id) === String(id));
      if (p) openModal(p);
    });
  });

  bindCardSwipe();
}

function cardTpl(p){
  const gallery = buildGalleryLocal(p);
  // Image par défaut si vide (logo)
  const first  = escapeHtml(gallery[0] || "/assets/images/samiah-C-avatar.svg");
  const second = gallery[1] ? escapeHtml(gallery[1]) : null;

  return `
    <div class="card" data-id="${escapeAttr(p.id)}" style="cursor:pointer">
      <div class="card-thumb">
        <img class="card-img card-img-primary" src="${first}" alt="${escapeHtml(p.title)}" loading="lazy" onerror="this.src='/assets/images/samiah-C-avatar.svg'">
        ${ second ? `<img class="card-img card-img-secondary" src="${second}" loading="lazy">` : "" }
        <div class="card-action">Voir le produit</div>
      </div>
      <div class="p">
        <div style="font-weight:700;margin-bottom:4px">${escapeHtml(p.title)}</div>
        <div class="price">${fmtXAF(p.price)}</div>
        <div class="muted" style="font-size:12px;margin-top:4px">${escapeHtml(p.category)}</div>
      </div>
    </div>
  `;
}

function bindCardSwipe(){
  /* Logique Swipe inchangée */
  if (!gridEl) return;
  gridEl.querySelectorAll(".card").forEach(card => {
    const thumb = card.querySelector(".card-thumb");
    if (!thumb) return;
    let startX = null, moved = false;
    thumb.addEventListener("touchstart", (e) => { startX = e.changedTouches[0]?.clientX; moved = false; }, { passive: true });
    thumb.addEventListener("touchmove", (e) => { if(Math.abs(e.changedTouches[0]?.clientX - startX) > 10) moved = true; }, { passive: true });
    thumb.addEventListener("touchend", (e) => {
      if (Math.abs(e.changedTouches[0]?.clientX - startX) > 40) { card.classList.toggle("card-swiped"); e.stopPropagation(); }
    });
    thumb.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); moved = false; } });
  });
}

function buildGalleryLocal(p){
  const arr = [];
  if (p.image) arr.push(p.image);
  toArray(p.images).forEach(u => arr.push(u));
  (IMAGES_MAP[p.id] || []).forEach(u => arr.push(u));
  return uniq(arr);
}

// =======================
// GALERIE MODALE (FIXE)
// =======================
async function fetchExtraImages(productId){
  try{
    const { data } = await sb.from("product_images").select("url").eq("product_id", productId).order("sort");
    return (data || []).map(r => r.url).filter(Boolean);
  }catch{ return []; }
}

function renderGallery(){
  if (!mMain || !mThumbs) return;

  // Fallback logo si pas d'image
  const displayImg = currentGallery.length ? currentGallery[currentIndex] : "/assets/images/samiah-C-avatar.svg";
  mMain.src = displayImg;

  // Vignettes : Classe 'active-thumb' gérée par le CSS
  mThumbs.innerHTML = currentGallery.map((url, i) =>
    `<img src="${escapeAttr(url)}" 
          class="${i === currentIndex ? 'active-thumb' : ''}" 
          data-i="${i}" 
          onclick="setGalleryIndex(${i})"
          onerror="this.style.display='none'">`
  ).join("");
}

// Exposé globalement pour le onclick inline
window.setGalleryIndex = (i) => { currentIndex = i; renderGallery(); };

function prevImg(){ if (!currentGallery.length) return; currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length; renderGallery(); }
function nextImg(){ if (!currentGallery.length) return; currentIndex = (currentIndex + 1) % currentGallery.length; renderGallery(); }

// =======================
// OUVERTURE / FERMETURE MODALE
// =======================
async function openModal(p){
  if (!modal || !overlay) return;

  // Remplissage infos
  if(mTitle) mTitle.textContent = p.title || "";
  if(mPrice) mPrice.innerHTML = `${fmtXAF(p.price || 0)} <small>TTC</small>`; // Style Amazon prix
  if(mCat) mCat.textContent = p.category || "";
  if(mDesc) mDesc.textContent = p.shortDescription || "";
  if(mCities) mCities.textContent = (p.cities && p.cities.length) ? `Disponible à : ${p.cities.join(", ")}` : "En stock";

  const msg = encodeURIComponent(`Bonjour Samiah Cosmetics, je souhaite commander : ${p.title} (${fmtXAF(p.price||0)}).`);
  if(mWhats) mWhats.href = `https://wa.me/23562752105?text=${msg}`;

  // Galerie
  currentGallery = buildGalleryLocal(p);
  try{
    const extras = await fetchExtraImages(p.id);
    currentGallery = uniq(currentGallery.concat(extras));
  }catch{}
  
  // Si galerie vide -> fallback
  if (currentGallery.length === 0) currentGallery.push("/assets/images/samiah-C-avatar.svg");

  currentIndex = 0;
  renderGallery();

  // Partage
  const shareBtn = ensureShareButton();
  if (shareBtn){
    const shareUrl = buildShareUrl(p.id);
    shareBtn.onclick = async () => {
      if (navigator.share) try { await navigator.share({ title: p.title, url: shareUrl }); } catch {} else await copyToClipboard(shareUrl);
    };
  }

  if(mMain) mMain.onclick = () => openFs(); // Fullscreen au clic

  // AFFICHAGE : C'est ici que la magie opère pour centrer
  overlay.style.display = "flex"; // FLEX pour centrer la modale au milieu
  document.body.style.overflow = "hidden"; // Bloque le scroll derrière

  try { history.pushState({ pid: p.id }, "", buildShareUrl(p.id)); } catch {}

  if(mClose) mClose.onclick = closeModal;
  overlay.onclick = (e) => { if(e.target === overlay) closeModal(); }; // Ferme si clic dehors
  if(mPrev) mPrev.onclick = prevImg;
  if(mNext) mNext.onclick = nextImg;
}

function closeModal(){
  if(overlay) overlay.style.display = "none"; // Cache tout
  document.body.style.overflow = ""; // Débloque le scroll

  try {
    const u = new URL(location.href);
    u.searchParams.delete("p");
    history.replaceState({}, "", u.pathname + (u.search ? "?"+u.searchParams.toString() : "") + u.hash);
  } catch {}
}

// Lightbox (Optionnel)
if(fsOverlay) {
  const openFs = () => { fsImg.src = currentGallery[currentIndex]; fsOverlay.style.display = "flex"; };
  fsOverlay.onclick = (e) => { if(e.target !== fsImg) fsOverlay.style.display = "none"; };
}

// URL Deep Linking
function maybeOpenFromURL(){
  const pid = getPidFromURL();
  if (pid) {
    const p = PRODUCTS.find(x => String(x.id) === String(pid));
    if (p) openModal(p);
  }
}
window.addEventListener("popstate", () => {
  const pid = getPidFromURL();
  if (pid) {
    const p = PRODUCTS.find(x => String(x.id) === String(pid));
    if(p) openModal(p);
  } else {
    closeModal();
  }
});

// Filtres
[qEl, catEl, cityEl].forEach(el => {
  if(el) { el.addEventListener('input', () => { PAGE=1; render(PRODUCTS); }); }
});

// Init
async function init(){
  await loadProducts();
  loadTestimonials(); // Appel témoignages si fonction dispo (ouvert à implémentation)
  sb.channel("public:products").on("postgres_changes", {event:"*", schema:"public", table:"products"}, ()=>loadProducts()).subscribe();
}

// Témoignages Simple
async function loadTestimonials(){
  if (!testiGrid) return;
  try{
    const { data } = await sb.from("testimonials").select("*").eq("active", true).order("created_at", {ascending:false}).limit(4);
    if(!data || !data.length) { if(testiEmpty) testiEmpty.style.display="block"; return; }
    if(testiEmpty) testiEmpty.style.display="none";
    testiGrid.innerHTML = data.map(t => {
      // Fallback image témoignage
      let img = "/assets/images/samiah-C-avatar.svg";
      if(t.photo_url) img=t.photo_url; else if(t.photos && t.photos[0]) img=t.photos[0];
      
      const stars = t.rating ? `<div style="color:#D9B56C;margin-bottom:4px"> ${"★".repeat(t.rating)} </div>` : "";
      return `<div class="card" style="padding:16px;display:flex;gap:12px;align-items:start">
        <img src="${escapeAttr(img)}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:1px solid #eee" onerror="this.src='/assets/images/samiah-C-avatar.svg'">
        <div>
          ${stars}
          <p style="font-size:13px;margin:0;font-style:italic">"${escapeHtml(t.message)}"</p>
          <div style="font-size:12px;font-weight:700;margin-top:6px;color:#555">${escapeHtml(t.client_name)}</div>
        </div>
      </div>`;
    }).join("");
  }catch{}
}

// Badge Nouveau
const NEW_DAYS = 2;
function markNewCards(){
  if (!gridEl) return;
  const now = Date.now();
  PRODUCTS.forEach(p => {
    const age = now - Date.parse(p.created_at);
    if (age <= NEW_DAYS*86400000) {
      const c = gridEl.querySelector(`.card[data-id="${p.id}"] .card-thumb`);
      if (c && !c.querySelector('.badge-new')) {
        const s = document.createElement('span'); s.className='badge-new'; s.textContent='Nouveau'; c.appendChild(s);
      }
    }
  });
}
const obs = new MutationObserver(() => markNewCards());
if (gridEl) obs.observe(gridEl, { childList: true, subtree: false });

init();
