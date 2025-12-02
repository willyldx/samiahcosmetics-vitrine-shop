// =======================
// Samiah — Vitrine (Supabase + Galerie multi-images + Plein écran robuste + Lien partageable + TRI & PAGINATION + Témoignages)
// =======================
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// --- Config Supabase
const SB_URL = "https://dzzblqlteirtzyegplgu.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6emJscWx0ZWlydHp5ZWdwbGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjgyMDgsImV4cCI6MjA3NTAwNDIwOH0.WbjNAjF2qxly8QMu-3VJLPQE88UgzkeAn9XPj0lcb1Y";
const sb = createClient(SB_URL, SB_KEY);

// --- DOM
const gridEl   = document.getElementById("products-grid");
const emptyEl  = document.getElementById("emptyMsg");
const qEl      = document.getElementById("search");
const catEl    = document.getElementById("category");
const cityEl   = document.getElementById("city");

// Témoignages
const testiGrid  = document.getElementById("testiGrid");
const testiEmpty = document.getElementById("testiEmpty");

// Modale produit
const overlay  = document.getElementById("overlay");
const modal    = document.getElementById("productModal");
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

// Plein écran (lightbox) – éléments optionnels dans index.html
const fsOverlay = document.getElementById("fsOverlay");
const fsImg     = document.getElementById("fsImg");
const fsPrev    = document.getElementById("fsPrev");
const fsNext    = document.getElementById("fsNext");
const fsClose   = document.getElementById("fsClose");

// --- État
let PRODUCTS = [];
let IMAGES_MAP = {};       // { product_id: [urls] }
let currentGallery = [];   // galerie courante (modale & plein écran)
let currentIndex = 0;

/* ===== TRI & PAGINATION : état ===== */
let PAGE      = parseInt(localStorage.getItem("v_page") || "1", 10);
let PAGE_SIZE = parseInt(localStorage.getItem("v_pageSize") || "12", 10);
let SORT      = localStorage.getItem("v_sort") || "newest"; // newest | price_asc | price_desc | title_az | title_za

// --- Utils
const fmtXAF = n => new Intl.NumberFormat("fr-FR").format(n) + " XAF";
const escapeHtml = s => (s ?? "").toString().replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);
const escapeAttr = s => escapeHtml(s).replace(/"/g,"&quot;");
const uniq = arr => { const seen=new Set(), out=[]; for (const u of arr) if (u && !seen.has(u)) { seen.add(u); out.push(u); } return out; };

// toArray robuste
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
    if (s.startsWith("[") || s.startsWith("{")) {
      try { return toArray(JSON.parse(s)); } catch {}
    }
    return s.split(/[,\n;|]+/g).map(x => x.trim()).filter(Boolean);
  }
  return [];
};

// =======================
// PARTAGE / LIEN DIRECT
// =======================
const mActions = modal ? modal.querySelector(".modal-actions") : null;

function getPidFromURL(){
  try { return new URL(location.href).searchParams.get("p"); } catch { return null; }
}
function buildShareUrl(id){
  const u = new URL(location.href);
  u.searchParams.set("p", id);
  return u.toString();
}
async function copyToClipboard(text){
  try { await navigator.clipboard.writeText(text); alert("Lien copié ✅"); }
  catch { prompt("Copiez le lien :", text); }
}
function ensureShareButton(){
  // crée le bouton une seule fois dans la modale
  let btn = document.getElementById("mShare");
  if (!btn && mActions){
    btn = document.createElement("button");
    btn.id = "mShare";
    btn.className = "btn secondary";
    btn.type = "button";
    btn.textContent = "Partager"; // Texte court
    btn.style.marginTop = "10px";
    btn.style.width = "100%";
    // l'insérer après les boutons
    mActions.appendChild(btn);
  }
  return btn;
}

