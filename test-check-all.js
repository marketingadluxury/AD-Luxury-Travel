import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    let adminSupabase = supabase;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        adminSupabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    }
    
    const tables = {
        bookings: [
            'id', 'customer_id', 'tour_id', 'booking_date', 'status', 'total_amount', 
            'payment_status', 'seats', 'created_by', 'user_id', 
            'hold_expiry', 'invoice_status', 'extension_status', 'extension_hours', 
            'is_extended', 'booker_name', 'booker_phone', 'adult_count', 'child_count', 
            'infant_count', 'single_room_count', 'room_share_info', 'vat_option', 'special_requests'
        ],
        passengers: [
            'id', 'order_id', 'is_payer', 'full_name', 'passport_number', 'phone', 'dob',
            'passport_url', 'labor_contract_url', 'visa_status', 'visa_submitted_at',
            'visa_disqualified_reason'
        ],
        tours: [
            'id', 'code', 'name', 'duration', 'price', 'total_seats', 'available_seats',
            'departure_date', 'departure_time', 'return_time', 'airline', 'hotel',
            'commission', 'sold_seats', 'hold_seats', 'seat_status', 'flight_out',
            'flight_out_transit', 'flight_in', 'flight_in_transit', 'transit_info',
            'guide_name', 'guide_phone', 'ticket_status', 'visa_deadline', 'description',
            'category', 'hold_duration_hours', 'overbook_limit', 'price_adult',
            'price_child', 'price_infant', 'single_room_surcharge', 'itinerary_pdf_url',
            'notice_sections', 'tour_status', 'tour_type', 'partner_name', 'partner_contact',
            'organization_name', 'group_leader_contact', 'custom_requirements',
            'visa_country', 'visa_service_type', 'visa_speed'
        ]
    };
    
    for (const [table, cols] of Object.entries(tables)) {
        for (const col of cols) {
            const { error } = await adminSupabase.from(table).select(col).limit(1);
            if (error) {
                console.log(`Table ${table} missing column: ${col} - ${error.message}`);
            }
        }
    }
}
main();
