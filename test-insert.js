import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const t = {
  id: '00000000-0000-0000-0000-000000000001',
  code: 'TOUR1',
  name: 'Test',
  duration: '5 days',
  price: 1000,
  total_seats: 10,
  available_seats: 10,
  status: 'available',
  departure_date: '2025-01-01',
  departure_time: '2025-01-01T10:00:00Z',
  return_time: '2025-01-05T10:00:00Z',
  airline: 'VN',
  hotel: 'Test',
  commission: 0,
  sold_seats: 0,
  hold_seats: 0,
  seat_status: 'Còn chỗ',
  flight_out: 'VN123',
  flight_out_transit: '',
  flight_in: 'VN124',
  flight_in_transit: '',
  transit_info: '',
  guide_name: '',
  guide_phone: '',
  ticket_status: 'CHỜ XUẤT VÉ',
  visa_deadline: '',
  description: '',
  category: '',
  hold_duration_hours: 48,
  overbook_limit: 0,
  price_adult: 1000,
  price_child: 800,
  price_infant: 300,
  single_room_surcharge: 500,
  tour_type: 'internal'
};

async function test() {
  const { data, error } = await supabase.from('tours').insert([t]);
  console.log("Error:", error);
}
test();
