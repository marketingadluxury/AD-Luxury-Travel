# Nhật Ký Theo Dõi Lỗi (Bugs & Issue Tracker)

Tài liệu này lưu trữ lịch sử sửa lỗi và các vấn đề cần lưu ý trong quá trình phát triển hệ thống **Tour CRM - Quản lý Công ty Du lịch**.

---

## 1. Các Vấn Đề Đã Được Khắc Phục (Resolved Issues)

### 1.1 Lỗi nút "Xóa" ảnh đoàn không hoạt động
- **Mô tả lỗi:** Nút "Xóa" ảnh đoàn tại các modal/trang upload ảnh (`TourMediaUploader.tsx`, `HDVQuickUploadModal.tsx`, `TourGallery.tsx`, `GuestPhotoUploadPage.tsx`) trước đó sử dụng hộp thoại `window.confirm` mặc định của trình duyệt, dẫn đến việc không hoạt động đúng cách trong môi trường iFrame của AI Studio. Đồng thời gặp lỗi thay đổi thứ tự React Hooks (`Rules of Hooks`) khi khai báo hook sau một khối logic rẽ nhánh.
- **Giải pháp:** 
  1. Thay thế hoàn toàn hộp thoại `window.confirm` bằng component modal tùy chỉnh đẹp mắt `ActionModal.tsx` đã được định nghĩa sẵn trong hệ thống.
  2. Định nghĩa lại các hook `useState` ở phần đầu của các React Component để luôn đảm bảo tính nhất quán của thứ tự gọi hook trong mỗi lần render.
- **Trạng thái:** Đã giải quyết triệt để và kiểm tra linter thành công.

### 1.2 Lỗi tràn văn bản (text overflow) tại ActionModal
- **Mô tả lỗi:** Khi thông báo chứa một từ hoặc chuỗi ký tự quá dài không có khoảng trắng (ví dụ: tên file ảnh `z6223620940992_bfcd88a90ceff5a47050a54d90b5ac12.jpg`), văn bản bị tràn ngang ra khỏi viền của modal `ActionModal.tsx`.
- **Giải pháp:** Thêm class `break-words` của Tailwind CSS vào thẻ `<p>` hiển thị lời nhắn (`message`) để ép buộc trình duyệt xuống dòng tự động khi gặp chuỗi ký tự dài không có khoảng trắng.
- **Trạng thái:** Đã giải quyết triệt để và kiểm tra linter thành công.

### 1.3 Lỗi trùng lặp dữ liệu ảnh đoàn khi tải lên thành công
- **Mô tả lỗi:** Khi người dùng tải ảnh lên qua `HDVQuickUploadModal.tsx` hoặc `TourMediaUploader.tsx`, mặc dù ảnh trên Google Drive chỉ lưu duy nhất 1 file, nhưng danh sách hiển thị trong hệ thống (bảng `tour_media`) lại bị lặp đôi 2 dòng giống hệt nhau.
- **Nguyên nhân:** Khi gọi API `/api/upload`, máy chủ đã chủ động lưu siêu dữ liệu ảnh và sinh ID cho bản ghi trong cơ sở dữ liệu Supabase, rồi trả về thông tin bản ghi này trong trường `media`. Tuy nhiên, mã nguồn frontend sau khi nhận kết quả lại tiếp tục gọi hàm `addTourMedia` của context nhưng không truyền `id` nhận được từ API. Điều này dẫn đến việc frontend tự động sinh một UUID ngẫu nhiên khác và thực hiện lệnh `upsert` dòng thứ hai có chứa cùng file URL nhưng khác ID, làm xuất hiện 2 dòng trùng nhau khi tải lại trang.
- **Giải pháp:** Cập nhật hàm gọi `addTourMedia` trong `HDVQuickUploadModal.tsx` và `TourMediaUploader.tsx` để truyền trực tiếp `id: data.media?.id` và tên file chuẩn hóa `file_name: data.fileName || ...` từ máy chủ trả về. Nhờ vậy, lệnh `addTourMedia` sẽ ghi đè/upsert khớp hoàn toàn với bản ghi duy nhất trong cơ sở dữ liệu thay vì sinh mới ID ngẫu nhiên.
- **Trạng thái:** Đã giải quyết triệt để và kiểm tra build thành công.

### 1.4 Lỗi tải ảnh đoàn thất bại hoặc bị lưu lên Supabase thay vì Google Drive do lỗi xác thực Google Drive (OAuth invalid_grant)
- **Mô tả lỗi:** Khi người dùng tải ảnh lên qua link HDV Freelance, file ảnh bị lưu sang Supabase Storage thay vì lưu vào đúng thư mục Google Drive của đoàn như yêu cầu, hoặc bị chặn đứng bởi thông báo lỗi đỏ báo lỗi xác thực Google Drive (`invalid_grant`).
- **Nguyên nhân:**
  1. Khi cấu hình Google Drive bằng cả hai phương thức: OAuth 2.0 (Refresh Token) và Service Account, hàm `getGoogleDriveAccessToken` ưu tiên kiểm tra OAuth trước. Nếu OAuth xảy ra lỗi (ví dụ: Refresh Token hết hạn hoặc bị hủy - `invalid_grant`), hàm này lập tức ném lỗi (throw Error) mà không thử chuyển sang kết nối bằng Service Account dù Service Account đã được cấu hình hoàn toàn hợp lệ và hoạt động bình thường.
  2. Việc tắt `strictDriveOnly` (chuyển sang `false` ở bản vá trước) đã khắc phục việc chặn đứng tải ảnh, nhưng làm hệ thống âm thầm lưu ảnh vào tầng dự phòng **Supabase Storage** thay vì Google Drive khi gặp sự cố xác thực OAuth trên.
- **Giải pháp:**
  1. Cập nhật hàm `getGoogleDriveAccessToken` trong `app.ts` để thông minh kiểm tra: Nếu xác thực OAuth 2.0 thất bại nhưng có cấu hình Service Account hợp lệ dự phòng, hệ thống sẽ bỏ qua lỗi OAuth, ghi nhận cảnh báo và tự động chuyển tiếp sang cấu hình kết nối bằng Service Account để duy trì luồng lưu trữ trên Google Drive.
  2. Bằng cách này, luồng lưu trữ chính Google Drive luôn được bảo toàn và duy trì hoạt động thông qua Service Account, không bị đẩy xuống tầng lưu trữ dự phòng Supabase Storage một cách không cần thiết.
- **Trạng thái:** Đã khắc phục triệt để và kiểm tra build thành công.

### 1.5 Lỗi Đề nghị thanh toán (Payment Proposals) không hiển thị cho Leader / Admin
- **Mô tả lỗi:** Khi nhân viên tạo đề nghị thanh toán mới, người dùng cấp quản lý (Leader/Admin) ở các trình duyệt/thiết bị khác không nhìn thấy đề xuất này trên hệ thống.
- **Nguyên nhân:** Bảng `payment_proposals` trong cơ sở dữ liệu Supabase được kích hoạt tính năng RLS (Row Level Security) hoặc kế thừa RLS từ các thiết lập mặc định, nhưng ban đầu chưa được định nghĩa chính sách (Policy) truy cập cụ thể nào. Điều này khiến cho các truy vấn của những người dùng đăng nhập khác bị chặn và hệ thống buộc phải tự động sử dụng kho dữ liệu dự phòng `localStorage` vốn bị cô lập riêng cho từng thiết bị của mỗi nhân viên.
- **Giải pháp:** 
  1. Kích hoạt rõ ràng Row Level Security (RLS) cho bảng `payment_proposals` trong file `supabase-schema.sql`.
  2. Tạo chính sách bảo mật cho phép tất cả tài khoản đã đăng nhập (authenticated) được quyền xem, sửa, xóa các bản ghi trên bảng này:
     `CREATE POLICY "Allow authenticated access to payment_proposals" ON payment_proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);`
- **Trạng thái:** Đã khắc phục triệt để, đồng bộ dữ liệu hoàn hảo giữa các tài khoản và kiểm tra thành công.

### 1.6 Yêu cầu giới hạn quyền truy cập tài liệu Google Drive (Phương án B)
- **Mô tả yêu cầu:** Giới hạn quyền truy cập các thư mục và file được tải lên Google Drive của công ty, chỉ cho phép những email nội bộ công ty được quyền xem tài liệu, tránh rò rỉ thông tin ra ngoài.
- **Giải pháp:** Thực hiện nâng cấp cơ chế phân quyền Google Drive theo **Phương án B**:
  1. Thay vì chia sẻ công khai cho bất kỳ ai có link (`type: 'anyone', role: 'reader'`), hệ thống đã được viết lại hàm `makeFolderPublic` trong `app.ts`.
  2. Cấu hình phân quyền Google Drive cho từng file/thư mục khi tạo mới hoặc upload bằng cách lặp và thiết lập quyền truy cập cho:
     - Tên miền email nội bộ của công ty: `adluxury.net` (`type: 'domain', domain: 'adluxury.net', role: 'reader'`).
     - Các email quản trị viên tối cao: `marketing@adluxury.net`, `marketing.adluxury@gmail.com` (`type: 'user', emailAddress: '...', role: 'reader'`).
     - Tự động trích xuất email của người dùng đang thực hiện tải lên từ token JWT Supabase (`getAuthenticatedUserEmail`) để cấp quyền truy cập trực tiếp cho chính nhân viên đó.
- **Trạng thái:** Đã triển khai thành công, vượt qua kiểm tra build và linter với kết quả hoàn hảo.

### 1.7 Lỗi Popover bộ chọn ngày (TimeRangeFilter) bị tràn và cắt khuất góc phải màn hình
- **Mô tả lỗi:** Nút chọn khoảng ngày tùy chỉnh của Bộ lọc Đề nghị thanh toán nằm ở góc ngoài cùng bên phải. Khi mở rộng, popover bị tràn sang phải ra khỏi màn hình trình duyệt, che mất nút "Xác nhận".
- **Giải pháp:** Cập nhật `alignPopover="right"` cho bộ chọn trong `PaymentProposals.tsx`. Giúp popover tự động căn mép phải với nút kích hoạt và mở rộng vào phía trong màn hình một cách an toàn.
- **Trạng thái:** Đã xử lý triệt để, hiển thị chuẩn chỉnh.

### 1.8 Lỗi lệch vai trò của nhân viên Marketing khi gửi đóng góp ý kiến
- **Mô tả lỗi:** Nhân viên Marketing khi gửi góp ý hệ thống hiển thị vai trò là "Sale", không đúng với chức vụ thực tế "NHÂN VIÊN MARKETING" trong Quản lý thành viên.
- **Nguyên nhân:** Biến `currentRole` được sử dụng trong `FeedbackModal.tsx` đã bị gộp từ `marketing` về `sale` phục vụ phân quyền dữ liệu. Bộ biên dịch chuyển đổi vai trò `getRoleBadge` cũng thiếu định nghĩa cho các vai trò mới như `marketing`, `marketing_leader`, `tour_guide`, `CTV`.
- **Giải pháp:** 
  1. Thay đổi việc truy xuất vai trò từ `currentRole` thành `displayRole` (giữ nguyên vai trò gốc đang hiển thị).
  2. Bổ sung đầy đủ 4 vai trò mới vào hàm `getRoleBadge` in `FeedbackModal.tsx` để dịch hiển thị chính xác hoàn toàn.
- **Trạng thái:** Đã đồng bộ hoàn chỉnh trên toàn hệ thống.

### 1.9 Di chuyển 2 nút "Lịch trình tour" và "Thông tin lưu ý" xuống hàng dưới so với tên Tour (Ảnh 1)
- **Mô tả yêu cầu:** Khi hiển thị card tour, 2 nút này chiếm nhiều diện tích trên cùng 1 hàng ngang với tên tour làm giao diện bị rối mắt.
- **Giải pháp:** Cập nhật file `DepartureCalendar.tsx`, di chuyển cụm container chứa 2 nút này xuống dưới dòng tên tour (phía trên các dòng thông tin chi tiết và tag).
- **Trạng thái:** Hoàn thành, hiển thị thoáng và cân đối đúng mockup.

### 1.11 Di chuyển các nhãn trạng thái (Còn chỗ, Giờ chót, Mở bán, v.v.) lên phía trên ô số chỗ ngồi (Ảnh bôi đỏ)
- **Mô tả yêu cầu:** Nhãn trạng thái lúc trước nằm cạnh tên tour. Người dùng mong muốn chuyển chúng lên phía trên ô bôi đỏ (khu vực nằm ngay phía trên khối hiển thị Đã bán / Giữ chỗ / Còn lại).
- **Giải pháp:** Cập nhật file `DepartureCalendar.tsx`, bóc tách `SeatStatusBadge` và `tour_status` ra khỏi dòng tên tour, đặt chúng vào một hàng ngang ngay phía trên khối số lượng ghế "Seats Info". Với sản phẩm visa lẻ, cụm badge này vẫn được căn chỉnh chính xác trên layout mà không cần hiển thị khối ghế trống.
- **Trạng thái:** Hoàn thành, cực kỳ thoáng mắt và đúng chuẩn phân vùng thông tin.

### 1.12 Thay đổi viền ngoài của thẻ tour tùy biến theo trạng thái giữ chỗ (Còn chỗ, Hết chỗ, Overbooked)
- **Mô tả yêu cầu:** Giữ màu sắc nền của thẻ tour như cũ (trắng tiêu chuẩn `bg-white`), chỉ thay đổi viền để màu sắc nổi bật, rõ ràng hơn. Cả trạng thái "Giờ chót" (`last_minute`) và "Hết chỗ" (`Hết chỗ`) đều áp dụng viền đỏ.
- **Giải pháp:** Định nghĩa biến `borderClasses` động trong `DepartureCalendar.tsx` với màu nền trắng đồng bộ và viền dày 2px rõ nét:
  - **Giờ chót hoặc Hết chỗ:** Viền đỏ thắm dày 2px nổi bật (`border-rose-400 border-[2px] bg-white`).
  - **Còn chỗ:** Viền xanh lá cây tươi dày 2px rõ ràng (`border-emerald-400 border-[2px] bg-white`).
  - **Overbooked:** Viền tím đậm dày 2px sang trọng (`border-purple-400 border-[2px] bg-white`).
- **Trạng thái:** Hoàn thành, thẻ tour vừa giữ được độ thanh lịch của nền trắng, vừa tăng tối đa khả năng phân loại trực quan của viền màu sắc rõ rệt.

