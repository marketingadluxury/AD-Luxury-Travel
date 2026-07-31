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

---

## 2. Các Vấn Về Đang Theo Dõi (Open Issues)
*(Hiện tại không có lỗi nào chưa được xử lý)*