// =======================
// Chargement des produits
// =======================
async function loadProducts() {
  const { data, error } = await sb
    .from("products")
    .select("id,title,price,currency,category,cities,image,images,short_description,active,created_at,expires_after_days")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("products fetch error:", error);
    render([], `erreur: ${error.message}`);
    return;
  }

  const now = Date.now();
  PRODUCTS = (data || []).map(p => ({
    ...p,
    shortDescription: p.short_description ?? ""
  })).filter(p => {
    const d = Number.isFinite(p.expires_after_days) ? p.expires_after_days : null;
    if (!d || d <= 0) return true;
    const created = p.created_at ? Date.parse(p.created_at) : now;
    return (created + d * 86400000) > now;
  });

  // Charger les images supplémentaires depuis product_images
  IMAGES_MAP = {};
  const ids = PRODUCTS.map(p => p.id).filter(Boolean);
  if (ids.length) {
    const im = await sb
      .from("product_images")
      .select("product_id,url,sort,created_at")
      .in("product_id", ids)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true });

    if (!im.error) {
      for (const r of (im.data || [])) (IMAGES_MAP[r.product_id] ||= []).push(r.url);
    } else {
      console.warn("product_images fetch error:", im.error);
    }
  }

  fillCategories(PRODUCTS);
  ensureControls();
  render(PRODUCTS);

  // Ouvre automatiquement si lien direct ?p=...
  maybeOpenFromURL();
}

// =======================
// Rendu + filtres + (tri & pagination)
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
  if (!gridEl) return;
  if (document.getElementById("listControls")) return;

  const html = `
    <div id="listControls" style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;justify-content:space-between;margin:10px 0 12px">
      <div style="display:flex;align-items:center;gap:8px">
        <label class="muted" for="sortSel">Trier par</label>
        <select id="sortSel" style="padding:8px;border:1px solid #eaeaea;border-radius:10px">
          <option value="newest">Nouveautés</option>
          <option value="price_asc">Prix ↑</option>
          <option value="price_desc">Prix ↓</option>
          <option value="title_az">Titre A→Z</option>
          <option value="title_za">Titre Z→A</option>
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span id="pageInfo" class="muted">—</span>
        <button id="prevPage" class="btn secondary" type="button">Précédent</button>
        <button id="nextPage" class="btn secondary" type="button">Suivant</button>
        <select id="pageSizeSel" title="Taille" style="padding:8px;border:1px solid #eaeaea;border-radius:10px">
          <option value="8">8</option>
          <option value="12">12</option>
          <option value="16">16</option>
          <option value="24">24</option>
        </select>
      </div>
    </div>
  `;
  gridEl.insertAdjacentHTML("beforebegin", html);

  const sortSel = document.getElementById("sortSel");
  const sizeSel = document.getElementById("pageSizeSel");
  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");

  sortSel.value = SORT;
  sizeSel.value = String(PAGE_SIZE);

  sortSel.addEventListener("change", () => {
    SORT = sortSel.value;
    localStorage.setItem("v_sort", SORT);
    PAGE = 1;
    render(PRODUCTS);
  });
  sizeSel.addEventListener("change", () => {
    PAGE_SIZE = parseInt(sizeSel.value, 10) || 12;
    localStorage.setItem("v_pageSize", String(PAGE_SIZE));
    PAGE = 1;
    render(PRODUCTS);
  });
  prevBtn.addEventListener("click", () => { PAGE = Math.max(1, PAGE - 1); localStorage.setItem("v_page", String(PAGE)); render(PRODUCTS); });
  nextBtn.addEventListener("click", () => { PAGE = PAGE + 1; localStorage.setItem("v_page", String(PAGE)); render(PRODUCTS); });
}

function sortList(arr){
  const out = arr.slice();
  switch (SORT) {
    case "price_asc": out.sort((a,b) => (a.price||0) - (b.price||0)); break;
    case "price_desc": out.sort((a,b) => (b.price||0) - (a.price||0)); break;
    case "title_az": out.sort((a,b) => (a.title||"").localeCompare(b.title||"")); break;
    case "title_za": out.sort((a,b) => (b.title||"").localeCompare(a.title||"")); break;
    case "newest": default: out.sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  }
  return out;
}

