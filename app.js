/* ================= supabase ================= */
const SUPABASE_URL = 'https://whigwtcqijcsfvkshekz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoaWd3dGNxaWpjc2Z2a3NoZWt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1ODkxNDksImV4cCI6MjEwNTE2NTE0OX0.sdPQ7dnDVQ5TPTjTC_tIK2rwPHfH8bwBCsBKsJBecU8';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function persist(promiseBuilder){
  promiseBuilder.then(res=>{ if(res && res.error) console.error('Supabase:', res.error.message); });
}

/* ================= utilità ================= */
const uid = () => {
  if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
  // fallback per contesti non sicuri (http) dove crypto.randomUUID non esiste
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
    const r = Math.random()*16|0;
    return (c==='x' ? r : (r&0x3|0x8)).toString(16);
  });
};
const todayStr = () => new Date().toISOString().slice(0,10);
const fmtDate = d => d ? new Date(d).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'}) : '&mdash;';
const daysUntil = d => { if(!d) return null; return Math.ceil((new Date(d) - new Date(todayStr()))/86400000); };
function capitalize(s){return s.charAt(0).toUpperCase()+s.slice(1);}

/* ================= mapping righe Supabase <-> oggetti app ================= */
const campoFromRow = r => ({id:r.id, nome:r.nome, coltura:r.coltura, superficieHa:r.superficie_ha,
  boundary:r.boundary||[], proprietaAttuale:{proprietario:r.proprietario, tipo:r.tipo_possesso, dal:r.dal}});
const mezzoFromRow = r => ({id:r.id, nome:r.nome, targa:r.targa, anno:r.anno,
  scadenze:{assicurazione:r.assicurazione, revisione:r.revisione, bollo:r.bollo}, foto:r.foto_url});
const attrFromRow = r => ({id:r.id, nome:r.nome, tipo:r.tipo, caratteristiche:r.caratteristiche,
  mezzoCompatibile:r.mezzo_compatibile, foto:r.foto_url});
const lavFromRow = r => ({id:r.id, campoId:r.campo_id, data:r.data, tipo:r.tipo,
  mezzoId:r.mezzo_id, attrezzoId:r.attrezzo_id, operatore:r.operatore, note:r.note||''});
const manFromRow = r => ({id:r.id, targetType:r.target_type, targetId:r.target_id, data:r.data,
  tipo:r.tipo, ore:r.ore, operatore:r.operatore});
const scadManFromRow = r => ({id:r.id, titolo:r.titolo, data:r.data, note:r.note});
const docFromRow = r => ({id:r.id, targetType:r.target_type, targetId:r.target_id, nome:r.nome, url:r.url, data:r.data});

/* ================= stato ================= */
let state = { opzioni:{tipiLavorazione:[], colture:[], operatori:[]}, campi:[], mezzi:[], attrezzature:[], lavorazioni:[], manutenzioni:[], scadenzeManuali:[], documenti:[] };

async function loadAll(){
  const [opzRes, campiRes, mezziRes, attrRes, lavRes, manRes, scadRes, docRes] = await Promise.all([
    sb.from('opzioni').select('*'),
    sb.from('campi').select('*').order('nome'),
    sb.from('mezzi').select('*').order('nome'),
    sb.from('attrezzature').select('*').order('nome'),
    sb.from('lavorazioni').select('*'),
    sb.from('manutenzioni').select('*'),
    sb.from('scadenze_manuali').select('*'),
    sb.from('documenti').select('*')
  ]);
  const opz = {tipiLavorazione:[], colture:[], operatori:[]};
  (opzRes.data||[]).forEach(r=>{ opz[r.key] = r.valori || []; });
  state = {
    opzioni: opz,
    campi: (campiRes.data||[]).map(campoFromRow),
    mezzi: (mezziRes.data||[]).map(mezzoFromRow),
    attrezzature: (attrRes.data||[]).map(attrFromRow),
    lavorazioni: (lavRes.data||[]).map(lavFromRow),
    manutenzioni: (manRes.data||[]).map(manFromRow),
    scadenzeManuali: (scadRes.data||[]).map(scadManFromRow),
    documenti: (docRes.data||[]).map(docFromRow)
  };
}

const mezzoNome = id => state.mezzi.find(m=>m.id===id)?.nome || '&mdash;';
const attrNome = id => state.attrezzature.find(a=>a.id===id)?.nome || '&mdash;';
const campoNome = id => state.campi.find(c=>c.id===id)?.nome || '&mdash;';

let currentView = 'dashboard';

document.getElementById('topDate').textContent = new Date().toLocaleDateString('it-IT',{weekday:'long', day:'numeric', month:'long', year:'numeric'});

const railEl = document.getElementById('rail');
const railBackdrop = document.getElementById('railBackdrop');
function closeMenu(){ railEl.classList.remove('open'); railBackdrop.classList.remove('show'); }
document.getElementById('menuToggle').onclick = ()=>{ railEl.classList.toggle('open'); railBackdrop.classList.toggle('show'); };
railBackdrop.onclick = closeMenu;

document.querySelectorAll('.nav-item').forEach(el=>{
  el.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    el.classList.add('active');
    currentView = el.dataset.view;
    document.getElementById('viewTitle').textContent = el.textContent.trim();
    render();
    closeMenu();
  });
});

function stampFor(days){
  if(days===null) return '<span class="stamp info"><span class="dot"></span>non impostata</span>';
  if(days<0) return '<span class="stamp late"><span class="dot"></span>scaduta</span>';
  if(days<=30) return `<span class="stamp warn"><span class="dot"></span>tra ${days} gg</span>`;
  return `<span class="stamp ok"><span class="dot"></span>ok</span>`;
}
function dotFor(days){
  let cls = 'info';
  if(days!==null){ cls = days<0 ? 'late' : (days<=30 ? 'warn' : 'ok'); }
  return `<span class="status-dot ${cls}"></span>`;
}

function render(){
  const v = document.getElementById('view');
  if(currentView==='dashboard') v.innerHTML = renderDashboard();
  if(currentView==='scadenze') v.innerHTML = renderScadenze();
  if(currentView==='campi') v.innerHTML = renderCampi();
  if(currentView==='mezzi') v.innerHTML = renderMezzi();
  if(currentView==='attrezzature') v.innerHTML = renderAttrezzature();
  if(currentView==='impostazioni') v.innerHTML = renderImpostazioni();
  attachHandlers();
  buildDetailModal();
}

