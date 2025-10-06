// =======================
// Samiah — Vitrine (Supabase + Galerie multi-images + Fullscreen)
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

// Modal (doit exister dans index.html)
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

// --- État
let PRODUCTS = [];
let IMAGES_MAP = {};      // { product_id: [urls...] }
let currentGallery = [];  // liste d’URLs dans la modale
let currentIndex = 0;

// --- Utils
const fmtXAF = n => new Intl.NumberFormat("fr-FR").format(n) + " XAF";
const escapeHtml = s => (s ?? "").toString().replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);
const escapeAttr = s => escapeHtml(s).replace(/"/g, "&quot;");

// dé-duplication
const uniq = arr => {
  const seen = new Set(); const out = [];
  for (const u of arr) if (u && !seen.has(u)) { seen.add(u); out.push(u); }
  return out;
};

// Tolère JSON / tableau / objet / CSV
const toArray = v => {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string") {
    try {
      const j = JSON.parse(v);
      if (Array.isArray(j)) return j.filter(Boolean);
      if (j && typeof j === "object") {
        if (Array.isArray(j.urls)) return j.urls.filter(Boolean);
        return Object.values(j).flat().filter(x => typeof x === "string" && x);
      }
    } catch {}
    return v.split(/[;,|]/g).map(s => s.trim()).filter(Boolean);
  }
  if (typeof v === "object") {
    if (Array.isArray(v.urls)) return v.urls.filter(Boolean);
    return Object.values(v).flat().filter(x => typeof x === "string" && x);
  }
  return [];
};

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

  // Charger images supplémentaires
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
      for (const r of (im.data || [])) {
        (IMAGES_MAP[r.product_id] ||= []).push(r.url);
      }
    } else {
      console.warn("product_images fetch error:", im.error);
    }
  }

  fillCategories(PRODUCTS);
  render(PRODUCTS);
}

// =======================
// Rendu + Filtres
// =======================
function fillCategories(list){
  if (!catEl) return;
  const set = new Set();
  for (const p of list) if (p.category) set.add(p.category);
  catEl.innerHTML = ['<option value="Toutes">Toutes les catégories</option>']
    .concat([...set].sort().map(c => `<option>${escapeHtml(c)}</option>`))
    .join("");
}

function render(list, errorText=""){
  if (!gridEl) return;

  const q = (qEl?.value || "").toLowerCase().trim();
  const cat = (catEl?.value || "Toutes");
  const city = (cityEl?.value || "Toutes");

  const filtered = list.filter(p => {
    const okQ = !q || (p.title + " " + (p.category || "") + " " + (p.shortDescription || "")).toLowerCase().includes(q);
    const okC = (cat === "Toutes") || (p.category === cat);
    const okCity = (city === "Toutes") || ((p.cities || []).includes(city));
    return okQ && okC && okCity;
  });

  gridEl.innerHTML = filtered.map(cardTpl).join("");

  if (filtered.length === 0) {
    if (emptyEl){
      emptyEl.style.display = "block";
      emptyEl.textContent = "Aucun produit pour l’instant" + (errorText ? ` (${errorText})` : ".");
    }
  } else {
    if (emptyEl) emptyEl.style.display = "none";
  }

  // clic carte → modale
  gridEl.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      const p = PRODUCTS.find(x => (""+x.id) === (""+id));
      if (p) openModal(p);
    });
  });
}

function cardTpl(p){
  const gallery = buildGalleryLocal(p);
  const img = escapeHtml(gallery[0] || "/assets/images/placeholder.png");
  const title = escapeHtml(p.title || "");
  const price = fmtXAF(p.price || 0);
  const cat = escapeHtml(p.category || "");
  const desc = escapeHtml(p.shortDescription || "");
  return `
    <div class="card" data-id="${escapeAttr(p.id)}" style="cursor:pointer">
      <img src="${img}" alt="${title}" loading="lazy">
      <div class="p">
        <div style="font-weight:700">${title}</div>
        <div class="muted" style="margin:4px 0">${cat || "&nbsp;"}</div>
        <div class="muted" style="min-height:28px">${desc}</div>
        <div style="margin-top:6px;font-weight:800">${price}</div>
      </div>
    </div>
  `;
}