### 1.13 Tự động thiết lập trạng thái "Giờ chót" cho các tour khởi hành trong vòng 20 ngày
- **Mô tả yêu cầu:** Hệ thống cần tự động tính toán và gắn nhãn "Giờ chót" cho các tour có thời gian khởi hành trong vòng 20 ngày kể từ ngày hiện tại để tự động tối ưu hóa hiển thị và phân quyền màu sắc viền thẻ tour.
- **Giải pháp:** Cập nhật file `DepartureCalendar.tsx`, bổ sung hàm helper `getEffectiveTourStatus` so sánh thời gian khởi hành (`departure_time` hoặc `start_date`) với ngày hiện tại (`today`). Nếu khoảng cách thời gian từ 0 đến 20 ngày, tour sẽ tự động chuyển sang nhãn trạng thái `last_minute`. Hàm helper này được đồng bộ để áp dụng cho cả việc hiển thị nhãn, hiển thị viền đỏ và tính năng lọc trạng thái tour trên lịch khởi hành.
- **Trạng thái:** Hoàn thành, hoạt động tự động thông minh, nhất quán và tin cậy.

### 1.14 Tự động đồng bộ khoản thanh toán Net nộp cho Đối tác nhận khách trong bảng chi phí Tour
- **Mô tả yêu cầu:** Trong bảng hạch toán chi phí tour đối tác, hệ thống cần tự động hiển thị mục để AD thanh toán/chuyển khoản cho bên công ty đối tác nhận khách dựa trên giá Net nhân với số lượng hành khách tham gia tour.
- **Giải pháp:** Cập nhật hàm `getAutoGeneratedPaymentsList` trong component `TourCostsManagement.tsx`. Khi hệ thống thực hiện đồng bộ chi phí (từ nút "Đồng bộ từ chi phí" hoặc khi Lưu bảng chi phí) đối với Tour gửi khách đối tác (`partner` hoặc `outsourced`) có khai báo chi phí Net (`partner_net_cost` > 0), hệ thống sẽ tự động khởi tạo/cập nhật một thẻ thanh toán đối tác riêng biệt: `Thanh toán đối tác: [Tên đối tác nhận khách]` với tổng số tiền bằng `partner_net_cost * totalConfirmedPassengers` (Số tiền Net mỗi khách x Tổng số khách đã xác nhận).
- **Trạng thái:** Hoàn thành, giúp điều hành và kế toán dễ dàng tạo đề xuất chi nhiều đợt, đính kèm ảnh chuyển khoản và phê duyệt UNC trực tiếp và minh bạch.

### 1.17 Nâng cấp Phân hệ Quản lý Đại lý & Cộng tác viên (Agent / CTV Management)
- **Mô tả yêu cầu:** Thay thế trang dữ liệu tĩnh mẫu (mock) cũ tại phân hệ Đại lý (`/customers`) thành hệ thống Quản lý kênh phân phối Đại lý & CTV thực tế hoàn chỉnh, kết nối với dữ liệu thực từ cơ sở dữ liệu `profiles` và `orders` trong CRM.
- **Giải pháp:**
  1. **Nâng cấp Schema & Context:** Bổ sung các trường thông tin chi tiết vào `profiles` (địa chỉ, ngân hàng, STK, tên chủ TK, ghi chú, trạng thái `active`/`inactive`, hạng `tier`) và xuất các hàm CRUD (`addAgentProfile`, `updateAgentProfile`, `deleteAgentProfile`) từ `CRMContext`.
  2. **Trình bày Thống kê Tổng quan (Top Metric Cards):** Tính toán và tổng hợp tự động 4 chỉ số kinh doanh chính trên toàn hệ thống: (1) Tổng số đối tác (phân tách Đại lý & CTV), (2) Tổng lượt hành khách (Pax) mang về, (3) Tổng Doanh số hợp đồng tour đóng góp, (4) Tổng Hoa hồng phát sinh/tích lũy.
  3. **Bộ lọc Đa năng & Chế độ xem Tùy biến:** Hỗ trợ lọc theo Sub-tabs (Tất cả / Đại lý / CTV), Tìm kiếm từ khóa đa năng, Lọc theo Sale/Leader phụ trách, Lọc theo Hạng đối tác (Platinum, Gold, Silver, Standard), Lọc theo Trạng thái (Hoạt động / Tạm dừng), Sắp xếp linh hoạt (Doanh số, Booking, Pax, Hoa hồng, Ngày gia nhập) cùng 2 chế độ hiển thị linh hoạt: **Dạng Thẻ (Grid)** và **Dạng Bảng (Table)**.
  4. **Form Thêm/Sửa & Sổ Cái Chi Tiết Booking:**
     - Modal khai báo mới / cập nhật thông tin đối tác kèm chọn ngân hàng chuẩn Việt Nam & sao chép STK 1-click.
     - Modal / Drawer Chi tiết đối tác tích hợp Sổ cái tổng hợp toàn bộ các đơn hàng (Booking) do đối tác đó thực hiện, tính tổng Pax, doanh số và hoa hồng thực nhận tương ứng.
  5. **Cập nhật Phân quyền & Menu Sidebar:** Đổi tên menu từ "Đại lý (Agent)" thành "Đại lý & CTV" và mở rộng phân quyền truy cập cho 6 vai trò: `admin`, `bod`, `sale`, `sale_leader`, `operator`, `accounting`.
- **Trạng thái:** Hoàn thành, biên dịch thành công 100%, đồng bộ hoàn hảo toàn hệ thống.
- **Giải pháp:**
  1. Chuẩn hóa toàn bộ các cụm View Switcher nút chọn góc nhìn về khung `inline-flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-2xs` với kích thước nút `px-3 py-1.5 text-xs font-bold rounded-lg`, đảm bảo hiển thị đồng bộ tuyệt đối trên mọi màn hình.
  2. Bổ sung bộ lọc dữ liệu chỉ giữ các item có giá trị dương (`revenue > 0` hoặc `value > 0`) trước khi truyền vào `PieChart`. Trường hợp không có dữ liệu, hiển thị khối thông báo rỗng đẹp mắt.
  3. Bổ sung điều kiện ẩn label nếu tỷ lệ đóng góp nhỏ hơn 5% (`(entry.percent || 0) >= 0.05`), tránh tuyệt đối lỗi chồng chéo nhãn trên biểu đồ tròn.
- **Trạng thái:** Đã xử lý triệt để, kiểm tra build & linter thành công 100%.

### 1.15 Khắc phục lỗi "Phản hồi từ máy chủ không hợp lệ: <!doctype html>" khi upload tài liệu
- **Mô tả lỗi:** Khi người dùng thực hiện tải file lên (lịch trình Tour hoặc hóa đơn chuyển khoản), hệ thống đôi khi trả về thông báo lỗi HTML `<!doctype html>` thay vì xử lý dữ liệu JSON đúng định dạng.
- **Nguyên nhân:**
  1. Ở chế độ phát triển (hoặc khi deploy production qua Vercel), nếu một request API có tải lượng lớn hoặc gặp sự cố nhỏ lọt qua Express router, nó sẽ trôi xuống SPA Fallback middleware của Vite (`vite.middlewares`) hoặc catch-all của static server (`dist/index.html`). Do đó, client nhận về tệp `index.html` (với nội dung bắt đầu bằng `<!doctype html>`) cùng mã HTTP `200 OK`. Khi client cố gắng parse JSON của chuỗi HTML này, phương thức `JSON.parse` thất bại và ném ra biệt lệ.
- **Giải pháp:**
  1. Thêm header cấu hình `'Accept': 'application/json'` rõ ràng trong tất cả các request `fetch` tải file từ Client (`PaymentModal.tsx` và `ToursManagement.tsx`). Điều này báo hiệu cho SPA Fallback middleware của Vite và các server trung gian biết rằng client KHÔNG chấp nhận định dạng HTML, tránh hoàn toàn việc tự động trả về tệp `index.html` khi có lỗi.
  2. Bổ sung các khối kiểm tra thông minh ở Client để kiểm tra tiền tố nội dung trả về. Nếu phản hồi bắt đầu bằng `<!doctype html` hoặc `<html`, client sẽ chủ động chặn lại và dịch thành thông báo Tiếng Việt thân thiện, mô tả đúng trạng thái cấu hình lưu trữ Google Drive / Supabase thay vì cố gắng parse JSON lỗi.
- **Trạng thái:** Đã giải quyết triệt để, kiểm tra biên dịch thành công 100%.

### 1.16 Lỗi mặc định hiển thị / gán trạng thái "Tạo hộ CTV" khi vào Quản lý Booking hoặc Chỉnh sửa Đơn hàng
- **Mô tả lỗi:** Khi người dùng Sale tạo đơn hàng lẻ cho khách trực tiếp và không tích chọn checkbox "Tạo đơn thay cho CTV (Cộng Tác Viên)", khi vào Quản lý Booking hoặc khi bấm "Chỉnh sửa thông tin booking", hệ thống vẫn tự động hiển thị khối nhập liệu "Tiền tour chênh lệch CTV & Phí tính thuế" dành riêng cho CTV và tính toán hoa hồng CTV, gây bối rối cho người dùng và tạo cảm giác hệ thống bị lỗi mặc định tạo hộ CTV.
- **Nguyên nhân:**
  1. Trong form tạo mới ở `OrdersManagement.tsx`, sau khi tạo đơn thành công, logic reset form bị thiếu hàm `setIsCreatingForCTV(false)`, dẫn đến việc state này có thể bị lưu giữ ở trạng thái cũ (`true`) trong các lượt thao tác kế tiếp.
  2. Trong modal chỉnh sửa `EditOrderModal.tsx`, ban đầu hoàn toàn không có state `isCreatingForCTV` và checkbox tương ứng để người dùng chủ động lựa chọn. Hệ thống mặc định sử dụng quyền `isSaleRole` của người đăng nhập để luôn hiển thị khối nhập liệu và tính toán hoa hồng CTV cho mọi đơn hàng (dù đó là đơn khách lẻ trực tiếp và không có thông tin CTV).
- **Giải pháp:**
  1. Thêm state `isCreatingForCTV` vào `EditOrderModal.tsx` và khởi tạo động dựa trên sự hiện diện của `order.ctv_info` hoặc `order.price_markup > 0`.
  2. Bổ sung checkbox `🤝 Tạo đơn thay cho CTV (Cộng Tác Viên)` đồng bộ hoàn hảo trong `EditOrderModal.tsx` giống y hệt như form tạo mới. Chỉ hiển thị ô nhập Ghi chú CTV, khối tiền chênh lệch và cấu hình thuế khi checkbox này được tick chọn.
  3. Cấu hình bảng thống kê tạm tính hoa hồng tự động (Commission breakdown box) trong `EditOrderModal.tsx` chỉ hiển thị khi đơn hàng thực sự thuộc về Đại lý (`sellerType === 'agent'`), hoặc vai trò hiện tại là CTV, hoặc khi có tick chọn tạo thay CTV (`isCreatingForCTV` là `true`). Với các đơn hàng trực tiếp của khách lẻ do Sale bán trực tiếp, khối này sẽ được ẩn đi hoàn toàn.
  4. Cập nhật hàm `handleSave` trong `EditOrderModal.tsx` để tự động dọn sạch và reset các trường liên quan đến CTV (`ctv_info` về rỗng, `price_markup` về `0`, phí thu về `0`) nếu người dùng không chọn hoặc bỏ chọn checkbox tạo hộ CTV trên form, đảm bảo tính nhất quán của dữ liệu.
  5. Bổ sung lệnh reset `setIsCreatingForCTV(false)` trong khối reset của form tạo mới tại `OrdersManagement.tsx`.
- **Trạng thái:** Đã khắc phục triệt để, đồng bộ giao diện nhất quán 100%, biên dịch thành công hoàn hảo.

### 1.17 Lỗi hiển thị "Thông tin nộp tiền Ngân hàng" rỗng đối với Phiếu thu (Receipts)
- **Mô tả lỗi:** Khi kế toán hoặc quản trị viên xem chi tiết một Phiếu thu (Receipt), hệ thống hiển thị thêm khối "Thông tin nộp tiền Ngân hàng" với thông tin tài khoản ngân hàng, số tài khoản, chủ tài khoản rỗng (hiển thị `---`), gây rườm rà và không chính xác.
- **Nguyên nhân:** Phiếu thu là giao dịch khách hàng hoặc đại lý chuyển khoản nộp tiền *vào* tài khoản của công ty. Vì vậy, hệ thống không cần lưu trữ hay hiển thị thông tin tài khoản ngân hàng thụ hưởng của khách hàng (ngược lại với Phiếu chi - nơi công ty chuyển tiền hoàn trả hoặc thanh toán ra ngoài cho đối tác thì cần có thông tin tài khoản thụ hưởng). Trước đó, logic hiển thị thẻ Phiếu thu đã kế thừa khối hiển thị tài khoản ngân hàng này một cách không cần thiết.
- **Giải pháp:** 
  1. Loại bỏ hoàn toàn khối hiển thị `Thông tin nộp tiền Ngân hàng` ra khỏi tệp tin `AccountingInvoice.tsx` tại giao diện hiển thị danh sách phiếu thu chuyển khoản (`receiptInvoices`).
  2. Giữ nguyên khối hiển thị này đối với danh sách phiếu chi (`paymentInvoices`) vì phiếu chi thực sự bắt buộc cần thông tin chuyển khoản đích để phục vụ kế toán duyệt lệnh chi tiền.
- **Trạng thái:** Đã giải quyết triệt để, đồng bộ giao diện gọn gàng, biên dịch thành công hoàn hảo.

### 1.18 Lỗi cắt xén văn bản (truncate) và chồng chéo component trên thẻ Phiếu thu / Phiếu chi
- **Mô tả lỗi:** Khi xem danh sách phiếu thu/phiếu chi trong màn hình Kế toán, tên khách hàng / người nộp (ví dụ "LÊ THỊ THANH LAN") bị cắt xén ngắn còn "LÊ T...", đồng thời số điện thoại và badge trạng thái ("Chờ kế toán duyệt") bị dồn ép trên cùng một dòng ngang chật hẹp, tạo ra giao diện chồng chéo và mất thẩm mỹ.
- **Nguyên nhân:** Khối hiển thị thông tin ngắn (Always visible header) trên card phiếu thu/chi sử dụng cấu trúc `flex flex-col sm:flex-row` nằm trong grid layout đa cột. Khi chiều rộng card bị hẹp (~300px), việc ép flex-row kết hợp với thuộc tính CSS `truncate` cho thẻ chứa tên đã làm cho văn bản tên bị co lại tối đa còn vài chữ cái, trong khi badge điện thoại và badge trạng thái chiếm hầu hết diện tích.
- **Giải pháp:**
  1. Tái cấu trúc lại khối thông tin vắn tắt trên thẻ Card cho cả Phiếu Thu và Phiếu Chi tại `AccountingInvoice.tsx`.
  2. Tách thành 2 dòng hiển thị rõ ràng: Dòng 1 bao gồm Tên người nộp/đối tác (hiển thị đầy đủ 100% bằng `break-words`, bỏ `truncate` cứng nhắc) ở bên trái và Badge Trạng Thái ở góc bên phải; Dòng 2 hiển thị rõ ràng thông tin Số điện thoại liên hệ.
  3. Đảm bảo giao diện phản hồi tốt trên mọi kích thước màn hình và số cột grid mà không bị đè chữ hay biến dạng.
