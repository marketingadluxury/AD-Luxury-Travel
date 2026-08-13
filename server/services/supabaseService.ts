import { createClient, SupabaseClient } from '@supabase/supabase-js';
import express from 'express';

export const getSupabaseClient = (req?: express.Request): SupabaseClient => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration is missing in environment variables.');
  }

  const options: any = {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  };

  const authHeader = req?.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    options.global = {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  return createClient(supabaseUrl, supabaseKey, options);
};

export const getAdminSupabaseClient = (req?: express.Request): SupabaseClient => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  
  const key = serviceRoleKey || anonKey;

  if (!supabaseUrl || !key) {
    throw new Error('Supabase configuration is missing in environment variables.');
  }

  const options: any = {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  };

  if (!serviceRoleKey && req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      options.global = {
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
    }
  }

  return createClient(supabaseUrl, key, options);
};

export async function ensureSupabaseBucketExists(bucketName: string, supabase: SupabaseClient): Promise<void> {
  try {
    const { error } = await supabase.storage.createBucket(bucketName, {
      public: true
    });
    if (error) {
      const msg = error.message || '';
      if (!msg.toLowerCase().includes('already exists') && !msg.toLowerCase().includes('duplicate')) {
        console.warn(`[Supabase] Bucket creation notice for "${bucketName}":`, msg);
      }
    } else {
      console.log(`[Supabase] Created public bucket "${bucketName}"`);
    }
  } catch (err) {
    console.warn(`[Supabase] Could not create bucket "${bucketName}":`, err);
  }
}

export async function uploadFileToSupabase(
  bucketName: string,
  filePath: string,
  buffer: Buffer,
  mimeType: string,
  supabase: SupabaseClient
): Promise<string> {
  await ensureSupabaseBucketExists(bucketName, supabase);
  const { error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: true
    });
  if (error) {
    throw new Error(`[Supabase] Upload failed: ${error.message}`);
  }
  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);
  return publicUrl;
}

export function getPathFromPublicUrl(url: string): string | null {
  if (!url) return null;
  const prefixes = [
    '/storage/v1/object/public/crm-attachments/',
    '/storage/v1/object/public/AD-Luxury-Travel/',
    '/storage/v1/object/public/AD%20Luxury%20Travel/',
    '/storage/v1/object/public/AD Luxury Travel/'
  ];
  
  const decodedUrl = decodeURIComponent(url);
  for (const prefix of prefixes) {
    const index = decodedUrl.indexOf(prefix);
    if (index !== -1) {
      return decodedUrl.substring(index + prefix.length);
    }
  }
  return null;
}

export async function getAuthenticatedUserEmail(req?: express.Request): Promise<string | undefined> {
  if (!req) return undefined;
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
      if (supabaseUrl && anonKey) {
        const client = createClient(supabaseUrl, anonKey);
        const { data: { user } } = await client.auth.getUser(token);
        return user?.email;
      }
    }
  } catch (err) {
    console.warn('[Auth] Failed to get user email from token:', err);
  }
  return undefined;
}