function paginate(arr){
  const total = arr.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (PAGE > totalPages) PAGE = totalPages;
  if (PAGE < 1) PAGE = 1;
  localStorage.setItem("v_page", String(PAGE));

  const start = (PAGE - 1) * PAGE_SIZE;
  const items = arr.slice(start, start + PAGE_SIZE);

  const pageInfo = document.getElementById("pageInfo");
  const prevBtn  = document.getElementById("prevPage");
  const nextBtn  = document.getElementById("nextPage");
  const sizeSel  = document.getElementById("pageSizeSel");
  const sortSel  = document.getElementById("sortSel");

  if (pageInfo) {
    const from = total ? start + 1 : 0;
    const to   = total ? Math.min(start + PAGE_SIZE, total) : 0;
    pageInfo.textContent = `${from}–${to} sur ${total}`;
  }
  if (prevBtn) prevBtn.disabled = PAGE <= 1;
  if (nextBtn) nextBtn.disabled = PAGE >= totalPages;
  if (sizeSel) sizeSel.value = String(PAGE_SIZE);
  if (sortSel) sortSel.value = SORT;

  return items;
}

function render(list, errorText=""){
  if (!gridEl) return;

  const q = (qEl?.value || "").toLowerCase().trim();
  const cat = (catEl?.value || "Toutes");
  const city = (cityEl?.value || "Toutes");

  const filtered = list.filter(p => {
    const okQ   = !q || (p.title + " " + (p.category || "") + " " + (p.shortDescription || "")).toLowerCase().includes(q);
    const okC   = (cat === "Toutes") || (p.category === cat);
    const okCit = (city === "Toutes") || ((p.cities || []).includes(city));
    return okQ && okC && okCit;
  });

  const sorted   = sortList(filtered);
  const pageData = paginate(sorted);

  gridEl.innerHTML = pageData.map(cardTpl).join("");

  if (filtered.length === 0) {
    if (emptyEl){
      emptyEl.style.display = "block";
      emptyEl.textContent = "Aucun produit pour l'instant" + (errorText ? ` (${errorText})` : ".");
    }
  } else {
    if (emptyEl) emptyEl.style.display = "none";
  }

  gridEl.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      const p = PRODUCTS.find(x => (""+x.id) === (""+id));
      if (p) openModal(p);
    });
  });

  bindCardSwipe();
}

function cardTpl(p){
  const gallery = buildGalleryLocal(p);
  const first  = escapeHtml(gallery[0] || "/assets/images/placeholder.png");
  const second = gallery[1] ? escapeHtml(gallery[1]) : null;

  const title = escapeHtml(p.title || "");
  const price = fmtXAF(p.price || 0);
  const cat   = escapeHtml(p.category || "");
  const desc  = escapeHtml(p.shortDescription || "");

  return `
    <div class="card" data-id="${escapeAttr(p.id)}" style="cursor:pointer">
      <div class="card-thumb">
        <img
          class="card-img card-img-primary"
          src="${first}"
          alt="${title}"
          loading="lazy"
        >
        ${
          second
            ? `<img
                 class="card-img card-img-secondary"
                 src="${second}"
                 alt="${title}"
                 loading="lazy"
               >`
            : ""
        }
        <div class="card-action">Voir le produit</div>
      </div>
      <div class="p">
        <div style="font-weight:700">${title}</div>
        <div class="muted" style="margin:4px 0">${cat || "&nbsp;"}</div>
        <div class="muted" style="min-height:28px">${desc}</div>
        <div class="price">${price}</div>
      </div>
    </div>
  `;
}

