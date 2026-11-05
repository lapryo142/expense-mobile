const defaults=[['Ăn uống','🍜'],['Di chuyển & xe','🚗'],['Nhà cửa & hóa đơn','🏠'],['Dịch vụ số','💻'],['Tennis','🎾'],['Mua sắm','🛍️'],['Gia đình & quà tặng','🎁'],['Sunny & sức khỏe','☀️'],['Giải trí & sách','🎬'],['Tiền mặt & lặt vặt','💵'],['Chưa phân loại','🏷️']];
export function categoriesFor(metadata={}){
 const source=Array.isArray(metadata.happy_money_category_catalog?.items)?metadata.happy_money_category_catalog.items:defaults.map(([name,emoji],index)=>({id:'default-'+index,name,emoji}));
 const seen=new Set();
 return source.filter(item=>item&&!item.archived&&typeof item.name==='string'&&item.name.trim()&&item.name.length<=64&&!seen.has(item.name)&&(seen.add(item.name),true)).slice(0,100).map(item=>({name:item.name,label:String(item.emoji||'🏷️')+' '+item.name}));
}
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
export async function handleShortcut(req,deps){
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{ok:false,message:'Chỉ hỗ trợ POST.'});
 const authorization=(req.headers.get('authorization')||'').trim();
 const match=authorization.match(/^Bearer[ \t]+(.+)$/i);
 const token=match?match[1].trim():'';
 if(!/^hm_[0-9a-f]{64}$/.test(token))return reply(401,{ok:false,message:'Mã kết nối gửi lên chưa đúng. Kiểm tra Header Authorization và sao chép nguyên mã từ Happy Money.'});
 try{
  if(Number(req.headers.get('content-length')||0)>4096)return reply(413,{ok:false,message:'Yêu cầu quá dài.'});
  const raw=await req.text();if(raw.length>4096)return reply(413,{ok:false,message:'Yêu cầu quá dài.'});
  let input;try{input=JSON.parse(raw)}catch{return reply(400,{ok:false,message:'JSON không hợp lệ.'})}
  if(!input||typeof input!=='object'||!['categories','expense'].includes(input.action))return reply(400,{ok:false,message:'Thao tác không hợp lệ.'});
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),byte=>byte.toString(16).padStart(2,'0')).join('');
  const connection=await deps.lookup(hash);
  if(!connection)return reply(401,{ok:false,message:'Kết nối đã hết hạn hoặc bị thu hồi.'});
  if(connection.enabled===false)return reply(403,{ok:false,message:'Back Tap đang tắt. Bật lại trong Cài đặt Happy Money.'});
  // Keep existing Shortcuts compatible: the chosen income category determines direction.
  const categories=[...categoriesFor(await deps.metadata(connection.user_id)).filter(item=>item.name!=='Thu nhập'),{name:'Thu nhập',label:'💰 Thu nhập'}];
  if(input.action==='categories')return reply(200,{ok:true,categories:categories.map(item=>item.label),request_id:crypto.randomUUID()});
  const amount=typeof input.amount==='number'?input.amount:typeof input.amount==='string'&&/^\d+$/.test(input.amount)?Number(input.amount):NaN;
  const category=categories.find(item=>item.label===input.category||item.name===input.category);
  if(!Number.isSafeInteger(amount)||amount<=0||amount>1000000000000||!category||typeof input.note!=='string'||input.note.length>500||typeof input.request_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.request_id)){
   return reply(400,{ok:false,message:'Kiểm tra số tiền, danh mục, ghi chú và mã yêu cầu.'});
  }
  const result=await deps.insert({p_hash:hash,p_request_id:input.request_id,p_amount:amount,p_category:category.name,p_note:input.note.trim()});
  return reply(200,result);
 }catch(error){
  if(error?.code==='28001')return reply(403,{ok:false,message:'Back Tap đang tắt. Bật lại trong Cài đặt Happy Money.'});
  if(error?.code==='28000')return reply(401,{ok:false,message:'Kết nối đã bị thu hồi.'});
  if(error?.code==='54000')return reply(429,{ok:false,message:'Đã nhập quá nhiều lần. Anh thử lại sau.'});
  if(error?.code==='55000')return reply(409,{ok:false,message:'Mở Happy Money và làm mới số dư trước khi dùng Back Tap.'});
  return reply(503,{ok:false,message:'Chưa lưu được. Giữ nguyên mã yêu cầu khi thử lại để tránh trùng.'});
 }
}
