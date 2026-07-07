-- BẢN SẮC CƠ SỞ DỮ LIỆU ĐẦY ĐỦ - AD LUXURY TRAVEL CRM
-- Kích hoạt UUID extension nếu chưa có
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Bảng Profiles (Lưu thông tin mở rộng của User)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  company_name TEXT,
  role TEXT DEFAULT 'CTV',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Bảng Tours (Quản lý các Tour du lịch)
CREATE TABLE IF NOT EXISTS tours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  duration TEXT NOT NULL,
  price NUMERIC NOT NULL,
  total_seats INTEGER NOT NULL,
  available_seats INTEGER NOT NULL,
  status TEXT NOT NULL,
  departure_date DATE NOT NULL,
  vehicle TEXT,
  guide TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  
  -- Các cột mở rộng từ React Tour model
  airline TEXT,
  hotel TEXT,
  commission NUMERIC DEFAULT 0,
  sold_seats INTEGER DEFAULT 0,
  hold_seats INTEGER DEFAULT 0,
  seat_status TEXT DEFAULT 'Còn chỗ',
  flight_out TEXT,
  flight_out_transit TEXT,
  flight_in TEXT,
  flight_in_transit TEXT,
  transit_info TEXT,
  guide_name TEXT,
  guide_phone TEXT,
  ticket_status TEXT DEFAULT 'CHỜ XUẤT VÉ',
  visa_deadline TEXT,
  description TEXT,
  category TEXT,
  hold_duration_hours INTEGER DEFAULT 48,
  overbook_limit INTEGER DEFAULT 0,
  price_adult NUMERIC DEFAULT 0,
  price_child NUMERIC DEFAULT 0,
  price_infant NUMERIC DEFAULT 0,
  single_room_surcharge NUMERIC DEFAULT 0,
  itinerary_pdf_url TEXT,
  notice_sections TEXT,
  departure_time TEXT,
  return_time TEXT,
  tour_status TEXT DEFAULT 'available',
  tour_type TEXT DEFAULT 'internal',
  partner_name TEXT,
  partner_contact TEXT,
  organization_name TEXT,
  group_leader_contact TEXT,
  custom_requirements TEXT,
  visa_country TEXT,
  visa_service_type TEXT,
  visa_speed TEXT
);

-- 3. Bảng Customers (Quản lý khách hàng - Booker chính)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  type TEXT NOT NULL,
  address TEXT,
  total_bookings INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. Bảng Bookings (Quản lý đặt chỗ - Ánh xạ sang Orders trong React)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  status TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  payment_status TEXT NOT NULL,
  seats INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  
  -- Các cột mở rộng từ React Order model
  created_by TEXT,
  user_id UUID REFERENCES auth.users(id),
  hold_expiry TEXT,
  invoice_status TEXT DEFAULT 'pending',
  extension_status TEXT DEFAULT 'none',
  extension_hours INTEGER DEFAULT 0,
  is_extended BOOLEAN DEFAULT FALSE,
  booker_name TEXT,
  booker_phone TEXT,
  adult_count INTEGER DEFAULT 1,
  child_count INTEGER DEFAULT 0,
  infant_count INTEGER DEFAULT 0,
  single_room_count INTEGER DEFAULT 0,
  room_share_info TEXT,
  vat_option TEXT DEFAULT 'no_vat',
  special_requests TEXT
);

-- 5. Bảng Visas (Quản lý hồ sơ Visa)
CREATE TABLE IF NOT EXISTS visas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  submission_date DATE NOT NULL,
  expected_date DATE NOT NULL,
  internal_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 6. Bảng Invoices (Quản lý hóa đơn - Thu/Chi)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL,
  due_date DATE NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 7. Bảng Passengers (Hành khách chi tiết trong từng Booking)
CREATE TABLE IF NOT EXISTS passengers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  is_payer BOOLEAN DEFAULT FALSE,
  full_name TEXT NOT NULL,
  passport_number TEXT,
  phone TEXT,
  dob TEXT,
  passport_url TEXT,
  labor_contract_url TEXT,
  visa_status TEXT DEFAULT 'pending',
  visa_submitted_at TEXT,
  visa_disqualified_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 8. Bảng System Notifications (Thông báo hệ thống)
CREATE TABLE IF NOT EXISTS system_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  read BOOLEAN DEFAULT FALSE
);

-- 9. Bảng Tour Categories (Danh mục sản phẩm)
CREATE TABLE IF NOT EXISTS tour_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 10. Bảng App Settings (Cấu hình hệ thống chung)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- KÍCH HOẠT ROW LEVEL SECURITY (RLS)
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

-- CẤP QUYỀN TRUY CẬP CHO USER ĐÃ ĐĂNG NHẬP
DROP POLICY IF EXISTS "Allow authenticated access to profiles" ON profiles;
CREATE POLICY "Allow authenticated access to profiles" ON profiles FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to tours" ON tours;
CREATE POLICY "Allow authenticated access to tours" ON tours FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to customers" ON customers;
CREATE POLICY "Allow authenticated access to customers" ON customers FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to bookings" ON bookings;
CREATE POLICY "Allow authenticated access to bookings" ON bookings FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to visas" ON visas;
CREATE POLICY "Allow authenticated access to visas" ON visas FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to invoices" ON invoices;
CREATE POLICY "Allow authenticated access to invoices" ON invoices FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to passengers" ON passengers;
CREATE POLICY "Allow authenticated access to passengers" ON passengers FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to system_notifications" ON system_notifications;
CREATE POLICY "Allow authenticated access to system_notifications" ON system_notifications FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to tour_categories" ON tour_categories;
CREATE POLICY "Allow authenticated access to tour_categories" ON tour_categories FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to app_settings" ON app_settings;
CREATE POLICY "Allow authenticated access to app_settings" ON app_settings FOR ALL TO authenticated USING (true);

-- TỰ ĐỘNG TẠO PROFILE KHI ĐĂNG KÝ
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, company_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'company_name',
    CASE
      WHEN LOWER(new.email) IN ('marketing@adluxury.net', 'marketing.adluxury@gmail.com') THEN 'admin'
      ELSE COALESCE(new.raw_user_meta_data->>'role', 'CTV')
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gắn Trigger vào auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Chèn dữ liệu mẫu ban đầu cho danh mục nếu chưa có
INSERT INTO tour_categories (name) VALUES 
('Du lịch Đông Nam Á'), 
('Du lịch Châu Âu'), 
('Du lịch Đông Bắc Á'), 
('Du lịch Trong Nước') 
ON CONFLICT (name) DO NOTHING;

-- Chèn dữ liệu mẫu cài đặt hạng thành viên
INSERT INTO app_settings (key, value) VALUES 
('membership_settings', '{"silverMin": 20000000, "goldMin": 50000000, "platinumMin": 100000000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =========================================================================
