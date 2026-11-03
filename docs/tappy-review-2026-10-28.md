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

## Phase 8 — Amount-first edit, transaction swipes, inline Settings catalog

Opening an expense edit now synchronously focuses and selects the native numeric amount field, per the corrected reference. Note still uses the native text input. Transaction rows reveal a blue Edit action with a right swipe and a red Delete action with a left swipe; movement suppresses accidental row clicks, vertical scrolling remains available, and deletion shares the existing confirmation/tombstone flow. Personal balance cards retain long-press editing.

The entry Save button is always present and disabled/dimmed until a positive safe-integer amount exists; keypad changes, input edits, resets and save errors update its availability. Catalog listing, emoji editing, adding and ordering now live directly inside Settings, preserving local/account persistence. Exact catalog styling awaits the user's forthcoming phone reference.

Validation: Chromium fixture suite passed, including swipe directions, cancel-delete, amount auto-focus/full selection, Save availability at empty/positive/zero/deleted amounts, catalog persistence/order/emoji, edit save/cancel, existing entry/statistics/navigation/export, and 320–430px layouts. Inspected inline Settings screenshot. WebKit runtime unavailable; actual iPhone keyboard behavior is not hardware-verified.

## Phase 9 — Category Settings matched to the phone references (2026-11-03)

Categories remain directly in Settings, now in a single rounded card: emoji/name row opens editing, red × removes the category from future selection, drag handle reorders, and “+ Thêm danh mục” sits at the bottom. Removed visible ordering arrows; the handle also supports keyboard ArrowUp/ArrowDown. Dragging near the viewport edge scrolls Settings.

Added matching add/edit bottom sheets with an emoji picker (presets and custom emoji), category name, 16 color swatches, selected-color outline, and Save button disabled for an empty name. Sheets follow visualViewport, can scroll above the native keyboard, support both themes, Escape/backdrop/close/handle-swipe dismissal, and keep background Settings inert while open. Draft changes are committed only with Save. Duplicate names (including reserved historical aliases) are validated; adding a removed category by the same name restores its identity.

Catalog version 2 retains stable IDs, aliases for previous names, color, and an archived flag. Version 1 records migrate preserving existing emoji/order. Rename resolves old transaction overrides and keyword-based assignments to the current name without modifying financial records. Removal hides a category from entry/Settings while preserving historical rows, chart grouping and totals; archived defaults stay removed across reload. The fallback category can also be renamed/hidden while remaining available internally for unclassified entries. Colors flow through entry chips, charts and category detail. Account/local persistence uses the existing authenticated metadata sync, not authorization claims; no schema or financial-row migration.

Validation: Chromium fixture regression suite; add/edit/emoji/color/order/reload persistence; rename history and chart color with unchanged amount; duplicate validation and cancel; remove a default, reload without resurrection, retain archived assignment while editing an old expense; positive/empty Save; 320×430 keyboard-sized layout and light/dark screenshots. Native iPhone keyboard rendering and hardware haptics remain outside this runtime's verification.

Additional regression coverage passed: long-distance drag auto-scroll in a 390×667 viewport, no accidental edit after drag, renaming/hiding the fallback while entry remains usable, and restoring the hidden category with the same stable ID. All tests use fixtures and never mutate real financial data.

## Phase 10 — Fixed total and entry fitted to the viewport (2026-11-03)

Moved the existing month expense total into the fixed bottom container immediately above the three navigation buttons. It remains stationary while history scrolls and is hidden when an overlay is open. Increased history bottom spacing so the last balance cards remain reachable above the fixed footer. Existing totals/privacy calculations are unchanged.

