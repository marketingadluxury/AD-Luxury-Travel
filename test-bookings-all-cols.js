import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const expectedCols = [
    'id', 'customer_id', 'tour_id', 'booking_date', 'status', 'total_amount', 
    'payment_status', 'seats', 'created_at', 'created_by', 'user_id', 
    'hold_expiry', 'invoice_status', 'extension_status', 'extension_hours', 
    'is_extended', 'booker_name', 'booker_phone', 'adult_count', 'child_count', 
    'infant_count', 'single_room_count', 'room_share_info', 'vat_option', 'special_requests'
];

async function main() {
    let adminSupabase = supabase;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        adminSupabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    }
    
    for (const col of expectedCols) {
        const { error } = await adminSupabase.from('bookings').select(col).limit(1);
        if (error) {
            console.log(`Column missing: ${col} - ${error.message}`);
        }
    }
}
main();
