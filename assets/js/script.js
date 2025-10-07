<script>
(function(){
  // ====== util ======
  const fmt = n => new Intl.NumberFormat('fr-FR').format(n);
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  let items = [];
  let editing = null;
  let extraUrls = []; // photos supplémentaires en cours (tableau d'URLs)

  const els = {
    q:$('#q'), cat:$('#catFilter'), tbody:$('#tbl tbody'), empty:$('#empty'),
    f_title:$('#f_title'), f_price:$('#f_price'), f_category:$('#f_category'),
    f_id:$('#f_id'), f_desc:$('#f_desc'), f_image:$('#f_image'), f_cities:$('#f_cities'),
    f_expDays:$('#f_expDays'), f_active:$('#f_active'),
    formTitle:$('#formTitle'), del:$('#del'), toast:$('#toast'),
    mainUploader:$('#main_uploader'), mainSend:$('#main_send'), mainPreview:$('#mainPreview'),
    extraUploader:$('#extra_uploader'), extraSend:$('#extra_send'), extraPreview:$('#extraPreview'),
    refreshBtn:$('#refreshBtn'), publishBtn:$('#publishBtn'), pubLabel:$('#pubLabel'), pubStatus:$('#pubStatus'),
    menuBtn:$('#menuBtn'), menu:$('#menu'), pubModal:$('#pubModal'), pubClose:$('#pubClose')
  };

  function show(txt){ els.toast.textContent=txt; els.toast.classList.add('show'); setTimeout(()=>els.toast.classList.remove('show'),1700); }
  function escapeHtml(s){return (''+s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  async function readResp(resp){ const ct=resp.headers.get('content-type')||''; if(ct.includes('application/json')){try{return await resp.json();}catch{}} const t=await resp.text(); return {__text:t}; }
  function stamp(){ const d=new Date(); return d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
  function setBtnLoading(btn,labelEl,txt){ btn.dataset.prev=(labelEl.textContent||''); btn.disabled=true; labelEl.textContent=txt; }
  function setBtnDone(btn,labelEl,txt='Terminé'){ labelEl.textContent=txt; setTimeout(()=>{ labelEl.textContent=btn.dataset.prev||labelEl.textContent; btn.disabled=false; },1000); }
  function setBtnIdle(btn,labelEl){ labelEl.textContent = btn.dataset.prev || labelEl.textContent; btn.disabled=false; }
  function slugify(s){return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}

  // ====== admin secret ======
  const SECRET_KEY='samiah_admin_secret';
  const getAdminSecret=()=>localStorage.getItem(SECRET_KEY)||'';
  function ensureAdminSecret(){ if(!getAdminSecret()){ changeAdminSecret(); } }
  function changeAdminSecret(){
    const cur = getAdminSecret();
    const v = prompt('Code admin ?', cur ? '••••••' : '');
    if(v && v!=='••••••'){ localStorage.setItem(SECRET_KEY, v.trim()); show('Code enregistré'); }
  }
  function logoutAdmin(){ localStorage.removeItem(SECRET_KEY); show('Déconnecté'); setTimeout(()=>location.reload(),400); }

  // ====== fetch list (PATCH: anti-cache + états bouton + erreurs visibles) ======
  async function refreshList(){
    const btn = els.refreshBtn;
    const prevTxt = btn ? btn.textContent : '';
    if(btn){ btn.disabled = true; btn.textContent = 'Rafraîchissement…'; }

    try{
      ensureAdminSecret();
      const secret = getAdminSecret();
      if(!secret) throw new Error('Code admin manquant');

      const url = '/api/admin/list-products?_=' + Date.now(); // bust cache
      const r = await fetch(url, {
        headers: { 'x-admin-secret': secret },
        cache: 'no-store',
        credentials: 'same-origin'
      });

      if(!r.ok){
        let details = '';
        try{ details = await r.text(); }catch{}
        throw new Error(`HTTP ${r.status} ${r.statusText}${details ? ' — ' + details : ''}`);
      }

      const j = await r.json();
      items = Array.isArray(j.items) ? j.items : [];

      fillCats();
      render();
      updateWAPreview();
      show('Liste actualisée ✅');
      // (optionnel) indique l’heure dans le statut
      els.pubStatus.textContent = `Dernier rafraîchissement : ${stamp()}`;
    }catch(e){
      console.error('refreshList error:', e);
      alert('Rafraîchissement impossible : ' + (e?.message || e));
      show('Échec rafraîchissement ❌');
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = prevTxt || 'Rafraîchir'; }
    }
  }

  function fillCats(){
    const cats = Array.from(new Set(items.map(p=>p.category).filter(Boolean))).sort();
    els.cat.innerHTML = '<option value="">Toutes</option>' + cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
  }

  function render(){
    const q = (els.q.value||'').toLowerCase();
    const cat = (els.cat.value||'');
    const data = items.filter(p=>{
      const okQ = (p.title+' '+(p.category||'')).toLowerCase().includes(q);
      const okC = !cat || p.category===cat;
      return okQ && okC;
    });
    els.tbody.innerHTML = data.map((p,i)=>rowTpl(p,i)).join('');
    els.empty.style.display = data.length?'none':'block';
  }

  function rowTpl(p,i){
    const cities=(p.cities||[]).slice(0,3).join(', ')+((p.cities||[]).length>3?'…':'');
    const img = p.image? `<img src="${escapeHtml(p.image)}" alt="" style="width:60px;height:40px;object-fit:cover;border:1px solid #eee;border-radius:6px">` : '<span class="muted">—</span>';
    return `<tr>
      <td>${escapeHtml(p.title||'')}</td>
      <td>${fmt(p.price||0)} XAF</td>
      <td>${escapeHtml(p.category||'')}</td>
      <td>${escapeHtml(cities)}</td>
      <td>${img}</td>
      <td class="actions">
        <button class="btn secondary" data-act="edit" data-idx="${i}">Éditer</button>
        <button class="btn" style="background:#b42318" data-act="del" data-idx="${i}">Supprimer</button>
      </td>
    </tr>`;
  }

  // ====== edit / save ======
  function selectedCities(){ return Array.from(els.f_cities.selectedOptions).map(o=>o.value); }
  function reset(clear=true){
    editing=null; els.formTitle.textContent='Nouveau produit'; els.del.style.display='none';
    extraUrls=[]; els.extraPreview.innerHTML='';
    els.mainPreview.innerHTML='';
    if(clear){
      els.f_title.value=els.f_price.value=els.f_category.value=els.f_id.value=els.f_desc.value=els.f_image.value='';
      els.f_active.checked=true; els.f_expDays.value='';
      Array.from(els.f_cities.options).forEach(o=>o.selected=false);
      if(els.mainUploader) els.mainUploader.value='';
      if(els.extraUploader) els.extraUploader.value='';
    }
    updateWAPreview();
  }

  function edit(idx){
    const p=items[idx]; if(!p) return;
    editing=idx; els.formTitle.textContent='Modifier le produit'; els.del.style.display='';
    els.f_title.value=p.title||''; els.f_price.value=p.price||0; els.f_category.value=p.category||''; els.f_id.value=p.id||'';
    els.f_desc.value=p.shortDescription||''; els.f_image.value=p.image||'';
    els.f_active.checked = (p.active!==false);
    els.f_expDays.value = (typeof p.expiresAfterDays==='number') ? p.expiresAfterDays : '';
    Array.from(els.f_cities.options).forEach(o=>o.selected=(p.cities||[]).includes(o.value));

    // previews
    els.mainPreview.innerHTML = p.image? `<img src="${escapeHtml(p.image)}" alt="">` : '';
    extraUrls = Array.isArray(p.images)? [...p.images] : [];
    renderExtraThumbs();

    updateWAPreview();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function removeItem(i){
    if(!confirm('Supprimer ce produit ?')) return;
    const p = items[i];
    items.splice(i,1);
    editing=null; render(); show('Produit supprimé');
    // suppression en base si id + secret
    try{
      const secret=getAdminSecret();
      if(p?.id && secret){
        fetch('/api/admin/delete-product',{
          method:'POST',
          headers:{'Content-Type':'application/json','x-admin-secret':secret},
          body:JSON.stringify({id:p.id})
        }).catch(()=>{});
      }
    }catch{}
  }

  function save(){
    const nowIso = new Date().toISOString();
    const expDays = parseInt((els.f_expDays?.value||'').trim(),10);

    const p = {
      id: (els.f_id.value||slugify(els.f_title.value)).trim(),
      title: els.f_title.value.trim(),
      price: parseInt(els.f_price.value||'0',10),
      currency:'XAF',
      category: els.f_category.value.trim(),
      shortDescription: els.f_desc.value.trim(),
      image: els.f_image.value.trim(),
      images: extraUrls.slice(),    // <= photos supplémentaires
      cities: selectedCities(),
      active: els.f_active.checked,
      expiresAfterDays: isNaN(expDays)? null : expDays,
      publishedAt: items[editing]?.publishedAt || nowIso
    };
    if(!p.title){ alert('Titre requis'); return; }
    if(isNaN(p.price)){ alert('Prix invalide'); return; }

    if(editing!=null){ items[editing]=p; show('Produit mis à jour'); }
    else { items.unshift(p); show('Produit ajouté'); }

    reset(false); render();
  }

  // ====== WhatsApp preview ======
  function updateWAPreview(){
    const title = els.f_title.value || 'Nom du produit';
    const price = els.f_price.value ? fmt(parseInt(els.f_price.value,10))+' XAF' : 'Prix à préciser';
    $('#waPreview').textContent = `Bonjour Samiah Cosmetics, je suis intéressé(e) par ${title} (${price}).`;
  }

  // ====== Compression adaptative + upload (-> /api/upload-image) ======
  const MAX_PAYLOAD_BYTES = 4_000_000; // sécurité sous ~4.5 Mo
  const START_SIDE = 2200, MIN_SIDE = 900;
  const START_QUALITY = 0.9, MIN_QUALITY = 0.6;

  function loadImageFromFile(file){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>{ const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=r.result; };
      r.onerror=reject; r.readAsDataURL(file);
    });
  }
  function drawToCanvas(img, maxSide){
    const c=document.createElement('canvas');
    let w=img.width, h=img.height;
    const scale = Math.min(1, maxSide/Math.max(w,h));
    w=Math.max(1,Math.round(w*scale)); h=Math.max(1,Math.round(h*scale));
    c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
    return c;
  }
  function dataUrlToB64(u){ return (u||'').split(',')[1]||''; }
  function base64Size(b64){ return Math.ceil((b64.length)*0.75); } // bytes ≈ 3/4

  async function compressToTargetBase64(file){
    const img = await loadImageFromFile(file);
    let side = START_SIDE, quality = START_QUALITY;
    let attempt = 0, b64='', bytes=Infinity;

    while(attempt++ < 10){
      const canvas = drawToCanvas(img, side);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      b64   = dataUrlToB64(dataUrl);
      bytes = base64Size(b64);
      if(bytes <= MAX_PAYLOAD_BYTES) break; // gagné
      if (side > MIN_SIDE) side = Math.round(side * 0.86);
      if (quality > MIN_QUALITY) quality = Math.max(MIN_QUALITY, quality - 0.08);
    }
    return { base64:b64, approxBytes:bytes };
  }

  async function uploadOne(file, nameHint){
    if(!file){ throw new Error('Aucun fichier'); }
    const secret=getAdminSecret(); if(!secret){ changeAdminSecret(); throw new Error('Code admin requis.'); }

    // compression adaptative
    const { base64, approxBytes } = await compressToTargetBase64(file);

    const ext = 'jpg';
    const base = (nameHint || file.name.replace(/\.[^.]+$/,'') || 'image').toLowerCase();
    const filename = `${Date.now()}-${slugify(base)}.${ext}`;

    const resp = await fetch('/api/upload-image',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-admin-secret':secret},
      body:JSON.stringify({filename, contentBase64:base64})
    });
    const out = await readResp(resp);
    if(!resp.ok) throw new Error(out?.error || out?.details || out?.__text || resp.statusText);
    if(!out?.siteUrl) throw new Error('Upload OK mais URL manquante');
    return { url: out.siteUrl, size: approxBytes };
  }

  async function uploadMain(){
    try{
      const f = els.mainUploader.files[0];
      setBtnLoading(els.mainSend, els.mainSend, 'Téléversement…');
      const { url, size } = await uploadOne(f, els.f_title.value||'image');
      els.f_image.value = url;
      els.mainPreview.innerHTML = `<img src="${escapeHtml(url)}" alt="">`;
      setBtnDone(els.mainSend, els.mainSend, 'Téléversé ✅');
      show(`Image principale envoyée ✅ (${(size/1024).toFixed(0)} Ko)`);
    }catch(e){
      setBtnIdle(els.mainSend, els.mainSend);
      alert('Erreur upload: ' + e.message);
    }
  }

  function renderExtraThumbs(){
    els.extraPreview.innerHTML = extraUrls.map((u,i)=>
      `<span style="position:relative;display:inline-block">
         <img src="${escapeHtml(u)}" alt="">
         <button title="Supprimer" style="position:absolute;top:-6px;right:-6px;border:0;background:#b42318;color:#fff;border-radius:999px;width:20px;height:20px;cursor:pointer;font-size:12px;line-height:20px" data-x="${i}">×</button>
       </span>`
    ).join('');
  }

  async function uploadExtra(){
    try{
      const files = Array.from(els.extraUploader.files||[]);
      if(!files.length){ alert('Choisis au moins une image'); return; }
      els.extraSend.disabled = true; els.extraSend.textContent='Téléversement…';
      for(const f of files){
        const { url } = await uploadOne(f, (els.f_title.value||'image-sup'));
        extraUrls.push(url);
      }
      renderExtraThumbs();
      els.extraSend.textContent='Téléversé ✅';
      setTimeout(()=>{ els.extraSend.textContent='Téléverser'; els.extraSend.disabled=false; }, 1000);
      show('Photos supplémentaires envoyées ✅');
    }catch(e){
      els.extraSend.disabled=false; els.extraSend.textContent='Téléverser';
      alert('Erreur upload: ' + e.message);
    }
  }

  // ====== publish to backend (petit plus : refresh derrière)
  function showModal(m){ m.classList.add('show'); m.setAttribute('aria-hidden','false'); }
  function hideModal(m){ m.classList.remove('show'); m.setAttribute('aria-hidden','true'); }

  async function publishToBackend(){
    const secret=getAdminSecret(); if(!secret){ changeAdminSecret(); return; }
    try{
      setBtnLoading(els.publishBtn, els.pubLabel, 'Publication…');
      const resp = await fetch('/api/admin/save-products',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-admin-secret':secret},
        body:JSON.stringify({products:items})
      });
      const out = await readResp(resp);
      if(!resp.ok) throw new Error(out?.error || out?.__text || resp.statusText);
      setBtnDone(els.publishBtn, els.pubLabel, 'Publié ✅');
      els.pubStatus.textContent = `Dernière publication : ${stamp()}`;
      show('Publié ✅');
      showModal(els.pubModal);
      // recharger la liste après publication pour être 100% synchro
      await refreshList();
    }catch(e){
      setBtnIdle(els.publishBtn, els.pubLabel);
      alert('Échec publication: ' + e.message);
    }
  }

  // ====== events ======
  function bind(){
    // table actions
    $('#tbl').addEventListener('click', (e)=>{
      const b=e.target.closest('button'); if(!b) return;
      const idx = parseInt(b.dataset.idx,10);
      if(b.dataset.act==='edit') edit(idx);
      if(b.dataset.act==='del') removeItem(idx);
    });

    els.q.oninput = els.cat.onchange = render;
    ['input','change'].forEach(evt=>{
      els.f_title.addEventListener(evt,updateWAPreview);
      els.f_price.addEventListener(evt,updateWAPreview);
    });

    $('#save').onclick = save;
    $('#reset').onclick = ()=>reset(true);
    els.del.onclick = ()=>{ if(editing!=null){ removeItem(editing); reset(); } };

    els.mainSend.onclick = uploadMain;
    els.extraSend.onclick = uploadExtra;

    els.extraPreview.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-x]');
      if(!btn) return;
      const i = parseInt(btn.dataset.x,10);
      extraUrls.splice(i,1);
      renderExtraThumbs();
    });

    // top buttons
    els.refreshBtn.onclick = refreshList; // <-- fonctionne maintenant avec anti-cache & feedback
    els.publishBtn.onclick = publishToBackend;

    // menu ⋯
    const openMenu=()=>{ els.menu.classList.add('open'); els.menuBtn.setAttribute('aria-expanded','true'); els.menu.setAttribute('aria-hidden','false'); };
    const closeMenu=()=>{ els.menu.classList.remove('open'); els.menuBtn.setAttribute('aria-expanded','false'); els.menu.setAttribute('aria-hidden','true'); };
    const toggleMenu=()=> els.menu.classList.contains('open')?closeMenu():openMenu();
    els.menuBtn.addEventListener('click', e=>{ e.stopPropagation(); toggleMenu(); });
    document.addEventListener('click', e=>{ if(!els.menu.contains(e.target) && e.target!==els.menuBtn) closeMenu(); });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeMenu(); });

    $('#miChangeSecret').onclick = ()=>{ closeMenu(); changeAdminSecret(); };
    $('#miLogout').onclick = ()=>{ closeMenu(); logoutAdmin(); };

    // modal
    els.pubClose.onclick = ()=> hideModal(els.pubModal);
    els.pubModal.addEventListener('click', e=>{ if(e.target===els.pubModal) hideModal(els.pubModal); });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape') hideModal(els.pubModal); });
  }

  // ====== start ======
  function start(){
    bind();
    reset(true);
    refreshList();
  }

  // DOM ready
  if(document.readyState!=='loading') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
</script>
