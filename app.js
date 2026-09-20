const STATUS = {};

// 관리자가 지정한 분류는 자동 판정보다 항상 우선합니다.
let categoryOverrides = {};

const CATEGORIES = [
  {id:'전체', label:'전체 상품', icon:'▦'},
  {id:'아바타', label:'아바타', icon:'○'},
  {id:'의상', label:'의상', icon:'◇'},
  {id:'헤어', label:'헤어', icon:'⌁'},
  {id:'악세사리', label:'악세사리', icon:'+'},
  {id:'포즈', label:'포즈', icon:'⌇'},
  {id:'텍스처', label:'텍스처', icon:'◫'},
  {id:'월드', label:'월드', icon:'⌂'},
  {id:'툴', label:'툴', icon:'⚙'}
];

const state = {
  category:'전체', special:'', query:'', shop:'', avatar:'', sort:'new',
  favorites:new Set(JSON.parse(localStorage.getItem('yaom-favorites') || '[]'))
};

function itemId(item){
  return (item.u.match(/items\/(\d+)/) || [])[1] || String(item.i);
}

function categoryOf(item){
  const forced = categoryOverrides[itemId(item)];
  if(forced) return forced;
  if(item.c) return item.c;
  const text = `${item.t} ${item.s}`.toLowerCase();
  if(/tool|ツール|plugin|プラグイン|system|generator|manager|editor|メーカー|unity|shader|spout|warudo|avapo|알파스트림/.test(text)) return '툴';
  if(/pose|ポーズ|motion|モーション|animation|アニメーション/.test(text)) return '포즈';
  if(/texture|テクスチャ|makeup|メイク|eye tex|body tex|skin tex|肌|瞳/.test(text)) return '텍스처';
  if(!/対応|support|compatible/.test(text) && /オリジナル\s*3d(?:モデル|アバター)|original\s*3d\s*(?:model|avatar)|오리지널\s*3d\s*(?:모델|아바타)/.test(text)) return '아바타';
  if(/hair|ヘア|髪|ponytail|ポニー|twintail|ツインテ|bob|ボブ|braid|お団子|ウルフ/.test(text)) return '헤어';
  if(/accessor(?:y|ies)|アクセサリ|악세사리|小物|眼鏡|メガネ|안경|バッグ|가방|リュック|バックパック|ヘッドセット|ヘッドホン|헤드셋|모자|帽子|ピアス|イヤリング|earrings?|necklace|ネックレス|choker|チョーカー|bracelet|ブレスレット|umbrella|傘|\b(?:glasses|sunglasses|bag|backpack|headset|headphones?|hat|cap|beanie|shoes?)\b/.test(text)) return '악세사리';
  return '의상';
}

