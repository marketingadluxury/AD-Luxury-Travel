-- Cập nhật quyền truy cập đầy đủ (Đọc & Ghi) cho các bảng
DO $$
BEGIN
    -- Xóa các policy cũ
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

    -- Tạo policy mới có cả USING (cho SELECT/UPDATE/DELETE) và WITH CHECK (cho INSERT)
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
