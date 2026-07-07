import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('tours').select('*').limit(1);
  console.log("Error:", error);
  if (data) {
    if (data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
    } else {
      console.log("No data, inserting dummy to test...");
      const { error: insertError } = await supabase.from('tours').insert({ id: '00000000-0000-0000-0000-000000000001', title: 'test', start_date: '2025-01-01', end_date: '2025-01-05', price_adult: 0, price_child: 0, slots_total: 10, slots_available: 10, status: 'active' });
      console.log("Insert Error:", insertError);
    }
  }
}
test();