function bindCardSwipe(){
  if (!gridEl) return;
  gridEl.querySelectorAll(".card").forEach(card => {
    const thumb = card.querySelector(".card-thumb");
    if (!thumb) return;
    let startX = null;
    let moved  = false;
    thumb.addEventListener("touchstart", (e) => {
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      startX = t.clientX;
      moved = false;
    }, { passive: true });
    thumb.addEventListener("touchmove", (e) => {
      const t = e.changedTouches && e.changedTouches[0];
      if (!t || startX == null) return;
      if (Math.abs(t.clientX - startX) > 10) { moved = true; }
    }, { passive: true });
    thumb.addEventListener("touchend", (e) => {
      const t = e.changedTouches && e.changedTouches[0];
      if (!t || startX == null) return;
      const dx = t.clientX - startX;
      if (Math.abs(dx) > 40) {
        card.classList.toggle("card-swiped");
        e.stopPropagation();
      }
      startX = null;
    });
    thumb.addEventListener("click", (e) => {
      if (moved) { e.stopPropagation(); moved = false; }
    });
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
// Modale / Galerie (CORRIGÉE POUR STYLE AMAZON)
// =======================
async function fetchExtraImages(productId){
  try{
    const { data, error } = await sb
      .from("product_images")
      .select("url,sort,created_at")
      .eq("product_id", productId)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map(r => r.url).filter(Boolean);
  }catch(e){
    console.warn("[product_images]", e);
    return [];
  }
}

function renderGallery(){
  if (!mMain || !mThumbs) return;

  // image principale
  mMain.src = currentGallery.length ? currentGallery[currentIndex] : "/assets/images/placeholder.png";

  // vignettes (SANS STYLE INLINE pour laisser le CSS Amazon gérer la classe .active-thumb)
  mThumbs.innerHTML = currentGallery.map((url, i) => {
    // Si c'est l'image courante, on ajoute la classe pour la bordure orange
    const activeClass = (i === currentIndex) ? "active-thumb" : "";
    return `<img src="${escapeAttr(url)}" class="${activeClass}" data-i="${i}" alt="Vue ${i+1}">`;
  }).join("");

  mThumbs.querySelectorAll("img").forEach(img => {
    img.addEventListener("click", () => {
      currentIndex = parseInt(img.getAttribute("data-i") || "0", 10);
      renderGallery();
    });
  });

  const multi = currentGallery.length > 1;
  if (mPrev) mPrev.disabled = !multi;
  if (mNext) mNext.disabled = !multi;
}

function prevImg(){ if (!currentGallery.length) return; currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length; renderGallery(); }
function nextImg(){ if (!currentGallery.length) return; currentIndex = (currentIndex + 1) % currentGallery.length; renderGallery(); }

async function openModal(p){
  if (!modal || !overlay || !mMain || !mThumbs){
    alert("Fiche produit indisponible (modale manquante).");
    return;
  }

  // Remplissage avec sécurité (vérifie si les éléments existent)
  if (mTitle) mTitle.textContent = p.title || "";
  if (mPrice) mPrice.textContent = fmtXAF(p.price || 0);
  if (mCat) mCat.textContent   = p.category || "";
  if (mDesc) mDesc.textContent  = p.shortDescription || "";
  if (mCities) mCities.textContent = (p.cities && p.cities.length) ? `Disponible à : ${p.cities.join(", ")}` : "Disponible partout";

  // WhatsApp
  const msg = encodeURIComponent(`Bonjour Samiah Cosmetics, je suis intéressé(e) par ${p.title} (${fmtXAF(p.price||0)}).`);
  if (mWhats) mWhats.href = `https://wa.me/23562752105?text=${msg}`;

  // Galerie locale + compléments DB
  currentGallery = buildGalleryLocal(p);
  try{
    const extras = await fetchExtraImages(p.id);
    currentGallery = uniq(currentGallery.concat(extras));
  }catch{}

  currentIndex = 0;
  renderGallery();

  // --- PARTAGE : bouton + URL ---
  const shareBtn = ensureShareButton();
  if (shareBtn){
    const shareUrl = buildShareUrl(p.id);
    shareBtn.onclick = async () => {
      if (navigator.share) {
        try { await navigator.share({ title: p.title, text: p.title, url: shareUrl }); }
        catch {/* annulation utilisateur */}
      } else {
        await copyToClipboard(shareUrl);
      }
    };
  }

  // clic image principale → plein écran (si markup présent)
  if (mMain) mMain.onclick = () => openFs();

  // Ouvrir
  overlay.style.display = "block";
  modal.style.display = "flex";
  // on ne met plus la classe 'open' si on gère le display directement

  // Pousse l'état dans l'historique pour lien direct
  try { history.pushState({ pid: p.id }, "", buildShareUrl(p.id)); } catch {}

  // Bind fermeture / nav
  if (mClose) mClose.onclick = closeModal;
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); }, { once:true });
  if (mPrev) mPrev.onclick = prevImg;
  if (mNext) mNext.onclick = nextImg;
}

