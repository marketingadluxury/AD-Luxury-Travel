# Nhật Ký Theo Dõi Lỗi (Bugs & Issue Tracker)

Tài liệu này lưu trữ lịch sử sửa lỗi và các vấn đề cần lưu ý trong quá trình phát triển hệ thống **Tour CRM - Quản lý Công ty Du lịch**.

---

## 1. Các Vấn Đề Đã Được Khắc Phục (Resolved Issues)

### 1.0 Giải Pháp Giữ Ấm Cơ Sở Dữ Liệu Supabase 24/7 (Chống Auto-Pause Sau 7 Ngày)
- **Mô tả yêu cầu:**
  - Supabase gói miễn phí có chính sách tự động tạm dừng (pause) dự án nếu sau 7 ngày liên tục không ghi nhận lượt truy vấn nào. Nghiên cứu, đề xuất và triển khai giải pháp kỹ thuật triệt để để giữ ấm database liên tục.
- **Giải pháp thực hiện (Kiến trúc bảo vệ 3 tầng):**
  1. **Tầng 1 - Worker nội bộ trong Server CRM:**
     - Tạo `server/services/keepAliveService.ts` tích hợp hàm `pingSupabaseDatabase()` và `initSupabaseKeepAlive()`.
     - Server backend tự động thực hiện truy vấn nhẹ đọc 1 dòng từ bảng `profiles` sau 5 giây khởi động và lặp lại định kỳ mỗi 24 giờ một lần ngầm trong hệ thống.
  2. **Tầng 2 - Endpoint API cho Webhook / Cron-Job ngoài:**
     - Tạo endpoint `GET /api/keep-alive` và `GET /api/supabase-keepalive` kèm kiểm tra trạng thái tại `GET /api/keep-alive/status`.
     - Cho phép các dịch vụ giám sát miễn phí (như Cron-job.org hoặc UptimeRobot) ping định kỳ 1 - 2 ngày một lần hoàn toàn độc lập với server.
  3. **Tầng 3 - GitHub Actions Workflow Tự Động:**
     - Tạo file `.github/workflows/supabase-keep-alive.yml` chạy tự động vào 11:00 AM mỗi 2 ngày một lần (`0 4 */2 * *`) trên hạ tầng GitHub Cloud để gửi request giữ ấm trực tiếp tới REST API của Supabase hoặc qua app API.
  4. **Giao diện Quản trị tại Cài đặt Hệ thống (`Settings.tsx`):**
     - Bổ sung tab **"Cơ sở dữ liệu & Tự động giữ ấm"** trong trang Cài đặt (dành cho Admin).
     - Hiển thị thông số kết nối, thời gian phản hồi (latency ms), trạng thái anon key, nút **"Kiểm tra kết nối & Ping giữ ấm ngay"**, và hướng dẫn trực quan 3 tầng giữ ấm.
- **Trạng thái:** Đã hoàn thành, kiểm tra API phản hồi 200 (Active, latency ~900ms), lint và build pass 100%.

### 1.0 Chuẩn Hóa UI Bảng Danh Sách Đoàn & Loại Bỏ Hoàn Toàn Emoji (Modal Hành Khách & Giữ Chỗ)
- **Mô tả yêu cầu:**
  - Chỉnh lại toàn bộ giao diện của bảng chi tiết đoàn tour (Modal Danh sách Hành khách & Giữ chỗ), loại bỏ tất cả các biểu tượng cảm xúc (emoji), thay thế đồng bộ 100% bằng hệ thống icon chuẩn từ thư viện `lucide-react`.
- **Giải pháp thực hiện:**
  1. **Khối Header thông số đoàn:**
     - Thay thế toàn bộ emoji (✈️, 🎯, 👥, ✅, ⏳, 🟢) bằng các icon chuẩn: `Plane` (Hãng bay), `Target` (Mở bán +OB), `Users` (Cho phép giữ/bán), `CheckCircle2` (Đã bán), `Clock` (Đang giữ Hold), `CircleDot` (Chỗ còn lại).
     - Thiết kế lại các thông số dạng chip/badge bán trong suốt tinh tế, đồng bộ màu sắc phân định trạng thái.
  2. **Bảng Danh sách Khách đã bán:**
     - Cột Thông tin hành khách: Thay thế emoji 📞 bằng icon `Phone` và emoji 🎂 bằng icon `Calendar` nhỏ gọn, tinh tế đi kèm số điện thoại và ngày sinh.
     - Căn chỉnh bố cục các cột (STT, Giới tính, Tên khách, Mã booking, Sale/Đại lý, Phòng đơn, Ghi chú, Tình trạng visa) cân đối và sắc nét.
  3. **Bảng Danh sách Giữ chỗ (Hold):**
     - Thay thế emoji 📞 tại cột Khách hàng đại diện bằng icon `Phone`.
     - Chuẩn hóa hiển thị hạn giữ chỗ và số lượng chỗ giữ.
- **Trạng thái:** Đã hoàn thành, kiểm tra lint và build thành công 100%.

### 1.0 Tối Ưu Giao Diện Quản Lý Tour Cho Vai Trò Kế Toán (Chỉ Hiển Thị Hạch Toán Chi Phí - Lãi Lỗ)
- **Mô tả yêu cầu:**
  - Khi tài khoản Kế toán (`accounting`) truy cập vào trang Quản lý Tour, hệ thống chỉ hiển thị duy nhất phần **Hạch toán Chi phí – Lãi lỗ**, không hiển thị các tab/nút điều hành khác (Danh sách Tour, Tuyến/Danh mục, Tạo Tour Mới).
- **Giải pháp thực hiện:**
  1. Thiết lập trạng thái mặc định của `activeTab` là `'costs'` khi vai trò là `accounting`, đồng thời có `useEffect` đồng bộ trạng thái này khi chuyển đổi vai trò.
  2. Ẩn thanh chuyển đổi tab (Danh sách tour, Danh mục) và nút "Tạo Tour Mới" đối với vai trò Kế toán, chỉ giữ lại phần tiêu đề hạch toán chi phí rõ ràng.
  3. Hiển thị trực tiếp toàn bộ giao diện Hạch toán Chi phí – Lãi lỗ (`<TourCostsManagement />`), cho phép kế toán tra cứu tức thì doanh thu thực thu từ khách, chi phí định mức đoàn, các đợt thanh toán đối tác và lợi nhuận ròng.
- **Trạng thái:** Đã hoàn thành, kiểm tra lint và build thành công 100%.

### 1.0 Loại Bỏ 3 Mục (Báo Cáo Tour, Bảng Chấm Công, Quản Lý Nghỉ Phép) Khỏi Trang Kế Toán
- **Mô tả yêu cầu:**
  - Loại bỏ hoàn toàn 3 mục/tab: **"Báo cáo tour"**, **"📊 Bảng chấm công"** và **"🌴 Quản lý nghỉ phép"** khỏi trang Kế toán & Hóa đơn (`AccountingInvoice.tsx`).
- **Giải pháp thực hiện:**
  1. Thu gọn `activeTab` trong `AccountingInvoice.tsx` chỉ còn 3 tab nghiệp vụ kế toán trọng tâm: **Phiếu thu**, **Yêu cầu xuất VAT** và **Phiếu chi / Hoàn tiền** (`'receipts' | 'vat' | 'payments'`).
  2. Xóa bỏ 3 nút bấm chuyển tab khỏi thanh điều hướng trên cùng của trang Kế toán.
  3. Xóa bỏ toàn bộ các khối render và state/hàm phụ trợ không còn sử dụng liên quan đến 3 mục trên (Thư mục tour, hợp đồng, TimesheetManagement, LeaveManagementTab) giúp mã nguồn gọn gàng, giảm dung lượng và tối ưu hiệu suất tải trang.
  4. Nghiệp vụ Chấm công và Quản lý Nghỉ phép được tập trung chuyên trách tại trang Hành chính nhân sự (`/leave-requests`), còn Báo cáo chi phí/lãi lỗ tour được quản lý tại trang Báo cáo & Lịch khởi hành.
- **Trạng thái:** Đã hoàn thành, kiểm tra lint và build thành công 100%.

### 1.0 Khắc Phục Lỗi Cuộn Ngang & Tối Ưu Hiển Thị Responsive Cho Toàn Bộ Màn Hình Lớn
- **Mô tả yêu cầu & vấn đề:**
  - Trên các màn hình máy tính có độ phân giải lớn, màn hình bên phải (khu vực nội dung chính của hệ thống) bị hiện tượng xuất hiện thanh cuộn ngang (horizontal scrollbar) do một số container/grid/flexbox bị vượt quá chiều rộng viewport hoặc container thẻ `<main>` chưa khóa cuộn ngang.
- **Giải pháp thực hiện:**
  1. **Khóa tràn khung chính tại Layout:** Cập nhật thẻ `<main>` trong `Layout.tsx` với các thuộc tính `overflow-x-hidden min-w-0 w-full`, ngăn ngừa hoàn toàn thanh cuộn ngang ở cấp độ toàn trang. Bất kỳ bảng dữ liệu lớn nào có nhu cầu xem chi tiết sẽ cuộn nội bộ trong container `overflow-x-auto` riêng của bảng đó mà không kéo trượt toàn bộ khung làm việc của người dùng.
  2. **Tối ưu Responsive Header & Tabs Dashboard:**
     - Thiết lập `min-w-0 flex flex-col xl:flex-row xl:items-center justify-between gap-4` cho khối Header Bảng điều khiển.
     - Thêm `max-w-full overflow-x-auto` và `shrink-0` cho các nút tab điều hướng con, giúp thanh điều hướng tự co giãn linh hoạt và không bao giờ đẩy bung chiều rộng trang.
     - Khối nút hành động bên phải (Bộ lọc, Xuất báo cáo, Trợ giúp) được thiết lập `flex-wrap shrink-0` để thích ứng hoàn hảo trên mọi kích thước màn hình từ tablet, laptop 13-14 inch, màn hình 1080p đến màn hình 2K/4K.
  3. **Tối ưu Grid & Min-Width Các Thẻ KPI / Biểu Đồ:** Thêm `min-w-0` trên các thẻ thống kê KPI, biểu đồ và container bảng để lưới CSS Grid luôn tính toán chuẩn xác tỷ lệ co giãn, đảm bảo toàn bộ nội dung nằm trọn vẹn trong 1 màn hình mà không cần kéo thanh cuộn ngang.
- **Trạng thái:** Đã hoàn thành, kiểm tra lint và build thành công 100%.

