// =======================
// Samiah — Vitrine (Supabase + Galerie multi-sources)
// =======================
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// --- Config Supabase (clé ANON publique = OK côté client)
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

// --- Etat
let PRODUCTS = [];            // liste de produits côté UI
let IMAGES_MAP = {};          // { product_id: [urls...] }
let currentGallery = [];      // galerie en cours dans le modal
let currentIndex = 0;         // index image en cours du modal

// --- Utils
const fmtXAF = n => new Intl.NumberFormat("fr-FR").format(n) + " XAF";
const escapeHtml = s => (s ?? "").toString().replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);
const escapeAttr = s => escapeHtml(s).replace(/"/g, "&quot;");
const arrayify = v => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch { return []; } }
  return [];
};

// =======================
// Chargement des données
// =======================
async function loadProducts() {
  // 1) produits actifs (on récupère aussi `images`)
  let { data, error } = await sb
    .from("products")
    .select("id,title,price,currency,category,cities,image,images,short_description,active,created_at,expires_after_days")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("products fetch error:", error);
    render([], `erreur: ${error.message}`);
    return;
  }

  // 2) mapping + expiration
  const now = Date.now();
  const base = (data || []).map(p => ({
    ...p,
    shortDescription: p.short_description ?? "",
  })).filter(p => {
    const days = Number.isFinite(p.expires_after_days) ? p.expires_after_days : null;
    if (!days || days <= 0) return true;
    const created = p.created_at ? Date.parse(p.created_at) : now;
    return (created + days * 86400000) > now; // non expiré
  });

  PRODUCTS = base;

  // 3) images supplémentaires (product_images)
  IMAGES_MAP = {};
  const ids = PRODUCTS.map(p => p.id).filter(Boolean);
  if (ids.length) {
    const im = await sb
      .from("product_images")
      .select("product_id,url,sort,created_at")
      .in("product_id", ids)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true });

    if (im.error) {
      console.warn("product_images fetch error:", im.error.message || im.error);
    } else {
      for (const r of (im.data || [])) {
        if (!IMAGES_MAP[r.product_id]) IMAGES_MAP[r.product_id] = [];
        if (r.url) IMAGES_MAP[r.product_id].push(r.url);
      }
    }
  }

  // 4) catégories
  fillCategories(PRODUCTS);

  // 5) rendu initial
  render(PRODUCTS);
}

// =======================
// Rendu + Filtres
// =======================
function fillCategories(list) {
  if (!catEl) return;
  const set = new Set();
  for (const p of list) if (p.category) set.add(p.category);
  const opts = ['<option value="Toutes">Toutes les catégories</option>']
    .concat([...set].sort().map(c => `<option>${escapeHtml(c)}</option>`));
  catEl.innerHTML = opts.join("");
}

function render(list, errorText = "") {
  if (!gridEl) return;

  // Filtrage
  const q = (qEl?.value || "").toLowerCase().trim();
  const cat = (catEl?.value || "Toutes");
  const city = (cityEl?.value || "Toutes");

  const filtered = list.filter(p => {
    const okQ = !q || (p.title + " " + (p.category || "") + " " + (p.shortDescription || "")).toLowerCase().includes(q);
    const okC = (cat === "Toutes") || (p.category === cat);
    const okCity = (city === "Toutes") || ((p.cities || []).includes(city));
    return okQ && okC && okCity;
  });

  // Cartes
  gridEl.innerHTML = filtered.map(cardTpl).join("");

  // Etat vide / erreur
  if (filtered.length === 0) {
    if (emptyEl) {
      emptyEl.style.display = "block";
      emptyEl.textContent = "Aucun produit pour l’instant" + (errorText ? ` (${errorText})` : ".");
    }
  } else {
    if (emptyEl) emptyEl.style.display = "none";
  }

  // Bind click -> modal
  gridEl.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      const p = PRODUCTS.find(x => x.id === id);
      if (p) openModal(p);
    });
  });
}

function cardTpl(p) {
  // Prépare la toute 1ère image pour la grille
  const gallery = buildGallery(p);
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

// Construit la galerie : image principale + products.images + product_images, avec déduplication
function buildGallery(p) {
  const a = [];
  if (p.image) a.push(p.image);
  for (const u of arrayify(p.images)) if (u) a.push(u);
  for (const u of (IMAGES_MAP[p.id] || [])) if (u) a.push(u);
  // dédup
  const seen = new Set(); const out = [];
  for (const u of a) { if (!seen.has(u)) { seen.add(u); out.push(u); } }
  return out;
}

// =======================
// Modal / Galerie
// =======================
function openModal(p) {
  if (!modal || !overlay || !mMain || !mThumbs) {
    alert("Fiche produit indisponible (modale manquante).");
    return;
  }

  // Galerie fusionnée
  currentGallery = buildGallery(p);
  currentIndex = 0;

  // Méta
  mTitle.textContent = p.title || "";
  mPrice.textContent = fmtXAF(p.price || 0);
  mCat.textContent   = p.category || "";
  mDesc.textContent  = p.shortDescription || "";
  mCities.textContent = (p.cities && p.cities.length) ? `Villes : ${p.cities.join(", ")}` : "";

  // WhatsApp
  const msg = encodeURIComponent(`Bonjour Samiah Cosmetics, je suis intéressé(e) par ${p.title} (${fmtXAF(p.price||0)}).`);
  mWhats.href = `https://wa.me/23562752105?text=${msg}`;

  // Vignettes + image principale
  renderGallery();

  // Ouvrir
  overlay.style.display = "block";
  modal.style.display = "flex";
  modal.classList.add("open");

  // Bind
  mClose.onclick = closeModal;
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  document.addEventListener("keydown", escCloseOnce);
  mPrev.onclick = prevImg;
  mNext.onclick = nextImg;
}

function closeModal() {
  modal?.classList.remove("open");
  modal.style.display = "none";
  overlay.style.display = "none";
  document.removeEventListener("keydown", escCloseOnce);
}

function escCloseOnce(e) {
  if (e.key === "Escape") closeModal();
}

function renderGallery() {
  if (!currentGallery.length) {
    mMain.src = "/assets/images/placeholder.png";
    mThumbs.innerHTML = "";
    mPrev.disabled = true; mNext.disabled = true;
    return;
  }
  // principale
  mMain.src = currentGallery[currentIndex];

  // vignettes
  mThumbs.innerHTML = currentGallery.map((url, i) =>
    `<img src="${escapeAttr(url)}" data-i="${i}" style="border:${i===currentIndex?'2px solid #111':'1px solid #eee'};border-radius:8px;width:72px;height:72px;object-fit:cover;cursor:pointer">`
  ).join("");

  mThumbs.querySelectorAll("img").forEach(img => {
    img.addEventListener("click", () => {
      const i = parseInt(img.getAttribute("data-i") || "0", 10);
      currentIndex = i;
      renderGallery();
    });
  });

  // nav
  mPrev.disabled = currentGallery.length <= 1;
  mNext.disabled = currentGallery.length <= 1;
}

function prevImg() {
  if (!currentGallery.length) return;
  currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length;
  renderGallery();
}
function nextImg() {
  if (!currentGallery.length) return;
  currentIndex = (currentIndex + 1) % currentGallery.length;
  renderGallery();
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
// Realtime : refresh auto
// =======================
function subscribeRealtime() {
  const ch = sb.channel("realtime:products");
  ch.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "products" },
    () => { loadProducts().catch(console.error); }
  ).subscribe();
}

// =======================
// Init
// =======================
async function init() {
  await loadProducts();
  subscribeRealtime();
}
init().catch(console.error);
