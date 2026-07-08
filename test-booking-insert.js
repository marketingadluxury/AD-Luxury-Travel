import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    const { data: user } = await supabase.auth.admin?.listUsers() || await supabase.auth.getUser();
    
    const { data: insertedTour, error: tourError } = await supabase.from('tours').insert({
        code: 'TEST-TOUR-123',
        name: 'Test Tour',
        duration: '1 day',
        price: 1000,
        total_seats: 10,
        available_seats: 10
    }).select().single();
    
    if (tourError) {
        console.log("Tour Error:", tourError);
        return;
    }
    
    const tour_id = insertedTour.id;
    const { data, error } = await supabase.from('bookings').insert({
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
    console.log("Booking Error:", error);
}
main();