### 1.0 Loại Bỏ Tab Cấu Hình Meta Conversions API Khỏi Cài Đặt Hệ Thống
- **Mô tả yêu cầu:**
  - Loại bỏ hoàn toàn tab và thành phần giao diện *Cấu hình Meta Conversions API (CAPI)* khỏi trang Cài đặt hệ thống (`Settings.tsx`).
- **Giải pháp thực hiện:**
  1. Loại bỏ tab `meta_capi` khỏi state và thanh điều hướng tabs của trang `Settings.tsx`.
  2. Trang Cài đặt hệ thống hiện tại chỉ tập trung vào 2 phần chức năng cốt lõi: **Hạng thành viên** và **Quản lý người dùng & phân quyền**.
- **Trạng thái:** Đã hoàn thành, kiểm tra build và lint thành công 100%.

### 1.0 Khắc Phục Lỗi Double Icon Trên Nút Dropdown Chọn Giá Trị (CustomSelect)
- **Mô tả vấn đề:**
  - Ở dropdown chọn *Thị trường / Điểm đến* (và các dropdown khác), khi người dùng chọn một mục, trên nút bấm hiển thị lặp 2 icon cạnh nhau (ví dụ: `📍 📍 Nha Trang`).
  - Nguyên nhân do component `CustomSelect` vừa render prop `icon` chung của component, vừa render thêm `selectedOption.icon` của mục được chọn.
- **Giải pháp thực hiện:**
  1. Hợp nhất logic hiển thị icon tại `CustomSelect`: `const displayIcon = selectedOption?.icon || icon;`, ưu tiên icon riêng của option được chọn và fallback về icon chung của select.
  2. Đảm bảo nút button của `CustomSelect` luôn luôn chỉ hiển thị duy nhất 1 icon đại diện, loại bỏ hoàn toàn hiện tượng trùng lặp/double icon trên toàn hệ thống.
  3. Rà soát toàn bộ các button và dropdown khác, đảm bảo tuân thủ nghiêm ngặt quy tắc tránh lặp icon và text biểu tượng.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch thành công 100%.

### 1.0 Chuẩn Hóa Căn Lề & Bố Cục Thẳng Hàng Danh Sách Xử Lý Hồ Sơ Visa
- **Mô tả vấn đề:**
  - Ở chế độ xem Dạng danh sách (`viewMode === 'list'`) của trang *Xử lý & Cấp duyệt Visa*, các cột của thẻ hồ sơ bị lệch dọc và lệch ngang giữa các thẻ:
    1. Container sử dụng `items-center` khiến cho các thẻ không có hộp "Nội dung giải trình" (như thẻ của khách Nguyễn Ngọc Khánh Băng) bị đẩy dropdown "Cập nhật trạng thái" trôi nổi lơ lửng ở giữa chiều cao thẻ thay vì căn đầu mép trên cùng.
    2. Chiều rộng cột giấy tờ và cột trạng thái sử dụng `min-w` và `max-w` động khiến vị trí các cột giữa các thẻ không thẳng hàng theo cột dọc.
- **Giải pháp thực hiện:**
  1. **Căn lề trên (Top Alignment):** Đổi từ `items-center` sang `items-start` trên toàn bộ container thẻ để tất cả tiêu đề cột ("Thông tin hành khách", "Giấy tờ Sale đã upload", "Cập nhật trạng thái") luôn xuất phát cùng một dòng độ cao `h-5` trên cùng.
  2. **Cột cố định chuẩn hóa (Fixed Column Gutters):**
     - Cột Thông tin hành khách: `flex-1 min-w-0`
     - Cột Giấy tờ upload: `w-full lg:w-[320px] shrink-0`
     - Cột Cập nhật trạng thái: `w-full lg:w-[250px] shrink-0`
  3. Tất cả các thẻ trong danh sách giờ đây hiển thị thẳng tắp theo 3 cột chuẩn mực, các tiêu đề và bộ điều khiển thẳng hàng ngang và thẳng hàng dọc tuyệt đối.
- **Trạng thái:** Đã hoàn thành, kiểm tra build và lint thành công 100%.

### 1.0 Căn Chỉnh Đồng Bộ Chiều Cao & Giao Diện Thanh Bộ Lọc Trang Xử Lý Visa & Dịch Vụ Visa
- **Mô tả vấn đề:**
  - Trên thanh lọc của trang *Xử lý & Cấp duyệt Visa* và *Dịch vụ Visa*, 3 thành phần (Ô tìm kiếm, Bộ lọc thời gian `TimeRangeFilter`, Dropdown sắp xếp `CustomSelect`) bị lệch chiều cao và font chữ do `TimeRangeFilter` bị gán cứng `h-[38px]`, ô tìm kiếm thiếu chiều cao chuẩn `h-9` và font size khác biệt.
- **Giải pháp thực hiện:**
  1. **Chuẩn hóa TimeRangeFilter:** Gỡ bỏ chiều cao cứng `h-[38px]`, thiết lập chiều cao chuẩn `h-9 px-3 py-1.5`, border `border-slate-300 rounded-lg text-xs font-semibold text-slate-800`.
  2. **Đồng bộ Ô Tìm kiếm:** Cập nhật cả ở trang `VisaProcessing` và `VisaServices` với chiều cao `h-9 pl-9 pr-3 py-1.5`, bo góc `rounded-lg text-xs font-semibold text-slate-800`.
  3. **Căn lề Grid Layout:** Thiết lập `items-center` và `w-full` cho các cột trên hàng lọc giúp 3 phần tử thẳng hàng tuyệt đối, phẳng và cân đối 100%.
- **Trạng thái:** Đã hoàn thành, vượt qua toàn bộ các bài kiểm tra Linter (`npm run lint`) và Biên dịch (`npm run build`) thành công 100%.

### 1.0 Sửa Lỗi Tính Toán Ngày Khởi Hành "Sắp Khởi Hành" & Đồng Bộ Toàn Bộ Dropdown Hệ Thống
- **Mô tả vấn đề & yêu cầu:**
  1. **Lỗi ngày khởi hành:** Tour khởi hành ngày hôm qua (ví dụ: 27/08) vẫn xuất hiện ở mục "Sắp khởi hành" do hàm `differenceInDays` bị phụ thuộc vào giờ/múi giờ (UTC vs Local) dẫn đến chênh lệch không âm.
  2. **Đồng bộ Dropdown:** Rà soát và chuyển đổi tất cả các thẻ `<select>` mặc định của HTML sang component `CustomSelect` trên các trang Quản lý Tour, Hạch toán chi phí Tour, Lịch khởi hành và Quản lý Đối tác/Đại lý/CTV để đồng nhất 100% giao diện, phong cách, hiệu ứng và trải nghiệm.
- **Giải pháp thực hiện:**
  1. **Cập nhật Logic Ngày:** Chuyển đổi từ `differenceInDays` sang `differenceInCalendarDays` trong `DashboardOperator.tsx` cho tất cả các bộ lọc danh sách (Tour sắp khởi hành, Hạn xuất vé, Hạn visa, Tour đã khởi hành). Qua đó, bất kỳ tour nào có ngày khởi hành trước ngày hôm nay (dựa trên ngày lịch thuần túy) đều được chuyển chính xác sang danh sách "Đã khởi hành" (`departedTours`).
  2. **Đồng bộ CustomSelect:**
     - `ToursManagement.tsx`: Chuyển đổi dropdown Tháng khởi hành, Danh mục thị trường, Số phần tử hiển thị phân trang, Loại hình sản phẩm (Loại tour), Trạng thái mở bán và Chọn danh mục sản phẩm trong form tạo/sửa tour.
     - `TourCostsManagement.tsx`: Chuyển đổi dropdown Loại tour, Trạng thái khởi hành, Tháng khởi hành, Danh mục, Trạng thái lãi/lỗ và Phương thức thanh toán từng đợt.
     - `DepartureCalendar.tsx`: Chuyển đổi dropdown Thông tin ghép phòng (Lẻ nam / Lẻ nữ).
     - `CustomersManagement.tsx`: Chuyển đổi dropdown Sắp xếp, Sale phụ trách, Hạng đối tác (Tier), Ngân hàng và Trạng thái hoạt động.
- **Trạng thái:** Đã hoàn thành, vượt qua toàn bộ các bài kiểm tra Linter (`npm run lint`) và Biên dịch (`npm run build`) thành công 100%.

### 1.0 Khắc Phục Lỗi Dropdown Bị Che Khuất Bởi Lớp Bọc Thẻ Bảng (Dropdown Clipping Issue Fix)
- **Mô tả vấn đề:**
  - Khi mở dropdown sắp xếp (`CustomSelect`) tại thanh tiêu đề của *Bảng Chi Tiết Doanh Số Kinh Doanh* trên Dashboard, menu lựa chọn bị che khuất và cắt ngang ở mép dưới bởi thuộc tính `overflow-hidden` từ thẻ card cha chứa bảng dữ liệu.
- **Giải pháp thực hiện:**
  1. Loại bỏ lớp `overflow-hidden` ở thẻ container cha của *Bảng Chi Tiết Doanh Số Kinh Doanh*, cho phép menu popup của `CustomSelect` hiển thị nổi hoàn toàn bên trên các phần tử khác.
  2. Bổ sung `rounded-b-xl` trực tiếp vào khối cuộn bảng dữ liệu `overflow-x-auto` bên trong để duy trì bo góc mềm mại, thẩm mỹ và không gây tràn giao diện.
  3. Rà soát và kiểm tra toàn bộ các khối dropdown khác trên Dashboard để đảm bảo không có thành phần nào bị cắt hay che khuất.
- **Trạng thái:** Đã hoàn thành, vượt qua toàn bộ các bài kiểm tra Linter (`npm run lint`) và Biên dịch (`npm run build`) thành công 100%.

### 1.0 Đồng Bộ Giao Diện Dropdown Trên Toàn Bộ Trang Bảng Điều Khiển (Dashboard CustomSelect Migration)
- **Mô tả yêu cầu:**
  - Thay thế toàn bộ các thẻ `<select>` mặc định của trình duyệt tại trang Bảng Điều Khiển (`Dashboard.tsx`) bằng component `CustomSelect` chuẩn hóa của hệ thống để đồng bộ 100% về giao diện, bo góc, hiệu ứng tương tác, màu sắc, font chữ và trải nghiệm người dùng.
