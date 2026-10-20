const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const label=n=>{n=String(n||'').replace(/^\s*\d+\s*-\s*/,'').trim();return n?n[0].toUpperCase()+n.slice(1):'(sin nombre)'};
const color=(s,v)=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return `hsl(${h%360},70%,${v==2?56:40}%)`};
const fm=m=>m>=1000?(m/1000).toFixed(m>=10000?0:1)+' km':Math.round(m)+' m';
const tag=x=>x.label+(x.s!=null?' · S'+x.s:'');
const NONE=['==',['get','key'],'¤'],inList=(p,a)=>a.length?['match',['get',p],a,true,false]:NONE;
let shown=new Set(),nearOn=new Set(),watch=null,wlk=null;
const EMPTY={type:'FeatureCollection',features:[]};
const spatialIndex=new RBush();
let parts=[],groups=new Map(),mode='L',P=null,A=null,B=null,ME=null,trips=[],target='A',pois=[],cats=[],highlighted=[],planToken=0,categoriesLoading=null;
const map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/liberty',center:[-63.18,-17.78],zoom:11.5});
map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');

map.on('load',()=>{
  map.addSource('lines',{type:'geojson',data:EMPTY});map.addSource('seg',{type:'geojson',data:EMPTY});map.addSource('pts',{type:'geojson',data:EMPTY});
  const cn=document.createElement('canvas');cn.width=cn.height=24;const g=cn.getContext('2d');g.fillStyle='#fff';g.strokeStyle='#222';g.lineWidth=2;g.beginPath();g.moveTo(5,4);g.lineTo(20,12);g.lineTo(5,20);g.lineTo(9,12);g.closePath();g.fill();g.stroke();map.addImage('arr',g.getImageData(0,0,24,24));
  map.addLayer({id:'lines',type:'line',source:'lines',filter:NONE,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','color'],'line-width':3,'line-opacity':.75}});
  map.addLayer({id:'hlc',type:'line',source:'lines',filter:NONE,paint:{'line-color':'#fff','line-width':9}});
  map.addLayer({id:'hl',type:'line',source:'lines',filter:NONE,layout:{'line-cap':'round'},paint:{'line-color':['get','color'],'line-width':5}});
  map.addLayer({id:'seg',type:'line',source:'seg',filter:['!',['get','w']],layout:{'line-cap':'round'},paint:{'line-color':['get','c'],'line-width':7}});
  map.addLayer({id:'segw',type:'line',source:'seg',filter:['get','w'],paint:{'line-color':'#555','line-width':3.5,'line-dasharray':[1.2,1.6]}});
  const AR={'symbol-placement':'line','symbol-spacing':90,'icon-image':'arr','icon-size':.55,'icon-allow-overlap':true,'icon-ignore-placement':true};
  map.addLayer({id:'arrows',type:'symbol',source:'lines',filter:NONE,layout:AR});
  map.addSource('route-label-points',{type:'geojson',data:EMPTY});
  map.addLayer({id:'line-labels',type:'symbol',source:'route-label-points',layout:{'text-field':['get','label'],'text-size':12,'text-allow-overlap':false,'text-ignore-placement':true},paint:{'text-color':'#1d2a1a','text-halo-color':'#fff','text-halo-width':2}});
  map.addLayer({id:'segarr',type:'symbol',source:'seg',filter:['!',['get','w']],layout:AR});
  map.addSource('trip-label-points',{type:'geojson',data:EMPTY});
  map.addLayer({id:'seg-labels',type:'symbol',source:'trip-label-points',layout:{'text-field':['get','label'],'text-size':12,'text-allow-overlap':true},paint:{'text-color':'#1d2a1a','text-halo-color':'#fff','text-halo-width':2}});
  map.addSource('poi',{type:'geojson',data:EMPTY});
  map.addLayer({id:'poi',type:'circle',source:'poi',paint:{'circle-radius':6,'circle-color':'#7048e8','circle-stroke-color':'#fff','circle-stroke-width':2}});
  map.on('click','poi',e=>popup(pois[e.features[0].properties.i]));
  map.addLayer({id:'pts',type:'circle',source:'pts',paint:{'circle-radius':8,'circle-color':['get','c'],'circle-stroke-color':'#fff','circle-stroke-width':3}});
  map.addLayer({id:'pt-labels',type:'symbol',source:'pts',filter:['has','label'],layout:{'text-field':['get','label'],'text-size':12,'text-offset':[0,1.4],'text-anchor':'top','text-allow-overlap':true},paint:{'text-color':'#172117','text-halo-color':'#fff','text-halo-width':2}});
  const DATA='rutas_micro_scz.geojson';
  $('list').innerHTML='<p id="msg">Cargando rutas…</p>';
  fetch(DATA).then(r=>r.ok?r.json():Promise.reject(new Error('HTTP '+r.status))).then(ingest)
    .catch(e=>{console.error(e);$('list').innerHTML='<p id="msg">No se pudo cargar '+DATA+' ('+esc(e.message)+'). Debe estar junto al index.html y abrirse con un servidor (no con doble clic).</p>'});
});

function ingest(gj){
  parts=[];groups=new Map();let skip=0;
  (gj.features||[]).forEach(f=>{const g=f.geometry,p=f.properties||{};
    const arr=!g?[]:g.type==='MultiLineString'?g.coordinates:g.type==='LineString'?[g.coordinates]:[];let ok=0;
    arr.forEach(c=>{if(c&&c.length>1){const line=turf.lineString(c);parts.push({label:label(p.nombre),s:p.sentido,p,line,length:turf.length(line,{units:'kilometers'})});ok++}});
    if(!ok)skip++});
  parts.forEach(x=>{if(!groups.has(x.label))groups.set(x.label,[]);groups.get(x.label).push(x)});
  spatialIndex.clear();
  spatialIndex.load(parts.map(part=>{const [minX,minY,maxX,maxY]=turf.bbox(part.line);return {minX,minY,maxX,maxY,part}}));
  map.getSource('route-label-points').setData({type:'FeatureCollection',features:parts.map(x=>({
    type:'Feature',geometry:turf.along(x.line,x.length/2,{units:'kilometers'}).geometry,properties:{label:x.label}
  }))});
  map.getSource('lines').setData({type:'FeatureCollection',features:parts.map(x=>({type:'Feature',geometry:x.line.geometry,properties:{label:x.label,color:color(x.label,x.s),key:x.label+'|'+x.s}}))});
  shown.clear();applyShown();renderList();fitAll();
  if(skip)toast(skip+' registros sin geometría omitidos');
}
const natural=(a,b)=>a.localeCompare(b,'es',{numeric:true});
function applyShown(){
  const f=inList('key',[...shown]);['lines','arrows'].forEach(l=>map.setFilter(l,f));
  const labels=new Set([...parts.filter(x=>shown.has(x.label+'|'+x.s)).map(x=>x.label),...highlighted]);
  map.setFilter('line-labels',inList('label',[...labels]));
}
function renderList(){
  const q=$('q').value.trim().toLowerCase(),L=$('list');L.innerHTML='';
  const names=[...groups.keys()].sort(natural).filter(n=>!q||n.toLowerCase().includes(q));
  if(!names.length){L.innerHTML='<p id="msg">Sin líneas.</p>';return}
  names.forEach(n=>{const g=groups.get(n),ss=[...new Set(g.map(x=>x.s))].sort(),keys=ss.map(k=>n+'|'+k),d=document.createElement('div');d.className='it';
    d.innerHTML=`<input type="checkbox" ${keys.every(k=>shown.has(k))?'checked':''}><span class="d" style="background:${color(n,ss[0])}"></span><span class="n">${esc(n)}</span><span class="ss"></span>`;
    d.querySelector('input').onchange=e=>{keys.forEach(k=>e.target.checked?shown.add(k):shown.delete(k));applyShown();renderList()};
    ss.forEach(v=>{const b=document.createElement('button'),k=n+'|'+v;b.textContent='S'+v;b.title='Sentido '+v;b.style.cssText='padding:4px 8px;margin-left:3px';if(shown.has(k))b.classList.add('on');
      b.onclick=e=>{e.stopPropagation();shown.has(k)?shown.delete(k):shown.add(k);applyShown();renderList()};d.querySelector('.ss').appendChild(b)});
    d.querySelector('.n').onclick=()=>{keys.forEach(k=>shown.add(k));applyShown();hl([n]);fit(g);renderList()};
    L.appendChild(d)})}
$('shAll').onclick=()=>{parts.forEach(x=>shown.add(x.label+'|'+x.s));applyShown();renderList()};
$('shNone').onclick=()=>{shown.clear();applyShown();hl([]);renderList()};
$('q').oninput=renderList;
function hl(names){
  highlighted=names;
  const f=inList('label',names);map.setFilter('hl',f);map.setFilter('hlc',f);
  const labels=new Set([...parts.filter(x=>shown.has(x.label+'|'+x.s)).map(x=>x.label),...highlighted]);
  map.setFilter('line-labels',inList('label',[...labels]));
}
function fit(ps){if(!ps.length)return;const b=turf.bbox(turf.featureCollection(ps.map(x=>x.line)));map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:{top:60,left:40,right:40,bottom:window.innerHeight*.5},maxZoom:16})}
function fitAll(){fit(parts)}

