import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: cols, error: errCols } = await supabase.from('tours').select('*').limit(1);
  if (cols && cols.length > 0) {
    console.log(Object.keys(cols[0]));
  } else {
    const { data: d2, error: e2 } = await supabase.from('tours').insert({}).select('*');
    console.log("Insert error:", e2);
    if (d2 && d2.length > 0) {
      console.log(Object.keys(d2[0]));
    }
  }
}
test();
