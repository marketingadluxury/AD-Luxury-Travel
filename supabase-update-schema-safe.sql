-- Nâng cấp bảng TOURS (thêm từng cột một cách an toàn)
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

-- Nâng cấp bảng BOOKINGS
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

-- Bảng PASSENGERS
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

-- Cấp quyền (fix lỗi Insert - RLS Error 42501)
DROP POLICY IF EXISTS "Allow authenticated access to tours" ON tours;
CREATE POLICY "Allow authenticated access to tours" ON tours FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access to bookings" ON bookings;
CREATE POLICY "Allow authenticated access to bookings" ON bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access to passengers" ON passengers;
CREATE POLICY "Allow authenticated access to passengers" ON passengers FOR ALL TO authenticated USING (true) WITH CHECK (true);
