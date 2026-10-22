# Kế Hoạch Tự Động Lưu File Hợp Đồng Vào Google Drive (Thư Mục Booking)

## 1. Mục Tiêu & Cơ Chế Hoạt Động
Theo yêu cầu, hệ thống sẽ tự động tạo file hợp đồng chuẩn A4 và lưu trực tiếp vào **thư mục riêng của Booking đó trên Google Drive** ngay khi bấm **"In Hợp đồng"**, đồng thời tự động cập nhật đường dẫn `contract_url` vào đơn hàng trên hệ thống CRM để nhân viên có thể xem lại bất kỳ lúc nào.

---

## 2. Cấu Trúc Lưu Trữ Trên Google Drive
Hệ thống tận dụng kiến trúc thư mục đa tầng chuẩn hóa sẵn có của AD Luxury:
```text
Google Drive Gốc: [AD Luxury Travel]
 └── Tour/
      └── [Mã Tour]/ (Ví dụ: OBAU040726)
           └── Đơn hàng/
                └── [Mã Đơn Hàng]/ (Ví dụ: DH-040726-001 hoặc mã booking)
                     └── HopDong_[Mã Tour]_[Tên Khách]_[Mã Đơn].html (hoặc .pdf)
```

- **Quy chuẩn đặt tên file:** `HopDong_[MaTour]_[TenKhach]_[MaDon]` (ví dụ: `HopDong_OBAU040726_NguyenMinhTrucTien_DH-4C90F1D6.html`).
- **Nội dung file được lưu:** Đóng gói toàn bộ tài liệu hợp đồng chuẩn A4 đứng (Quốc hiệu, Tiêu ngữ, 12 Điều khoản, bảng kê chi phí, điều kiện hoãn hủy, chữ ký hai bên và phụ lục nếu có) kèm CSS độc lập, mở ra xem trực tiếp trên Google Drive sắc nét và có thể in ấn bất kỳ lúc nào.

---

## 3. Các Bước Triển Khai Kỹ Thuật

### A. Backend (`server/routes/uploadRoutes.ts` & `server/services/googleDriveService.ts`)
- Bổ sung / tối ưu endpoint chuyên dụng `/api/upload-contract` (hoặc tích hợp vào `/api/upload-invoice-receipt`):
  - Nhận file hợp đồng, `orderCode` (hoặc `orderId`) và `tourCode`.
  - Tự động tra cứu và điều hướng vào đúng thư mục đơn hàng Google Drive thông qua hàm `getOrCreateOrderFolderV2(tourCode, actualOrderCode, token)`.
  - Thiết lập quyền truy cập công khai/nội bộ (`makeFolderPublic`), trả về `webViewLink` chính thức của file trên Google Drive.
  - Tự động cập nhật trường `contract_url` của bảng `orders` (hoặc `bookings`) trong cơ sở dữ liệu Supabase.

### B. Frontend (`TourContractPrintModal.tsx`)
- **Tự động kích hoạt khi bấm "In Ngay / Xuất PDF":**
  - Mở hộp thoại in hệ thống `window.print()` như bình thường.
  - Đồng thời kích hoạt ngầm tiến trình đóng gói hợp đồng thành file tài liệu chuẩn A4.
  - Tự động đẩy file lên Google Drive qua API.
  - Hiển thị toast thông báo: *"Đang lưu hợp đồng vào Google Drive..."* ➔ *"Đã lưu hợp đồng vào thư mục Booking trên Google Drive thành công!"*.
- **Bổ sung nút bấm chủ động "Lưu vào Google Drive":**
  - Cho phép người dùng bấm lưu lại hợp đồng lên Google Drive bất kỳ lúc nào mà không nhất thiết phải in ra giấy.
- **Tự động đồng bộ State:**
  - Cập nhật trường `order.contract_url` thông qua context `useCRM().updateOrder`, giúp thanh trạng thái đơn hàng tại `/orders` lập tức hiển thị badge *"Đã tải hợp đồng"* kèm nút *"Xem file"* dẫn tới Google Drive.

---

## 4. Kế Hoạch Kiểm Thử & Xác Nhận
1. Chạy TypeScript lint (`npm run lint`) đảm bảo không phát sinh lỗi kiểu dữ liệu.
2. Chạy toàn bộ 69 Unit Tests (`npm test`).
3. Chạy 21 kịch bản Simulation Tests 4 vai trò (`npm run test:simulation`).
4. Chạy `compile_applet` kiểm tra bản build cuối cùng.
5. Cập nhật nhật ký kỹ thuật tại `BUGS.md` và `AGENTS.md`.