function escapeHtml(value=''){
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

async function loadData(){
  const bytes = Uint8Array.from(atob(window.YAOM_DATA_B64), char => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

async function loadOverrides(){
  const response=await fetch(`collections.json?v=${Date.now()}`,{cache:'no-store'});
  if(!response.ok) throw new Error('컬렉션 설정을 불러오지 못했습니다.');
  return response.json();
}

function closeMobileMenu(){
  document.querySelector('#sidebar').classList.remove('open');
  document.querySelector('#scrim').classList.remove('show');
  document.querySelector('#mobile-menu').setAttribute('aria-expanded','false');
}

function resetFilters(items, keepCategory=false){
  if(!keepCategory) state.category='전체';
  state.special=''; state.query=''; state.shop=''; state.avatar=''; state.sort='new';
  document.querySelector('#search').value='';
  document.querySelector('#shop').value='';
  document.querySelector('#avatar').value='';
  document.querySelector('#sort').value='new';
  drawNav(items); render(items); closeMobileMenu();
}

function selectCategory(category, items){
  state.category=category; state.special='';
  drawNav(items); render(items); closeMobileMenu();
  if(innerWidth<760) document.querySelector('.library').scrollIntoView();
}

function selectSpecial(special, items){
  state.special=special; state.category='전체';
  drawNav(items); render(items); closeMobileMenu();
  if(innerWidth<760) document.querySelector('.library').scrollIntoView();
}

function countFor(items, category){
  return category==='전체' ? items.length : items.filter(item=>item.category===category).length;
}

function drawNav(items){
  const nav=document.querySelector('#main-nav');
  nav.innerHTML=CATEGORIES.map(cat=>`<button class="side-item ${!state.special&&state.category===cat.id?'active':''}" type="button" data-category="${cat.id}"><span class="side-icon">${cat.icon}</span><span>${cat.label}</span><b>${countFor(items,cat.id)}</b></button>`).join('');
  nav.querySelectorAll('[data-category]').forEach(button=>button.onclick=()=>selectCategory(button.dataset.category,items));

  document.querySelectorAll('[data-special]').forEach(button=>{
    button.classList.toggle('active',state.special===button.dataset.special);
    button.onclick=()=>selectSpecial(button.dataset.special,items);
  });
  document.querySelector('#gift-count').textContent=items.filter(item=>item.g).length;
  document.querySelector('#favorite-count').textContent=state.favorites.size;
  document.querySelector('#unavailable-count').textContent=items.filter(item=>STATUS[itemId(item)]).length;
}

function avatarTags(item){
  if(!item.a?.length) return '';
  const tags=item.a.slice(0,3).map(avatar=>`<span>${escapeHtml(avatar)}</span>`).join('');
  const more=item.a.length>3?`<span>+${item.a.length-3}</span>`:'';
  return `<div class="avatar-tags" title="${escapeHtml(item.a.join(', '))}">${tags}${more}</div>`;
}

function statusBadge(item){
  const status=STATUS[itemId(item)];
  if(status==='deleted') return '<span class="badge off">판매 종료</span>';
  if(status==='shop-closed') return '<span class="badge off">샵 폐쇄</span>';
  if(item.g) return '<span class="badge gift">GIFT</span>';
  return '';
}

function card(item){
  const id=itemId(item), favorite=state.favorites.has(id);
  return `<article class="product-card" data-id="${id}">
    <a class="thumb" href="${item.u}" target="_blank" rel="noopener" aria-label="${escapeHtml(item.t)} BOOTH에서 보기">
      <img src="${item.m}" alt="" loading="lazy" referrerpolicy="no-referrer">
      ${statusBadge(item)}
    </a>
    <button class="favorite ${favorite?'on':''}" type="button" data-favorite="${id}" aria-label="즐겨찾기 ${favorite?'해제':'추가'}">${favorite?'★':'☆'}</button>
    <div class="product-info">
      <a class="shop" href="${item.p}" target="_blank" rel="noopener">${escapeHtml(item.s)}</a>
      <h3 class="product-title">${escapeHtml(item.t)}</h3>
      <div class="meta-row"><span class="category-tag">${item.category}</span>${item.f?'<span class="pack-tag">FULL PACK</span>':''}</div>
      ${avatarTags(item)}
      <a class="card-action" href="${item.u}" target="_blank" rel="noopener">BOOTH에서 보기 ↗</a>
    </div>
  </article>`;
}

function currentLabel(){
  if(state.special==='gift') return '받은 기프트';
  if(state.special==='favorite') return '즐겨찾기';
  if(state.special==='unavailable') return '판매 종료 / 샵 폐쇄';
  return CATEGORIES.find(cat=>cat.id===state.category)?.label || '전체 상품';
}

function filteredItems(items){
  const query=state.query.trim().toLowerCase();
  const result=items.filter(item=>{
    if(state.category!=='전체' && item.category!==state.category) return false;
    if(state.special==='gift' && !item.g) return false;
    if(state.special==='favorite' && !state.favorites.has(itemId(item))) return false;
    if(state.special==='unavailable' && !STATUS[itemId(item)]) return false;
    if(state.shop && item.s!==state.shop) return false;
    if(state.avatar && !item.a?.includes(state.avatar)) return false;
    if(query && !`${item.t} ${item.s} ${(item.a||[]).join(' ')}`.toLowerCase().includes(query)) return false;
    return true;
  });
  result.sort((a,b)=>{
    if(state.sort==='old') return b.i-a.i;
    if(state.sort==='name') return a.t.localeCompare(b.t);
    if(state.sort==='shop') return a.s.localeCompare(b.s)||a.t.localeCompare(b.t);
    return a.i-b.i;
  });
  return result;
}

function drawFilterChips(items){
  const chips=[];
  if(state.query) chips.push(['query',`검색: ${state.query}`]);
  if(state.shop) chips.push(['shop',state.shop]);
  if(state.avatar) chips.push(['avatar',`아바타: ${state.avatar}`]);
  const root=document.querySelector('#filter-chips');
  root.innerHTML=chips.map(([key,label])=>`<button type="button" data-clear="${key}">${escapeHtml(label)} ×</button>`).join('');
  root.querySelectorAll('button').forEach(button=>button.onclick=()=>{
    const key=button.dataset.clear; state[key]='';
    if(key==='query') document.querySelector('#search').value='';
    if(key==='shop') document.querySelector('#shop').value='';
    if(key==='avatar') document.querySelector('#avatar').value='';
    render(items);
  });
}

function render(items){
  const visible=filteredItems(items);
  document.querySelector('#grid').innerHTML=visible.map(card).join('');
  document.querySelector('#result-count').textContent=visible.length.toLocaleString('ko-KR');
  document.querySelector('#active-label').textContent=currentLabel();
  document.querySelector('#empty').hidden=visible.length!==0;
  const hasFilters=!!(state.special||state.category!=='전체'||state.query||state.shop||state.avatar||state.sort!=='new');
  document.querySelector('#clear-filters').hidden=!hasFilters;
  drawFilterChips(items);

  document.querySelectorAll('[data-favorite]').forEach(button=>button.onclick=()=>{
    const id=button.dataset.favorite;
    if(state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
    localStorage.setItem('yaom-favorites',JSON.stringify([...state.favorites]));
    drawNav(items); render(items);
  });
}

function fillSelects(items){
  [...new Set(items.map(item=>item.s))].sort((a,b)=>a.localeCompare(b)).forEach(shop=>document.querySelector('#shop').add(new Option(shop,shop)));
  [...new Set(items.flatMap(item=>item.a||[]))].sort((a,b)=>a.localeCompare(b)).forEach(avatar=>document.querySelector('#avatar').add(new Option(avatar,avatar)));
}

function bindControls(items){
  document.querySelector('#search').oninput=event=>{state.query=event.target.value;render(items)};
  document.querySelector('#shop').onchange=event=>{state.shop=event.target.value;render(items)};
  document.querySelector('#avatar').onchange=event=>{state.avatar=event.target.value;render(items)};
  document.querySelector('#sort').onchange=event=>{state.sort=event.target.value;render(items)};
  document.querySelector('#clear-filters').onclick=()=>resetFilters(items);
  document.querySelector('#empty-reset').onclick=()=>resetFilters(items);

  const density=document.querySelector('#density');
  const savedDensity=Number(localStorage.getItem('yaom-density'))||4;
  density.value=String(savedDensity);
  document.documentElement.style.setProperty('--columns',savedDensity);
  density.oninput=event=>{
    document.documentElement.style.setProperty('--columns',event.target.value);
    localStorage.setItem('yaom-density',event.target.value);
  };

  document.addEventListener('keydown',event=>{
    if(event.key==='/' && !/input|select|textarea/i.test(document.activeElement.tagName)){
      event.preventDefault(); document.querySelector('#search').focus();
    }
    if(event.key==='Escape') closeMobileMenu();
  });

  const menu=document.querySelector('#mobile-menu');
  menu.onclick=()=>{
    const open=!document.querySelector('#sidebar').classList.contains('open');
    document.querySelector('#sidebar').classList.toggle('open',open);
    document.querySelector('#scrim').classList.toggle('show',open);
    menu.setAttribute('aria-expanded',String(open));
  };
  document.querySelector('#scrim').onclick=closeMobileMenu;
}

function init(items){
  items.forEach(item=>item.category=categoryOf(item));
  fillSelects(items); bindControls(items); drawNav(items); render(items);
  document.querySelector('#updated-at').textContent='LIVE';
}

Promise.all([loadData(),loadOverrides()]).then(([items,overrides])=>{
  categoryOverrides=overrides;
  init(items);
}).catch(error=>{
  console.error(error);
  const empty=document.querySelector('#empty');
  empty.hidden=false;
  empty.querySelector('strong').textContent='상품 데이터를 불러오지 못했어요.';
});
