const STATUS={};
const CATEGORY_OVERRIDES_V2={
  '8237392':'\uD5E4\uC5B4',
  '4512842':'\uD5E4\uC5B4',
  '6319779':'\uD5E4\uC5B4',
  '6729707':'\uC545\uC138\uC0AC\uB9AC',
  '5284793':'\uC6D4\uB4DC',
  '8436194':'\uC758\uC0C1',
  '8024974':'\uD14D\uC2A4\uCC98',
  '7822755':'\uC758\uC0C1',
  '7700084':'\uC758\uC0C1',
  '7435582':'\uC758\uC0C1',
  '6610175':'\uD234',
  '6744059':'\uC758\uC0C1',
  '6640868':'\uC758\uC0C1',
  '6584413':'\uC758\uC0C1',
  '6770800':'\uC758\uC0C1',
  '6415336':'\uC758\uC0C1',
  '6533470':'\uC758\uC0C1',
  '5802231':'\uC758\uC0C1',
  '8040725':'\uC758\uC0C1'
};
const CATEGORY_OVERRIDES={'7772782':'헤어'};
const GROUPS={
  '전체':['전체'],
  '아바타':['아바타'],
  '파츠':['의상','헤어','악세사리'],
  '기타':['포즈','텍스처','월드'],
  '툴':['툴']
};
const state={group:'전체',leaf:'전체',query:'',shop:'',avatar:'',sort:'new',unavailable:false};
function itemId(x){return(x.u.match(/items\/(\d+)/)||[])[1]||String(x.i)}
function categoryOf(x){
  const forced=CATEGORY_OVERRIDES_V2[itemId(x)];if(forced)return forced;
  if(x.c)return x.c;
  if(CATEGORY_OVERRIDES[itemId(x)])return CATEGORY_OVERRIDES[itemId(x)];
  const t=(x.t+' '+x.s).toLowerCase();
  if(/tool|ツール|plugin|プラグイン|system|generator|manager|editor|メーカー|unity|shader|spout|warudo|avapo|알파스트림/.test(t))return'툴';
  if(/pose|ポーズ|motion|モーション|animation|アニメーション/.test(t))return'포즈';
  if(/texture|テクスチャ|makeup|メイク|eye tex|body tex|skin tex|肌|瞳/.test(t))return'텍스처';
  if(!/対応|support|compatible/.test(t)&&/オリジナル\s*3d(?:モデル|アバター)|original\s*3d\s*(?:model|avatar)|오리지널\s*3d\s*(?:모델|아바타)/.test(t))return'아바타';
  if(/hair|ヘア|髪|ponytail|ポニー|twintail|ツインテ|bob|ボブ|braid|お団子|ウルフ/.test(t))return'헤어';
  // 실제 착용 소품만 악세사리로 분류한다. (VRChat 내부의 'hat' 같은 부분 문자열은 제외)
  if(/accessor(?:y|ies)|アクセサリ|악세사리|小物|眼鏡|メガネ|안경|バッグ|가방|リュック|バックパック|ヘッドセット|ヘッドホン|헤드셋|모자|帽子|ピアス|イヤリング|earrings?|necklace|ネックレス|choker|チョーカー|bracelet|ブレスレット|umbrella|傘|\b(?:glasses|sunglasses|bag|backpack|headset|headphones?|hat|cap|beanie|shoes?)\b/.test(t))return'악세사리';
  return'의상';
}
function escapeHtml(s=''){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function loadData(){const bytes=Uint8Array.from(atob(window.YAOM_DATA_B64),c=>c.charCodeAt(0));const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return JSON.parse(await new Response(stream).text())}
function setGroup(group,items,leaf=GROUPS[group][0]){state.group=group;state.leaf=leaf;drawNav(items);render(items);document.querySelector('#collection-title').textContent=leaf==='전체'?'ALL ITEMS':leaf.toUpperCase();}
function drawNav(items){
  const nav=document.querySelector('#main-nav');nav.innerHTML='';Object.keys(GROUPS).forEach(g=>{const b=document.createElement('button');b.className='nav-item'+(g===state.group?' active':'');b.textContent=g;b.onclick=()=>setGroup(g,items);nav.append(b)});
  const sub=document.querySelector('#sub-nav');sub.innerHTML='';if(GROUPS[state.group].length>1){const all=document.createElement('button');all.className='sub-item'+(state.leaf===state.group?' active':'');all.textContent=`${state.group} 전체`;all.onclick=()=>{state.leaf=state.group;drawNav(items);render(items)};sub.append(all);GROUPS[state.group].forEach(l=>{const b=document.createElement('button');b.className='sub-item'+(l===state.leaf?' active':'');b.textContent=l;b.onclick=()=>{state.leaf=l;drawNav(items);render(items)};sub.append(b)})}}
function categoryCard(group,items,index){const leaves=GROUPS[group],pool=items.filter(x=>leaves.includes(x.category));const img=(pool[index%Math.max(pool.length,1)]||items[index]).m;const count=pool.length;const sub=group==='파츠'?'의상 · 헤어 · 악세사리':group==='기타'?'포즈 · 텍스처':group;return`<button class="category-card" data-group="${group}"><img src="${img}" alt="" loading="lazy"><div><span><strong>${group}</strong><span>${sub} / ${count} ITEMS</span></span><b>↗</b></div></button>`}
function avatarChips(x){if(!x.a?.length)return'';const shown=x.a.slice(0,4).map(a=>`<span>${escapeHtml(a)}</span>`).join('');const more=x.a.length>4?`<span>+${x.a.length-4}</span>`:'';return`<div class="avatar-tags" title="${escapeHtml(x.a.join(', '))}">${shown}${more}</div>`}
function card(x){const status=STATUS[itemId(x)],label=status==='deleted'?'판매 종료':status==='shop-closed'?'샵 폐쇄':'CHECK';return`<article class="card"><a class="thumb" href="${x.u}" target="_blank" rel="noopener"><img src="${x.m}" alt="" loading="lazy" referrerpolicy="no-referrer">${x.g?'<span class="gift-tag">GIFT</span>':''}<span class="state-tag ${status?'off':''}">${label}</span></a><div class="card-body"><span class="card-cat">${x.category}${x.f?' · FULL PACK':''}</span><h3>${escapeHtml(x.t)}</h3>${avatarChips(x)}<a class="shop" href="${x.p}" target="_blank" rel="noopener">${escapeHtml(x.s)}</a></div></article>`}
function render(items){const allowed=state.group==='전체'?null:GROUPS[state.group];let out=items.filter(x=>(!allowed||allowed.includes(x.category))&&(state.leaf==='전체'||state.leaf===state.group||x.category===state.leaf)&&(!state.shop||x.s===state.shop)&&(!state.avatar||x.a?.includes(state.avatar))&&(!state.query||(x.t+' '+x.s+' '+(x.a||[]).join(' ')).toLowerCase().includes(state.query))&&(!state.unavailable||STATUS[itemId(x)]));out.sort((a,b)=>state.sort==='old'?b.i-a.i:state.sort==='name'?a.t.localeCompare(b.t):a.i-b.i);document.querySelector('#grid').innerHTML=out.map(card).join('');document.querySelector('#result-count').textContent=out.length;document.querySelector('#empty').hidden=!!out.length}
function init(items){
  items.forEach(x=>x.category=categoryOf(x));document.querySelector('#hero-total').textContent=String(items.length).padStart(3,'0');const featured=items.find(x=>x.category==='의상')||items[0];document.querySelector('#hero-img').src=featured.m;document.querySelector('#hero-title').textContent=featured.t;
  drawNav(items);const cards=document.querySelector('#category-cards');cards.innerHTML=['아바타','파츠','기타','툴'].map((g,i)=>categoryCard(g,items,i*7)).join('');cards.querySelectorAll('button').forEach(b=>b.onclick=()=>{setGroup(b.dataset.group,items);document.querySelector('#collection').scrollIntoView()});
  [...new Set(items.map(x=>x.s))].sort((a,b)=>a.localeCompare(b)).forEach(s=>document.querySelector('#shop').add(new Option(s,s)));
  [...new Set(items.flatMap(x=>x.a||[]))].sort((a,b)=>a.localeCompare(b)).forEach(a=>document.querySelector('#avatar').add(new Option(a,a)));
  document.querySelector('#search').oninput=e=>{state.query=e.target.value.toLowerCase();render(items)};document.querySelector('#shop').onchange=e=>{state.shop=e.target.value;render(items)};document.querySelector('#avatar').onchange=e=>{state.avatar=e.target.value;render(items)};document.querySelector('#sort').onchange=e=>{state.sort=e.target.value;render(items)};document.querySelector('#unavailable').onchange=e=>{state.unavailable=e.target.checked;render(items)};document.querySelector('#explore').onclick=()=>document.querySelector('#collection').scrollIntoView();render(items)
}
loadData().then(init).catch(()=>{document.querySelector('#empty').hidden=false;document.querySelector('#empty').textContent='DATA LOAD ERROR'});
