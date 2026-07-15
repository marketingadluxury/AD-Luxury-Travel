# Tour CRM - Bộ Não Dự Án (Project Brain & Instructions)

Tài liệu này lưu trữ toàn bộ thông tin cốt lõi, quy tắc phát triển, cấu trúc dữ liệu và các lưu ý quan trọng của dự án **Tour CRM - Quản lý Công ty Du lịch**. File này được hệ thống AI tự động đọc để đảm bảo tính nhất quán và hiểu sâu sắc về dự án trong mọi phiên làm việc tiếp theo.

---

## 1. Thông Tin Tổng Quan Dự Án
- **Tên ứng dụng:** Tour CRM - Quản lý cty du lịch
- **Mô tả:** Hệ thống quản lý Tour du lịch, Đại lý, Visa và Kế toán dành cho công ty du lịch lữ hành.
- **Công nghệ chính:**
  - **Frontend:** React 19, Vite, Tailwind CSS, Lucide-React, Motion (Framer Motion).
  - **Backend & Database:** Supabase (PostgreSQL, Auth, Storage).
  - **Môi trường Deploy:** GitHub + Vercel (Frontend), Supabase (Database & Storage).

---

## 2. Quy Tắc Hoạt Động & Giao Tiếp (Bắt Buộc)
- **Ngôn ngữ giao tiếp:** Luôn luôn phản hồi bằng **Tiếng Việt**.
- **Quy trình thay đổi logic:** Trước khi thực hiện bất kỳ thay đổi nào về logic hệ thống, cấu trúc database, hoặc tính năng chính, **PHẢI** giải thích chi tiết giải pháp cho người dùng và chỉ thực hiện sau khi có sự xác nhận của người dùng.
- **Quản lý File & Storage:** 
  - **TẤT CẢ** các file tải lên (hình ảnh, tài liệu, file visa, hộ chiếu, hóa đơn...) **phải luôn được lưu vào Supabase Storage**.
  - **Chỉ** lưu thông tin text, đường dẫn liên kết (URL của file từ Storage) và siêu dữ liệu (metadata) vào các bảng (table) trong database. Không lưu trữ file trực tiếp hay dạng base64 trong database.

---

## 3. Cấu Hình Tài Khoản Quản Trị Viên (Admin)
- Các email sau đây được cấu hình mặc định làm **Quản trị viên (Admin)** tối cao của hệ thống:
  1. `marketing@adluxury.net`
  2. `marketing.adluxury@gmail.com`
- **Cơ chế hoạt động:**
  - Khi người dùng đăng ký hoặc đăng nhập lần đầu bằng các email này, hệ thống sẽ tự động gán/cập nhật vai trò (role) thành `admin` thông qua cả Trigger trong database (`supabase-schema.sql`) và kiểm tra logic ở Client (`AuthContext.tsx`).

---

## 4. Cấu Trúc Database Supabase (Schema)
Dưới đây là cấu trúc các bảng chính cần thiết đã được định nghĩa trong file `supabase-schema.sql`:

### 4.1 Bảng `profiles` (Thông tin người dùng & phân quyền)
- `id` (uuid, primary key, tham chiếu `auth.users.id`)
- `full_name` (text)
- `phone` (text)
- `company_name` (text)
- `role` (text: 'admin', 'sales', 'operating', 'accounting', 'agency', 'collaborator', 'CTV')
- `created_at` (timestamp)

### 4.2 Bảng `tours` (Danh sách Tour du lịch & Lịch khởi hành)
- `id` (uuid, primary key)
- `title` (text)
- `tour_code` (text, unique)
- `start_date` (date)
- `end_date` (date)
- `price_adult` (numeric)
- `price_child` (numeric)
- `slots_total` (integer)
- `slots_available` (integer)
- `status` (text: 'upcoming', 'active', 'completed', 'cancelled')
- `created_at` (timestamp)

### 4.3 Bảng `orders` (Quản lý Booking / Đơn hàng Tour)
- `id` (uuid, primary key)
- `tour_id` (uuid, tham chiếu `tours.id`)
- `created_by` (uuid, tham chiếu `profiles.id`)
- `customer_name` (text)
- `customer_phone` (text)
- `customer_email` (text)
- `adult_count` (integer)
- `child_count` (integer)
- `total_price` (numeric)
- `payment_status` (text: 'unpaid', 'partially_paid', 'paid')
- `booking_status` (text: 'pending', 'confirmed', 'cancelled')
- `created_at` (timestamp)