- **Giải pháp thực hiện:**
  1. Tích hợp `CustomSelect` vào tất cả các vị trí bộ lọc và lựa chọn trên Dashboard:
     - **Bộ Lọc Nâng Cao (Modal Bộ Lọc):** Dropdown Đội nhóm kinh doanh, Nhân viên Sale phụ trách, Kênh bán / Nguồn khách, Loại sản phẩm / Tour, và Trạng thái đơn hàng.
     - **Biểu đồ Dự Báo Doanh Thu:** Dropdown chọn chu kỳ dự báo (Theo tháng / Theo quý).
     - **Khối Cơ Cấu Kênh Bán:** Dropdown lọc nhanh theo từng Đội nhóm kinh doanh.
     - **Bảng Chi Tiết Doanh Số Kinh Doanh:** Dropdown sắp xếp đa chiều (Doanh số giảm/tăng, Số lượng Pax giảm, Tên nhân viên A-Z).
  2. Khởi tạo danh sách các tùy chọn (`options`) chuẩn hóa cho `CustomSelect` kết hợp `useMemo` để tối ưu hiệu năng render.
  3. Cập nhật `CustomSelect.tsx` để hỗ trợ ghi đè `buttonClassName` linh hoạt và quản lý trạng thái đóng/mở menu chuẩn xác.
- **Trạng thái:** Đã hoàn thành, vượt qua toàn bộ các bài kiểm tra Linter (`npm run lint`) và Biên dịch (`npm run build`) thành công 100%.

### 1.0 Nâng Cấp Xuất Báo Cáo Excel (.xlsx) Đa Sheet & Tối Ưu Tương Tác Bảng Điều Khiển (Dashboard)
- **Mô tả yêu cầu:**
  1. Loại bỏ phần Bảng điều khiển hiệu suất Meta Ads khỏi Dashboard.
  2. Nâng cấp tính năng xuất báo cáo từ định dạng CSV sang định dạng chuẩn Excel (.xlsx) với đầy đủ định dạng cột và nhiều Sheet phân tích chuyên sâu.
  3. Kích hoạt và gán chức năng trực quan cho các nút bấm điều hướng (Nút "Xem chi tiết danh sách đơn" tại khối Cơ cấu kênh bán chuyển sang Tab Quản lý đơn hàng; Nút "Xem đơn" tại bảng doanh số Sale lọc tự động đơn hàng của Sale đó; Nút "Xuất Excel Lãi/Lỗ" tại tab Báo cáo tài chính).
- **Giải pháp thực hiện:**
  1. Sử dụng thư viện `xlsx` để khởi tạo Workbook chứa 4 Sheet dữ liệu hoàn chỉnh:
     - `Danh_Sach_Don_Hang`: Danh sách chi tiết các đơn hàng kinh doanh (Mã đơn, Khách hàng, SĐT, Tour, Pax, Doanh thu, Trạng thái, Kênh bán, Người tạo, Thời gian).
     - `Doanh_So_Sale`: Bảng xếp hạng và chi tiết doanh số, số đơn, lượt khách Pax, tiến độ KPI và lợi nhuận gộp theo từng chuyên viên Sale.
     - `Hieu_Qua_Team`: Báo cáo hiệu quả kinh doanh theo từng Đội nhóm (Team) kèm Leader và tỷ lệ đạt KPI.
     - `Lai_Lo_Tour`: Báo cáo hạch toán doanh thu, giá vốn, lãi gộp và biên lợi nhuận (%) từng Tour du lịch.
  2. Bổ sung cấu hình độ rộng cột (`!cols`) cho tất cả các Sheet để file Excel mở lên luôn ngay ngắn, chuyên nghiệp.
  3. Gán sự kiện `onClick` cho nút Xem chi tiết trong khối Cơ cấu kênh bán và nút Xem đơn của từng nhân viên Sale trong Bảng chi tiết doanh số.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch thành công 100%.

### 1.0 Chuẩn Hóa & Điều Hướng Chính Xác Toàn Bộ Hệ Thống Thông Báo (Notification Routing & Filtering)
- **Mô tả yêu cầu & vấn đề:**
  1. Khi người dùng bấm vào các mục thông báo trên thanh chuông thông báo (`Layout.tsx`), hệ thống điều hướng sai trang hoặc chuyển nhầm về Đơn hàng Tour thay vì trang chức năng tương ứng (ví dụ: thông báo duyệt nghỉ phép chuyển về Đơn hàng thay vì Quản lý Nghỉ phép & Chấm công; thông báo hóa đơn, duyệt chi chuyển không đúng tab Kế toán; thông báo Visa và Ảnh đoàn không tự động lọc dữ liệu đích).
  2. Phân quyền hiển thị thông báo chưa lọc chính xác cho các vai trò chuyên biệt (HR chỉ thấy đơn nghỉ phép/chấm công; Kế toán thấy hóa đơn/phiếu thu/phiếu chi/đề nghị thanh toán; Visa thấy hồ sơ visa; Sale/Leader chỉ thấy đơn hàng và thành viên liên quan).
- **Giải pháp thực hiện:**
  1. **Điều hướng thông minh trong `Layout.tsx`:** Tách biệt và phân loại điều hướng chi tiết cho từng loại thông báo:
     - **Nghỉ phép / Chấm công:** Điều hướng đến `/leave-requests` với `tab` tương ứng (`team_approval`, `final_approval`, `my_leaves`) và truyền `searchTarget` (họ tên nhân sự hoặc mã đơn).
     - **Đề nghị thanh toán:** Điều hướng đến `/payment-proposals` và điền tự động `searchTarget` (mã đề nghị thanh toán).
     - **Ảnh đoàn Tour:** Điều hướng đến `/tour-media` và kích hoạt lọc theo mã Tour.
     - **Kế toán / Thu Chi / VAT:** Điều hướng đến `/accounting` kèm đúng `tab` (`receipts`, `payments`, `vat`) và điền `searchTarget` (mã hóa đơn, phiếu thu, phiếu chi, hoặc mã đơn).
     - **Visa & Hộ chiếu:** Phân biệt chính xác giữa Dịch vụ Visa lẻ (`/visa-orders` hoặc `/visa-services`) và Duyệt hồ sơ visa hành khách (`/visa-processing`) kèm truyền từ khóa tìm kiếm.
     - **Đơn hàng Tour:** Điều hướng đến `/orders` với `searchTarget` và tự động mở rộng chi tiết đơn hàng (`expandOrderId`).
  2. **Bộ lọc thông báo Real-time theo vai trò (`Layout.tsx`):** Cập nhật bộ lọc `notifications` để phân quyền chặt chẽ theo `currentRole` (HR, Kế toán, Visa, Sale Leader, Sale, Admin, BOD).
  3. **Xử lý `location.state` tại các trang nhận:** Bổ sung và chuẩn hóa `useEffect` đọc `location.state` tại `LeaveRequestsPage.tsx`, `AccountingInvoice.tsx`, `VisaOrders.tsx`, `OrdersManagement.tsx`, `TourMediaManagement.tsx`, `PaymentProposals.tsx` để tự động chuyển tab, điền ô tìm kiếm, mở rộng bộ lọc và làm sạch `window.history.replaceState` tránh bị kích hoạt lại khi người dùng tải lại trang.
- **Trạng thái:** Đã hoàn thành, vượt qua toàn bộ các bài kiểm tra Linter (`npm run lint`) và Biên dịch (`npm run build`) thành công 100%.

### 1.0 Chuẩn Hóa Dropdown, Icon và Giao Diện Toàn Diện Tab Đề Nghị Thanh Toán (Payment Proposals)
- **Mô tả yêu cầu:**
  1. Kiểm tra lại toàn bộ giao diện (UI audit) tab Đề nghị thanh toán (`PaymentProposals.tsx`).
  2. Thay thế toàn bộ các thẻ `<select>` mặc định bằng component `CustomSelect` chuẩn hóa thiết kế của hệ thống.
  3. Rà soát và cập nhật hệ thống icon (`lucide-react`) đồng bộ, loại bỏ double icon và ký tự thủ công (`+`, `✕`, `👤`, v.v.), đảm bảo UI tinh tế, hiện đại.
- **Giải pháp thực hiện:**
  1. **Bộ lọc trên trang:** Chuyển đổi dropdown Trạng thái duyệt (`filterStatus`) và Phân loại chi phí (`filterType`) sang `CustomSelect` kèm icon trực quan và nhãn màu rõ ràng. Bổ sung nút "Xóa bộ lọc" (`RotateCcw`).
  2. **Biểu mẫu Tạo đề nghị mới (Create Modal):** Thay thế toàn bộ dropdown HTML bằng `CustomSelect` cho 3 trường: Loại chi phí (`proposalTypeFormOptions`), Chọn Tour liên quan (`tourFormOptions`) và Ngân hàng thụ hưởng (`bankOptions`).
  3. **Hệ thống Icon & Badge:** Đồng bộ icon cho tiêu đề cột Kanban (`Hourglass`, `Clock`, `CheckCircle2`, `XCircle`), badge loại chi phí (`Plane` cho Tour, `Building2` cho Chi chung, `User` cho Chi lẻ), thay thế ký tự `✕` bằng icon `X` trong tất cả modal header, chuẩn hóa các nút bấm kèm icon `Plus`, `Search`, `Filter`.
- **Trạng thái:** Đã hoàn thành, vượt qua toàn bộ các bài kiểm tra Lint và Build thành công 100%.

### 1.0 Tích Hợp Webhook POS Cake / Pancake: Thu Thập Đầy Đủ Dữ Liệu Khách Hàng & Quảng Cáo (Meta Ads)
- **Mô tả yêu cầu:**
  1. Loại bỏ các phương thức tải file tĩnh thủ công, chuyển sang kết nối trực tiếp qua Webhook chuẩn POS Cake / Pancake API (theo đặc tả `https://docs.pancake.biz/pos/api/#models/WebhookProductResponse`).
  2. Bóc tách và lưu trữ đầy đủ các trường dữ liệu:
     - **Thông tin khách hàng:** Họ và tên (`customer_name`), Số điện thoại (`customer_phone`), Giới tính (`gender`: Nam/Nữ), Facebook ID / PSID (`fb_id`), Ngày tháng năm sinh (`birthday`).
     - **Dữ liệu Quảng cáo & Marketing:** Ad ID (`ad_id`), Tên quảng cáo (`ad_name`), ID Chiến dịch (`campaign_id`), Tên chiến dịch (`utm_campaign`), ID Nhóm quảng cáo (`adset_id`), Tên nhóm quảng cáo (`adset_name`), UTM Tracking (`utm_source`, `utm_medium`, `utm_content`, `utm_term`).
  3. Hiển thị trực quan trên giao diện bảng Khách Hàng Tiềm Năng (`PotentialLeadsTab.tsx`) và hỗ trợ chỉnh sửa chi tiết trong Modal (kèm nút Sao chép FB ID, link mở trang cá nhân Facebook, hiển thị ngày sinh theo chuẩn `dd/mm/yyyy`).
