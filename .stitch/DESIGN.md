# Tour CRM - Visual Design System & UI Specifications

Đây là tài liệu quy chuẩn Giao diện và Thiết kế (Design System) được trích xuất trực tiếp từ mã nguồn thực tế của dự án **Tour CRM (AD Luxury Travel)**.

---

## 🎨 1. Typography & Font System

- **Primary Font Family:** Plus Jakarta Sans (`"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`)
- **Font Weights:**
  - `font-medium` (500) — Nội dung thông thường, văn bản phụ.
  - `font-semibold` (600) — Nhãn form, tiêu đề phụ, dữ liệu quan trọng.
  - `font-bold` (700) — Nút bấm, giá tiền, tiêu đề thẻ, tên đối tác/khách hàng.
  - `font-extrabold` (800) — Trạng thái Badge, Mã đơn/Mã tour, Chỉ số KPI.

- **Scale & Hierarchy (Hệ thống Kích thước):**
  - **Hero Display / KPI Big Stats:** `text-2xl` đến `text-3xl` (`font-extrabold text-slate-900`)
  - **Section Titles / Card Headers:** `text-base` đến `text-lg` (`font-bold text-slate-900`)
  - **Body / Form Input Text:** `text-xs` (12px) đến `text-sm` (14px) (`text-slate-800`)
  - **Badges, Status Pills & Table Headers:** `text-[10px]` hoặc `text-xs` (`font-bold uppercase tracking-wider`)

---

## 🎨 2. Color Palette & Status Color Mapping

### 2.1 Core Neutral Palette
- **Canvas / Background:** `bg-slate-50` (Nền trang nhẹ nhàng, mắt dịu)
- **Card Background:** `bg-white` với viền `border-slate-200/80`
- **Dark Elements / Sidebar:** `bg-slate-900` hoặc `bg-slate-950`
- **Text Main:** `text-slate-900`
- **Text Muted / Label:** `text-slate-500` hoặc `text-slate-600`

### 2.2 Status Badges (Hệ thống Màu Trạng Thái)
Mọi trạng thái trong hệ thống được quy định đồng bộ dạng Pill Badge (`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border`):

| Trạng Thái (Status) | Lớp Tailwind CSS (Color Theme) | Ý Nghĩa Sử Dụng |
| :--- | :--- | :--- |
| **HOLD (Giữ chỗ tạm)** | `bg-amber-50 text-amber-800 border-amber-200` | Đơn hàng đang giữ chỗ tạm thời |
| **SURE (Đã cọc / Chốt)** | `bg-emerald-50 text-emerald-800 border-emerald-200` | Đơn hàng đã chắc chắn/đã thanh toán |
| **👑 TOUR ĐOÀN RIÊNG** | `bg-amber-50 text-amber-800 border-amber-200` | Tour chạy theo hợp đồng riêng |
| **PAID / APPROVED** | `bg-emerald-50 text-emerald-800 border-emerald-200` | Đã duyệt phiếu / Đã thanh toán đủ |
| **UNPAID / PENDING** | `bg-blue-50 text-blue-800 border-blue-200` | Chờ thanh toán / Chờ duyệt |
| **PARTIALLY PAID** | `bg-indigo-50 text-indigo-800 border-indigo-200` | Đã cọc/thanh toán một phần |
| **CANCELLED / REJECTED** | `bg-rose-50 text-rose-700 border-rose-200` | Đã hủy đơn / Từ chối duyệt |

---

## 🛠️ 3. Components & UI Patterns

### 3.1 Button Hierarchy (Thứ tự Nút Bấm)
- **Primary Action (Hành động chính):**
  - Lớp: `bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center gap-2`
- **Secondary / Cancel Action (Hành động phụ / Hủy):**
  - Lớp: `bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2`
- **Danger Action (Xóa / Nguy hiểm):**
  - Lớp: `bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-2`

### 3.2 Form Inputs & Controls
- **Input text / Number:**
  - Lớp: `px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white`
  - *Lưu ý:* Các ô nhập số phải luôn phân tách hàng nghìn bằng dấu chấm (phù hợp chuẩn tiền tệ Việt Nam).
- **Select Dropdown:**
  - Sử dụng biểu tượng Chevron mũi tên xuống tùy chỉnh (`appearance-none` kết hợp CSS background SVG trong `index.css`).

### 3.3 Modal Popups & Confirmations
- **Overlay backdrop:** `fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn`
- **Container:** `bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-scaleUp`
- *Lưu ý:* Tuyệt đối KHÔNG sử dụng `confirm()` mặc định của trình duyệt để tránh bị chặn trong môi trường iFrame. Luôn sử dụng Modal React chuẩn.

### 3.4 Data Tables & Scrollbars
- **Table Container:** `overflow-x-auto custom-scrollbar border border-slate-200/80 rounded-2xl bg-white shadow-sm`
- **Table Header:** `bg-slate-100/80 text-slate-700 text-xs font-bold uppercase tracking-wider p-3 text-left`
- **Table Row Hover:** `hover:bg-slate-50/80 transition-colors border-b border-slate-100`

---

## 📐 4. Spacing & Layout Rules

- **Container Radius:** `rounded-2xl` (16px) cho Cards, Modals và Tables.
- **Control Radius:** `rounded-xl` (12px) cho Buttons và Form Inputs.
- **Badge Radius:** `rounded-full` (9999px) cho Status Pills.
- **Custom Scrollbar:** Độ rộng/cao 6px với thumb màu Slate (`#cbd5e1`).
