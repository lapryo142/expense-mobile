(function(root){const api=(function(){
 const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d');
 function summarize(rows,year,{categoryFor}={}){
  const category=categoryFor||(row=>/^(so du )?dau thang/.test(norm(row.description))?'Số dư đầu tháng':/rut (tien )?tiet kiem/.test(norm(row.description))?'Rút tiết kiệm':'');
  const months=Array.from({length:12},(_,i)=>({month:i+1,expense:0,income:0}));
  for(const row of rows||[]){
   if(Number(row.year)!==Number(year)||Number(row.month)<1||Number(row.month)>12)continue;
   if(row.source==='app_edited'&&!String(row.description||'').trim()&&!Number(row.income||0)&&!Number(row.expense||0))continue;
   const kind=category(row);if(kind==='Số dư đầu tháng')continue;
   const item=months[Number(row.month)-1];item.expense+=Number(row.expense||0);
   if(kind!=='Rút tiết kiệm')item.income+=Number(row.income||0);
  }
  return {year:Number(year),months,total:months.reduce((sum,item)=>sum+item.expense,0),maximum:Math.max(0,...months.map(item=>item.expense))};
 }
 return {summarize};
})();if(typeof module==='object'&&module.exports)module.exports=api;else root.HappyAnnual=api;})(globalThis);
