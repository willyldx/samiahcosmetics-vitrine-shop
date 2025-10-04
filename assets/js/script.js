/* /assets/js/script.js — Vitrine Supabase + fiche produit (auto-modal)
   - Pas d'alias SQL (PostgREST)
   - Mapping snake_case -> camelCase
   - Filtres robustes (“Toutes”, “Toutes les catégories”, vide…)
   - Injecte la modale + CSS si absents
   - Galerie + WhatsApp
   - Realtime (auto-refresh)
*/
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* === CONFIG SUPABASE === */
const SUPABASE_URL  = "https://dzzblqlteirtzyegplgu.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6emJscWx0ZWlydHp5ZWdwbGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjgyMDgsImV4cCI6MjA3NTAwNDIwOH0.WbjNAjF2qxly8QMu-3VJLPQE88UgzkeAn9XPj0lcb1Y";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/* === Sélection PostgREST (PAS de AS ici) === */
const SELECT_COLS = `
  id,title,price,currency,category,
  short_description,long_description,
  image,images,cities,active,
  expires_after_days,published_at,created_at
`;

/* === Helpers DOM & format === */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const fmt = (n) => new Intl.NumberFormat("fr-FR").format(n || 0);
function escapeHtml(s){return (""+s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39'}[c]));}

/* === Mapping snake_case -> camelCase === */
function mapRow(r){
  if(!r) return null;
  return {
    id: r.id,
    title: r.title,
    price: r.price,
    currency: r.currency || "XAF",
    category: r.category || "",
    shortDescription: r.short_description || "",
    longDescription:  r.long_description  || "",
    image: r.image || "",
    images: Array.isArray(r.images) ? r.images : [],
    cities: Array.isArray(r.cities) ? r.cities : [],
    active: r.active !== false,
    expiresAfterDays: r.expires_after_days ?? null,
    publishedAt: r.published_at ?? null,
    created_at: r.created_at ?? null,
  };
}

/* === Éléments === */
const gridEl   = $("#products-grid");
let emptyMsgEl = $("#emptyMsg");
if(!emptyMsgEl){
  emptyMsgEl = document.createElement("div");
  emptyMsgEl.id = "emptyMsg";
  emptyMsgEl.className = "empty";
  emptyMsgEl.textContent = "Aucun produit pour l’instant.";
  gridEl?.parentNode?.insertBefore(emptyMsgEl, gridEl?.nextSibling || null);
}
const searchEl   = $("#search");
const categoryEl = $("#category");
const cityEl     = $("#city");

/* === Modale: éléments (seront câblés après injection) === */
let overlay, modal, mTitle, mPrice, mCat, mDesc, mCities, mMain, mThumbs, mWA, mPrev, mNext, mClose;

/* === Injecte le CSS de la modale si absent === */
function ensureModalStyles(){
  if (document.getElementById("samiah-modal-style")) return;
  const css = `
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;z-index:1000}
    .modal-overlay.open{display:block}
    .modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:1001}
    .modal.open{display:flex}
    .modal-card{background:#fff;max-width:980px;width:94%;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.25)}
    .modal-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #eee}
    .modal-body{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;padding:14px}
    @media(max-width:900px){.modal-body{grid-template-columns:1fr}}
    .gal-main{border:1px solid #eee;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff;aspect-ratio:4/3}
    .gal-main img{max-width:100%;max-height:100%;display:block}
    .gal-thumbs{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .gal-thumbs img{width:72px;height:72px;object-fit:cover;border:1px solid #eee;border-radius:8px;cursor:pointer}
    .modal .btn{appearance:none;border:0;border-radius:10px;background:#0A0A0A;color:#fff;padding:10px 14px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}
    .modal .btn.secondary{background:#1111110d;color:#111;border:1px solid #eaeaea}
    .modal .muted{color:#6b7280}
    .modal .price{font-weight:800;font-size:20px}
  `;
  const el = document.createElement("style");
  el.id = "samiah-modal-style";
  el.textContent = css;
  document.head.appendChild(el);
}

/* === Injecte la modale si absente, puis câble les références === */
function ensureModal(){
  ensureModalStyles();

  if (!document.getElementById("productModal")){
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div id="overlay" class="modal-overlay" aria-hidden="true"></div>
      <div id="productModal" class="modal" aria-hidden="true" role="dialog" aria-label="Fiche produit">
        <div class="modal-card" role="document">
          <div class="modal-head">
            <div id="mTitle" style="font-weight:800">Titre du produit</div>
            <button id="mClose" class="btn secondary">Fermer</button>
          </div>
          <div class="modal-body">
            <div>
              <div class="gal-main"><img id="mMain" src="" alt=""></div>
              <div id="mThumbs" class="gal-thumbs"></div>
            </div>
            <div class="meta">
              <div id="mPrice" class="price">—</div>
              <div id="mCat" class="muted" style="margin-top:4px">—</div>
              <div id="mDesc" style="margin-top:8px"></div>
              <div id="mCities" class="muted" style="margin-top:8px"></div>
              <div class="modal-actions" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
                <a id="mWhatsApp" class="btn" target="_blank" rel="noopener">Commander via WhatsApp</a>
                <button id="mPrev" class="btn secondary">⟨ Préc</button>
                <button id="mNext" class="btn secondary">Suiv ⟩</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
  }

  // Câblage des refs
  overlay = $("#overlay");
  modal   = $("#productModal");
  mTitle  = $("#mTitle");
  mPrice  = $("#mPrice");
  mCat    = $("#mCat");
  mDesc   = $("#mDesc");
  mCities = $("#mCities");
  mMain   = $("#mMain");
  mThumbs = $("#mThumbs");
  mWA     = $("#mWhatsApp");
  mPrev   = $("#mPrev");
  mNext   = $("#mNext");
  mClose  = $("#mClose");

  // Fermeture
  mClose?.addEventListener("click", closeModal);
  overlay?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeModal(); });
}

