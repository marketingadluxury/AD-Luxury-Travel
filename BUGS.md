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

---

## 2. Các Vấn Về Đang Theo Dõi (Open Issues)
*(Hiện tại không có lỗi nào chưa được xử lý)*