/* ---- modos ---- */
function toast(t){const e=$('toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',3800)}
const fmt=p=>p[1].toFixed(5)+', '+p[0].toFixed(5);
function setMode(m){mode=m;if(m!=='A'){planToken++;$('routeLoading').hidden=true}trips=[];hl([]);map.getSource('seg').setData(EMPTY);drawPts();
  ['L','N','A','P'].forEach(k=>$('t'+k).classList.toggle('on',k===m));
  $('pL').style.display=m==='L'?'':'none';$('pO').style.display=(m==='N'||m==='A')?'':'none';$('pP').style.display=m==='P'?'':'none';
  $('abrows').style.display=m==='A'?'':'none';$('out').innerHTML='';$('steps').innerHTML='';
  $('msg').textContent=m==='N'?'Toca el mapa para ver qué líneas pasan cerca.':m==='A'?'Elige A y B: mapa, ◎, o pega un enlace de Google Maps.':'';
  if(m==='A'&&A&&B)plan();if(m==='N'&&P)near();if(m==='P'&&!cats.length)loadCategories()}
['L','N','A','P'].forEach(k=>$('t'+k).onclick=()=>setMode(k));
$('tX').onclick=()=>{$('sheet').classList.toggle('min');$('tX').textContent=$('sheet').classList.contains('min')?'▴':'▾'};
function drawPts(){const f=[];[[P,'#1c7ed6','Cerca'],[A,'#2f9e44','Origen (A)'],[B,'#e03131','Destino (B)'],[ME,'#868e96','Mi ubicación']].forEach(([p,c,label])=>p&&f.push({type:'Feature',geometry:{type:'Point',coordinates:p},properties:{c,label}}));
  trips.forEach(t=>t.sel&&t.marks.forEach(p=>f.push({type:'Feature',geometry:{type:'Point',coordinates:p},properties:{c:'#111'}})));
  map.getSource('pts').setData({type:'FeatureCollection',features:f})}
