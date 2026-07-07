import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { updateSupabaseClient } from './lib/supabase';

async function bootstrap() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.supabaseUrl && data.supabaseAnonKey) {
        updateSupabaseClient(data.supabaseUrl, data.supabaseAnonKey);
      }
    }
  } catch (err) {
    console.error('Không thể nạp cấu hình động Supabase từ backend:', err);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();
