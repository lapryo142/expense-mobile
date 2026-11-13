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
// Historical closing book snapshots retain Sheet adjustments without inflating spending.
const archivedRows=[{id:'archive',year:2025,month:12,txn_date:'2025-12-20',description:'Recorded expense',expense:100,income:0,source:'sheet'}];
const archived={year:2025,month:12,start_balance:1000,bank_balance:500,bank_balance_date:'2025-12-31',savings_balance:2000,savings_balance_date:'2025-12-31',remaining:700,balance_checkpoint:{book:{date:'2025-12-31',amount:700,basis:-100}}};
assert.equal(calc(archivedRows,[archived],2025,12).closing.remaining,700);
assert.equal(calc([{...archivedRows[0],expense:150}],[archived],2025,12).closing.remaining,650);
const nextYear={year:2026,month:1,start_balance:500,bank_balance:400,bank_balance_date:'2026-01-31',savings_balance:2500,savings_balance_date:'2026-01-31'};
const onlyNewYear=calc([],[nextYear],2026,1).closing,withArchive=calc(archivedRows,[archived,nextYear],2026,1).closing;
for(const key of ['opening','bank','savings','remaining'])assert.equal(withArchive[key],onlyNewYear[key]);

 // Comparison views must not back-project later reconciliation gaps into earlier dates.
 const comparisonRows=[
 {id:'sale',year:2026,month:10,txn_date:'2026-10-04',income:2000000,expense:0,description:'Sale'},
 {id:'early',year:2026,month:10,txn_date:'2026-10-02',income:0,expense:1302000,description:'Early expense'},
 {id:'late',year:2026,month:10,txn_date:'2026-10-20',income:0,expense:2234000,description:'Late expense'}];
 const comparisonStatus={year:2026,month:10,start_balance:3225000,bank_balance:1686000,bank_balance_date:'2026-10-29',balance_checkpoint:{bank:{date:'2026-10-29',amount:1686000,basis:1564000}}};
 const comparison=B.build(comparisonRows,[comparisonStatus],{year:2026,month:10}).get(2026,10);
 assert.equal(comparison.at(4).bank,820000);
 assert.equal(comparison.comparisonAt(4).remaining,3923000);
 assert.equal(comparison.comparisonAt(4).bank,null);
 assert.equal(comparison.comparisonAt(4).foodDifference,null);
 assert.equal(comparison.comparisonAt(29).bank,comparison.at(29).bank);
 assert.equal(comparison.comparisonAt(31).foodDifference,comparison.closing.remaining-comparison.closing.bank);
 const archiveComparison=B.build(archivedRows,[archived],{year:2025,month:12}).get(2025,12);
 assert.equal(archiveComparison.comparisonAt(4).remaining,null);
 const zeroComparison=B.build([],[{year:2026,month:11,bank_balance:0,bank_balance_date:'2026-11-04'}],{year:2026,month:11}).get(2026,11);
 assert.equal(zeroComparison.comparisonAt(4).bank,0);
 assert.equal(zeroComparison.comparisonAt(3).bank,null);
 console.log('Comparison dates: PASS — no invented historical balances, same-day zero preserved');

const undatedComparison=B.build([{id:'unknown-day',year:2026,month:3,txn_date:null,expense:205000,income:0,description:'Expense'}],[{year:2026,month:3,start_balance:1000000}],{year:2026,month:3}).get(2026,3);
assert.equal(undatedComparison.comparisonAt(4).remaining,null);
assert.equal(undatedComparison.comparisonAt(4).bank,null);
assert.equal(undatedComparison.comparisonAt(31).remaining,795000);

// Missing historical values carry the closest earlier month, never a later snapshot.
assert.equal(comparison.comparisonSnapshot(12).bank,null);
assert.equal(comparison.comparisonSnapshot(12,12).bank,null);
assert.equal(comparison.comparisonSnapshot(29).usesFallback,false);
assert.equal(zeroComparison.comparisonSnapshot(3).bank,null,'do not use a later zero snapshot');
assert.equal(zeroComparison.comparisonSnapshot(4).bank,0);
assert.equal(archiveComparison.comparisonSnapshot(4).bank,null);
assert.equal(undatedComparison.comparisonSnapshot(4).bank,null);
const priorStatus={year:2026,month:9,start_balance:1000000,bank_balance:500000,bank_balance_date:'2026-09-20'};
const history=B.build(comparisonRows,[priorStatus,comparisonStatus],{year:2026,month:10});
const carried=history.get(2026,10).comparisonSnapshot(12);
assert.equal(carried.date,'2026-09-30');
assert.equal(carried.bank,500000);
assert.equal(carried.foodDifference,500000);
assert.equal(carried.usesFallback,true);
assert.equal(history.get(2026,10).comparisonAt(12).bank,null);
assert.equal(history.get(2026,10).comparisonSnapshot(29).date,'2026-10-29');
const emptyGap=B.build(comparisonRows,[{...priorStatus,month:8,bank_balance_date:'2026-08-20'},comparisonStatus],{year:2026,month:10});
assert.equal(emptyGap.get(2026,10).comparisonSnapshot(12).date,'2026-08-31','skip empty synthetic months');
const yearBoundary=B.build([],[{year:2025,month:12,start_balance:1000,bank_balance:0,bank_balance_date:'2025-12-31'},{year:2026,month:1,bank_balance:900,bank_balance_date:'2026-01-29'}],{year:2026,month:1});
assert.equal(yearBoundary.get(2026,1).comparisonSnapshot(12).date,'2025-12-31');
assert.equal(yearBoundary.get(2026,1).comparisonSnapshot(12).bank,0);
const earlierSnapshot=B.build([], [{year:2026,month:11,start_balance:1000,bank_balance:500,bank_balance_date:'2026-11-07'}],{year:2026,month:11}).get(2026,11);
assert.equal(earlierSnapshot.comparisonSnapshot(12,12).date,'2026-11-12');
assert.equal(earlierSnapshot.comparisonSnapshot(12,12).usesFallback,false);
assert.equal(earlierSnapshot.comparisonSnapshot(12,12).bank,500);
console.log('Prior-date fallback: PASS — no look-ahead, nearest available period, empty months, year rollover, explicit zero');
