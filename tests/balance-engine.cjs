const assert=require('node:assert/strict');const B=require('../balance-engine');
const r=(id,month,day,income=0,expense=0,extra={})=>({id,year:2026,month,txn_date:`2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,income,expense,source:'app',description:'Chi tiêu',...extra});
const snap=(s,rows)=>({...s,balance_checkpoint:B.checkpointFor(s,rows)});
const calc=(rows,statuses,y=2026,m=11)=>B.build(rows,statuses,{year:y,month:m}).get(y,m);
// Previous bank/savings carry, including gaps, December->January and explicit zero.
const oct={year:2026,month:10,bank_balance:5000000,bank_balance_date:'2026-10-31',savings_balance:20000000,savings_balance_date:'2026-10-31'};
assert.equal(calc([], [oct]).at(3).opening,5000000);assert.equal(calc([], [oct]).at(3).savings,20000000);
assert.equal(calc([], [oct],2027,1).at(1).opening,5000000);
const zero={year:2026,month:11,start_balance:0,balance_checkpoint:{start:{amount:0,date:'2026-11-01',basis:0}}};assert.equal(calc([], [oct,zero]).at(3).opening,0);
assert.equal(calc([r('open',11,1,0,0,{description:'Đầu tháng'})],[oct]).at(3).opening,0);
assert.equal(calc([r('opening',11,1,100000,0,{description:'Đầu tháng'})],[oct,{year:2026,month:11,start_balance:200000}]).at(3).opening,200000);
// Funding is a transfer, not earned income. Cash/pay later do not debit bank.
let rows=[r('expense',11,1,0,200000),r('income',11,1,300000),r('withdraw',11,2,1000000,0,{description:'Rút tiết kiệm'}),r('later',11,3,0,500000,{payment_method:'pay_later'}),r('cash',11,3,0,400000,{payment_method:'cash'})];
let v=calc(rows,[oct]).at(3);assert.equal(v.bank,6100000);assert.equal(v.savings,19000000);assert.equal(v.remaining,5200000);
// Reconciliation basis includes same-day rows once; later backdated insert/edit/delete are deltas.
const base={year:2026,month:11,bank_balance:7000000,bank_balance_date:'2026-11-02',savings_balance:19000000,savings_balance_date:'2026-11-02'};
const anchored=snap(base,rows);assert.equal(calc(rows,[oct,anchored]).at(3).bank,7000000);
rows=[...rows,r('backdated',11,2,0,100000)];assert.equal(calc(rows,[oct,anchored]).at(3).bank,6900000);
rows=rows.map(x=>x.id==='expense'?{...x,expense:350000}:x);assert.equal(calc(rows,[oct,anchored]).at(3).bank,6750000);
rows=rows.map(x=>x.id==='withdraw'?{...x,description:'',source:'app_edited',income:0,txn_date:null}:x);v=calc(rows,[oct,anchored]).at(3);assert.equal(v.bank,5750000);assert.equal(v.savings,20000000);
// Checkpoint survives Sheet source changes with stable row IDs and backdated moves.
assert.equal(calc(rows.map(x=>x.id==='expense'?{...x,source:'sheet'}:x),[oct,anchored]).at(3).bank,5750000);
const moved=rows.map(x=>x.id==='backdated'?{...x,month:12,txn_date:'2026-12-02'}:x);assert.equal(calc(moved,[oct,anchored]).at(3).bank,5850000);assert.equal(calc(moved,[oct,anchored],2026,12).at(2).bank,5750000);
// Future rows and undated imported rows are not made into today's expenses.
assert.equal(calc([r('future',11,10,0,200000)], [oct]).at(3).bank,5000000);
assert.equal(calc([r('unknown',11,1,0,200000,{txn_date:null})],[oct]).at(3).bank,5000000);
// Wife status is debited once, including when there is already a matching expense.
const wife={year:2026,month:11,send_wife:1000000,send_wife_date:'2026-11-02'};
assert.equal(calc([r('wife',11,2,0,1000000,{description:'Gửi vợ'})],[oct,wife]).at(3).bank,4000000);assert.equal(calc([],[oct,wife]).at(3).bank,4000000);
// Existing explicit snapshots of zero override inheritance; refreshed Sheet snapshots reset their basis.
assert.equal(calc([],[oct,{year:2026,month:11,bank_balance:0,bank_balance_date:'2026-11-03'}]).at(3).bank,0);
const changed={...anchored,bank_balance:9000000};assert.equal(calc(rows,[oct,changed]).at(3).bank,9000000);
assert.equal(B.lastDay(2028,2),29);assert.equal(B.lastDay(2027,2),28);
console.log('balance-engine: PASS — carry, explicit zero, snapshots, transfers, backdates, edit/delete/move, reconciliation, cash/pay later, Sheet sync, wife, leap years');