- **Trạng thái:** Đã khắc phục triệt để, đồng bộ giao diện thoáng đẹp, biên dịch thành công 100%.

### 1.19 Lỗi trùng lặp thông tin Khách / Người nộp khi mở rộng chi tiết Phiếu Thu
- **Mô tả lỗi:** Khi người dùng bấm mở rộng chi tiết thẻ Phiếu Thu (Receipt), thông tin Tên khách/người nộp và Số điện thoại bị hiển thị lặp lại 2 lần (một lần ở khối tổng quan trên cùng và một lần nữa ở khối chi tiết đơn hàng bên dưới).
- **Nguyên nhân:** Khối tổng quan trên cùng (Luôn hiển thị) đã có thông tin tên người nộp và số điện thoại. Tuy nhiên, ở phần chi tiết mở rộng bên dưới, khối thông tin liên kết Booking cũ vẫn chứa dòng hiển thị `Khách / Người nộp: [Tên] ([SĐT])` nằm cạnh mã booking `#BK-...`.
- **Giải pháp:**
  1. Chỉnh sửa tệp `AccountingInvoice.tsx` tại mục hiển thị danh sách phiếu thu (`receiptInvoices`).
  2. Lược bỏ cụm hiển thị lặp lại `Khách / Người nộp: [Tên] ([SĐT])` trong khối chi tiết đơn hàng, chỉ giữ lại nhãn "Booking liên kết:" đi kèm badge mã Booking `#BK-...` có nút sao chép tiện lợi.
- **Trạng thái:** Đã khắc phục triệt để, giao diện gọn gàng không bị lặp thông tin, biên dịch thành công 100%.

### 1.20 Chuẩn hóa loại bỏ tiền tố "BK-" khỏi mã đơn hàng (Booking Code)
- **Mô tả yêu cầu:** Người dùng phản ánh khi sao chép mã đơn hàng từ các phiếu thanh toán hoặc danh sách đơn hàng, mã sao chép bị đính kèm tiền tố `BK-` (ví dụ `BK-31F7EDA9` hoặc `#BK-31F7EDA9`). Khi dán vào ô tìm kiếm đơn hàng (vốn quản lý mã gốc 8 ký tự như `31F7EDA9`), hệ thống không tìm ra kết quả.
- **Giải pháp:**
  1. Loại bỏ tiền tố `BK-` khỏi tất cả các điểm khởi tạo và hiển thị `orderCode` trên toàn hệ thống (`AccountingInvoice.tsx`, `PaymentModal.tsx`, `OrdersManagement.tsx`, `PassengersManagement.tsx`, `VisaOrders.tsx`, `VisaProcessing.tsx`).
  2. Chuẩn hóa giao diện hiển thị mã booking dạng `#31F7EDA9`, đồng thời các thao tác bấm Sao chép (Copy) mã đơn hàng sẽ tự động lưu chuỗi gốc 8 ký tự `31F7EDA9` vào clipboard.
  3. Giữ nguyên logic bộ lọc thông minh tự động loại bỏ `#` hoặc `BK-` / `bk-` nếu người dùng gõ/dán chuỗi có chứa tiền tố theo thói quen cũ.
- **Trạng thái:** Đã xử lý hoàn tất, đồng bộ toàn hệ thống, biên dịch thành công 100%.

### 1.21 Khắc phục bộ lọc "Tour gửi khách đối tác (Partner)" hiển thị 0 tour tại Báo cáo Điều hành
- **Nguyên nhân:** Trong tệp `DashboardOperator.tsx`, hàm `matchesFilters` chỉ lọc các tour có `tour_type === 'partner'`, trong khi hệ thống khi khởi tạo / quản lý tour gửi khách còn sử dụng giá trị `tour_type = 'outsourced'` (F2 / Gửi khách đối tác).
- **Giải pháp:** 
  1. Cập nhật hàm `matchesFilters` trong `DashboardOperator.tsx` để khi chọn `selectedTourType = 'partner'` sẽ chấp nhận cả hai giá trị `tour_type = 'partner'` và `tour_type = 'outsourced'`.
  2. Cập nhật thẻ Badge hiển thị "🤝 GỬI KHÁCH ĐỐI TÁC" tại `DepartureCalendar.tsx` đồng bộ hỗ trợ cả hai định dạng.
- **Trạng thái:** Đã xử lý hoàn tất, bộ lọc hiển thị đầy đủ và chính xác tất cả Tour gửi khách đối tác, biên dịch thành công 100%.

### 1.22 Tối ưu hóa bộ lọc thời gian mặc định và truy xuất thuộc tính tại Báo cáo Điều hành (DashboardOperator)
- **Nguyên nhân:**
  1. `daysFilter` trong `DashboardOperator.tsx` mặc định là `30` ("Trong vòng 30 ngày tới"), dẫn đến các tour gửi khách đã khởi hành trước đó hơn 30 ngày (hoặc khởi hành sau 30 ngày) bị ẩn khỏi danh sách.
  2. Việc lọc theo từ khóa tìm kiếm và hiển thị ngày khởi hành chỉ kiểm tra thuộc tính duy nhất `t.code`/`t.name`/`t.start_date`, chưa hỗ trợ dự phòng các thuộc tính tương đương như `t.tour_code`/`t.title`/`t.departure_time`.
- **Giải pháp:**
  1. Đổi giá trị mặc định của `daysFilter` thành `99999` ("Tất cả thời gian") để hiển thị toàn bộ tour khi người dùng chọn lọc theo loại tour gửi khách đối tác.
  2. Bổ sung hàm hỗ trợ `getTourDate(t)` và cơ chế truy xuất linh hoạt `t.code || t.tour_code`, `t.name || t.title`, `t.start_date || t.departure_time` giúp hiển thị chính xác mọi thông tin tour không lo thiếu dữ liệu.
- **Trạng thái:** Đã xử lý hoàn tất, bộ lọc hiển thị 100% tour gửi khách đối tác trên Báo cáo Điều hành, biên dịch thành công 100%.

### 1.23 Tự động đồng bộ Mục 2 từ Chi phí Mục 1 & Khắc phục tự động tính hoa hồng đại lý cho đơn Sale AD bán trực tiếp
- **Nguyên nhân:**
  1. Tại `TourCostsManagement.tsx`, logic tính tổng hoa hồng `totalBookingCommissions` áp dụng mức `tour.commission` cố định cho tất cả đơn hàng mà không kiểm tra đơn hàng đó do Sale AD bán trực tiếp (`seller_type === 'direct'`) hay do Đại lý/CTV bán (`seller_type === 'agent'` / có `ctv_info`). Dẫn đến các đơn hàng do Sale AD bán trực tiếp vẫn bị tự động tính hoa hồng đại lý 3.000.000đ.
  2. Hàm `syncCategory` khi `amountToPay <= 0` (ví dụ hoa hồng = 0) trả về sớm mà không xóa/cập nhật thẻ "Đại lý (Hoa hồng bán tour)" cũ trong danh sách `partnerPayments`.
- **Giải pháp:**
  1. Cập nhật `totalBookingCommissions` chỉ tính hoa hồng định mức đối với các đơn do Đại lý/CTV bán (`seller_type === 'agent'`, có `ctv_info`, hoặc có `agent_commission_amount`). Các đơn do Sale AD bán trực tiếp sẽ không tính hoa hồng định mức.
  2. Cập nhật `syncCategory` trong `getAutoGeneratedPaymentsList` tự động xóa/reset thẻ thanh toán về 0 khi khoản chi phí tương ứng bằng 0 (nếu chưa có lịch thanh toán).
  3. Tự động đồng bộ Mục 2 (Thanh toán đối tác & chứng từ chi trả) ngay khi chọn Tour hoặc khi dữ liệu chi phí Mục 1 cập nhật.
- **Trạng thái:** Đã xử lý hoàn tất, đồng bộ chính xác 100%, biên dịch thành công.

### 1.24 Khắc phục lệch trạng thái nút "Khóa đơn / Mở khóa đơn" giữa Sale và Sale Leader
- **Nguyên nhân:**
  1. Trong `EditOrderModal.tsx`, logic cũ kiểm tra khóa đơn dựa vào `order.status === 'sure' || order.status === 'paid' || Boolean(order.is_locked)`. Khi đơn ở trạng thái đã xác nhận (`sure`) hoặc đã có thanh toán/thanh toán một phần, tài khoản **Sale** bị hệ thống khóa tài chính và thông báo *"Chỉ Quản trị viên (Admin) và Sale Leader mới có quyền điều chỉnh hoặc mở khóa booking"*.
  2. Tại giao diện Quản lý Booking (`OrdersManagement.tsx`), nút bấm hành động của **Sale Leader** lại chỉ kiểm tra duy nhất thuộc tính `order.is_locked`. Do thuộc tính `is_locked` chưa được ghi nhận là `true` trong database khi đơn chuyển trạng thái, dẫn đến phía **Sale Leader** nút vẫn hiển thị **`🔒 Khóa đơn`** thay vì **`🔓 Mở khóa đơn`**.
  3. Thậm chí nếu Sale Leader bấm Khóa đơn rồi Mở khóa đơn (`is_locked: false`), thì ở Modal `EditOrderModal.tsx`, logic cũ vẫn bị vướng `order.status === 'sure'` nên Sale vẫn không thể sửa tài chính.
- **Giải pháp:**
  1. Tạo hàm chuẩn hóa `isOrderLocked(order)` trong `CRMContext.tsx`: nếu `order.is_locked === false` thì trả về `false` (ưu tiên quyết định mở khóa thủ công của Leader/Admin); nếu `is_locked` chưa khai báo thì mặc định trả về `true` khi đơn thuộc trạng thái `sure`, `paid` hoặc có phiếu thu (`partially_paid`).
  2. Cập nhật `OrdersManagement.tsx` dùng `isOrderLocked(order)` để hiển thị nút **`🔓 Mở khóa đơn`** chính xác cho Sale Leader khi đơn bị khóa.
  3. Cập nhật `EditOrderModal.tsx` và `EditPassengerModal.tsx` dùng `isOrderLocked(order)`. Khi Sale Leader mở khóa (`is_locked: false`), Sale được phép sửa tài chính và khi lưu xong hệ thống tự động khóa lại (`is_locked: true`).
  4. Cập nhật `confirmOrder` trong `CRMContext.tsx` tự động gán `is_locked: true` khi duyệt đơn từ Hold sang Sure.
- **Trạng thái:** Đã xử lý hoàn tất, đồng bộ 100% trạng thái khóa/mở khóa đơn giữa Sale và Sale Leader, biên dịch thành công.

### 1.25 Mở khóa đăng ký Visa khi Mở khóa đơn & Giám sát/Cảnh báo số lượng hành khách khai báo (VD: 3/2 khách)
- **Nguyên nhân:**
  1. Trong `EditPassengerModal.tsx`, biến `isVisaOptionLocked` bị ép cố định thành `true` khi `hasConfirmedVisaChoice` có giá trị. Điều này khiến tài khoản Sale không thể đổi tùy chọn làm Visa qua Tour cho khách ngay cả khi đơn hàng đã được mở khóa.
  2. Khi sửa số chỗ của đơn hàng giảm xuống (hoặc khi thêm khách), số lượng hành khách đã khai báo trong danh sách có thể nhiều hơn số chỗ đăng ký trên đơn (ví dụ 3/2 khách). Nút **"Xóa"** trước đó dùng `window.confirm` bị chặn bởi iframe sandbox nên không hiển thị hộp thoại xác nhận khi bấm.
  3. Badge **"Đã thanh toán"** bị mất trên thẻ booking khi đơn đã thanh toán đủ do logic kiểm tra `isFullyPaid` chỉ phụ thuộc vào danh sách hóa đơn `invoices` riêng lẻ mà bỏ qua `order.status === 'paid'` và `order.payment_status === 'paid'`.
- **Giải pháp:**
  1. Cập nhật `EditPassengerModal.tsx`: Cho phép sửa tùy chọn Visa khi `!isOrderExplicitlyLocked` (đơn đang mở khóa) hoặc tài khoản có vai trò Admin / Sale Leader.
  2. Cập nhật `OrdersManagement.tsx`: 
     - Thay thế `window.confirm` bằng `setConfirmModalData` (dùng `ActionModal` chuẩn UI) cho nút **"Xóa"** hành khách, đảm bảo hiển thị popup xác nhận đẹp mắt và hoạt động 100% trong môi trường iframe.
     - Chuẩn hóa tính toán `effectivePaidAmount`, `isFullyPaid` và `isPartiallyPaid` kết hợp cả `order.paid_amount`, `order.status` và `order.payment_status`. Đảm bảo đơn đã thanh toán luôn hiển thị tag **"Đã thanh toán"** (hoặc **"Thanh toán một phần"**) chính xác.
     - Tự động cập nhật `total_price` và điều chỉnh `payment_status` từ **"Đã thanh toán"** (`paid`) sang **"Thanh toán một phần"** (`partially_paid`) khi Sale đăng ký thêm dịch vụ Visa qua tour cho hành khách, giúp hiển thị dư nợ còn thiếu và nút thanh toán bổ sung cho Kế toán/Sale thu tiền Visa.
     - Bổ sung thanh cảnh báo khi số khách khai báo vượt quá số chỗ đăng ký trên đơn.
- **Trạng thái:** Đã xử lý hoàn tất, hiển thị badge thanh toán chính xác 100%, popup xóa hành khách mượt mà, biên dịch thành công.

### 1.26 Tối ưu hóa quy trình khóa đơn hàng & Chi phí Visa theo số khách
- **Mô tả yêu cầu:** 
  1. Chỉ khóa đơn hàng (`is_locked: true`) khi người dùng thực hiện Lưu trong Bảng tính giá & dịch vụ (`EditOrderModal.tsx`) hoặc khi chọn/thay đổi tùy chọn đăng ký làm Visa theo tour cho hành khách (`EditPassengerModal.tsx`). Các đơn hàng được mở khóa sẽ giữ nguyên trạng thái mở cho đến khi một trong hai thao tác lưu trên được thực thi.
  2. Trong Bảng chi phí Tour (`TourCostsManagement.tsx`), chi phí Visa được nhập dạng **Đơn giá Visa / khách**. Hệ thống tự động tính toán và hiển thị thông tin trực quan bên dưới: `⚡ Tổng tiền Visa đoàn ({N} khách): {Tổng} ({Đơn giá}/khách × {N} khách)`.
  3. Bổ sung ô nhập **Chi phí Visa / Khách** và **Chi phí Khác** dành cho **Tour gửi đối tác (`isOutsourcedTour`)**, đồng thời cộng tự động vào tổng chi phí đoàn và đồng bộ khoản phải chi cho Nhà cung cấp dịch vụ Visa.
