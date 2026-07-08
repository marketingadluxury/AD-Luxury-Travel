-- =========================================================================
-- SQL MIGRATION: NÂNG CẤP VÀ FIX LỖI SCHEMA - AD LUXURY TRAVEL CRM
-- =========================================================================
-- Hãy sao chép toàn bộ đoạn script này và chạy trong Supabase SQL Editor.
-- Script này sẽ đảm bảo tất cả các cột mới đều được thêm vào, KHÔNG làm mất dữ liệu cũ.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Bảng TOURS (Sửa lỗi thiếu cột departure_date và các cột mới)
ALTER TABLE tours ADD COLUMN IF NOT EXISTS departure_date DATE;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS departure_time TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS return_time TEXT;
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

-- 2. Bảng BOOKINGS (Quản lý Đơn hàng)
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

-- 3. Bảng PASSENGERS (Hành khách & Visa)
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS is_payer BOOLEAN DEFAULT FALSE;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS passport_url TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS labor_contract_url TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS visa_submitted_at TEXT;
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS visa_disqualified_reason TEXT;

-- YÊU CẦU SUPABASE CẬP NHẬT LẠI BỘ NHỚ ĐỆM SCHEMA (BẮT BUỘC ĐỂ HẾT LỖI)
NOTIFY pgrst, 'reload schema';
