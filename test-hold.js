import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    const { data } = await supabase.from('tours').select('hold_duration_hours, id, code').limit(5);
    console.log(data);
}
main();
