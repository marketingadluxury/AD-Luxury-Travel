# Kế Hoạch Triển Khai: Modal Chọn & Ghép Nối Sản Phẩm Trước Khi Đồng Bộ Hàng Loạt Lên Website WooCommerce

## 1. Mục Tiêu & Yêu Cầu
- Khắc phục tình trạng khi bấm nút "Đồng bộ Website" (hoặc "Đồng bộ tất cả tour"), hệ thống tự động chạy ngầm mà không hiển thị danh sách sản phẩm để người dùng kiểm tra và lựa chọn trước.
- Xây dựng **Modal Đồng bộ Hàng loạt (`BulkSyncWooCommerceModal.tsx`)** với trải nghiệm chuyên nghiệp:
  1. Cho phép người dùng duyệt toàn bộ danh sách tour, có ô tìm kiếm, bộ lọc trạng thái và nút "Chọn tất cả / Bỏ chọn".
  2. Tự động tìm kiếm và gợi ý ghép nối sản phẩm trên website WooCommerce dựa trên tên tour hoặc mã tour.
  3. Cung cấp tính năng xem & đổi sản phẩm website liên kết (chọn sản phẩm có sẵn trên Web hoặc chọn "Tạo sản phẩm mới").
  4. Hiển thị tiến trình đồng bộ trực quan (% hoàn thành, số lượng thành công/thất bại, thông báo trạng thái từng tour).
  5. Tuân thủ 100% chuẩn giao diện: Không dùng native select/date, z-index phân tầng rõ ràng, không double icon, màu sắc đồng bộ hệ thống.

---

## 2. Các Bước Triển Khai Chi Tiết

### Bước 1: Xây Dựng Component `BulkSyncWooCommerceModal.tsx`
- **Giao diện Modal:**
  - Header: Tiêu đề "Đồng bộ hàng loạt Tour lên Website WooCommerce", hiển thị số lượng tour đã chọn.
  - Bộ lọc & Tìm kiếm: Thanh tìm kiếm theo tên/mã tour, checkbox "Chọn tất cả" / "Chỉ chọn tour đã kích hoạt".
  - Bảng danh sách Tour:
    - Cột 1: Checkbox chọn tour.
    - Cột 2: Thông tin Tour CRM (Mã tour, Tên tour, Giá, Lịch khởi hành).
    - Cột 3: Trạng thái ghép nối sản phẩm Website:
      + Đã có liên kết (hiển thị Tên & ID sản phẩm trên WP kèm nhãn xanh).
      + Tự động khớp theo tên (hiển thị sản phẩm gợi ý và nút xác nhận/đổi).
      + Chưa có sản phẩm trên WP (mặc định chọn "Tạo sản phẩm mới trên Website").
    - Cột 4: Nút "Đổi sản phẩm Website" (mở popup/dropdown tìm kiếm nhanh sản phẩm trên WooCommerce để ghép lại theo ý muốn).
  - Tùy chọn đồng bộ:
    - Bật/tắt cập nhật giá tour.
    - Bật/tắt cập nhật lịch khởi hành & chỗ trống.
    - Bật/tắt cập nhật nội dung lịch trình / chính sách tour.
  - Màn hình tiến trình đồng bộ (Syncing Progress):
    - Thanh Progress Bar hiển thị % tiến độ (`Đang đồng bộ 5/20 tour...`).
    - Danh sách kết quả chi tiết từng tour (Thành công / Lỗi / Bỏ qua) kèm nút Xem trên Web nếu thành công.

### Bước 2: Tối Ưu API Backend Xử Lý Đồng Bộ Danh Sách Tour
- Kiểm tra và cập nhật `server/routes/woocommerceRoutes.ts` và `server/services/woocommerceService.ts`:
  - Hỗ trợ endpoint `/api/woocommerce/sync-selected-tours` nhận danh sách mảng các tour cần đồng bộ kèm thông tin sản phẩm ghép nối (`tourId`, `targetWpPostId`, `syncOptions`).
  - Đảm bảo cơ chế tự động khớp: Tìm kiếm sản phẩm tương tự trên WooCommerce bằng tên tour trước khi đồng bộ.
  - Trả về kết quả chi tiết từng bản ghi để frontend cập nhật thanh tiến trình realtime.

### Bước 3: Tích Hợp Vào Giao Diện Quản Lý
- **Tại `src/pages/ToursManagement.tsx`:**
  - Thay thế hàm `handleBulkSyncToWooCommerce` (trước đây dùng `window.confirm`) thành mở Modal `BulkSyncWooCommerceModal`.
  - Cập nhật nút "Đồng bộ Website" trên thanh công cụ để kích hoạt Modal này.
- **Tại `src/components/WooCommerceSettingsSection.tsx`:**
  - Thay thế nút "Đồng bộ tất cả tour" để mở chung Modal `BulkSyncWooCommerceModal`, giúp đồng bộ trải nghiệm trên toàn hệ thống.

### Bước 4: Kiểm Thử & Tối Ưu (Quality Assurance)
- Kiểm tra tính tương thích dữ liệu: Tour đã có `woocommerce_product_id` trong CRM và tour hoàn toàn mới.
- Kiểm tra cơ chế tìm kiếm, tự động khớp tên tiếng Việt có dấu/không dấu.
- Kiểm tra giao diện trên mobile và desktop, đảm bảo không bị tràn viền, dropdown không bị cắt chữ.
- Chạy linter (`npm run lint`), build (`npm run build`) và unit test.

### Bước 5: Cập Nhật Tài Liệu & Ghi Nhận BUGS.md / AGENTS.md
- Ghi nhận đầy đủ tính năng Modal đồng bộ hàng loạt vào `BUGS.md` và `AGENTS.md`.

---

## 3. Thời Gian & Quy Trình Tiếp Theo
- Sau khi anh/chị xem và bấm nút **Proceed** (hoặc xác nhận), hệ thống sẽ tiến hành triển khai mã nguồn ngay lập tức theo đúng kế hoạch trên.