/* === État === */
let allProducts = [];
let filtered    = [];
let currentIdx  = -1;

/* ==============================
   UTILITAIRES FILTRES
   ============================== */
const isAll = (v) => {
  if (v == null) return true;
  const s = String(v).trim().toLowerCase();
  return !s || s === "toutes" || s.includes("toutes les catégories");
};

function ensureDefaultOptions(){
  // Catégorie: s’assurer qu’on a une option “Toutes”
  if (categoryEl){
    const hasAll = Array.from(categoryEl.options).some(o => isAll(o.value || o.textContent));
    if (!hasAll){
      const opt = document.createElement("option");
      opt.value = "Toutes";
      opt.textContent = "Toutes les catégories";
      categoryEl.insertBefore(opt, categoryEl.firstChild);
      categoryEl.selectedIndex = 0;
    }
  }
  // Ville: idem
  if (cityEl){
    const hasAllC = Array.from(cityEl.options).some(o => isAll(o.value || o.textContent));
    if (!hasAllC){
      const opt = document.createElement("option");
      opt.value = "Toutes";
      opt.textContent = "Toutes";
      cityEl.insertBefore(opt, cityEl.firstChild);
      cityEl.selectedIndex = 0;
    }
  }
}

/* ==============================
   CHARGEMENT
   ============================== */
async function fetchProducts(){
  let { data, error } = await supabase
    .from("products")
    .select(SELECT_COLS)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error && /created_at/i.test(error.message)) {
    ({ data, error } = await supabase
      .from("products")
      .select(SELECT_COLS)
      .eq("active", true)
      .order("published_at", { ascending: false, nullsFirst: false }));
  }

  if (error){
    console.error(error);
    allProducts = [];
    render();
    emptyMsgEl.style.display = "block";
    emptyMsgEl.textContent = `Aucun produit pour l’instant (erreur: ${error.message})`;
    return;
  }

  allProducts = (data || []).map(mapRow);
  buildCategoryFilter(allProducts);
  render();
}

function buildCategoryFilter(list){
  ensureDefaultOptions();
  if (categoryEl && categoryEl.options.length <= 1){
    const cats = Array.from(new Set(list.map(p=>p.category).filter(Boolean))).sort();
    const frag = document.createDocumentFragment();
    cats.forEach(c=>{
      const o = document.createElement("option");
      o.value = o.textContent = c;
      frag.appendChild(o);
    });
    categoryEl.appendChild(frag);
  }
}

/* ==============================
   RENDU & FILTRES
   ============================== */
