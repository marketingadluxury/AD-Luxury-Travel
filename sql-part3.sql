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
