const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const samples=[{i:0,u:'https://example.test/items/101',t:'Visible',s:'Shop A',c:'의상',g:true},{i:1,u:'https://example.test/items/202',t:'Hidden',s:'Shop B',c:'아바타',a:['Private'],g:true}];
function setup(source){
  const elements=new Map();
  const el=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',classList:{toggle(){},add(){},remove(){}},add(){},querySelectorAll:()=>[]});return elements.get(id)};
  const ctx=vm.createContext({console,TextEncoder,TextDecoder,atob,btoa,Uint8Array,Blob,Response,DecompressionStream,window:{},setTimeout:()=>1,clearTimeout(){},Option:function(){},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{querySelector:el,querySelectorAll:()=>[]},fixture:structuredClone(samples)});
  const run=s=>vm.runInContext(s,ctx);run(source);return{run,ctx,el};
}
(async()=>{
  const a=setup(fs.readFileSync(__dirname+'/admin.js','utf8').replace(/init\(\);\s*$/,''));
  a.run('items=fixture');
  assert.equal(a.run('normalizeConfig({"101":"헤어"}).assignments["101"]'),'헤어');
  assert.equal(a.run('normalizeConfig({assignments:{}}).hiddenItems.length'),0);
  a.run('changeVisibility("202","private")');
  assert.equal(a.run('hasPendingChanges()'),true);
  assert.match(a.run('card(items[1])'),/value="private" selected/);
  a.run('visibilityFilter="private"');assert.equal(a.run('visibleItems().length'),1);
  a.run('visibilityFilter="public"');assert.equal(a.run('visibleItems()[0].t'),'Visible');
  a.run('visibilityFilter="";changedOnly=true');assert.equal(a.run('visibleItems().length'),1);
  a.run('accessToken="test-only";fileSha="old";configExtras={extra:"keep"};draftOverrides={"101":"Summer"};draftCustomCollections=["Summer"];github=async(p,o)=>{window.saved=JSON.parse(decodeBase64(JSON.parse(o.body).content));return {content:{sha:"new"}}}');
  await a.run('save()');
  assert.equal(a.ctx.window.saved.hiddenItems[0],'202');assert.equal(a.ctx.window.saved.extra,'keep');assert.equal(a.ctx.window.saved.assignments['101'],'Summer');assert.equal(a.run('hasPendingChanges()'),false);
  a.run('changeVisibility("202","public");github=async()=>{throw new Error("409 conflict")}');await a.run('save()');
  assert.equal(a.run('hasPendingChanges()'),true);assert.equal(a.run('originalHiddenItems.has("202")'),true);
  a.run('github=async()=>({content:{sha:"restored"}})');await a.run('save()');assert.equal(a.run('originalHiddenItems.size'),0);
  a.run('changeVisibility("101","private");github=async()=>new Promise(resolve=>window.finish=resolve)');const pending=a.run('save()');
  a.run('changeVisibility("202","private");window.finish({content:{sha:"snapshot"}})');await pending;
  assert.equal(a.run('originalHiddenItems.has("101")'),true);assert.equal(a.run('originalHiddenItems.has("202")'),false);assert.equal(a.run('hasPendingChanges()'),true);
  a.run('github=async(p)=>p==="/user"?{login:"yaom0728"}:{sha:"reload",content:encodeBase64(JSON.stringify({assignments:{"101":"Summer"},customCollections:["Summer"],hiddenItems:["202"]}))}');await a.run('connect("test-only")');
  assert.equal(a.run('draftHiddenItems.has("202")'),true);assert.equal(a.run('effectiveCategory(items[0])'),'Summer');assert.equal(a.run('hasPendingChanges()'),false);
  const src=fs.readFileSync(__dirname+'/app.js','utf8'),split=src.indexOf('Promise.all([loadData()');
  async function publicView(config){const p=setup(src.slice(0,split));p.ctx.config=config;p.run('loadData=async()=>fixture;loadOverrides=async()=>config;init=items=>window.visible=items');await p.run(src.slice(split));return p}
  const p=await publicView({assignments:{},hiddenItems:['202']});assert.equal(p.ctx.window.visible.length,1);
  p.run('window.visible.forEach(x=>x.category=categoryOf(x));state.favorites=new Set(["101","202"]);drawNav(window.visible)');
  assert.equal(p.el('#favorite-count').textContent,1);assert.equal(p.el('#gift-count').textContent,1);assert.equal(p.el('#avatar-nav').innerHTML.includes('Private'),false);
  p.run('state.query="Hidden"');assert.equal(p.run('filteredItems(window.visible).length'),0);
  assert.equal((await publicView({'101':'헤어'})).ctx.window.visible.length,2);
  assert.equal((await publicView({assignments:{},hiddenItems:[101,202]})).ctx.window.visible.length,0);
  assert.equal((await publicView({assignments:{},hiddenItems:['999']})).ctx.window.visible.length,2);
  console.log('PASS: visibility, filters, save/reload, restore, conflict, concurrent edits, public counts/search, legacy and all-hidden cases');
})().catch(e=>{console.error(e);process.exitCode=1});
