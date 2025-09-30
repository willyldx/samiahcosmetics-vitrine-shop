
const WHATSAPP = '+23562752105';
const productsGrid = document.querySelector('#products-grid');
const searchInput = document.querySelector('#search');
const catSelect = document.querySelector('#category');
const citySelect = document.querySelector('#city');

async function loadProducts(){
  const res = await fetch('./data/products.json');
  const data = await res.json();
  window.__products = data;
  render();
  fillFilters(data);
}
function fillFilters(data){
  const cats = Array.from(new Set(data.map(p=>p.category))).sort();
  cats.unshift('Toutes');
  cats.forEach(c=>{
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    catSelect.appendChild(opt);
  });
}
function render(){
  const q = (searchInput.value||'').toLowerCase();
  const cat = catSelect.value || 'Toutes';
  const city = citySelect.value || 'Toutes';
  const items = (window.__products||[]).filter(p=>{
    const okQ = [p.title,p.shortDescription,(p.category||'')].join(' ').toLowerCase().includes(q);
    const okCat = (cat==='Toutes') || p.category===cat;
    const okCity = (city==='Toutes') || (p.cities||[]).includes(city);
    return okQ && okCat && okCity;
  });
  productsGrid.innerHTML = items.map(toCard).join('');
}
function toCard(p){
  const price = new Intl.NumberFormat('fr-FR').format(p.price) + ' ' + (p.currency||'XAF');
  const msg = encodeURIComponent(`Bonjour Samiah Cosmetics, je suis intéressé(e) par ${p.title} (${price}).`);
  const wa = `https://wa.me/${WHATSAPP.replace('+','')}?text=${msg}`;
  return `
  <div class="card">
    <img src="${p.image}" alt="${p.title}">
    <div class="p">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <strong>${p.title}</strong>
        <span class="badge">${price}</span>
      </div>
      <div style="margin:8px 0 12px"><small class="muted">${p.shortDescription||''}</small></div>
      <a class="btn" href="${wa}" target="_blank" rel="noopener">Commander sur WhatsApp</a>
    </div>
  </div>`;
}

document.addEventListener('input', (e)=>{
  if(e.target===searchInput||e.target===catSelect||e.target===citySelect) render();
});

loadProducts();
