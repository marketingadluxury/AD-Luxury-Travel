import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: invoices, error: invErr } = await supabase.from('invoices').select('order_id, type').eq('type', 'payment');
  if (invErr) return console.error(invErr);
  
  const refundOrderIds = invoices.map(i => i.order_id).filter(Boolean);
  if (refundOrderIds.length === 0) return console.log('No refund invoices found.');
  
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('id, status').in('id', refundOrderIds);
  if (bErr) return console.error(bErr);
  
  const brokenBookings = bookings.filter(b => b.status !== 'cancelled');
  console.log('Broken bookings:', brokenBookings);
  
  for (const b of brokenBookings) {
    console.log(`Fixing booking ${b.id}...`);
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', b.id);
  }
}
run();
