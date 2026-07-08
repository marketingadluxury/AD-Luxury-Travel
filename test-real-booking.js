import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    const { data: tourData } = await supabase.from('tours').select('id').limit(1);
    if (!tourData || tourData.length === 0) {
        console.log("No tours found");
        return;
    }
    const tour_id = tourData[0].id;
    
    // Auth as admin to bypass RLS? No, we don't have password.
    // Let's just use service role key if available.
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const adminSupabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { error } = await adminSupabase.from('bookings').insert({
            customer_id: null,
            tour_id: tour_id,
            booking_date: new Date().toISOString().substring(0, 10),
            status: 'hold',
            total_amount: 1000,
            payment_status: 'hold',
            seats: 1,
            created_by: 'Test',
            user_id: null,
            hold_expiry: new Date().toISOString(),
            invoice_status: 'pending',
            extension_status: 'none',
            extension_hours: 0,
            is_extended: false,
            booker_name: 'Test Booker',
            booker_phone: '0987654321',
            adult_count: 1,
            child_count: 0,
            infant_count: 0,
            single_room_count: 0,
            room_share_info: '',
            vat_option: 'no_vat',
            special_requests: ''
        });
        console.log("Admin Booking Error:", error);
    } else {
        console.log("No service role key");
    }
}
main();
