import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import https from 'https';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Use REST API with OPTIONS to get schema
const url = new URL(supabaseUrl + '/rest/v1/tours');
const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname,
  method: 'OPTIONS',
  headers: {
    'apikey': supabaseKey,
    'Authorization': 'Bearer ' + supabaseKey
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => { body += d; });
  res.on('end', () => {
    try {
      const swagger = JSON.parse(body);
      console.log(Object.keys(swagger.definitions.tours.properties));
    } catch (e) {
      console.log('Error parsing swagger:', e, body.substring(0, 500));
    }
  });
});
req.on('error', (e) => { console.error(e); });
req.end();
