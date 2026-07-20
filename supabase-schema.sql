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
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  total_seats INTEGER NOT NULL DEFAULT 0,
  available_seats INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'Planning',
  operator_id UUID REFERENCES profiles(id),
  guide_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
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
  guide_phone TEXT,
  ticket_status TEXT DEFAULT 'CHỜ XUẤT VÉ',
  ticket_deadline TEXT,
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
  visa_speed TEXT,
  departure_date DATE,
  price_visa_tour NUMERIC DEFAULT 0,
  CONSTRAINT tours_pkey PRIMARY KEY (id),
  CONSTRAINT tours_code_key UNIQUE (code)
);

-- Cuối file: Các câu lệnh cập nhật schema bổ sung cho database cũ
-- Chạy đoạn này nếu bạn gặp lỗi "Could not find column price_visa_tour"
ALTER TABLE tours ADD COLUMN IF NOT EXISTS price_visa_tour NUMERIC DEFAULT 0;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS needs_visa_service BOOLEAN DEFAULT FALSE;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS passport_issue_date TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS passport_expiry_date TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS departure_date DATE;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS price_infant NUMERIC DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS single_room_surcharge NUMERIC DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS airline TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS hotel TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS itinerary_pdf_url TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS notice_sections TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS departure_time TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS return_time TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS tour_status TEXT DEFAULT 'available';
ALTER TABLE tours ADD COLUMN IF NOT EXISTS tour_type TEXT DEFAULT 'internal';
ALTER TABLE tours ADD COLUMN IF NOT EXISTS partner_name TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS partner_contact TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS organization_name TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS group_leader_contact TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS custom_requirements TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS visa_country TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS visa_service_type TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS visa_speed TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vat_company_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vat_tax_code TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vat_address TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vat_email TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  type TEXT NOT NULL, -- 'agency', 'collaborator', 'individual'
  address TEXT,
  total_bookings INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. Bảng Bookings (Quản lý đặt chỗ - Ánh xạ sang Orders trong React)
CREATE TABLE IF NOT EXISTS bookings (
  id uuid NOT NULL DEFAULT uuid_generate_v4 (),
  code text NULL,
  tour_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  passengers integer NOT NULL DEFAULT 1,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  status text NULL DEFAULT 'Pending'::text,
  salesperson_id uuid NOT NULL,
  created_at timestamp WITH TIME ZONE NOT NULL DEFAULT timezone ('utc'::text, now()),
  created_by text NULL,
  user_id uuid NULL,
  hold_expiry text NULL,
  invoice_status text NULL DEFAULT 'pending'::text,
  extension_status text NULL DEFAULT 'none'::text,
  extension_hours integer NULL DEFAULT 0,
  is_extended boolean NULL DEFAULT false,
  booker_name text NULL,
  booker_phone text NULL,
  adult_count integer NULL DEFAULT 1,
  child_count integer NULL DEFAULT 0,
  infant_count integer NULL DEFAULT 0,
  single_room_count integer NULL DEFAULT 0,
  room_share_info text NULL,
  vat_option text NULL DEFAULT 'no_vat'::text,
  special_requests text NULL,
  discount_type text NULL,
  discount_value numeric DEFAULT 0,
  surcharge_name text NULL,
  surcharge_amount numeric DEFAULT 0,
  cancel_reason text NULL,
  booking_date date NULL DEFAULT CURRENT_DATE,
  payment_status text NULL DEFAULT 'pending'::text,
  seats integer NULL DEFAULT 1,
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_code_key UNIQUE (code),
  CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id),
  CONSTRAINT bookings_salesperson_id_fkey FOREIGN KEY (salesperson_id) REFERENCES profiles (id),
  CONSTRAINT bookings_tour_id_fkey FOREIGN KEY (tour_id) REFERENCES tours (id),
  CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id)
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
  order_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  invoice_code TEXT UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('receipt', 'payment')),
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  file_url TEXT,
  created_by TEXT,
  verified_by TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
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
  needs_visa_service BOOLEAN DEFAULT FALSE,
  visa_submitted_at TEXT,
  visa_disqualified_reason TEXT,
  gender TEXT,
  nationality TEXT,
  passport_issue_date TEXT,
  passport_expiry_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 8. Bảng System Notifications (Thông báo hệ thống)
CREATE TABLE IF NOT EXISTS system_notifications (
  id TEXT PRIMARY KEY,
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
