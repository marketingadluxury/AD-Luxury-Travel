import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import https from 'https';
dotenv.config();

const supabaseUrl = "https://nryzcsyaryjgoyoagygz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yeXpjc3lhcnlqZ295b2FneWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODU4MzAsImV4cCI6MjA5ODQ2MTgzMH0.Z9YJMDCg5ivN6tYVdYP1VUD_AHj7PDehsI-SprEByk8";

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
