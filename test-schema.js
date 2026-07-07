import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.rpc('get_schema');
  console.log("Error:", error);
  // Alternative to check columns:
  const { data: cols, error: e2 } = await supabase.from('tours').select('tour_type').limit(1);
  console.log("tour_type error:", e2);
}
test();
