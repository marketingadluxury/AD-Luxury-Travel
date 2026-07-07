-- Kích hoạt UUID extension nếu chưa có
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Nâng cấp bảng TOURS
ALTER TABLE tours 
  ADD COLUMN IF NOT EXISTS airline TEXT,
  ADD COLUMN IF NOT EXISTS hotel TEXT,
  ADD COLUMN IF NOT EXISTS commission NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_seats INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hold_seats INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seat_status TEXT DEFAULT 'Còn chỗ',
  ADD COLUMN IF NOT EXISTS flight_out TEXT,
  ADD COLUMN IF NOT EXISTS flight_out_transit TEXT,
  ADD COLUMN IF NOT EXISTS flight_in TEXT,
  ADD COLUMN IF NOT EXISTS flight_in_transit TEXT,
  ADD COLUMN IF NOT EXISTS transit_info TEXT,
  ADD COLUMN IF NOT EXISTS guide_name TEXT,
  ADD COLUMN IF NOT EXISTS guide_phone TEXT,
  ADD COLUMN IF NOT EXISTS ticket_status TEXT DEFAULT 'CHỜ XUẤT VÉ',
  ADD COLUMN IF NOT EXISTS visa_deadline TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS hold_duration_hours INTEGER DEFAULT 48,
  ADD COLUMN IF NOT EXISTS overbook_limit INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_adult NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_child NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_infant NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS single_room_surcharge NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS itinerary_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS notice_sections TEXT,
  ADD COLUMN IF NOT EXISTS departure_time TEXT,
  ADD COLUMN IF NOT EXISTS return_time TEXT,
  ADD COLUMN IF NOT EXISTS tour_status TEXT DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS tour_type TEXT DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS partner_name TEXT,
  ADD COLUMN IF NOT EXISTS partner_contact TEXT,
  ADD COLUMN IF NOT EXISTS organization_name TEXT,
  ADD COLUMN IF NOT EXISTS group_leader_contact TEXT,
  ADD COLUMN IF NOT EXISTS custom_requirements TEXT,
  ADD COLUMN IF NOT EXISTS visa_country TEXT,
  ADD COLUMN IF NOT EXISTS visa_service_type TEXT,
  ADD COLUMN IF NOT EXISTS visa_speed TEXT;

-- 2. Nâng cấp bảng BOOKINGS
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS hold_expiry TEXT,
  ADD COLUMN IF NOT EXISTS invoice_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS extension_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS extension_hours INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_extended BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS booker_name TEXT,
  ADD COLUMN IF NOT EXISTS booker_phone TEXT,
  ADD COLUMN IF NOT EXISTS adult_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS child_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS infant_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS single_room_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS room_share_info TEXT,
  ADD COLUMN IF NOT EXISTS vat_option TEXT DEFAULT 'no_vat',
  ADD COLUMN IF NOT EXISTS special_requests TEXT;

-- 3. Bảng PASSENGERS
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

-- 4. Bảng SYSTEM_NOTIFICATIONS
CREATE TABLE IF NOT EXISTS system_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  read BOOLEAN DEFAULT FALSE
);

-- 5. Bảng TOUR_CATEGORIES
CREATE TABLE IF NOT EXISTS tour_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 6. Bảng APP_SETTINGS
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Kích hoạt RLS
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE visas ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Cấp quyền truy cập (DROP POLICY IF EXISTS để không bị lỗi 42710)
DROP POLICY IF EXISTS "Allow auth pass" ON passengers;
CREATE POLICY "Allow auth pass" ON passengers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow auth notif" ON system_notifications;
CREATE POLICY "Allow auth notif" ON system_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow auth cat" ON tour_categories;
CREATE POLICY "Allow auth cat" ON tour_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow auth settings" ON app_settings;
CREATE POLICY "Allow auth settings" ON app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access to tours" ON tours;
CREATE POLICY "Allow authenticated access to tours" ON tours FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access to bookings" ON bookings;
CREATE POLICY "Allow authenticated access to bookings" ON bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access to profiles" ON profiles;
CREATE POLICY "Allow authenticated access to profiles" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access to customers" ON customers;
CREATE POLICY "Allow authenticated access to customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access to visas" ON visas;
CREATE POLICY "Allow authenticated access to visas" ON visas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access to invoices" ON invoices;
CREATE POLICY "Allow authenticated access to invoices" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
