// =======================
// Samiah — Vitrine (Supabase + Galerie multi-images + Plein écran robuste + Lien partageable + TRI & PAGINATION + Témoignages)
// =======================
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Récupère l'optimiseur
const ImageOptimizer = window.SupabaseImageOptimizer;

// Fonction helper pour optimiser les URLs
function getOptimizedImageUrl(url, width = 800) {
  return ImageOptimizer ? ImageOptimizer.optimize(url, { width }) : url;
}

// --- Config Supabase
const SB_URL = "https://dzzblqlteirtzyegplgu.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6emJscWx0ZWlydHp5ZWdwbGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjgyMDgsImV4cCI6MjA3NTAwNDIwOH0.WbjNAjF2qxly8QMu-3VJLPQE88UgzkeAn9XPj0lcb1Y";
const sb = createClient(SB_URL, SB_KEY);

// --- DOM
const gridEl    = document.getElementById("products-grid");
const emptyEl   = document.getElementById("emptyMsg");
const qEl       = document.getElementById("search");
const catEl     = document.getElementById("category");
const cityEl    = document.getElementById("city");

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

// === ANCIENNES FONCTIONS D'OPTIMISATION (Gardées pour Modale/Témoignages) ===

function optimizeSupabaseImage(url, width = 800) {
  if (!url || !url.includes('supabase.co')) return url;
  
  // Ajoute les paramètres de transformation
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}width=${width}&quality=80&format=webp`;
}

function createResponsiveImage(baseUrl, alt) {
  return `
    <picture>
      <source 
        srcset="${optimizeSupabaseImage(baseUrl, 400)}" 
        media="(max-width: 640px)"
        type="image/webp"
      >
      <source 
        srcset="${optimizeSupabaseImage(baseUrl, 800)}" 
        media="(max-width: 1024px)"
        type="image/webp"
      >
      <img 
        src="${optimizeSupabaseImage(baseUrl, 1200)}" 
        alt="${alt}"
        loading="lazy"
      >
    </picture>
  `;
}

// ===============================================

// toArray robuste : Array natif, JSON string, objet {urls:[]}, {0:"url",1:"url"}, CSV (virgule/; / | / retour-ligne)
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
    btn.textContent = "🔗 Partager";
    // l'insérer avant les boutons Préc/Suiv si possibles
    if (mPrev) mActions.insertBefore(btn, mPrev);
    else mActions.appendChild(btn);
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
  ensureControls();            // <— crée la barre de tri/pagination si besoin
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

/* ===== Barre de contrôle (UI) : tri + pagination ===== */
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
  // Insérer AVANT la grille
  gridEl.insertAdjacentHTML("beforebegin", html);

  // valeurs initiales + bindings
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
    case "price_asc":
      out.sort((a,b) => (a.price||0) - (b.price||0)); break;
    case "price_desc":
      out.sort((a,b) => (b.price||0) - (a.price||0)); break;
    case "title_az":
      out.sort((a,b) => (a.title||"").localeCompare(b.title||"")); break;
    case "title_za":
      out.sort((a,b) => (b.title||"").localeCompare(a.title||"")); break;
    case "newest":
    default:
      out.sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
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

  // MAJ UI
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

  // filtre
  const filtered = list.filter(p => {
    const okQ   = !q || (p.title + " " + (p.category || "") + " " + (p.shortDescription || "")).toLowerCase().includes(q);
    const okC   = (cat === "Toutes") || (p.category === cat);
    const okCit = (city === "Toutes") || ((p.cities || []).includes(city));
    return okQ && okC && okCit;
  });

  // tri + pagination
  const sorted   = sortList(filtered);
  const pageData = paginate(sorted);

  // rendu
  gridEl.innerHTML = pageData.map(cardTpl).join("");

  // vide ?
  if (filtered.length === 0) {
    if (emptyEl){
      emptyEl.style.display = "block";
      emptyEl.textContent = "Aucun produit pour l'instant" + (errorText ? ` (${errorText})` : ".");
    }
  } else {
    if (emptyEl) emptyEl.style.display = "none";
  }

  // click -> modale
  gridEl.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      const p = PRODUCTS.find(x => (""+x.id) === (""+id));
      if (p) openModal(p);
    });
  });

  // swipe mobile -> alterner les images (effet Jumia)
  bindCardSwipe();
}

/* === Nouvelle carte produit : AVEC NOUVELLE OPTIMISATION === */
function cardTpl(p){
  const gallery = buildGalleryLocal(p);
  
  // ✨ OPTIMISATION AUTOMATIQUE (Utilise getOptimizedImageUrl)
  const first  = escapeHtml(getOptimizedImageUrl(gallery[0], 400) || "/assets/images/placeholder.png");
  const second = gallery[1] ? escapeHtml(getOptimizedImageUrl(gallery[1], 400)) : null;

  const title = escapeHtml(p.title || "");
  const price = fmtXAF(p.price || 0);
  const cat   = escapeHtml(p.category || "");
  const desc  = escapeHtml(p.shortDescription || "");

  // Rendu avec balises IMG standards (plus simple et utilisant la nouvelle optimisation)
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

// ✅ Effet swipe mobile type "Jumia" - CORRIGÉ POUR ÉVITER L'ÉCRAN BLANC
function bindCardSwipe(){
  if (!gridEl) return;

  gridEl.querySelectorAll(".card").forEach(card => {
    const thumb = card.querySelector(".card-thumb");
    if (!thumb) return;

    // ✅ VÉRIFICATION : Y a-t-il une 2ème image ?
    const hasSecondImage = thumb.querySelector(".card-img-secondary");
    if (!hasSecondImage) {
      // Pas de 2ème image = pas de swipe, on sort
      return;
    }

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
      if (Math.abs(t.clientX - startX) > 10) {
        moved = true;
      }
    }, { passive: true });

    thumb.addEventListener("touchend", (e) => {
      const t = e.changedTouches && e.changedTouches[0];
      if (!t || startX == null) return;
      const dx = t.clientX - startX;

      // Swipe horizontal significatif
      if (Math.abs(dx) > 40) {
        card.classList.toggle("card-swiped");
        e.stopPropagation(); // évite l'ouverture de la modale
      }
      startX = null;
    });

    // Si on a glissé, on annule le clic
    thumb.addEventListener("click", (e) => {
      if (moved) {
        e.stopPropagation();
        moved = false;
      }
    });
  });
}

// Construit la galerie : image principale + products.images + product_images
function buildGalleryLocal(p){
  const arr = [];
  if (p.image) arr.push(p.image);
  toArray(p.images).forEach(u => arr.push(u));
  (IMAGES_MAP[p.id] || []).forEach(u => arr.push(u));
  return uniq(arr);
}

// =======================
// Modale / Galerie
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

  // image principale (OPTIMISÉE)
  const currentUrl = currentGallery.length ? currentGallery[currentIndex] : "/assets/images/placeholder.png";
  mMain.src = optimizeSupabaseImage(currentUrl, 1000);

  // vignettes avec classe active (OPTIMISÉES)
  mThumbs.innerHTML = currentGallery.map((url, i) =>
    `<img src="${escapeAttr(optimizeSupabaseImage(url, 150))}" data-i="${i}" class="${i===currentIndex ? 'active' : ''}">`
  ).join("");

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

  // DIAGNOSTIC
  console.log("[OPEN PRODUCT]", {
    id: p.id,
    image: p.image,
    images_raw: p.images,
    images_parsed: toArray(p.images),
    extra_from_table: IMAGES_MAP[p.id] || []
  });

  // Texte
  mTitle.textContent = p.title || "";
  mPrice.textContent = fmtXAF(p.price || 0);
  mCat.textContent   = "📦 " + (p.category || "");
  mDesc.textContent  = p.shortDescription || "";
  mCities.textContent = (p.cities && p.cities.length) ? `📍 Disponible à ${p.cities.join(", ")}` : "";

  // WhatsApp avec icône SVG
  const msg = encodeURIComponent(`Bonjour Samiah Cosmetics, je suis intéressé(e) par ${p.title} (${fmtXAF(p.price||0)}).`);
  if (mWhats) {
    mWhats.innerHTML = `
      <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      Commander via WhatsApp
    `;
    mWhats.href = `https://wa.me/23562752105?text=${msg}`;
  }

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

  // Utilisation des classes .show
  overlay.classList.add('show');
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';

  // Pousse l'état dans l'historique pour lien direct
  try { history.pushState({ pid: p.id }, "", buildShareUrl(p.id)); } catch {}

  // Bind fermeture / nav
  if (mClose) mClose.onclick = closeModal;
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  document.addEventListener("keydown", handleModalKeydown, { once:true });
  if (mPrev) mPrev.onclick = prevImg;
  if (mNext) mNext.onclick = nextImg;
}

