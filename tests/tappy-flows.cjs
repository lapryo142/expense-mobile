// Run: node tests/tappy-flows.cjs (requires Playwright in the runtime).
// All API responses are fixtures. This suite never touches live financial data.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const mock=String.raw`
window.fixture={inserts:[],reads:[],statuses:[],fail:false,delay:0,session:true,rows:[
{id:'1',user_id:'fixture',year:2026,month:10,txn_date:'2026-10-20',description:'Cà phê',expense:50000,income:0,source:'app'},
{id:'2',user_id:'fixture',year:2026,month:10,txn_date:'2026-10-21',description:'Tennis',expense:250000,income:0,source:'app'},
{id:'3',user_id:'fixture',year:2026,month:10,txn_date:'2026-10-21',description:'Lương',expense:0,income:24000000,source:'app'},
{id:'4',user_id:'fixture',year:2026,month:9,txn_date:'2026-09-20',description:'Ăn trưa',expense:70000,income:0,source:'app'}]};
const fixtureUser={id:'fixture',user_metadata:{happy_money_categories:{}}};
window.supabase={createClient:()=>({auth:{
 getSession:async()=>({data:{session:fixture.session?{user:fixtureUser}:null}}),
 updateUser:async({data})=>{Object.assign(fixtureUser.user_metadata,data);return {data:{user:fixtureUser}}},
 signInWithPassword:async()=>({data:{user:fixtureUser,session:{user:fixtureUser}}}),
 signOut:async()=>({error:null})
},async rpc(name,p){
 if(fixture.failBalance)return {data:null,error:{message:'Fixture balance failure'}};
 let row=fixture.statuses.find(s=>s.year===p.p_year&&s.month===p.p_month);
 if(name==='initialize_balance_checkpoint'){
  const expected=row?{bank_balance:Number(row.bank_balance||0),savings_balance:Number(row.savings_balance||0),bank_balance_date:row.bank_balance_date||null,savings_balance_date:row.savings_balance_date||null,balance_checkpoint:row.balance_checkpoint||null}:null;
  const match=JSON.stringify(expected)===JSON.stringify(p.p_expected);if(match)row.balance_checkpoint=structuredClone(p.p_checkpoint);return {data:match,error:null};
 }
 if(name==='reconcile_month_balance'){
  if(!row){row={id:'status-'+p.p_year+'-'+p.p_month,user_id:'fixture',year:p.p_year,month:p.p_month,bank_balance:0,savings_balance:0,start_balance:0};fixture.statuses.push(row)}
  row[p.p_kind]=p.p_amount;if(p.p_kind!=='start_balance')row[p.p_kind+'_date']=p.p_date;
  const key={bank_balance:'bank',savings_balance:'savings',start_balance:'start'}[p.p_kind];if(key)row.balance_checkpoint={...(row.balance_checkpoint||{}),[key]:{date:p.p_date,amount:p.p_amount,basis:p.p_basis}};return {data:null,error:null};
 }
 return {data:null,error:{message:'Unknown fixture RPC'}};
},from(table){
 const state={table,filters:[],start:0,end:Infinity,op:'select',one:false};
 const query={select(){return query},eq(k,v){state.filters.push(r=>r[k]===v);return query},gte(k,v){state.filters.push(r=>r[k]>=v);return query},lt(k,v){state.filters.push(r=>r[k]<v);return query},order(){return query},range(a,b){state.start=a;state.end=b;return query},maybeSingle(){state.one=true;return query},single(){state.one=true;return query},
 insert(payload){state.op='insert';state.payload=payload;return query},update(payload){state.op='update';state.payload=payload;return query},
 then(resolve,reject){return (async()=>{
 if(state.op==='insert'){
  fixture.inserts.push(state.payload);await new Promise(r=>setTimeout(r,fixture.delay));
  if(fixture.fail)return {data:null,error:{message:'Fixture network error'}};
  const row={created_at:new Date().toISOString(),...state.payload,id:String(100+fixture.inserts.length)};fixture.rows.push(row);return {data:row,error:null};
 }
 if(state.op==='update'){if(fixture.fail)return {data:null,error:{message:'Fixture update error'}};const matched=fixture.rows.filter(row=>state.filters.every(fn=>fn(row)));matched.forEach(row=>Object.assign(row,state.payload));return {data:matched,error:null}}
 fixture.reads.push({table,start:state.start,end:state.end});
 let rows=table==='transactions'?fixture.rows:table==='monthly_status'?fixture.statuses:[];rows=rows.filter(r=>state.filters.every(fn=>fn(r))).slice(state.start,state.end===Infinity?undefined:state.end+1);
 return {data:state.one?(rows[0]||null):rows,error:null};
 })().then(resolve,reject)}
 };return query;
}})};
`;
async function boot(browser,{width=390,height=844,date='2026-10-28T10:00:00+07:00',session=true,url='https://happy.test/'}={}){
 const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'Asia/Ho_Chi_Minh',acceptDownloads:true});
 await page.clock.setFixedTime(new Date(date));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
 await page.route('**/*',async route=>{
  if(route.request().url().includes('cdn.jsdelivr.net'))return route.fulfill({contentType:'text/javascript',body:mock.replace('session:true','session:'+session)});
  const scriptName=new URL(route.request().url()).pathname.slice(1);if(['balance-engine.js','annual-stats.js','i18n.js'].includes(scriptName))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(require('node:path').join(__dirname,'../'+scriptName),'utf8')});
  if(route.request().url().startsWith('https://happy.test/'))return route.fulfill({contentType:'text/html',body:html});
  await route.abort();
 });
 await page.goto(url);await page.locator(session?'#app':'#auth').waitFor({state:'visible'});
 return {page,errors};
}
(async()=>{
 for(const engine of [chromium,webkit]){
  let browser;try{browser=await engine.launch({headless:true,...(engine===chromium&&process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}: {})})}catch(e){if(engine===webkit){console.log('WebKit unavailable:',e.message.split('\n')[0]);continue}throw e}
  const {page,errors}=await boot(browser);
  await page.locator('#addBtn').click();assert.equal(await page.locator('#amount').evaluate(e=>e===document.activeElement),true);
  assert.equal(await page.locator('#saveTx').isVisible(),true);assert.equal(await page.locator('#saveTx').isEnabled(),false);
  for(const key of ['5','0','0','0','0'])await page.locator(`#keypad [data-key="${key}"]`).click();await page.locator('#keypad [data-key="backspace"]').click();await page.locator('#keypad [data-key="0"]').click();assert.equal(await page.locator('#amount').inputValue(),'50.000');
  await page.locator('#quickExpense [data-category="Ăn uống"]').click();await page.locator('#yesterdayBtn').click();
  assert.equal(await page.locator('#date').inputValue(),'2026-10-27');assert.equal(await page.locator('#yesterdayBtn').getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>fixture.delay=200);
  await page.evaluate(()=>{document.getElementById('saveTx').click();document.getElementById('saveTx').click()});
  await page.locator('#addOverlay').waitFor({state:'hidden'});
  const inserts=await page.evaluate(()=>fixture.inserts);assert.equal(inserts.length,1);assert.equal(inserts[0].description,'Ăn uống');assert.equal(inserts[0].expense,50000);assert.equal(inserts[0].income,0);assert.equal(inserts[0].payment_method,'bank');
  await page.locator('.tx').first().click();await page.locator('#editTxOverlay').waitFor({state:'visible'});await page.locator('#closeEditTx').click();
  await page.locator('#statsTab').click();assert.equal(await page.locator('#statsTab').getAttribute('aria-current'),'page');await page.locator('[data-chart-category="Tennis"]').click();assert.equal(await page.locator('#categoryPageTitle').innerText(),'Tennis');assert.match(await page.locator('.categoryResultAmount').innerText(),/250\.000/);assert.equal(await page.locator('#categoryOverlay').isVisible(),true);await page.locator('#categoryBack').click();assert.equal(await page.locator('#categoryOverlay').isVisible(),false);
  assert.match(await page.locator('#overviewStats').innerText(),/Dự tính cuối tháng/);
  await page.locator('#historyTab').click();await page.locator('#summaryOverlay').waitFor({state:'hidden'});await page.locator('#addBtn').click();assert.equal(await page.locator('#addBtn').getAttribute('aria-current'),'page');await page.locator('#incomeType').click();assert.equal(await page.locator('#quickExpense').isVisible(),false);assert.equal(await page.locator('#quickIncome').isVisible(),true);
  await page.locator('#quickIncome [data-name="Lương"]').click();await page.locator('#amount').fill('24000000');await page.locator('#saveTx').click();await page.locator('#addOverlay').waitFor({state:'hidden'});
  const income=await page.evaluate(()=>fixture.inserts.at(-1));assert.equal(income.income,24000000);assert.equal(income.expense,0);assert.equal(income.payment_method,null);
  // Failure retains entered data and makes retry possible.
  await page.locator('#addBtn').click();await page.locator('#amount').fill('100000');await page.locator('#quickExpense [data-category="Dịch vụ số"]').click();await page.evaluate(()=>fixture.fail=true);await page.locator('#saveTx').click();await page.waitForFunction(()=>document.getElementById('entryError').textContent.includes('Fixture network error'));
  assert.equal(await page.locator('#amount').inputValue(),'100.000');assert.equal(await page.locator('#saveTx').isEnabled(),true);await page.locator('#historyTab').click();
  // Export >500 entries and exclude another month plus tombstones.
  await page.evaluate(()=>{fixture.rows=Array.from({length:650},(_,i)=>({id:'csv-'+i,user_id:'fixture',year:2026,month:10,txn_date:'2026-10-01',description:i===0?'=HYPERLINK("bad")':'Fixture '+i,income:0,expense:1,source:'app'}));fixture.rows.push({id:'other',user_id:'fixture',year:2026,month:9,txn_date:'2026-09-01',description:'OUTSIDE',expense:1,source:'app'},{id:'deleted',user_id:'fixture',year:2026,month:10,description:'',expense:0,income:0,source:'app_edited'})});
  await page.locator('#statsTab').click();await page.locator('#summaryOverlay .settingsOpen').click();await page.locator('#exportRange').selectOption('selected');
  const downloadPromise=page.waitForEvent('download');await page.locator('#exportBtn').click();const download=await downloadPromise;const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const csv=Buffer.concat(chunks).toString('utf8');
  assert.equal(csv.trim().split('\r\n').length,651);assert.equal(csv.includes('OUTSIDE'),false);assert.equal(csv.includes("\"'=HYPERLINK"),true);
  assert.match(download.suggestedFilename(),/2026-10/);assert.deepEqual(errors,[]);
  await page.close();
  // Deep links work with existing sessions and after login. Date rollover uses local calendar.
  for(const session of [true,false]){
   const {page:p,errors:e}=await boot(browser,{date:'2026-03-01T00:30:00+07:00',session,url:'https://happy.test/?action=add'});
   if(!session){await p.locator('#email').fill('fixture@example.test');await p.locator('#password').fill('fixture-password');await p.locator('#loginBtn').click()}
   await p.locator('#addOverlay').waitFor({state:'visible'});await p.locator('#yesterdayBtn').click();assert.equal(await p.locator('#date').inputValue(),'2026-02-28');assert.equal(new URL(p.url()).searchParams.has('action'),false);assert.deepEqual(e,[]);await p.close();
  }
  // Keypad respects the caret/selection instead of always modifying the last digit.
  {
   const {page:p}=await boot(browser);await p.locator('#addBtn').click();await p.locator('#amount').fill('12345');
   await p.locator('#amount').evaluate(e=>{e.focus();e.setSelectionRange(2,2)});await p.locator('#keypad [data-key="9"]').click();assert.equal(await p.locator('#amount').inputValue(),'129.345');
   await p.locator('#amount').evaluate(e=>e.setSelectionRange(0,3));await p.locator('#keypad [data-key="7"]').click();assert.equal(await p.locator('#amount').inputValue(),'7.345');
   await p.locator('#amount').evaluate(e=>e.setSelectionRange(2,2));await p.locator('#keypad [data-key="backspace"]').click();assert.equal(await p.locator('#amount').inputValue(),'345');
   await p.locator('#amount').evaluate(e=>e.setSelectionRange(0,0));await p.locator('#keypad [data-key="backspace"]').click();assert.equal(await p.locator('#amount').inputValue(),'345');
   await p.locator('#amount').evaluate(e=>{e.value='12345';e.setSelectionRange(2,2);e.dispatchEvent(new Event('input'))});assert.equal(await p.locator('#amount').inputValue(),'12.345');assert.equal(await p.locator('#amount').evaluate(e=>e.selectionStart),2);
   // Native horizontal swipes must not trigger the panel's pull-to-close gesture.
   await p.locator('#quickExpense').evaluate(e=>{e.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[new Touch({identifier:1,target:e,clientX:280,clientY:250})]}));e.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[new Touch({identifier:1,target:e,clientX:50,clientY:275})]}));e.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[]}))});
   assert.equal(await p.locator('#addOverlay .formPanel').evaluate(e=>e.style.transform),'');
   const chip=await p.locator('#quickExpense button').first().boundingBox();assert.ok(chip.height>=44);
   if(engine===chromium){const cdp=await p.context().newCDPSession(p);const box=await p.locator('#quickExpense').boundingBox();const y=box.y+box.height/2;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y}]});for(const x of [260,210,160,110,60])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForFunction(()=>document.getElementById('quickExpense').scrollLeft>30);assert.equal(await p.locator('#addOverlay').isVisible(),true)}
   await p.locator('#historyTab').click();await p.locator('#app .settingsOpen').click();await p.locator('#settingsOverlay .themeToggle').click();await p.locator('#settingsBack').click();await p.locator('#addBtn').click();assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),'light');
   await p.screenshot({path:'/tmp/happy-light-entry.png'});await p.locator('#statsTab').click();await p.waitForFunction(()=>document.querySelector('.comparisonTable'));assert.equal(await p.locator('.comparisonTable').isVisible(),true);assert.match(await p.locator('#overviewDetails').innerText(),/cùng kỳ/);await p.screenshot({path:'/tmp/happy-light-stats.png'});
   await p.reload();await p.locator('#app').waitFor({state:'visible'});assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),'light');assert.equal(await p.locator('meta[name="theme-color"]').getAttribute('content'),'#f7f7f3');await p.locator('#app .settingsOpen').click();await p.locator('#settingsOverlay .themeToggle').click();assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),'dark');await p.close();
  }
  // Revised capture: dedicated dates, pay-later toggle, note keyboard mode, haptics and category pages.
  {
   const {page:p,errors:e}=await boot(browser);
   assert.match(await p.locator('#historyTotal').innerText(),/300\.000/);
   await p.locator('#addBtn').click();assert.equal(await p.locator('#closeAdd').isVisible(),false);assert.equal(await p.getByText('Ghi giao dịch',{exact:true}).isVisible(),false);
   assert.equal(await p.locator('#todayBtn').isVisible(),true);assert.equal(await p.locator('#yesterdayBtn').isVisible(),true);assert.equal(await p.locator('#datePickText').innerText(),'Chọn ngày');assert.equal(await p.locator('#amount').evaluate(e=>getComputedStyle(e).caretColor),'rgba(0, 0, 0, 0)');
   assert.ok(await p.locator('#keypad [data-key="1"]').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>=28);
   await p.evaluate(()=>{window.vibrationCalls=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:n=>{vibrationCalls.push(n);return true}})});
   await p.locator('#keypad [data-key="5"]').click();await p.locator('#keypad [data-key="000"]').click();assert.equal(await p.evaluate(()=>vibrationCalls.length),2);
   await p.evaluate(()=>{Object.defineProperty(navigator,'vibrate',{configurable:true,value:undefined});Object.defineProperty(document.getElementById('hapticSwitch'),'switch',{configurable:true,value:true})});
   const before=await p.locator('#hapticSwitch').isChecked();await p.locator('#keypad [data-key="0"]').click();assert.equal(await p.locator('#hapticSwitch').isChecked(),!before);
   await p.locator('#quickExpense [data-category="Ăn uống"]').click();await p.locator('#payLaterToggle').click();assert.equal(await p.locator('#payLaterToggle').getAttribute('aria-pressed'),'true');
   await p.locator('#desc').focus();await p.locator('#desc').fill('Cà phê ghi chú dài kiểm tra bố cục');assert.equal(await p.locator('#keypad').isVisible(),false);assert.ok(await p.locator('#desc').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>=16);
   await p.setViewportSize({width:390,height:430});await p.locator('#saveTx').scrollIntoViewIfNeeded();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await p.locator('#addOverlay .formPanel').evaluate(e=>e.scrollWidth<=e.clientWidth),true);await p.screenshot({path:'/tmp/happy-note-keyboard.png'});
   await p.locator('#amount').focus();await p.setViewportSize({width:390,height:844});await p.locator('#keypad').waitFor({state:'visible'});assert.equal(await p.locator('#desc').inputValue(),'Cà phê ghi chú dài kiểm tra bố cục');
   await p.locator('#desc').focus();await p.locator('#saveTx').click();await p.locator('#addOverlay').waitFor({state:'hidden'});assert.equal(await p.evaluate(()=>fixture.inserts.at(-1).payment_method),'pay_later');assert.equal(await p.evaluate(()=>fixture.inserts.at(-1).description),'Cà phê ghi chú dài kiểm tra bố cục');
   await p.locator('#statsTab').click();assert.equal(await p.locator('#categoryToggle').count(),0);await p.locator('[data-chart-category="Tennis"]').click();await p.locator('#categoryOverlay').waitFor({state:'visible'});await p.screenshot({path:'/tmp/happy-category-page.png'});
   await p.locator('#categoryResult [data-category-tx-id]').first().click();await p.locator('#editTxOverlay').waitFor({state:'visible'});assert.ok(await p.locator('#editTxOverlay').evaluate(e=>Number(getComputedStyle(e).zIndex))>await p.locator('#categoryOverlay').evaluate(e=>Number(getComputedStyle(e).zIndex)));await p.locator('#closeEditTx').click();await p.locator('#categoryBack').click();assert.equal(await p.locator('.comparisonTable').isVisible(),true);assert.deepEqual(e,[]);await p.close();
  }
  // Screenshot alignment: settings consolidation, inline notes, edge navigation and total placement.
  {
   const {page:p,errors:e}=await boot(browser);
   assert.equal(await p.locator('#refreshBtn').isVisible(),false);assert.equal(await p.locator('#app .themeToggle').count(),0);
   assert.equal(await p.evaluate(()=>Boolean(document.getElementById('list').compareDocumentPosition(document.querySelector('.historySummary'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
   await p.locator('#app .settingsOpen').click();await p.locator('#settingsOverlay').waitFor({state:'visible'});assert.equal(await p.locator('#exportBtn').isVisible(),true);assert.equal(await p.locator('#enablePasskeyBtn').isVisible(),true);assert.equal(await p.locator('#privacyBtn').isVisible(),true);assert.equal(await p.locator('#settingsOverlay .themeToggle').isVisible(),true);await p.screenshot({path:'/tmp/happy-settings.png'});await p.locator('#settingsBack').click();
   await p.locator('#addBtn').click();await p.locator('#amount').fill('100000');await p.locator('#quickExpense [data-category="Ăn uống"]').click();await p.locator('#desc').fill('Gửi Ba');assert.equal(await p.locator('#keypad').isVisible(),false);assert.equal(await p.locator('#amount').isVisible(),true);assert.equal(await p.locator('#quickExpense').isVisible(),true);assert.equal(await p.locator('#todayBtn').isVisible(),true);assert.equal(await p.locator('#desc').evaluate(e=>getComputedStyle(e).borderRadius),'0px');assert.equal(await p.locator('#desc').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');await p.setViewportSize({width:390,height:430});await p.screenshot({path:'/tmp/happy-inline-note.png'});await p.locator('#amount').focus();await p.setViewportSize({width:390,height:844});await p.locator('#statsTab').click();
   await p.waitForFunction(()=>document.querySelector('.comparisonTable'));assert.equal(await p.locator('#closeSummary').isVisible(),false);assert.equal(await p.locator('#summaryOverlay #exportBtn').count(),0);assert.ok(await p.locator('.paceSummary').evaluate(e=>e.getBoundingClientRect().height)<70);await p.locator('#summaryOverlay .settingsOpen').click();await p.locator('#settingsBack').click();
   await p.locator('[data-chart-category="Tennis"]').click();assert.equal(await p.locator('#categoryPageTitle').innerText(),'Tennis');assert.equal((await p.locator('#categoryResult').innerText()).includes('so sánh'),false);assert.equal(await p.locator('#bottom').isVisible(),false);
   const gesture=async(startX,dx,dy)=>p.locator('.categoryPanel').evaluate((target,{startX,dx,dy})=>{target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[new Touch({identifier:1,target,clientX:startX,clientY:300})]}));target.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[new Touch({identifier:1,target,clientX:startX+dx,clientY:300+dy})]}));target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[]}))},{startX,dx,dy});
   await gesture(100,140,2);assert.equal(await p.locator('#categoryOverlay').isVisible(),true);await gesture(6,15,110);assert.equal(await p.locator('#categoryOverlay').isVisible(),true);await gesture(6,140,8);await p.locator('#categoryOverlay').waitFor({state:'hidden'});await p.waitForFunction(()=>!history.state?.hmCategory);assert.equal(await p.locator('#summaryOverlay').isVisible(),true);
   await p.locator('[data-chart-category="Tennis"]').click();await p.goBack();await p.locator('#categoryOverlay').waitFor({state:'hidden'});assert.equal(await p.locator('#summaryOverlay').isVisible(),true);await p.goForward();await p.locator('#categoryOverlay').waitFor({state:'visible'});assert.equal(await p.locator('#categoryPageTitle').innerText(),'Tennis');assert.deepEqual(e,[]);await p.close();
  }
  // Category preferences: add, emoji, ordering, persistence, and use in real edit payloads.
  {
   const {page:p,errors:e}=await boot(browser);
   assert.equal(await p.locator('#historyTab span').innerText(),'Chi tiêu');assert.match(await p.locator('.tx[data-tx-id="2"] .txAmt').innerText(),/^₫ /);assert.equal((await p.locator('.tx[data-tx-id="2"] .txAmt').innerText()).startsWith('-'),false);
   await p.locator('#app .settingsOpen').click();await p.locator('.catalogRow').first().waitFor({state:'visible'});const initial=await p.locator('.catalogName').allTextContents();assert.equal(initial.length,11);
   await p.locator('#addCategoryBtn').click();assert.equal(await p.locator('#saveCatalogCategory').isEnabled(),false);await p.locator('#newCategoryName').fill('Cà phê');await p.locator('#categoryEmojiButton').click();await p.locator('#emojiPresets [data-emoji="☕"]').click();await p.locator('#categoryColorChoices [data-color="#48c6bc"]').click();await p.screenshot({path:'/tmp/happy-add-category.png'});await p.locator('#saveCatalogCategory').click();await p.waitForFunction(()=>document.getElementById('catalogStatus').textContent==='Đã lưu danh mục.');
   let record=await p.evaluate(()=>JSON.parse(localStorage.getItem('happy_money_category_catalog_fixture')));const custom=record.items.find(x=>x.name==='Cà phê');assert.ok(custom?.id);assert.equal(record.items.length,12);
   await p.locator(`[data-edit-id="${custom.id}"]`).click();await p.locator('#categoryEmojiButton').click();await p.locator('#customCategoryEmoji').fill('🌈');await p.locator('#saveCategoryEmoji').click();await p.screenshot({path:'/tmp/happy-edit-category.png'});await p.locator('#saveCatalogCategory').click();await p.waitForFunction(()=>document.getElementById('catalogStatus').textContent==='Đã lưu danh mục.');
   await p.locator(`[data-drag-id="${custom.id}"]`).press('ArrowUp');await p.waitForFunction(()=>document.getElementById('catalogStatus').textContent==='Đã lưu danh mục.');record=await p.evaluate(()=>JSON.parse(localStorage.getItem('happy_money_category_catalog_fixture')));assert.equal(record.items.at(-2).name,'Cà phê');assert.equal(record.items.at(-2).emoji,'🌈');
   await p.locator('.settingsPanel').evaluate(el=>el.scrollTop=0);const firstName=record.items[0].name;const handle=await p.locator('[data-drag-id="default-0"]').boundingBox(),third=await p.locator('.catalogRow').nth(2).boundingBox();await p.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await p.mouse.down();await p.mouse.move(handle.x+handle.width/2,third.y+third.height-3,{steps:6});await p.mouse.up();await p.waitForFunction(()=>document.getElementById('catalogStatus').textContent==='Đã lưu danh mục.');record=await p.evaluate(()=>JSON.parse(localStorage.getItem('happy_money_category_catalog_fixture')));assert.equal(record.items[2].name,firstName);
   const order=record.items.map(x=>x.name);await p.screenshot({path:'/tmp/happy-category-manager.png'});await p.locator('#settingsBack').click();await p.reload();await p.locator('#app').waitFor({state:'visible'});
   await p.locator('#addBtn').click();assert.deepEqual(await p.locator('#quickExpense .categoryText').allTextContents(),order);assert.match(await p.locator('#quickExpense [data-category="Cà phê"]').innerText(),/🌈/);assert.equal(await p.locator('#cashToggle').count(),0);assert.equal(await p.locator('#desc').getAttribute('placeholder'),'Ghi chú');assert.equal(await p.locator('#addOverlay .currencyMark').innerText(),'₫');await p.locator('#historyTab').click();
   await p.locator('.tx[data-tx-id="2"]').click();await p.locator('#editTxOverlay').waitFor({state:'visible'});assert.equal(await p.locator('#editTxAmount').getAttribute('inputmode'),'numeric');await p.locator('#editTxAmount').fill('300000');assert.equal(await p.locator('#editTxAmount').inputValue(),'300000');await p.locator('#editCategoryChips [data-edit-category="Cà phê"]').click();await p.locator('#editTxDate').fill('2026-10-27');await p.locator('#editTxDate').dispatchEvent('change');await p.locator('#editPayLaterToggle').click();await p.screenshot({path:'/tmp/happy-edit-tappy.png'});
   await p.locator('#editTxName').fill('Cà phê sửa thử');assert.equal(await p.locator('#editKeypad').isVisible(),false);await p.locator('#saveEditTx').click();await p.locator('#editTxOverlay').waitFor({state:'hidden'});const changed=await p.evaluate(()=>fixture.rows.find(x=>x.id==='2'));assert.equal(changed.expense,300000);assert.equal(changed.income,0);assert.equal(changed.description,'Cà phê sửa thử');assert.equal(changed.payment_method,'pay_later');assert.equal(changed.txn_date,'2026-10-27');assert.match(await p.locator('.tx[data-tx-id="2"]').innerText(),/Cà phê/);
   await p.locator('#statsTab').click();await p.waitForFunction(()=>document.querySelector('.comparisonTable'));assert.match(await p.locator('#overviewStats').innerText(),/Chi trung bình/);assert.equal((await p.locator('#overviewStats').innerText()).includes('CÒN LẠI THEO SỔ'),false);assert.equal(await p.locator('.payLaterOverview').evaluate(el=>el.classList.contains('wide')),false);
   const swipe=async(selector)=>{await p.locator(selector).evaluate(target=>{target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[new Touch({identifier:1,target,clientX:5,clientY:280})]}));target.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[new Touch({identifier:1,target,clientX:145,clientY:285})]}));target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[]}))})};
   await p.locator('#summaryOverlay .settingsOpen').click();assert.equal(await p.locator('#catalogList').isVisible(),true);await swipe('.settingsPanel');await p.locator('#settingsOverlay').waitFor({state:'hidden'});assert.equal(await p.locator('#summaryOverlay').isVisible(),true);assert.equal(await p.locator('#app').evaluate(el=>getComputedStyle(el).visibility),'hidden');assert.deepEqual(e,[]);await p.close();
  }
  // Category editing preserves historical classifications, colors, totals and archived defaults.
  {
   const {page:p,errors:e}=await boot(browser);
   const stored=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('happy_money_category_catalog_fixture')));
   const saved=()=>p.waitForFunction(()=>document.getElementById('catalogStatus').textContent==='Đã lưu danh mục.');
   const openSettings=async()=>p.locator('#app .settingsOpen').click();
   const edit=async(id)=>{await p.locator(`[data-edit-id="${id}"]`).click();await p.locator('#catalogEditorOverlay').waitFor({state:'visible'})};
   await openSettings();await edit('default-4');
   await p.locator('#newCategoryName').fill('Thể thao');await p.locator('#categoryColorChoices [data-color="#40d879"]').click();await p.locator('#saveCatalogCategory').click();await saved();
   let record=await stored();let tennis=record.items.find(x=>x.id==='default-4');assert.equal(tennis.name,'Thể thao');assert.ok(tennis.aliases.includes('Tennis'));assert.equal(tennis.color,'#40d879');
   await p.locator('#settingsBack').click();assert.equal(await p.locator('.tx[data-tx-id="2"] .txCategory').innerText(),'Thể thao');assert.equal(await p.evaluate(()=>fixture.rows.find(x=>x.id==='2').expense),250000);
   await p.locator('#statsTab').click();await p.locator('[data-chart-category="Thể thao"]').click();assert.equal(await p.locator('#categoryResult').evaluate(el=>el.style.getPropertyValue('--cat-color')),'#40d879');assert.match(await p.locator('#categoryResult').innerText(),/250.000/);await p.locator('#categoryBack').click();await p.locator('#historyTab').click();
   await openSettings();await edit('default-4');await p.locator('#newCategoryName').fill('Tên chưa lưu');await p.locator('#closeCatalogEditor').click();assert.equal((await stored()).items.find(x=>x.id==='default-4').name,'Thể thao');
   await edit('default-4');await p.locator('#newCategoryName').fill('Ăn uống');await p.locator('#saveCatalogCategory').click();assert.match(await p.locator('#catalogEditorError').innerText(),/đã có/);await p.keyboard.press('Escape');await p.locator('#catalogEditorOverlay').waitFor({state:'hidden'});
   // Confirm removal, not a transaction delete. The archived category survives reload.
   p.removeAllListeners('dialog');p.on('dialog',d=>d.accept());await p.locator('[data-delete-category="default-4"]').click();await saved();assert.equal(await p.locator('[data-edit-id="default-4"]').count(),0);assert.equal((await stored()).items.find(x=>x.id==='default-4').archived,true);await p.locator('#settingsBack').click();
   assert.equal(await p.locator('.tx[data-tx-id="2"] .txCategory').innerText(),'Thể thao');await p.reload();await p.locator('#app').waitFor({state:'visible'});await openSettings();assert.equal(await p.locator('[data-edit-id="default-4"]').count(),0);await p.locator('#settingsBack').click();
   await p.locator('#addBtn').click();assert.equal(await p.locator('#quickExpense [data-category="Thể thao"]').count(),0);await p.locator('#desc').fill('Tennis');assert.equal(await p.locator('#category').inputValue(),'Chưa phân loại');await p.locator('#desc').blur();await p.locator('#historyTab').click();
   await p.locator('.tx[data-tx-id="2"]').click();assert.equal(await p.locator('#editTxCategory').inputValue(),'Thể thao');assert.equal(await p.locator('#editCategoryChips [data-edit-category="Thể thao"]').count(),1);await p.locator('#closeEditTx').click();
   // Native-keyboard-sized viewport and both themes keep the sheet inside the screen.
   await openSettings();await p.locator('#addCategoryBtn').click();await p.locator('#newCategoryName').fill('Thử bố cục');await p.locator('#categoryEmojiButton').click();await p.locator('#customCategoryEmoji').fill('abc');await p.locator('#saveCategoryEmoji').click();assert.match(await p.locator('#catalogEditorError').innerText(),/emoji/);await p.locator('#emojiPresets [data-emoji="🍔"]').click();await p.locator('#newCategoryName').focus();await p.setViewportSize({width:320,height:430});await p.locator('#saveCatalogCategory').scrollIntoViewIfNeeded();assert.equal(await p.locator('.catalogEditorPanel').evaluate(el=>el.scrollWidth<=el.clientWidth),true);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:'/tmp/happy-category-keyboard.png'});await p.keyboard.press('Escape');
   await p.setViewportSize({width:390,height:844});await p.locator('#settingsOverlay .themeToggle').click();await p.locator('#addCategoryBtn').click();await p.screenshot({path:'/tmp/happy-category-light.png'});await p.keyboard.press('Escape');assert.deepEqual(e,[]);await p.close();
  }
  // Long-distance drag scrolls the Settings list; fallback edits/removals remain usable.
  {
   const {page:p,errors:e}=await boot(browser,{height:667});await p.locator('#app .settingsOpen').click();
   const handle=p.locator('[data-drag-id="default-0"]'),box=await handle.boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2,650,{steps:8});await p.waitForFunction(()=>document.querySelector('.settingsPanel').scrollTop>120);await p.mouse.up();await p.waitForFunction(()=>document.getElementById('catalogStatus').textContent==='Đã lưu danh mục.');assert.equal(await p.locator('#catalogEditorOverlay').isVisible(),false);assert.equal(await p.locator('.catalogRow').count(),11);await p.clock.setFixedTime(new Date('2026-10-28T10:00:01+07:00'));
   await p.locator('[data-edit-id="default-10"]').click();await p.locator('#newCategoryName').fill('Khác');await p.locator('#saveCatalogCategory').click();await p.waitForFunction(()=>document.getElementById('catalogStatus').textContent==='Đã lưu danh mục.');p.removeAllListeners('dialog');p.on('dialog',d=>d.accept());await p.locator('[data-delete-category="default-10"]').click();await p.locator('#settingsBack').click();await p.locator('#addBtn').click();assert.equal(await p.locator('#category').inputValue(),'Khác');assert.equal(await p.locator('#quickExpense [data-category="Khác"]').count(),0);await p.locator('#historyTab').click();
   await p.locator('#app .settingsOpen').click();await p.locator('#addCategoryBtn').click();await p.locator('#newCategoryName').fill('Khác');await p.locator('#saveCatalogCategory').click();await p.waitForFunction(()=>document.getElementById('catalogStatus').textContent==='Đã lưu danh mục.');assert.equal(await p.locator('[data-edit-id="default-10"]').count(),1);const record=await p.evaluate(()=>JSON.parse(localStorage.getItem('happy_money_category_catalog_fixture')));assert.equal(record.items.length,11);assert.equal(record.items.find(x=>x.id==='default-10').archived,false);assert.deepEqual(e,[]);await p.close();
  }
  // Sheet edits/deletions use actual rows, never seed + edited row twice.
  {
   const {page:p,errors:e}=await boot(browser);const totals=await p.evaluate(()=>{
    const old={id:'seed',year:2026,month:10,txn_date:'2026-10-20',description:'Ăn uống',income:0,expense:100000,source:'sheet'},app={...old,id:'app',source:'app',expense:50000},status={total_expense:100000};
    return [monthTotals([old,app],status).expense,monthTotals([{...old,source:'app_edited',expense:80000},app],status).expense,monthTotals([{...old,source:'app_edited',description:'',expense:0},app],status).expense];
   });assert.deepEqual(totals,[150000,130000,50000]);assert.deepEqual(e,[]);await p.close();
  }
  // Automatic balances, reconciliation and historical edit/delete through the real UI.
  {
   const {page:p,errors:e}=await boot(browser,{date:'2026-11-03T10:00:00+07:00'});
   await p.evaluate(async()=>{fixture.rows=[];fixture.statuses=[{id:'oct',user_id:'fixture',year:2026,month:10,bank_balance:5000000,bank_balance_date:'2026-10-31',savings_balance:20000000,savings_balance_date:'2026-10-31'}];await refresh()});
   const money=async(id)=>Number((await p.locator('#'+id).innerText()).replace(/[^0-9-]/g,''));
   const add=async(amount,category,{income=false,date='2026-11-03'}={})=>{await p.locator('#addBtn').click();if(income)await p.locator('#incomeType').click();await p.locator('#amount').fill(String(amount));if(income)await p.locator(`#quickIncome [data-name="${category}"]`).click();else await p.locator(`#quickExpense [data-category="${category}"]`).click();await p.locator('#date').fill(date);await p.locator('#saveTx').click();await p.locator('#addOverlay').waitFor({state:'hidden'});await p.waitForFunction(()=>document.querySelectorAll('.tx').length===fixture.rows.filter(x=>x.month===current&&x.year===currentYear&&!isDeletedTransaction(x)&&!isOpeningBalance(x)).length)};
   const reconcile=async(kind,amount)=>{await p.locator(`[data-status-key="${kind}"]`).press('Enter');await p.locator('#statusOverlay').waitFor({state:'visible'});await p.locator('#statusAmount').fill(String(amount));await p.locator('#saveStatus').click();await p.locator('#statusOverlay').waitFor({state:'hidden'});await p.waitForFunction(()=>!savingStatus)};
   assert.equal(await money('startBalance'),5000000);assert.equal(await money('bankHero'),5000000);assert.equal(await money('savingsBalance'),20000000);
   await add(100000,'Ăn uống');assert.equal(await money('bankHero'),4900000);await add(1000000,'Rút tiết kiệm',{income:true});assert.equal(await money('bankHero'),5900000);assert.equal(await money('savingsBalance'),19000000);await add(200000,'Lương',{income:true});assert.equal(await money('bankHero'),6100000);
   await reconcile('bank_balance',6000000);assert.equal(await money('bankHero'),6000000);await add(50000,'Ăn uống',{date:'2026-11-02'});assert.equal(await money('bankHero'),5950000);
   assert.equal(await p.locator('.txDate[data-date="2026-11-03"]').count(),3);assert.match(await p.locator('.txDate[data-date="2026-11-02"]').innerText(),/02\/11/);assert.equal(await p.locator('.historyDayHeading,.txTime,.historyDayTotal').count(),0);
   await p.locator('.tx[data-tx-id="101"]').click();await p.locator('#editTxAmount').fill('150000');await p.locator('#saveEditTx').click();await p.locator('#editTxOverlay').waitFor({state:'hidden'});await p.waitForFunction(()=>document.getElementById('bankHero').textContent.includes('5.900.000'));assert.equal(await money('bankHero'),5900000);
   p.removeAllListeners('dialog');p.on('dialog',d=>d.accept());await p.locator('.tx[data-tx-id="104"]').click();await p.locator('#deleteEditTx').click();await p.locator('#editTxOverlay').waitFor({state:'hidden'});await p.waitForFunction(()=>document.getElementById('bankHero').textContent.includes('5.950.000'));assert.equal(await money('bankHero'),5950000);
   await p.locator('.tx[data-tx-id="102"]').click();await p.locator('#deleteEditTx').click();await p.locator('#editTxOverlay').waitFor({state:'hidden'});await p.waitForFunction(()=>document.getElementById('bankHero').textContent.includes('4.950.000'));assert.equal(await money('savingsBalance'),20000000);
   await reconcile('savings_balance',18000000);await add(500000,'Rút tiết kiệm',{income:true});assert.equal(await money('savingsBalance'),17500000);assert.equal(await money('bankHero'),5450000);await p.screenshot({path:'/tmp/happy-automatic-balances.png'});
   await p.evaluate(async()=>{currentYear=2026;current=12;renderMonths();await refresh()});assert.equal(await money('startBalance'),5450000);assert.equal(await money('savingsBalance'),17500000);await reconcile('start_balance',0);assert.equal(await money('startBalance'),0);assert.equal(await money('bankHero'),0);await p.evaluate(async()=>{currentYear=2027;current=1;renderMonths();await refresh()});assert.equal(await money('startBalance'),0);assert.equal(await money('savingsBalance'),17500000);assert.deepEqual(e,[]);await p.close();
  }
  // A failed checkpoint write must not save an expense with an unfrozen baseline.
  {
   const {page:p,errors:e}=await boot(browser,{date:'2026-11-03T10:00:00+07:00'});await p.evaluate(async()=>{fixture.statuses=[{id:'oct',user_id:'fixture',year:2026,month:10,bank_balance:5000000,bank_balance_date:'2026-10-31'}];await refresh();fixture.statuses[0].balance_checkpoint=null;fixture.failBalance=true});
   await p.locator('#addBtn').click();await p.locator('#amount').fill('100000');await p.locator('#quickExpense [data-category="Ăn uống"]').click();await p.locator('#saveTx').click();await p.waitForFunction(()=>document.getElementById('entryError').textContent.includes('Fixture balance failure'));assert.equal(await p.evaluate(()=>fixture.inserts.length),0);assert.equal(await p.locator('#saveTx').isEnabled(),true);assert.equal(await p.locator('#amount').inputValue(),'100.000');assert.deepEqual(e,[]);await p.close();
  }

  // Note-first compact history, configured selection colors and yearly analytics.
  {
   const {page:p,errors:e}=await boot(browser);
   assert.equal(await p.locator('.appBrand').innerText(),'Happy Money');assert.ok(await p.locator('.appBrand').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=14);assert.ok((await p.locator('.tx[data-tx-id="1"]').boundingBox()).height<78);assert.ok(await p.locator('.txCategory').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=14);assert.ok(await p.locator('.card .k').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=12);
   assert.equal(await p.locator('.tx[data-tx-id="1"] .txName').innerText(),'Cà phê');
   for(const width of [320,390]){await p.setViewportSize({width,height:844});assert.ok(await p.locator('.card.gold .k').evaluate(el=>el.scrollWidth<=el.clientWidth),'Food difference title must fit in full on one line');}await p.setViewportSize({width:390,height:844});
   assert.equal(await p.locator('.historyDayHeading,.historyDayTotal,.txTime').count(),0);
   assert.ok((await p.locator('.tx[data-tx-id="2"]').boundingBox()).height<70);
   assert.equal(await p.locator('.tx[data-tx-id="2"] .txDate').textContent(),'21/10');
   for(const width of [320,390]){await p.setViewportSize({width,height:844});const meta=p.locator('.tx[data-tx-id="2"] .txMeta');assert.equal(await meta.locator('.txCategory').innerText(),'Tennis');const category=await meta.locator('.txCategory').boundingBox(),date=await meta.locator('.txDate').boundingBox();assert.ok(Math.abs(category.y+category.height/2-date.y-date.height/2)<2,'Category and date must share one line');assert.ok(date.x>=category.x+category.width);assert.ok((await p.locator('.tx[data-tx-id="2"]').boundingBox()).height<60);}await p.setViewportSize({width:390,height:844});
   await p.locator('#addBtn').click();
   for(const theme of ['dark','light']){
    await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    for(const [name,color] of [['Ăn uống','rgb(255, 98, 107)'],['Di chuyển & xe','rgb(72, 198, 188)']]){
     const chip=p.locator('#quickExpense [data-category="'+name+'"]');await chip.click();assert.equal(await chip.getAttribute('aria-pressed'),'true');assert.ok(await chip.evaluate(el=>{const width=parseFloat(getComputedStyle(el).borderTopWidth);return width>=2&&width<=2.5}),'Category borders must be reduced from 3px by 0.5px in both themes');assert.equal(await chip.evaluate(el=>getComputedStyle(el).borderTopColor),color);
    }
   }
   await p.locator('#historyTab').click();
   await p.evaluate(async()=>{fixture.rows.push({id:'year-old',user_id:'fixture',year:2025,month:3,txn_date:'2025-03-02',description:'Old expense',expense:123000,income:0,source:'app'});fixture.rows.push({id:'year-future',user_id:'fixture',year:2026,month:12,txn_date:'2026-12-02',description:'December expense',expense:80000,income:0,source:'app'});fixture.rows.push({id:'year-deleted',user_id:'fixture',year:2026,month:1,txn_date:null,description:'',expense:0,income:0,source:'app_edited'});await refresh()});
   await p.locator('#statsTab').click();await p.locator('[data-overview-mode="year"]').click();await p.locator('.annualBar').first().waitFor({state:'visible'});
   assert.equal(await p.locator('.annualBar').count(),12);assert.equal(await p.locator('.annualMonthList [data-month-detail]').count(),12);assert.deepEqual(await p.locator('.annualMonthList [data-month-detail]').evaluateAll(els=>els.map(el=>Number(el.dataset.monthDetail))),[12,11,10,9,8,7,6,5,4,3,2,1]);assert.deepEqual(await p.locator('.annualBar').evaluateAll(els=>els.map(el=>Number(el.dataset.annualMonth))),[1,2,3,4,5,6,7,8,9,10,11,12]);assert.match(await p.locator('.annualTotal strong').innerText(),/450.000/);
   assert.equal(await p.locator('#overviewStats').isVisible(),false);assert.match(await p.locator('.annualMonthList [data-month-detail="10"]').innerText(),/300.000/);await p.screenshot({path:'/tmp/happy-year-overview.png'});
   assert.equal(await p.locator('.annualBar').first().evaluate(el=>getComputedStyle(el).webkitTapHighlightColor),'rgba(0, 0, 0, 0)');assert.ok(await p.locator('.annualBarFill').evaluateAll(els=>els.every(el=>el.getBoundingClientRect().height<=165)));await p.locator('#annualPreviousYear').click();assert.equal(await p.locator('#annualYearSelect').inputValue(),'2025');assert.match(await p.locator('.annualTotal strong').innerText(),/123.000/);await p.locator('#annualNextYear').click();
   const before=await p.evaluate(()=>({year:currentYear,month:current,inserts:fixture.inserts.length}));
   await p.locator('.annualBar[data-annual-month="9"]').click();assert.equal(await p.locator('[data-overview-mode="year"]').getAttribute('aria-pressed'),'true');assert.match(await p.locator('#annualBreakdown h3').innerText(),/9/);assert.match(await p.locator('#annualBreakdown .statValue').first().innerText(),/70.000/);assert.match(await p.locator('.annualChartHint').innerText(),/Chạm lại/);assert.equal(await p.locator('.annualBar[data-annual-month="9"]').getAttribute('aria-pressed'),'true');
   assert.deepEqual(await p.evaluate(()=>({year:currentYear,month:current,inserts:fixture.inserts.length})),before,'annual selection must not navigate or mutate transactions');assert.equal(await p.locator('#categoryOverlay').isVisible(),false);assert.equal(await p.locator('.annualChart').isVisible(),true);
   await p.locator('#annualCategoryChart [data-chart-category]').first().click();assert.equal(await p.locator('#categoryOverlay').isVisible(),true);assert.match(await p.locator('#categoryResult').innerText(),/Ăn trưa/);await p.locator('#categoryBack').click();await p.waitForTimeout(150);
   await p.locator('.annualBar[data-annual-month="9"]').click();assert.match(await p.locator('#annualBreakdown .statValue').first().innerText(),/450.000/);assert.match(await p.locator('.annualChartHint').innerText(),/Chạm một tháng/);assert.equal(await p.locator('.annualBar[aria-pressed="true"]').count(),0);
   await p.locator('.annualBar[data-annual-month="2"]').click();assert.match(await p.locator('#annualCategoryChart').innerText(),/Chưa có khoản chi/);await p.locator('.annualBar[data-annual-month="2"]').click();
   await p.locator('.annualMonthList [data-month-detail="9"]').click();await p.waitForFunction(()=>document.querySelector('#overviewStats .statValue')?.textContent.includes('70.000'));assert.equal(await p.locator('[data-overview-mode="month"]').getAttribute('aria-pressed'),'true');assert.match(await p.locator('#overviewMonth').innerText(),/9 · 2026/);await p.locator('#categoryChart [data-chart-category]').first().click();assert.equal(await p.locator('#categoryOverlay').isVisible(),true);await p.locator('#categoryBack').click();await p.waitForTimeout(150);await p.locator('#annualMonthBack').click();await p.locator('.annualBar').first().waitFor({state:'visible'});assert.equal(await p.locator('[data-overview-mode="year"]').getAttribute('aria-pressed'),'true');assert.deepEqual(await p.evaluate(()=>({year:currentYear,month:current,inserts:fixture.inserts.length})),before);await p.screenshot({path:'/tmp/happy-year-inline.png'});
   await p.locator('#annualPreviousYear').click();assert.match(await p.locator('#annualBreakdown .statValue').first().innerText(),/123.000/);assert.equal(await p.locator('.annualBar[aria-pressed="true"]').count(),0);await p.locator('#annualNextYear').click();
   await p.locator('[data-overview-mode="year"]').click();await p.locator('.annualBar').first().waitFor({state:'visible'});await p.setViewportSize({width:320,height:568});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:'/tmp/happy-year-320.png'});assert.deepEqual(e,[]);await p.close();
  }
  // Language is remembered on this device and does not translate or edit user content.
  {
   const {page:p,errors:e}=await boot(browser);await p.locator('#app .settingsOpen').click();await p.locator('#languageSelect').selectOption('en');
   await p.waitForFunction(()=>document.documentElement.lang==='en');assert.equal(await p.locator('#settingsOverlay h2').innerText(),'Settings');assert.equal(await p.locator('#languageSelect').inputValue(),'en');assert.equal(await p.locator('.catalogName').first().innerText(),'Food');assert.equal(await p.evaluate(()=>catalogRecord.items[0].name),'Ăn uống');
   await p.locator('#settingsBack').click();assert.equal(await p.locator('#historyTab span').innerText(),'Expenses');assert.equal(await p.locator('.tx[data-tx-id="1"] .txName').innerText(),'Cà phê');
   for(const width of [320,390]){await p.setViewportSize({width,height:844});assert.ok(await p.locator('.card.gold .k').evaluate(el=>el.scrollWidth<=el.clientWidth),'Food difference title must fit in full on one line');}await p.setViewportSize({width:390,height:844});
   await p.locator('#addBtn').click();assert.equal(await p.locator('#desc').getAttribute('placeholder'),'Note');assert.equal(await p.locator('#saveTx').innerText(),'Save transaction');assert.equal(await p.locator('#quickExpense [data-category="Ăn uống"] .categoryText').innerText(),'Food');assert.equal(await p.locator('#category option[value="Ăn uống"]').innerText(),'Food');await p.locator('#desc').fill('Gửi Ba nguyên văn');await p.locator('#desc').blur();await p.locator('#historyTab').click();
   await p.locator('#statsTab').click();await p.locator('[data-overview-mode="year"]').click();await p.locator('.annualBar').first().waitFor({state:'visible'});await p.waitForFunction(()=>document.querySelector('.annualChartCard h3').textContent==='By month');assert.equal(await p.locator('.annualMonthLabel').first().innerText(),'Jan');assert.equal(await p.locator('.annualChartHint').innerText(),'Tap a month to see its breakdown');await p.locator('.annualBar[data-annual-month="10"]').click();assert.equal(await p.locator('.annualChartHint').innerText(),'Tap it again to see the whole year');assert.match(await p.locator('#annualCategoryChart').innerText(),/Uncategorized/);await p.locator('.annualBar[data-annual-month="10"]').click();await p.screenshot({path:'/tmp/happy-year-english.png'});
   await p.locator('#historyTab').click();await p.reload();await p.locator('#app').waitFor({state:'visible'});assert.equal(await p.evaluate(()=>document.documentElement.lang),'en');assert.equal(await p.locator('#historyTab span').innerText(),'Expenses');
   await p.locator('#app .settingsOpen').click();await p.locator('#languageSelect').selectOption('vi');await p.waitForFunction(()=>document.documentElement.lang==='vi');assert.equal(await p.locator('#settingsOverlay h2').innerText(),'Cài đặt');assert.equal(await p.locator('.catalogName').first().innerText(),'Ăn uống');assert.deepEqual(e,[]);await p.close();
  }
  // Centered note/caret, compact keyboard controls, safe-area space and settings order.
  {
   const {page:p,errors:e}=await boot(browser);await p.locator('#app .settingsOpen').click();
   const order=await p.locator('.settingsPanel').evaluate(el=>[el.querySelector('.themeToggle').closest('.settingsRow'),el.querySelector('#privacyBtn').closest('.settingsRow'),el.querySelector('.settingsCatalog')].map(el=>el.getBoundingClientRect().top));assert.ok(order[0]<order[1]&&order[1]<order[2]);await p.screenshot({path:'/tmp/happy-settings-preferences-first.png'});await p.locator('#settingsBack').click();
   await p.locator('#addBtn').click();const toggle=await p.locator('#addOverlay .toggle').boundingBox(),panel=await p.locator('#addOverlay .formPanel').boundingBox();assert.ok(Math.abs(toggle.x+toggle.width/2-panel.x-panel.width/2)<=1);
   const payment=await p.locator('#paymentField').boundingBox(),keypad=await p.locator('#keypad').boundingBox(),note=await p.locator('.noteField').boundingBox();assert.ok(payment.y+payment.height<=keypad.y);assert.ok(Math.abs(payment.x+payment.width-keypad.x-keypad.width)<=1);assert.ok(keypad.y-note.y-note.height<=45);
   await p.locator('#desc').focus();const centered=async()=>{const input=await p.locator('#desc').boundingBox(),field=await p.locator('.noteField').boundingBox();assert.ok(Math.abs(input.x+input.width/2-field.x-field.width/2)<=1)};await centered();assert.equal(await p.locator('#desc').evaluate(el=>el.selectionStart),0);assert.equal(await p.locator('#desc').evaluate(el=>el.tagName),'INPUT');assert.equal(await p.locator('#desc').inputValue(),'');await p.screenshot({path:'/tmp/happy-note-centered-empty.png'});
   await p.locator('#desc').fill('Gửi Ba');await centered();await p.setViewportSize({width:390,height:430});await centered();assert.equal(await p.locator('#addOverlay .formPanel').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true);await p.screenshot({path:'/tmp/happy-note-centered-keyboard.png'});await p.locator('#desc').blur();await p.setViewportSize({width:320,height:568});
   // Simulate extra top/bottom insets to catch the mismatch missed by bare viewport tests.
   await p.addStyleTag({content:'#addOverlay .formPanel{padding-top:26px;padding-bottom:10px}.bottom{padding-bottom:44px}'});await p.evaluate(()=>updateEntryViewport());assert.equal(await p.locator('#addOverlay .formPanel').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true);assert.equal(await p.locator('#addOverlay .formPanel').evaluate(el=>getComputedStyle(el).overflowY),'hidden');assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).overflowY),'hidden');assert.deepEqual(e,[]);await p.close();
  }
  // A 12px gutter separates each revealed action; reversing a swipe closes it.
  {
   const {page:p,errors:e}=await boot(browser);const row=p.locator('.tx[data-tx-id="2"]');
   const swipe=async(dx,dy=0)=>row.evaluate((target,{dx,dy})=>{target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[new Touch({identifier:1,target,clientX:180,clientY:280})]}));target.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[new Touch({identifier:1,target,clientX:180+dx,clientY:280+dy})]}));target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[new Touch({identifier:1,target,clientX:180+dx,clientY:280+dy})]}))},{dx,dy});
   const settled=async(x)=>p.waitForFunction(x=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.tx[data-tx-id="2"]')).transform).m41-x)<1,x);
   await swipe(110);await settled(100);let action=await row.locator('..').locator('.txSwipeEdit').boundingBox(),content=await row.boundingBox();assert.ok(content.x-action.x-action.width>=11);
   await swipe(-100);await settled(0);assert.equal(await p.locator('#editTxOverlay').isVisible(),false);await swipe(5);await settled(0);await swipe(-110);await settled(-100);action=await row.locator('..').locator('.txSwipeDelete').boundingBox();content=await row.boundingBox();assert.ok(action.x-content.x-content.width>=11);assert.deepEqual(e,[]);await p.close();
  }
  // The month total stays fixed directly above navigation as history scrolls.
  {
   const {page:p,errors:e}=await boot(browser);await p.evaluate(async()=>{for(let i=0;i<40;i++)fixture.rows.push({...fixture.rows[0],id:'scroll-'+i});await refresh()});
   assert.equal(await p.locator('#historyTab').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');const total=p.locator('.historySummary'),tabs=p.locator('.tabbar'),before=await total.boundingBox(),nav=await tabs.boundingBox();assert.ok(Math.abs(nav.y-(before.y+before.height))<=9);await p.evaluate(()=>scrollTo(0,600));await p.waitForFunction(()=>scrollY>200);const after=await total.boundingBox();assert.ok(Math.abs(after.y-before.y)<1);await p.screenshot({path:'/tmp/happy-history-fixed-total.png'});
   await p.locator('#addBtn').click();assert.equal(await total.isVisible(),false);await p.locator('#desc').focus();assert.equal(await p.locator('#desc').inputValue(),'');assert.equal(await p.locator('#desc').evaluate(el=>el.selectionStart),0);assert.equal(await p.locator('#desc').evaluate(el=>getComputedStyle(el).textAlign),'left');assert.equal(await p.locator('#desc').getAttribute('placeholder'),'Ghi chú');await p.locator('#desc').blur();await p.locator('#statsTab').click();assert.equal(await total.isVisible(),false);await p.locator('#historyTab').click();assert.equal(await total.isVisible(),true);assert.deepEqual(e,[]);await p.close();
  }
  // Swipe directions reveal independent actions; deleting still requires confirmation.
  {
   const {page:p,errors:e}=await boot(browser);
   const row=p.locator('.tx[data-tx-id="2"]');
   const swipe=async(dx)=>row.evaluate((target,dx)=>{target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[new Touch({identifier:1,target,clientX:180,clientY:280})]}));target.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[new Touch({identifier:1,target,clientX:180+dx,clientY:282})]}));target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[new Touch({identifier:1,target,clientX:180+dx,clientY:282})]}))},dx);
   if(engine===chromium){const cdp=await p.context().newCDPSession(p),box=await row.boundingBox(),y=box.y+box.height/2;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:160,y}]});for(const x of [180,210,240,270])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}else await swipe(100);const wrapper=row.locator('..');assert.equal(await wrapper.getAttribute('data-action'),'edit');assert.equal(await wrapper.locator('.txSwipeEdit').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(48, 85, 128)');assert.ok(Math.abs((await wrapper.locator('.txSwipeEdit').boundingBox()).height-(await row.boundingBox()).height)<=1);await p.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.tx[data-tx-id="2"]')).transform).m41-100)<1);await p.screenshot({path:'/tmp/happy-swipe-edit.png'});assert.equal(await p.locator('#editTxOverlay').isVisible(),false);await wrapper.locator('.txSwipeEdit').click();assert.equal(await p.locator('#editTxAmount').evaluate(el=>el===document.activeElement),true);await p.locator('#closeEditTx').click();
   await swipe(-100);assert.equal(await wrapper.getAttribute('data-action'),'delete');assert.equal(await wrapper.locator('.txSwipeDelete').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 69, 58)');await p.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.tx[data-tx-id="2"]')).transform).m41+100)<1);await p.screenshot({path:'/tmp/happy-swipe-delete.png'});await wrapper.locator('.txSwipeDelete').click();assert.equal(await row.count(),1);
   await p.locator('#addBtn').click();assert.equal(await p.locator('#saveTx').isEnabled(),false);await p.locator('#keypad [data-key="1"]').click();assert.equal(await p.locator('#saveTx').isEnabled(),true);await p.locator('#keypad [data-key="backspace"]').click();assert.equal(await p.locator('#saveTx').isEnabled(),false);await p.locator('#amount').fill('0');assert.equal(await p.locator('#saveTx').isEnabled(),false);assert.deepEqual(e,[]);await p.close();
  }
  // Editing selects the amount immediately, and delegates native keyboards to OS inputs.
  {
   const {page:p,errors:e}=await boot(browser);await p.locator('.tx[data-tx-id="2"]').click();
   const sheet=p.locator('#editTxOverlay .formPanel');await sheet.waitFor({state:'visible'});assert.equal(await p.locator('#editTxOverlay').getAttribute('data-input-mode'),'amount');assert.equal(await p.locator('#editKeypad').count(),0);assert.equal(await p.locator('#editTxAmount').evaluate(el=>el===document.activeElement),true);assert.equal(await p.locator('#editTxName').evaluate(el=>el===document.activeElement),false);
   assert.deepEqual(await p.locator('#editTxAmount').evaluate(el=>[el.selectionStart,el.selectionEnd]),[0,6]);const box=await sheet.boundingBox();assert.ok(box.y>200,'idle sheet should leave the previous screen visible');assert.equal(await p.locator('#closeEditTx').innerText(),'Hủy');assert.equal(await p.locator('#saveEditTx').innerText(),'Lưu');await p.screenshot({path:'/tmp/happy-edit-idle.png'});
   await p.locator('#editTxName').click();await p.locator('#editTxName').fill('Ghi chú đang sửa');assert.equal(await p.locator('#editTxOverlay').getAttribute('data-input-mode'),'note');assert.equal(await p.locator('#editTxName').getAttribute('inputmode'),'text');assert.ok(await p.locator('#editTxName').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=16);
   await p.setViewportSize({width:390,height:430});await p.locator('#saveEditTx').scrollIntoViewIfNeeded();assert.equal(await sheet.evaluate(el=>el.scrollWidth<=el.clientWidth),true);await p.screenshot({path:'/tmp/happy-edit-note.png'});
   await p.locator('#editTxAmount').click();assert.equal(await p.locator('#editTxOverlay').getAttribute('data-input-mode'),'amount');assert.equal(await p.locator('#editTxAmount').getAttribute('inputmode'),'numeric');await p.locator('#editTxAmount').fill('350000');assert.equal(await p.locator('#editTxAmount').inputValue(),'350000');await p.screenshot({path:'/tmp/happy-edit-number.png'});
   await p.locator('#closeEditTx').click();await p.locator('#editTxOverlay').waitFor({state:'hidden'});assert.equal(await p.evaluate(()=>fixture.rows.find(x=>x.id==='2').expense),250000);assert.equal(await p.evaluate(()=>fixture.rows.find(x=>x.id==='2').description),'Tennis');
   await p.setViewportSize({width:390,height:844});await p.locator('.tx[data-tx-id="2"]').click();assert.equal(await p.locator('#editTxName').inputValue(),'Tennis');assert.equal(await p.locator('#editTxAmount').inputValue(),'250000');assert.equal(await p.locator('#editTxOverlay').getAttribute('data-input-mode'),'amount');await p.locator('#editTxName').fill('Đã sửa ghi chú');await p.locator('#editTxAmount').fill('350000');await p.locator('#saveEditTx').click();await p.locator('#editTxOverlay').waitFor({state:'hidden'});assert.equal(await p.evaluate(()=>fixture.rows.find(x=>x.id==='2').expense),350000);assert.equal(await p.evaluate(()=>fixture.rows.find(x=>x.id==='2').description),'Đã sửa ghi chú');assert.deepEqual(e,[]);await p.close();
  }
  for(const [width,height] of [[320,568],[390,667],[390,844],[430,932]]){
   const {page:p}=await boot(browser,{width,height});await p.screenshot({path:'/tmp/happy-history-'+width+'-'+height+'.png'});await p.locator('#addBtn').click();await p.locator('#amount').evaluate(e=>e.blur());
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await p.locator('#addOverlay .formPanel').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
   assert.equal(await p.locator('#addOverlay .formPanel').evaluate(e=>e.scrollHeight<=e.clientHeight+1),true,'entry should fit without vertical scroll at '+width+'×'+height);assert.equal(await p.locator('#addOverlay .formPanel').evaluate(e=>e.scrollTop),0);
   const save=await p.locator('#saveTx').boundingBox(),nav=await p.locator('#bottom').boundingBox();assert.ok(save.y+save.height<=nav.y+1,'save button must stay above navigation');
   await p.screenshot({path:'/tmp/happy-entry-'+width+'.png'});
   await p.locator('#statsTab').click();await p.waitForFunction(()=>document.querySelector('[data-chart-category]'));await p.locator('#summaryOverlay .summaryPanel').evaluate(e=>e.scrollTop=0);await p.screenshot({path:'/tmp/happy-stats-'+width+'-'+height+'.png'});await p.close();
  }
  console.log(engine.name()+': PASS — entry, double-save, income, errors, edit, drilldown, projection, paginated CSV, deep link/login, rollover, 320–430px layouts');await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
