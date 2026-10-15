# Kế Hoạch Triển Khai: Đồng Bộ Mã Lịch Trình CRM Sang Sản Phẩm SKU Tour Trên Website WooCommerce

## 1. Bối Cảnh & Mục Tiêu Nghiệp Vụ
- **Website WooCommerce:** Mỗi sản phẩm tour đại diện cho một chương trình tour tổng thể, sở hữu một mã **SKU** (hoặc ID sản phẩm) duy nhất (ví dụ: `AD-US-01` - *Tour Bờ Tây Hoa Kỳ 8N7Đ*). Trong sản phẩm đó chứa một danh sách (ACF Repeater) gồm nhiều ngày/đợt khởi hành khác nhau.
- **Hệ thống Tour CRM:** Mỗi bản ghi trong danh sách tour là một **đợt khởi hành cụ thể** gắn với một **Mã lịch trình** độc lập (ví dụ: `AD-US-01-201026`, `AD-US-01-151126`).
- **Mục tiêu giải pháp:**
  1. **Khớp nối bằng tiền tố:** Tự động nhận diện SKU sản phẩm trên web bằng tiền tố của mã lịch trình CRM (hoặc qua cấu hình SKU sản phẩm mẹ).
  2. **Đồng bộ vào ACF Repeater:** Khi đồng bộ một mã lịch trình từ CRM lên Web, hệ thống tìm sản phẩm theo SKU. Nếu đợt khởi hành với mã lịch trình hoặc ngày khởi hành đó đã tồn tại trong ACF thì cập nhật thông tin (ngày đi, ngày về, giá người lớn/trẻ em, số chỗ trống); nếu chưa có thì tự động thêm dòng mới vào bảng ACF.
  3. **Tự động cộng dồn chỗ trống (Inventory/Stock):** Cập nhật tổng số chỗ trống của sản phẩm WooCommerce bằng tổng các đợt khởi hành còn khả dụng.
  4. **Xử lý khi chưa có SKU trên Web:** Hiển thị rõ ràng trên Modal đồng bộ (`BulkSyncWooCommerceModal` / `SyncTourToWooCommerceModal`) với badge trạng thái cảnh báo, cho phép người dùng bấm chọn ghép nối nhanh với một sản phẩm trên Web hoặc bấm tạo sản phẩm SKU mới trên Web.

---

## 2. Thiết Kế Kỹ Thuật Chi Tiết

### 2.1. Quy Tắc Khớp Tiền Tố Mã Lịch Trình Với SKU (Prefix Matching Rule)
- Thuật toán xác định SKU từ Mã lịch trình CRM:
  - Nếu mã lịch trình có định dạng phân tách (ví dụ `AD-US01-20261015` hoặc `AD_US01_1026`), hệ thống trích xuất phần tiền tố trước dấu gạch nối cuối cùng (`AD-US01`).
  - Hệ thống so khớp với danh sách SKU sản phẩm WooCommerce đã tải về từ API `/wp-json/wc/v3/products`.
  - Ngoài ra, ưu tiên so khớp chính xác:
    1. Trực tiếp theo `wp_product_id` (nếu tour đã từng được liên kết trước đó).
    2. SKU sản phẩm WooCommerce trùng khớp với tiền tố của `tour_code`.
    3. Mã lịch trình `tour_code` nằm trong danh sách ACF đợt khởi hành của sản phẩm.
    4. Gợi ý so khớp theo tên chương trình tour tương tự.

### 2.2. Cơ Chế Cập Nhật ACF Repeater & Tổng Chỗ Trống (`woocommerceService.ts`)
- **Đọc cấu hình trường ACF:**
  - Lấy trường cấu hình Repeater lịch khởi hành từ `woocommerce_configs.field_mappings` (mặc định: `lich_khoi_hanh` hoặc `departures_schedule`).
  - Các sub-field trong mỗi đợt:
    + `ma_lich_trinh` / `tour_code`: Mã lịch trình CRM.
    + `ngay_khoi_hanh` / `start_date`: Ngày bắt đầu (`dd/mm/yyyy` hoặc `YYYY-MM-DD`).
    + `ngay_ket_thuc` / `end_date`: Ngày kết thúc.
    + `gia_nguoi_lon` / `price_adult`: Giá người lớn.
    + `gia_tre_em` / `price_child`: Giá trẻ em.
    + `so_cho_trong` / `available_slots`: Số chỗ còn nhận.
    + `tinh_trang`: Tình trạng ('con_cho', 'het_cho', 'sap_khoi_hanh').
