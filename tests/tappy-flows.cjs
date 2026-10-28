// Run: node tests/tappy-flows.cjs (requires Playwright in the runtime).
// All API responses are fixtures. This suite never touches live financial data.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const mock=String.raw`
window.fixture={inserts:[],reads:[],fail:false,delay:0,session:true,rows:[
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
},from(table){
 const state={table,filters:[],start:0,end:Infinity,op:'select',one:false};
 const query={select(){return query},eq(k,v){state.filters.push(r=>r[k]===v);return query},gte(k,v){state.filters.push(r=>r[k]>=v);return query},lt(k,v){state.filters.push(r=>r[k]<v);return query},order(){return query},range(a,b){state.start=a;state.end=b;return query},maybeSingle(){state.one=true;return query},single(){state.one=true;return query},
 insert(payload){state.op='insert';state.payload=payload;return query},
 then(resolve,reject){return (async()=>{
 if(state.op==='insert'){
  fixture.inserts.push(state.payload);await new Promise(r=>setTimeout(r,fixture.delay));
  if(fixture.fail)return {data:null,error:{message:'Fixture network error'}};
  const row={...state.payload,id:String(100+fixture.inserts.length)};fixture.rows.push(row);return {data:row,error:null};
 }
 fixture.reads.push({table,start:state.start,end:state.end});
 let rows=table==='transactions'?fixture.rows:[];rows=rows.filter(r=>state.filters.every(fn=>fn(r))).slice(state.start,state.end===Infinity?undefined:state.end+1);
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
  await page.locator('#saveTx').click();assert.match(await page.locator('#entryError').innerText(),/số tiền/);
  for(const key of ['5','0','0','0','0'])await page.locator(`[data-key="${key}"]`).click();await page.locator('[data-key="backspace"]').click();await page.locator('[data-key="0"]').click();assert.equal(await page.locator('#amount').inputValue(),'50.000');
  await page.locator('#quickExpense [data-category="Ăn uống"]').click();await page.locator('#yesterdayBtn').click();
  assert.equal(await page.locator('#date').inputValue(),'2026-10-27');assert.equal(await page.locator('#yesterdayBtn').getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>fixture.delay=200);
  await page.evaluate(()=>{document.getElementById('saveTx').click();document.getElementById('saveTx').click()});
  await page.locator('#addOverlay').waitFor({state:'hidden'});
  const inserts=await page.evaluate(()=>fixture.inserts);assert.equal(inserts.length,1);assert.equal(inserts[0].description,'Ăn uống');assert.equal(inserts[0].expense,50000);assert.equal(inserts[0].income,0);assert.equal(inserts[0].payment_method,'bank');
  await page.locator('.tx').first().click();await page.locator('#editTxOverlay').waitFor({state:'visible'});await page.locator('#closeEditTx').click();
  await page.locator('#statsTab').click();assert.equal(await page.locator('#statsTab').getAttribute('aria-current'),'page');await page.locator('[data-chart-category="Tennis"]').click();assert.equal(await page.locator('.categoryResultName').innerText(),'Tennis');assert.match(await page.locator('.categoryResultAmount').innerText(),/250\.000/);assert.equal(await page.locator('#categoryOverlay').isVisible(),true);await page.locator('#categoryBack').click();assert.equal(await page.locator('#categoryOverlay').isVisible(),false);
  assert.match(await page.locator('#overviewStats').innerText(),/DỰ TÍNH TỔNG CHI CUỐI THÁNG/);
  await page.locator('#historyTab').click();await page.locator('#summaryOverlay').waitFor({state:'hidden'});await page.locator('#addBtn').click();assert.equal(await page.locator('#addBtn').getAttribute('aria-current'),'page');await page.locator('#incomeType').click();assert.equal(await page.locator('#quickExpense').isVisible(),false);assert.equal(await page.locator('#quickIncome').isVisible(),true);
  await page.locator('#quickIncome [data-name="Lương"]').click();await page.locator('#amount').fill('24000000');await page.locator('#saveTx').click();await page.locator('#addOverlay').waitFor({state:'hidden'});
  const income=await page.evaluate(()=>fixture.inserts.at(-1));assert.equal(income.income,24000000);assert.equal(income.expense,0);assert.equal(income.payment_method,null);
  // Failure retains entered data and makes retry possible.
  await page.locator('#addBtn').click();await page.locator('#amount').fill('100000');await page.locator('#quickExpense [data-category="Dịch vụ số"]').click();await page.evaluate(()=>fixture.fail=true);await page.locator('#saveTx').click();await page.waitForFunction(()=>document.getElementById('entryError').textContent.includes('Fixture network error'));
  assert.equal(await page.locator('#amount').inputValue(),'100.000');assert.equal(await page.locator('#saveTx').isEnabled(),true);await page.locator('#historyTab').click();
  // Export >500 entries and exclude another month plus tombstones.
  await page.evaluate(()=>{fixture.rows=Array.from({length:650},(_,i)=>({id:'csv-'+i,user_id:'fixture',year:2026,month:10,txn_date:'2026-10-01',description:i===0?'=HYPERLINK("bad")':'Fixture '+i,income:0,expense:1,source:'app'}));fixture.rows.push({id:'other',user_id:'fixture',year:2026,month:9,txn_date:'2026-09-01',description:'OUTSIDE',expense:1,source:'app'},{id:'deleted',user_id:'fixture',year:2026,month:10,description:'',expense:0,income:0,source:'app_edited'})});
  await page.locator('#statsTab').click();await page.locator('#exportRange').selectOption('selected');
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
   await p.locator('#amount').evaluate(e=>{e.focus();e.setSelectionRange(2,2)});await p.locator('[data-key="9"]').click();assert.equal(await p.locator('#amount').inputValue(),'129.345');
   await p.locator('#amount').evaluate(e=>e.setSelectionRange(0,3));await p.locator('[data-key="7"]').click();assert.equal(await p.locator('#amount').inputValue(),'7.345');
   await p.locator('#amount').evaluate(e=>e.setSelectionRange(2,2));await p.locator('[data-key="backspace"]').click();assert.equal(await p.locator('#amount').inputValue(),'345');
   await p.locator('#amount').evaluate(e=>e.setSelectionRange(0,0));await p.locator('[data-key="backspace"]').click();assert.equal(await p.locator('#amount').inputValue(),'345');
   await p.locator('#amount').evaluate(e=>{e.value='12345';e.setSelectionRange(2,2);e.dispatchEvent(new Event('input'))});assert.equal(await p.locator('#amount').inputValue(),'12.345');assert.equal(await p.locator('#amount').evaluate(e=>e.selectionStart),2);
   // Native horizontal swipes must not trigger the panel's pull-to-close gesture.
   await p.locator('#quickExpense').evaluate(e=>{e.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[new Touch({identifier:1,target:e,clientX:280,clientY:250})]}));e.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[new Touch({identifier:1,target:e,clientX:50,clientY:275})]}));e.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[]}))});
   assert.equal(await p.locator('#addOverlay .formPanel').evaluate(e=>e.style.transform),'');
   const chip=await p.locator('#quickExpense button').first().boundingBox();assert.ok(chip.height>=54);
   if(engine===chromium){const cdp=await p.context().newCDPSession(p);const box=await p.locator('#quickExpense').boundingBox();const y=box.y+box.height/2;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y}]});for(const x of [260,210,160,110,60])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForFunction(()=>document.getElementById('quickExpense').scrollLeft>30);assert.equal(await p.locator('#addOverlay').isVisible(),true)}
   await p.locator('#addOverlay .themeToggle').click();assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),'light');
   await p.screenshot({path:'/tmp/happy-light-entry.png'});await p.locator('#statsTab').click();await p.waitForFunction(()=>document.querySelector('.comparisonTable'));assert.equal(await p.locator('.comparisonTable').isVisible(),true);assert.match(await p.locator('#overviewStats').innerText(),/CÙNG KỲ/);await p.screenshot({path:'/tmp/happy-light-stats.png'});
   await p.reload();await p.locator('#app').waitFor({state:'visible'});assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),'light');assert.equal(await p.locator('meta[name="theme-color"]').getAttribute('content'),'#f7f7f3');await p.locator('#app .themeToggle').click();assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),'dark');await p.close();
  }
  // Revised capture: dedicated dates, pay-later toggle, note keyboard mode, haptics and category pages.
  {
   const {page:p,errors:e}=await boot(browser);
   assert.match(await p.locator('#historyTotal').innerText(),/300\.000/);
   await p.locator('#addBtn').click();assert.equal(await p.locator('#closeAdd').isVisible(),false);assert.equal(await p.getByText('Ghi giao dịch',{exact:true}).isVisible(),false);
   assert.equal(await p.locator('#todayBtn').isVisible(),true);assert.equal(await p.locator('#yesterdayBtn').isVisible(),true);assert.equal(await p.locator('#datePickText').innerText(),'Chọn ngày');assert.equal(await p.locator('#amount').evaluate(e=>getComputedStyle(e).caretColor),'rgba(0, 0, 0, 0)');
   assert.ok(await p.locator('[data-key="1"]').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>=28);
   await p.evaluate(()=>{window.vibrationCalls=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:n=>{vibrationCalls.push(n);return true}})});
   await p.locator('[data-key="5"]').click();await p.locator('[data-key="000"]').click();assert.equal(await p.evaluate(()=>vibrationCalls.length),2);
   await p.evaluate(()=>{Object.defineProperty(navigator,'vibrate',{configurable:true,value:undefined});Object.defineProperty(document.getElementById('hapticSwitch'),'switch',{configurable:true,value:true})});
   const before=await p.locator('#hapticSwitch').isChecked();await p.locator('[data-key="0"]').click();assert.equal(await p.locator('#hapticSwitch').isChecked(),!before);
   await p.locator('#quickExpense [data-category="Ăn uống"]').click();await p.locator('#payLaterToggle').click();assert.equal(await p.locator('#payLaterToggle').getAttribute('aria-pressed'),'true');
   await p.locator('#desc').focus();await p.locator('#desc').fill('Cà phê ghi chú dài kiểm tra bố cục');assert.equal(await p.locator('#keypad').isVisible(),false);assert.ok(await p.locator('#desc').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>=16);
   await p.setViewportSize({width:390,height:430});await p.locator('#saveTx').scrollIntoViewIfNeeded();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await p.locator('#addOverlay .formPanel').evaluate(e=>e.scrollWidth<=e.clientWidth),true);await p.screenshot({path:'/tmp/happy-note-keyboard.png'});
   await p.locator('#noteReturn').click();await p.setViewportSize({width:390,height:844});await p.locator('#keypad').waitFor({state:'visible'});assert.equal(await p.locator('#desc').inputValue(),'Cà phê ghi chú dài kiểm tra bố cục');
   await p.locator('#desc').focus();await p.locator('#saveTx').click();await p.locator('#addOverlay').waitFor({state:'hidden'});assert.equal(await p.evaluate(()=>fixture.inserts.at(-1).payment_method),'pay_later');assert.equal(await p.evaluate(()=>fixture.inserts.at(-1).description),'Cà phê ghi chú dài kiểm tra bố cục');
   await p.locator('#statsTab').click();assert.equal(await p.locator('#categoryToggle').count(),0);await p.locator('[data-chart-category="Tennis"]').click();await p.locator('#categoryOverlay').waitFor({state:'visible'});await p.screenshot({path:'/tmp/happy-category-page.png'});
   await p.locator('#categoryResult [data-category-tx-id]').first().click();await p.locator('#editTxOverlay').waitFor({state:'visible'});assert.ok(await p.locator('#editTxOverlay').evaluate(e=>Number(getComputedStyle(e).zIndex))>await p.locator('#categoryOverlay').evaluate(e=>Number(getComputedStyle(e).zIndex)));await p.locator('#closeEditTx').click();await p.locator('#categoryBack').click();assert.equal(await p.locator('.comparisonTable').isVisible(),true);assert.deepEqual(e,[]);await p.close();
  }
  for(const [width,height] of [[320,568],[390,667],[390,844],[430,932]]){
   const {page:p}=await boot(browser,{width,height});await p.screenshot({path:'/tmp/happy-history-'+width+'-'+height+'.png'});await p.locator('#addBtn').click();await p.locator('#amount').evaluate(e=>e.blur());
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await p.locator('#addOverlay .formPanel').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
   await p.locator('#saveTx').scrollIntoViewIfNeeded();
   const save=await p.locator('#saveTx').boundingBox(),nav=await p.locator('#bottom').boundingBox();assert.ok(save.y+save.height<=nav.y+1,'save button must stay above navigation');
   await p.screenshot({path:'/tmp/happy-entry-'+width+'.png'});
   await p.locator('#statsTab').click();await p.waitForFunction(()=>document.querySelector('[data-chart-category]'));await p.locator('#summaryOverlay .summaryPanel').evaluate(e=>e.scrollTop=0);await p.screenshot({path:'/tmp/happy-stats-'+width+'-'+height+'.png'});await p.close();
  }
  console.log(engine.name()+': PASS — entry, double-save, income, errors, edit, drilldown, projection, paginated CSV, deep link/login, rollover, 320–430px layouts');await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
