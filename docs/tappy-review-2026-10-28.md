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