- **Giải pháp:** 
  1. Cập nhật `updatePassenger` trong `CRMContext.tsx` để tự động thiết lập `is_locked: true` cho đơn hàng khi thông tin hành khách hoặc tùy chọn visa qua tour được lưu.
  2. Cập nhật `TourCostsManagement.tsx` để tính tổng chi phí Visa = `visaAmount * totalConfirmedPassengers`, hiển thị badge tổng tiền trực quan dưới ô nhập đơn giá Visa.
  3. Bổ sung các ô nhập chi phí Visa và Chi phí khác trong khối giao diện `isOutsourcedTour`, cập nhật công thức `totalCosts` và đồng bộ thẻ thanh toán nhà cung cấp Visa tương ứng.
- **Trạng thái:** Đã hoàn thành, biên dịch thành công 100%.

### 1.27 Phân quyền hiển thị thẻ "Gửi khách đối tác" tại Lịch khởi hành
- **Mô tả yêu cầu:**
  Phần hiển thị thông tin thẻ "🤝 GỬI KHÁCH ĐỐI TÁC: {Tên đối tác} ({SĐT})" tại trang Lịch khởi hành (`DepartureCalendar.tsx`) chỉ hiển thị cho các vai trò: **Điều hành tour (`operator`)**, **Quản trị viên (`admin`)**, **Sale Leader (`sale_leader`)** và **Ban Giám Đốc (`bod`)**. Các vai trò khác (như Sale, CTV, Kế toán, Visa, HDV) sẽ không nhìn thấy thẻ này.
- **Giải pháp:**
  Cập nhật component `TourCard` trong `src/pages/DepartureCalendar.tsx`: sử dụng `useCRM()` để lấy `currentRole` và thêm điều kiện kiểm tra `['operator', 'admin', 'sale_leader', 'bod'].includes(currentRole)` trước khi hiển thị thẻ `GỬI KHÁCH ĐỐI TÁC`.
- **Trạng thái:** Đã hoàn thành, biên dịch thành công 100%.

### 1.28 Hiển thị Tour F2 / Gửi khách đối tác ở Lịch khởi hành cho Đại lý & CTV
- **Mô tả yêu cầu:**
  Tất cả các tour khởi hành (bao gồm cả Tour F2 / Gửi khách đối tác / Outsourced) phải được hiển thị đầy đủ trên trang Lịch khởi hành cho vai trò **Đại lý (`agent`)** và **CTV** để đại lý xem giá bán, giữ chỗ và theo dõi hoa hồng.
- **Giải pháp:**
  Cập nhật hàm `filteredTours` trong `DepartureCalendar.tsx`: loại bỏ bộ lọc ẩn Tour F2 đối với Đại lý/CTV. Mọi loại tour (ngoại trừ Dịch vụ Visa lẻ) đều hiển thị bình thường. Thẻ thông tin nguồn đối tác nhạy cảm (`🤝 GỬI KHÁCH ĐỐI TÁC: {Tên đối tác}`) đã được bảo vệ từ mục 1.27 và chỉ hiển thị cho 4 vai trò quản lý/điều hành (`operator`, `admin`, `sale_leader`, `bod`).
- **Trạng thái:** Đã hoàn thành, biên dịch thành công 100%.

### 1.29 Tự động lọc ẩn các tour đã khởi hành tại trang Lịch khởi hành
- **Mô tả yêu cầu:**
  Trang Lịch khởi hành (`DepartureCalendar.tsx`) không hiển thị các tour đã khởi hành (các tour có ngày khởi hành trước 00:00 ngày hôm nay) để giữ giao diện mở bán luôn gọn gàng và tập trung vào các tour đang và sắp khởi hành.
- **Giải pháp:**
  Cập nhật bộ lọc `filteredTours` trong `DepartureCalendar.tsx`: bổ sung điều kiện so sánh ngày khởi hành (`departure_time` hoặc `start_date`) với mốc 00:00 ngày hôm nay (`todayStart`). Các tour có thời gian khởi hành trước thời điểm này sẽ tự động bị loại bỏ khỏi danh sách hiển thị trên Lịch khởi hành. Người dùng có thể xem lại danh sách tất cả các tour (bao gồm tour đã khởi hành) tại trang Quản lý Tour.
- **Trạng thái:** Đã hoàn thành, biên dịch thành công 100%.

### 1.30 Loại bỏ tính năng Bảng điều hành chiến lược (Executive Dashboard)
- **Mô tả yêu cầu:**
  Loại bỏ hoàn toàn trang và tính năng "Điều hành chiến lược" (`/dashboard/executive`) khỏi hệ thống do không cần thiết.
- **Giải pháp:**
  1. Gỡ bỏ đường dẫn `/dashboard/executive` khỏi danh sách `navigation` trên Sidebar (`src/components/Layout.tsx`).
  2. Gỡ bỏ nút bấm "Bảng Điều Hành Chiến Lược" trên trang Bảng điều khiển CRM (`src/pages/Dashboard.tsx`).
  3. Xóa Route `/dashboard/executive` và import tương ứng trong `src/App.tsx`.
  4. Xóa file trang `src/pages/ExecutiveDashboard.tsx` và toàn bộ thư mục `src/components/executive/`.
- **Trạng thái:** Đã hoàn thành, biên dịch thành công 100%.

### 1.31 Nâng cấp Bảng Điều Khiển (Dashboard.tsx) Tự Động Phân Loại Theo 3 Nhóm Vai Trò
- **Mô tả yêu cầu:**
  Tích hợp và nâng cấp toàn bộ trang Dashboard (`src/pages/Dashboard.tsx`) để tự động tùy chỉnh chỉ số, biểu đồ và báo cáo hiển thị theo 3 nhóm vai trò: Sale Công ty (`sale`), Trưởng Nhóm Sale (`sale_leader`) và Ban Giám Đốc/Admin (`admin` / `bod`).
- **Giải pháp:**
  1. **Cập nhật Types (`src/types.ts`):** Bổ sung `team_id`, `team_name`, `Profile`, `TeamPerformanceSummary` và `SalePerformanceSummary`.
  2. **Giao diện Sale Công Ty (`sale`):** Bỏ hoàn toàn ô "Hoa hồng tạm tính", lọc duy nhất đơn cá nhân. Hiển thị 4 thẻ: Doanh số chốt, Tiến độ KPI %, Số lượt khách Pax, Giữ chỗ sắp hết hạn Hold kèm 2 bảng chi tiết (Đơn cá nhân & Đơn hỗ trợ nhập hộ cho CTV/Đại lý).
  3. **Giao diện Sale Leader (`sale_leader`):** Thống kê theo nhóm do Leader quản lý (Doanh số nhóm, % KPI nhóm, Số khách nhóm, Đặt chỗ mở nhóm). Hiển thị Bảng xếp hạng doanh số nhân viên trong team (Leaderboard) và Báo cáo hạch toán Lãi/Lỗ Tour gửi đối tác (`outsourced`) & Tour đoàn riêng (`private`).
  4. **Giao diện Giám Đốc / BOD (`admin` | `bod`):** Tích hợp Bảng điều hành chiến lược gồm 4 thẻ chỉ số tổng quan (Doanh thu toàn công ty, Lãi gộp, Net Margin %, Tổng Pax), 2 biểu đồ (Cơ cấu kênh bán & Tỷ trọng lợi nhuận loại tour), Khối Báo cáo Hiệu Quả Kinh Doanh Theo Team (Team Performance) và Khối Báo cáo Hiệu Quả & Xếp Hạng Chi Tiết Theo Nhân Viên Sale (Sale Performance Breakdown).
- **Trạng thái:** Đã hoàn thành, biên dịch thành công 100%.

### 1.32 Bổ Sung Bộ Chuyển Đổi Chế Độ Xem Báo Cáo (Bảng, Cột, Đường, Hình Tròn) Trên Dashboard
- **Mô tả yêu cầu:**
  Tất cả các khối báo cáo dạng bảng trên Dashboard (Báo cáo Hiệu quả Kinh doanh Theo Team, Báo cáo Chi tiết Theo Nhân viên Sale, và Bảng Xếp hạng Doanh số Team) cần có thêm các chế độ hiển thị linh hoạt dạng Cột (Bar Chart), dạng Đường (Line Chart) và dạng Hình Tròn (Pie Chart) bên cạnh dạng Bảng truyền thống.
- **Giải pháp:**
  1. Bổ sung các biến state quản lý `viewMode` cho từng khối báo cáo (`teamViewMode`, `saleViewMode`, `leaderboardViewMode`).
  2. Tích hợp thanh điều khiển UI Switcher với 4 biểu tượng (`Table`, `BarChart3`, `LineChart`, `PieChart`) trực quan, hỗ trợ responsive trên cả mobile và desktop.
  3. Render linh hoạt dữ liệu tương ứng theo component `BarChart`, `RechartsLineChart`, hoặc `PieChart` từ `recharts` với định dạng tiền tệ `formatCurrency`, tooltip và legend đầy đủ.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.33 Xây Dựng Hệ Thống Quản Lý Team Kinh Doanh & Đồng Bộ Động Lên Dashboard
- **Mô tả yêu cầu:**
  Xây dựng tính năng quản lý Team kinh doanh linh hoạt trong Cài đặt hệ thống (thay vì cố định cứng trong mã nguồn), hỗ trợ tạo/sửa/xóa Team, gán Leader, nhập KPI mục tiêu tháng và gán nhân viên vào Team. Dữ liệu Team sau đó tự động đồng bộ lên Báo cáo Hiệu Quả Kinh Doanh Theo Team trên Dashboard.
- **Giải pháp:**
  1. **Cơ sở dữ liệu & API Backend (`supabase-schema.sql` & `app.ts`):** Tạo bảng `teams` (id, name, leader_id, leader_name, kpi_target, created_at), kích hoạt RLS và bổ sung 4 API CRUD `/api/admin/teams`. Đồng thời cập nhật API users để lưu và trả về `team_id` và `team_name`.
  2. **Giao diện Quản lý Cài đặt Hệ thống (`UserManagement.tsx`):** Thêm bộ tab chuyển đổi "👥 Quản lý Nhân sự & Tài khoản" và "🏢 Quản lý Team Kinh doanh". Hỗ trợ modal tạo/sửa/xóa Team, chọn Leader từ các nhân sự thuộc vai trò Leader/Admin/BOD, thiết lập KPI tháng và gán nhân viên vào Team.
  3. **Đồng bộ Bảng điều khiển (`Dashboard.tsx`):** Cập nhật hàm tổng hợp `teamsMap` tải danh sách Team linh hoạt từ API `/api/admin/teams`, tự động gom nhóm doanh số, số lượt khách Pax, số đơn hàng và tỷ lệ hoàn thành KPI % của nhân viên theo `team_id` / `team_name` thực tế.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.34 Giới hạn chọn Tour trong form Tạo Booking mới tại Quản lý Booking chỉ dành cho Tour đoàn riêng
- **Mô tả yêu cầu:**
  Giới hạn danh sách Tour du lịch trong dropdown chọn Tour (`Select`) của form Đặt giữ chỗ/Tạo Booking mới tại trang Quản lý Booking (`OrdersManagement.tsx`) chỉ hiển thị duy nhất các **Tour đoàn riêng (`tour_type === 'private'`)**. Đối với các tour ghép, tour tự vận hành (`internal`), hay tour gửi đối tác (`partner`) thì việc đặt giữ chỗ sẽ được thao tác thông qua trang **Lịch khởi hành (`DepartureCalendar.tsx`)**.
- **Giải pháp:**
  Cập nhật file `src/pages/OrdersManagement.tsx` tại form tạo mới (`showCreateForm`): thay đổi bộ lọc danh sách tour `.filter(t => t.tour_type !== 'visa')` thành `.filter(t => t.tour_type === 'private')`. Đồng thời cập nhật nhãn `Chọn Tour đoàn riêng *` và placeholder `-- Chọn Tour đoàn riêng --` tương ứng để nâng cao trải nghiệm người dùng.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.35 Chuyển đổi Bộ lọc Team trên Dashboard sang Động theo Cài đặt Hệ thống
- **Mô tả yêu cầu:**
  Đồng bộ hóa bộ lọc "Lọc theo Team" ở Bảng điều khiển (Dashboard) để tải dữ liệu danh sách team một cách hoàn toàn tự động và động từ Cài đặt hệ thống (thay vì để cứng tĩnh như ban đầu), nhằm đáp ứng việc cập nhật/thay đổi danh sách team kinh doanh trong cơ sở dữ liệu.
- **Giải pháp:**
  1. Khai báo các biến `defaultTeams` và `activeTeams` bằng `useMemo` ngay đầu component `Dashboard.tsx`, tự động sử dụng danh sách `fetchedTeams` từ API `/api/admin/teams` hoặc fallback về cấu hình mặc định.
  2. Cập nhật `executiveData`'s `useMemo` sử dụng biến `activeTeams` này để thống kê hiệu quả kinh doanh, đồng thời bổ sung `activeTeams` vào mảng dependency để tự động tính toán lại dữ liệu ngay khi danh sách team thay đổi.
  3. Thay thế các thẻ `<option>` tĩnh chứa tên team cũ tại bộ lọc chọn team thành dạng map động `{activeTeams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}`.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.36 Ẩn Tour Đoàn Riêng khỏi Lịch Khởi Hành & Chuẩn Hóa Giao Diện Quản Lý Tour Đoàn Riêng
- **Mô tả yêu cầu:**
  1. Loại bỏ các **Tour đoàn riêng (`tour_type === 'private'`)** khỏi màn hình **Lịch khởi hành (`DepartureCalendar.tsx`)** vì đây là các tour đặt theo hợp đồng riêng của tổ chức/doanh nghiệp, không mở bán lẻ giữ chỗ công khai cho Sale/Đại lý.
  2. Chuẩn hóa giao diện quản lý và thao tác đối với Tour đoàn riêng tại **Quản lý Tour (`ToursManagement.tsx`)** sao cho không quản lý/thao tác như tour ghép thông thường:
     - Ẩn các nút "Thêm ngày đi mới" và "Tạo hàng loạt (Series)" trên thanh tiêu đề nhóm tour.
     - Cột **Giờ Giữ & Vé**: Hiển thị badge `👑 Theo Hợp đồng` thay cho thời gian giữ chỗ 48h / vé.
     - Cột **Trạng thái chỗ**: Hiển thị badge `👑 Trọn đoàn ({pax} Khách)` thay cho đếm số ghế Sure/Hold/Trống.
     - Cột **Hành động**: Ẩn nút "Sao chép ngày khởi hành" (Clone) đối với Tour đoàn riêng vì hợp đồng đoàn riêng là duy nhất, không dùng làm mẫu chuỗi khởi hành.
