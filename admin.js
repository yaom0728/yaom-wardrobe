const ADMIN_LOGIN='yaom0728';
const REPOSITORY='yaom0728/yaom-wardrobe';
const COLLECTION_FILE='collections.json';
const TOKEN_STORAGE_KEY='yaom-admin-token';
const BASE_CATEGORY_OPTIONS=['아바타','의상','헤어','악세사리','포즈','텍스처','월드','툴'];
const RESERVED_COLLECTION_NAMES=['전체','전체 상품','받은 기프트','즐겨찾기','판매 종료'];

let accessToken='';
let fileSha='';
let items=[];
let originalOverrides={};
let draftOverrides={};
let originalCustomCollections=[];
let draftCustomCollections=[];
let query='';
let categoryFilter='';
let changedOnly=false;
let messageTimer;

function itemId(item){return(item.u.match(/items\/(\d+)/)||[])[1]||String(item.i)}

function baseCategoryOf(item){
  if(item.c)return item.c;
  const text=`${item.t} ${item.s}`.toLowerCase();
  if(/tool|ツール|plugin|プラグイン|system|generator|manager|editor|メーカー|unity|shader|spout|warudo|avapo|알파스트림/.test(text))return'툴';
  if(/pose|ポーズ|motion|モーション|animation|アニメーション/.test(text))return'포즈';
  if(/texture|テクスチャ|makeup|メイク|eye tex|body tex|skin tex|肌|瞳/.test(text))return'텍스처';
  if(!/対応|support|compatible/.test(text)&&/オリジナル\s*3d(?:モデル|アバター)|original\s*3d\s*(?:model|avatar)|오리지널\s*3d\s*(?:모델|아바타)/.test(text))return'아바타';
  if(/hair|ヘア|髪|ponytail|ポニー|twintail|ツインテ|bob|ボブ|braid|お団子|ウルフ/.test(text))return'헤어';
  if(/accessor(?:y|ies)|アクセサリ|악세사리|小物|眼鏡|メガネ|안경|バッグ|가방|リュック|バックパック|ヘッドセット|ヘッドホン|헤드셋|모자|帽子|ピアス|イヤリング|earrings?|necklace|ネックレス|choker|チョーカー|bracelet|ブレスレット|umbrella|傘|\b(?:glasses|sunglasses|bag|backpack|headset|headphones?|hat|cap|beanie|shoes?)\b/.test(text))return'악세사리';
  return'의상';
}

function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function effectiveCategory(item,overrides=draftOverrides){return overrides[itemId(item)]||baseCategoryOf(item)}
function isChanged(item){return effectiveCategory(item)!==effectiveCategory(item,originalOverrides)}
function categoryOptions(){return[...BASE_CATEGORY_OPTIONS,...draftCustomCollections]}
function collectionsChanged(){return JSON.stringify(draftCustomCollections)!==JSON.stringify(originalCustomCollections)}
function hasPendingChanges(){return collectionsChanged()||items.some(isChanged)}

function normalizeConfig(value){
  if(value&&value.assignments)return{
    customCollections:Array.isArray(value.customCollections)?value.customCollections:[],
    assignments:value.assignments||{}
  };
  return{customCollections:[],assignments:value||{}};
}

