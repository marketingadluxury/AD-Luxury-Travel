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
    const { data: tourData, error: tourError } = await supabase.from('tours').select('id').limit(1);
    if (tourError) {
        console.log("Tour fetch error:", tourError);
        return;
    }

    if (!tourData || tourData.length === 0) {
        console.log("No tour found. Inserting a dummy tour...");
        const tourId = crypto.randomUUID();
        const { error: insertTourError } = await supabase.from('tours').insert({
            id: tourId,
            code: 'TEST-' + Date.now(),
            name: 'Test',
            duration: 'Test',
            price: 1000,
            total_seats: 10,
            available_seats: 10,
            price_adult: 1000,
            price_child: 500,
            price_infant: 100,
            tour_status: 'available',
            category: 'test'
        });
        if (insertTourError) {
            console.log("Tour insert error:", insertTourError);
            return;
        }
        console.log("Dummy tour inserted:", tourId);
        tourData.push({ id: tourId });
    }

    const tourId = tourData[0].id;
    console.log("Using tour:", tourId);

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