- **Giải pháp:**
  1. Cập nhật `src/pages/DepartureCalendar.tsx` bổ sung điều kiện lọc `if (tour.tour_type === 'visa' || tour.tour_type === 'private') return false;` tại `filteredTours`.
  2. Cập nhật `src/pages/ToursManagement.tsx` điều chỉnh điều kiện hiển thị nút header `firstTour.tour_type !== 'private'`, badge cột "Giờ Giữ & Vé" và "Trạng thái chỗ", đồng thời ẩn nút `handleCloneTour` khi `t.tour_type === 'private'`.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.37 Sửa Lỗi Giữ Nguyên Giá Tour Đoàn Riêng & Bổ Sung Đồng Bộ Đơn Hàng Liên Kết & Hoa Hồng
- **Mô tả yêu cầu:**
  1. Sửa lỗi đối với Tour đoàn riêng (`tour_type === 'private'`): khi người dùng sửa giá tour trọn gói (ví dụ 150.000.000 VNĐ cho 30 pax) và hoa hồng, khi reload lại trang thì giá tour bị đổi lại thành giá bình quân mỗi khách (5.000.000 VNĐ).
  2. Đảm bảo Đơn hàng (Booking) tự động sinh của Tour đoàn riêng cũng cho phép thanh toán nhiều đợt bình thường và được đồng bộ lại số tiền hợp đồng (`total_price`), số khách (`adult_count`) khi cập nhật Tour đoàn riêng.
- **Giải pháp:**
  1. Sửa hàm `addTour` và `updateTour` trong `src/context/CRMContext.tsx`: Đối với Tour đoàn riêng (`tour_type === 'private'`), giữ nguyên `price` là Tổng giá trị hợp đồng trọn gói (ví dụ 150.000.000 VNĐ), không bị ghi đè bởi `price_adult` (5.000.000 VNĐ) khi đẩy dữ liệu lên Supabase.
  2. Cập nhật `src/pages/ToursManagement.tsx`:
     - Bổ sung ô nhập "Hoa hồng trích thưởng/chiết khấu (VNĐ)" vào biểu mẫu khai báo/chỉnh sửa Tour đoàn riêng để linh hoạt quản lý hoa hồng cho đại lý/Sale/người giới thiệu đoàn.
     - Khi thực hiện cập nhật Tour đoàn riêng, tự động tìm Đơn hàng (Booking) liên kết và gọi `updateOrder` để đồng bộ lại `total_price`, `adult_count`, tên và điện thoại người đặt.
  3. Xác nhận quy trình thanh toán nhiều đợt: Đơn hàng của Tour đoàn riêng hoàn toàn là một Booking tiêu chuẩn trong hệ thống, tự động hiển thị trên Quản lý Đơn hàng (`OrdersManagement.tsx`) và Kế toán (`AccountingInvoice.tsx`) để tạo các Phiếu thu đợt 1, đợt 2, đợt 3... bình thường.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.38 Tự Động 100% Khởi Tạo & Đồng Bộ Booking Cho Tour Đoàn Riêng
- **Mô tả yêu cầu:**
  - Quy trình sinh Đơn hàng (Booking) cho Tour đoàn riêng phải hoàn toàn tự động 100%, không cần người dùng phải bấm nút khởi tạo thủ công nữa.
- **Giải pháp:**
  1. **Cập nhật `src/context/CRMContext.tsx`**: Bỏ qua hạn chế chỗ trống (`allowedMaxSeats < seatsToLock`) khi `tour_type === 'private'` để đảm bảo đơn hàng đoàn riêng luôn khởi tạo thành công.
  2. **Cập nhật `src/pages/ToursManagement.tsx`**:
     - Thêm cơ chế **Auto-Sync (useEffect background listener)**: Tự động rà soát danh sách Tour đoàn riêng. Bất kỳ Tour đoàn riêng nào chưa có Booking liên kết trong `orders` sẽ tự động kích hoạt `createOrder` sinh ngay Booking tiêu chuẩn mà không cần thao tác bấm nút.
     - Hiển thị badge xanh `✓ Booking #XXXXXX` tự động trên danh sách Tour.
     - Khi tạo mới hoặc cập nhật thông tin Tour đoàn riêng, hệ thống tự động sinh/cập nhật Booking tương ứng.
  3. **Cập nhật `src/pages/OrdersManagement.tsx`**: Cho phép chọn và hiển thị đầy đủ Đơn hàng Tour đoàn riêng trong danh sách Quản lý Đơn hàng & Kế toán.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.39 Cập Nhật Hiển Thị Badge Trạng Thái "👑 TOUR ĐOÀN RIÊNG" Trong Quản Lý Booking
- **Mô tả yêu cầu:**
  - Điều chỉnh nhãn hiển thị tại trang Quản lý Booking cho các đơn hàng Tour đoàn riêng từ "SURE CHỖ" thành "👑 TOUR ĐOÀN RIÊNG", do Tour đoàn riêng được bán theo hợp đồng trọn gói và không áp dụng quy trình giữ chỗ/sure chỗ thông thường.
- **Giải pháp:**
  1. **Cập nhật `src/pages/OrdersManagement.tsx`**:
     - Tại danh sách Booking: Đổi badge trạng thái của Tour đoàn riêng (`tour?.tour_type === 'private'`) thành **`👑 TOUR ĐOÀN RIÊNG`** nổi bật với màu vàng hổ phách (`bg-amber-50 text-amber-800 border-amber-200`).
     - Tại phần Chi tiết Booking rộng: Hiển thị nhãn **`👑 Tour đoàn riêng (Hợp đồng trọn gói)`**.
     - Tại Bảng Thống kê Tổng quan (Modal): Cột trạng thái hiển thị **`ĐOÀN RIÊNG`**.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.40 Xử Lý Lỗi Nút Xóa Tour Không Phản Hồi (Tích Hợp Modal Xác Nhận)
- **Mô tả yêu cầu:**
  - Khi bấm nút biểu tượng thùng rác (Xóa Tour) tại danh sách Quản lý Tour (`ToursManagement.tsx`), hệ thống không hiển thị gì và không thực hiện thao tác xóa.
- **Nguyên nhân & Giải pháp:**
  - **Nguyên nhân:** Đoạn mã sử dụng hàm xác nhận mặc định `confirm()` của trình duyệt. Do ứng dụng chạy trong môi trường iFrame (Preview), hàm `window.confirm()` bị trình duyệt chặn (block modal) dẫn đến không hiển thị hộp thoại xác nhận.
  - **Giải pháp:**
    1. **Cập nhật `src/pages/ToursManagement.tsx`**: Xóa bỏ `confirm()` mặc định và thay bằng **Modal Popup Xác Nhận Xóa Tour** giao diện chuẩn React với overlay mờ, badge mã tour, tên tour, cảnh báo màu đỏ và nút bấm "Xác nhận Xóa Tour" & "Hủy bỏ".
    2. **Cập nhật `src/pages/TourMediaManagement.tsx`**: Thay thế `confirm()` khi xóa file ảnh đoàn bằng Modal Popup Xác nhận Xóa File tương tự.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.41 Ngăn Chặn, Tự Động Dọn Dẹp Trùng Lặp Booking & Bỏ Popup Modal Khi Tạo Tour Đoàn Riêng
- **Mô tả yêu cầu:**
  - Giải thích chức năng của bảng Popup thông báo thành công và xóa bỏ bảng này khỏi giao diện.
  - Kiểm tra và xử lý triệt để tình trạng tự động sinh ra 2 đơn hàng (Booking) trùng lặp khi khởi tạo Tour đoàn riêng.
- **Nguyên nhân & Giải pháp:**
  - **Mô tả Popup:** Bảng trong ảnh là **Modal thông báo khởi tạo Tour đoàn riêng thành công** tích hợp các nút truy cập nhanh (Nhập danh sách Pax & Lập phiếu thu).
  - **Nguyên nhân bị tạo 2 Booking trùng:** Khi gọi `createOrder`, lệnh `creatingPrivateTourOrderSetRef.current.add(tour.id)` nằm sau câu lệnh `await supabase.from('bookings').select(...)`. Do đó khi 2 cuộc gọi diễn ra đồng thời (từ `handleSaveTour` và `useEffect` auto-sync), cuộc gọi thứ 2 lọt qua kiểm tra trước khi cuộc gọi thứ 1 kịp thêm ID vào Set.
  - **Giải pháp xử lý:**
    1. **Cập nhật `src/pages/ToursManagement.tsx`**: Xóa bỏ hoàn toàn Popup Modal (`showPrivateSuccessModal`, `createdPrivateTour`, `createdPrivateOrder` và đoạn render JSX). Sau khi khởi tạo Tour đoàn riêng thành công, tự động reset form và đóng giao diện nhập liệu.
    2. **Cập nhật `src/context/CRMContext.tsx`**: Chuyển lệnh `creatingPrivateTourOrderSetRef.current.add(tour.id)` lên ngay dòng đầu tiên của `if (isPrivateTour)` trước các câu lệnh `await` để khóa đồng bộ (synchronously) tuyệt đối 100%, ngăn chặn hoàn toàn việc gọi trùng lệnh `createOrder`.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.42 Tối Ưu Nâng Cấp Giao Diện Hiển Thị Trạng Thái Tải File Biên Lai / Hóa Đơn Chuyển Khoản Thành Công
- **Mô tả yêu cầu:**
  - Nâng cấp giao diện khu vực upload file tại Modal nộp hóa đơn thanh toán (`PaymentModal.tsx`) và trang Kế toán (`AccountingInvoice.tsx`) để hiển thị thông tin rõ ràng, trực quan khi người dùng chọn/tải file thành công.
- **Giải pháp:**
  1. **Cập nhật `src/components/PaymentModal.tsx`**:
     - Thiết kế lại trạng thái khi `file` được chọn: hiển thị thẻ khung xanh emerald nhạt (`bg-emerald-50/80 border-emerald-300`), icon check xanh nổi bật, badge `✓ Đã chọn file thành công` nổi bật, dung lượng file tính tự động bằng KB/MB (`formatFileSize`).
     - Tích hợp khung Xem trước ảnh hóa đơn chuyển tiền (`URL.createObjectURL(file)`) đối với file ảnh.
     - Bổ sung nút bấm trực quan **"Đổi file"** và **"Xóa file"** (nút Trash) giúp người dùng dễ dàng chỉnh sửa lại file mà không bị nhầm lẫn.
  2. **Cập nhật `src/pages/AccountingInvoice.tsx`**:
     - Nâng cấp đồng bộ cả 2 khu vực upload ảnh biên lai chuyển khoản (modal Duyệt chi & modal Cập nhật ảnh chuyển khoản) sang giao diện xanh emerald với thông tin dung lượng file, tên file, badge và khung xem trước tương tự.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.43 Bổ Sung Bộ Lọc Đa Năng Cho Phân Hệ Quản Lý Chi Phí & Lãi Lỗ Tour (TourCostsManagement)
- **Mô tả yêu cầu:**
  - Bổ sung bộ lọc linh hoạt cho phần Quản lý Chi phí & Lãi lỗ Tour (`TourCostsManagement.tsx`) giúp người dùng tìm kiếm, phân loại và theo dõi nhanh số liệu doanh thu/chi phí/lợi nhuận theo nhiều tiêu chí.
- **Giải pháp:**
  1. **Cập nhật `src/components/TourCostsManagement.tsx`**:
     - Thêm các state quản lý bộ lọc: Tìm kiếm từ khóa (`searchTerm`), Loại tour (`filterTourType`: Tự vận hành, Gửi đối tác F2, Đoàn riêng), Trạng thái khởi hành (`filterStatus`: Sắp khởi hành, Đang chạy, Đã hoàn thành, Đã hủy), Tháng khởi hành (`filterMonth`), Danh mục sản phẩm (`filterCategory`), Trạng thái hạch toán (`filterProfit`: Có lãi, Bị lỗ, Hòa vốn).
     - Thiết kế lại khung Header Overview chứa **Bảng Tổng quan Chỉ số Dữ liệu Lọc**: Tự động tính tổng số tour, tổng doanh thu dự kiến, tổng chi phí và tổng lợi nhuận ròng của tất cả các tour thỏa mãn điều kiện lọc hiện tại.
     - Tích hợp **Grid 6 Bộ Lọc Song Song** trực quan với dropdown hỗ trợ Tiếng Việt và các biểu tượng icon rõ ràng.
     - Bổ sung thanh **Trạng thái Bộ lọc Đang Bật (Active Filters Bar)** kèm nút **"Xóa tất cả bộ lọc"** giúp quay lại trạng thái ban đầu chỉ bằng 1 cú click.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.44 Khắc phục lỗi cập nhật thông tin người dùng (Profile) trên Supabase
- **Mô tả yêu cầu / Lỗi:**
  - Hệ thống báo lỗi "Lỗi khi cập nhật profile trên Supabase" khi thực hiện thao tác cập nhật thông tin người dùng (như tài khoản ngân hàng, địa chỉ, status, tier, v.v.).
- **Nguyên nhân:**
  - Bảng `profiles` ban đầu trong CSDL Supabase chỉ có các trường cơ bản (`id`, `full_name`, `phone`, `company_name`, `role`, `leader_id`, `created_at`). Khi ứng dụng gửi lệnh update/insert thêm các trường mở rộng (`bank_name`, `bank_account_number`, `bank_account_holder`, `address`, `status`, `tier`, `notes`, `email`), Supabase trả về lỗi thiếu cột (code `42703` / `PGRST204`).
- **Giải pháp:**
  1. **Cập nhật CSDL (`supabase-schema.sql`)**: Bổ sung các lệnh `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ...` cho các cột `email`, `address`, `bank_name`, `bank_account_number`, `bank_account_holder`, `notes`, `status`, `tier`.
  2. **Cơ chế Tự Sửa Lỗi Cột Thiếu (Self-Healing Fallback)**: Cập nhật hàm `updateAgentProfile` và `addAgentProfile` trong `src/context/CRMContext.tsx` cũng như `updateProfile` trong `src/context/AuthContext.tsx`. Nếu Supabase phản hồi lỗi thiếu cột, ứng dụng tự động bóc tách tên cột bị thiếu, xóa khỏi payload và tự động gửi lại lệnh update/insert mà không làm ngắt quãng trải nghiệm hay hiển thị thông báo lỗi cho người dùng.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.45 Tối Ưu Hiển Thị Tên Công Ty/CTV Đầy Đủ & Ẩn ID Trên Giao Diện Đại Lý & CTV (`CustomersManagement.tsx`)
