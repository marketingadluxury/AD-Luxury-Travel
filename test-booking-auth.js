import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    console.log("Signing up...");
    const { data: userData, error: userError } = await supabase.auth.signUp({
        email: 'test' + Date.now() + '@example.com',
        password: 'password123',
    });
    
    if (userError) {
        console.log("Signup error:", userError);
        return;
    }
    console.log("Signed up user:", userData.user?.id);
    
    // Find a tour
    const { data: tourData } = await supabase.from('tours').select('id').limit(1);
    const tourId = tourData?.[0]?.id;
    console.log("Found tour:", tourId);

    if (!tourId) {
        console.log("No tour found to test booking");
        return;
    }

    const orderId = crypto.randomUUID();
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
