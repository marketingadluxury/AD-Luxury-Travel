import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: invoices, error } = await supabase.from('invoices').select('*').eq('type', 'payment');
  console.log(invoices);
}
run();