function applyFilters(){
  const qRaw   = (searchEl?.value || "").toLowerCase().trim();
  const catRaw = (categoryEl?.value || categoryEl?.options?.[categoryEl.selectedIndex]?.text || "").trim();
  const cityRaw= (cityEl?.value || cityEl?.options?.[cityEl.selectedIndex]?.text || "").trim();

  filtered = allProducts.filter(p=>{
    const okQ   = !qRaw || (p.title + " " + (p.category||"") + " " + (p.shortDescription||"")).toLowerCase().includes(qRaw);
    const okCat = isAll(catRaw) || (p.category||"").toLowerCase() === catRaw.toLowerCase();
    const okCity= isAll(cityRaw) || (p.cities||[]).some(c => (c||"").toLowerCase() === cityRaw.toLowerCase());
    return okQ && okCat && okCity;
  });
}

function firstImage(p){
  if (Array.isArray(p.images) && p.images.length) return p.images[0];
  return p.image || "";
}

function cardTpl(p, idx){
  const img = firstImage(p);
  const price = `${fmt(p.price)} ${p.currency || "XAF"}`;
  return `
    <div class="card product-card" data-idx="${idx}" style="cursor:pointer">
      <img src="${img}" alt="${escapeHtml(p.title || "")}">
      <div class="p">
        <div style="font-weight:700">${escapeHtml(p.title || "")}</div>
        <div class="muted" style="margin-top:4px">${escapeHtml(p.category || "")}</div>
        <div style="margin-top:6px;font-weight:800">${price}</div>
      </div>
    </div>
  `;
}

function render(){
  ensureDefaultOptions();
  applyFilters();

  if(!gridEl) return;

  gridEl.innerHTML = filtered.map((p,i)=>cardTpl(p,i)).join("");

  if (filtered.length === 0){
    emptyMsgEl.style.display = "block";
  }else{
    emptyMsgEl.style.display = "none";
  }
}

/* ==============================
   MODALE PRODUIT
   ============================== */
function openModalAt(index){
  if (index < 0 || index >= filtered.length) return;

  // S'assure que la modale existe et que les refs sont câblées
  ensureModal();
  if (!overlay || !modal || !mTitle || !mMain || !mThumbs || !mWA || !mPrev || !mNext || !mClose || !mPrice || !mCat || !mDesc || !mCities) {
    console.warn("Modale introuvable après injection.");
    return;
  }

  currentIdx = index;
  const p = filtered[currentIdx];

  mTitle.textContent = p.title || "";
  mPrice.textContent = `${fmt(p.price)} ${p.currency || "XAF"}`;
  mCat.textContent   = p.category || "";
  mDesc.textContent  = p.longDescription || p.shortDescription || "";
  mCities.textContent= (p.cities||[]).length ? `Villes: ${p.cities.join(", ")}` : "";

  const msg = `Bonjour Samiah Cosmetics, je suis intéressé(e) par ${p.title} (${fmt(p.price)} ${p.currency||"XAF"}).`;
  mWA.href = `https://wa.me/23562752105?text=${encodeURIComponent(msg)}`;

  const imgs = Array.isArray(p.images) && p.images.length ? p.images : (p.image ? [p.image] : []);
  mMain.src = imgs[0] || "";
  mThumbs.innerHTML = imgs.map((u,k)=>(
    `<img data-k="${k}" src="${u}" alt="" ${k===0?"style='outline:2px solid #111'":""}>`
  )).join("");
  mThumbs.onclick = (e)=>{
    const k = e.target?.dataset?.k;
    if (k==null) return;
    const i = parseInt(k, 10);
    mMain.src = imgs[i] || "";
    [...mThumbs.querySelectorAll("img")].forEach((im,ix)=>{
      im.style.outline = (ix===i) ? "2px solid #111" : "none";
    });
  };

  mPrev.disabled = currentIdx<=0;
  mNext.disabled = currentIdx>=filtered.length-1;

  overlay.classList.add("open");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
}

function closeModal(){
  overlay?.classList.remove("open");
  modal?.classList.remove("open");
  modal?.setAttribute("aria-hidden","true");
  currentIdx = -1;
}

/* === Events === */
function bindUI(){
  searchEl?.addEventListener("input", render);
  categoryEl?.addEventListener("change", render);
  cityEl?.addEventListener("change", render);

  gridEl?.addEventListener("click", (e)=>{
    const card = e.target.closest(".product-card");
    if (!card) return;
    const idx = parseInt(card.dataset.idx, 10);
    openModalAt(idx);
  });
}

/* === Realtime === */
function subscribeRealtime(){
  supabase
    .channel("products-rt")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, async () => {
      await fetchProducts();
    })
    .subscribe();
}

/* === Boot === */
(async function init(){
  bindUI();
  await fetchProducts();
  subscribeRealtime();
})();