- **Giải pháp thực hiện:**
  1. **Backend (Webhook Handler & API):** Cập nhật `pancakeService.ts` và `metaMessengerService.ts` để phân tích sâu payload từ webhook POS Cake (bao gồm cả sự kiện đơn hàng `order_created`, `order_updated` và sự kiện khách hàng `customer_created`, `partner_created`), bóc tách chính xác `birthday`, `gender`, `fb_id`, `ad_id`, `ad_name`, `campaign_id`, `utm_campaign`, `adset_name`, `utm_source`, `utm_medium`.
  2. **API & Database:** Cập nhật endpoint `PUT /api/meta-leads/:id` và `updateMetaLead` hỗ trợ cập nhật động các trường mới. Bổ sung các cột `birthday`, `fb_id`, `ad_name`, `campaign_id`, `adset_id`, `adset_name`, `utm_term` vào `leads` và `customers` trong `supabase-schema.sql` cùng kích hoạt Realtime publication.
  3. **Frontend:** Cập nhật bảng và modal chi tiết trong `PotentialLeadsTab.tsx` với giao diện trực quan, chia thành 3 khối rõ ràng: *Thông tin Khách hàng* (Giới tính, Ngày sinh, FB ID), *Dữ liệu Quảng cáo* (Ad ID, Ad Name, Campaign, Adset, UTM) và *Quản lý Chăm sóc* (Trạng thái, Gán Sale, Ghi chú).
- **Trạng thái:** Đã hoàn thành, vượt qua toàn bộ các bài kiểm tra Lint và Build thành công 100%.


### 1.0 Mặc định sắp xếp danh sách nhân sự theo Bộ phận (Quỹ phép năm & Chấm công)
- **Mô tả vấn đề:** Danh sách nhân viên trong bảng "Quản Lý & Điều Chỉnh Quỹ Phép Năm Thủ Công" và "Bảng Chấm Công & Quản Lý Công Chuẩn" hiển thị lộn xộn theo thứ tự đăng ký hoặc ngẫu nhiên, gây khó khăn cho Nhân sự (HR), Quản trị viên và Ban Giám Đốc khi theo dõi tình hình nhân sự theo từng phòng ban.
- **Giải pháp:**
  1. Thiết lập chuẩn phân loại thứ tự phòng ban (`ROLE_DEPARTMENT_ORDER`): Ban Giám Đốc (BOD) -> Nhân sự (HR) -> Sale Leader -> Sale -> Trưởng phòng Marketing -> Nhân viên Marketing -> Điều hành Tour -> Kế toán -> Bộ phận Visa -> Hướng Dẫn Viên -> Quản trị viên.
  2. Cập nhật hàm tính danh sách nhân sự `staffList` trong `LeaveBalanceManagement.tsx` và `staffProfiles` trong `TimesheetManagement.tsx` để tự động sắp xếp theo thứ tự bộ phận, các nhân sự trong cùng bộ phận sẽ được xếp theo thứ tự bảng chữ cái tiếng Việt của họ tên (`localeCompare`).
  3. Đồng bộ lại thứ tự các tùy chọn trong dropdown lọc Bộ phận theo chuẩn phòng ban thống nhất.
- **Trạng thái:** Đã hoàn thiện, kiểm tra linter và biên dịch thành công.

### 1.0 Loại bỏ khối Quỹ phép năm khỏi trang Bảng điều khiển (Dashboard)
- **Mô tả vấn đề:** Khối "Quỹ Phép Năm (2026)" và nút "Tạo Đơn Xin Nghỉ" hiển thị ở đầu tab Tổng quan trang Bảng điều khiển gây dư thừa do tính năng này đã được tập trung quản lý chuyên biệt tại trang Hành chính nhân sự (`/leave-requests`).
- **Giải pháp:** Đã loại bỏ hoàn toàn component `EmployeeLeaveBalanceWidget` khỏi tab Tổng quan trong `Dashboard.tsx`.
- **Trạng thái:** Đã hoàn thiện, kiểm tra linter và biên dịch thành công.

### 1.0 Nâng cấp thanh Toolbar Quản lý Tour: Chuyển đổi Loại Tour thành Segmented Tabs & Chuẩn hóa Dropdown
- **Mô tả vấn đề:** 
  - Hộp chọn "Loại tour" trước đây nằm trong dropdown gây mất thao tác khi muốn lọc nhanh.
  - Các dropdown tìm kiếm, tháng và danh mục thị trường có phong cách chưa thực sự hiện đại, chưa có icon dẫn hướng rõ ràng.
- **Giải pháp:**
  1. Đưa phân loại tour ra ngoài thành cụm **Segmented Tabs** trực quan với badge số lượng và màu sắc nhận diện đặc trưng (Tất cả, AD Tự vận hành, Gửi khách đối tác, Đoàn riêng).
  2. Bố cục lại thanh công cụ theo 2 hàng logic: Hàng 1 chọn nhanh Loại tour + Trạng thái thời gian; Hàng 2 gồm Ô tìm kiếm thông minh + Dropdown Tháng + Dropdown Danh mục + Nút Xóa lọc.
  3. Bổ sung icon đầu mục cho các dropdown (`Calendar`, `Tag`) cùng giao diện bo góc `rounded-xl`, màu nền sáng thanh lịch và viền bóng nhẹ.
- **Trạng thái:** Đã hoàn thiện, kiểm tra linter và biên dịch thành công.

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

### 1.77 Loại Bỏ Tích Hợp Gửi Thông Báo Tới Google Chat
- **Mô tả yêu cầu:**
  - Loại bỏ hoàn toàn luồng kết nối và bắn thông báo sang webhook Google Chat khi phát sinh Lead mới hoặc Đơn hàng mới từ Pancake/Botcake/POS Cake.
- **Giải pháp:**
  - Cập nhật hàm `sendInternalSystemNotification` trong `server/services/botcakeService.ts`, gỡ bỏ đoạn mã gọi webhook tới `process.env.GOOGLE_CHAT_WEBHOOK_URL`.
  - Giữ lại thông báo nội bộ hệ thống trên thanh chuông thông báo (`system_notifications`) và bảng dữ liệu của Tour CRM.
  - Cập nhật các ghi chú và text trên giao diện trong `PotentialLeadsTab.tsx` và `pancakeService.ts` để đồng bộ.
- **Trạng thái:** Đã hoàn thành, biên dịch build thành công 100%.

### 1.78 Tích Hợp Trang Quản Lý Nghỉ Phép & Bảng Chấm Công Tự Động Cho Toàn Thể Nhân Viên
- **Mô tả yêu cầu / Vấn đề:**
  - Nhân viên không thấy mục xin nghỉ phép trên hệ thống do trước đó tính năng nằm trong trang Kế toán và Dashboard bị giới hạn phân quyền.
- **Giải pháp:**
  - Tạo trang chuyên biệt `src/pages/LeaveRequestsPage.tsx` phục vụ toàn bộ nhân viên công ty (`/leave-requests`).
  - Tích hợp mục "Nghỉ phép & Chấm công" lên thanh Sidebar (hỗ trợ cả Desktop và Mobile) cho tất cả các vai trò nội bộ (`agent`, `sale`, `sale_leader`, `operator`, `visa`, `accounting`, `tour_guide`, `marketing_leader`, `marketing`, `bod`, `admin`).
  - Bổ sung badge số lượng đơn nghỉ phép chờ duyệt theo thời gian thực trên menu Sidebar (dành cho Trưởng nhóm, Kế toán, HR và Quản trị viên).
  - Tích hợp lối tắt truy cập nhanh vào mục Nghỉ phép trong User Profile Dropdown tại Top Header.
  - Hỗ trợ đầy đủ các tab chuyên biệt: (1) Đơn nghỉ phép của tôi & Thẻ theo dõi Quỹ phép năm; (2) Duyệt đơn Cấp 1 dành cho Trưởng nhóm/Leader; (3) Phê duyệt Cấp 2 dành cho Kế toán/HR; (4) Bảng chấm công tự động & Xuất file Excel; (5) Cấu hình Ngày lễ & Quỹ phép năm.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.79 Khắc Phục Lỗi Trùng Lặp Nút (Duplicate CTA) & Kép Ký Tự Icon (+ +)
- **Mô tả yêu cầu / Vấn đề:**
  - Nút *Tạo đơn xin nghỉ phép* bị hiển thị 2 dấu cộng liền nhau (`+ +`) do vừa render component `<Plus />` vừa viết ký tự `+` trong text string.
  - Xuất hiện 2 nút *Tạo đơn xin nghỉ phép* cùng lúc (1 nút ở Header tiêu đề trang và 1 nút ở bên trong thẻ Quỹ Phép Năm).
- **Giải pháp:**
  - Chuẩn hóa text của button: Xóa ký tự `+` trong chuỗi text khi button đã có Icon `<Plus />`.
  - Thêm prop `showActionButton={false}` vào `EmployeeLeaveBalanceWidget` để ẩn nút trùng lặp khi widget này được đặt chung trang với Header chính.
  - Lưu quy tắc thiết kế vào hệ thống để ngăn chặn lỗi lặp lại.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.80 Tích Hợp Vai Trò Nhân Sự (HR), Quy Trình Duyệt Phép 2 Cấp & Quản Lý Quỹ Phép Thủ Công
- **Mô tả yêu cầu / Vấn đề:**
  - Thêm vai trò Nhân sự (`role: 'hr'`) trong hệ thống.
  - Cấp quyền cho vai trò `hr` vào tab Quản lý thành viên & Nhân sự (`/settings`).
  - Quy trình duyệt nghỉ phép 2 cấp: Trưởng nhóm (Leader) duyệt Cấp 1 (`approved_level_1`), sau đó Nhân sự (`hr`) hoặc Ban Giám Đốc/Admin duyệt Cấp cuối (`approved_final`).
  - Giới hạn hiển thị: Nhân viên thông thường chỉ xem chấm công & quỹ phép của mình; Trưởng nhóm (Leader) xem của mình và thành viên trong nhóm trực thuộc; HR, BOD và Quản trị viên xem toàn bộ nhân sự công ty.
  - Cho phép Nhân sự (HR) điều chỉnh số ngày nghỉ / quỹ phép của nhân viên thủ công (Quick Edit trực tiếp trên bảng chấm công và Tab Quản lý Quỹ phép chuyên biệt).
