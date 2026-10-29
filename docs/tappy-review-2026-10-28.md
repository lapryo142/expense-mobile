# Happy Money: tham khảo Tappy và phạm vi áp dụng

Ngày rà soát: 28/10/2026. App tham khảo: [Tappy – Daily Expense Tracker, Arranged Social LLP](https://apps.apple.com/us/app/tappy-daily-expense-tracker/id6777520962), App Store ID 6777520962.

## Cơ sở nghiên cứu

Đã đọc mô tả, lịch sử cập nhật và đánh giá trên App Store; xem sáu ảnh giới thiệu chính thức (nhập tiền, danh mục, lịch sử, báo cáo, cài đặt, truy cập nhanh). Chưa cài hoặc thao tác trên bản iOS; không suy đoán tốc độ thực tế hay chất lượng đồng bộ từ nội dung quảng cáo.

Tappy đặt số tiền lên trước, dùng danh mục dạng chip có biểu tượng và bàn phím số. Báo cáo cho phép mở danh mục để xem giao dịch; có chi trung bình, dự tính cuối tháng và biểu đồ năm. Các cập nhật bổ sung ngày hôm qua, chu kỳ ngân sách tùy chọn, CSV theo khoảng ngày và sao lưu iCloud. Back Tap, Siri và widget là những lối vào được nhà phát triển giới thiệu.

## Đối chiếu với mã nguồn Happy Money

Đọc `index.html`, `manifest.json` và cơ chế đồng bộ Sheets trong repository `lapryo142/expense-mobile`, nền ban đầu commit `16fc349`.

| Nhu cầu | Happy Money trước thay đổi | Quyết định và lý do |
|---|---|---|
| Ghi khoản chi nhanh | 10 nút danh mục chiếm nhiều hàng trước ô số tiền; bắt buộc nội dung | Đưa số tiền lên đầu, danh mục vuốt ngang có emoji; chọn danh mục rõ ràng thì được bỏ ghi chú. Tên danh mục được lưu làm nội dung để Sheets vẫn đọc được. |
| Nhập ngày cũ | Có ngày tùy chọn và Hôm nay | Thêm Hôm qua, tính theo lịch địa phương và xử lý qua đầu tháng/năm. |
| Sửa, xóa | Đã có nhưng phải biết nhấn giữ | Chạm giao dịch để mở màn hình sửa/xóa; hỗ trợ bàn phím, giữ cách nhấn giữ cũ. |
| Xem chi từng danh mục | Đã có biểu đồ và bộ chọn danh mục riêng | Chạm trực tiếp tên danh mục bên biểu đồ để mở danh sách hiện có. Không tạo báo cáo trùng lặp. |
| Định hướng cuối tháng | Đã có bình quân ngày và so sánh cùng kỳ | Thêm ước tính theo tốc độ chi hiện tại, chỉ cho tháng hiện tại, ghi rõ giả định. Không coi là số dư hay hạn mức còn được chi. |
| Xuất dữ liệu | Chỉ xuất toàn bộ, một truy vấn | Chọn tháng/năm đang xem hoặc toàn bộ; phân trang để xuất lịch sử dài. Bảo toàn dấu tiếng Việt, loại bản ghi đã xóa, vô hiệu công thức từ nội dung khi mở CSV. |
| Mở màn hình nhập | Mở app rồi nhấn Thêm | Thêm `/?action=add`, giữ yêu cầu đến sau đăng nhập, có hướng dẫn Shortcuts/Back Tap/Siri. Manifest khai báo shortcut cho nền tảng có hỗ trợ. |
| Tránh ghi trùng khi bấm nhanh | Lưu không khóa trong lúc chờ | Khóa nút trong lúc gửi, báo lỗi tại form và giữ dữ liệu khi thất bại. Đây là chống bấm trùng đồng thời, không phải cơ chế exactly-once khi mạng mất phản hồi. |

## Thiết kế áp dụng

Giữ bảng màu kem, than và vàng champagne cùng chữ hệ thống của Happy Money. Học thứ tự ưu tiên thông tin và cách giảm chiều cao màn hình nhập; không sao chép màu đen toàn màn hình hoặc font tiêu đề từ ảnh quảng cáo. Nút danh mục thể hiện trạng thái đang chọn; nút ngày có trạng thái Hôm nay/Hôm qua. Số tiền lớn và chữ số có độ rộng đồng nhất giúp đọc nhanh. Danh mục dạng chip cuộn trong vùng riêng, không làm tràn chiều ngang trang.

Vẫn có bộ chọn đầy đủ để các danh mục cuối không bị khó tìm. Để lưu không ghi chú, người dùng phải chủ động chọn một danh mục cụ thể; không tự gán một khoản vô danh cho danh mục mặc định.

## Những phần cần thiết kế riêng trước khi làm tiếp

- **Ngân sách tháng/danh mục:** hữu ích, nhưng cần cho người dùng tự đặt. Không suy ra từ số ngân hàng, số dư đầu tháng hay thu nhập vì ba khái niệm khác nhau. Cần thống nhất khoản Gửi vợ, trả sau và hoàn tiền tác động thế nào đến hạn mức.
- **Khoản định kỳ:** phù hợp dịch vụ số và hóa đơn. Bắt đầu bằng nhắc nhở hoặc bản nháp; không tự tạo khoản chi thật khi chưa xác nhận để tránh trùng với đồng bộ Sheets.
- **Báo cáo năm → tháng → danh mục:** có giá trị sau khi thống nhất cách tính số gốc từ Sheets và các tháng thiếu dữ liệu. Không cộng thẳng summary với toàn bộ transactions vì có thể đếm hai lần.
- **Hoàn tiền:** cần liên kết khoản hoàn với khoản gốc để giảm đúng danh mục, phân biệt với lương, rút tiết kiệm và số dư đầu tháng. Không đơn giản cho phép số âm đi qua bộ nhập hiện tại.
- **Tùy biến danh mục:** phải có ID ổn định và chuyển đổi lịch sử, đồng thời tương thích suy đoán danh mục từ nội dung Sheets. Thay tên hiển thị đơn thuần có thể làm mất phân loại trên thiết bị khác.
- **Offline:** cần hàng đợi bền vững, khóa chống trùng phía dữ liệu và trạng thái Đang chờ đồng bộ. Không hiển thị Đã lưu khi chỉ mới ghi cục bộ.
- **Native iOS:** widget, App Intents và giao diện nhập bên ngoài app là một phạm vi phát triển riêng. URL shortcut hiện tại mở web app để nhập; không khẳng định ghi từ màn hình khóa hoặc Siri tự hiểu và lưu một câu nói.

## Kiểm chứng và giới hạn

`tests/tappy-flows.cjs` kiểm tra giao diện với API giả, không ghi vào dữ liệu chi tiêu thật. Bao gồm số tiền/danh mục không ghi chú, Thu/Chi, chống bấm Lưu hai lần, thất bại giữ dữ liệu, chỉnh giao dịch bằng chạm, mở chi tiết danh mục, xuất CSV nhiều trang, deep link có/không có phiên, Hôm qua qua đầu tháng và chiều rộng 320–430 px. Ghi kết quả thực thi sau khi chạy; không coi API giả là kiểm thử Supabase thật. Back Tap, bàn phím và Siri cần thử thêm trên iPhone của người dùng.

## Nguồn

- [App Store chính thức](https://apps.apple.com/us/app/tappy-daily-expense-tracker/id6777520962): mô tả, ảnh, lịch sử phiên bản và đánh giá; kiểm tra trực tiếp thay vì dùng bản cache tìm kiếm cũ.
- [Apple: Use Back Tap](https://support.apple.com/en-us/111772): thiết lập thao tác chạm mặt sau và Shortcuts.
- [Apple: App Intents](https://developer.apple.com/documentation/appintents): phạm vi tích hợp ứng dụng với hệ thống iOS.
- [Supabase: insert](https://supabase.com/docs/reference/javascript/insert): giữ cách trả bản ghi bằng `.select()` khi lưu.

Kết quả: Chromium chạy qua toàn bộ các luồng nêu trên, không có lỗi JavaScript; kiểm tra ảnh tại 320, 390 và 430 px. Nguồn tiền/ngày/bộ chọn danh mục đầy đủ nằm trong mục Tùy chọn thu gọn. WebKit không có sẵn trong môi trường và tải bản trình duyệt chính thức thất bại, vì vậy chưa xác nhận Safari/iPhone thật. Bản kiểm thử dùng Chromium 133 từ gói `@sparticuz/chromium@133.0.0` với `CHROMIUM_EXECUTABLE_PATH`, qua Playwright 1.62.1.

## Giai đoạn 2 — giao diện gần Tappy theo yêu cầu tiếp theo

Thay định hướng màu kem–vàng của giai đoạn đầu bằng nền gần đen, surface than, chữ trắng ngà và điểm nhấn màu nhẹ. Dùng cùng hệ màu cho lịch sử, nhập, thống kê, các form sửa số/giao dịch, đăng nhập, xuất CSV và menu.

- Điều hướng ba tab cố định: Lịch sử / Nhập / Thống kê; có trạng thái tab hiện tại cho công cụ trợ năng.
- Màn hình nhập toàn chiều cao: số tiền lớn ở giữa, chip danh mục cuộn ngang, ghi chú tối giản, tùy chọn thu gọn, bàn phím số 12 phím có `000` và xóa. Ô tiền dùng `inputmode=none` để ưu tiên bàn phím trong app trên điện thoại; bàn phím vật lý vẫn dùng được.
- Lịch sử dùng biểu tượng danh mục tròn và số tiền canh phải. Giữ bảng số dư cá nhân bên dưới và cách chỉnh hiện có.
- Thống kê ưu tiên tổng chi và bình quân ngày; phần so sánh/thu nhập/dự tính nằm trong Chi tiết tháng & so sánh. Thay donut bằng thanh tỷ trọng màu có thể chạm để mở giao dịch.
- Kiểm thử Chromium với API giả: các luồng giai đoạn đầu vẫn qua; thêm phím số/xóa, tab điều hướng, layout 320×568, 390×667, 390×844 và 430×932. Nút lưu có thể cuộn tới phía trên thanh điều hướng trên màn hình thấp. Chưa xác nhận bàn phím hệ thống/Safari trên iPhone thật.

Không thay schema, công thức số dư, đồng bộ Sheets hoặc cơ chế giữ phiên đăng nhập trong đợt thiết kế này.

## Giai đoạn 3 — Sáng/Tối, con trỏ và danh mục

- Thêm nút Sáng/Tối tại lịch sử, nhập, thống kê và đăng nhập; lưu lựa chọn trên thiết bị. Light dùng nền trắng ngà, thẻ trắng, chữ xanh đậm; đổi cả form phụ và màu thanh trình duyệt.
- Bàn phím số chèn/thay thế tại con trỏ hoặc vùng chọn. Xóa lùi đúng chữ số trước con trỏ; không xóa nhầm chữ số cuối. Định dạng phân cách hàng nghìn giữ vị trí con trỏ khi nhập vật lý.
- Nút danh mục tối thiểu 54 px cao, 132 px rộng, chữ 15 px và biểu tượng 21 px. Cho phép native horizontal pan trên vùng danh mục, tránh cử chỉ đóng panel chiếm thao tác vuốt; hỗ trợ kéo bằng chuột và chặn chọn nhầm khi kết thúc kéo.
- Khôi phục toàn bộ thẻ thống kê hiển thị trực tiếp, gồm thu nhập, tổng chi, bình quân ngày, khoản chi lớn nhất, dự tính, trả sau và bảng so sánh cùng kỳ tháng trước. Không gói các chỉ số này trong phần thu gọn nữa.

Kiểm chứng Chromium với API giả: kiểm thử hồi quy qua; thêm ca sửa giữa số tiền, thay vùng chọn, xóa ở đầu số, giữ caret khi format, swipe thật bằng CDP làm rail cuộn mà không kéo panel, kích thước chip, nhớ light qua reload và bảng so sánh luôn hiển thị. Đã xem ảnh light ở màn hình nhập/thống kê. Safari/iPhone thật chưa có trong môi trường kiểm thử.

## Giai đoạn 4 — tinh chỉnh luồng Nhập và trang danh mục (29/10/2026)

- Tăng cỡ/độ đậm của số tiền, keypad và chip; ẩn caret số tiền, tiêu đề nhập và nút Đóng. Giữ tab Lịch sử để rời màn hình.
- Đưa Hôm nay / Hôm qua / Chọn ngày ra trực tiếp. Bỏ khối Techcombank khỏi màn hình nhập; giữ Trả sau và Tiền mặt thành toggle riêng, mặc định giao dịch thường vẫn dùng phương thức bank như trước.
- Credit của Tappy là hoàn tiền/ghi có (App Store, lịch sử 1.2.4), không phải trả sau. Theo điều kiện người dùng, không thêm Credit vào luồng trả sau.
- Ghi chú dùng textarea 18 px trở lên, tự xuống dòng. Khi focus, chuyển sang note mode, ẩn keypad và các phần nhập khác, giữ Lưu và nút quay lại keypad. Theo dõi visualViewport khi bàn phím hệ thống thay đổi chiều cao; không vô hiệu pinch zoom toàn ứng dụng.
- Thêm best-effort tap haptic: navigator.vibrate trên nền tảng hỗ trợ, fallback native input[checkbox][switch] trên iOS có hỗ trợ, chỉ gọi trong thao tác click thật. Cài đặt Keyboard Feedback không tự áp dụng cho custom keypad. Chỉ kiểm chứng wiring bằng spy/switch toggle, chưa xác nhận rung trên iPhone thật.
- Lịch sử hiển thị tổng chi tháng từ cùng monthTotals như thống kê, có áp dụng chế độ ẩn số.
- Bỏ bộ chọn danh mục trùng lặp ở thống kê. Mỗi thanh danh mục mở màn hình riêng, có tổng chi, tỷ trọng, so sánh hiện có và danh sách giao dịch; quay lại giữ màn hình thống kê bên dưới. Màn hình sửa giao dịch có z-index cao hơn trang danh mục; danh mục được tải lại sau chỉnh/xóa.

Kiểm chứng Chromium: toàn bộ hồi quy qua; thêm tổng chi lịch sử, font/caret, note mode ở 390×430 mô phỏng phần màn hình còn lại khi bàn phím mở, không tràn ngang, giữ ghi chú khi quay về số, lưu khoản trả sau, trang danh mục/quay lại/sửa, các đường gọi haptic. Ảnh đã kiểm tra ở màn hình nhập, ghi chú và danh mục. Đây không phải kiểm chứng Safari/iOS vật lý.

Nguồn bổ sung: [App Store Tappy — Credit](https://apps.apple.com/us/app/tappy-daily-expense-tracker/id6777520962), [WebKit Safari 18 — native switch haptics](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/).

## Giai đoạn 5 — áp dụng ba screenshot Tappy do người dùng cung cấp (29/10/2026)

- Khi focus ghi chú, giữ số tiền, danh mục và ngày; chỉ ẩn keypad, chuyển về dòng ghi chú không khung, nút Lưu ở dưới. Chọn ngày dùng pill nhỏ không viền; thứ tự danh mục → ngày → ghi chú theo ảnh.
- Danh mục thống kê nằm trong một thẻ bo tròn, mỗi hàng có vạch màu trái, emoji, tên/tiền/mũi tên, thanh tỷ trọng và phần trăm. Dùng màu ổn định theo danh mục, không đổi màu khi thứ hạng thay đổi.
- Hai số đầu trang là Tổng chi và Còn lại theo sổ (không giả định có ngân sách). Dự tính cuối tháng thành hai dòng nhỏ theo ảnh, giữ công thức. Các chỉ số khác và so sánh cùng kỳ vẫn hiển thị sau danh mục.
- Trang danh mục dùng tiêu đề giữa, nút về Thống kê, hero icon tròn + tổng tiền + số giao dịch/tháng; danh sách có chấm màu. Bỏ riêng so sánh lịch sử trong trang này. Có edge swipe từ 32 px bên trái, ngưỡng ngang 80 px và lọc cuộn dọc; tích hợp History API để Back/Forward trình duyệt đúng trạng thái.
- Tạo màn hình Settings, mở từ icon hai thanh trượt ở góc phải Lịch sử/Thống kê. Chuyển mọi mục dưới Top chi nhiều nhất sang Settings: CSV, thông tin sửa số dư, Face ID, phím tắt, đăng xuất; thêm Giao diện và ẩn số. Top chi nhiều nhất vẫn trên Thống kê.
- Bỏ nút Đóng ở Thống kê, bỏ nút refresh nhìn thấy được (giữ kéo xuống làm mới); các theme toggle chỉ còn trong Settings. Tổng chi lịch sử nằm sau toàn bộ giao dịch.

Kiểm chứng Chromium với fixture: hồi quy qua; thêm vị trí tổng chi theo DOM, mở Settings từ hai màn hình, các chức năng cũ trong Settings và light/dark lưu qua reload, note mode giữ bố cục không khung, dự tính nhỏ, không còn bộ chọn danh mục, không có so sánh trong trang danh mục, swipe bắt đầu ở giữa/gesture dọc không đóng, edge swipe hợp lệ đóng, Back/Forward phục hồi trang. Đã xem ảnh nhập ghi chú, thống kê, Settings và danh mục. iPhone thật/Safari vẫn cần xác nhận thao tác hệ thống.

## Giai đoạn 6 — danh mục tùy chỉnh và edit kiểu Tappy (30/10/2026)

- Đổi nhãn Chi tiêu, chuyển ký hiệu tiền thành tiền tố ₫. Giao dịch chi không còn dấu trừ; số dư âm thực tế vẫn giữ ý nghĩa âm. Ô nhập/sửa có ký hiệu ₫ riêng, giá trị input vẫn chỉ là số để không ảnh hưởng payload.
- Ghi chú dùng placeholder Ghi chú, chữ 16 px nhẹ hơn để tránh auto zoom iOS; bỏ lựa chọn thanh toán Tiền mặt khỏi màn nhập, giữ Trả sau. Các giao dịch tiền mặt lịch sử vẫn giữ dữ liệu.
- Thống kê: ô đầu là Tổng chi, ô thứ hai Chi trung bình/ngày. Mua trả sau là tile nửa hàng; giữ các chỉ số và so sánh cùng kỳ khác.
- Edge back: hủy native edge action tại đầu cử chỉ để không chạy song song với animation app; chỉ đóng sau khi trượt hoàn tất 160 ms, không reset về gốc trước khi đóng. Ẩn màn Chi tiêu bên dưới khi Thống kê mở để không lộ thêm một lớp. Dùng chung cho danh mục thống kê, Settings và quản lý danh mục; vẫn giữ browser Back/Forward.
- Settings có màn quản lý danh mục chi: thêm tên + emoji, preset emoji hoặc nhập một emoji tùy chọn, kéo handle để đổi thứ tự và có mũi tên lên/xuống cho trợ năng. Danh mục mới/emoji/thứ tự cập nhật các chip nhập và sửa ngay lập tức.
- Catalog có ID ổn định, tên hiện tại không đổi và không có chức năng xóa/đổi tên trong đợt này, nên mapping tên của giao dịch cũ không bị mất. Danh mục mặc định luôn được phục hồi nếu thiếu; không trộn danh mục Thu vào catalog Chi. Dữ liệu tùy chỉnh lưu local theo user và sync trong user_metadata.happy_money_category_catalog, gồm version/timestamp/items; không dùng metadata này để phân quyền. Queue lưu tuần tự; khi lỗi hiện trạng thái lưu cục bộ và thử sync ở lần mở tiếp theo. Không đổi schema hoặc Apps Script.
- Màn sửa full screen dùng cùng bố cục số tiền lớn, chip danh mục, ngày, ghi chú, Trả sau, keypad, Lưu và Xóa. Giữ phân biệt Thu/Chi và các phương thức cũ khi chưa thay đổi. Chặn bấm lưu trùng trong lúc cập nhật.

Kiểm chứng: Chromium với API giả qua toàn bộ hồi quy và ca mới: thêm Cà phê/☕, đổi 🌈, reorder bằng mũi tên và kéo chuột, giữ catalog sau reload, dùng danh mục tùy chỉnh trong payload edit (số tiền/ngày/nội dung/pay_later), emoji cũ và phân loại cũ vẫn đọc được; swipe từ quản lý danh mục về Settings và Settings về Thống kê. Đã xem ảnh Nhập, Sửa, Quản lý danh mục. Chưa kiểm chứng animation/haptic trên iPhone thật hay ghi metadata vào tài khoản thật trong quá trình thử.

Đề xuất sản phẩm (chưa thêm): lọc ngày/tuần/tháng cho Chi tiêu với mặc định tháng; tuần/tháng/năm cho Thống kê, ưu tiên tháng/năm. Budget là tùy chọn do người dùng đặt: tổng tháng và vài danh mục tùy ý; không suy ra từ số dư ngân hàng/còn lại theo sổ, không tạo hạn mức tự động.

## Giai đoạn 7 — bảng sửa với bàn phím hệ thống theo ba ảnh mới (30/10/2026)

Thay màn sửa full screen/keypad tự vẽ bằng bottom sheet bo góc trên nền trang được làm tối. Giữ một form gồm Số tiền và Trả sau cùng hàng, Danh mục dạng chip cuộn ngang, Ghi chú trong ô, Ngày dạng pill và hai nút Hủy/Lưu ngang nhau; giữ nút Xóa dưới dạng liên kết nhỏ để không mất chức năng cũ. Credit vẫn không được dùng thay Trả sau.

- Mở sheet: focus vào panel không phải input, trạng thái idle, không autofocus bàn phím.
- Chạm Ghi chú: input text/inputmode text, font 17 px; trình duyệt dùng bàn phím chữ của hệ điều hành.
- Chạm Số tiền: input text/inputmode numeric, hiển thị số nguyên chưa phân tách, hỗ trợ chọn chữ/caret thật; hệ điều hành dùng bàn phím số. Không còn editKeypad tự vẽ trong DOM.
- Enter/Done chỉ kết thúc nhập, không tự lưu. Hủy không ghi dữ liệu; Lưu dùng cùng validation/payload/override hiện có. Sheet theo visualViewport và cuộn khi bàn phím mở; chừa safe area phía trên.

Kiểm chứng Chromium: hồi quy qua; bổ sung ba trạng thái focus, no autofocus/no keypad ban đầu, sheet để lộ nền sau, inputmode text/numeric, bố cục 390×430 mô phỏng vùng còn lại khi keyboard mở, Hủy không đổi record và mở lại phục hồi bản gốc, Lưu cập nhật amount/note. Đã xem ảnh idle và note. Chromium không hiển thị bàn phím iOS; kiểm chứng bàn phím thật phải thực hiện trên iPhone.
