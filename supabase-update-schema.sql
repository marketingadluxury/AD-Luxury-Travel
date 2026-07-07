-- SQL MIGRATION: NÂNG CẤP CƠ SỞ DỮ LIỆU TRÊN SUPABASE
-- Hãy sao chép toàn bộ đoạn script này và chạy trong Supabase SQL Editor của bạn.

-- Kích hoạt UUID extension nếu chưa có
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Nâng cấp bảng TOURS (Thêm các trường chi tiết cho Tour du lịch)
ALTER TABLE tours ADD COLUMN IF NOT EXISTS airline TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS hotel TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS commission NUMERIC DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS sold_seats INTEGER DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS hold_seats INTEGER DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS seat_status TEXT DEFAULT 'Còn chỗ';
ALTER TABLE tours ADD COLUMN IF NOT EXISTS flight_out TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS flight_out_transit TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS flight_in TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS flight_in_transit TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS transit_info TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS guide_name TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS guide_phone TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS ticket_status TEXT DEFAULT 'CHỜ XUẤT VÉ';
ALTER TABLE tours ADD COLUMN IF NOT EXISTS visa_deadline TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS hold_duration_hours INTEGER DEFAULT 48;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS overbook_limit INTEGER DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS price_adult NUMERIC DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS price_child NUMERIC DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS price_infant NUMERIC DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS single_room_surcharge NUMERIC DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS itinerary_pdf_url TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS notice_sections TEXT;

-- Cập nhật kiểu dữ liệu cột departure_date thành TEXT hoặc TIMESTAMP nếu cần, hoặc giữ nguyên cột cũ và thêm cột mới
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

-- 2. Nâng cấp bảng BOOKINGS (Đặt chỗ - ánh xạ sang Orders trong React)
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

-- 3. Tạo bảng PASSENGERS (Hành khách - mỗi Đơn đặt chỗ có thể có nhiều hành khách)
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

ALTER TABLE passengers ADD COLUMN IF NOT EXISTS visa_submitted_at TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS visa_disqualified_reason TEXT;

-- 4. Tạo bảng SYSTEM_NOTIFICATIONS (Thông báo hệ thống)
CREATE TABLE IF NOT EXISTS system_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  read BOOLEAN DEFAULT FALSE
);

-- 5. Tạo bảng TOUR_CATEGORIES (Danh mục Tour du lịch)
CREATE TABLE IF NOT EXISTS tour_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 6. Tạo bảng APP_SETTINGS (Lưu cấu hình tích điểm hạng thành viên, v.v.)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Kích hoạt RLS (Row Level Security) cho các bảng mới tạo
ALTER TABLE passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Cấp quyền truy cập cho tất cả người dùng đã đăng nhập (authenticated)
DROP POLICY IF EXISTS "Allow authenticated access to passengers" ON passengers;
CREATE POLICY "Allow authenticated access to passengers" ON passengers FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to system_notifications" ON system_notifications;
CREATE POLICY "Allow authenticated access to system_notifications" ON system_notifications FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to tour_categories" ON tour_categories;
CREATE POLICY "Allow authenticated access to tour_categories" ON tour_categories FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to app_settings" ON app_settings;
CREATE POLICY "Allow authenticated access to app_settings" ON app_settings FOR ALL TO authenticated USING (true);

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
-- CẤU HÌNH SUPABASE STORAGE & CHÍNH SÁCH BẢO MẬT (RLS) CHO TÀI LIỆU ĐÍNH KÈM
-- =========================================================================

-- 1. Tạo bucket "AD Luxury Travel" ở chế độ public nếu chưa tồn tại
INSERT INTO storage.buckets (id, name, public)
VALUES ('AD Luxury Travel', 'AD Luxury Travel', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Kích hoạt RLS cho schema storage nếu chưa bật (mặc định đã được bật trên Supabase)
-- 3. Tạo chính sách RLS cho phép truy cập đọc công khai (SELECT) cho tất cả mọi người
DROP POLICY IF EXISTS "Allow public select on AD Luxury Travel" ON storage.objects;
CREATE POLICY "Allow public select on AD Luxury Travel" ON storage.objects
  FOR SELECT USING (bucket_id = 'AD Luxury Travel');

-- 4. Cho phép người dùng đã đăng nhập (authenticated) tải lên file (INSERT)
DROP POLICY IF EXISTS "Allow authenticated insert on AD Luxury Travel" ON storage.objects;
CREATE POLICY "Allow authenticated insert on AD Luxury Travel" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'AD Luxury Travel');

-- 5. Cho phép người dùng đã đăng nhập (authenticated) cập nhật file (UPDATE)
DROP POLICY IF EXISTS "Allow authenticated update on AD Luxury Travel" ON storage.objects;
CREATE POLICY "Allow authenticated update on AD Luxury Travel" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'AD Luxury Travel');

-- 6. Cho phép người dùng đã đăng nhập (authenticated) xóa file (DELETE)
DROP POLICY IF EXISTS "Allow authenticated delete on AD Luxury Travel" ON storage.objects;
CREATE POLICY "Allow authenticated delete on AD Luxury Travel" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'AD Luxury Travel');

-- 7. CHÍNH SÁCH DỰ PHÒNG CHO REQUEST ẨN DANH (ANON) NẾU BACKEND KHÔNG TRUYỀN TOKEN XÁC THỰC
DROP POLICY IF EXISTS "Allow anon insert on AD Luxury Travel" ON storage.objects;
CREATE POLICY "Allow anon insert on AD Luxury Travel" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'AD Luxury Travel');

DROP POLICY IF EXISTS "Allow anon update on AD Luxury Travel" ON storage.objects;
CREATE POLICY "Allow anon update on AD Luxury Travel" ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = 'AD Luxury Travel');

DROP POLICY IF EXISTS "Allow anon delete on AD Luxury Travel" ON storage.objects;
CREATE POLICY "Allow anon delete on AD Luxury Travel" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'AD Luxury Travel');