map.on('click',e=>{if(map.queryRenderedFeatures(e.point,{layers:['poi']}).length)return;
  const pt=[e.lngLat.lng,e.lngLat.lat];if(mode==='N'){P=pt;near()}else if(mode==='A')setPt(target,pt);drawPts()});

/* ---- puntos A/B: mapa, GPS, enlace de Google Maps ---- */
function parseLoc(s){s=decodeURIComponent((s||'').trim());let m;
  if((m=s.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/))||(m=s.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/))||(m=s.match(/\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/))||(m=s.match(/[?&](?:q|ll|query|destination|center)=(-?\d+\.?\d*)[,+ ]+(-?\d+\.?\d*)/))||(m=s.match(/^(-?\d+\.?\d*)\s*[,; ]\s*(-?\d+\.?\d*)$/)))
    return Math.abs(+m[1])<=90&&Math.abs(+m[2])<=180?[+m[2],+m[1]]:null;return null}
function setPt(w,pt,txt){if(w==='A')A=pt;else B=pt;$(w==='A'?'aI':'bI').value=txt||fmt(pt);
  target=w==='A'?(B?'A':'B'):(A?'B':'A');drawPts();if(A&&B)plan()}
const RES=()=>{try{return localStorage.getItem('resolver')||''}catch(e){return ''}};
async function resolveShort(v){const u=(v.match(/https?:\/\/\S+/)||[v])[0],r=RES();if(!r)throw 0;
  const j=await(await fetch(r+(r.includes('?')?'&':'?')+'u='+encodeURIComponent(u))).json();return parseLoc(j.url||'')}