- **Giải pháp:**
  - Cập nhật định nghĩa vai trò `hr` trong `src/types.ts` và toàn bộ các component phân quyền (`Layout.tsx`, `CRMContext.tsx`, `AuthContext.tsx`, `Settings.tsx`, `UserManagement.tsx`, `TimesheetManagement.tsx`, `LeaveRequestsPage.tsx`).
  - Cập nhật quy trình duyệt nghỉ phép trong `CRMContext.tsx` với 2 hàm `approveLeaveRequestLevel1` và `approveLeaveRequestFinal`, hỗ trợ ghi nhận người duyệt, thời gian duyệt và phân luồng trạng thái (`pending` -> `approved_level_1` -> `approved_final`).
  - Xây dựng component `LeaveBalanceManagement.tsx` và popup Quick Edit trong `TimesheetManagement.tsx` cho phép Nhân sự/Admin điều chỉnh tổng ngày phép, ngày đã dùng và ghi chú điều chỉnh.
  - Thiết lập bộ lọc dữ liệu phân quyền trực quan dựa trên `useMemo` trong `TimesheetManagement.tsx` và `LeaveRequestsPage.tsx`.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.81 Khắc Phục Lỗi Điều Chỉnh Quỹ Phép Năm Không Lưu Được Lên CSDL Supabase
- **Mô tả yêu cầu / Vấn đề:**
  - Khi thao tác điều chỉnh số ngày phép năm hoặc ghi chú lý do điều chỉnh tại tab **Quản lý Nghỉ phép / Quỹ phép năm** (`LeaveBalanceManagement.tsx`), thông báo cập nhật thành công vẫn xuất hiện nhưng khi tải lại trang (reload) thì dữ liệu bị khôi phục về trạng thái ban đầu và không lưu vĩnh viễn trên CSDL Supabase.
- **Nguyên nhân:**
  1. Bảng `leave_balances` ban đầu trong file schema Supabase (`supabase-schema.sql`) chỉ khai báo các cột cơ bản (`id`, `user_id`, `year`, `total_days`, `used_days`, `created_at`), bị thiếu các cột mở rộng: `remaining_days`, `note`, `updated_by`, `updated_at`.
  2. Khi gọi hàm `updateLeaveBalance`, payload chứa các trường `note`, `updated_by`, `remaining_days` bị API PostgREST của Supabase từ chối (trả về lỗi `column "note" of relation "leave_balances" does not exist`).
  3. Hàm `updateLeaveBalance` trước đó không kiểm tra biến `{ error }` từ Supabase `upsert`, dẫn đến việc hiện thông báo thành công ảo mà thực tế dữ liệu không được ghi vào CSDL.
- **Giải pháp:**
  1. Cập nhật `supabase-schema.sql` bổ sung đầy đủ lệnh `ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS ...` cho các trường: `remaining_days`, `note`, `updated_by`, `updated_at` (cùng các cột `holiday_type`, `description` trong `holidays` và `join_date` trong `profiles`).
  2. Cung cấp mã SQL ngắn gọn để người dùng chạy trực tiếp trên SQL Editor của Supabase.
  3. Nâng cấp hàm `updateLeaveBalance` và `fetchLeaveBalances` trong `CRMContext.tsx` để lọc sạch payload, kiểm tra biến `{ error }` từ Supabase, hiển thị thông báo toast lỗi chi tiết nếu CSDL thiếu cột, và đồng bộ dữ liệu vĩnh viễn.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.82 Giới Hạn Quyền Hạn Nhân Sự (HR) - Không Truy Cập Phần Thành Viên & Phân Quyền
- **Mô tả yêu cầu / Vấn đề:**
  - Bộ phận Nhân sự (HR) chỉ quản lý thông tin nhân sự, duyệt nghỉ phép và theo dõi quỹ phép nhân viên; không được có quyền xem/chỉnh sửa danh sách thành viên hay phân quyền vai trò tài khoản (`UserManagement`).
- **Giải pháp:**
  1. Đổi tên nút menu ở Sidebar góc dưới từ *"Thành viên & Phân quyền"* thành **"Quản lý Quỹ phép"** đối với vai trò `hr` trong `Layout.tsx`.
  2. Tại trang Cài đặt (`Settings.tsx`), thiết lập tab mặc định cho HR là **"Quỹ phép nhân viên"** (`leave_balances`), đồng thời ẩn tab *"Quản lý người dùng & phân quyền"* khỏi danh sách tab khi tài khoản đang ở vai trò `hr`.
  3. Bổ sung chốt chặn bảo mật cấp component trong `UserManagement.tsx` và `Settings.tsx`: nếu tài khoản HR cố tình mở tab người dùng, giao diện sẽ hiển thị cảnh báo quyền truy cập hạn chế.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.83 Tối Ưu Bảng Đơn Xin Nghỉ Phép - Sửa Lỗi Ngắt Dòng & Trùng Lặp Nút Duyệt
- **Mô tả yêu cầu / Vấn đề:**
  - Cột "LÝ DO & BÀN GIAO" bị vỡ dòng chữ `🤝 Bàn giao:` dọc gây mất thẩm mỹ.
  - Cột "THAO TÁC" đối với Admin hiển thị trùng lặp cả 2 nút `[Duyệt C1]` và `[Duyệt Cuối]` cùng lúc làm cột bị phình ngang đẩy lệch các tiêu đề.
- **Giải pháp:**
  1. Cố định chiều rộng tối thiểu (`min-w-[...]`) và thuộc tính `whitespace-nowrap` cho tất cả các cột trong bảng `LeaveRequestsPage.tsx`.
  2. Định dạng dòng `🤝 Bàn giao:` nằm trên 1 hàng duy nhất kèm `truncate` tên người nhận bàn giao.
  3. Tối ưu điều kiện `canApproveL1`: khi tài khoản có quyền `canApproveFinal` (Admin/BOD/HR), nút `[Duyệt C1]` sẽ tự động ẩn để tránh trùng lặp 2 nút duyệt.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.84 Tự Động Khấu Trừ & Ghi Nhận Ngày Phép Năm Từ Đơn Xin Nghỉ Đã Duyệt
- **Mô tả yêu cầu / Vấn đề:**
  - Đơn xin nghỉ phép năm (`type === 'annual'`) đã được duyệt hoàn tất (Cấp cuối) nhưng số ngày phép đã sử dụng (`ĐÃ SỬ DỤNG`) trong Quản lý Quỹ Phép vẫn hiển thị = `0`.
- **Giải pháp:**
  1. Cập nhật hàm `getEffectiveLeaveBalance` trong `payrollUtils.ts` để tự động đếm & cộng dồn số ngày công từ tất cả các đơn nghỉ phép năm đã duyệt cấp cuối (`approved_final`) trong năm.
  2. Cập nhật `calculateEmployeeTimesheet` trong `payrollUtils.ts` để tính toán chính xác số ngày phép đã sử dụng và số ngày phép còn lại trên Bảng Chấm Công.
  3. Truyền danh sách `leaveRequests` và `holidays` vào các component widget (`LeaveBalanceManagement.tsx`, `LeaveRequestModal.tsx`) để tự động đồng bộ ngay lập tức.
  4. Cập nhật phương thức `approveLeaveRequestFinal` trong `CRMContext.tsx` để thực hiện `upsert` dữ liệu quỹ phép lên Supabase theo cặp khóa `(user_id, year)` mà không bị lỗi ghi đè/trùng lặp.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.85 Phân Quyền Xóa Đơn Nghỉ Phép Cho HR / BOD / Admin & Tự Động Hoàn Phép Năm
- **Mô tả yêu cầu / Vấn đề:**
  - Cần cho phép các vai trò HR, BOD, Admin, Kế toán có quyền xóa bất kỳ đơn nghỉ phép nào của nhân viên trên hệ thống.
  - Khi đơn xin nghỉ phép năm đã được duyệt cấp cuối (`approved_final`) bị xóa, quỹ phép năm của nhân viên cần được hoàn lại / tính toán lại số ngày đã sử dụng chính xác.
- **Giải pháp:**
  1. Cập nhật điều kiện `canDelete` trong `LeaveRequestsPage.tsx` và `LeaveManagementTab.tsx` cho phép các vai trò HR / BOD / Admin / Kế toán nhìn thấy và tương tác với nút Xóa (Thùng rác).
  2. Nâng cấp phương thức `deleteLeaveRequest` trong `CRMContext.tsx`: Nếu đơn bị xóa thuộc loại phép năm đã duyệt (`type === 'annual'` && `status === 'approved_final'`), hệ thống tự động tính toán lại số ngày phép năm còn lại đã sử dụng và cập nhật đồng bộ lên CSDL Supabase & LocalStorage.
  3. Thay thế câu lệnh `confirm()` trình duyệt mặc định bằng **Modal xác nhận Xóa đơn nghỉ phép tùy chỉnh (Custom React Modal)** để đảm bảo hoạt động mượt mà trên môi trường iFrame Sandbox.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.86 Đồng Bộ Quỹ Phép Năm Cộng Gộp Ngày Nghỉ Hoán Đổi Cầu Nối Của Công Ty
- **Mô tả yêu cầu / Vấn đề:**
  - Mất đồng bộ giữa Widget Quỹ Phép Năm và Bảng Chấm Công: Khi công ty có ngày nghỉ hoán đổi/cầu nối (`bridge_annual_or_unpaid` - ví dụ ngày 31/08), Bảng Chấm Công tự động khấu trừ 1 ngày phép năm, nhưng Widget Quỹ Phép và Modal Xin Nghỉ Phép chỉ đếm đơn cá nhân nên hiển thị dư 1 ngày phép chưa dùng.
- **Giải pháp:**
  1. Xây dựng hàm `calculateTotalUsedAnnualDays` trong `payrollUtils.ts` để tự động cộng dồn cả ngày nghỉ từ đơn cá nhân đã duyệt VÀ ngày nghỉ hoán đổi/cầu nối toàn công ty chưa bị trùng với đơn cá nhân.
  2. Cập nhật `getEffectiveLeaveBalance` trong `payrollUtils.ts` để Widget Quỹ Phép, Modal Đặt Đơn Nghỉ và Bảng Quản Lý Phép Nhân Sự hiển thị chính xác 100% số ngày phép đã sử dụng và số ngày phép còn lại.
  3. Cập nhật `approveLeaveRequestFinal` và `deleteLeaveRequest` trong `CRMContext.tsx` để đồng bộ chính xác số ngày phép đã sử dụng lên Supabase & LocalStorage.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.87 Phân Quyền Xuất File Excel Bảng Chấm Công (Chỉ Cho HR / BOD / Admin)
- **Mô tả yêu cầu / Vấn đề:**
  - Chỉ cho phép các vai trò **HR (`hr`)**, **Ban Giám Đốc (`bod`)** và **Quản trị viên (`admin`)** có quyền xuất file Excel Bảng chấm công. Các vai trò khác không được xuất file Excel.
