(function(root){const api=(function(root){
 'use strict';
 const categoryNames={'Lương':'Salary','Ăn uống':'Food','Di chuyển & xe':'Transport & car','Nhà cửa & hóa đơn':'Home & bills','Dịch vụ số':'Digital services','Tennis':'Tennis','Mua sắm':'Shopping','Gia đình & quà tặng':'Family & gifts','Sunny & sức khỏe':'Sunny & health','Giải trí & sách':'Entertainment & books','Tiền mặt & lặt vặt':'Cash & miscellaneous','Chưa phân loại':'Uncategorized','Thu nhập':'Income','Rút tiết kiệm':'Savings withdrawal','Số dư đầu tháng':'Opening balance'};
 const categoryLabel=(name,lang=language)=>lang==='en'?(categoryNames[name]||name):name;
 const dictionary={
"Tìm kiếm giao dịch":"Search transactions","Tìm kiếm":"Search","Nhập ghi chú hoặc danh mục":"Search notes or categories","Xóa tìm kiếm":"Clear search","Thời gian tìm kiếm":"Search period","Tất cả thời gian":"All time","Khoảng ngày":"Date range","Từ ngày":"From date","Đến ngày":"To date","Số khoản":"Transactions","Đang tìm giao dịch…":"Loading transactions\u2026","Không tải được giao dịch. Thử lại nhé.":"Could not load transactions. Please retry.","Thử lại":"Retry","Nhập từ khóa để tìm qua tất cả các năm.":"Search notes or categories across all years.","Chọn đủ ngày bắt đầu và kết thúc.":"Choose both a start and an end date.","Ngày bắt đầu phải trước hoặc trùng ngày kết thúc.":"The start date must be on or before the end date.","Không có giao dịch phù hợp":"No matching transactions",

'Còn lại trong ngân hàng':'Bank balance','Còn lại theo sổ':'Book balance','Chênh lệch ăn uống':'Balance difference','Tiết kiệm':'Savings','Gửi vợ':'Sent to wife','Số dư đầu tháng':'Opening balance','Chi trung bình / ngày':'Daily average','Mua trả sau tháng này':'Pay later this month','Danh mục':'Categories','Tên':'Name','Màu':'Color','Xuất dữ liệu':'Export data','Thu nhập thực':'Earned income','Tổng chi':'Total spending','Khoản chi lớn nhất':'Largest expense','Mua trả sau':'Pay later','Chưa phân loại':'Uncategorized','Top nội dung chi nhiều nhất':'Top expenses','Chỉ số':'Metric','Số tiền':'Amount','Ngày ghi nhận':'Reconciliation date','Ghi chú':'Note','Ngày':'Date','Nội dung':'Note','Chi trung bình/ngày':'Daily average',

 'Chạm một tháng để xem chi tiết':'Tap a month to see its breakdown','Chạm lại tháng đang chọn để xem cả năm':'Tap it again to see the whole year',
  'Thống kê năm':'Yearly analytics','Khoảng thời gian thống kê':'Analytics period','Năm trước':'Previous year','Năm sau':'Next year','Biểu đồ chi tiêu từng tháng':'Monthly spending chart','Nội dung':'Note','Nguồn':'Source','Số dư vừa được cập nhật ở nơi khác. Anh thử lại nhé.':'The balance changed elsewhere. Please try again.','Chi tiêu':'Expenses','Nhập':'Tap','Thống kê':'Analytics','Cài đặt':'Settings','Mở cài đặt':'Open settings','Mở thống kê':'Open analytics','Điều hướng chính':'Main navigation',
  'Tổng chi':'Total spending','Tổng chi trong tháng':'Total spent this month','Tháng':'Month','Năm':'Year','Chọn năm':'Select year','Chi tiêu trong năm':'Yearly spending','Chi theo tháng':'By month','Các tháng trong năm':'Months of the year','Chưa có khoản chi trong năm này':'No spending recorded this year',
  'CÒN LẠI TRONG NGÂN HÀNG':'BANK BALANCE','CÒN LẠI THEO SỔ':'BOOK BALANCE','CHÊNH LỆCH ĂN UỐNG':'BALANCE DIFFERENCE','TIẾT KIỆM':'SAVINGS','GỬI VỢ':'SENT TO WIFE','SỐ DƯ ĐẦU THÁNG':'OPENING BALANCE','CHI TRUNG BÌNH / NGÀY':'DAILY AVERAGE','MUA TRẢ SAU THÁNG NÀY':'PAY LATER THIS MONTH',
  'Nhấn giữ để sửa':'Hold to edit','Từ ngân hàng tháng trước':"From the previous month's bank balance",'Tính vào chi tiêu, chưa trừ số ngân hàng':'Included in spending, not yet debited from bank',
  'Chi':'Expense','Thu':'Income','Anh đã chi bao nhiêu?':'How much did you spend?','Anh đã thu bao nhiêu?':'How much did you receive?','Hôm nay':'Today','Hôm qua':'Yesterday','Chọn ngày':'Pick date','Ghi chú':'Note','Trả sau':'Pay later','Danh mục':'Category','Lương':'Salary','Rút tiết kiệm':'Withdraw savings','Khác':'Other',
  'Lưu giao dịch':'Save transaction','Đang lưu…':'Saving…','Lưu':'Save','Hủy':'Cancel','Đóng':'Close','Quay lại':'Back','Quay lại bàn phím số':'Return to number pad','Số tiền bằng đồng Việt Nam':'Amount in Vietnamese dong','Bàn phím nhập số tiền':'Amount keypad','Thêm ba số không':'Add three zeros','Xóa một chữ số':'Delete a digit',
  'Giao diện':'Appearance','Tối':'Dark','Sáng':'Light','Đổi giao diện':'Change appearance','Ẩn số nhạy cảm':'Hide sensitive amounts','Hiện số nhạy cảm':'Show sensitive amounts','Số dư và thu nhập trên thiết bị này':'Balances and income on this device','Ngôn ngữ':'Language','DANH MỤC':'CATEGORIES','Chạm danh mục để sửa, kéo để sắp xếp.':'Tap a category to edit, drag to reorder.','+ Thêm danh mục':'+ Add category',
  'Thêm danh mục':'Add category','Sửa danh mục':'Edit category','Lưu danh mục':'Save category','Lưu thay đổi':'Save changes','Hủy chỉnh sửa danh mục':'Cancel category editing','Tên danh mục':'Category name','TÊN':'NAME','MÀU':'COLOR','Chọn emoji':'Choose emoji','Emoji khác':'Other emoji','Emoji tùy chọn':'Custom emoji','Chọn':'Choose',
  'Đã lưu danh mục.':'Category saved.','Anh chọn một emoji nhé.':'Choose one emoji.','Danh mục này đã có rồi.':'This category already exists.','Đã đạt tối đa 100 danh mục.':'The limit of 100 categories has been reached.','Đã lưu trên máy; chưa đồng bộ được. Sẽ thử lại khi mở app.':'Saved on this device; sync will retry when you open the app.','Chưa lưu được danh mục. Anh thử lại nhé.':"Couldn't save the category. Please try again.",
  'XUẤT DỮ LIỆU':'EXPORT DATA','Tháng đang xem':'Selected month','Năm đang xem':'Selected year','Toàn bộ dữ liệu':'All data','Khoảng thời gian xuất CSV':'CSV date range','Xuất bản sao dữ liệu':'Export a copy of your data','Đang xuất…':'Exporting…','Tải giao dịch và danh mục trong khoảng đã chọn dưới dạng CSV.':'Download transactions and categories in the selected period as CSV.',
  'Các số ngân hàng, tiết kiệm và gửi vợ được chỉnh trực tiếp ở màn hình Chi tiêu.':'Edit bank, savings and sent-to-wife balances directly on Expenses.','Đăng xuất':'Sign out',
  'THU NHẬP THỰC':'EARNED INCOME','TỔNG CHI':'TOTAL SPENDING','KHOẢN CHI LỚN NHẤT':'LARGEST EXPENSE','MUA TRẢ SAU':'PAY LATER','Đã tính vào tổng chi · chưa trừ số ngân hàng':'Included in total spending · not yet debited from bank','Chi theo danh mục':'By category','CHƯA PHÂN LOẠI':'UNCATEGORIZED','TOP NỘI DUNG CHI NHIỀU NHẤT':'TOP EXPENSES','CHỈ SỐ':'METRIC','Đã chi':'Spent','Chi trung bình/ngày':'Daily average','Còn lại theo sổ':'Book balance','Trong ngân hàng':'Bank balance','Chênh lệch ăn uống':'Balance difference','Dự tính cuối tháng':'Projected month-end spending',
  'Chưa có dữ liệu tháng trước':'No data for the previous month','Chưa có khoản chi':'No expenses yet','Chưa có khoản chi trong tháng này':'No expenses recorded this month','Chưa có giao dịch':'No transactions yet','Chưa rõ ngày':'Date unknown','Chưa có giao dịch trong danh mục này':'No transactions in this category','Chi tiết danh mục':'Category details','Không có nội dung':'No note',
  'Đang tính thống kê…':'Calculating analytics…','Đang tải…':'Loading…','Đang tải biểu đồ…':'Loading chart…','Chưa tải được dữ liệu. Anh kéo xuống để thử lại.':"Couldn't load data. Pull down to try again.",'Chưa tải được số dư. Anh kéo xuống để thử lại.':"Couldn't load balances. Pull down to try again.",
  'Sửa chi tiêu':'Edit expense','Sửa khoản thu':'Edit income','Chỉnh số':'Edit amount','SỐ TIỀN':'AMOUNT','NGÀY GHI NHẬN':'RECONCILIATION DATE','GHI CHÚ':'NOTE','NGÀY':'DATE','NỘI DUNG':'NOTE','Số tiền giao dịch':'Transaction amount','Nội dung giao dịch':'Transaction note','Ngày giao dịch':'Transaction date','Nguồn thanh toán':'Payment method','Ngân hàng':'Bank','Tiền mặt':'Cash','Xóa giao dịch':'Delete transaction','Đang xóa…':'Deleting…','Số dư đầu tháng':'Opening balance','Còn lại trong ngân hàng':'Bank balance','Tiết kiệm':'Savings','Gửi vợ':'Sent to wife',
  'Anh nhập số tiền hợp lệ trước nhé.':'Enter a valid amount first.','Anh chọn danh mục hoặc nhập nội dung giao dịch nhé.':'Choose a category or enter a note.','Anh chọn ngày giao dịch nhé.':'Choose a transaction date.','Phiên đăng nhập đã hết. Anh đăng nhập lại nhé.':'Your session has expired. Please sign in again.','Anh chọn ngày trong tháng đang chỉnh nhé.':'Choose a date within the month being edited.','Anh nhập số tiền, hoặc nhập 0 nếu muốn đặt số dư bằng 0.':'Enter an amount, or enter 0 to set a zero balance.','Anh kiểm tra nội dung, số tiền và ngày giao dịch nhé.':'Check the note, amount and transaction date.',
  '↓ Kéo xuống để làm mới':'↓ Pull down to refresh','↑ Thả để làm mới':'↑ Release to refresh','↻ Đang cập nhật…':'↻ Refreshing…','✓ Đã cập nhật':'✓ Updated','Không thể cập nhật':"Couldn't refresh",'Làm mới':'Refresh',
  'Chào mừng trở lại':'Welcome back','Đăng nhập':'Sign in','Đăng ký':'Sign up','Tạo tài khoản':'Create account','Mật khẩu':'Password','Email của bạn':'Your email','Nhập mật khẩu':'Enter password','Đăng nhập bằng Face ID':'Sign in with Face ID','Đăng nhập bằng Face ID để tiếp tục.':'Sign in with Face ID to continue.','Đăng nhập để quản lý thu chi của bạn.':'Sign in to manage your money.','Đăng nhập một lần, mở app là vào ngay.':'Sign in once, then open the app to get started.','Đăng nhập bằng mật khẩu':'Sign in with password','Dùng mật khẩu':'Use password','Đang xác thực…':'Authenticating…','Đang đăng nhập…':'Signing in…','Đang tạo passkey…':'Creating passkey…',
  'Bật đăng nhập bằng Face ID / passkey':'Enable Face ID / passkey sign-in','Bật đăng nhập bằng Face ID':'Enable Face ID sign-in','Thêm thiết bị đăng nhập':'Add a sign-in device','Dùng Face ID khi cần đăng nhập lại.':'Use Face ID when you need to sign in again.','Đã bật Face ID. App sẽ ghi nhớ phiên đăng nhập trên thiết bị này.':'Face ID enabled. The app will remember your session on this device.','Bạn vẫn có thể đăng nhập bằng mật khẩu trên thiết bị này.':'You can still sign in with a password on this device.','Đã tạo tài khoản. Kiểm tra email nếu cần xác nhận.':'Account created. Check your email if confirmation is required.',
  'Mở nhanh bằng Back Tap / Siri':'Quick launch with Back Tap / Siri','Tạo một phím tắt iPhone để mở thẳng màn hình Thêm giao dịch:':'Create an iPhone shortcut to open transaction entry directly:','Tạo một phím tắt iPhone để mở thẳng màn hình Thêm giao dịch':'Create an iPhone shortcut to open transaction entry directly',
  'Mở ứng dụng Phím tắt → tạo phím tắt mới → thêm tác vụ “Mở URL” với đường dẫn trên.':'Open Shortcuts → create a shortcut → add “Open URL” using the address above.','Đặt tên “Ghi chi tiêu”. Anh có thể gọi Siri theo tên này hoặc thêm phím tắt ra màn hình chính.':'Name it “Log expense”. Use Siri to run it, or add it to your Home Screen.','Để gõ mặt lưng: Cài đặt → Trợ năng → Cảm ứng → Chạm vào mặt sau → Chạm hai lần → chọn phím tắt vừa tạo.':'For Back Tap: Settings → Accessibility → Touch → Back Tap → Double Tap → select your shortcut.','Phím tắt sẽ mở Happy Money để anh nhập và lưu. iPhone có thể yêu cầu mở khóa; nếu hết phiên, đăng nhập rồi màn hình nhập sẽ tự mở.':'The shortcut opens Happy Money for entry. Your iPhone may require unlocking. If your session has expired, sign in and entry will open automatically.'
 };
 let language='vi';try{language=root.localStorage?.getItem('happy_money_language')==='en'?'en':'vi'}catch{}
 const locale=()=>language==='en'?'en-US':'vi-VN';
 function translate(value,lang=language){
  const raw=String(value??'');if(lang!=='en'||!raw.trim())return raw;const text=raw.trim();let result=dictionary[text];
  if(!result){
   const patterns=[[/^Năm (\d{4})$/,'Year $1'],
    [/^Tháng (\d+) · (\d{4})$/,'Month $1 · $2'],[/^Tháng (\d+)$/,'Month $1'],[/^Đến (.+)$/,'As of $1'],[/^Ngày (.+)$/,'Date $1'],
    [/^Chi giảm (\d+)%$/,'Spending down $1%'],[/^Chi tăng (\d+)%$/,'Spending up $1%'],[/^So với tháng trước · cùng kỳ ngày (\d+)$/,'Vs last month · through day $1'],
    [/^Cùng kỳ đến ngày (.+)$/,'Same period through $1'],[/^(\d+) giao dịch · Tháng (\d+)\/(\d+)$/,'$1 entries · Month $2/$3'],
    [/^(.+)\/ngày bình quân · nếu giữ mức chi hiện tại$/,'$1/day average · at the current pace'],[/^(.+)\/ngày bình quân$/,'$1/day average'],
    [/^(\d{2}\/\d{2}) · Chạm để phân loại$/,'$1 · Tap to categorize'],[/^Màu (\d+)$/,'Color $1'],[/^T(\d+)$/,'M$1']
   ];
   for(const [pattern,replacement] of patterns)if(pattern.test(text)){result=text.replace(pattern,replacement);break}
  }
  if(!result){
   const prefixes={'Chưa lưu được giao dịch. ':"Couldn't save the transaction. ",'Chưa cập nhật được giao dịch. ':"Couldn't update the transaction. ",'Chưa xóa được giao dịch. ':"Couldn't delete the transaction. ",'Chưa cập nhật được số dư. ':"Couldn't update the balance. ",'Chưa tải được số dư. ':"Couldn't load balances. ",'Không thể xuất dữ liệu. ':"Couldn't export data. ",'Sửa giao dịch ':'Edit transaction ','Chỉnh giao dịch ':'Edit transaction ','Sửa danh mục ':'Edit category ','Xóa danh mục ':'Delete category ','Kéo để sắp xếp ':'Drag to reorder ','Xem chi tiết ':'View details ','Chọn ':'Choose '};
   for(const [prefix,en] of Object.entries(prefixes))if(text.startsWith(prefix)){result=en+(['Sửa danh mục ','Xóa danh mục ','Kéo để sắp xếp ','Xem chi tiết '].includes(prefix)?categoryLabel(text.slice(prefix.length),lang):text.slice(prefix.length));break}
  }
  if(!result&&/^Xóa “/.test(text))result=text.replace(/^Xóa “/,'Delete “').replace('Thao tác này không thể hoàn tác.','This action cannot be undone.').replace('Các giao dịch đã ghi vẫn được giữ nguyên.','Recorded transactions will be kept.');
  if(result)result=result.replace(/Các giao dịch đã ghi vẫn được giữ nguyên\.$/,'Recorded transactions will be kept.').replace(/Anh kiểm tra kết nối rồi thử lại nhé\.$/,'Please check your connection and try again.');
  return result?raw.replace(text,result):raw;
 }
 const doc=root.document;
 let apply=()=>{};
 function setLanguage(value){
  language=value==='en'?'en':'vi';try{root.localStorage?.setItem('happy_money_language',language)}catch{}
  if(doc){apply();root.dispatchEvent(new root.CustomEvent('happy-language-change',{detail:{language}}))}
 }
 if(doc){
  const skip='script,style,code,textarea,[data-category-label],[data-user-content],#entryNoteSizer,.txName,.txNote,.txCategory,.categoryText,.catalogName,.categoryTxName,.reviewName,.topName,.spendBarName,#categoryPageTitle,#category,#editTxCategory,.sideStat .statNote';
  const texts=new WeakMap(),attributes=new WeakMap();let scheduled=false;
  const ignored=node=>(node.nodeType===1?node:node.parentElement)?.closest(skip);
  const observer=new root.MutationObserver(records=>{
   if(records.every(record=>ignored(record.target)))return;
   if(!scheduled){scheduled=true;root.queueMicrotask(()=>{scheduled=false;apply()})}
  });
  function text(node){
   if(ignored(node))return;const state=texts.get(node),original=state&&node.data===state.last?state.original:node.data,last=translate(original);
   texts.set(node,{original,last});if(node.data!==last)node.data=last;
  }
  apply=()=>{
   observer.disconnect();doc.documentElement.lang=language;
   const walker=doc.createTreeWalker(doc.body,root.NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))text(node);
   for(const el of doc.body.querySelectorAll('[placeholder],[aria-label],[title]')){
    let states=attributes.get(el);if(!states){states={};attributes.set(el,states)}
    for(const name of ['placeholder','aria-label','title'])if(el.hasAttribute(name)){
     const current=el.getAttribute(name),state=states[name],original=state&&current===state.last?state.original:current,last=translate(original);states[name]={original,last};if(current!==last)el.setAttribute(name,last);
    }
   }
   for(const el of doc.body.querySelectorAll('[data-category-label]')){const label=categoryLabel(el.dataset.categoryLabel);if(el.textContent!==label)el.textContent=label;}
   const select=doc.getElementById('languageSelect');if(select)select.value=language;
   observer.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
  };
  const nativeAlert=root.alert?.bind(root),nativeConfirm=root.confirm?.bind(root);
  if(nativeAlert)root.alert=message=>nativeAlert(translate(message));
  if(nativeConfirm)root.confirm=message=>nativeConfirm(translate(message));
  apply();
 }
 return {translate,categoryLabel,setLanguage,getLanguage:()=>language,locale,apply};
})(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.HappyI18n=api;})(globalThis);

