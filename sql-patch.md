# Hướng dẫn sửa lỗi "Lỗi khi lưu đơn hàng lên Supabase" & Auto-deletion

Vấn đề bạn gặp phải (lỗi `ERROR: 42703: column "order_date" of relation "bookings" does not exist`) là do đoạn mã SQL trước đó cố gắng gỡ bỏ ràng buộc của các cột không có thật trong database. 

Chính vì database chưa được cập nhật các cột mới (như `adult_count`, `child_count`...), khi ứng dụng cố gắng thêm (insert) đơn hàng mới, Supabase sẽ từ chối. 
Hiện tượng **"tự động xoá" (auto-deletion) hoặc "lỗi fetch sau khi tạo"** mà bạn thấy thực chất là do ứng dụng React đã lưu tạm đơn hàng vào bộ nhớ (nên hiển thị trên giao diện), nhưng lưu lên Supabase bị lỗi. Khi trang load lại hoặc chạy bộ hẹn giờ đồng bộ (15s), hệ thống không tìm thấy đơn hàng trên Supabase nên giao diện sẽ xoá bỏ đơn hàng đó đi.

Bạn vui lòng copy đoạn mã sau và chạy lại trong **SQL Editor** của Supabase để sửa triệt để:

```sql
-- 1. Thêm cột mới cho bảng BOOKINGS
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS seats INTEGER DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS hold_expiry TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_status TEXT DEFAULT 'pending';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS extension_status TEXT DEFAULT 'none';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS extension_hours INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_extended BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booker_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booker_phone TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS adult_count INTEGER DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS child_count INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS infant_count INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS single_room_count INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_share_info TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vat_option TEXT DEFAULT 'no_vat';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS special_requests TEXT;

-- 2. Thêm cột mới cho bảng PASSENGERS
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS dob TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS is_payer BOOLEAN DEFAULT FALSE;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS passport_url TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS labor_contract_url TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS visa_submitted_at TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS visa_disqualified_reason TEXT;

-- 3. Đảm bảo RLS cho phép Insert/Update bằng cách gán WITH CHECK (true)
DROP POLICY IF EXISTS "Allow authenticated access to bookings" ON bookings;
CREATE POLICY "Allow authenticated access to bookings" ON bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access to passengers" ON passengers;
CREATE POLICY "Allow authenticated access to passengers" ON passengers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access to tours" ON tours;
CREATE POLICY "Allow authenticated access to tours" ON tours FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Cập nhật cache schema của Supabase
NOTIFY pgrst, 'reload schema';
```