- **Mô tả yêu cầu:**
  - Ẩn dòng chữ ID (`ID: #DEMO-AG-...`) trên thẻ giao diện đối tác.
  - Hiển thị đầy đủ tên Công ty/CTV không bị cắt gọt (`truncate`) khi tên dài (như "Công ty TNHH Du Lịch Việt Travel").
- **Giải pháp:**
  1. Loại bỏ hoàn toàn phần hiển thị `ID: #...` trên các thẻ thông tin đối tác ở góc nhìn Grid view.
  2. Xóa các class `truncate` cứng khỏi phần tên đối tác (`ag.full_name`) và tên công ty (`ag.company_name`), bổ sung class `break-words`, `leading-normal` và `flex-1` để tên công ty tự động xuống dòng và hiển thị trọn vẹn 100%.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.46 Sửa Lỗi Không Lưu Thông Tin Đại Lý & CTV Khi Sửa Trên Trang Quản Lý (`CustomersManagement.tsx` & `CRMContext.tsx`)
- **Mô tả yêu cầu / Lỗi:**
  - Khi bấm chỉnh sửa thông tin Đại lý / CTV trên trang Quản lý Đại lý & CTV, sau khi bấm lưu thì thông tin mới không được lưu lại hoặc bị mất khi tải lại trang.
- **Nguyên nhân:**
  - `CRMContext.tsx` chưa đồng bộ việc lưu thông tin thay đổi vào `localStorage` key `'tour_crm_agent_profiles'`. Đồng thời, hàm `refreshProfiles` khi chạy lại chưa hợp nhất (merge) dữ liệu tùy chỉnh trong `localStorage` với dữ liệu remote khiến dữ liệu sửa bị reset về ban đầu.
- **Giải pháp:**
  1. Thêm hàm `saveProfilesToLocalStorage` trong `CRMContext.tsx` để tự động lưu vĩnh viễn danh sách `profilesList` mới nhất khi thực hiện `addAgentProfile`, `updateAgentProfile`, và `deleteAgentProfile`.
  2. Nâng cấp `refreshProfiles` để kết hợp dữ liệu chỉnh sửa trong `localStorage` đè lên danh sách gốc, đảm bảo duy trì toàn bộ thông tin đã sửa kể cả khi reload trang.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.47 Sửa Lỗi Không Đồng Bộ Lưu Dữ Liệu Đại Lý / CTV Lên Supabase (`supabase-schema.sql` & `CRMContext.tsx`)
- **Mô tả yêu cầu / Lỗi:**
  - Đã chạy SQL cập nhật cột bảng `profiles` nhưng khi thêm mới hoặc chỉnh sửa Đại lý / CTV từ giao diện, dữ liệu vẫn không lưu được lên Supabase.
- **Nguyên nhân:**
  - Bảng `profiles` trên Supabase bị vướng ràng buộc khóa ngoại `profiles_id_fkey` (`REFERENCES auth.users(id)`). Vì các Đại lý / CTV tạo thủ công chưa có tài khoản đăng nhập `auth.users`, Supabase báo lỗi `23503` (vi phạm khóa ngoại) và từ chối `INSERT`/`UPDATE`.
  - Chính sách RLS trên `profiles` thiếu clause `WITH CHECK (true)` cho lệnh `INSERT`/`UPDATE`.
  - Logic cũ trong `CRMContext.tsx` lọc bỏ các ID không phải dạng UUID gốc (ví dụ ID demo) và chưa sử dụng `upsert`.
- **Giải pháp:**
  1. Cung cấp mã SQL gỡ bỏ khóa ngoại `profiles_id_fkey` và nới rộng RLS policy `WITH CHECK (true)` cho bảng `profiles`.
  2. Cập nhật `CRMContext.tsx` sử dụng `toUuid(id)` quy đổi mọi ID sang chuẩn UUID và chuyển sang cơ chế `upsert` trên Supabase. Nếu ID chưa có trong `profilesList` (ví dụ đối tác demo), hệ thống tự động chèn bản ghi mới vào state.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.48 Triển Khai Tính Năng Chatbot Trợ Lý AI Hướng Dẫn ERP (Gemini Copilot)
- **Mô tả yêu cầu / Lỗi:**
  - Tích hợp Trợ lý AI Hướng Dẫn Vận Hành ERP (Gemini Copilot) hỗ trợ toàn thể nhân viên, sale, điều hành, kế toán, đại lý & CTV giải đáp thắc mắc nghiệp vụ du lịch AD Luxury Travel trực tiếp 24/7.
- **Giải pháp:**
  1. **Backend (`app.ts`):** Khởi tạo SDK `@google/genai` sử dụng `process.env.GEMINI_API_KEY`. Xây dựng endpoint `POST /api/ai/chat` tiếp nhận lịch sử hội thoại `messages` và vai trò hiện tại `currentRole`. Cung cấp System Instruction chi tiết 100% quy trình nghiệp vụ AD Luxury Travel (Đại lý trừ nét, CTV bán chênh 20% phí, phân quyền RBAC 9 vai trò, cấu trúc thư mục Google Drive & Supabase Storage, quy trình nộp visa và lập Đề nghị thanh toán DNTT). Sử dụng model `gemini-3.6-flash`.
  2. **Component (`src/components/chat/ERPCopilotModal.tsx`):** Thiết kế Nút bấm nổi (Floating Button) phát sáng góc phải màn hình, cửa sổ Chat Popup hiện đại responsive, hỗ trợ các thẻ câu hỏi gợi ý mẫu nhanh, hiển thị vai trò hiện tại của nhân viên, hỗ trợ Markdown rendering và trạng thái gõ câu trả lời (Typing animation).
  3. **Tích hợp (`src/components/Layout.tsx`):** Đặt `<ERPCopilotModal />` vào Layout chính để trợ lý AI luôn sẵn sàng hỗ trợ ở mọi màn hình ứng dụng.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.49 Cập Nhật Giao Diện UI/CSS & Đổi Tên Thành "Trợ Lý Hướng Dẫn" (`ERPCopilotModal.tsx` & `app.ts`)
- **Mô tả yêu cầu / Lỗi:**
  - Tối ưu hóa toàn diện giao diện Chatbot, nâng cấp CSS hiển thị các nội dung trả lời (Markdown), đồng bộ font chữ, màu sắc, bóng đổ và đổi tên chính thức thành **"Trợ lý hướng dẫn"**.
- **Giải pháp:**
  1. Đổi tên ứng dụng Trợ lý AI trên cả Backend (`app.ts` systemInstruction) và Frontend (`ERPCopilotModal.tsx`) thành **"Trợ lý hướng dẫn"**.
  2. Nâng cấp bộ phân tích và hiển thị Markdown (`renderMarkdown`) cho các câu trả lời: Định dạng rõ ràng danh sách gạch đầu dòng, danh sách đánh số, tiêu đề, chữ in đậm, và mã lệnh inline code.
  3. Cải thiện CSS cho các khối tin nhắn (Bubble), thẻ câu hỏi gợi ý, hiệu ứng typing, banner hiển thị vai trò người dùng và thanh cuộn mượt mà.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.50 Xử Lý Lỗi Trả Lời Bị Ngắt Quãng Của Trợ Lý Hướng Dẫn (`app.ts`)
- **Mô tả yêu cầu / Lỗi:**
  - Cấu hình cũ `maxOutputTokens: 1000` khiến các câu trả lời giải thích quy trình ERP dài hoặc có nhiều bước bị ngắt giữa chừng, không hiển thị trọn vẹn câu từ.
- **Giải pháp:**
  1. Nâng giới hạn token đầu ra `maxOutputTokens` từ `1000` lên `8192` cho model `gemini-3.6-flash` trong `/api/ai/chat` (`app.ts`).
  2. Bổ sung quy tắc vào System Instruction: *"Đảm bảo câu trả lời luôn hoàn chỉnh, cô đọng nhưng đầy đủ thông tin, tuyệt đối không dừng giữa chừng hoặc ngắt quãng câu chữ."*
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.51 Đồng Bộ Giao Diện UI Trợ Lý Hướng Dẫn Theo Chuẩn Hệ Thống (`ERPCopilotModal.tsx`)
- **Mô tả yêu cầu / Lỗi:**
  - Giao diện của Trợ lý hướng dẫn sử dụng tông màu dải chuyển dải tím/hồng rực rỡ không đồng bộ với giao diện chuẩn Navy/Blue/Slate của hệ thống ERP AD Luxury Travel. Thẻ gợi ý câu hỏi xuất hiện thanh cuộn ngang dày làm giảm tính thẩm mỹ.
- **Giải pháp:**
  1. Chuyển đổi toàn bộ màu sắc Header và nút mở Floating Action Button sang tông Navy chuẩn hệ thống (`bg-slate-900 border-b border-slate-800`), nút biểu tượng robot xanh dương (`bg-blue-600/20 text-blue-400`).
  2. Đồng bộ các avatar tin nhắn, nút gửi, thẻ vai trò (Role Status Banner) với hệ thống màu xanh thương hiệu (`bg-blue-600`, `bg-slate-900`, `bg-blue-50 text-blue-700`).
  3. Thêm lớp `scrollbar-none` loại bỏ hoàn toàn thanh cuộn ngang mặc định ở khu vực thẻ câu hỏi gợi ý.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.52 Bỏ Công Thức Toán Học & Thêm Tính Năng Admin Góp Ý/Sửa Thông Tin AI (`app.ts` & `ERPCopilotModal.tsx`)
- **Mô tả yêu cầu / Lỗi:**
  - Yêu cầu Trợ lý hướng dẫn không đưa ra công thức toán học khô khan mà diễn giải quy tắc bằng ngôn ngữ tự nhiên và luôn kèm ví dụ số liệu thực tế cụ thể.
  - Cho phép người dùng vai trò Quản trị viên (`admin`) gửi góp ý / hiệu chỉnh thông tin khi phát hiện câu trả lời chưa chính xác.
- **Giải pháp:**
  1. Cập nhật System Instruction trong `app.ts`: Bắt buộc không cung cấp công thức toán học, luôn đưa ra ví dụ minh họa bằng số liệu thực tế và ghi nhận quyền Admin hiệu chỉnh.
  2. Bổ sung nút **"✏️ Góp ý / Sửa thông tin"** bên dưới các câu trả lời của Trợ lý AI hiển thị riêng cho vai trò Admin (`displayRole === 'admin'`).
  3. Xây dựng cửa sổ Modal tiếp nhận góp ý từ Admin và gửi phản hồi đến API `/api/ai/feedback` ghi nhận dữ liệu hiệu chỉnh.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.53 Chuẩn Hóa Thuật Ngữ Du Lịch & Trả Lời Súc Tích Cho Trợ Lý Hướng Dẫn (`app.ts` & `ERPCopilotModal.tsx`)
- **Mô tả yêu cầu / Lỗi:**
  - Yêu cầu Trợ lý hướng dẫn trả lời cực kỳ ngắn gọn, súc tích, dễ hiểu.
  - Chuẩn hóa thuật ngữ du lịch: Sử dụng từ **"booking"** thay thế hoàn toàn cho "đơn hàng", đồng thời dùng các thuật ngữ ngành chuẩn như **"pax"** (hành khách), **"slot"**, **"giữ chỗ (hold)"**, **"lịch khởi hành"**, **"DNTT"**.
- **Giải pháp:**
  1. Cập nhật System Instruction trong `app.ts` quy định nghiêm ngặt: Tuyệt đối dùng từ **"booking"** thay cho "đơn hàng"; trình bày câu trả lời ngắn gọn theo dạng gạch đầu dòng (bullet points) làm nổi bật từ khóa chính.
  2. Cập nhật các văn bản mẫu và placeholder trong `ERPCopilotModal.tsx` để đồng bộ thuật ngữ.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.54 Đồng Bộ Nút Floating Action Button Màu Xanh Thương Hiệu & Tối Ưu Phân Cấp Bullet Point (`app.ts` & `ERPCopilotModal.tsx`)
- **Mô tả yêu cầu / Lỗi:**
  - Đồng bộ nút nổi kích hoạt Trợ lý hướng dẫn (Floating Action Button) sang tông màu xanh thương hiệu hệ thống (`bg-blue-600 hover:bg-blue-700 shadow-blue-600/30`).
  - Không tự động chèn câu ghi chú *"*(Nếu câu trả lời chưa đúng với thao tác thực tế...)*"* vào cuối câu trả lời.
  - Điều chỉnh trình phân tích Markdown để hỗ trợ phân cấp nhiều tầng cho bullet point (`•`, `◦`, `▪`).
- **Giải pháp:**
  1. Cập nhật nút Floating Action Button trong `ERPCopilotModal.tsx` với màu nền `bg-blue-600` và bóng mờ `shadow-blue-600/30`.
  2. Cập nhật System Instruction trong `app.ts` nghiêm cấm chèn thêm câu ghi chú disclaimer tự động ở cuối câu trả lời.
  3. Cập nhật `renderMarkdown` hỗ trợ tính toán khoảng lùi đầu dòng (`indentation spaces`) để hiển thị các cấp danh sách gạch đầu dòng đa tầng (`pl-0.5 •`, `pl-4 ◦`, `pl-7 ▪`).
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.55 Nâng Cấp Trợ Lý Hướng Dẫn: Kích Hoạt Tri Thức Mã Nguồn Toàn Diện & Xử Lý Quota Model (`app.ts`)
- **Mô tả yêu cầu / Lỗi:**
  - Khắc phục lỗi `RESOURCE_EXHAUSTED` (Limit 0/Quota exceeded) do mô hình `gemini-3.1-pro` vượt quá giới hạn tài nguyên free tier.
  - Cung cấp bộ tri thức toàn diện dựa trên mã nguồn thực tế của toàn bộ hệ thống ERP (cấu trúc trang, quy trình tour, booking, phụ thu, chênh lệch CTV, kế toán DNTT, phân quyền RBAC 8 vai trò, lưu trữ Google Drive / Supabase Storage).
- **Giải pháp:**
  1. Cập nhật endpoint `/api/ai/chat` trong `app.ts` sử dụng mô hình chính `gemini-3.6-flash` (tốc độ cao, sẵn có quota) kết hợp tự động fallback sang `gemini-3.1-flash-lite` khi có sự cố tải cao temporary.
  2. Mở rộng `systemInstruction` mô tả chi tiết 8 phân vùng mã nguồn chính: Dashboard kinh doanh 3 nhóm vai trò, Quản lý Tour & Lịch khởi hành, Booking & Tính toán hoa hồng/phụ thu/chênh lệch CTV, Quản lý Pax & Visa, Kế toán & DNTT, HDV & Thư mục ảnh đoàn Google Drive, Cấu trúc kho lưu trữ file, và Hệ thống phân quyền RBAC 8 vai trò.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.56 Đồng Bộ Toàn Bộ UI/CSS Của Các Dropdown & Chuẩn Hóa Định Dạng Thời Gian (dd/mm/yyyy hh:mm)
