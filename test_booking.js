import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: bookings } = await supabase.from('bookings').select('*').eq('code', '#3bbb0abd');
  console.log(bookings);
  
  if (bookings && bookings.length > 0) {
     const orderId = bookings[0].id;
     const { data: invs } = await supabase.from('invoices').select('*').eq('order_id', orderId);
     console.log('Invoices for order:', invs);
  }
}
run();
