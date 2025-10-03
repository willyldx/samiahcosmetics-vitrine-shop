/* /assets/js/script.js  —  Vitrine Samiah (Supabase + Fiche produit)
   - Sélection sans alias SQL (PostgREST) pour éviter l'erreur
   - Mapping snake_case -> camelCase côté JS
   - Chargement + filtres + galerie d’images
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
function escapeHtml(s){return (""+s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

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

/* === Éléments principaux === */
const gridEl   = $("#products-grid");
let emptyMsgEl = $("#emptyMsg");
if(!emptyMsgEl){
  emptyMsgEl = document.createElement("div");
  emptyMsgEl.id = "emptyMsg";
  emptyMsgEl.className = "muted";
  emptyMsgEl.style.margin = "12px 0 0";
  gridEl?.parentNode?.insertBefore(emptyMsgEl, gridEl?.nextSibling || null);
}

const searchEl   = $("#search");
const categoryEl = $("#category");
const cityEl     = $("#city");

/* === Modal fiche produit (IDs m… comme dans index.html) === */
const overlay  = $("#overlay");
const modal    = $("#productModal");
const mTitle   = $("#mTitle");
const mPrice   = $("#mPrice");
const mCat     = $("#mCat");
const mDesc    = $("#mDesc");
const mCities  = $("#mCities");
const mMain    = $("#mMain");
const mThumbs  = $("#mThumbs");
const mWA      = $("#mWhatsApp");
const mPrev    = $("#mPrev");
const mNext    = $("#mNext");
const mClose   = $("#mClose");

/* === État === */
let allProducts = [];
let filtered    = [];
let currentIdx  = -1;

/* ==============================
   CHARGEMENT DU CATALOGUE
   ============================== */
async function fetchProducts(){
  // Essai principal : order by created_at
  let { data, error } = await supabase
    .from("products")
    .select(SELECT_COLS)
    .eq("active", true)
    .order("created_at", { ascending: false });

  // Fallback si created_at n'existe pas
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

/* === Filtres === */
function buildCategoryFilter(list){
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

function applyFilters(){
  const q   = (searchEl?.value || "").toLowerCase().trim();
  const cat = categoryEl?.value || "Toutes";
  const city= cityEl?.value || "Toutes";

  filtered = allProducts.filter(p=>{
    const okQ   = !q   || (p.title + " " + (p.category||"") + " " + (p.shortDescription||"")).toLowerCase().includes(q);
    const okCat = cat === "Toutes"  || p.category === cat;
    const okCity= city=== "Toutes"  || (p.cities||[]).includes(city);
    return okQ && okCat && okCity;
  });
}

/* === Rendu === */
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
  applyFilters();
  if(!gridEl) return;

  gridEl.innerHTML = filtered.map((p,i)=>cardTpl(p,i)).join("");

  if (filtered.length === 0){
    emptyMsgEl.style.display = "block";
    if (!emptyMsgEl.textContent) emptyMsgEl.textContent = "Aucun produit pour l’instant.";
  }else{
    emptyMsgEl.style.display = "none";
  }
}

/* ==============================
   FICHE PRODUIT (GALERIE)
   ============================== */
function openModalAt(index){
  if (index < 0 || index >= filtered.length) return;
  currentIdx = index;
  const p = filtered[currentIdx];

  // Meta
  mTitle && (mTitle.textContent = p.title || "");
  mPrice && (mPrice.textContent = `${fmt(p.price)} ${p.currency || "XAF"}`);
  mCat   && (mCat.textContent   = p.category || "");
  mDesc  && (mDesc.textContent  = p.longDescription || p.shortDescription || "");
  mCities&& (mCities.textContent= (p.cities||[]).length ? `Villes: ${p.cities.join(", ")}` : "");

  // WhatsApp
  const msg = `Bonjour Samiah Cosmetics, je suis intéressé(e) par ${p.title} (${fmt(p.price)} ${p.currency||"XAF"}).`;
  const wa  = `https://wa.me/23562752105?text=${encodeURIComponent(msg)}`;
  mWA && (mWA.href = wa);

  // Galerie
  const imgs = Array.isArray(p.images) && p.images.length ? p.images : (p.image ? [p.image] : []);
  mMain && (mMain.src = imgs[0] || "");

  if (mThumbs){
    mThumbs.innerHTML = imgs.map((u,k)=>(
      `<img data-k="${k}" src="${u}" alt="" ${k===0?"style='outline:2px solid #111'":""}>`
    )).join("");
    mThumbs.onclick = (e)=>{
      const k = e.target?.dataset?.k;
      if (k==null) return;
      const i = parseInt(k, 10);
      mMain && (mMain.src = imgs[i] || "");
      $$(".gal-thumbs img", mThumbs).forEach((im,ix)=>{
        im.style.outline = (ix===i) ? "2px solid #111" : "none";
      });
    };
  }

  // Nav
  mPrev && (mPrev.disabled = currentIdx<=0);
  mNext && (mNext.disabled = currentIdx>=filtered.length-1);

  // Show
  overlay && overlay.classList.add("open");
  modal   && modal.classList.add("open");
  modal?.setAttribute("aria-hidden","false");
}

function closeModal(){
  overlay && overlay.classList.remove("open");
  modal   && modal.classList.remove("open");
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

  mClose?.addEventListener("click", closeModal);
  overlay?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeModal(); });

  mPrev?.addEventListener("click", ()=>{ if (currentIdx>0) openModalAt(currentIdx-1); });
  mNext?.addEventListener("click", ()=>{ if (currentIdx<filtered.length-1) openModalAt(currentIdx+1); });
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