- **Logic xử lý mảng Repeater (Upsert logic):**
  - Đọc danh sách đợt khởi hành hiện có trên sản phẩm WordPress.
  - So khớp dòng hiện có theo `ma_lich_trinh` hoặc `ngay_khoi_hanh`.
  - Nếu đã có dòng khớp: Cập nhật đè thông tin mới nhất từ CRM vào dòng đó.
  - Nếu chưa có: `append` (thêm mới) dòng đợt khởi hành vào mảng ACF.
- **Tính tổng chỗ trống (Inventory Sync):**
  - Tính tổng `slots_available` từ các đợt khởi hành còn hạn trong bảng ACF.
  - Cập nhật trường `stock_quantity` của sản phẩm WooCommerce (nếu bật quản lý kho `manage_stock: true`).

### 2.3. Cải Tiến Giao Diện Modal Đồng Bộ (`BulkSyncWooCommerceModal.tsx` & `SyncTourToWooCommerceModal.tsx`)
- **Phân loại 3 nhóm trạng thái ghép nối trực quan:**
  1. **Đã khớp SKU (Badge xanh dương đậm):** Hiển thị `[Khớp SKU: AD-US01] -> Sản phẩm #ID - Tour Bờ Tây Hoa Kỳ`, hiển thị hành động: *"Cập nhật đợt vào ACF"*.
  2. **Đã liên kết cố định (Badge xanh lá):** Đã lưu `wp_product_id` trước đó.
  3. **Chưa có SKU tương ứng (Badge vàng cam):** Hiển thị cảnh báo `Chưa có sản phẩm SKU phù hợp trên Website`. Cung cấp 2 lựa chọn 1-click ngay trên dòng:
     - Nút *"Ghép nối với sản phẩm web"* (mở popover tìm kiếm nhanh mọi sản phẩm trên WooCommerce theo tên/SKU/ID).
     - Nút *"Tạo sản phẩm SKU mới"* (hệ thống sẽ tự động tạo sản phẩm WooCommerce mới với SKU là tiền tố mã lịch trình và đẩy đợt khởi hành đầu tiên vào).
- **Bộ lọc nhanh trên Modal:**
  - Lọc theo: "Tất cả", "Đã khớp SKU", "Cần ghép nối", "Đã liên kết".
  - Giúp điều hành viên/sale xử lý nhanh các tour chưa có SKU chỉ trong vài thao tác.

### 2.4. Cấu Hình Tùy Chọn Trong `WooCommerceSettingsSection.tsx`
- Bổ sung tùy chọn trong phần Cài đặt WooCommerce:
  - **Quy tắc trích xuất SKU:** Mặc định lấy tiền tố trước ký tự gạch nối cuối cùng (ví dụ: `PREFIX-XXXX`).
  - **Tên trường ACF Repeater & Sub-fields:** Cho phép tùy biến tên trường linh hoạt tương thích với mọi theme/ACF của WordPress (Hỗ trợ cấu hình mặc định sẵn cho các theme lữ hành phổ biến).

---

## 3. Các Bước Triển Khai Cụ Thể

1. **Bước 1: Cập nhật hàm xử lý tại Backend (`server/services/woocommerceService.ts`)**
   - Bổ sung logic tách tiền tố SKU từ `tour_code`.
   - Tìm sản phẩm theo SKU qua WooCommerce REST API (`/wp-json/wc/v3/products?sku=...`).
   - Xây dựng hàm `upsertDepartureToAcfRepeater()` xử lý cập nhật/thêm dòng đợt khởi hành và tính lại tổng số chỗ trống.
2. **Bước 2: Cập nhật Modal đồng bộ hàng loạt (`src/components/BulkSyncWooCommerceModal.tsx`)**
   - Bổ sung thuật toán auto-match bằng SKU prefix bên cạnh tên tour.
   - Thêm giao diện chọn ghép nối sản phẩm theo SKU hoặc tạo sản phẩm mới có SKU theo tiền tố.
   - Hiển thị nhãn rõ ràng: "Sẽ cập nhật vào đợt khởi hành ACF của Tour SKU: [Mã SKU]".
3. **Bước 3: Cập nhật Modal đồng bộ đơn lẻ (`src/components/SyncTourToWooCommerceModal.tsx`)**
   - Đồng bộ logic tách SKU và xem trước đợt khởi hành được đẩy lên sản phẩm mẹ.
4. **Bước 4: Cập nhật cấu hình tại `src/components/WooCommerceSettingsSection.tsx`**
   - Thêm hướng dẫn và cài đặt tùy chỉnh quy tắc tiền tố SKU nếu cần.
5. **Bước 5: Kiểm tra toàn diện & Build**
   - Chạy kiểm thử tự động, linter và build hệ thống để đảm bảo chất lượng.
   - Cập nhật nhật ký công việc vào `AGENTS.md` và `BUGS.md`.