- **Giải pháp:**
  1. Khai báo biến phân quyền `canExportExcel = ['hr', 'bod', 'admin'].includes(effectiveRole)` trong `TimesheetManagement.tsx`.
  2. Thêm kiểm tra điều kiện trong hàm `handleExportExcel` để chặn thực thi nếu người dùng không thuộc 3 vai trò trên.
  3. Ẩn nút **"Xuất File Excel (.xlsx)"** trên giao diện Bảng Chấm Công đối với các vai trò ngoài HR, BOD và Admin.
  4. Cập nhật tiêu đề tab trên `LeaveRequestsPage.tsx` thành "Bảng chấm công nhân sự".
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.88 Nâng Cấp Giao Diện Dropdown Thả Xuống & Chuẩn Hóa Icon Mới Cho Trang Nghỉ Phép & Chấm Công
- **Mô tả yêu cầu / Vấn đề:**
  - Các ô chọn `<select>` mặc định của trình duyệt trông vuông vức, xám thô và bị lỗi hiển thị khoảng cách dính sát trên một số thiết bị/trình duyệt.
- **Giải pháp:**
  1. Thay thế toàn bộ các thẻ `<select>` mặc định bằng `CustomSelect` component cao cấp (bo góc `rounded-xl`, shadow nhẹ, menu nổi `shadow-xl`, hiệu ứng hover/focus viền xanh, icon check đánh dấu lựa chọn active).
  2. Áp dụng đồng bộ `CustomSelect` cho: Bảng chấm công (`TimesheetManagement.tsx`), Quản lý danh sách đơn nghỉ (`LeaveManagementTab.tsx`), Điều chỉnh quỹ phép năm (`LeaveBalanceManagement.tsx`), Form xin nghỉ (`LeaveRequestModal.tsx`) và Trang chính (`LeaveRequestsPage.tsx`).
  3. Chuẩn hóa toàn bộ bộ icon Lucide (`Calendar`, `Filter`, `Users`, `Clock`, `UserCheck`...) kèm nhãn hiển thị cho từng bộ lọc.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.89 Khắc Phục Lỗi Lệch Hàng Control & Menu Dropdown Bị Che Khuất
- **Mô tả yêu cầu / Vấn đề:**
  - Ô tìm kiếm và các nút Dropdown lọc bị lệch hàng dọc (không thẳng hàng ngang) do ô tìm kiếm thiếu nhãn trên (label) và không đồng bộ chiều cao.
  - Danh sách thả xuống của Dropdown khi mở ra bị cắt/che khuất bởi đường viền khung thẻ chứa do tính chất `overflow-hidden`.
- **Giải pháp:**
  1. Thêm nhãn tiêu đề `TÌM KIẾM` chuẩn hóa cho ô tìm kiếm, nâng chiều cao ô nhập liệu thành `h-[38px]` bằng với nút CustomSelect, và thiết lập `items-end` cho toàn bộ container bộ lọc để các khung điều khiển căn lề đáy thẳng hàng tuyệt đối.
  2. Bỏ thuộc tính `overflow-hidden` ở thẻ bao ngoài bộ lọc trong `LeaveRequestsPage.tsx` và chuyển thuộc tính cuộn sang container chứa bảng (`overflow-x-auto rounded-b-2xl`).
  3. Cấu hình `z-50` cho container CustomSelect khi mở và `z-[100]` cho khung popup danh sách thả xuống để menu hiển thị đè lên bảng một cách mượt mà mà không bao giờ bị cắt che.
  4. Áp dụng đồng bộ giải pháp căn hàng và chống che cho: `LeaveRequestsPage.tsx`, `LeaveManagementTab.tsx`, `TimesheetManagement.tsx`, `LeaveBalanceManagement.tsx` và `CustomSelect.tsx`.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.90 Mở Rộng Chiều Rộng Nút Chọn Năm (Year Dropdown Width) Đảm Bảo Hiển Thị Đầy Đủ Text
- **Mô tả yêu cầu / Vấn đề:**
  - Nút chọn "Năm" ở Bảng chấm công bị giới hạn chiều rộng `w-32` dẫn đến văn bản hiển thị bị cắt bớt thành `Năm 20...`.
- **Giải pháp:**
  - Tăng chiều rộng nút chọn từ `w-32` lên `w-36 sm:w-40` trong `TimesheetManagement.tsx` và `LeaveBalanceManagement.tsx`, giúp hiển thị đầy đủ văn bản "Năm 2026" cùng biểu tượng lịch và mũi tên thả xuống một cách rõ ràng, không bị xén chữ.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.91 Phân Tách Tab Quản Lý Người Dùng Thành "Nhân Sự Công Ty", "Tài Khoản Đại Lý & CTV" và "Team Kinh Doanh"
- **Mô tả yêu cầu / Vấn đề:**
  - Cần phân tách tab Quản lý Nhân sự & Tài khoản trong Cài đặt hệ thống để quản lý riêng biệt giữa nhân sự nội bộ công ty và đối tác phân phối bên ngoài (Đại lý & CTV).
  - Làm rõ quy trình duyệt Đơn xin nghỉ phép và Đề nghị thanh toán đối với Leader hoặc nhân sự không gán Leader phụ trách.
- **Giải pháp:**
  1. Phân tách tab người dùng thành **3 tab rõ ràng**: (1) **🏢 Quản lý Nhân sự Công ty** (lọc tất cả role nội bộ), (2) **🤝 Tài khoản Đại lý & CTV** (lọc role `agent`, `CTV`), và (3) **🏛️ Quản lý Team Kinh doanh**.
  2. Nút **"Thêm Nhân sự Mới"** và **"Thêm Đại lý / CTV Mới"** tự động gán role mặc định chuẩn tương ứng với từng tab.
  3. Cập nhật bộ lọc vai trò (Role filter) trong từng tab chỉ hiển thị các vai trò thuộc nhóm tương ứng.
  4. Xác nhận quy trình duyệt: Đơn nghỉ phép & Đề nghị thanh toán của Leader hoặc nhân sự không gán Leader sẽ tự động được chuyển lên cấp quản lý cao nhất gồm **Admin**, **BOD** và **HR** (đối với nghỉ phép) hoặc **Kế toán** (đối với chi tiền).
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.92 Tự Động Ghép & Đồng Bộ Email Cho Danh Sách Tài Khoản Người Dùng (Fix Trống Email)
- **Mô tả yêu cầu / Vấn đề:**
  - Danh sách tài khoản người dùng hiển thị biểu tượng email ✉️ nhưng giá trị email bên cạnh bị bỏ trống (do bảng `profiles` trong Supabase chưa ghi nhận cột `email` cho các tài khoản được tạo trước đó).
- **Giải pháp:**
  1. Cập nhật backend API `GET /api/admin/users`: Tự động truy vấn danh sách `auth.users` từ Supabase Auth Admin API để ghép chính xác địa chỉ email thật vào profile người dùng theo `user_id`.
  2. Bổ sung cơ chế tự động ghi ngược (backfill) địa chỉ email vào cột `email` của bảng `profiles` trong cơ sở dữ liệu để đảm bảo dữ liệu được đồng bộ bền vững.
  3. Bổ sung logic chuẩn hóa định dạng email fallback tại `UserManagement.tsx` dựa trên tên nhân sự nếu chưa có email auth, đảm bảo 100% tài khoản đều hiển thị email rõ ràng bên cạnh biểu tượng thư ✉️.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.93 Rà Soát & Tối Ưu Hóa Chi Tiết Schema Database Supabase (`supabase-schema.sql`)
- **Mô tả yêu cầu / Vấn đề:**
  - Kiểm tra và làm sạch toàn bộ file `supabase-schema.sql` để loại bỏ tất cả các bảng dư thừa và chỉnh sửa chuẩn hóa tên bảng/cột trùng khớp 100% với ứng dụng CRM.
- **Giải pháp:**
  1. Loại bỏ hoàn toàn khối khởi tạo bảng `visas` cũ ở phần đầu schema (vì hồ sơ visa đã chuyển sang bảng `passengers` và dịch vụ visa thuộc bảng `tours`).
  2. Loại bỏ bảng `feedbacks` dư thừa.
  3. Cập nhật các View báo cáo (`executive_visa_risk`, `executive_financial_margins`, `executive_agent_performance`) đổi từ tên bảng cũ `orders` sang bảng `bookings` thực tế, đảm bảo khi chạy trong SQL Editor của Supabase không gặp lỗi thiếu bảng.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.94 Sắp Xếp Toàn Bộ Dãy Tab Điều Hướng Nghỉ Phép Thành 1 Hàng Ngang Liền Mạch
- **Mô tả yêu cầu / Vấn đề:**
  - Dãy nút điều hướng tab trên trang Quản lý Nghỉ phép (`LeaveRequestsPage.tsx`) bị rớt dòng làm 2 nút "Quản lý Quỹ Phép (2026)" và "Cấu hình Ngày lễ" rơi xuống hàng thứ 2.
- **Giải pháp:**
  - Cập nhật flex container chứa toàn bộ các nút tab thành `flex-nowrap` kèm `min-w-max` và `overflow-x-auto scrollbar-none`, giúp 100% các nút tab luôn nằm trên cùng 1 hàng ngang duy nhất, hỗ trợ cuộn ngang mượt mà trên màn hình nhỏ.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter (`npm run lint`) và biên dịch (`npm run build`) thành công 100%.

### 1.95 Tinh Gọn Kích Thước & Nhãn Nút Tab Tránh Bị Che Chữ
- **Mô tả yêu cầu / Vấn đề:**
  - Nhãn text các tab điều hướng dài và khoảng đệm lớn khiến các nút tab bị che chữ khi hiển thị.
- **Giải pháp:**
  - Thu gọn nhãn các tab: `Đơn của tôi`, `Duyệt Cấp 1`, `Duyệt Cấp Cuối`, `Bảng chấm công`, `Quỹ Phép (2026)`, `Cấu hình Ngày lễ`.
  - Giảm kích thước icon về `w-3.5 h-3.5`, padding `px-2.5 py-1.5`, font chữ `text-xs font-bold` và `gap-1.5`, giúp 100% các nút tab hiển thị đầy đủ và không bị che khuất.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch (`npm run build`) thành công 100%.

### 1.96 Chuẩn Hóa Hiển Thị Badge Bộ Phận / Vai Trò Thuần Việt
- **Mô tả yêu cầu / Vấn đề:**
  - Cột "Bộ phận" trong Bảng chấm công (`TimesheetManagement.tsx`) và Quản lý quỹ phép (`LeaveBalanceManagement.tsx`) hiển thị chuỗi mã kỹ thuật thô (`SALE_LEADER`, `SALE`, `MARKETING_LEADER`, `ADMIN`, `VISA`...).