function inp(w){const v=$(w==='A'?'aI':'bI').value,p=parseLoc(v);
  if(p){setPt(w,p,fmt(p));map.flyTo({center:p,zoom:15})}
  else if(/goo\.gl|maps\.app/i.test(v)){toast('Resolviendo enlace…');resolveShort(v).then(q=>{if(!q)throw 0;setPt(w,q,fmt(q));map.flyTo({center:q,zoom:15})}).catch(()=>toast(RES()?'No pude resolver el enlace.':'Para enlaces cortos configura el resolvedor (⚙) o pega la URL larga/coordenadas.'))}
  else if(v.trim())toast('No reconocí ese enlace o coordenadas.')}
$('cfg').onclick=()=>{const v=prompt('URL de tu resolvedor (Cloudflare Worker):',RES());if(v!==null)try{localStorage.setItem('resolver',v.trim())}catch(e){}};
[['A','aI'],['B','bI']].forEach(([w,id])=>{$(id).onchange=()=>inp(w);$(id).onfocus=()=>target=w;
  $(w.toLowerCase()+'L').onclick=()=>locate(m=>{setPt(w,m,'Mi ubicación');map.flyTo({center:m,zoom:15})});
  $(w.toLowerCase()+'C').onclick=()=>navigator.clipboard.readText().then(t=>{$(id).value=t;inp(w)}).catch(()=>toast('Pega manualmente en el campo.'))});
$('sw').onclick=()=>{const a=A,b=B,ta=$('aI').value,tb=$('bI').value;A=b;B=a;$('aI').value=tb;$('bI').value=ta;drawPts();if(A&&B)plan()};
function locate(cb){navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{ME=[p.coords.longitude,p.coords.latitude];drawPts();cb&&cb(ME)},()=>toast('No se pudo obtener la ubicación'),{enableHighAccuracy:true,timeout:10000}):toast('Sin geolocalización')}
$('fLoc').onclick=()=>locate(m=>{map.flyTo({center:m,zoom:15});if(mode==='N'){P=m;near()}else if(mode==='A')setPt(target,m,'Mi ubicación')});

/* ---- cálculo ---- */
const R=()=>Math.max(5,(+$('rad').value||500)*($('ru').value==='km'?1000:1));
function snap(x,pt){const s=turf.nearestPointOnLine(x.line,turf.point(pt),{units:'kilometers'});return {s,d:s.properties.dist*1000,loc:s.properties.location}}
function nearbyParts(pt,radius){
  const latDelta=radius/110000,lngDelta=radius/(110000*Math.max(Math.cos(pt[1]*Math.PI/180),0.01));
  return spatialIndex.search({minX:pt[0]-lngDelta,minY:pt[1]-latDelta,maxX:pt[0]+lngDelta,maxY:pt[1]+latDelta}).map(x=>x.part)
}
function near(){
  const radius=R(),best=new Map();nearbyParts(P,radius).forEach(x=>{const r=snap(x,P);if(r.d<=radius&&(!best.has(x.label)||r.d<best.get(x.label)))best.set(x.label,r.d)});
  const l=[...best].sort((a,b)=>a[1]-b[1]),o=$('out');o.innerHTML='';nearOn=new Set(l.map(x=>x[0]));hl([...nearOn]);
  $('msg').textContent=l.length?`${l.length} línea(s) a menos de ${fm(R())} (☑ para ver su ruta):`:`Ninguna línea a menos de ${fm(R())}.`;
  l.forEach(([n,d])=>{const r=document.createElement('div');r.className='it';
    r.innerHTML=`<input type="checkbox" checked><span class="d" style="background:${color(n)}"></span><span class="n">${esc(n)}</span><small>${fm(d)}</small>`;
    r.querySelector('input').onchange=e=>{e.target.checked?nearOn.add(n):nearOn.delete(n);hl([...nearOn])};r.querySelector('.n').onclick=()=>fit(groups.get(n));o.appendChild(r)})}