async function loadItems(){
  const bytes=Uint8Array.from(atob(window.YAOM_DATA_B64),char=>char.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

function decodeBase64(value){
  const binary=atob(value.replace(/\s/g,''));
  const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64(value){
  const bytes=new TextEncoder().encode(value);
  let binary='';
  for(let index=0;index<bytes.length;index+=0x8000)binary+=String.fromCharCode(...bytes.subarray(index,index+0x8000));
  return btoa(binary);
}

async function github(path,options={}){
  const response=await fetch(`https://api.github.com${path}`,{
    ...options,
    headers:{
      Accept:'application/vnd.github+json',
      Authorization:`Bearer ${accessToken}`,
      'X-GitHub-Api-Version':'2022-11-28',
      ...(options.headers||{})
    }
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.message||`GitHub 요청 실패 (${response.status})`);
  return body;
}

function setLoginMessage(text,ok=false){
  const target=document.querySelector('#login-message');
  target.textContent=text;target.classList.toggle('ok',ok);
}

function toast(text,error=false){
  clearTimeout(messageTimer);
  const target=document.querySelector('#save-message');
  target.textContent=text;target.classList.toggle('error',error);target.classList.add('show');
  messageTimer=setTimeout(()=>target.classList.remove('show'),5000);
}

async function connect(rememberedToken=''){
  const input=document.querySelector('#github-token');
  const remember=document.querySelector('#remember-token');
  const button=document.querySelector('#connect');
  const token=(rememberedToken||input.value).trim();
  const shouldRemember=!!rememberedToken||remember.checked;
  if(!token){setLoginMessage('토큰을 입력해 주세요.');return}
  accessToken=token;input.value='';button.disabled=true;setLoginMessage('GitHub 계정을 확인하고 있어요…',true);
  try{
    const user=await github('/user');
    if(user.login.toLowerCase()!==ADMIN_LOGIN)throw new Error(`${ADMIN_LOGIN} 계정의 토큰만 사용할 수 있어요.`);
    const file=await github(`/repos/${REPOSITORY}/contents/${COLLECTION_FILE}?ref=main`);
    fileSha=file.sha;
    const config=normalizeConfig(JSON.parse(decodeBase64(file.content)));
    originalOverrides={...config.assignments};
    draftOverrides={...originalOverrides};
    originalCustomCollections=[...config.customCollections];
    draftCustomCollections=[...originalCustomCollections];
    if(shouldRemember)localStorage.setItem(TOKEN_STORAGE_KEY,accessToken);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
    document.querySelector('#owner-name').textContent=`@${user.login}`;
    document.querySelector('#login-panel').hidden=true;
    document.querySelector('#editor').hidden=false;
    render();
  }catch(error){
    accessToken='';
    if(rememberedToken){localStorage.removeItem(TOKEN_STORAGE_KEY);remember.checked=false}
    setLoginMessage(error.message||'관리자 연결에 실패했어요.');
  }finally{button.disabled=false}
}

function disconnect(){
  accessToken='';fileSha='';originalOverrides={};draftOverrides={};originalCustomCollections=[];draftCustomCollections=[];
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  document.querySelector('#remember-token').checked=false;
  document.querySelector('#editor').hidden=true;
  document.querySelector('#login-panel').hidden=false;
  setLoginMessage('연결을 해제했어요.',true);
}

function card(item){
  const id=itemId(item),current=effectiveCategory(item),changed=isChanged(item);
  const options=categoryOptions().map(category=>`<option value="${escapeHtml(category)}" ${current===category?'selected':''}>${escapeHtml(category)}</option>`).join('');
  return `<article class="admin-card ${changed?'changed':''}" data-id="${id}">
    <a class="admin-thumb" href="${item.u}" target="_blank" rel="noopener"><img src="${item.m}" alt="" loading="lazy" referrerpolicy="no-referrer"><b>#${id}</b></a>
    <div class="admin-card-body"><span class="admin-shop">${escapeHtml(item.s)}</span><h3 class="admin-title">${escapeHtml(item.t)}</h3>
      <label class="category-control"><span>컬렉션</span><select data-category-id="${id}" aria-label="${escapeHtml(item.t)} 카테고리">${options}</select></label>
    </div>
  </article>`;
}

function visibleItems(){
  const normalized=query.trim().toLowerCase();
  return items.filter(item=>{
    if(categoryFilter&&effectiveCategory(item)!==categoryFilter)return false;
    if(changedOnly&&!isChanged(item))return false;
    if(normalized&&!`${item.t} ${item.s} ${itemId(item)}`.toLowerCase().includes(normalized))return false;
    return true;
  });
}

function render(){
  const visible=visibleItems();
  const changedCount=items.filter(isChanged).length;
  const customChanged=collectionsChanged();
  const grid=document.querySelector('#admin-grid');
  grid.innerHTML=visible.map(card).join('');
  document.querySelector('#admin-count').textContent=visible.length.toLocaleString('ko-KR');
  document.querySelector('#changed-count').textContent=changedCount.toLocaleString('ko-KR');
  document.querySelector('#dock-count').textContent=changedCount?`${changedCount}개 상품 변경됨`:customChanged?'컬렉션 구성 변경됨':'변경 사항 없음';
  document.querySelector('#save-collections').disabled=!hasPendingChanges();
  document.querySelector('#admin-empty').hidden=visible.length!==0;
  renderCustomCollections();
  refreshCategoryFilter();
}

function refreshCategoryFilter(){
  const select=document.querySelector('#admin-category');
  const available=categoryOptions();
  const value=available.includes(categoryFilter)?categoryFilter:'';
  select.innerHTML='<option value="">모든 카테고리</option>';
  available.forEach(category=>select.add(new Option(category,category)));
  categoryFilter=value;select.value=value;
}

function renderCustomCollections(){
  const root=document.querySelector('#custom-collections');
  root.innerHTML=draftCustomCollections.map(name=>{
    const count=items.filter(item=>effectiveCategory(item)===name).length;
    return`<span class="custom-chip"><span>${escapeHtml(name)}</span><b>${count}</b><button type="button" data-delete-collection="${escapeHtml(name)}" aria-label="${escapeHtml(name)} 삭제">×</button></span>`;
  }).join('');
}

function addCollection(){
  const input=document.querySelector('#collection-name');
  const name=input.value.trim().replace(/\s+/g,' ');
  if(!name){toast('컬렉션 이름을 입력해 주세요.',true);return}
  if(RESERVED_COLLECTION_NAMES.includes(name)){toast('메뉴에서 사용 중인 이름이라 다른 이름이 필요해요.',true);return}
  if(categoryOptions().some(existing=>existing.toLowerCase()===name.toLowerCase())){toast('이미 같은 이름의 컬렉션이 있어요.',true);return}
  draftCustomCollections.push(name);input.value='';render();
  toast(`‘${name}’ 컬렉션을 추가했어요. 저장해야 공개 옷장에 반영됩니다.`);
}

function deleteCollection(name){
  const count=items.filter(item=>effectiveCategory(item)===name).length;
  if(count){toast(`‘${name}’에 상품 ${count}개가 있어요. 먼저 다른 컬렉션으로 옮겨주세요.`,true);return}
  draftCustomCollections=draftCustomCollections.filter(collection=>collection!==name);
  if(categoryFilter===name)categoryFilter='';
  render();
}

function changeCategory(id,category){
  const item=items.find(candidate=>itemId(candidate)===id);
  if(!item)return;
  if(category===baseCategoryOf(item))delete draftOverrides[id];else draftOverrides[id]=category;
  render();
}

async function save(){
  if(!accessToken){toast('관리자 연결이 끊겼어요. 다시 연결해 주세요.',true);disconnect();return}
  const changedCount=items.filter(isChanged).length;
  if(!hasPendingChanges())return;
  const button=document.querySelector('#save-collections');
  button.disabled=true;button.textContent='저장 중…';
  try{
    const content=`${JSON.stringify({customCollections:draftCustomCollections,assignments:draftOverrides},null,2)}\n`;
    const result=await github(`/repos/${REPOSITORY}/contents/${COLLECTION_FILE}`,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:`Update wardrobe collections (${changedCount} item changes)`,content:encodeBase64(content),sha:fileSha,branch:'main'})
    });
    fileSha=result.content.sha;
    originalOverrides={...draftOverrides};
    originalCustomCollections=[...draftCustomCollections];
    render();
    toast('저장했어요. 공개 옷장에는 보통 1~2분 안에 반영됩니다.');
  }catch(error){toast(error.message||'저장하지 못했어요.',true)}
  finally{button.textContent='컬렉션 저장';button.disabled=!hasPendingChanges()}
}

function bind(){
  document.querySelector('#connect').onclick=()=>connect();
  document.querySelector('#github-token').onkeydown=event=>{if(event.key==='Enter')connect()};
  document.querySelector('#disconnect').onclick=disconnect;
  document.querySelector('#admin-search').oninput=event=>{query=event.target.value;render()};
  document.querySelector('#admin-category').onchange=event=>{categoryFilter=event.target.value;render()};
  document.querySelector('#changed-only').onchange=event=>{changedOnly=event.target.checked;render()};
  document.querySelector('#admin-grid').onchange=event=>{if(event.target.matches('[data-category-id]'))changeCategory(event.target.dataset.categoryId,event.target.value)};
  document.querySelector('#collection-form').onsubmit=event=>{event.preventDefault();addCollection()};
  document.querySelector('#custom-collections').onclick=event=>{const button=event.target.closest('[data-delete-collection]');if(button)deleteCollection(button.dataset.deleteCollection)};
  document.querySelector('#save-collections').onclick=save;
}

async function init(){
  refreshCategoryFilter();
  bind();
  try{
    items=await loadItems();
    const rememberedToken=localStorage.getItem(TOKEN_STORAGE_KEY)||'';
    if(rememberedToken){
      document.querySelector('#remember-token').checked=true;
      setLoginMessage('저장된 토큰으로 연결하고 있어요…',true);
      await connect(rememberedToken);
    }
  }catch(error){setLoginMessage('상품 데이터를 불러오지 못했어요.');document.querySelector('#connect').disabled=true}
}

init();
