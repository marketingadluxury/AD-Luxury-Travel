
-- 2. Bảng BOOKINGS (Bổ sung tất cả các trường theo form Tạo Booking mới)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_date DATE;
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

-- Khắc phục lỗi khi UI gửi `customer_id` là null
ALTER TABLE bookings ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN order_date DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN total_price DROP NOT NULL;

-- 3. Bảng PASSENGERS (Bổ sung thông tin người đi)
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS dob TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS is_payer BOOLEAN DEFAULT FALSE;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS passport_url TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS labor_contract_url TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS visa_submitted_at TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS visa_disqualified_reason TEXT;

ALTER TABLE passengers ALTER COLUMN name DROP NOT NULL;
ALTER TABLE passengers ALTER COLUMN gender DROP NOT NULL;

-- 4. SỬA LỖI RLS BỊ CHẶN QUYỀN GHI
-- (Sử dụng DO BLOCK để chạy an toàn)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated access to profiles" ON profiles;
    DROP POLICY IF EXISTS "Allow authenticated access to tours" ON tours;
    DROP POLICY IF EXISTS "Allow authenticated access to customers" ON customers;
    DROP POLICY IF EXISTS "Allow authenticated access to bookings" ON bookings;
    DROP POLICY IF EXISTS "Allow authenticated access to visas" ON visas;
    DROP POLICY IF EXISTS "Allow authenticated access to invoices" ON invoices;
    DROP POLICY IF EXISTS "Allow authenticated access to passengers" ON passengers;
    DROP POLICY IF EXISTS "Allow authenticated access to system_notifications" ON system_notifications;
    DROP POLICY IF EXISTS "Allow authenticated access to tour_categories" ON tour_categories;
    DROP POLICY IF EXISTS "Allow authenticated access to app_settings" ON app_settings;

    CREATE POLICY "Allow authenticated access to profiles" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Allow authenticated access to tours" ON tours FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Allow authenticated access to customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Allow authenticated access to bookings" ON bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Allow authenticated access to visas" ON visas FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Allow authenticated access to invoices" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Allow authenticated access to passengers" ON passengers FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Allow authenticated access to system_notifications" ON system_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Allow authenticated access to tour_categories" ON tour_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Allow authenticated access to app_settings" ON app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- 5. YÊU CẦU SUPABASE CẬP NHẬT LẠI BỘ NHỚ ĐỆM SCHEMA (BẮT BUỘC ĐỂ HẾT LỖI)
NOTIFY pgrst, 'reload schema';