async function plan(){
  const token=++planToken;
  $('routeLoading').hidden=false;
  $('msg').textContent='';$('out').innerHTML='';$('steps').innerHTML='';
  trips=[];map.getSource('seg').setData(EMPTY);drawPts();
  await new Promise(resolve=>setTimeout(resolve,50));
  if(token!==planToken)return;
  try{
  const Rr=R(),T=+$('tr').value,dirOn=$('dir').checked,res=[];
  const reachable=pt=>nearbyParts(pt,Rr).map(x=>({x,s:snap(x,pt)})).filter(x=>x.s.d<=Rr).sort((a,b)=>a.s.d-b.s.d);
  const ia=reachable(A),ib=reachable(B),destinations=new Map(ib.slice(0,12).map(x=>[x.x,x.s]));
  const mins=(w,r,n)=>w/83+r*4+5*n;
  ia.forEach(({x,s:a})=>{const b=snap(x,B);if(b.d<=Rr&&(!dirOn||a.loc<b.loc)){const r=Math.abs(b.loc-a.loc);
    res.push({min:mins(a.d+b.d,r,1),legs:[{x,a:a.s,b:b.s,r}],walks:[a.d,b.d],marks:[a.s.geometry.coordinates,b.s.geometry.coordinates]})}});
  ia.slice(0,12).forEach(({x:X,s:a})=>{const len=X.length,S=[],transferBest=new Map();
    for(let k=0;k<len;k+=0.15){if(dirOn&&k<=a.loc)continue;S.push({k,p:turf.along(X.line,k,{units:'kilometers'})})}
    S.forEach(s=>nearbyParts(s.p.geometry.coordinates,T).forEach(Y=>{const b=destinations.get(Y);if(Y.label===X.label||!b)return;
      const t=turf.nearestPointOnLine(Y.line,s.p,{units:'kilometers'}),d=t.properties.dist*1000;if(d>T)return;const yl=t.properties.location;if(dirOn&&yl>=b.loc)return;
        const r1=Math.abs(s.k-a.loc),r2=Math.abs(b.loc-yl),m=mins(a.d+d+b.d,r1+r2,2);
        let best=transferBest.get(Y);if(!best||m<best.min)transferBest.set(Y,{min:m,legs:[{x:X,a:a.s,b:s.p,r:r1},{x:Y,a:t,b:b.s,r:r2}],walks:[a.d,d,b.d],marks:[a.s.geometry.coordinates,s.p.geometry.coordinates,t.geometry.coordinates,b.s.geometry.coordinates]})}));
    transferBest.forEach(best=>res.push(best));
  });
  const seen=new Set(),list=res.sort((p,q)=>p.min-q.min).filter(t=>{const k=t.legs.map(l=>tag(l.x)).join('>');return!seen.has(k)&&seen.add(k)}).slice(0,8);
  const dAB=turf.distance(A,B,{units:'kilometers'})*1000,wk={walkOnly:true,min:dAB/83,legs:[],walks:[dAB],marks:[]};
  trips=dAB<50?[wk]:dAB<100?[wk,...list]:list;trips.forEach((t,i)=>t.on=i===0);
  $('msg').textContent=(trips.length?`A–B en línea recta: ${fm(dAB)}. ☑ para ver cada ruta · tiempos estimados:`:'Sin ruta con estos parámetros. Aumenta el radio o el transbordo máx.');
  const o=$('out');o.innerHTML='';
  trips.forEach(t=>{const d=document.createElement('div');d.className='it';const w=t.walks.reduce((a,b)=>a+b,0);
    d.innerHTML=`<input type="checkbox" ${t.on?'checked':''}><span class="n">${t.walkOnly?'🚶 Caminar directo':t.legs.map(l=>`<span style="color:${color(l.x.label,l.x.s)}">●</span> ${esc(tag(l.x))}`).join(' → ')}</span><small>~${Math.round(t.min)} min · 🚶${fm(w)}${t.legs.length>1?' · 1 transbordo':''}</small>`;
    d.querySelector('input').onchange=e=>{t.on=e.target.checked;drawTrips()};
    d.querySelector('.n').onclick=()=>{t.on=true;d.querySelector('input').checked=true;active(t)};o.appendChild(d)});
  if(trips.length)active(trips[0]);else{drawTrips();$('steps').innerHTML=''}
  }catch(error){
    console.error('No se pudo calcular la ruta A → B.',error);
    $('msg').textContent='No se pudo calcular la ruta. Inténtalo nuevamente.';
    $('out').innerHTML='';$('steps').innerHTML='';
  }finally{
    if(token===planToken)$('routeLoading').hidden=true;
  }
}
const wl=(p,q)=>({type:'Feature',geometry:{type:'LineString',coordinates:[p,q]},properties:{w:true}});
function drawTrips(){const f=[],labels=[];trips.filter(t=>t.on).forEach(t=>{let prev=A;
  t.legs.forEach(l=>{f.push(wl(prev,l.a.geometry.coordinates));const sl=turf.lineSlice(l.a,l.b,l.x.line);sl.properties={w:false,c:color(l.x.label,l.x.s),label:tag(l.x)};f.push(sl);
    const length=turf.length(sl,{units:'kilometers'});if(length>0)labels.push({type:'Feature',geometry:turf.along(sl,length/2,{units:'kilometers'}).geometry,properties:{label:tag(l.x)}});
    prev=l.b.geometry.coordinates});f.push(wl(prev,B))});
  map.getSource('seg').setData({type:'FeatureCollection',features:f});map.getSource('trip-label-points').setData({type:'FeatureCollection',features:labels});hl([]);drawPts()}
