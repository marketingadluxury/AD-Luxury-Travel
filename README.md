# Tour CRM - Hệ Thống Quản Lý Công Ty Du Lịch (AD Luxury Travel)

Hệ thống Quản lý Tour du lịch, Đại lý, Visa, Hành khách và Kế toán chuyên sâu thiết kế riêng cho công ty du lịch lữ hành.

---

## 🎯 Mục Đích Dự Án & Mục Tiêu Cốt Lõi (Purpose & Core Goals)

Tour CRM giải quyết toàn bộ quy trình vận hành du lịch lữ hành đa kênh:
1. **Quản lý Lịch Khởi Hành & Giữ Chỗ (Inventory & Bookings):**
   - Theo dõi thời gian thực số lượng chỗ khả dụng (slots_available), giữ chỗ tạm thời (HOLD với thời hạn gia hạn) và xác nhận cọc/sure chỗ (SURE).
   - Hỗ trợ 3 phân loại sản phẩm tour: **Tour tự vận hành (Internal)**, **Tour gửi khách đối tác (Partner/Outsourced)**, và **Tour đoàn riêng (Private)**.
2. **Kinh Doanh & Mạng Lưới Đại Lý / Cộng Tác Viên (Sales & CTV Network):**
   - Hạch toán hoa hồng linh hoạt: Hoa hồng cố định theo pax + Giá chênh lệch (Markup) CTV tự nâng + Phí công ty thu (% trừ chênh lệch).
   - Tự động xếp hạng đại lý / CTV theo điểm doanh số (Bạc, Vàng, Kim Cương).
3. **Quản Lý Hồ Sơ Visa & Hành Khách (Visa & Passenger Profiles):**
   - Quản lý danh sách hành khách theo độ tuổi (Người lớn ≥10T, Trẻ em 2-10T, Trẻ nhỏ <2T), hộ chiếu, hạn hộ chiếu.
   - Theo dõi tiến độ duyệt Visa (Chưa nộp, Đã nộp, Đã đậu, Từ chối) và đính kèm tài liệu mẫu.
4. **Hạch Toán Tài Chính & Kế Toán Lữ Hành (Travel Financials & Accounting):**
   - Lập Đề nghị Thanh toán (DNTT) theo công thức mã `DNTT-mmyyyy-stt`.
   - Quản lý Thu/Chi, chứng từ hóa đơn, hạch toán Lãi/Lỗ theo từng Tour.
5. **Lưu Trữ Ảnh Đoàn & Tích Hợp Google Drive / Supabase Storage:**
   - Tự động phân loại thư mục lưu trữ theo công thức: `AD Luxury Travel > Tour > {MÃ_TOUR}` và `AD Luxury Travel > Đơn hàng > {SỐ_HỘ_CHIẾU}`.

---

## 📁 Các File Cốt Lõi Trong Mã Nguồn (Critical Files)

| File / Đường Dẫn | Vai Trò & Chức Năng |
| :--- | :--- |
| `server.ts` | Backend Express server xử lý upload/delete file lên Google Drive API và Supabase Storage fallback. |
| `supabase-schema.sql` | Khởi tạo cấu trúc Database PostgreSQL, RLS Policies, triggers đồng bộ `auth.users` -> `profiles`. |
| `src/context/CRMContext.tsx` | "Bộ não" quản lý toàn bộ State CRM (Offline-first, CRUD Tour, Order, Surcharge, Passenger, Payment). |
| `src/context/AuthContext.tsx` | Quản lý xác thực Supabase Auth và phân quyền người dùng theo 8 vai trò (Admin, Sale, Sale Leader, Operator, Accounting, Visa, CTV, BOD, HDV). |
| `src/types.ts` | Định nghĩa toàn bộ TypeScript Interfaces (`Tour`, `Order`, `Passenger`, `Invoice`, `TourMedia`, `UserRole`). |
| `src/pages/DepartureCalendar.tsx` | Trang Lịch khởi hành trực quan, lọc theo danh mục, hiển thị tình trạng chỗ và nút đặt giữ chỗ. |
| `src/pages/ToursManagement.tsx` | Quản lý danh mục Tour, tạo Tour mới, thiết lập biểu giá chi tiết, tạo Tour đoàn riêng. |
| `src/pages/OrdersManagement.tsx` | Quản lý đơn hàng Booking, trạng thái HOLD/SURE, tính hoa hồng CTV, phụ thu và gia hạn giữ chỗ. |
| `src/pages/AccountingInvoice.tsx` | Quản lý phiếu thu, phiếu chi, duyệt Đề nghị thanh toán (DNTT) và báo cáo tài chính lữ hành. |
| `src/pages/VisaServices.tsx` & `VisaProcessing.tsx` | Quản lý dịch vụ Visa lẻ và quy trình xử lý duyệt visa hành khách. |
| `src/pages/TourMediaManagement.tsx` | Quản lý Album ảnh kỷ niệm đoàn của HDV và liên kết thư mục Google Drive. |
| `src/pages/CustomersManagement.tsx` | Quản lý mạng lưới Đại lý & CTV kèm phân hạng thành viên. |
| `src/components/DatePicker.tsx` | Bộ chọn ngày chuẩn hóa Tiếng Việt hỗ trợ hiển thị `hh:mm dd/mm/yyyy`. |

---

## 🎨 Bản Bản Bản Nhận Diện Giao Diện (Visual Identity & Design System)

- **Bảng Màu Chủ Đạo (Color Palette):**
  - Neutral Base: Slate/Gray canvas sáng cao cấp (`bg-slate-50`, `bg-white`, `border-slate-200`).
  - Primary Brand: Blue/Indigo (`bg-blue-600`, `text-indigo-600`) cho hành động chính và chuyển hướng.
  - Status Indicators:
    - **HOLD / Giữ chỗ:** Amber (`bg-amber-50 text-amber-800 border-amber-200`).
    - **SURE / Đã cọc / Đã duyệt:** Emerald (`bg-emerald-50 text-emerald-800 border-emerald-200`).
    - **Tour Đoàn Riêng:** Amber Gold (`bg-amber-100 text-amber-900 border-amber-300`).
    - **Hủy / Cảnh báo:** Rose (`bg-rose-50 text-rose-700 border-rose-200`).
- **Typography & Font:**
  - Font chuẩn sans-serif hiện đại, cỡ chữ linh hoạt từ `text-xs` (12px) đến `text-lg` (18px) cho tiêu đề.
- **Quy Tắc Định Dạng:**
  - Thời gian: `hh:mm dd/mm/yyyy` hoặc `dd/mm/yyyy`.
  - Tiền tệ: Phân tách hàng nghìn chuẩn Việt Nam (vd: `100.000.000 VND`).

---

## 🚀 Hướng Dẫn Chạy Cục Bộ (Run Locally)

1. **Cài đặt thư viện dependencies:**
   ```bash
   npm install
   ```
2. **Cấu hình file môi trường `.env`:**
   Copy file `.env.example` thành `.env` và điền thông số Supabase:
   ```env
   VITE_SUPABASE_URL="https://your-supabase-project.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
   ```
3. **Khởi chạy Development Server:**
   ```bash
   npm run dev
   ```
   Ứng dụng sẽ chạy tại địa chỉ: `http://localhost:3000`.