let currentDetail = null;
let currentLeafletMap = null;
let editBoundaryMode = false;
let campoSettingsOpen = false;
let mezzoSettingsOpen = false;
let attrSettingsOpen = false;
function openDetail(type, id){ currentDetail = {type, id}; campoSettingsOpen = false; mezzoSettingsOpen = false; attrSettingsOpen = false; buildDetailModal(); }
function closeDetail(){
  if(currentLeafletMap){ currentLeafletMap.remove(); currentLeafletMap = null; }
  currentDetail = null;
  campoSettingsOpen = false; mezzoSettingsOpen = false; attrSettingsOpen = false;
  const back = document.getElementById('detailModalBack');
  if(back) back.remove();
}
function buildDetailModal(){
  if(!currentDetail) return;
  let bodyHtml = null;
  if(currentDetail.type==='campo'){ const c = state.campi.find(x=>x.id===currentDetail.id); if(c) bodyHtml = campoDetail(c); }
  if(currentDetail.type==='mezzo'){ const v = state.mezzi.find(x=>x.id===currentDetail.id); if(v) bodyHtml = mezzoDetail(v); }
  if(currentDetail.type==='attr'){ const a = state.attrezzature.find(x=>x.id===currentDetail.id); if(a) bodyHtml = attrDetail(a); }
  if(bodyHtml===null){ closeDetail(); return; }
  let back = document.getElementById('detailModalBack');
  if(!back){
    back = document.createElement('div'); back.id = 'detailModalBack'; back.className = 'modal-back';
    back.innerHTML = `<div class="modal wide"><button class="modal-close" id="detailModalClose">&times;</button><div id="detailModalBody"></div></div>`;
    back.addEventListener('click', e=>{ if(e.target===back) closeDetail(); });
    document.body.appendChild(back);
    document.getElementById('detailModalClose').onclick = closeDetail;
  }
  document.getElementById('detailModalBody').innerHTML = bodyHtml;
  attachHandlers();
}

function navigateTo(view, id, type){
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active', n.dataset.view===view));
  const navEl = document.querySelector(`.nav-item[data-view="${view}"]`);
  if(navEl) document.getElementById('viewTitle').textContent = navEl.textContent.trim();
  render();
  openDetail(type, id);
}

function combinedScadenze(){
  const auto = state.mezzi.flatMap(m=>Object.entries(m.scadenze).map(([tipo,data])=>({desc:`${capitalize(tipo)} &middot; ${m.nome}`, data, origine:'Mezzo', manualId:null, mezzoId:m.id})));
  const manuali = state.scadenzeManuali.map(s=>({desc:s.titolo + (s.note?` &middot; ${s.note}`:''), data:s.data, origine:'Manuale', manualId:s.id, mezzoId:null}));
  return auto.concat(manuali).filter(s=>s.data).sort((a,b)=>new Date(a.data)-new Date(b.data));
}