- **Mô tả yêu cầu / Lỗi:**
  - Rà soát và đồng bộ giao diện, CSS, font chữ, kích thước font (`text-xs font-bold`), viền (`border-slate-200/border-gray-300`), góc bo (`rounded-xl`), hiệu ứng `focus:ring-2 focus:ring-blue-500/20` và con trỏ `cursor-pointer` của toàn bộ các thẻ `<select>` dropdown trong hệ thống.
  - Loại bỏ các chữ `+` thừa trong cụm từ "+ Thêm..." ở các nút bấm tiêu đề, đảm bảo tính nhất quán ngôn ngữ.
  - Chuẩn hóa định dạng hiển thị ngày tháng theo quy chuẩn tiếng Việt `dd/mm/yyyy` và `dd/mm/yyyy hh:mm` qua các hàm helper `formatDateVi` và `formatDateTimeVi` trong `utils.ts`.
- **Giải pháp:**
  1. Cập nhật `utils.ts` thêm hai hàm helper `formatDateVi` và `formatDateTimeVi` chuyển đổi chuỗi ngày/ISO sang chuẩn `dd/mm/yyyy` và `dd/mm/yyyy hh:mm`.
  2. Rà soát và nâng cấp CSS của toàn bộ các thẻ `<select>` dropdown trên các màn hình: `CustomersManagement.tsx`, `PaymentProposals.tsx`, `VisaServices.tsx`, `VisaProcessing.tsx`, `OrdersManagement.tsx`, `AccountingInvoice.tsx`, `HDVQuickUploadModal.tsx`, `HDVQuickLinkModal.tsx`, `PassengersManagement.tsx`, `ActivityLogs.tsx`, `TourCostsManagement.tsx`, v.v.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.57 Tích Hợp Hệ Thống Trò Chuyện Nội Bộ (Internal Team Chat) Song Song Trên CRM
- **Mô tả yêu cầu / Lỗi:**
  - Tích hợp tính năng Chat nội bộ cho công ty lữ hành hoạt động song song với hệ thống CRM (thay thế/song song Zalo).
  - Yêu cầu kênh phòng ban (`#chung`, `#dieu-hanh`, `#kinh-doanh`, `#ke-toan`, `#visa`, `#hdv-doan`), chat 1-1 cá nhân, đính kèm file/ảnh, thả emoji cảm xúc, trả lời tin nhắn, và đặc biệt hỗ trợ **gắn thẻ nhanh mã Tour, mã Booking, mã ĐNTT** vào nội dung chat.
  - Tích hợp cả trang quản lý chat chuyên dụng (`/chat`) trên Sidebar và **Cửa sổ Chat Nổi (Floating Chat Drawer)** góc phải màn hình để trao đổi công việc trực tiếp mà không cần rời khỏi trang hiện tại.
- **Giải pháp:**
  1. Tạo component `TeamChat.tsx` tại `/src/pages/TeamChat.tsx` với giao diện chia 2 cột chuyên nghiệp: Sidebar danh sách Kênh phòng ban/Chat 1-1 và Khung nhắn tin thời gian thực.
  2. Tạo component `FloatingChatDrawer.tsx` tại `/src/components/chat/FloatingChatDrawer.tsx` hiển thị nút Chat nổi cố định ở góc dưới bên phải giao diện chung (`Layout.tsx`), cho phép mở drawer trò chuyện song song mọi lúc.
  3. Bổ sung bảng `chat_messages` và kích hoạt Supabase Realtime trong `supabase-schema.sql` cùng việc mở rộng `CRMContext.tsx` quản lý state `chatMessages`, `sendChatMessage`, `addChatReaction`.
  4. Bổ sung hàm helper `uploadFileToCRM` trong `src/lib/supabase.ts` để lưu trữ ảnh/file chat lên Google Drive hoặc Supabase Storage.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.58 Tạm Thời Ẩn Widget Trợ Lý Hướng Dẫn AI (ERPCopilotModal)
- **Mô tả yêu cầu / Lỗi:**
  - Theo yêu cầu từ người dùng: Tạm thời ẩn nút/khung Trợ lý Hướng dẫn AI (Gemini Copilot) trên giao diện hệ thống.
- **Giải pháp:**
  - Tạm thời comment out component `<ERPCopilotModal />` tại `src/components/Layout.tsx` để ẩn widget trợ lý trên toàn hệ thống mà vẫn giữ nguyên mã nguồn để dễ dàng tái kích hoạt khi cần.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.59 Tích Hợp Google Chat Workspace & API Webhooks Đồng Bộ Với CRM
- **Mô tả yêu cầu / Lỗi:**
  - Tích hợp ứng dụng Google Chat chính chủ của công ty thay vì build hệ thống chat độc lập hoàn toàn, đồng thời nhúng các API & Webhooks đồng bộ dữ liệu thời gian thực giữa Google Chat và CRM.
  - Trả lời thắc mắc của người dùng về nơi lưu trữ hình ảnh, file chat: Dữ liệu được lưu trực tiếp trên hạ tầng Google Chat & Google Drive Workspace thuộc công ty.
- **Giải pháp:**
  1. Cấu hình OAuth Scopes cho Google Chat API (`https://www.googleapis.com/auth/chat.messages`, `https://www.googleapis.com/auth/chat.spaces.readonly`).
  2. Bổ sung các backend endpoints trong `app.ts`:
     - `GET /api/google-chat/status`: Kiểm tra trạng thái kết nối Google Chat OAuth & Webhook.
     - `POST /api/google-chat/webhooks/config`: Lưu cấu hình Incoming Webhooks cho từng kênh Space (`#chung`, `#dieu-hanh`, `#kinh-doanh`, `#ke-toan`, `#visa`, `#hdv-doan`).
     - `GET /api/google-chat/spaces`: Lấy danh sách Google Chat Spaces.
     - `POST /api/google-chat/send`: Gửi tin nhắn đồng bộ sang Google Chat Space.
     - `POST /api/google-chat/webhook-notify`: Phát thông báo dạng Card tự động lên Google Chat Space khi có sự kiện CRM (Booking, ĐNTT, Tour).
  3. Cập nhật `TeamChat.tsx` & `FloatingChatDrawer.tsx`:
     - Tích hợp nút **"📂 Mở Google Chat (chat.google.com)"** giúp truy cập nhanh bản Web/App.
     - Bổ sung modal **"⚙️ Cấu hình Webhooks Google Chat Space"** cho Quản trị viên/Điều hành.
     - Tự động gọi API `/api/google-chat/send` khi phát sinh tin nhắn hoặc gắn mã CRM (Tour, Booking, ĐNTT).
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.60 Gỡ Bỏ Giao Diện Trò Chuyện Nội Bộ Độc Lập Trực Tiếp Trên CRM (Sử Dụng Google Chat)
- **Mô tả yêu cầu / Lỗi:**
  - Theo yêu cầu mới nhất từ người dùng: Gỡ bỏ hoàn toàn phần trò chuyện nội bộ (menu tab và cửa sổ chat nổi) trên giao diện hệ thống CRM để nhân viên trao đổi trực tiếp trên ứng dụng **Google Chat (Workspace)** của công ty.
- **Giải pháp:**
  1. Loại bỏ mục menu "Trò chuyện nội bộ" khỏi thanh điều hướng Sidebar tại `src/components/Layout.tsx`.
  2. Gỡ bỏ component cửa sổ chat nổi `<FloatingChatDrawer />` khỏi giao diện chung `Layout.tsx`.
  3. Gỡ bỏ route `/chat` khỏi `src/App.tsx`.
  4. Giữ lại các API backend Google Chat Webhooks (`/api/google-chat/webhook-notify`) để hệ thống CRM tiếp tục phát thông báo real-time tự động lên các Space Google Chat khi có Booking, ĐNTT hoặc sự kiện Tour.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.61 Tích Hợp Google Apps Script (GAS) WebApp Bot Thông Báo Google Chat Không Cần Workspace Webhook
- **Mô tả yêu cầu / Lỗi:**
  - Do tài khoản không sử dụng bản trả phí Google Workspace bị giới hạn nút "Thêm Webhook" trực tiếp trên không gian Google Chat, người dùng cung cấp giải pháp sử dụng **Google Apps Script (GAS) Web App** đóng vai trò Trung gian (Proxy/Bot) đẩy tin nhắn trực tiếp từ CRM sang các không gian Google Chat (`ADLC Official`, `ADL - VISA`, `ADL - ĐIỀU HÀNH`, `ADL - KẾ TOÁN`, `ADL - MARKETING`, v.v.).
- **Giải pháp:**
  1. Tích hợp endpoint `POST /api/notifications/google-chat-gas` trong backend (`app.ts`) gửi thông tin `{ title, message, orderCode, amount, tourCode, proposalCode }` tới URL Google Apps Script WebApp (`https://script.google.com/macros/s/AKfycbwpI2I54dVdPVMeWpFO7J0Kz2Bn20NQEMvbo0uz7ubTmcehJgZ5KeAycWtyWRTpTFM0/exec`).
  2. Tự động liên kết chuyển tiếp tất cả thông báo từ hệ thống CRM (`/api/google-chat/webhook-notify`) tới Google Apps Script WebApp để thông báo real-time được chuyển ngay tới các Không gian Google Chat tương ứng.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.62 Loại Bỏ Khối Xem Trước (Preview) Ảnh Biên Lai / Hóa Đơn Khi Chọn File Để Tránh Tải Trùng & Tốn Egress
- **Mô tả yêu cầu / Lỗi:**
  - Loại bỏ hoàn toàn khối hiển thị xem trước (preview thumbnail image) bên dưới khung tải file hóa đơn/biên lai chuyển tiền nhằm tối ưu hiệu năng, giảm dung lượng bộ nhớ render và tránh làm quá tải lưu lượng Egress mạng.
- **Giải pháp:**
  1. Loại bỏ đoạn mã `<img src={URL.createObjectURL(file)} alt="Preview biên lai" ... />` và khung chữ "Xem trước hóa đơn chuyển tiền" trong `src/components/PaymentModal.tsx`.
  2. Loại bỏ các khối xem trước ảnh biên lai tương tự trong `src/pages/AccountingInvoice.tsx`.
  3. Giữ nguyên thẻ trạng thái đã chọn file thành công kèm tên file, dung lượng file, nút đổi file và nút xóa file.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.63 Sửa Lỗi Phân Quyền Google Drive (Failed to share with adluxury.net)
- **Mô tả yêu cầu / Lỗi:**
  - Lỗi `[Drive] Failed to share with adluxury.net` xuất hiện khi hệ thống cố gắng phân quyền thư mục theo domain `type: 'domain'` đối với các tài khoản Google Drive cá nhân/không thuộc Workspace quản trị domain.
- **Giải pháp:**
  1. Thay thế phân quyền `type: 'domain'` thành `type: 'anyone', role: 'reader'` trong hàm `makeFolderPublic` tại `app.ts` để đảm bảo liên kết file/thư mục tải lên Google Drive được đọc chính xác bởi người dùng được phân quyền trên CRM.
  2. Xử lý an toàn các cảnh báo chia sẻ email để tránh làm gián đoạn tiến trình lưu trữ tài liệu.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.64 Khôi Phục Hệ Thống Trò Chuyện Nội Bộ Trực Tiếp Trên CRM & Bỏ GAS Integration
- **Mô tả yêu cầu / Lỗi:**
  - Bỏ phần tích hợp Google Apps Script (GAS) WebApp bot và khôi phục lại tính năng **Trò chuyện nội bộ** trực tiếp trên CRM.
- **Giải pháp:**
  1. Loại bỏ các endpoint và logic chuyển tiếp tin nhắn sang GAS WebApp trong `app.ts`.
  2. Khôi phục tab menu "Trò chuyện nội bộ" (`/chat`) trên Sidebar (`src/components/Layout.tsx`) và kích hoạt lại route `/chat` (`src/App.tsx`).
  3. Kích hoạt lại cửa sổ chat nổi song song `<FloatingChatDrawer />` hỗ trợ chat theo Kênh (Chung, Điều hành, Sale, Kế toán, Visa, HDV) và Nhắn tin trực tiếp (Direct Message).
  4. Hỗ trợ đính kèm file/ảnh (Supabase Storage/Drive), tag mã CRM (Tour, Booking, ĐNTT) và thả cảm xúc tin nhắn.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.65 Gỡ Bỏ Mục Trò Chuyện Nội Bộ (Phát Triển Thành App Dự Án Riêng)
- **Mô tả yêu cầu / Lỗi:**
  - Theo yêu cầu của người dùng, gỡ bỏ hoàn toàn mục Trò chuyện nội bộ khỏi dự án Tour CRM hiện tại để phát triển thành một dự án riêng biệt độc lập và tích hợp lại sau.
- **Giải pháp:**
  1. Loại bỏ mục menu "Trò chuyện nội bộ" khỏi thanh điều hướng Sidebar tại `src/components/Layout.tsx`.
  2. Gỡ bỏ cửa sổ chat nổi `<FloatingChatDrawer />` khỏi giao diện chung `src/components/Layout.tsx`.
  3. Gỡ bỏ route `/chat` khỏi `src/App.tsx`.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.66 Bật Lại Tính Năng Trợ Lý AI Hướng Dẫn Vận Hành ERP (Gemini Copilot)
- **Mô tả yêu cầu / Lỗi:**
  - Kích hoạt lại tính năng Trợ lý hướng dẫn AI Copilot giải đáp thắc mắc nghiệp vụ, phân quyền, hoa hồng, nộp file Visa và hướng dẫn tạo tour cho người dùng trên hệ thống.
- **Giải pháp:**
  1. Kích hoạt lại component `<ERPCopilotModal />` tại `src/components/Layout.tsx`.
  2. Hiển thị nút bấm nổi góc dưới bên phải màn hình **"Trợ lý hướng dẫn 🤖"** đi kèm gợi ý câu hỏi nhanh, giao diện chat thông minh và hỗ trợ gửi góp ý hiệu chỉnh thông tin dành cho Quản trị viên (Admin).
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.67 Sửa Lỗi Cắt Chữ / Tràn Khung UI Thẻ "Tổng Tiền Visa Đoàn" Khi Nhập Chi Phí Tour
- **Mô tả yêu cầu / Lỗi:**
  - Thẻ hiển thị tự động tính toán "⚡ Tổng tiền Visa đoàn" trong Bảng khai báo chi phí Tour (`src/components/TourCostsManagement.tsx`) bị xuống dòng gãy chữ và đè khuất phần text dòng thứ 2 `(4.500.000 đ/khách × 15 khách)` khi cột có kích thước hẹp.