Swipe actions now match the reference colors (blue Edit #305580, red Delete #ff453a), square edges, centered bold labels and full 72px transaction-row height. Existing reveal, edit and confirmed-delete logic remains intact.

Entry now uses a viewport-sized grid: Chi/Thu and Trả sau share a compact top row; removed the empty title/header space; tightened amount/category/date/note/save spacing; keypad fills remaining space with a capped height. Navigation height is measured separately from the history total, including safe-area padding. The note input and placeholder are left aligned, so an empty field's caret appears before “Ghi chú”. Native note keyboard behavior is preserved.

Validation: Chromium fixture regression suite; no vertical overflow or scrolling at 320×568, 390×667, 390×844 and 430×932; Save remains above navigation; fixed-total bounding box unchanged during long-list scrolling; footer hidden in entry/statistics; empty-note caret at position 0 and left alignment; full-height action colors and native Chromium touch reveal. Inspected 320×568 and 390×844 entry screenshots. No financial data or database schema changed. iPhone hardware remains outside the available test runtime.

## Phase 11 — Swipe spacing/motion and centered capture note (2026-11-03)

Kept 88px Edit/Delete buttons and increased the revealed row offset to 100px, leaving a 12px gutter between each action and its content. Swipes now lock to horizontal intent, update translate3d through animation frames, resist excess drag, settle with a 220ms ease curve and recent swipe velocity, and resume from the rendered position if interrupted. Reversing a revealed row closes it; short movements cancel. Reduced-motion preferences are honored. Horizontal row gestures cancel pull-to-refresh tracking to avoid competing animations.

Entry uses a non-scrolling flex layout with Chi/Thu centered, Trả sau aligned right immediately above the numeric keypad, and no large spacer between note and keypad. Both root and panel scrolling are locked while capture is open. Replaced the one-line textarea with a native single-line input: a hidden text sizer sets its width to the placeholder/current text, and the field centers that input. The input itself is left aligned, placing its real caret before “Ghi chú” while keeping the visible placeholder and entered note centered. Long notes cap to the available width and scroll horizontally within the native input. Note keyboard mode retains Save above the system keyboard.

Settings now shows Appearance and Hide sensitive amounts before the category card.

Validation: full Chromium fixture suite passed; native touch reveal; action colors/heights and final 100px positions; 12px gutters both ways; reverse-to-close and short gesture cancellation; centered note bounds when empty/typed and during 390×430 keyboard-sized mode; empty selection at index 0; single-line native input; Chi/Thu center and Trả sau right/above keypad; note-to-keypad gap ≤45px; no vertical overflow at 320–430px widths including added inset space; preferences ordering; existing save/edit/cancel/delete confirmation/statistics/export/catalog flows. Inspected capture, note and Settings screenshots. iPhone hardware/WebKit are not available in this runtime.

## Phase 12 — Automatic balances, grouped days and compact navigation (2026-11-03)

Navigation uses transparent tabs with active text/icon color only, including transparent native tap highlighting. Reduced navigation padding/height and the pinned total row height; retained safe-area space. History groups rows by normalized transaction date with Today/Yesterday/localized-date headings and daily expense totals. Rows show category/colored emoji, original note, amount and creation time only when an original app timestamp is available; imported rows do not invent transaction times. Existing swipes, confirmed deletion, privacy and statistics drill-down remain.

Entry controls above the keypad now form a shared flex group with evenly distributed spacing, centered Chi/Thu and centered note. Trả sau remains right above the keypad. Save is 54px on taller screens and 46–48px on shorter screens. No vertical capture scroll; native text keyboard mode is retained.

Added balance-engine.js as a pure calculator. Each unassigned opening amount inherits the previous month's calculated closing bank balance; savings carries across empty months and years. Expense debits bank, earned income credits bank, and Rút tiết kiệm credits bank/debits savings without becoming earned income. Pay-later and legacy cash expenses do not debit bank. Opening-balance transactions are not income/expenses. Dated manual zero snapshots override inheritance. Standalone Gửi vợ status debits once, with matching expense-row detection preventing a second debit. Unknown-date imported rows are assigned to month-end for balance calculation; future rows do not change today's balance.

Supabase migration 20261103120533_automatic_balance_checkpoints adds nullable JSON checkpoints and two SECURITY INVOKER, authenticated-only RPCs. Existing manual snapshot amounts/dates are unchanged. Initial snapshot bases are frozen once before any transaction mutation, with an optimistic compare-and-swap guard. Reconciliation updates only the selected field and its checkpoint atomically. Derived balances use current transaction impacts minus the frozen basis, so backdated inserts, edits, deletions, moves and savings-transfer changes apply as deltas. Manual fields remain compatible with the existing Sheet snapshot contract; changing a snapshot in Sheet causes its basis to reinitialize. No financial rows were modified during agent verification.

Refresh/statistics now use the same paginated, owner-filtered ledger and carry logic. Month totals sum actual active transaction rows, so edited/deleted imported rows are not added again to stale Sheet seed totals. Added long-press editing for opening balance, explicit-zero input handling, date validation and protection against whole-row status overwrites. An empty balance edit is rejected rather than silently turning into zero.

Validation: pure engine tests for carryovers, gaps, year changes, leap years, explicit zeros, reconciliation, withdrawals, cash/pay-later, future/unknown dates, same-day/backdated insertion, editing/deleting/moving rows, source changes and Gửi vợ deduplication. Full Chromium fixture suite includes actual UI expense/income/withdrawal flows, bank/savings reconciliation, edit/delete deltas, following-month/year carry and zero override, grouped days/time, stale-seed total correction, and preventing transaction insert after a checkpoint failure. Existing entry/catalog/statistics/export/gesture/layout checks passed. Reviewed entry, compact footer and grouped-history screenshots. SQL metadata verifies caller-security RPCs, authenticated-only execution and unchanged owner RLS; a rollback-only fake-principal test cannot initialize any other user's row. Existing pg_net/public-extension and leaked-password-protection advisor warnings predate this change; no new policy was introduced. Actual iPhone/WebKit hardware rendering remains unverified in this runtime.


## Phase 13 — Note-first expenses, annual analytics and language (2026-11-03)

History retains day groups but always displays a calendar date, including today and yesterday. Removed transaction time and the small group total. Restored the original description as the bold primary title, with category as secondary text only when different; an empty description falls back to category. Compact rows have no tall minimum height. Happy Money appears as a small brand label in the top-left of Expenses. The fixed overall total and existing swipes/edit flow are retained.

Selected entry categories now use their configured color for text, border and tinted background in both themes; the light-theme shared accent no longer overrides each category. Selection exposes aria-pressed.

Analytics now offers Month / Year. The annual view summarizes actual owner-filtered, paginated ledger rows into 12 months, with a total, bar chart, month list and available-year navigation. Every chart column/month row opens the matching monthly analytics. Empty years/months render safely. Existing monthly category drill-down, daily average, projection and same-period comparison remain intact. Annual calculation is isolated in annual-stats.js.

Settings adds Vietnamese / English, saved on the device. Interface labels, accessibility labels and localized date/month headings update without changing user notes, category names, stored amounts or transaction data. Language switching works after reload and does not write to the ledger. Translation logic is isolated in i18n.js.

Validation: GitHub Actions runs pure balance tests, annual/i18n unit checks and the full Chromium fixture suite. Coverage includes concrete date headings without time/group totals, original bold note, compact rows, selected category colors in both themes, 12 annual columns, prior-year data, monthly drill-through, 320px chart fit, language persistence and unchanged user content. Existing balance, save/edit/delete, category, export and layout regressions pass. Screenshot artifacts are retained by CI. Direct execution and iPhone/WebKit visual inspection were unavailable in this session.


## Phase 14 — Readable compact expenses and inline annual breakdown (2026-11-04)

Expense rows now use 6px vertical padding and 32px icons; note titles remain bold, with 14px category subtitles. Supporting labels and notes share 13px sizing across expense cards, analytics and Settings. Happy Money branding is 14–15px on its own header line. Entry category borders increase from 2px to 3px while retaining individual category colors.

Default expense/income categories have Vietnamese and English display names in entry chips, edit chips, category selectors, Settings, history subtitles and analytics. Canonical category values, metadata and transaction descriptions remain unchanged. Custom names are preserved. Dedicated category label attributes avoid translating user notes or writing English names into financial records.

Annual analytics retains the chart and year mode when a month is tapped. The selected month shows its total, daily average and category breakdown directly below the chart; tapping it again restores the whole-year breakdown. Instruction text updates in both languages. Chart/list selections share the same state, year changes clear the selection, and zero-spend months have an empty state. Selecting months does not change the main Expenses month or write transactions. Category breakdown rows can reveal their matching transactions inline.

Validation: GitHub Actions run 41682137066 passed balance tests, annual/language unit tests and the full Chromium fixture suite. Added assertions for row compactness, category/brand/card typography, 3px borders in both themes, translated category labels with unchanged canonical values, inline month selection/reselection, empty month, year change, unchanged main period, and English chart instructions. Reviewed fixture screenshots of compact expenses and yearly layouts. Actual iPhone/WebKit rendering remains unverified.