### 4.4 Bảng `passengers` (Danh sách hành khách tham gia Tour)
- `id` (uuid, primary key)
- `order_id` (uuid, tham chiếu `orders.id`)
- `full_name` (text)
- `gender` (text)
- `birthday` (date)
- `passport_number` (text)
- `passport_expiry` (date)
- `visa_status` (text: 'none', 'applied', 'approved', 'rejected')
- `visa_file_url` (text - link lưu trong Storage)
- `created_at` (timestamp)

### 4.5 Bảng `invoices` (Quản lý Thu/Chi & Kế toán)
- `id` (uuid, primary key)
- `order_id` (uuid, tham chiếu `orders.id`)
- `invoice_code` (text, unique)
- `type` (text: 'receipt' - phiếu thu, 'payment' - phiếu chi)
- `amount` (numeric)
- `payment_method` (text)
- `description` (text)
- `status` (text: 'pending', 'approved', 'rejected')
- `created_by` (uuid, tham chiếu `profiles.id`)
- `created_at` (timestamp)

---

## 5. Cấu Hình Supabase Storage (Yêu Cầu)
- **Bucket bắt buộc:** Tạo một bucket tên là `crm-attachments` hoặc các bucket tương ứng với mục đích để lưu trữ:
  - Tài liệu Visa (`visa_file_url` trong bảng hành khách).
  - Hóa đơn / Chứng từ thanh toán.
  - Tài liệu đính kèm khác.
- **Chính sách bảo mật (RLS) cho Storage:** Đảm bảo chỉ người dùng đã đăng nhập (authenticated) mới được tải lên và đọc tài liệu.

---

## 6. Hướng Dẫn Khởi Tạo Hệ Thống (Dành cho Lập trình viên)
1. **Thiết lập Database:** Copy toàn bộ nội dung trong file `supabase-schema.sql` chạy trong mục **SQL Editor** trên Dashboard của Supabase để khởi tạo tất cả các bảng, enum, trigger tự động đồng bộ tài khoản auth và profile.
2. **Thiết lập Biến Môi Trường:** Tạo file `.env` từ `.env.example` và điền thông tin kết nối Supabase của bạn:
   ```env
   VITE_SUPABASE_URL="https://your-project.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-key"
   ```
3. **Cập nhật và Phát triển:** 
   - Kiểm tra phân quyền phân vai trò người dùng trong `CRMContext.tsx`.
   - Luôn tuân thủ quy trình kiểm tra linter (`npm run lint`) và xây dựng (`npm run build`) trước khi commit code.

---

## 7. Quy Tắc Phân Quyền & Tính Năng Đặc Biệt (Cập Nhật Mới)
- **Quyền tạo Tour:** Chỉ có vai trò **Điều hành Tour (`operator`)** và **Quản trị viên (`admin`)** mới có quyền nhìn thấy và sử dụng tính năng **Tạo Tour mới**. Các vai trò khác (như Sale, CTV, Đại lý, Visa, Kế toán) sẽ không có quyền này.
- **Liên kết Tạo Tour & Lịch Khởi Hành:** Khi Quản trị viên hoặc Điều hành Tour bấm nút **"Tạo Tour mới"** tại trang *Lịch khởi hành*, hệ thống sẽ tự động điều hướng sang trang *Quản lý Tour*, kích hoạt form khai báo tour mới và cuộn màn hình mượt mà xuống biểu mẫu nhập liệu.
- **Chuyển Đổi Vai Trò Xem (Xem Thử Phân Quyền):** Chỉ các tài khoản có vai trò thật sự là `admin` trong bảng `profiles` hoặc các email Quản trị viên mặc định (`marketing@adluxury.net`, `marketing.adluxury@gmail.com`) mới có quyền thay đổi **"Vai trò đang xem"** thông qua hộp chọn (select) trên thanh Sidebar. Đối với các tài khoản vai trò khác, hộp chọn này sẽ bị khóa (`disabled`).
- **Tạo Danh Mục Sản Phẩm Mới Khi Tạo Tour:** Ngay tại form khai báo/cập nhật Tour du lịch mới, hệ thống cho phép tạo nhanh danh mục sản phẩm mới ngay lập tức mà không cần chuyển sang tab danh mục riêng biệt. Khi tạo thành công, danh mục này sẽ tự động được chọn làm danh mục hiện tại cho Tour đó.
- **Tự Động Đồng Bộ Bộ Lọc Danh Mục:** Bộ lọc danh mục sản phẩm tại trang *Lịch khởi hành* (Departure Calendar) tự động cập nhật danh sách và thêm danh mục mới ngay khi có bất kỳ danh mục nào được khởi tạo thêm (từ tab Danh mục hoặc trực tiếp từ biểu mẫu Tạo Tour).