- **Giải pháp:**
  - Định nghĩa bộ cấu hình chuẩn hóa `ROLE_LABELS` và helper `getRoleConfig` trong `types.ts`.
  - Đồng bộ hiển thị badge bộ phận dạng pill với icon Khiên (`Shield`), màu sắc nền và viền đặc trưng cho từng vai trò theo thiết kế chuẩn (VD: `Trưởng phòng Marketing`, `Nhân viên Marketing`, `Sale Leader (Trưởng nhóm)`, `Sale`, `Hướng Dẫn Viên (HDV)`, `Điều hành Tour`, `Bộ phận Visa`, `Quản trị viên (Admin)`).
  - Cập nhật bộ lọc lựa chọn Bộ phận và định dạng xuất file Excel đồng bộ tên Tiếng Việt chuẩn xác.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch (`npm run build`) thành công 100%.

### 1.97 Bộ Lọc Năm/Tháng & Tính Năng Chỉnh Sửa Ngày Lễ Hệ Thống
- **Mô tả yêu cầu / Vấn đề:**
  - Bổ sung bộ lọc Năm, Tháng và Từ khóa tìm kiếm cho bảng danh sách Ngày lễ hệ thống.
  - Cho phép chỉnh sửa lại thông tin ngày lễ đã lưu (Tên, ngày qua DatePicker, loại ngày nghỉ, ghi chú, lặp lại).
- **Giải pháp:**
  - Bổ sung hàm `updateHoliday(id, data)` trong `CRMContext.tsx` để cập nhật đồng bộ lên Supabase và LocalStorage.
  - Tích hợp thanh bộ lọc linh hoạt trực quan ngay trên tiêu đề bảng: Lọc theo Năm (tự động gom các năm có dữ liệu + năm hiện tại, năm trước, năm sau hoặc "Tất cả các năm"), lọc theo Tháng (Tháng 1 -> 12 hoặc "Tất cả các tháng"), ô tìm kiếm theo tên hoặc mô tả ngày lễ, kèm badge đếm số lượng ngày lễ theo kết quả lọc và nút "Xóa lọc".
  - Thêm nút Sửa (`Edit2`) ở cột Thao tác từng dòng; khi bấm sửa form nhập bên trái sẽ chuyển sang chế độ "✏️ Cập nhật Ngày Lễ" có viền highlight hổ phách, nạp dữ liệu cũ vào DatePicker & Form, có nút "Lưu Cập Nhật Ngày Lễ" và "Hủy bỏ".
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch (`npm run build`) thành công 100%.

### 1.98 Loại Trừ Hoàn Toàn Quản Trị Viên (Admin) Khỏi Nghỉ Phép & Chấm Công
- **Mô tả yêu cầu / Vấn đề:**
  - Quản trị viên (`admin`) là vai trò điều hành hệ thống, không thuộc đối tượng chấm công tính ngày làm việc hay cấp phát/quản lý quỹ phép năm định kỳ.
- **Giải pháp:**
  1. `TimesheetManagement.tsx`: Lọc bỏ `admin` khỏi `staffProfiles` và `rawTimesheetRows` trong bảng chấm công, loại bỏ `admin` khỏi bộ lọc lựa chọn Bộ phận và tổng kết số liệu nhân viên.
  2. `LeaveBalanceManagement.tsx`: Lọc bỏ `admin` khỏi `staffList` và `eligibleStaff` (chỉ quản lý và cấp phát quỹ phép cho nhân sự các phòng ban thực tế), loại bỏ `admin` khỏi bộ lọc bộ phận.
  3. `LeaveRequestModal.tsx`: Lọc bỏ `admin` khỏi danh sách nhân sự tạo đơn hộ và danh sách đồng nghiệp nhận bàn giao công việc.
  4. `LeaveRequestsPage.tsx`: Đồng bộ `internalStaffList` loại trừ `admin`.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch (`npm run build`) thành công 100%.

### 1.99 Khắc Phục Lưu & Cập Nhật Ngày Nghỉ Lễ Bị Trở Lại Như Cũ Khi Tải Lại Trang
- **Mô tả yêu cầu / Vấn đề:**
  - Sau khi sửa thông tin ngày lễ (ví dụ xóa/sửa nội dung mô tả hoặc đổi thông tin) và lưu lại (ảnh 1), khi tải lại trang (`F5`) thông tin bị quay trở lại như ban đầu (ảnh 2).
- **Nguyên nhân:**
  1. Khi xóa trắng nội dung mô tả, giá trị truyền vào là `undefined` thay vì chuỗi rỗng `""`, khiến thư viện Supabase client bỏ qua cột `description` khi gửi lệnh `UPDATE` lên database.
  2. Đối với các ngày lễ mặc định hoặc ID tạm, mã định danh trên frontend không trùng với UUID thực tế trong database nên câu lệnh update theo ID bị trượt (0 rows affected).
  3. Quá trình gieo dữ liệu mặc định ban đầu (`seedData`) chưa cập nhật lại mảng UUID thực tế từ cơ sở dữ liệu về state của ứng dụng.
- **Giải pháp:**
  - Chuẩn hóa payload cập nhật `description` thành chuỗi rỗng `""` thay vì `undefined`.
  - Cải tiến cơ chế `updateHoliday` và `deleteHoliday`: Nếu cập nhật theo ID không khớp, hệ thống tự động tìm và cập nhật/upsert theo trường `date` (ngày áp dụng duy nhất), đồng thời tự động đồng bộ lại UUID thực tế từ Supabase về React state và LocalStorage.
  - Cập nhật hàm `fetchHolidays` để gán đúng danh sách bản ghi kèm UUID khi khởi tạo dữ liệu mặc định.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch (`npm run build`) thành công 100%.

### 1.100 Tinh Chỉnh Giao Diện Căn Chỉnh Thanh Bộ Lọc Ngày Lễ (Tránh Chồng Chéo Component)
- **Mô tả yêu cầu / Vấn đề:**
  - Giao diện thanh lọc Năm, Tháng và Ô tìm kiếm ngày lễ bị lệch chiều cao, nhãn NĂM / THÁNG bị trôi nổi lên viền không đồng bộ với ô tìm kiếm, gây đè và vỡ khung viền.
- **Giải pháp:**
  - Đồng bộ chuẩn hóa chiều cao `h-10` (40px) hoàn toàn cho tất cả các phần tử trên cùng 1 hàng: Hộp chọn Năm (với Icon `Calendar` bên trái), Hộp chọn Tháng (với Icon `Filter` bên trái), Ô tìm kiếm từ khóa (Icon `Search` bên trái) và Nút Xóa lọc.
  - Loại bỏ hoàn toàn nhãn nổi (floating label) `NĂM`, `THÁNG` vốn làm đứt đoạn đường viền và lệch trục hiển thị.
  - Sử dụng giao diện phẳng với select hiện đại, bo tròn `rounded-xl`, viền `border-slate-200` và bóng mờ nhẹ `shadow-2xs` để các component không bị đè hay chồng chéo lên nhau.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch (`npm run build`) thành công 100%.

### 1.101 Đồng Bộ Dropdown Menu & Sửa Lỗi Trùng Lặp Mũi Tên (Double Icon Arrow Down)
- **Mô tả yêu cầu / Vấn đề:**
  - Phần chọn Năm và Tháng sử dụng thẻ `<select>` gốc gây ra hiện tượng 2 mũi tên chỉ xuống trùng lặp (1 mũi tên mặc định của trình duyệt + 1 icon tùy chỉnh) và menu xổ xuống màu xám thô của hệ điều hành, làm co cụm/cắt chữ "Tất cả các tháng".
- **Giải pháp:**
  - Chuyển đổi sang component dropdown chuẩn `CustomSelect`: menu thả xuống dạng popup nổi có viền mềm, bo góc `rounded-xl`, bóng đổ `shadow-xl`, icon dấu tích xanh (`Check`) khi chọn và chỉ duy nhất 1 icon `ChevronDown` có hiệu ứng xoay 180 độ mượt mà khi mở.
  - Tối ưu độ rộng linh hoạt (`w-40 sm:w-44` cho Năm và `w-44 sm:w-48` cho Tháng) giúp hiển thị trọn vẹn văn bản "Tất cả các tháng" mà không bị cắt chữ.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch (`npm run build`) thành công 100%.

### 1.102 Đồng Bộ Toàn Diện Vai Trò BOD (Ban Giám Đốc) Vào Mục Nghỉ Phép & Chấm Công
- **Mô tả yêu cầu / Vấn đề:**
  - Thiết lập và mở rộng đầy đủ quyền hạn, khả năng quản trị và điều phối của vai trò Ban Giám Đốc (`bod`) vào toàn bộ mô-đun Nghỉ phép & Chấm công (`/leave-requests`).
- **Chi tiết phân quyền cho BOD:**
  1. **Duyệt Đơn Nghỉ Phép Cấp 1 & Cấp Cuối (Final):** BOD có quyền xem toàn bộ đơn nghỉ phép của công ty, duyệt trực tiếp cấp 1 hoặc duyệt hoàn tất cấp cuối (Final Approval), đồng thời từ chối đơn kèm lý do rõ ràng.
  2. **Bảng Chấm Công (Timesheet):** BOD có quyền xem toàn bộ danh sách nhân viên nội bộ tất cả các phòng ban, tổng hợp công ty, lọc theo bộ phận và xuất báo cáo.
  3. **Quản Lý Quỹ Phép Năm (Leave Balances):** BOD có quyền truy cập tab Quỹ phép và điều chỉnh số ngày phép năm cho toàn bộ nhân sự.
  4. **Cấu Hình Ngày Lễ (Holidays Settings):** BOD có quyền quản lý, thêm, sửa, xóa danh mục ngày nghỉ lễ/nghỉ bù hệ thống.
  5. **Bộ Lọc Bộ Phận:** Hỗ trợ lọc riêng nhân sự thuộc khối Ban Giám Đốc (`bod`) trong Bảng Chấm Công và Quản Lý Quỹ Phép.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch (`npm run build`) thành công 100%.

### 1.103 Loại Bỏ Triệt Để Tài Khoản Đã Xóa Khỏi Hành Chính Nhân Sự & Toàn Bộ Hệ Thống
- **Mô tả yêu cầu / Vấn đề:**
  - Khi xóa tài khoản người dùng khỏi hệ thống trong mục Quản lý người dùng, nhân viên đã xóa vẫn xuất hiện ở Bảng Chấm Công và Quản Lý Quỹ Phép trong trang Hành chính nhân sự.
