// /assets/js/script.js (ES module)

// 1) Dépendance Supabase (ESM CDN)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 2) Config Supabase (tes valeurs)
const SB_URL  = 'https://dzzblqlteirtzyegplgu.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6emJscWx0ZWlydHp5ZWdwbGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjgyMDgsImV4cCI6MjA3NTAwNDIwOH0.WbjNAjF2qxly8QMu-3VJLPQE88UgzkeAn9XPj0lcb1Y';
// ⚠️ Ne mets JAMAIS la Service Role ici (réservée au serveur)
const supabase = createClient(SB_URL, SB_ANON);

// 3) Sélecteurs & utilitaires
const $ = (s) => document.querySelector(s);
const els = {
  grid:     $('#products-grid'),
  search:   $('#search'),
  category: $('#category'),
  city:     $('#city'),
};
const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Number(n || 0));
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// 4) Récupération & rendu
async function fetchProducts() {
  try {
    let q = supabase.from('products').select('*').order('created_at', { ascending: false });

    // Filtres
    const term = (els.search?.value || '').trim();
    const cat  = (els.category?.value || 'Toutes');
    const city = (els.city?.value || 'Toutes');

    if (term) {
      q = q.or(`title.ilike.%${term}%,category.ilike.%${term}%`);
    }
    if (cat && cat !== 'Toutes')  q = q.eq('category', cat);
    if (city && city !== 'Toutes') q = q.contains('cities', [city]);

    const { data, error } = await q;
    if (error) throw error;

    render(data || []);
    fillCategories(data || []);
  } catch (err) {
    console.error('fetchProducts error:', err);
    els.grid.innerHTML = `<div class="card"><div class="p">Erreur de chargement des produits.</div></div>`;
  }
}

function waLink(p) {
  const price = p?.price ? `${fmt(p.price)} XAF` : 'Prix ?';
  const msg = encodeURIComponent(`Bonjour Samiah Cosmetics, je suis intéressé(e) par ${p.title} (${price}).`);
  return `https://wa.me/23562752105?text=${msg}`;
}

function productCard(p) {
  const img = p.image || '/assets/images/placeholder.png';
  const price = p?.price ? `${fmt(p.price)} XAF` : '';
  const cities = Array.isArray(p.cities) ? p.cities.join(', ') : '';
  const sd = p.short_description || p.shortDescription || '';

  return `
  <div class="card">
    <img src="${img}" alt="${escapeHtml(p.title || '')}"
         onerror="this.onerror=null;this.src='/assets/images/placeholder.png'">
    <div class="p">
      <div style="font-weight:700">${escapeHtml(p.title || '')}</div>
      <div class="muted" style="margin:2px 0 6px">${escapeHtml(sd)}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <small class="muted">${escapeHtml(p.category || '')}</small>
        <strong>${price}</strong>
      </div>
      ${cities ? `<div><small class="muted">${escapeHtml(cities)}</small></div>` : ''}
      <a class="btn" style="margin-top:8px" href="${waLink(p)}" target="_blank" rel="noopener">Commander via WhatsApp</a>
    </div>
  </div>`;
}

function render(list) {
  if (!list.length) {
    els.grid.innerHTML = `<div class="card"><div class="p muted">Aucun produit pour l’instant.</div></div>`;
    return;
  }
  els.grid.innerHTML = list.map(productCard).join('');
}

function fillCategories(list) {
  if (!els.category) return;
  const cats = [...new Set(list.map(p => p.category).filter(Boolean))].sort();
  const current = els.category.value || 'Toutes';
  els.category.innerHTML =
    `<option value="Toutes">Toutes les catégories</option>` +
    cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if ([...els.category.options].some(o => o.value === current)) {
    els.category.value = current;
  }
}

// 5) Interactions UI
[els.search, els.category, els.city].forEach(el => {
  if (el) el.addEventListener('input', debounce(fetchProducts, 150));
});

// 6) Realtime (auto-actualisation)
function setupRealtime() {
  try {
    const channel = supabase
      .channel('public:products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          fetchProducts();
        }
      });

    window.addEventListener('beforeunload', () => {
      supabase.removeChannel(channel);
    });
  } catch (e) {
    console.warn('Realtime disabled:', e);
    fetchProducts();
  }
}

// 7) debounce util
function debounce(fn, delay=200){
  let t; return (...args) => { clearTimeout(t); t=setTimeout(()=>fn(...args), delay); };
}

// 8) Lancement
setupRealtime();