---

## 8. Tích hợp Lưu Trữ Google Drive (Mới)
- **Cơ chế hoạt động (Bảo mật ở Backend):**
  - Hệ thống tích hợp Google Drive hoàn toàn ở phía **Backend** để thay thế cho bộ nhớ Supabase Storage khi có cấu hình, đảm bảo tuyệt đối bảo mật và trải nghiệm trong suốt cho người dùng. Không có bất kỳ nút bấm đăng nhập hoặc widget kết nối nào hiển thị ở phía Frontend.
  - Một badge trạng thái dạng read-only hiển thị ở Sidebar giúp quản trị viên biết hệ thống đang sử dụng Google Drive hay Supabase Storage làm kho lưu trữ hiện tại.
- **Quy trình lưu trữ và tải lên:**
  - Khi Google Drive **chưa cấu hình ở backend** (thiếu biến môi trường): Hệ thống tự động sử dụng **Supabase Storage** làm phương án dự phòng mặc định, đảm bảo mọi thao tác không bị gián đoạn.
  - Khi Google Drive **đã cấu hình ở backend** (`GOOGLE_SERVICE_ACCOUNT_EMAIL` và `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` trong file `.env`): Mọi file tải lên từ *Tạo Booking mới* hoặc *Cập nhật hồ sơ hành khách* sẽ được chuyển hướng trực tiếp lên Google Drive của tài khoản Service Account đã cấu hình thông qua API:
    1. Tự động kiểm tra hoặc tạo mới thư mục gốc tên là `AD Luxury Travel`.
    2. Tự động kiểm tra hoặc tạo thư mục con đặt tên theo Số hộ chiếu (`passport_number` hoặc `CHUA_CO_HC`).
    3. Tải file lên và đổi tên file theo định dạng chuẩn hóa: `{SO_HO_CHIEU}-{CHU_CAI_VIET_TAT_TEN}.{ten_file_goc}`.
    4. Cấp quyền xem cho "bất kỳ ai có liên kết" (role: reader, type: anyone) và trả về liên kết xem trực tuyến (`webViewLink`) của Google Drive để lưu vào trường `passport_url` trong database. Khi người dùng click vào liên kết, file sẽ mở trên giao diện xem trước chính thức của Google Drive (hỗ trợ phóng to, tải xuống, in ấn cực kỳ tiện lợi).
  - **Quy tắc lưu trữ tài liệu Visa và File hướng dẫn mẫu:**
    - **File mẫu của từng dịch vụ visa lẻ:** Được tổ chức lưu trữ riêng biệt trong thư mục của từng mã dịch vụ visa tương ứng (Ví dụ trên Google Drive: `AD Luxury Travel > Visa > VIAU`, hoặc trên Supabase Storage: thư mục `Visa/VIAU/`).
    - **Hồ sơ, file mẫu chung của tất cả các loại visa:** Lưu trữ trực tiếp tại thư mục Visa gốc (Ví dụ trên Google Drive: `AD Luxury Travel > Visa`, hoặc trên Supabase Storage: thư mục `Visa/`).
- **Quy trình xóa file:**
  - Khi người dùng xóa file đính kèm cũ khỏi hồ sơ hành khách, hệ thống gửi yêu cầu đến backend tự động kiểm tra liên kết của file:
    - Nếu là liên kết Google Drive, backend sẽ gọi API Google Drive để **xóa vĩnh viễn** file đó khỏi Drive.
    - Nếu là liên kết Supabase, backend thực hiện xóa file trong Supabase Storage như thông thường.

---

## 9. Cấu Trúc Thư Mục & Vai Trò Hệ Thống Hóa các File (Hỗ trợ Quản lý & Nâng cấp)
Để giúp quá trình quản lý, sửa chữa và nâng cấp hệ thống sau này diễn ra trơn tru nhất, cấu trúc mã nguồn được quy định và mô tả chi tiết như sau:

