import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
let adminSupabase = supabase;
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    adminSupabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function main() {
    const { data: userData, error: userError } = await supabase.auth.signUp({
        email: 'test' + Date.now() + '@example.com',
        password: 'password123',
    });
    
    if (userError) {
        console.log("Signup error:", userError);
    }
    
    const tourId = '00000000-0000-0000-0000-000000000009';
    await adminSupabase.from('tours').insert({
      id: tourId,
      code: 'TEST-' + Date.now(),
      name: 'Test',
      duration: 'Test',
      price: 1000,
      total_seats: 10,
      available_seats: 10
    });
    
    const orderId = '00000000-0000-0000-0000-000000000099';
    const { error: bookingError } = await supabase.from('bookings').insert({
        id: orderId,
        customer_id: null,
        tour_id: tourId,
        booking_date: new Date().toISOString().substring(0, 10),
        status: 'hold',
        total_amount: 1000,
        payment_status: 'hold',
        seats: 1,
        created_by: 'Test',
        user_id: userData.user?.id || null,
        hold_expiry: new Date().toISOString(),
        invoice_status: 'pending',
        extension_status: 'none',
        extension_hours: 0,
        is_extended: false,
        booker_name: 'Test',
        booker_phone: '0987654321',
        adult_count: 1,
        child_count: 0,
        infant_count: 0,
        single_room_count: 0,
        room_share_info: '',
        vat_option: 'no_vat',
        special_requests: ''
    });
    console.log("Booking error:", bookingError);
}
main();
