import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    let adminSupabase = supabase;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        adminSupabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    }
    const { error } = await adminSupabase.from('tours').select('code').limit(1);
    console.log("Error selecting code from tours:", error);
}
main();