function closeModal(){
  if (modal) modal.style.display = "none";
  if (overlay) overlay.style.display = "none";

  // retire ?p de l'URL sans recharger
  try {
    const u = new URL(location.href);
    u.searchParams.delete("p");
    const clean = u.pathname + (u.search ? "?" + u.searchParams.toString() : "") + u.hash;
    history.replaceState({}, "", clean);
  } catch {}
}

// =======================
// Plein écran (lightbox)
// =======================
function openFs(){
  if (!fsOverlay || !fsImg || !currentGallery.length) return;
  fsImg.src = currentGallery[currentIndex] || "/assets/images/placeholder.png";
  fsOverlay.classList.add("show");
  document.body.style.overflow = "hidden";
}
function closeFs(){ if (!fsOverlay) return; fsOverlay.classList.remove("show"); document.body.style.overflow = ""; }
function fsPrevFn(){ if (!currentGallery.length) return; currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length; if(fsImg) fsImg.src = currentGallery[currentIndex]; }
function fsNextFn(){ if (!currentGallery.length) return; currentIndex = (currentIndex + 1) % currentGallery.length; if(fsImg) fsImg.src = currentGallery[currentIndex]; }
if (fsClose)   fsClose.addEventListener("click", closeFs);
if (fsOverlay) fsOverlay.addEventListener("click", (e) => { if (e.target === fsOverlay) closeFs(); });
if (fsPrev)    fsPrev.addEventListener("click", fsPrevFn);
if (fsNext)    fsNext.addEventListener("click", fsNextFn);
document.addEventListener("keydown", (e) => {
  if (!fsOverlay || !fsOverlay.classList.contains("show")) return;
  if (e.key === "Escape")      return closeFs();
  if (e.key === "ArrowLeft")   return fsPrevFn();
  if (e.key === "ArrowRight")  return fsNextFn();
});
let touchX = null;
if (fsOverlay){
  fsOverlay.addEventListener("touchstart", (e) => { touchX = e.changedTouches?.[0]?.clientX ?? null; }, { passive:true });
  fsOverlay.addEventListener("touchend", (e) => {
    if (touchX == null) return;
    const dx = (e.changedTouches?.[0]?.clientX ?? touchX) - touchX;
    if (Math.abs(dx) > 40){ if (dx > 0) fsPrevFn(); else fsNextFn(); }
    touchX = null;
  }, { passive:true });
}

// =======================
// Deep-link : ouvrir/fermer selon l'URL
// =======================
function maybeOpenFromURL(){
  const pid = getPidFromURL();
  if (!pid) return;
  const p = PRODUCTS.find(x => (""+x.id) === (""+pid));
  if (p) openModal(p);
}
window.addEventListener("popstate", () => {
  const pid = getPidFromURL();
  if (pid) {
    const p = PRODUCTS.find(x => (""+x.id) === (""+pid));
    if (p) openModal(p);
  } else {
    if (modal && modal.style.display === "flex") closeModal();
  }
});

// =======================
// Filtres UI
// =======================
[qEl, catEl, cityEl].forEach(el => {
  if (!el) return;
  el.addEventListener("input", () => { PAGE = 1; render(PRODUCTS); });
  el.addEventListener("change", () => { PAGE = 1; render(PRODUCTS); });
});

// =======================
// Témoignages (vitrine)
// =======================
async function loadTestimonials(){
  if (!testiGrid) return;

  try{
    const { data, error } = await sb
      .from("testimonials")
      .select("id, client_name, city, rating, message, photos, photo_url, created_at, active")
      .eq("active", true)
      .order("created_at", { ascending:false })
      .limit(5);

    if (error) throw error;
    renderTestimonials(data || []);
  }catch(e){
    console.error("[loadTestimonials] Error:", e);
    renderTestimonials([], e.message || "Erreur");
  }
}

