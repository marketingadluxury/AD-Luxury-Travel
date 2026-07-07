import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