/* ================= dashboard ================= */
function renderDashboard(){
  const scadenze = combinedScadenze();
  const ultimeLav = state.lavorazioni.map(l=>({...l, campo:campoNome(l.campoId)}))
    .sort((a,b)=>new Date(b.data)-new Date(a.data)).slice(0,6);
  return `
  <div class="detail">
    <div class="field-block">
      <h4>Ultime lavorazioni</h4>
      <table class="data"><thead><tr><th>Data</th><th>Campo</th><th>Lavorazione</th><th>Coltura</th><th>Mezzo</th></tr></thead>
      <tbody>${ultimeLav.map(l=>`<tr class="row-link" data-goto-campo="${l.campoId}"><td class="mono">${fmtDate(l.data)}</td><td>${l.campo}</td><td>${l.tipo}</td><td>${l.coltura||''}</td><td>${mezzoNome(l.mezzoId)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">Nessuna lavorazione registrata.</td></tr>'}</tbody></table>
    </div>
    <div class="field-block" style="margin-bottom:0;">
      <h4>Prossime scadenze</h4>
      <table class="data"><thead><tr><th>Data</th><th>Descrizione</th><th>Origine</th><th>Stato</th></tr></thead>
      <tbody>${scadenze.slice(0,6).map(s=>`<tr${s.mezzoId?` class="row-link" data-goto-mezzo="${s.mezzoId}"`:''}><td class="mono">${fmtDate(s.data)}</td><td>${s.desc}</td><td>${s.origine}</td><td>${stampFor(daysUntil(s.data))}</td></tr>`).join('') || '<tr><td colspan="4" class="empty-state">Nessuna scadenza registrata.</td></tr>'}</tbody></table>
    </div>
  </div>`;
}

/* ================= scadenze ================= */
function renderScadenze(){
  const list = combinedScadenze();
  return `
  <div class="detail">
    <div class="field-block" style="margin-bottom:0;">
      <h4>Tutte le scadenze</h4>
      <table class="data"><thead><tr><th>Data</th><th>Descrizione</th><th>Origine</th><th>Stato</th><th></th></tr></thead>
      <tbody>${list.map(s=>`<tr${s.mezzoId?` class="row-link" data-goto-mezzo="${s.mezzoId}"`:''}><td class="mono">${fmtDate(s.data)}</td><td>${s.desc}</td><td>${s.origine}</td><td>${stampFor(daysUntil(s.data))}</td><td>${s.manualId ? `<span style="cursor:pointer;color:var(--rust);font-weight:700;font-size:11.5px;" data-del-scadenza="${s.manualId}">rimuovi</span>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">Nessuna scadenza registrata.</td></tr>'}</tbody></table>
      <form class="inline-form" data-form="scadenza-manuale">
        <div class="field-wrap"><label>Titolo</label><input type="text" name="titolo" placeholder="es. Rinnovo contratto affitto" required></div>
        <div class="field-wrap"><label>Data</label><input type="date" name="data" required></div>
        <div class="field-wrap"><label>Note</label><input type="text" name="note" placeholder="facoltativo"></div>
        <button class="btn primary small" type="submit">Aggiungi scadenza</button>
      </form>
    </div>
  </div>`;
}

/* ================= impostazioni ================= */
function renderImpostazioni(){
  const sections = [
    {key:'tipiLavorazione', label:'Tipi di lavorazione'},
    {key:'colture', label:'Colture'},
    {key:'operatori', label:'Operatori'}
  ];
  return `
  <div class="detail">
    ${sections.map(sec=>`
      <div class="field-block">
        <h4>${sec.label}</h4>
        <div class="opt-list">
          ${state.opzioni[sec.key].map(v=>`<div class="opt-row"><span>${v}</span><span class="del" data-del-opt="${sec.key}" data-val="${v}">rimuovi</span></div>`).join('') || '<div class="empty-state">Nessuna voce.</div>'}
        </div>
        <form class="inline-form" data-form="add-opt" data-key="${sec.key}">
          <input type="text" name="valore" placeholder="Nuova voce" required>
          <button class="btn primary small" type="submit">Aggiungi</button>
        </form>
      </div>`).join('')}
  </div>`;
}

/* ================= campi ================= */
function renderCampi(){
  return `
  <div class="page-head"><h3>Elenco campi</h3><button class="btn small primary" data-action="new-campo">+ Nuovo</button></div>
  <div class="item-grid">
    ${state.campi.map(c=>`<div class="item-card" data-open-campo="${c.id}">
      <div class="title">${c.nome}</div>
      <div class="sub">${c.coltura||''}</div>
      <div class="num">${c.superficieHa} ha</div>
    </div>`).join('') || '<div class="empty-state">Nessun campo. Aggiungine uno.</div>'}
  </div>`;
}

function selectOptionsHTML(list, selected){
  return list.map(v=>`<option value="${v}" ${v===selected?'selected':''}>${v}</option>`).join('');
}
function mezzoOptionsHTML(selected){
  return state.mezzi.map(m=>`<option value="${m.id}" ${m.id===selected?'selected':''}>${m.nome}</option>`).join('') + `<option value="__add__">+ Aggiungi nuovo mezzo&hellip;</option>`;
}
function attrOptionsHTML(selected){
  return state.attrezzature.map(a=>`<option value="${a.id}" ${a.id===selected?'selected':''}>${a.nome}</option>`).join('') + `<option value="__add__">+ Aggiungi nuova attrezzatura&hellip;</option>`;
}

function campoDetail(c){
  const hasBoundary = c.boundary && c.boundary.length>=3;
  const lavorazioniCampo = state.lavorazioni.filter(l=>l.campoId===c.id);
  return `
  <div class="detail">
    <h2>${c.nome}</h2>
    <div class="subhead">${c.coltura||''} &middot; ${c.superficieHa} ha (${(c.superficieHa*2.63).toFixed(1)} moggia piem., fattore indicativo)</div>

    <div class="field-block">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line-soft); padding-bottom:8px; margin-bottom:10px;">
        <h4 style="border-bottom:none; padding-bottom:0; margin-bottom:0;">Mappa del campo</h4>
        <button class="btn-icon" data-action="toggle-campo-settings" title="Impostazioni campo">&#9881;</button>
      </div>
      <div class="campo-settings ${campoSettingsOpen ? 'show' : ''}" id="campoSettingsPanel">
        <div class="field-wrap"><label>Coltura del campo</label>
          <select data-action="set-coltura" data-campo="${c.id}">${selectOptionsHTML(state.opzioni.colture, c.coltura)}</select>
        </div>
        <div>
          <label style="font-size:10.5px; color:var(--ink-soft); font-weight:700; display:block; margin-bottom:6px;">Confine del campo</label>
          <div class="map-toolbar">
            <label style="display:flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; cursor:pointer;">
              <input type="checkbox" id="editBoundaryToggle" ${editBoundaryMode ? 'checked' : ''}> Modifica confine (click sulla mappa)
            </label>
            <button class="btn small primary" data-action="gps-add" data-campo="${c.id}">📍 Rileva GPS e aggiungi vertice</button>
            <button class="btn small" data-action="gps-undo" data-campo="${c.id}">Annulla ultimo</button>
            <button class="btn small" data-action="gps-reset" data-campo="${c.id}">Azzera</button>
          </div>
          <form class="inline-form" data-form="manual-vertex" data-campo="${c.id}" style="margin-top:10px; padding-top:0; border-top:none;">
            <div class="field-wrap"><label>Latitudine</label><input type="number" step="0.00001" name="lat" placeholder="45.13610" required></div>
            <div class="field-wrap"><label>Longitudine</label><input type="number" step="0.00001" name="lng" placeholder="8.45010" required></div>
            <button class="btn small" type="submit">+ Aggiungi punto manuale</button>
          </form>
          <div class="map-status" id="gpsStatus" style="margin-top:8px;">${hasBoundary ? (areaFromBoundary(c.boundary)/10000).toFixed(2)+' ha rilevati' : 'nessun rilievo'}</div>
        </div>
      </div>
      <div class="map-wrap"><div id="mapCanvas" style="height:340px; border-radius:var(--radius-sm);"></div></div>
      <div class="map-note">Rilievo del perimetro reale via GPS del dispositivo, camminando i confini del campo (o inserimento manuale dalle impostazioni &#9881;).</div>
    </div>

    <div class="field-block"><h4>Proprietà</h4>
      <div class="kv"><div><span>Attuale</span>${c.proprietaAttuale.proprietario||''} &middot; ${c.proprietaAttuale.tipo||''}</div><div><span>Dal</span>${fmtDate(c.proprietaAttuale.dal)}</div></div>
    </div>

    <div class="field-block"><h4>Storico lavorazioni</h4>
      <table class="data"><thead><tr><th>Data</th><th>Tipo</th><th>Mezzo</th><th>Attrezzo</th><th>Operatore</th></tr></thead>
      <tbody>${lavorazioniCampo.slice().sort((a,b)=>new Date(b.data)-new Date(a.data)).map(l=>`<tr><td class="mono">${fmtDate(l.data)}</td><td>${l.tipo}</td><td>${mezzoNome(l.mezzoId)}</td><td>${attrNome(l.attrezzoId)}</td><td>${l.operatore||'&mdash;'}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">Nessuna lavorazione registrata.</td></tr>'}</tbody></table>

      <form class="inline-form" data-form="lavorazione" data-campo="${c.id}">
        <div class="field-wrap"><label>Data</label><input type="date" name="data" required value="${todayStr()}"></div>
        <div class="field-wrap"><label>Tipo lavorazione</label>
          <select name="tipo" data-opzioni="tipiLavorazione">${selectOptionsHTML(state.opzioni.tipiLavorazione, state.opzioni.tipiLavorazione[0])}</select>
        </div>
        <div class="field-wrap"><label>Mezzo</label>
          <div class="select-row"><select name="mezzoId" data-link="mezzo">${mezzoOptionsHTML(state.mezzi[0]?.id)}</select></div>
        </div>
        <div class="field-wrap"><label>Attrezzo</label>
          <div class="select-row"><select name="attrezzoId" data-link="attrezzo">${attrOptionsHTML(state.attrezzature[0]?.id)}</select></div>
        </div>
        <div class="field-wrap"><label>Operatore</label>
          <select name="operatore" data-opzioni="operatori">${selectOptionsHTML(state.opzioni.operatori, state.opzioni.operatori[0])}</select>
        </div>
        <button class="btn primary small" type="submit">Registra lavorazione</button>
      </form>
    </div>
  </div>`;
}

/* ---- geometria: area shoelace ---- */
function areaFromBoundary(boundary){
  if(!boundary || boundary.length<3) return 0;
  const lat0 = boundary.reduce((s,p)=>s+p[0],0)/boundary.length;
  const R = 6371000;
  const pts = boundary.map(([lat,lng]) => [ lng*Math.PI/180*R*Math.cos(lat0*Math.PI/180), lat*Math.PI/180*R ]);
  let a=0;
  for(let i=0;i<pts.length;i++){ const [x1,y1]=pts[i], [x2,y2]=pts[(i+1)%pts.length]; a += x1*y2-x2*y1; }
  return Math.abs(a/2);
}
function drawMap(campo){
  const container = document.getElementById('mapCanvas');
  if(!container) return;
  if(currentLeafletMap){ currentLeafletMap.remove(); currentLeafletMap = null; }
  const center = (campo.boundary && campo.boundary.length) ? campo.boundary[0] : [45.15, 8.45];
  const map = L.map(container).setView(center, 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  function redraw(){
    map.eachLayer(l=>{ if(l instanceof L.Polygon || l instanceof L.CircleMarker) map.removeLayer(l); });
    if(campo.boundary.length>=2){
      L.polygon(campo.boundary, {color:'#4B6B3F', fillColor:'#E7EEDD', fillOpacity:.5, weight:2.5}).addTo(map);
    }
    campo.boundary.forEach((p,i)=>{
      L.circleMarker(p, {radius:5, color:'#2E3F29', fillColor:'#2E3F29', fillOpacity:1})
        .bindTooltip(String(i+1)).addTo(map);
    });
    if(campo.boundary.length>=2){
      map.fitBounds(L.polygon(campo.boundary).getBounds(), {padding:[24,24]});
    } else if(campo.boundary.length===1){
      map.setView(campo.boundary[0], 17);
    }
  }
  redraw();

  map.on('click', (e)=>{
    if(!editBoundaryMode) return;
    campo.boundary.push([e.latlng.lat, e.latlng.lng]);
    persist(sb.from('campi').update({boundary: campo.boundary}).eq('id', campo.id));
    render();
  });

  currentLeafletMap = map;
  setTimeout(()=>{ map.invalidateSize(); }, 100);
}

/* ================= mezzi ================= */
function renderMezzi(){
  return `
  <div class="page-head"><h3>Elenco mezzi</h3><button class="btn small primary" data-action="new-mezzo">+ Nuovo</button></div>
  <div class="item-grid">
    ${state.mezzi.map(v=>{
      const nextDeadline = Math.min(...Object.values(v.scadenze).filter(Boolean).map(d=>daysUntil(d)));
      return `<div class="item-card" data-open-mezzo="${v.id}">
        <div class="title">${v.nome}</div>
        <div class="sub">${v.targa||''}</div>
        ${stampFor(isFinite(nextDeadline)?nextDeadline:null)}
      </div>`;
    }).join('') || '<div class="empty-state">Nessun mezzo. Aggiungine uno.</div>'}
  </div>`;
}
function mezzoDetail(v){
  const manutenzioniMezzo = state.manutenzioni.filter(m=>m.targetType==='mezzo' && m.targetId===v.id);
  return `
  ${v.foto ? `<img src="${v.foto}" style="width:100%; max-height:230px; object-fit:cover; display:block;">` : ''}
  <div class="detail">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h2>${v.nome}</h2>
      <button class="btn-icon" data-action="toggle-mezzo-settings" title="Impostazioni mezzo">&#9881;</button>
    </div>
    <div class="subhead">Targa ${v.targa||''} &middot; immatricolato ${v.anno||''}</div>

    <div class="campo-settings ${mezzoSettingsOpen ? 'show' : ''}" id="mezzoSettingsPanel">
      <div class="field-wrap"><label>Foto mezzo</label>
        <input type="file" accept="image/*" data-action="mezzo-foto" data-mezzo="${v.id}">
        ${v.foto ? `<span style="cursor:pointer; color:var(--rust); font-size:11px; font-weight:700; margin-top:6px; display:inline-block;" data-action="mezzo-foto-remove" data-mezzo="${v.id}">rimuovi foto</span>` : ''}
      </div>
      <div class="field-block" style="margin-bottom:0;">
        <h4>Documenti allegati</h4>
        <div class="opt-list">
          ${state.documenti.filter(d=>d.targetType==='mezzo' && d.targetId===v.id).map(d=>`<div class="opt-row"><a href="${d.url}" target="_blank">${d.nome}</a><span class="del" data-del-doc="${d.id}">rimuovi</span></div>`).join('') || '<div class="empty-state">Nessun documento.</div>'}
        </div>
        <input type="file" data-action="mezzo-doc" data-mezzo="${v.id}">
      </div>
      <form data-form="mezzo-settings" data-mezzo="${v.id}" style="display:flex; flex-direction:column; gap:10px;">
        <div class="field-wrap"><label>Nome / modello</label><input type="text" name="nome" value="${v.nome}" required></div>
        <div class="field-wrap"><label>Targa</label><input type="text" name="targa" value="${v.targa||''}"></div>
        <div class="field-wrap"><label>Anno</label><input type="number" name="anno" value="${v.anno||''}"></div>
        <div class="field-wrap"><label>Scadenza assicurazione</label><input type="date" name="assicurazione" value="${v.scadenze.assicurazione||''}"></div>
        <div class="field-wrap"><label>Scadenza revisione</label><input type="date" name="revisione" value="${v.scadenze.revisione||''}"></div>
        <div class="field-wrap"><label>Scadenza bollo</label><input type="date" name="bollo" value="${v.scadenze.bollo||''}"></div>
        <button class="btn primary small" type="submit" style="align-self:flex-start;">Salva modifiche</button>
      </form>
    </div>

    <div class="field-block"><h4>Scadenze</h4>
      <div class="kv">
        <div><span>Assicurazione</span>${fmtDate(v.scadenze.assicurazione)}${dotFor(daysUntil(v.scadenze.assicurazione))}</div>
        <div><span>Revisione</span>${fmtDate(v.scadenze.revisione)}${dotFor(daysUntil(v.scadenze.revisione))}</div>
        <div><span>Bollo</span>${fmtDate(v.scadenze.bollo)}${dotFor(daysUntil(v.scadenze.bollo))}</div>
      </div>
    </div>
    <div class="field-block"><h4>Storico manutenzioni</h4>
      <table class="data"><thead><tr><th>Data</th><th>Intervento</th><th>Ore/Km</th><th>Operatore</th></tr></thead>
      <tbody>${manutenzioniMezzo.slice().sort((a,b)=>new Date(b.data)-new Date(a.data)).map(mn=>`<tr><td class="mono">${fmtDate(mn.data)}</td><td>${mn.tipo}</td><td>${mn.ore||''}</td><td>${mn.operatore||'&mdash;'}</td></tr>`).join('') || '<tr><td colspan="4" class="empty-state">Nessuna manutenzione registrata.</td></tr>'}</tbody></table>
      <form class="inline-form" data-form="manutenzione-mezzo" data-mezzo="${v.id}">
        <input type="date" name="data" required value="${todayStr()}">
        <input type="text" name="tipo" placeholder="Intervento" required>
        <input type="text" name="ore" placeholder="Ore / km">
        <div class="field-wrap"><label>Operatore</label>
          <select name="operatore" data-opzioni="operatori">${selectOptionsHTML(state.opzioni.operatori, state.opzioni.operatori[0])}</select>
        </div>
        <button class="btn primary small" type="submit">Registra intervento</button>
      </form>
    </div>
  </div>`;
}

/* ================= attrezzature ================= */
function renderAttrezzature(){
  return `
  <div class="page-head"><h3>Elenco attrezzature</h3><button class="btn small primary" data-action="new-attr">+ Nuovo</button></div>
  <div class="item-grid">
    ${state.attrezzature.map(x=>`<div class="item-card" data-open-attr="${x.id}">
      <div class="title">${x.nome}</div>
      <div class="sub">${x.tipo||''}</div>
    </div>`).join('') || '<div class="empty-state">Nessuna attrezzatura. Aggiungine una.</div>'}
  </div>`;
}
function attrDetail(a){
  const manutenzioniAttr = state.manutenzioni.filter(m=>m.targetType==='attrezzatura' && m.targetId===a.id);
  const utilizziAttr = state.lavorazioni.filter(l=>l.attrezzoId===a.id);
  return `
  ${a.foto ? `<img src="${a.foto}" style="width:100%; max-height:230px; object-fit:cover; display:block;">` : ''}
  <div class="detail">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h2>${a.nome}</h2>
      <button class="btn-icon" data-action="toggle-attr-settings" title="Impostazioni attrezzatura">&#9881;</button>
    </div>
    <div class="subhead">${a.tipo||''}</div>

    <div class="campo-settings ${attrSettingsOpen ? 'show' : ''}" id="attrSettingsPanel">
      <div class="field-wrap"><label>Foto attrezzatura</label>
        <input type="file" accept="image/*" data-action="attr-foto" data-attr="${a.id}">
        ${a.foto ? `<span style="cursor:pointer; color:var(--rust); font-size:11px; font-weight:700; margin-top:6px; display:inline-block;" data-action="attr-foto-remove" data-attr="${a.id}">rimuovi foto</span>` : ''}
      </div>
      <div class="field-block" style="margin-bottom:0;">
        <h4>Documenti allegati</h4>
        <div class="opt-list">
          ${state.documenti.filter(d=>d.targetType==='attrezzatura' && d.targetId===a.id).map(d=>`<div class="opt-row"><a href="${d.url}" target="_blank">${d.nome}</a><span class="del" data-del-doc="${d.id}">rimuovi</span></div>`).join('') || '<div class="empty-state">Nessun documento.</div>'}
        </div>
        <input type="file" data-action="attr-doc" data-attr="${a.id}">
      </div>
      <form data-form="attr-settings" data-attr="${a.id}" style="display:flex; flex-direction:column; gap:10px;">
        <div class="field-wrap"><label>Nome</label><input type="text" name="nome" value="${a.nome}" required></div>
        <div class="field-wrap"><label>Tipo</label><input type="text" name="tipo" value="${a.tipo||''}"></div>
        <div class="field-wrap"><label>Caratteristiche</label><input type="text" name="caratteristiche" value="${a.caratteristiche||''}"></div>
        <div class="field-wrap"><label>Mezzo compatibile</label><input type="text" name="mezzoCompatibile" value="${a.mezzoCompatibile||''}"></div>
        <button class="btn primary small" type="submit" style="align-self:flex-start;">Salva modifiche</button>
      </form>
    </div>

    <div class="field-block"><h4>Caratteristiche</h4>
      <div class="kv"><div><span>Note tecniche</span>${a.caratteristiche||'&mdash;'}</div><div><span>Mezzo compatibile</span>${a.mezzoCompatibile||'&mdash;'}</div></div>
    </div>
    <div class="field-block"><h4>Storico utilizzo</h4>
      <table class="data"><thead><tr><th>Data</th><th>Campo</th><th>Note</th></tr></thead>
      <tbody>${utilizziAttr.slice().sort((x,y)=>new Date(y.data)-new Date(x.data)).map(u=>`<tr><td class="mono">${fmtDate(u.data)}</td><td>${campoNome(u.campoId)}</td><td>${u.note||''}</td></tr>`).join('') || '<tr><td colspan="3" class="empty-state">Nessun utilizzo registrato.</td></tr>'}</tbody></table>
    </div>
    <div class="field-block"><h4>Storico manutenzioni</h4>
      <table class="data"><thead><tr><th>Data</th><th>Intervento</th><th>Operatore</th></tr></thead>
      <tbody>${manutenzioniAttr.slice().sort((x,y)=>new Date(y.data)-new Date(x.data)).map(mn=>`<tr><td class="mono">${fmtDate(mn.data)}</td><td>${mn.tipo}</td><td>${mn.operatore||'&mdash;'}</td></tr>`).join('') || '<tr><td colspan="3" class="empty-state">Nessuna manutenzione registrata.</td></tr>'}</tbody></table>
      <form class="inline-form" data-form="manutenzione-attr" data-attr="${a.id}">
        <input type="date" name="data" required value="${todayStr()}">
        <input type="text" name="tipo" placeholder="Intervento" required>
        <div class="field-wrap"><label>Operatore</label>
          <select name="operatore" data-opzioni="operatori">${selectOptionsHTML(state.opzioni.operatori, state.opzioni.operatori[0])}</select>
        </div>
        <button class="btn primary small" type="submit">Registra intervento</button>
      </form>
    </div>
  </div>`;
}

/* ================= modali "nuovo" ================= */
function openModal(html){
  const back = document.createElement('div'); back.className = 'modal-back';
  back.innerHTML = `<div class="modal">${html}</div>`;
  back.addEventListener('click', e=>{ if(e.target===back) back.remove(); });
  document.body.appendChild(back);
  return back;
}
function newCampoModal(onCreated){
  const back = openModal(`
    <h3>Nuovo campo</h3>
    <form class="modal-form" id="formNewCampo">
      <div><label>Nome campo</label><input name="nome" required></div>
      <div><label>Coltura attuale</label><select name="coltura">${state.opzioni.colture.map(c=>`<option>${c}</option>`).join('')}</select></div>
      <div><label>Superficie (ha)</label><input name="superficieHa" type="number" step="0.1" required></div>
      <div><label>Proprietario / affittuario</label><input name="proprietario"></div>
      <div class="modal-actions"><button type="button" class="btn" data-close>Annulla</button><button type="submit" class="btn primary">Crea campo</button></div>
    </form>`);
  back.querySelector('[data-close]').onclick = ()=>back.remove();
  back.querySelector('#formNewCampo').onsubmit = (e)=>{
    e.preventDefault();
    const f = new FormData(e.target);
    const superficieHa = parseFloat(f.get('superficieHa'))||0;
    const proprietario = f.get('proprietario')||'&mdash;';
    const c = {id:uid(), nome:f.get('nome'), coltura:f.get('coltura'), superficieHa,
      proprietaAttuale:{proprietario, tipo:'Proprietà', dal:todayStr()}, boundary:[]};
    state.campi.push(c);
    persist(sb.from('campi').insert({id:c.id, nome:c.nome, coltura:c.coltura, superficie_ha:superficieHa, proprietario, tipo_possesso:'Proprietà', dal:todayStr(), boundary:[]}));
    back.remove();
    if(onCreated) onCreated(c); else render();
  };
}
function newMezzoModal(onCreated){
  const back = openModal(`
    <h3>Nuovo mezzo</h3>
    <form class="modal-form" id="formNewMezzo">
      <div><label>Nome / modello</label><input name="nome" required></div>
      <div><label>Targa</label><input name="targa"></div>
      <div><label>Anno immatricolazione</label><input name="anno" type="number"></div>
      <div><label>Scadenza assicurazione</label><input name="assicurazione" type="date"></div>
      <div><label>Scadenza revisione</label><input name="revisione" type="date"></div>
      <div><label>Scadenza bollo</label><input name="bollo" type="date"></div>
      <div class="modal-actions"><button type="button" class="btn" data-close>Annulla</button><button type="submit" class="btn primary">Crea mezzo</button></div>
    </form>`);
  back.querySelector('[data-close]').onclick = ()=>back.remove();
  back.querySelector('#formNewMezzo').onsubmit = (e)=>{
    e.preventDefault();
    const f = new FormData(e.target);
    const v = {id:uid(), nome:f.get('nome'), targa:f.get('targa')||'', anno:f.get('anno')||'',
      scadenze:{assicurazione:f.get('assicurazione'), revisione:f.get('revisione'), bollo:f.get('bollo')}, foto:null};
    state.mezzi.push(v);
    persist(sb.from('mezzi').insert({id:v.id, nome:v.nome, targa:v.targa, anno:v.anno||null, assicurazione:v.scadenze.assicurazione||null, revisione:v.scadenze.revisione||null, bollo:v.scadenze.bollo||null}));
    back.remove();
    if(onCreated) onCreated(v); else render();
  };
}
function newAttrModal(onCreated){
  const back = openModal(`
    <h3>Nuova attrezzatura</h3>
    <form class="modal-form" id="formNewAttr">
      <div><label>Nome</label><input name="nome" required></div>
      <div><label>Tipo</label><input name="tipo" placeholder="es. semina, raccolta..."></div>
      <div><label>Caratteristiche</label><input name="caratteristiche"></div>
      <div><label>Mezzo compatibile</label><input name="mezzoCompatibile"></div>
      <div class="modal-actions"><button type="button" class="btn" data-close>Annulla</button><button type="submit" class="btn primary">Crea attrezzatura</button></div>
    </form>`);
  back.querySelector('[data-close]').onclick = ()=>back.remove();
  back.querySelector('#formNewAttr').onsubmit = (e)=>{
    e.preventDefault();
    const f = new FormData(e.target);
    const a = {id:uid(), nome:f.get('nome'), tipo:f.get('tipo')||'&mdash;', caratteristiche:f.get('caratteristiche')||'', mezzoCompatibile:f.get('mezzoCompatibile')||'', foto:null};
    state.attrezzature.push(a);
    persist(sb.from('attrezzature').insert({id:a.id, nome:a.nome, tipo:a.tipo, caratteristiche:a.caratteristiche, mezzo_compatibile:a.mezzoCompatibile}));
    back.remove();
    if(onCreated) onCreated(a); else render();
  };
}

/* ================= handlers ================= */
function attachHandlers(){
  document.querySelectorAll('[data-open-campo]').forEach(el=>el.onclick=()=>openDetail('campo', el.dataset.openCampo));
  document.querySelectorAll('[data-open-mezzo]').forEach(el=>el.onclick=()=>openDetail('mezzo', el.dataset.openMezzo));
  document.querySelectorAll('[data-open-attr]').forEach(el=>el.onclick=()=>openDetail('attr', el.dataset.openAttr));

  const newCampoBtn = document.querySelector('[data-action="new-campo"]'); if(newCampoBtn) newCampoBtn.onclick = ()=>newCampoModal();
  const newMezzoBtn = document.querySelector('[data-action="new-mezzo"]'); if(newMezzoBtn) newMezzoBtn.onclick = ()=>newMezzoModal();
  const newAttrBtn = document.querySelector('[data-action="new-attr"]'); if(newAttrBtn) newAttrBtn.onclick = ()=>newAttrModal();

  const mapCanvas = document.getElementById('mapCanvas');
  if(mapCanvas && currentDetail && currentDetail.type==='campo'){ const campo = state.campi.find(c=>c.id===currentDetail.id); if(campo) drawMap(campo); }

  const editToggle = document.getElementById('editBoundaryToggle');
  if(editToggle) editToggle.onchange = ()=>{ editBoundaryMode = editToggle.checked; };

  const gpsStatus = document.getElementById('gpsStatus');
  const gpsAdd = document.querySelector('[data-action="gps-add"]');
  if(gpsAdd) gpsAdd.onclick = ()=>{
    const campo = state.campi.find(c=>c.id===gpsAdd.dataset.campo);
    if(!navigator.geolocation){ gpsStatus.textContent = 'geolocalizzazione non disponibile su questo dispositivo'; return; }
    gpsStatus.textContent = 'rilevamento in corso…';
    navigator.geolocation.getCurrentPosition(
      pos=>{ campo.boundary.push([pos.coords.latitude, pos.coords.longitude]); render(); persist(sb.from('campi').update({boundary:campo.boundary}).eq('id', campo.id)); },
      err=>{ gpsStatus.textContent = 'posizione non disponibile (' + err.message + ')'; },
      {enableHighAccuracy:true, timeout:8000}
    );
  };
  const gpsUndo = document.querySelector('[data-action="gps-undo"]');
  if(gpsUndo) gpsUndo.onclick = ()=>{ const campo = state.campi.find(c=>c.id===gpsUndo.dataset.campo); campo.boundary.pop(); render(); persist(sb.from('campi').update({boundary:campo.boundary}).eq('id', campo.id)); };
  const gpsReset = document.querySelector('[data-action="gps-reset"]');
  if(gpsReset) gpsReset.onclick = ()=>{ const campo = state.campi.find(c=>c.id===gpsReset.dataset.campo); campo.boundary = []; render(); persist(sb.from('campi').update({boundary:[]}).eq('id', campo.id)); };

  const toggleSettings = document.querySelector('[data-action="toggle-campo-settings"]');
  if(toggleSettings) toggleSettings.onclick = ()=>{ campoSettingsOpen = !campoSettingsOpen; buildDetailModal(); };
  const colturaSel = document.querySelector('[data-action="set-coltura"]');
  if(colturaSel) colturaSel.onchange = ()=>{
    const campo = state.campi.find(c=>c.id===colturaSel.dataset.campo);
    campo.coltura = colturaSel.value; render();
    persist(sb.from('campi').update({coltura:campo.coltura}).eq('id', campo.id));
  };
  const manualVertexForm = document.querySelector('[data-form="manual-vertex"]');
  if(manualVertexForm) manualVertexForm.onsubmit = (e)=>{
    e.preventDefault();
    const f = new FormData(e.target);
    const campo = state.campi.find(c=>c.id===e.target.dataset.campo);
    const lat = parseFloat(f.get('lat')), lng = parseFloat(f.get('lng'));
    if(!isNaN(lat) && !isNaN(lng)){ campo.boundary.push([lat, lng]); render(); persist(sb.from('campi').update({boundary:campo.boundary}).eq('id', campo.id)); }
  };

  document.querySelectorAll('select[data-link="mezzo"]').forEach(sel=>{
    sel.onchange = ()=>{ if(sel.value==='__add__'){ newMezzoModal(()=>render()); } };
  });
  document.querySelectorAll('select[data-link="attrezzo"]').forEach(sel=>{
    sel.onchange = ()=>{ if(sel.value==='__add__'){ newAttrModal(()=>render()); } };
  });

  const lavForm = document.querySelector('[data-form="lavorazione"]');
  if(lavForm) lavForm.onsubmit = (e)=>{
    e.preventDefault();
    const f = new FormData(e.target);
    const campo = state.campi.find(c=>c.id===e.target.dataset.campo);
    const mezzoId = f.get('mezzoId'), attrezzoId = f.get('attrezzoId');
    if(mezzoId==='__add__' || attrezzoId==='__add__') return;
    const lav = {id:uid(), campoId:campo.id, data:f.get('data'), tipo:f.get('tipo'), mezzoId, attrezzoId, operatore:f.get('operatore')||'', note:''};
    state.lavorazioni.push(lav);
    render();
    persist(sb.from('lavorazioni').insert({id:lav.id, campo_id:lav.campoId, data:lav.data, tipo:lav.tipo, mezzo_id:lav.mezzoId, attrezzo_id:lav.attrezzoId, operatore:lav.operatore, note:''}));
  };
  const mnMezzoForm = document.querySelector('[data-form="manutenzione-mezzo"]');
  if(mnMezzoForm) mnMezzoForm.onsubmit = (e)=>{
    e.preventDefault(); const f = new FormData(e.target);
    const v = state.mezzi.find(x=>x.id===e.target.dataset.mezzo);
    const man = {id:uid(), targetType:'mezzo', targetId:v.id, data:f.get('data'), tipo:f.get('tipo'), ore:f.get('ore'), operatore:f.get('operatore')||''};
    state.manutenzioni.push(man);
    render();
    persist(sb.from('manutenzioni').insert({id:man.id, target_type:'mezzo', target_id:v.id, data:man.data, tipo:man.tipo, ore:man.ore, operatore:man.operatore}));
  };
  const mnAttrForm = document.querySelector('[data-form="manutenzione-attr"]');
  if(mnAttrForm) mnAttrForm.onsubmit = (e)=>{
    e.preventDefault(); const f = new FormData(e.target);
    const a = state.attrezzature.find(x=>x.id===e.target.dataset.attr);
    const man = {id:uid(), targetType:'attrezzatura', targetId:a.id, data:f.get('data'), tipo:f.get('tipo'), operatore:f.get('operatore')||''};
    state.manutenzioni.push(man);
    render();
    persist(sb.from('manutenzioni').insert({id:man.id, target_type:'attrezzatura', target_id:a.id, data:man.data, tipo:man.tipo, operatore:man.operatore}));
  };

  const toggleMezzoSettings = document.querySelector('[data-action="toggle-mezzo-settings"]');
  if(toggleMezzoSettings) toggleMezzoSettings.onclick = ()=>{ mezzoSettingsOpen = !mezzoSettingsOpen; buildDetailModal(); };
  const mezzoFotoInput = document.querySelector('[data-action="mezzo-foto"]');
  if(mezzoFotoInput) mezzoFotoInput.onchange = async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const v = state.mezzi.find(x=>x.id===mezzoFotoInput.dataset.mezzo);
    const path = `${v.id}-${Date.now()}-${file.name}`;
    const { error: upErr } = await sb.storage.from('foto-mezzi').upload(path, file, {upsert:true});
    if(upErr){ console.error(upErr); return; }
    const { data: pub } = sb.storage.from('foto-mezzi').getPublicUrl(path);
    v.foto = pub.publicUrl;
    persist(sb.from('mezzi').update({foto_url:v.foto}).eq('id', v.id));
    render();
  };
  const mezzoFotoRemove = document.querySelector('[data-action="mezzo-foto-remove"]');
  if(mezzoFotoRemove) mezzoFotoRemove.onclick = ()=>{
    const v = state.mezzi.find(x=>x.id===mezzoFotoRemove.dataset.mezzo);
    v.foto = null; render();
    persist(sb.from('mezzi').update({foto_url:null}).eq('id', v.id));
  };
  const mezzoDocInput = document.querySelector('[data-action="mezzo-doc"]');
  if(mezzoDocInput) mezzoDocInput.onchange = async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const v = state.mezzi.find(x=>x.id===mezzoDocInput.dataset.mezzo);
    const path = `${v.id}-${Date.now()}-${file.name}`;
    const { error: upErr } = await sb.storage.from('documenti-mezzi').upload(path, file, {upsert:true});
    if(upErr){ console.error(upErr); return; }
    const { data: pub } = sb.storage.from('documenti-mezzi').getPublicUrl(path);
    const doc = {id:uid(), targetType:'mezzo', targetId:v.id, nome:file.name, url:pub.publicUrl, data:todayStr()};
    state.documenti.push(doc);
    persist(sb.from('documenti').insert({id:doc.id, target_type:doc.targetType, target_id:doc.targetId, nome:doc.nome, url:doc.url, data:doc.data}));
    render();
  };
  const mezzoSettingsForm = document.querySelector('[data-form="mezzo-settings"]');
  if(mezzoSettingsForm) mezzoSettingsForm.onsubmit = (e)=>{
    e.preventDefault();
    const f = new FormData(e.target);
    const v = state.mezzi.find(x=>x.id===e.target.dataset.mezzo);
    v.nome = f.get('nome'); v.targa = f.get('targa'); v.anno = f.get('anno');
    v.scadenze = {assicurazione:f.get('assicurazione'), revisione:f.get('revisione'), bollo:f.get('bollo')};
    render();
    persist(sb.from('mezzi').update({nome:v.nome, targa:v.targa, anno:v.anno||null, assicurazione:v.scadenze.assicurazione||null, revisione:v.scadenze.revisione||null, bollo:v.scadenze.bollo||null}).eq('id', v.id));
  };

  const toggleAttrSettings = document.querySelector('[data-action="toggle-attr-settings"]');
  if(toggleAttrSettings) toggleAttrSettings.onclick = ()=>{ attrSettingsOpen = !attrSettingsOpen; buildDetailModal(); };
  const attrFotoInput = document.querySelector('[data-action="attr-foto"]');
  if(attrFotoInput) attrFotoInput.onchange = async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const a = state.attrezzature.find(x=>x.id===attrFotoInput.dataset.attr);
    const path = `${a.id}-${Date.now()}-${file.name}`;
    const { error: upErr } = await sb.storage.from('foto-attrezzature').upload(path, file, {upsert:true});
    if(upErr){ console.error(upErr); return; }
    const { data: pub } = sb.storage.from('foto-attrezzature').getPublicUrl(path);
    a.foto = pub.publicUrl;
    persist(sb.from('attrezzature').update({foto_url:a.foto}).eq('id', a.id));
    render();
  };
  const attrFotoRemove = document.querySelector('[data-action="attr-foto-remove"]');
  if(attrFotoRemove) attrFotoRemove.onclick = ()=>{
    const a = state.attrezzature.find(x=>x.id===attrFotoRemove.dataset.attr);
    a.foto = null; render();
    persist(sb.from('attrezzature').update({foto_url:null}).eq('id', a.id));
  };
  const attrSettingsForm = document.querySelector('[data-form="attr-settings"]');
  if(attrSettingsForm) attrSettingsForm.onsubmit = (e)=>{
    e.preventDefault();
    const f = new FormData(e.target);
    const a = state.attrezzature.find(x=>x.id===e.target.dataset.attr);
    a.nome = f.get('nome'); a.tipo = f.get('tipo'); a.caratteristiche = f.get('caratteristiche'); a.mezzoCompatibile = f.get('mezzoCompatibile');
    render();
    persist(sb.from('attrezzature').update({nome:a.nome, tipo:a.tipo, caratteristiche:a.caratteristiche, mezzo_compatibile:a.mezzoCompatibile}).eq('id', a.id));
  };
  const attrDocInput = document.querySelector('[data-action="attr-doc"]');
  if(attrDocInput) attrDocInput.onchange = async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const a = state.attrezzature.find(x=>x.id===attrDocInput.dataset.attr);
    const path = `${a.id}-${Date.now()}-${file.name}`;
    const { error: upErr } = await sb.storage.from('documenti-attrezzature').upload(path, file, {upsert:true});
    if(upErr){ console.error(upErr); return; }
    const { data: pub } = sb.storage.from('documenti-attrezzature').getPublicUrl(path);
    const doc = {id:uid(), targetType:'attrezzatura', targetId:a.id, nome:file.name, url:pub.publicUrl, data:todayStr()};
    state.documenti.push(doc);
    persist(sb.from('documenti').insert({id:doc.id, target_type:doc.targetType, target_id:doc.targetId, nome:doc.nome, url:doc.url, data:doc.data}));
    render();
  };
  document.querySelectorAll('[data-del-doc]').forEach(el=>el.onclick=()=>{
    const id = el.dataset.delDoc;
    state.documenti = state.documenti.filter(d=>d.id!==id);
    render();
    persist(sb.from('documenti').delete().eq('id', id));
  });

  const scadForm = document.querySelector('[data-form="scadenza-manuale"]');
  if(scadForm) scadForm.onsubmit = (e)=>{
    e.preventDefault(); const f = new FormData(e.target);
    const s = {id:uid(), titolo:f.get('titolo'), data:f.get('data'), note:f.get('note')||''};
    state.scadenzeManuali.push(s); render();
    persist(sb.from('scadenze_manuali').insert({id:s.id, titolo:s.titolo, data:s.data, note:s.note}));
  };
  document.querySelectorAll('[data-del-scadenza]').forEach(el=>el.onclick=()=>{
    const id = el.dataset.delScadenza;
    state.scadenzeManuali = state.scadenzeManuali.filter(s=>s.id!==id);
    render();
    persist(sb.from('scadenze_manuali').delete().eq('id', id));
  });

  document.querySelectorAll('[data-goto-campo]').forEach(el=>el.onclick=()=>navigateTo('campi', el.dataset.gotoCampo, 'campo'));
  document.querySelectorAll('[data-goto-mezzo]').forEach(el=>el.onclick=()=>navigateTo('mezzi', el.dataset.gotoMezzo, 'mezzo'));

  document.querySelectorAll('[data-form="add-opt"]').forEach(form=>{
    form.onsubmit = (e)=>{
      e.preventDefault();
      const f = new FormData(e.target);
      const key = e.target.dataset.key;
      const val = f.get('valore').trim();
      if(val && !state.opzioni[key].includes(val)){
        state.opzioni[key].push(val);
        render();
        persist(sb.from('opzioni').upsert({key, valori: state.opzioni[key]}));
      }
    };
  });
  document.querySelectorAll('[data-del-opt]').forEach(el=>el.onclick=()=>{
    const key = el.dataset.delOpt, val = el.dataset.val;
    state.opzioni[key] = state.opzioni[key].filter(v=>v!==val);
    render();
    persist(sb.from('opzioni').upsert({key, valori: state.opzioni[key]}));
  });
}

/* ================= avvio / login ================= */
async function showSplashThenRender(loadFn){
  const splash = document.getElementById('splash');
  const logo = splash.querySelector('.splash-logo');

  // mostra lo splash SUBITO, senza transizione (niente flash della pagina sotto)
  splash.style.transition = 'none';
  splash.classList.remove('hide');
  void splash.offsetWidth;
  splash.style.transition = '';

  logo.classList.remove('grow');
  requestAnimationFrame(()=>{ logo.classList.add('grow'); });

  const minWait = new Promise(res=>setTimeout(res, 3000));
  await Promise.all([ loadFn(), minWait ]);

  render();
  splash.classList.add('hide'); // qui la dissolvenza in uscita resta (definita in CSS su .splash)
}

document.getElementById('loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const f = new FormData(e.target);
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  const { error } = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
  if(error){ errEl.textContent = 'Credenziali non valide.'; errEl.style.display = 'block'; return; }
  document.getElementById('loginScreen').classList.add('hidden');
  await showSplashThenRender(loadAll);
});
document.getElementById('logoutLink').addEventListener('click', async ()=>{
  await sb.auth.signOut();
  location.reload();
});

(async function init(){
  const { data:{session} } = await sb.auth.getSession();
  if(session){
    await showSplashThenRender(loadAll);
  } else {
    document.getElementById('splash').classList.add('hide');
    document.getElementById('loginScreen').classList.remove('hidden');
  }
})();