// construit la galerie complète
function buildGalleryLocal(p){
  const arr = [];
  if (p.image) arr.push(p.image);              // image principale
  toArray(p.images).forEach(u => arr.push(u)); // images JSON/CSV du produit
  (IMAGES_MAP[p.id] || []).forEach(u => arr.push(u)); // table product_images
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

  // 1) image principale
  if (!currentGallery.length){
    mMain.src = "/assets/images/placeholder.png";
  } else {
    mMain.src = currentGallery[currentIndex];
  }

  // 2) vignettes (toujours visibles si >=1 image)
  mThumbs.innerHTML = currentGallery.map((url, i) =>
    `<img src="${escapeAttr(url)}" data-i="${i}"
      style="border:${i===currentIndex?'2px solid #111':'1px solid #eee'};border-radius:8px;width:72px;height:72px;object-fit:cover;cursor:pointer">`
  ).join("");

  if (currentGallery.length) {
    mThumbs.querySelectorAll("img").forEach(img => {
      img.addEventListener("click", () => {
        currentIndex = parseInt(img.getAttribute("data-i") || "0", 10);
        renderGallery();
      });
    });
  }

  // 3) nav
  const multi = currentGallery.length > 1;
  if (mPrev) mPrev.disabled = !multi;
  if (mNext) mNext.disabled = !multi;
}

// clavier pour la modale
function bindModalKeyboard(){
  const keyHandler = (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowRight') nextImg();
    if (e.key === 'ArrowLeft')  prevImg();
  };
  document.addEventListener('keydown', keyHandler);
  modal._keyHandler = keyHandler;
}
function unbindModalKeyboard(){
  if (modal && modal._keyHandler){
    document.removeEventListener('keydown', modal._keyHandler);
    modal._keyHandler = null;
  }
}

// clic image principale → plein écran (optionnel, ne gêne pas les vignettes)
function enableFullscreenOnMain(){
  if (!mMain) return;
  mMain.style.cursor = 'zoom-in';
  mMain.onclick = async () => {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); return; }
      const wrap = mMain.closest('.gal-main');
      if (mMain.requestFullscreen) await mMain.requestFullscreen();
      else if (wrap?.requestFullscreen) await wrap.requestFullscreen();
    } catch {}
  };
}

function prevImg(){
  if (!currentGallery.length) return;
  currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length;
  renderGallery();
}
function nextImg(){
  if (!currentGallery.length) return;
  currentIndex = (currentIndex + 1) % currentGallery.length;
  renderGallery();
}

async function openModal(p){
  if (!modal || !overlay || !mMain || !mThumbs){
    alert("Fiche produit indisponible (modale manquante).");
    return;
  }

  // Texte
  mTitle.textContent = p.title || "";
  mPrice.textContent = fmtXAF(p.price || 0);
  mCat.textContent   = p.category || "";
  mDesc.textContent  = p.shortDescription || "";
  mCities.textContent = (p.cities && p.cities.length) ? `Villes : ${p.cities.join(", ")}` : "";

  // WhatsApp
  const msg = encodeURIComponent(`Bonjour Samiah Cosmetics, je suis intéressé(e) par ${p.title} (${fmtXAF(p.price||0)}).`);
  if (mWhats) mWhats.href = `https://wa.me/23562752105?text=${msg}`;

  // Galerie locale + complémentaires DB
  currentGallery = buildGalleryLocal(p);
  try{
    const extras = await fetchExtraImages(p.id);
    currentGallery = uniq(currentGallery.concat(extras));
  }catch{}

  currentIndex = 0;
  renderGallery();

  // Ouvrir
  overlay.style.display = "block";
  modal.style.display = "flex";
  modal.classList.add("open");

  // Bind
  if (mClose) mClose.onclick = closeModal;
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  if (mPrev) mPrev.onclick = prevImg;
  if (mNext) mNext.onclick = nextImg;

  bindModalKeyboard();
  enableFullscreenOnMain();
}

function closeModal(){
  modal?.classList.remove("open");
  modal.style.display = "none";
  overlay.style.display = "none";
  unbindModalKeyboard();
}

// =======================
// Filtres UI
// =======================
[qEl, catEl, cityEl].forEach(el => {
  if (!el) return;
  el.addEventListener("input", () => render(PRODUCTS));
  el.addEventListener("change", () => render(PRODUCTS));
});

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
}

// =======================
// Init
// =======================
async function init(){
  await loadProducts();
  subscribeRealtime();
}
init().catch(console.error);
