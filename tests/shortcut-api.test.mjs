import assert from 'node:assert/strict';
import {handleShortcut,categoriesFor} from '../supabase/functions/happy-shortcut/handler.mjs';
const token='hm_'+'a'.repeat(64),request_id='00000000-0000-4000-8000-000000000001';
let inserts=[],revoked=false,enabled=true;
const deps={lookup:async()=>revoked?null:{user_id:'owner',enabled},metadata:async(owner)=>{assert.equal(owner,'owner');return {happy_money_category_catalog:{items:[{name:'Ăn uống',emoji:'🍜'},{name:'Ẩn',archived:true},{name:'Giày',emoji:'👟'}]}}},insert:async(payload)=>{inserts.push(payload);return {ok:true,message:'Đã lưu giao dịch.'}}};
const call=(body,auth='Bearer '+token)=>handleShortcut(new Request('https://fixture.test',{method:'POST',headers:{Authorization:auth},body:JSON.stringify(body)}),deps);
assert.equal((await call({action:'categories'},'')).status,401);
assert.equal((await call({action:'delete'})).status,400);
for(const prefix of ['Bearer  ','bearer ','BEARER\t','  Bearer   ']){
 assert.equal((await call({action:'categories'},prefix+token+'  ')).status,200);
}
for(const malformed of ['Basic '+token,token,'Bearer hm_short','Bearer '+token.slice(0,20)+' '+token.slice(20)]){
 assert.equal((await call({action:'categories'},malformed)).status,401);
}
const categories=await (await call({action:'categories'})).json();assert.deepEqual(categories.categories,['🍜 Ăn uống','👟 Giày','💼 Lương','🏦 Rút tiết kiệm','💰 Khác']);assert.match(categories.request_id,/^[0-9a-f-]{36}$/);
const expense={action:'expense',amount:220000,category:'🍜 Ăn uống',note:'Bữa trưa',request_id};
assert.equal((await call(expense)).status,200);assert.equal(inserts.length,1);assert.equal(inserts[0].p_category,'Ăn uống');assert.equal(inserts[0].p_amount,220000);assert.equal(inserts[0].p_hash.length,64);assert.equal(JSON.stringify(inserts).includes(token),false);
for(const change of [{amount:0},{amount:-1},{amount:1.5},{amount:'1e6'},{amount:'220.000'},{category:'Ẩn'},{category:'other owner category'},{note:'x'.repeat(501)},{request_id:'bad'}])assert.equal((await call({...expense,...change})).status,400);
assert.equal((await call({...expense,amount:'220000',note:''})).status,200);
enabled=false;assert.equal((await call(expense)).status,403);assert.equal((await call({action:'categories'})).status,403);assert.equal(inserts.length,2);enabled=true;
revoked=true;assert.equal((await call(expense)).status,401);assert.equal(inserts.length,2);
assert.equal(categoriesFor({}).length,11);
revoked=false;
assert.equal((await call({...expense,category:'💰 Thu nhập',amount:'1000000',note:'Lương'})).status,200);
assert.equal(inserts.at(-1).p_category,'Thu nhập');assert.equal(inserts.at(-1).p_amount,1000000);assert.equal(inserts.at(-1).p_note,'Lương');
assert.equal((await call({...expense,category:'Thu nhập',note:''})).status,200);
assert.equal(inserts.at(-1).p_category,'Thu nhập');
enabled=false;assert.equal((await call({...expense,category:'💰 Thu nhập'})).status,403);enabled=true;
assert.deepEqual((await (await call({action:'categories',type:'Thu'})).json()).categories,['💼 Lương','🏦 Rút tiết kiệm','💰 Khác']);
assert.deepEqual((await (await call({action:'categories',type:'Chi'})).json()).categories,['🍜 Ăn uống','👟 Giày']);
assert.equal((await call({action:'categories',type:'bad'})).status,400);
assert.equal((await call({...expense,type:'Thu'})).status,400);
assert.equal((await call({...expense,type:'Chi',category:'💰 Thu nhập'})).status,400);
for(const category of ['💼 Lương','🏦 Rút tiết kiệm','💰 Khác']){
 assert.equal((await call({...expense,type:'Thu',category,note:''})).status,200);
 assert.equal(inserts.at(-1).p_category,category==='🏦 Rút tiết kiệm'?'Rút tiết kiệm':'Thu nhập');
 assert.equal(inserts.at(-1).p_note,category==='💼 Lương'?'Lương':'');
}
assert.equal((await call({...expense,type:'Thu',category:'📒 Số dư đầu tháng'})).status,400);
for(const code of ['28001','28000','54000','55000','unexpected']){
 const response=await handleShortcut(new Request('https://fixture.test',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(expense)}),{...deps,lookup:async()=>({user_id:'owner'}),insert:async()=>{throw {code}}});
 assert.equal(response.status,{'28001':403,'28000':401,'54000':429,'55000':409,unexpected:503}[code]);
 assert.equal((await response.text()).includes(token),false);
}
console.log('Shortcut API authentication, validation, category scoping and errors passed.');

const custom=await handleShortcut(new Request('https://fixture.test',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({...expense,type:'Thu',category:'🎁 Thưởng'})}),{...deps,metadata:async()=>({happy_money_income_catalog:{items:[{id:'income-custom-test',name:'Thưởng',emoji:'🎁',kind:'savings'},{id:'income-savings',name:'Chuyển từ tiết kiệm',emoji:'🏦'},{id:'old',name:'Ẩn',archived:true}]}})});
assert.equal(custom.status,200);assert.equal(inserts.at(-1).p_category,'Thu nhập');assert.equal(inserts.at(-1).p_display_category,'Thưởng');
