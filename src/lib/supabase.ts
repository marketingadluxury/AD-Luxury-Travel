import { createClient } from '@supabase/supabase-js';

const initialUrl = (import.meta as any).env.VITE_SUPABASE_URL || (import.meta as any).env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const initialAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || (import.meta as any).env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

let activeClient = createClient(initialUrl, initialAnonKey);

export function isSupabaseConfigured(): boolean {
  const url = (import.meta as any).env.VITE_SUPABASE_URL || (import.meta as any).env.NEXT_PUBLIC_SUPABASE_URL;
  const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || (import.meta as any).env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!(url && !url.includes('placeholder') && key && !key.includes('placeholder'));
}

export function updateSupabaseClient(url: string, key: string) {
  if (url && key && !url.includes('placeholder')) {
    activeClient = createClient(url, key);
    console.log('[Supabase] Client updated with dynamic config:', url);
  }
}

// Proxy to route calls to the dynamically updated client
export const supabase = new Proxy({} as any, {
  get(target, prop, receiver) {
    return Reflect.get(activeClient, prop, receiver);
  },
  set(target, prop, value, receiver) {
    return Reflect.set(activeClient, prop, value, receiver);
  }
});

/**
 * Đảm bảo bucket tồn tại trong Supabase Storage.
 * Nếu chưa tồn tại, hàm sẽ cố gắng tạo mới bucket với cấu hình public.
 */
export async function ensureBucketExists(bucketName: string = 'AD Luxury Travel') {
  try {
    // Thử tạo mới bucket, nếu đã tồn tại thì Supabase sẽ trả về lỗi duplicate/already exists (có thể bỏ qua)
    const { error } = await supabase.storage.createBucket(bucketName, {
      public: true,
    });
    
    if (error) {
      const msg = error.message || '';
      if (!msg.toLowerCase().includes('already exists') && !msg.toLowerCase().includes('duplicate')) {
        console.warn(`Lưu ý khi kiểm tra/tạo bucket "${bucketName}":`, msg);
      }
    } else {
      console.log(`Đã tạo thành công bucket public "${bucketName}"`);
    }
  } catch (err) {
    console.error(`Không thể bảo đảm trạng thái của bucket "${bucketName}":`, err);
  }
}