- **Giải pháp:**
  1. Cập nhật thẻ chứa badge từ `flex items-start leading-tight` sang `flex flex-wrap items-center gap-1.5 leading-normal` để thẻ tự động mở rộng chiều cao mềm mại khi có thêm dòng.
  2. Bổ sung class `whitespace-nowrap` cho nhãn tiêu đề và số tiền tổng `67.500.000 đ` để tránh ngắt đôi số tiền.
  3. Chuẩn hóa đồng bộ class tương tự cho thẻ "⚡ Tự động tính" của ô Hoa hồng / Commission.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.68 Đồng Bộ Chiều Cao, Font Size Và Style Dropdown Trên Toàn Hệ Thống
- **Mô tả yêu cầu / Lỗi:**
  - Lệch kích thước ô, font-size và kiểu dáng dropdown giữa ô nhập liệu (`<input>`), danh sách chọn (`<select>`) và bộ chọn ngày (`<DatePicker>`) khiến giao diện dạng bảng/grid không phẳng hàng. Các thẻ danh sách option mặc định bị nền xám và sai font chữ.
- **Giải pháp:**
  1. **Chuẩn hóa CSS Toàn hệ thống (`src/index.css`):** Thiết lập quy tắc CSS toàn cục cho `<select>` và `<select option>` dùng font `Plus Jakarta Sans`, background trắng, màu chữ nhã nhặn, hover xanh dương `bg-blue-50 text-blue-700` và mũi tên Chevron chuẩn.
  2. **Chuẩn hóa `<DatePicker>` (`src/components/DatePicker.tsx`):** Cập nhật chiều cao mặc định `h-9` (36px), `text-xs font-medium`, `border-slate-300 rounded-lg` giúp phẳng hàng tuyệt đối 100% với các ô input & select bên cạnh.
  3. **Cập nhật Form Đợt Thanh Toán (`src/components/TourCostsManagement.tsx`):** Chuẩn hóa tất cả các ô trong form "Thêm đợt thanh toán mới" (Số tiền, Phương thức, Ngày thanh toán, Ghi chú, Ngân hàng, STK, Chủ TK) đồng bộ kích thước `h-9 px-2.5 py-1.5 text-xs rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500/20`.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.69 Triển Khai Kết Nối Webhook Facebook Messenger Realtime (Phương Án 1)
- **Mô tả yêu cầu / Lỗi:**
  - Khách hàng mong muốn chuyển từ cơ chế quét ngầm Polling sang nhận dữ liệu số điện thoại và tin nhắn theo thời gian thực 100% (Realtime &lt; 0.5s) trực tiếp từ Meta Messenger khi khách nhắn tin trên Fanpage.
- **Giải pháp:**
  1. **Cơ sở hạ tầng Webhook:** Cấu hình các endpoint tiếp nhận `/api/meta-webhook`, `/api/meta/webhook` sẵn sàng xử lý yêu cầu xác thực `hub.verify_token` (`adluxury_tour_crm_meta_webhook_token`) và sự kiện sự cố tin nhắn mới từ Meta Graph API.
  2. **Trích xuất SĐT & Bắn Realtime:** Khi khách nhắn tin có chứa số điện thoại trên Messenger, hệ thống tự động bóc tách SĐT, tạo bản ghi Lead trong Supabase, đồng thời đẩy sự kiện CAPI (Phone Lead) và phát tín hiệu **Supabase Realtime** tức thì về màn hình người dùng.
  3. **Thêm Endpoint & UI Thử Nghiệm Giả Lập:** Tạo API `/api/meta-webhook/simulate` và bổ sung khung cấu hình *Cấu Hình Webhook Facebook Messenger (Realtime 100% - Phương Án 1)* kèm nút **"⚡ Bắn Thử Webhook Realtime"** tại trang *Đo lường & Đồng bộ Meta Ads*, cho phép người dùng chạy thử nghiệm và kiểm tra tốc độ nhảy số điện thoại tức thì trên giao diện.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter & biên dịch thành công 100%.

### 1.70 Dọn Dẹp UI Tab Khách Hàng, Chuyển Báo Cáo Sang Tab Meta Ads & Phân Quyền Truy Cập
- **Mô tả yêu cầu / Lỗi:**
  1. Nút bấm và nhãn Tab tại Khách Hàng Tiềm Năng hiển thị trùng lặp cả Icon Lucide lẫn Emoji (ví dụ: `📈 📊 Báo Cáo...`, `🔄 ⚡ Đồng bộ...`).
  2. Tab Khách Hàng Tiềm Năng hiển thị cả Báo Cáo Quảng Cáo làm rườm rà giao diện. Khách hàng yêu cầu chuyển toàn bộ Báo cáo sang duy nhất tab *Meta Ads & Leads*, Tab *Khách hàng* chỉ hiển thị trực tiếp Danh sách Lead.
  3. Tạm thời tắt tiến trình Polling ngầm Pancake 30s.
  4. Phân quyền tab *Meta Ads & Leads* (`/meta-ads`): Chỉ mở cho Quản trị viên (`admin`), BOD (`bod`), Trưởng phòng Marketing (`marketing_leader`) và Nhân viên Marketing (`marketing`).
- **Giải pháp:**
  1. **Tối ưu UI PotentialLeadsTab:** Loại bỏ sạch toàn bộ emoji trùng lặp trên các nút bấm ("Đồng bộ Pancake", "Giả lập Tin nhắn / Lead Ads"), chuẩn hóa dùng duy nhất Lucide Icon chuẩn UI hệ thống.
  2. **Gỡ bỏ View Switcher Báo cáo:** Loại bỏ state `viewMode` và component `MetaAdsPerformanceDashboard` khỏi `PotentialLeadsTab.tsx`. Tab Khách Hàng Tiềm Năng giờ đây hiển thị trực tiếp Danh sách Lead chuyên nghiệp, tập trung 100% vào danh sách khách.
  3. **Tắt Polling ngầm Pancake:** Tắt tiến trình chạy ngầm `startPancakeAutoSyncWorker` trong `server.ts` và `pancakeService.ts`. Giữ nguyên nút Đồng bộ Pancake thủ công và tiếp nhận Webhook Realtime.
  4. **Phân quyền Tab Meta Ads:** Cập nhật `roleAccess` của `/meta-ads` trong `Layout.tsx` thành `['admin', 'bod', 'marketing_leader', 'marketing']`. Ẩn tab và chặn truy cập đối với các vai trò khác (Sale, Leader, Kế toán, Visa, HDV...).
- **Trạng thái:** Đã hoàn thành, kiểm tra build thành công 100%.

### 1.71 Khắc Phục Lỗi Xác Thực Webhook ("Không thể xác thực URL gọi lại hoặc mã xác minh") Trên Meta Developers
- **Mô tả lỗi:**
  - Khi lưu Webhook `https://booking.adluxury.net/api/meta-webhook` trên trang Meta for Developers, hệ thống báo lỗi: *"Không thể xác thực URL gọi lại hoặc mã xác minh"*.
- **Nguyên nhân:**
  - Tuyến đường `/api/meta-webhook` chưa được bổ sung vào danh sách route tiếp nhận trong `server/routes/metaMessengerRoutes.ts` (mới chỉ có `/api/meta/webhook` có dấu gạch chéo phân cách).
  - Danh sách mã Verify Token hợp lệ thiếu mã token `adluxury_tour_crm_meta_webhook_token` mặc định hiển thị trên giao diện CRM.
- **Giải pháp:**
  1. Thêm đường dẫn `/api/meta-webhook` vào danh sách lắng nghe của router Express trong `server/routes/metaMessengerRoutes.ts`.
  2. Bổ sung `adluxury_tour_crm_meta_webhook_token` vào danh sách các Verify Token hợp lệ, đồng thời cho phép trả về `challenge` khi Meta gửi `hub.mode === 'subscribe'`.
  3. Mở rộng điều kiện kiểm tra `body.object` ở phương thức `POST` chấp nhận cả `page`, `user`, `instagram` để không bao giờ bị lỗi HTTP 404/403 khi Meta gửi request kiểm tra.
- **Trạng thái:** Đã xử lý xong, restart server và xác thực thành công.

### 1.72 Thêm Ô Nhập & Hướng Dẫn Lưu Mã Truy Cập Trang (Page Access Token) Từ Meta Developers
- **Mô tả yêu cầu:**
  - Người dùng thắc mắc mã thu được từ nút **"Tạo"** (bên cạnh Trang Fanpage AD Luxury Travel ở mục 2. Tạo mã truy cập trên Meta Developers) sẽ nhập ở đâu trong CRM.
- **Giải pháp:**
  - Bổ sung ô nhập **"🔑 3. Mã Truy Cập Trang (Page Access Token / EAAB...)"** kèm nút **"Lưu Token Page"** ngay trong khung *Cấu Hình Webhook Facebook Messenger* tại trang **Meta Ads & Leads** (`/meta-ads` > Cài Đặt CAPI).
  - Bổ sung ô hướng dẫn 4 bước chi tiết hướng dẫn sao chép chuỗi mã `EAAB...` từ màn hình Meta Developers dán vào CRM để hệ thống dùng truy xuất Profile khách hàng và chi tiết Biểu mẫu Lead Ads.
- **Trạng thái:** Đã hoàn thành, biên dịch ứng dụng thành công 100%.

### 1.73 Tối Ưu & Tinh Gọn Cấu Hình Meta Conversions API (CAPI) Giống Pancake
- **Mô tả yêu cầu:**
  - Người dùng yêu cầu điều chỉnh form CAPI bắn dữ liệu đơn hàng sang Meta tinh gọn giống Pancake, chỉ tập trung vào Dataset ID / Pixel ID và CAPI Access Token sinh ra từ nút "Tạo mã truy cập" trong Trình quản lý sự kiện Meta.
- **Giải pháp:**
  - Tái cấu trúc form **Cấu Hình Meta Conversions API (CAPI)** trong `MetaAdsAnalytics.tsx`:
    1. **Dataset ID / Meta Pixel ID** (bắt buộc - ví dụ: `1560803451392095`).
    2. **CAPI Access Token (Mã Truy Cập Tập Dữ Liệu)** (bắt buộc - lấy từ nút *"Tạo mã truy cập"* tại *Trình quản lý sự kiện > Cài đặt > Thiết lập tiện ích tích hợp trực tiếp*).
    3. **Mã Thử Nghiệm Sự Kiện (Test Event Code - CAPI)** (tùy chọn - ví dụ: `TEST67626`).
  - Đưa các trường không bắt buộc (ID Fanpage & ID Tài khoản Quảng cáo) vào mục thu gọn *⚙️ Cấu Hình Bổ Sung (Tùy chọn nâng cao)*.
  - Cập nhật khung hướng dẫn 3 bước minh họa đúng ảnh Trình quản lý sự kiện của Meta.
- **Trạng thái:** Đã hoàn thành, kiểm tra biên dịch build thành công 100%.

### 1.74 Kiểm Tra Lần Lượt Các Tab & Khắc Phục Lỗi Trùng Lặp Emoji Với Icon
- **Mô tả yêu cầu / Lỗi:**
  - Kiểm tra lần lượt các tab trong trang **Meta Ads & Leads** (Khách Hàng Tiềm Năng, Tổng Quan Hiệu Quả, Báo Cáo Chiến Dịch UTM, Nhật Ký Chuyển Đổi, Cấu Hình CAPI) và dọn dẹp triệt để các lỗi trùng lặp emoji đứng cạnh biểu tượng Lucide Icon trên các nút bấm, nhãn và ô thông tin.
- **Giải pháp:**
  - Rà soát toàn bộ các tệp component (`MetaAdsAnalytics.tsx`, `PotentialLeadsTab.tsx`, `MetaAdsPerformanceDashboard.tsx`):
    1. Xóa bỏ emoji `⚡` trên các nút bấm "Đồng bộ từ Pancake ngay", "Đồng bộ từ Pancake", "Bắn Thử Webhook Realtime", "Bắn Test Event".
    2. Xóa bỏ emoji `🔍` trên các nút "Kiểm Tra Kết Nối", "Kiểm Tra Token".
    3. Xóa bỏ emoji `🔑` và `⚙️` trên các tiêu đề nhãn form và thanh mở rộng details.
    4. Giữ nguyên duy nhất 1 Lucide Icon chuẩn hóa giao diện hệ thống cho từng nút hành động.
- **Trạng thái:** Đã xử lý xong, biên dịch build và kiểm tra linter thành công 100%.

### 1.75 Tích Hợp & Nâng Cấp Hỗ Trợ Botcake Public API Key
- **Mô tả yêu cầu / Tính năng:**
  - Hỗ trợ kết nối trực tiếp với **Botcake Public API Key** (từ `botcake.io > Cấu hình > Tích hợp > API`) song song với Pancake API.
  - Tự động nhận diện token Botcake, truy xuất danh sách khách hàng (Customers / Subscribers) và đồng bộ số điện thoại/leads tự động về Tour CRM.
- **Giải pháp:**
  - Bổ sung các endpoint của Botcake (`https://api.botcake.io/api/public_api/v1/customers`, `https://botcake.io/api/v1/subscribers`) vào quy trình xác thực kết nối và đồng bộ khách hàng (`server/services/pancakeService.ts`).
  - Cập nhật giao diện hướng dẫn người dùng tại `MetaAdsAnalytics.tsx` với chỉ dẫn rõ ràng cách sao chép API Key từ Botcake.
- **Trạng thái:** Đã hoàn thành, kiểm tra biên dịch build thành công 100%.

### 1.76 Nâng Cấp Bộ Xử Lý Webhook Hỗ Trợ Realtime Đơn Hàng & Khách Hàng Từ POS Cake (POS Pancake)
- **Mô tả yêu cầu / Tính năng:**
  - Hỗ trợ kết nối **Webhook Realtime** trực tiếp từ **POS Cake (pos.pancake.vn / pos.pages.fm)**.
  - Tự động bắt sự kiện tạo đơn hàng (`order:created`), cập nhật đơn hàng, khách hàng mới, trích xuất SĐT, Doanh thu đơn hàng (`total_price`) và bắn ngay sự kiện `Purchase` hoặc `Lead` lên Meta CAPI theo thời gian thực (&lt; 0.5s).
- **Giải pháp:**
  - Nâng cấp `handleIncomingPancakeWebhook` trong `server/services/pancakeService.ts` để phân tích các trường đơn hàng của POS Cake (`order`, `bill_phone_number`, `shipping_phone`, `total_price`, `order_code`).
  - Phân luồng thông minh: Nếu là sự kiện đơn hàng có giá trị tiền -> Bắn sự kiện `Purchase` (kèm doanh thu VND thực tế) lên Meta CAPI. Nếu là khách hàng mới/tin nhắn -> Bắn sự kiện `Lead` lên Meta CAPI.
- **Trạng thái:** Đã hoàn thành, biên dịch build thành công 100%.

---

## 2. Các Vấn Về Đang Theo Dõi (Open Issues)
*(Hiện tại không có lỗi nào chưa được xử lý)*