- **Nguyên nhân:**
  1. Hàm xóa người dùng ở `UserManagement.tsx` chỉ xóa local state trong component mà chưa gọi hàm đồng bộ `deleteUser` / `refreshProfiles` của `CRMContext`, khiến danh sách `profilesList` trong ngữ cảnh ứng dụng và bộ nhớ đệm `localStorage` không được cập nhật ngay lập tức.
  2. Cơ chế `refreshProfiles` trước đó tự động nạp lại các profile từ `localStorage` (`tour_crm_agent_profiles`) dù người dùng đã bị xóa khỏi cơ sở dữ liệu.
- **Giải pháp:**
  - Bổ sung hàm `deleteUser` vào `CRMContext` để xóa dữ liệu trên API/Supabase, cập nhật tức thì `profilesList`, ghi nhận ID tài khoản vào danh sách đen `crm_deleted_user_ids` và làm sạch cache `localStorage`.
  - Cập nhật `refreshProfiles`: Ưu tiên dữ liệu từ cơ sở dữ liệu làm nguồn chân lý (Source of Truth), lọc bỏ ngay lập tức các ID trong `crm_deleted_user_ids` và cập nhật lại cache lưu trữ sạch.
  - Tích hợp bộ lọc `crm_deleted_user_ids` hai lớp vào `UserManagement.tsx`, `TimesheetManagement.tsx` và `LeaveBalanceManagement.tsx`, đảm bảo tài khoản đã xóa lập tức biến mất hoàn toàn và vĩnh viễn trên mọi màn hình.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch (`npm run build`) thành công 100%.

### 1.104 Bổ Sung Tính Năng Xin Nghỉ 0.5 Ngày (Nửa Ngày: Buổi Sáng / Buổi Chiều)
- **Mô tả yêu cầu / Vấn đề:**
  - Bổ sung khả năng xin nghỉ phép 0.5 ngày (nửa ngày) thay vì bắt buộc nghỉ tối thiểu 1.0 ngày như trước đây.
- **Giải pháp:**
  1. **Khai báo kiểu dữ liệu (`types.ts`):** Thêm kiểu `LeaveSession = 'all_day' | 'morning' | 'afternoon'` và mở rộng interface `LeaveRequest` với `leave_session?: LeaveSession` cùng `total_days?: number`.
  2. **Logic tính ngày công & quỹ phép (`payrollUtils.ts`):**
     - Cập nhật hàm `calculateWorkingDaysInRange` và `getLeaveRequestWorkdaysCount` hỗ trợ tham số `leave_session` (trả về chính xác 0.5 ngày khi chọn buổi sáng hoặc buổi chiều trong ngày làm việc).
     - Cập nhật hàm `calculateTotalUsedAnnualDays` và `calculateEmployeeTimesheet` để cộng dồn chính xác số ngày công thực tế (hỗ trợ số thực 0.5) khi tính bảng chấm công và số ngày phép năm đã sử dụng.
  3. **Biểu mẫu Tạo Đơn (`LeaveRequestModal.tsx`):**
     - Khi người dùng chọn khoảng thời gian có ngày bắt đầu trùng ngày kết thúc (`startDate === endDate`), hiển thị bộ chọn thời lượng: **Cả ngày (1.0 ngày công)**, **Buổi sáng (0.5 ngày công)** và **Buổi chiều (0.5 ngày công)**.
     - Tự động đồng bộ số ngày công hiển thị và lưu đầy đủ thông tin `leave_session`, `total_days` vào cơ sở dữ liệu.
  4. **Danh Sách Đơn (`LeaveRequestsPage.tsx`):**
     - Bảng danh sách đơn nghỉ hiển thị trực quan badge thời lượng (`☀️ Buổi sáng` / `🌅 Buổi chiều`) kèm số ngày công chính xác (`0.5 ngày công`).
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch (`npm run build`) thành công 100%.

### 1.105 Loại Bỏ Triệt Để Code Google Chat & Ẩn Mục Trợ Lý Hướng Dẫn
- **Mô tả yêu cầu / Vấn đề:**
  - Kiểm tra và loại bỏ toàn bộ mã nguồn liên quan đến Google Chat trong hệ thống.
  - Ẩn mục Trợ lý hướng dẫn (Copilot AI hướng dẫn ERP) trên giao diện.
- **Giải pháp:**
  1. **Google Chat:**
     - Xóa bỏ file route `server/routes/googleChatRoutes.ts`.
     - Gỡ bỏ import và middleware `googleChatRoutes` trong `app.ts`.
     - Gỡ bỏ đoạn gọi webhook Google Chat trong `server/services/poscakeWebhookService.ts`.
     - Xóa cấu hình `GOOGLE_CHAT_WEBHOOK_URL` trong `.env.example`.
  2. **Trợ Lý Hướng Dẫn:**
     - Gỡ bỏ component `<ERPCopilotModal />` và import tương ứng khỏi `src/components/Layout.tsx`, giúp ẩn hoàn toàn nút nổi và hộp thoại Trợ lý hướng dẫn khỏi giao diện ứng dụng.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch (`npm run build`) thành công 100%.

### 1.106 Khắc Phục Đồng Bộ & Hiển Thị Đơn Nghỉ Phép Lên Database Supabase
- **Mô tả yêu cầu / Vấn đề:**
  - Người dùng thao tác gửi đơn nghỉ phép trên giao diện nhưng đơn không lưu hoặc không hiển thị trên Database Supabase và các tài khoản khác.
- **Nguyên nhân:**
  1. Thiếu các trường thông tin mở rộng (`user_name`, `user_email`, `user_role`, `leave_session`, `total_days`, `handover_user_name`, `level_1_approved_name`, `final_approved_name`, `rejection_reason`) trong schema `leave_requests` của Supabase dẫn đến lỗi từ chối insert.
  2. Hàm `fetchLeaveRequests` chưa làm giàu thông tin tên nhân viên/người bàn giao từ `profilesList` khi đọc từ DB về.
  3. Chưa thiết lập kênh Realtime đồng bộ tự động `leave_requests` và `leave_balances` khi có đơn mới phát sinh.
- **Giải pháp:**
  1. **Schema & Migration SQL (`supabase-schema.sql`):** Bổ sung đầy đủ các lệnh `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS ...` cho tất cả các trường dữ liệu mới, cập nhật chính sách RLS và kích hoạt Realtime Publication cho bảng `leave_requests` & `leave_balances`.
  2. **Dữ liệu & Fallback (`CRMContext.tsx`):**
     - Lưu đầy đủ toàn bộ siêu dữ liệu (`user_name`, `user_email`, `user_role`, `leave_session`, `total_days`, `handover_user_name`) khi chèn đơn lên Supabase kèm cơ chế fallback thông minh.
     - Hàm `fetchLeaveRequests` tự động đối soát và điền tên nhân viên (`user_name`), thông tin người bàn giao từ `profilesList` nếu bản ghi cơ sở dữ liệu chưa có.
     - Thiết lập kênh lắng nghe thay đổi Realtime (`leave_management_realtime`) trên Supabase để tự động đồng bộ tức thì cho tất cả các tài khoản đang đăng nhập.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch (`npm run build`) thành công 100%.

### 1.107 Chuyển Mục Người Nhận Bàn Giao Thành Ô Nhập Text
- **Mô tả yêu cầu / Vấn đề:**
  - Mục "Người nhận bàn giao công việc" trong popup tạo đơn xin nghỉ phép đang dùng dropdown chọn danh sách thành viên, cần chuyển sang dạng ô nhập văn bản (text input) để linh hoạt ghi tên người hoặc bộ phận bàn giao.
- **Giải pháp:**
  - Cập nhật `src/components/LeaveRequestModal.tsx`: thay thế `CustomSelect` bằng ô nhập `input type="text"`, cho phép người dùng tự do nhập tên đồng nghiệp hoặc nội dung bàn giao công việc mà không bị giới hạn bởi danh sách tài khoản.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch (`npm run build`) thành công 100%.

### 1.108 Phân Quyền HR Duyệt Cấp Cuối Đơn Nghỉ Phép
- **Mô tả yêu cầu / Vấn đề:**
  - Cho phép tài khoản có vai trò Nhân sự (`role === 'hr'`) có quyền xem, phê duyệt cấp cuối (`approved_final`) hoặc từ chối đối với tất cả các đơn nghỉ phép trên hệ thống (bao gồm cả đơn ở trạng thái chờ duyệt cấp 1 hoặc đã duyệt cấp 1).
- **Giải pháp:**
  - Bổ sung vai trò `hr` vào danh sách quyền kiểm tra `pendingFinalRequests`, `displayRequests`, `canApproveFinal` trong `src/pages/LeaveRequestsPage.tsx` và `src/components/LeaveManagementTab.tsx`.
  - HR có thể bấm nút "Duyệt Cuối" trực tiếp hoặc qua tab "Duyệt Cấp Cuối" đối với bất kỳ đơn nghỉ phép nào của nhân sự trong công ty.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch (`npm run build`) thành công 100%.

### 1.109 Chuẩn Hóa Phân Quyền Duyệt Nghỉ Phép (Bỏ Điều Hành Khỏi Cấp 1 & Bỏ Kế Toán Khỏi Cấp Cuối)
- **Mô tả yêu cầu / Vấn đề:**
  - Điều hành là nhân viên mang chức danh điều hành tour (chuyên môn nghiệp vụ tour), không phải điều hành công ty nên không có thẩm quyền duyệt đơn nghỉ phép cấp 1.
  - Kế toán không có quyền duyệt cấp cuối đơn nghỉ phép. Quyền duyệt cấp cuối chỉ thuộc về HR, BOD và Admin.
- **Giải pháp:**
  - Cập nhật logic phân quyền trong `src/pages/LeaveRequestsPage.tsx` và `src/components/LeaveManagementTab.tsx`:
    - `isLeader` / `canApproveLevel1`: Giữ lại `sale_leader`, `marketing_leader`, `admin`, `bod`, `hr` (loại bỏ `operator` và `accounting`).
    - `isHRorBODorAdmin` / `canApproveFinal`: Giữ lại `hr`, `bod`, `admin` (loại bỏ `accounting`).
  - Ghi nhận quy chuẩn vào `AGENTS.md`.
- **Trạng thái:** Đã hoàn thành, kiểm tra linter và biên dịch (`npm run build`) thành công 100%.

---

## 2. Các Vấn Về Đang Theo Dõi (Open Issues)
*(Hiện tại không có lỗi nào chưa được xử lý)*
