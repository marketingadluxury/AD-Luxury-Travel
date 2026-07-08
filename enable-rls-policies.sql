-- BẬT LẠI RLS CHO TẤT CẢ CÁC BẢNG
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE visas ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- CẤP QUYỀN TRUY CẬP (ĐỌC & GHI) CHO TÀI KHOẢN ĐÃ ĐĂNG NHẬP
DO $$
BEGIN
    -- Xóa các policy cũ để tránh trùng lặp
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

    -- Tạo policy mới với USING và WITH CHECK để cho phép Thêm/Sửa/Xóa (Insert/Update/Delete)
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