function active(t){trips.forEach(z=>z.sel=0);t.sel=1;const st=[];
  if(t.walkOnly)st.push(`🚶 Camina ${fm(t.walks[0])} hasta B (≈ ${Math.round(t.min)} min).`);
  else{t.legs.forEach((l,i)=>st.push(`🚶 Camina ${fm(t.walks[i])} hasta la línea <b>${esc(tag(l.x))}</b> y sube.`,`🚌 Viaja ${fm(l.r*1000)} y bájate.`));st.push(`🚶 Camina ${fm(t.walks[t.walks.length-1])} hasta B.`)}
  $('steps').innerHTML=st.join('<br>');drawTrips()}
const refresh=()=>{if(mode==='N'&&P)near();if(mode==='A'&&A&&B)plan()};
$('ru').onchange=()=>{const km=$('ru').value==='km',r=$('rad'),v=+r.value;r.min=km?.005:5;r.max=km?3:3000;r.step=km?.005:5;r.value=km?+(v/1000).toFixed(3):Math.round(v*1000);refresh()};
$('rad').onchange=$('tr').onchange=$('dir').onchange=refresh;

/* ---- lugares de interés ---- */
const fc=a=>({type:'FeatureCollection',features:a.map((p,i)=>({type:'Feature',geometry:{type:'Point',coordinates:[p.lon,p.lat]},properties:{i}}))});
function showPois(arr,title){
  pois=arr.map(d=>({name:d.poi_name||'(sin nombre)',desc:d.poi_description||'',dir:d.poi_direction||'',lon:+d.poi_lon,lat:+d.poi_lat})).filter(p=>isFinite(p.lon)&&isFinite(p.lat));
  map.getSource('poi').setData(fc(pois));$('wt').textContent=`${title} (${pois.length})`;$('wq').value='';renderWin();$('win').style.display='flex'}
function renderWin(){const q=$('wq').value.toLowerCase(),L=$('wl');L.innerHTML='';
  pois.filter(p=>!q||(p.name+' '+p.dir+' '+p.desc).toLowerCase().includes(q)).slice(0,200).forEach(p=>{const d=document.createElement('div');d.className='card';
    d.innerHTML=`<b>${esc(p.name)}</b><small>${esc(p.dir)}</small><div class="ds">${esc(p.desc)}</div><div class="row"><button>📍 Ver en mapa</button><button>Como A</button><button>Como B</button></div>`;
    const b=d.querySelectorAll('button');b[0].onclick=()=>goPoi(p);b[1].onclick=()=>usePoi(p,'A');b[2].onclick=()=>usePoi(p,'B');L.appendChild(d)})}