function renderTestimonials(list, errText = ""){
  if (!testiGrid) return;
  const rows = Array.isArray(list) ? list : [];
  
  if (!rows.length){
    testiGrid.innerHTML = "";
    if (testiEmpty){
      testiEmpty.style.display = "block";
      testiEmpty.textContent = errText ? "Les premiers témoignages arrivent bientôt ("+errText+")" : "Les premiers témoignages arrivent bientôt.";
    }
    return;
  }

  const html = rows.map(t => {
    const name  = escapeHtml(t.client_name || "");
    const city  = escapeHtml(t.city || "");
    const quote = escapeHtml(t.message || "");
    
    let imgUrl = "/assets/images/placeholder-testimonial.png";
    if (t.photo_url && typeof t.photo_url === "string") imgUrl = t.photo_url;
    else if (Array.isArray(t.photos) && t.photos.length > 0) imgUrl = t.photos[0];
    
    let starsHtml = "";
    if (t.rating && typeof t.rating === "number" && t.rating >= 1 && t.rating <= 5) {
      const fullStars = "★".repeat(t.rating);
      const emptyStars = "☆".repeat(5 - t.rating);
      starsHtml = `<div style="color:#D9B56C;font-size:14px;margin-bottom:4px">${fullStars}${emptyStars}</div>`;
    }

    const date = t.created_at ? new Date(t.created_at) : null;
    const dateStr = date ? date.toLocaleDateString("fr-FR",{year:"numeric",month:"short",day:"2-digit"}) : "";

    return `
      <article class="card">
        <div class="card-thumb">
          <img src="${escapeAttr(imgUrl)}" alt="${name ? "Résultat de " + name : "Témoignage cliente"}" loading="lazy" onerror="this.onerror=null;this.src='/assets/images/placeholder-testimonial.png';">
        </div>
        <div class="p">
          ${starsHtml}
          <p style="font-size:13px;line-height:1.5;margin:0">"${quote || "Témoignage en attente."}"</p>
          <div class="muted" style="margin-top:6px;font-size:12px">
            ${name || "Cliente Samiah"}${city ? " • " + city : ""}${dateStr ? " • " + dateStr : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");

  testiGrid.innerHTML = html;
  if (testiEmpty) testiEmpty.style.display = "none";
}

// =======================
// Realtime & Init
// =======================
function subscribeRealtime(){
  sb.channel("realtime:products").on("postgres_changes", { event:"*", schema:"public", table:"products" }, () => loadProducts().catch(console.error)).subscribe();
  sb.channel("realtime:product_images").on("postgres_changes", { event:"*", schema:"public", table:"product_images" }, () => loadProducts().catch(console.error)).subscribe();
  sb.channel("realtime:testimonials").on("postgres_changes", { event:"*", schema:"public", table:"testimonials" }, () => loadTestimonials().catch(console.error)).subscribe();
}

async function init(){
  await loadProducts();
  await loadTestimonials();
  subscribeRealtime();
}
init().catch(console.error);

/* ===========================================================
   BADGE "Nouveau" (append-only)
   =========================================================== */
const NEW_DAYS = 2; 
function __isNewProduct(p){
  if (!p || !p.created_at) return false;
  const created = Date.parse(p.created_at);
  if (!Number.isFinite(created)) return false;
  const ageMs = Date.now() - created;
  return ageMs <= NEW_DAYS * 24 * 60 * 60 * 1000;
}

function __injectNewBadgeIntoCard(cardEl, p){
  if (!cardEl || !p) return;
  if (cardEl.querySelector('.badge.badge-new')) return;
  const slot = cardEl.querySelector('.card-thumb') || cardEl;
  const span = document.createElement('span');
  span.className = 'badge badge-new';
  span.textContent = 'Nouveau';
  slot.appendChild(span);
}

function markNewCards(){
  if (!Array.isArray(PRODUCTS) || !gridEl) return;
  const byId = new Map(PRODUCTS.map(p => [String(p.id), p]));
  gridEl.querySelectorAll('.card[data-id]').forEach(card => {
    const id = card.getAttribute('data-id') || '';
    const p = byId.get(String(id));
    if (__isNewProduct(p)) __injectNewBadgeIntoCard(card, p);
  });
}

markNewCards();
const __newBadgeObserver = new MutationObserver(() => markNewCards());
if (gridEl) __newBadgeObserver.observe(gridEl, { childList: true, subtree: false });
document.addEventListener('readystatechange', () => { if (document.readyState === 'complete') markNewCards(); });
