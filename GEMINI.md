# Hướng Dẫn Dành Cho Tất Cả Các Model Gemini (Tour CRM)

Tài liệu này là quy chuẩn bắt buộc áp dụng cho toàn bộ các model Gemini khi hỗ trợ dự án **Tour CRM**:

## 1. Quy Tắc Trình Bày & Giao Tiếp (Bắt Buộc)
- **Ngôn ngữ:** 100% trả lời bằng **Tiếng Việt**.
- **Thực hiện ngầm toàn bộ quá trình kiểm tra:**
  - Mọi bước đọc file, check cấu trúc, check lỗi trong `AGENTS.md` và `BUGS.md`, kiểm tra linter hay biên dịch đều diễn ra hoàn toàn ngầm trong hệ thống.
  - **Tuyệt đối KHÔNG** hiển thị log tool, mã lệnh console, kết quả git diff, tên file hay mã lỗi thô ra khung chat với người dùng.
  - Chỉ gửi phản hồi cuối cùng dưới dạng văn bản Tiếng Việt mạch lạc, ngắn gọn, súc tích và chuyên nghiệp.

## 2. Quy Trình 5 Bước Khi Triển Khai Task
1. **Bước 1 (Ngầm):** Kiểm tra lại trong `AGENTS.md` và `BUGS.md` về task.
2. **Bước 2:** Trao đổi, phản biện và xác nhận giải pháp với người dùng bằng Tiếng Việt.
3. **Bước 3:** Triển khai code theo đúng yêu cầu.
4. **Bước 4 (Ngầm):** Double check, chạy lint và build kiểm tra.
5. **Bước 5 (Ngầm):** Lưu lại thông tin công việc vào `BUGS.md` / `AGENTS.md`.