function handleModalKeydown(e){
  if (e.key === "Escape") closeModal();
  else if (e.key === "ArrowLeft") prevImg();
  else if (e.key === "ArrowRight") nextImg();
}

function closeModal(){
  modal?.classList.remove('show');
  overlay.classList.remove('show');
  document.body.style.overflow = '';

  // retire ?p de l'URL sans recharger
  try {
    const u = new URL(location.href);
    u.searchParams.delete("p");
    const clean = u.pathname + (u.search ? "?" + u.searchParams.toString() : "") + u.hash;
    history.replaceState({}, "", clean);
  } catch {}
}

// =======================
// Plein écran (lightbox) — optionnel si les éléments existent
// =======================
function openFs(){
  if (!fsOverlay || !fsImg || !currentGallery.length) return;
  // IMAGE HAUTE QUALITÉ
  const currentUrl = currentGallery[currentIndex] || "/assets/images/placeholder.png";
  fsImg.src = optimizeSupabaseImage(currentUrl, 1600);
  
  fsOverlay.classList.add("show");
  document.body.style.overflow = "hidden";
}
function closeFs(){ if (!fsOverlay) return; fsOverlay.classList.remove("show"); document.body.style.overflow = ""; }
function fsPrevFn(){ 
    if (!currentGallery.length) return; 
    currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length; 
    if(fsImg) fsImg.src = optimizeSupabaseImage(currentGallery[currentIndex], 1600); 
}
function fsNextFn(){ 
    if (!currentGallery.length) return; 
    currentIndex = (currentIndex + 1) % currentGallery.length; 
    if(fsImg) fsImg.src = optimizeSupabaseImage(currentGallery[currentIndex], 1600); 
}
if (fsClose)   fsClose.addEventListener("click", closeFs);
if (fsOverlay) fsOverlay.addEventListener("click", (e) => { if (e.target === fsOverlay) closeFs(); });
if (fsPrev)    fsPrev.addEventListener("click", fsPrevFn);
if (fsNext)    fsNext.addEventListener("click", fsNextFn);
document.addEventListener("keydown", (e) => {
  if (!fsOverlay || !fsOverlay.classList.contains("show")) return;
  if (e.key === "Escape")       return closeFs();
  if (e.key === "ArrowLeft")    return fsPrevFn();
  if (e.key === "ArrowRight")   return fsNextFn();
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
// Deep-link : ouvrir/
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
    if (modal?.classList.contains("show")) closeModal();
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
// Témoignages (vitrine) — VERSION CLEAN (GRID)
// =======================
async function loadTestimonials(){
  if (!testiGrid) return;

  try{
    console.log("[loadTestimonials] Fetching...");
    
    // ✅ On récupère TOUTES les colonnes possibles
    const { data, error } = await sb
      .from("testimonials")
      .select("id, client_name, city, rating, message, photos, photo_url, created_at, active")
      .eq("active", true)
      .order("created_at", { ascending:false })
      .limit(5);

    if (error) {
      console.error("[loadTestimonials] Supabase error:", error);
      throw error;
    }

    console.log("[loadTestimonials] Success:", data);
    renderTestimonials(data || []);
  }catch(e){
    console.error("[loadTestimonials] Error:", e);
    renderTestimonials([], e.message || "Erreur");
  }
}

function renderTestimonials(list, errText = ""){
  if (!testiGrid) return;

  const rows = Array.isArray(list) ? list : [];
  
  console.log("[renderTestimonials]", { count: rows.length, rows });

  if (!rows.length){
    testiGrid.innerHTML = "";
    if (testiEmpty){
      testiEmpty.style.display = "block";
      testiEmpty.textContent = errText
        ? "Les premiers témoignages arrivent bientôt ("+errText+")"
        : "Les premiers témoignages arrivent bientôt.";
    }
    return;
  }

  const html = rows.map(t => {
    const name  = escapeHtml(t.client_name || "");
    const city  = escapeHtml(t.city || "");
    const quote = escapeHtml(t.message || "");
    
    // ✅ CORRECTION ULTIME : Gère photos (array) OU photo_url (string)
    let imgUrl = "/assets/images/placeholder-testimonial.png";
    
    if (t.photo_url && typeof t.photo_url === "string") {
      // Cas 1 : photo_url existe (string)
      imgUrl = t.photo_url;
    } else if (Array.isArray(t.photos) && t.photos.length > 0) {
      // Cas 2 : photos existe (array)
      imgUrl = t.photos[0];
    }
    
    console.log("[renderTestimonials] Image pour", name, ":", imgUrl);

    // ✅ Affichage du rating avec étoiles
    let starsHtml = "";
    if (t.rating && typeof t.rating === "number" && t.rating >= 1 && t.rating <= 5) {
      const fullStars = "★".repeat(t.rating);
      const emptyStars = "☆".repeat(5 - t.rating);
      starsHtml = `<div style="color:#D9B56C;font-size:14px;margin-bottom:4px">${fullStars}${emptyStars}</div>`;
    }

    const date = t.created_at ? new Date(t.created_at) : null;
    const dateStr = date
      ? date.toLocaleDateString("fr-FR",{year:"numeric",month:"short",day:"2-digit"})
      : "";

    // MODIF ICI : OPTIMISATION IMAGE TÉMOIGNAGE
    const optimizedAvatar = optimizeSupabaseImage(imgUrl, 100);

    // MODIF ICI : Structure carte standard (pour Grille)
    return `
      <article class="card">
        <div class="card-thumb">
          <img
              src="${escapeAttr(optimizedAvatar)}"
              alt="${name ? "Résultat de " + name : "Témoignage cliente"}"
              loading="lazy"
              onerror="this.onerror=null;this.src='/assets/images/placeholder-testimonial.png';console.error('Image failed:',this.src)"
            >
        </div>
        <div class="p">
          ${starsHtml}
          <p style="font-size:13px;line-height:1.5;margin:0">"${quote || "Témoignage en attente de texte."}"</p>
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
// Realtime
// =======================
function subscribeRealtime(){
  sb.channel("realtime:products")
    .on("postgres_changes", { event:"*", schema:"public", table:"products" }, () => loadProducts().catch(console.error))
    .subscribe();

  sb.channel("realtime:product_images")
    .on("postgres_changes", { event:"*", schema:"public", table:"product_images" }, () => loadProducts().catch(console.error))
    .subscribe();

  // Realtime pour les témoignages (optionnel mais pratique)
  sb.channel("realtime:testimonials")
    .on("postgres_changes", { event:"*", schema:"public", table:"testimonials" }, () => loadTestimonials().catch(console.error))
    .subscribe();
}

// =======================
// Init
// =======================
async function init(){
  await loadProducts();
  await loadTestimonials();
  subscribeRealtime();
}
init().catch(console.error);

/* ===========================================================
   BADGE "Nouveau" (append-only)
   - Ajoute un badge sur les cartes produits récents (≤ NEW_DAYS)
   - Sans modifier render() / cardTpl() : post-traitement du DOM
   =========================================================== */

const NEW_DAYS = 2; // ajuste si besoin
function __isNewProduct(p){
  if (!p || !p.created_at) return false;
  const created = Date.parse(p.created_at);
  if (!Number.isFinite(created)) return false;
  const ageMs = Date.now() - created;
  return ageMs <= NEW_DAYS * 24 * 60 * 60 * 1000;
}

function __injectNewBadgeIntoCard(cardEl, p){
  if (!cardEl || !p) return;
  // éviter les doublons
  if (cardEl.querySelector('.badge.badge-new')) return;

  // MODIF ICI : Insertion dans .card-thumb pour coller à l'image
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

// 1) Marque immédiatement si déjà rendu
markNewCards();

// 2) Observe la grille : à chaque changement (render), on remet les badges
const __newBadgeObserver = new MutationObserver(() => markNewCards());
if (gridEl) {
  __newBadgeObserver.observe(gridEl, { childList: true, subtree: false });
}

// 3) Sécurité : recalcule aussi après chargement des produits
document.addEventListener('readystatechange', () => {
  if (document.readyState === 'complete') markNewCards();
});
