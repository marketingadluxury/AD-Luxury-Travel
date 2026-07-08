import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const toUuid = (id) => `00000000-0000-0000-0000-${id.padStart(12, '0')}`;

async function main() {
    let adminSupabase = supabase;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        adminSupabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    }
    
    const t = {
        id: '1',
        code: 'THAI-VN-5N4D-VJ-260701',
        name: '[SÀI GÒN] THÁI LAN: BANGKOK - PATTAYA',
        duration: '5 Ngày 4 Đêm',
        price: 8490000,
        total_seats: 25,
        available_seats: 10,
        tour_status: 'on_sale',
        category: 'Du lịch Đông Nam Á',
        hold_duration_hours: 48,
        price_adult: 8490000,
        price_child: 6490000,
        price_infant: 2490000
    };
    
    const { error } = await adminSupabase.from('tours').insert({
      id: toUuid(t.id),
      code: t.code,
      name: t.name,
      duration: t.duration,
      price: Number(t.price),
      total_seats: Number(t.total_seats),
      available_seats: Number(t.available_seats),
      status: t.tour_status,
      category: t.category,
      hold_duration_hours: t.hold_duration_hours,
      price_adult: t.price_adult,
      price_child: t.price_child,
      price_infant: t.price_infant
    });
    console.log("Tour Insert Error:", error);
}
main();