### 9.1 Sơ đồ cấu trúc thư mục chính
```bash
/
├── server.ts               # Core Backend (Express, Google Drive API, Supabase Proxy, Dev Server)
├── supabase-schema.sql     # Database Schema (Mã SQL khởi tạo bảng, quyền, trigger đồng bộ profile)
├── metadata.json           # Metadata ứng dụng AI Studio (Tên, mô tả, quyền thiết bị)
├── package.json            # Quản lý các thư viện dependencies và lệnh build/run
├── .env.example            # Bản mẫu cấu hình biến môi trường (Supabase, Google Drive)
├── src/
│   ├── main.tsx            # Điểm khởi chạy Client-side React
│   ├── App.tsx             # Cấu hình Routing chính và phân chia Layout theo quyền truy cập
│   ├── types.ts            # Định nghĩa toàn bộ kiểu dữ liệu (Tour, Order, Passenger, Role...)
│   ├── index.css           # Global CSS sử dụng Tailwind CSS v4
│   ├── lib/
│   │   ├── supabase.ts     # Client kết nối Supabase, Proxy thông minh, kiểm tra Auto-create Bucket
│   │   └── utils.ts        # Các hàm tiện ích dùng chung
│   ├── context/
│   │   ├── AuthContext.tsx # Quản lý phiên đăng nhập (Supabase Auth) và đồng bộ Profile người dùng
│   │   └── CRMContext.tsx  # Bộ não quản lý trạng thái CRM (Đồng bộ offline/online, CRUD Tour, Đơn hàng)
│   ├── components/
│   │   ├── Layout.tsx      # Sidebar, Header, thanh chọn Vai trò (Role Switcher), thông báo đẩy (Real-time)
│   │   ├── DatePicker.tsx  # Component chọn ngày chuẩn hóa giao diện và trải nghiệm
│   │   ├── ActionModal.tsx # Hộp thoại thông báo xác nhận hành động nguy hiểm (Xóa, Hủy)
│   │   ├── UserManagement.tsx # Trình quản lý tài khoản thành viên (Chỉ Admin mới truy cập được)
│   │   ├── EditOrderModal.tsx # Form cập nhật thông tin Booking / Đơn hàng
│   │   └── EditPassengerModal.tsx # Form cập nhật hồ sơ hành khách, tải lên Visa / Hộ chiếu
│   └── pages/
│       ├── DepartureCalendar.tsx # Lịch khởi hành (Bộ lọc danh mục, hiển thị trực quan dạng lịch & danh sách)
│       ├── ToursManagement.tsx   # Quản lý Tour & Lịch trình (Form tạo Tour, Tab Danh mục sản phẩm)
│       ├── OrdersManagement.tsx  # Quản lý Booking (Form đặt chỗ, theo dõi trạng thái hold/sure, gia hạn giữ chỗ)
│       ├── VisaServices.tsx      # Quản lý các dịch vụ Visa lẻ của đại lý
│       ├── VisaProcessing.tsx    # Xử lý Visa (Dành cho bộ phận Visa duyệt, cập nhật trạng thái hồ sơ hành khách)
│       ├── AccountingInvoice.tsx # Kế toán & Hóa đơn (Duyệt Thu/Chi hóa đơn, thống kê doanh thu lữ hành)
│       ├── CustomersManagement.tsx # Quản lý Đại lý & CTV (Thống kê xếp hạng thành viên: Bạc, Vàng, Kim cương)
│       ├── PassengersManagement.tsx # Quản lý danh sách Khách hàng đi tour
│       ├── Profile.tsx           # Trang thông tin tài khoản cá nhân, đổi mật khẩu
│       └── Settings.tsx          # Trang cài đặt cấu hình hệ thống chuyên sâu
```

### 9.2 Nguyên tắc bảo trì & Tránh phá vỡ Logic cũ
Khi thực hiện nâng cấp hoặc sửa đổi bất kỳ file nào trong hệ thống, bắt buộc tuân thủ các nguyên tắc vàng sau:
1. **Kiến trúc Offline-First Dự phòng (Hybrid Mode):** 
   - `CRMContext.tsx` được thiết kế để tự động đồng bộ dữ liệu với Supabase khi online, và lưu tạm vào `localStorage` làm phương án dự phòng khi offline hoặc khi Supabase chưa cấu hình. 
   - **Tuyệt đối không** loại bỏ phần dự phòng `localStorage` khi sửa code fetch dữ liệu.
2. **Đồng bộ File an toàn qua Backend:**
   - Client tuyệt đối không gọi trực tiếp API Google Drive. Mọi thao tác tải lên và xóa file hộ chiếu/visa phải thông qua API trung gian ở `server.ts` để bảo mật API key và Service Account.
3. **Phân Quyền ở cả 2 đầu (Client & Database):**
   - Không được tắt tính năng RLS (Row Level Security) trên các bảng Supabase. Mọi thay đổi về phân quyền ở frontend (`Layout.tsx`) phải đồng nhất với logic phân vai trò tại `AuthContext.tsx`.
4. **Nhất quán Ngôn ngữ:**
   - Toàn bộ giao diện người dùng, thông báo thành công, lỗi và hướng dẫn cài đặt phải viết bằng **Tiếng Việt** chuẩn xác, chuyên nghiệp.