$('wq').oninput=renderWin;$('wx').onclick=()=>$('win').style.display='none';
$('wf').onclick=()=>{$('win').style.display='none';if(pois.length){const b=turf.bbox(turf.multiPoint(pois.map(p=>[p.lon,p.lat])));map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:{top:60,left:40,right:40,bottom:window.innerHeight*.5},maxZoom:16})}};
function goPoi(p){$('win').style.display='none';map.flyTo({center:[p.lon,p.lat],zoom:16});popup(p)}
function usePoi(p,w){$('win').style.display='none';setMode('A');setPt(w,[p.lon,p.lat],p.name);map.flyTo({center:[p.lon,p.lat],zoom:15})}
function popup(p){const n=document.createElement('div');n.style.color='#111';n.innerHTML=`<b>${esc(p.name)}</b><br><small>${esc(p.dir)}</small><div class="row"><button>A</button><button>B</button></div>`;
  const b=n.querySelectorAll('button');b[0].onclick=()=>usePoi(p,'A');b[1].onclick=()=>usePoi(p,'B');
  new maplibregl.Popup({offset:10}).setLngLat([p.lon,p.lat]).setDOMContent(n).addTo(map)}
function renderCats(){const c=$('cats');c.innerHTML='';cats.forEach(k=>{const b=document.createElement('button');b.className='chip';b.textContent=k.type_name;b.onclick=()=>loadCat(k);c.appendChild(b)})}
function loadCat(k){$('msg3').textContent='Cargando '+k.type_name+'…';
  fetch('https://app.cruzero.net/api/poi/all/category/'+k.id).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(j=>{$('msg3').textContent='';showPois(j.data||j,k.type_name)})
  .catch(error=>{console.error('No se pudieron cargar los lugares de la categoría.',error);$('msg3').textContent='No se pudieron cargar los lugares de esta categoría. Verifica la conexión e inténtalo otra vez.'})}
async function loadCategories(){
  if(categoriesLoading)return categoriesLoading;
  $('msg3').textContent='Cargando categorías…';
  categoriesLoading=fetch('categoria_lugares.json').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(j=>{
    const data=j.data||j;
    if(!Array.isArray(data))throw new Error('El JSON de categorías no contiene una lista.');
    cats=data;renderCats();$('msg3').textContent='Elige una categoría para cargar sus lugares.';return true;
  }).catch(error=>{
    console.error('No se pudieron cargar las categorías.',error);
    $('msg3').textContent='No se pudieron cargar las categorías desde categoria_lugares.json.';
    return false;
  }).finally(()=>{categoriesLoading=null});
  return categoriesLoading;
}
$('bCat').onclick=loadCategories;

/* ---- botón ◎ siempre sobre el menú ---- */
const updSh=()=>document.documentElement.style.setProperty('--sh',Math.max(0,innerHeight-$('sheet').getBoundingClientRect().top)+'px');
new ResizeObserver(updSh).observe($('sheet'));$('sheet').addEventListener('transitionend',updSh);addEventListener('resize',updSh);updSh();
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
$('fFit').onclick=fitAll;
$('fClr').onclick=()=>{A=B=P=null;if(watch==null)ME=null;trips=[];shown.clear();nearOn.clear();applyShown();hl([]);['seg','poi'].forEach(k=>map.getSource(k).setData(EMPTY));pois=[];target='A';
  $('aI').value=$('bI').value='';$('out').innerHTML='';$('steps').innerHTML='';document.querySelectorAll('.maplibregl-popup').forEach(e=>e.remove());drawPts();renderList();toast('Mapa limpio')};
$('fTrk').onclick=()=>{
  if(watch!=null){navigator.geolocation.clearWatch(watch);watch=null;wlk&&wlk.release().catch(()=>{});wlk=null;$('fTrk').textContent='▶';$('fTrk').classList.remove('on');toast('Viaje terminado');return}
  if(!navigator.geolocation)return toast('Sin geolocalización');
  try{navigator.wakeLock&&navigator.wakeLock.request('screen').then(l=>wlk=l).catch(()=>{})}catch(e){}
  $('fTrk').textContent='■';$('fTrk').classList.add('on');toast('Viaje iniciado: siguiendo tu ubicación');
  watch=navigator.geolocation.watchPosition(p=>{ME=[p.coords.longitude,p.coords.latitude];drawPts();map.easeTo({center:ME,zoom:Math.max(map.getZoom(),16),duration:600});
    if(B){const d=turf.distance(ME,B,{units:'kilometers'})*1000;$('msg').textContent='Faltan '+fm(d)+' hasta B';if(d<30){toast('¡Llegaste a B!');$('fTrk').click()}}},
    ()=>toast('No pude seguir tu ubicación'),{enableHighAccuracy:true,maximumAge:2000,timeout:15000});};
