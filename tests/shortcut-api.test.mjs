import assert from 'node:assert/strict';
import {handleShortcut,categoriesFor} from '../supabase/functions/happy-shortcut/handler.mjs';
const token='hm_'+'a'.repeat(64),request_id='00000000-0000-4000-8000-000000000001';
let inserts=[],revoked=false;
const deps={lookup:async()=>revoked?null:{user_id:'owner'},metadata:async(owner)=>{assert.equal(owner,'owner');return {happy_money_category_catalog:{items:[{name:'Ăn uống',emoji:'🍜'},{name:'Ẩn',archived:true},{name:'Giày',emoji:'👟'}]}}},insert:async(payload)=>{inserts.push(payload);return {ok:true,message:'Đã lưu giao dịch.'}}};
const call=(body,auth='Bearer '+token)=>handleShortcut(new Request('https://fixture.test',{method:'POST',headers:{Authorization:auth},body:JSON.stringify(body)}),deps);
assert.equal((await call({action:'categories'},'')).status,401);
assert.equal((await call({action:'delete'})).status,400);
const categories=await (await call({action:'categories'})).json();assert.deepEqual(categories.categories,['🍜 Ăn uống','👟 Giày']);assert.match(categories.request_id,/^[0-9a-f-]{36}$/);
const expense={action:'expense',amount:220000,category:'🍜 Ăn uống',note:'Bữa trưa',request_id};
assert.equal((await call(expense)).status,200);assert.equal(inserts.length,1);assert.equal(inserts[0].p_category,'Ăn uống');assert.equal(inserts[0].p_amount,220000);assert.equal(inserts[0].p_hash.length,64);assert.equal(JSON.stringify(inserts).includes(token),false);
for(const change of [{amount:0},{amount:-1},{amount:1.5},{amount:'1e6'},{amount:'220.000'},{category:'Ẩn'},{category:'other owner category'},{note:'x'.repeat(501)},{request_id:'bad'}])assert.equal((await call({...expense,...change})).status,400);
assert.equal((await call({...expense,amount:'220000',note:''})).status,200);
revoked=true;assert.equal((await call(expense)).status,401);assert.equal(inserts.length,2);
assert.equal(categoriesFor({}).length,11);
for(const code of ['28000','54000','55000','unexpected']){
 const response=await handleShortcut(new Request('https://fixture.test',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(expense)}),{...deps,lookup:async()=>({user_id:'owner'}),insert:async()=>{throw {code}}});
 assert.equal(response.status,{'28000':401,'54000':429,'55000':409,unexpected:503}[code]);
 assert.equal((await response.text()).includes(token),false);
}
console.log('Shortcut API authentication, validation, category scoping and errors passed.');
