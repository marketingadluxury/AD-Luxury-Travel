# Kế Hoạch Triển Khai: Đổi Tên Hệ Thống Sang AD OMS & Hoàn Tất Chỉnh Sửa Phiếu

## 1. Mục Tiêu & Phạm Vi
- **Đổi tên thương hiệu toàn hệ thống:** Chuyển đổi đồng bộ từ **Tour CRM** sang **AD OMS** (*AD Luxury Operating Management System*) theo đúng tùy chọn bạn đã xác nhận:
  - **Cụm Logo Sidebar & Mobile Drawer:** Dòng chính `AD OMS`, dòng phụ `Operating Management System`.
  - **Tiêu đề trình duyệt (HTML Title) & PWA:** `AD OMS - Operating Management System`.
  - **Phạm vi:** Đồng bộ trên toàn bộ thanh điều hướng, trang Đăng nhập, Thông báo đẩy Desktop, Trung tâm Tài liệu & Hướng dẫn (`/docs`), và cấu hình tên miền `oms.adluxury.net`.
- **Hoàn thiện tính năng chỉnh sửa Phiếu đề nghị thanh toán & Đơn nghỉ phép:** Cập nhật tiêu đề modal và nút xác nhận trên `PaymentProposals.tsx` khi mở ở chế độ chỉnh sửa để đồng bộ 100% với quyền chỉnh sửa của Leader và Admin.

---

## 2. Chi Tiết Các Hạng Mục Thay Đổi

### 2.1. Cấu hình HTML, PWA Manifest & Tên miền (`index.html`, `public/manifest.json`, `GoogleDriveSettingsSection.tsx`)
- **`index.html`:**
  - Cập nhật thẻ `<title>` thành `AD OMS - Operating Management System`.
  - Cập nhật `<meta name="apple-mobile-web-app-title" content="AD OMS" />` và các thẻ mô tả hệ thống.
- **`public/manifest.json`:**
  - Cập nhật `"short_name": "AD OMS"` và `"name": "AD OMS - Operating Management System"`.
- **`src/components/GoogleDriveSettingsSection.tsx`:**
  - Cập nhật URL callback sản phẩm mẫu sang tên miền mới `https://oms.adluxury.net/api/drive/oauth/callback`.

### 2.2. Thanh Điều Hướng Sidebar, Header, Mobile Drawer & Thông Báo (`src/components/Layout.tsx`, `src/utils/desktopNotification.ts`)
- **`src/components/Layout.tsx`:**
  - **Desktop Sidebar:** Đổi dòng chính thành `AD OMS` và dòng phụ thành `Operating Management System`.
  - **Mobile Drawer Header:** Đổi dòng chính thành `AD OMS` và dòng phụ thành `Operating Management System`.
  - **Top Header Fallback Title:** Đổi tiêu đề mặc định khi không khớp route từ `'Tour CRM'` thành `'AD OMS'`.
  - **Thông báo đẩy:** Đổi tiêu đề mặc định từ `'🔔 Thông báo từ Tour CRM'` sang `'🔔 Thông báo từ AD OMS'`.
- **`src/utils/desktopNotification.ts`:**
  - Cập nhật tiêu đề thông báo kiểm tra thành `'🔔 AD OMS - Kiểm Tra Thông Báo'` và nội dung chú thích hệ thống.

### 2.3. Trang Đăng Nhập & Trung Tâm Tài Liệu (`src/pages/Auth.tsx`, `src/pages/DocsPage.tsx`, `src/data/defaultDocs.ts`)
- **`src/pages/Auth.tsx`:**
  - Cập nhật khu vực giới thiệu bên trái màn hình đăng nhập: Hiển thị thương hiệu **AD OMS — AD Luxury Operating Management System**, mô tả hệ thống quản trị điều hành toàn diện và dòng bản quyền `© 2026 AD OMS - AD Luxury Travel`.
- **`src/pages/DocsPage.tsx` & `src/data/defaultDocs.ts`:**
  - Đổi nút quay lại ở góc trái từ `"Quay lại Tour CRM"` thành `"Quay lại AD OMS"` (mobile: `"OMS"`).
  - Đổi cụm thương hiệu trên thanh Header tài liệu từ `Tour CRM Docs` thành `AD OMS Docs`.
  - Đồng bộ tên gọi hệ thống trong bài viết giới thiệu tổng quan (`defaultDocs.ts`) sang **AD OMS (AD Luxury Operating Management System)**.

### 2.4. Hoàn Thiện Giao Diện Chỉnh Sửa Đề Nghị Thanh Toán (`src/pages/PaymentProposals.tsx`)
- Cập nhật tiêu đề Modal khi `editingProposal` tồn tại: Hiển thị `"Chỉnh Sửa Đề Nghị Thanh Toán"` thay vì `"Tạo Đề Nghị Thanh Toán Mới"`.
- Cập nhật nhãn nút lưu ở chân Modal khi đang chỉnh sửa: Hiển thị `"Lưu Cập Nhật"` thay vì `"Gửi Đề Nghị Thanh Toán"`.

---

## 3. Kiểm Thử & Xác Thực
1. Chạy kiểm tra biên dịch TypeScript và Linter để đảm bảo không phát sinh lỗi cú pháp.
2. Chạy bộ kiểm thử tự động để xác nhận toàn bộ nghiệp vụ tài chính, phân quyền và tích lũy phép năm hoạt động ổn định.
3. Cập nhật nhật ký hệ thống trong tài liệu dự án.
