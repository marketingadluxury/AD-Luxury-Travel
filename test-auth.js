import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://nryzcsyaryjgoyoagygz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yeXpjc3lhcnlqZ295b2FneWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODU4MzAsImV4cCI6MjA5ODQ2MTgzMH0.Z9YJMDCg5ivN6tYVdYP1VUD_AHj7PDehsI-SprEByk8');

async function test() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  console.log(error || data);
}
test();
