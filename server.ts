import express from 'express';
import path from 'path';
import { JWT, OAuth2Client } from 'google-auth-library';
import multer from 'multer';
// Vite will be imported dynamically in development mode only
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import cors from 'cors';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`[Request]: ${req.method} ${req.url}`);
  next();
});

// Log all API requests for debugging
app.use('/api/*', (req, res, next) => {
  console.log(`[API Request]: ${req.method} ${req.originalUrl}`);
  next();
});

// Google Drive Authorization & Helpers
async function getGoogleDriveAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    console.log('[Drive] Authorizing using OAuth Refresh Token...');
    const oauth2Client = new OAuth2Client(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const tokenResponse = await oauth2Client.getAccessToken();
    if (!tokenResponse.token) {
      throw new Error('Failed to retrieve access token from Google OAuth Refresh Token.');
    }
    return tokenResponse.token;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (email && rawKey && rawKey.trim() && rawKey.includes('PRIVATE KEY')) {
    console.log('[Drive] Authorizing using Service Account...');
    const key = rawKey.replace(/\\n/g, '\n');
    const authClient = new JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const creds = await authClient.authorize();
    if (!creds.access_token) {
      throw new Error('Failed to retrieve access token from Google Auth Service Account.');
    }
    return creds.access_token;
  }

  throw new Error('Google Drive credentials are not configured. Please define GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, and GOOGLE_DRIVE_REFRESH_TOKEN in your environment.');
}

async function searchFolder(folderName: string, parentId?: string, token?: string): Promise<string | null> {
  const safeName = folderName.replace(/'/g, "\\'");
  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  
  if (!res.ok) {
    const errText = await res.text();
    console.error('[Drive] Search folder failed:', errText);
    return null;
  }
  
  const data: any = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

async function createFolder(folderName: string, parentId?: string, token?: string): Promise<string> {
  const metadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) {
    metadata.parents = [parentId];
  }
  
  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[Drive] Create folder failed: ${errText}`);
  }
  
  const data: any = await res.json();
  return data.id;
}

async function makeFolderPublic(fileId: string, token?: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone'
    })
  });
  
  if (!res.ok) {
    const errText = await res.text();
    console.warn('[Drive] Failed to make folder public:', errText);
  }
}

async function getFolderWebViewLink(fileId: string, token?: string): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[Drive] Failed to get webViewLink: ${errText}`);
  }
  
  const data: any = await res.json();
  return data.webViewLink;
}

async function getOrCreatePassengerFolder(fullName: string, passportNumber: string, token: string): Promise<string> {
  const cleanPassport = (passportNumber || 'CHUA_CO_HC').trim().toUpperCase();
  const getInitials = (name: string) => {
    if (!name) return 'KH';
    const words = name.trim().split(/\s+/);
    return words.map(w => w.charAt(0).toUpperCase()).join('');
  };
  const initials = getInitials(fullName);
  const folderName = `${cleanPassport}-${initials}`;

  // 1. Get or create AD Luxury Travel root folder
  let rootId = await searchFolder('AD Luxury Travel', undefined, token);
  if (!rootId) {
    rootId = await createFolder('AD Luxury Travel', undefined, token);
    await makeFolderPublic(rootId, token);
  }

  // 2. Get or create "Khách hàng" folder inside root
  let khachHangFolderId = await searchFolder('Khách hàng', rootId, token);
  if (!khachHangFolderId) {
    khachHangFolderId = await createFolder('Khách hàng', rootId, token);
    await makeFolderPublic(khachHangFolderId, token);
  }

  // 3. Get or create passenger folder inside "Khách hàng"
  let passengerFolderId = await searchFolder(folderName, khachHangFolderId, token);
  if (!passengerFolderId) {
    passengerFolderId = await createFolder(folderName, khachHangFolderId, token);
    await makeFolderPublic(passengerFolderId, token);
  }

  return passengerFolderId;
}

async function getOrCreateTourFolder(category: string, token: string): Promise<string> {
  const cleanCategory = (category || 'Chung').trim();

  // 1. Get or create AD Luxury Travel root folder
  let rootId = await searchFolder('AD Luxury Travel', undefined, token);
  if (!rootId) {
    rootId = await createFolder('AD Luxury Travel', undefined, token);
    await makeFolderPublic(rootId, token);
  }

  // 2. Get or create "Tour" folder inside root
  let tourFolderId = await searchFolder('Tour', rootId, token);
  if (!tourFolderId) {
    tourFolderId = await createFolder('Tour', rootId, token);
    await makeFolderPublic(tourFolderId, token);
  }

  // 3. Get or create category folder inside "Tour"
  let categoryFolderId = await searchFolder(cleanCategory, tourFolderId, token);
  if (!categoryFolderId) {
    categoryFolderId = await createFolder(cleanCategory, tourFolderId, token);
    await makeFolderPublic(categoryFolderId, token);
  }

  return categoryFolderId;
}

async function uploadFileToSupabase(
  bucketName: string,
  filePath: string,
  buffer: Buffer,
  mimeType: string,
  supabase: any
): Promise<string> {
  await ensureSupabaseBucketExists(bucketName, supabase);
  const { data, error } = await supabase.storage
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

async function uploadFileToGoogleDrive(
  fileName: string, 
  mimeType: string, 
  buffer: Buffer, 
  parentId: string, 
  token: string
): Promise<{ id: string; webViewLink: string }> {
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    parents: [parentId]
  };

  const metadataPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  
  const head = Buffer.from(`${delimiter}${metadataPart}${delimiter}Content-Type: ${mimeType}\r\n\r\n`);
  const tail = Buffer.from(closeDelimiter);

  const bodyBuffer = Buffer.concat([head, buffer, tail]);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: bodyBuffer
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[Drive] File upload failed: ${errText}`);
  }

  const data: any = await res.json();
  
  // Make the file public so people with link can view it
  await makeFolderPublic(data.id, token);
  
  return {
    id: data.id,
    webViewLink: data.webViewLink
  };
}

function getGoogleDriveFileId(url: string): string | null {
  const match = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/) || url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

async function deleteGoogleDriveFile(fileId: string, token: string): Promise<void> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 404) {
        console.log(`[Drive] File ${fileId} không tồn tại hoặc đã bị xóa trước đó trên Google Drive.`);
        return;
      }
      console.warn(`[Drive] Không thể xóa file vật lý ${fileId} trên Google Drive (Có thể do quyền hạn hoặc cấu hình):`, errText);
    } else {
      console.log(`[Drive] Đã xóa thành công file vật lý ${fileId} trên Google Drive.`);
    }
  } catch (error: any) {
    console.warn(`[Drive] Gặp lỗi khi gọi API xóa file ${fileId}:`, error.message || error);
  }
}

// Supabase helper
const getSupabaseClient = (req?: express.Request) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  // Cho phép sử dụng SUPABASE_SERVICE_ROLE_KEY nếu có để bypass hoàn toàn RLS trên server-side
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration is missing in environment variables. Please check SUPABASE_URL and SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.');
  }

  const options: any = {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  };

  // Trích xuất Authorization JWT token của người dùng từ frontend gửi lên nếu có
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

// Helper to create a privileged admin Supabase client using Service Role Key
const getAdminSupabaseClient = (req?: express.Request) => {
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

  // If Service Role Key is missing but user auth headers are available, attach them to the client
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

// Helper to ensure Supabase Storage bucket exists
async function ensureSupabaseBucketExists(bucketName: string, supabase: any) {
  try {
    const { error } = await supabase.storage.createBucket(bucketName, {
      public: true
    });
    if (error) {
      const msg = error.message || '';
      if (!msg.toLowerCase().includes('already exists') && !msg.toLowerCase().includes('duplicate')) {
        console.warn(`Lưu ý khi tạo bucket "${bucketName}":`, msg);
      }
    } else {
      console.log(`[Supabase] Đã tự động tạo thành công bucket public "${bucketName}"`);
    }
  } catch (err) {
    console.warn(`[Supabase] Không thể tạo bucket "${bucketName}":`, err);
  }
}

// Extract relative path from a Supabase public storage URL
function getPathFromPublicUrl(url: string): string | null {
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

// --- API ROUTES ---

// Expose Supabase config dynamically to prevent missing VITE_ prefix issues in the client
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  });
});

// Get current storage system status
app.get('/api/drive-status', (req, res) => {
  const hasServiceAccount = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.includes('PRIVATE KEY'));
  const hasOAuth = !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
  
  if (hasServiceAccount || hasOAuth) {
    res.json({
      active: true,
      storageType: 'Google Drive',
      email: (hasServiceAccount ? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL : null) || 'OAuth authorized'
    });
  } else {
    res.json({
      active: false,
      storageType: 'Google Drive (Chưa cấu hình)',
      email: null
    });
  }
});

// Create Google Drive passenger folder
app.post('/api/create-folder', async (req, res) => {
  try {
    const { passportNumber, fullName } = req.body;
    
    const hasServiceAccount = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.includes('PRIVATE KEY'));
    const hasOAuth = !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
    
    if (!hasServiceAccount && !hasOAuth) {
      res.status(400).json({ 
        error: 'Google Drive chưa được cấu hình. Vui lòng thiết lập biến môi trường GOOGLE_SERVICE_ACCOUNT_EMAIL và GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY trong file .env để sử dụng hệ thống.' 
      });
      return;
    }

    console.log(`[Drive] Đang tạo thư mục Google Drive cho: ${fullName}`);
    const token = await getGoogleDriveAccessToken();
    const passengerFolderId = await getOrCreatePassengerFolder(fullName, passportNumber, token);
    const webViewLink = await getFolderWebViewLink(passengerFolderId, token);
    
    res.json({
      success: true,
      url: webViewLink,
      storage: 'drive'
    });
  } catch (error: any) {
    console.error('Lỗi API /api/create-folder:', error);
    res.status(500).json({ error: error.message || 'Lỗi tạo thư mục lưu trữ trên Google Drive' });
  }
});

// Unified File Upload API (Google Drive with Supabase Storage fallback)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  console.log('[API] /api/upload - Start processing');
  try {
    if (!req.file) {
      console.warn('[API] /api/upload - No file received');
      res.status(400).json({ error: 'Không tìm thấy file nào được gửi lên.' });
      return;
    }

    console.log('[API] /api/upload - File received:', req.file.originalname, 'Size:', req.file.size);
    console.log('[API] /api/upload - Body:', req.body);

    const hasServiceAccount = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.includes('PRIVATE KEY'));
    const hasOAuth = !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
    const driveActive = hasServiceAccount || hasOAuth;

    const file = req.file;
    const isTourUpload = req.body.uploadType === 'tour' || !!req.body.tourCode;

    if (isTourUpload) {
      const tourCode = req.body.tourCode || 'TOUR_CODE';
      const category = req.body.category || 'Chung';
      const ext = path.extname(file.originalname) || '.pdf';
      const fileName = `${tourCode.trim().toUpperCase()}${ext}`;

      if (driveActive) {
        console.log(`[Drive] Đang tải file lịch trình tour lên Google Drive cho Tour: ${tourCode} (${category})`);
        const token = await getGoogleDriveAccessToken();
        const tourFolderId = await getOrCreateTourFolder(category, token);
        const result = await uploadFileToGoogleDrive(fileName, file.mimetype, file.buffer, tourFolderId, token);
        res.json({
          success: true,
          url: result.webViewLink,
          fileName: fileName,
          storage: 'drive'
        });
      } else {
        console.log(`[Supabase Fallback] Đang tải file lịch trình tour lên Supabase: Tour/${category}/${fileName}`);
        const supabase = getSupabaseClient(req);
        const publicUrl = await uploadFileToSupabase(
          'crm-attachments',
          `Tour/${category}/${fileName}`,
          file.buffer,
          file.mimetype,
          supabase
        );
        res.json({
          success: true,
          url: publicUrl,
          fileName: fileName,
          storage: 'supabase'
        });
      }
      return;
    }

    // Passenger profile upload
    const passportNumber = req.body.passportNumber || '';
    const fullName = req.body.fullName || '';

    const cleanPassport = (passportNumber || 'CHUA_CO_HC').trim().toUpperCase();
    
    // Helper to get initials
    const getInitials = (name: string) => {
      if (!name) return 'KH';
      const words = name.trim().split(/\s+/);
      return words.map(w => w.charAt(0).toUpperCase()).join('');
    };
    
    const initials = getInitials(fullName);

    // Standardized file naming: {SO_HO_CHIEU}-{CHU_CAI_VIET_TAT_TEN}.{ten_file_goc}
    const cleanFileName = file.originalname.trim().replace(/\s+/g, '_');
    const fileName = `${cleanPassport}-${initials}.${cleanFileName}`;

    if (driveActive) {
      console.log(`[Drive] Đang tải file lên Google Drive cho khách hàng: ${fullName} (${cleanPassport})`);
      const token = await getGoogleDriveAccessToken();
      const passengerFolderId = await getOrCreatePassengerFolder(fullName, passportNumber, token);
      const result = await uploadFileToGoogleDrive(fileName, file.mimetype, file.buffer, passengerFolderId, token);
      res.json({
        success: true,
        url: result.webViewLink,
        fileName: fileName,
        storage: 'drive'
      });
    } else {
      console.log(`[Supabase Fallback] Đang tải file khách hàng lên Supabase: Khách hàng/${cleanPassport}-${initials}/${fileName}`);
      const supabase = getSupabaseClient(req);
      const publicUrl = await uploadFileToSupabase(
        'crm-attachments',
        `Khách hàng/${cleanPassport}-${initials}/${fileName}`,
        file.buffer,
        file.mimetype,
        supabase
      );
      res.json({
        success: true,
        url: publicUrl,
        fileName: fileName,
        storage: 'supabase'
      });
    }
  } catch (error: any) {
    console.error('Lỗi API /api/upload:', error);
    res.status(500).json({ error: error.message || 'Lỗi tải file lên hệ thống' });
  }
});

// Unified File Deletion API (Google Drive with legacy Supabase Support)
app.post('/api/delete', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      res.status(400).json({ error: 'Thiếu URL của file cần xóa.' });
      return;
    }
    
    const isGoogleDrive = url.includes('drive.google.com');
    const isSupabase = url.includes('supabase.com/dashboard/project') || url.includes('supabase.co');

    if (isGoogleDrive) {
      console.log(`[Drive] Đang xóa file trên Google Drive: ${url}`);
      const fileId = getGoogleDriveFileId(url);
      if (!fileId) {
        res.status(400).json({ error: 'Không thể trích xuất ID file Google Drive từ URL.' });
        return;
      }
      
      const hasServiceAccount = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.includes('PRIVATE KEY'));
      const hasOAuth = !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);

      if (!hasServiceAccount && !hasOAuth) {
        console.warn('[Drive] Google Drive chưa được cấu hình, chỉ thực hiện gỡ bỏ liên kết trong hệ thống.');
        res.json({ success: true, message: 'Google Drive chưa được cấu hình, chỉ gỡ liên kết.', storage: 'drive' });
        return;
      }

      try {
        const token = await getGoogleDriveAccessToken();
        await deleteGoogleDriveFile(fileId, token);
        res.json({ success: true, storage: 'drive' });
      } catch (err: any) {
        console.error('Lỗi khi xóa file thực tế trên Google Drive:', err);
        // Ngay cả khi xảy ra lỗi khi gọi xóa file trên Drive (vấn đề phân quyền, hết hạn token, etc.), 
        // chúng ta vẫn nên trả về success: true để phía Client có thể tiếp tục gỡ bỏ liên kết trong database thành công.
        res.json({ success: true, warning: 'Lỗi gỡ file vật lý nhưng đã đồng ý gỡ liên kết trong database.', storage: 'drive' });
      }
    } else if (isSupabase) {
      // Giữ cơ chế xóa dự phòng từ Supabase Storage cho các file cũ của khách hàng
      console.log(`[Supabase] Đang xóa file cũ: ${url}`);
      const supabase = getSupabaseClient(req);
      const storagePath = getPathFromPublicUrl(url);
      
      if (storagePath) {
        let { error } = await supabase.storage.from('AD Luxury Travel').remove([storagePath]);
        
        if (error && error.message.includes('not found')) {
           error = (await supabase.storage.from('crm-attachments').remove([storagePath])).error;
        }
        
        if (error) throw error;
        res.json({ success: true, storage: 'supabase' });
      } else {
        res.status(400).json({ error: 'URL Supabase Storage không hợp lệ.' });
      }
    } else {
      res.status(400).json({ error: 'Đường dẫn file không được hỗ trợ để xóa.' });
    }
  } catch (error: any) {
    console.error('Lỗi API /api/delete:', error);
    res.status(500).json({ error: error.message || 'Lỗi xóa file' });
  }
});

// --- ADMIN USER MANAGEMENT API ENDPOINTS ---

let mockUsers = [
  {
    id: 'a809b4db-9ee7-4c07-b352-09419106093d',
    full_name: 'Quản trị viên hệ thống',
    email: 'marketing@adluxury.net',
    phone: '0911832961',
    company_name: 'AD Luxury Travel',
    role: 'admin',
    created_at: new Date().toISOString()
  },
  {
    id: '1a3df3bf-7cf9-42b7-a8a2-f90b9b3df985',
    full_name: 'Điều hành Tour',
    email: 'operator@adluxury.net',
    phone: '0988777666',
    company_name: 'AD Luxury Travel',
    role: 'operating',
    created_at: new Date().toISOString()
  },
  {
    id: 'f920875c-75b2-4d22-841c-b71524317181',
    full_name: 'Kế toán Trưởng',
    email: 'accounting@adluxury.net',
    phone: '0977666555',
    company_name: 'AD Luxury Travel',
    role: 'accounting',
    created_at: new Date().toISOString()
  }
];

// GET list of users/profiles
app.get('/api/admin/users', async (req, res) => {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      return res.json(mockUsers);
    }
    
    const client = getAdminSupabaseClient(req);
    const { data: profiles, error: pError } = await client.from('profiles').select('*').order('created_at', { ascending: false });
    
    if (pError) {
      console.warn('Lỗi khi truy vấn profiles từ Supabase:', pError.message || pError);
      return res.json(mockUsers);
    }
    
    let authUsers: any[] = [];
    if (hasServiceRole) {
      try {
        const { data, error: uError } = await client.auth.admin.listUsers();
        if (!uError && data && data.users) {
          authUsers = data.users;
        }
      } catch (e: any) {
        console.warn('Không thể truy vấn danh sách auth users (thiếu Service Role Key hoặc quyền hạn):', e.message || e);
      }
    }
    
    // Gộp email vào profiles
    const mergedUsers = (profiles || []).map(p => {
      const authUser = authUsers.find(u => u.id === p.id);
      return {
        id: p.id,
        full_name: p.full_name || '',
        phone: p.phone || '',
        company_name: p.company_name || '',
        role: p.role || 'CTV',
        created_at: p.created_at,
        email: authUser?.email || p.email || ''
      };
    });
    
    if (mergedUsers.length === 0) {
      return res.json(mockUsers);
    }
    
    res.json(mergedUsers);
  } catch (err: any) {
    console.error('Lỗi API /api/admin/users GET:', err);
    res.json(mockUsers);
  }
});

// CREATE a new user/profile
app.post('/api/admin/users', express.json(), async (req, res) => {
  try {
    const { full_name, phone, company_name, role, email, password } = req.body;
    
    if (!email || !full_name) {
      return res.status(400).json({ error: 'Email và họ tên là bắt buộc.' });
    }
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      const newUser = {
        id: crypto.randomUUID(),
        full_name,
        phone: phone || '',
        company_name: company_name || '',
        role: role || 'CTV',
        email,
        created_at: new Date().toISOString()
      };
      mockUsers.unshift(newUser);
      return res.json({ success: true, user: newUser });
    }
    
    if (!hasServiceRole) {
      return res.status(400).json({ 
        error: 'Tính năng tạo tài khoản yêu cầu cấu hình biến môi trường SUPABASE_SERVICE_ROLE_KEY trong mục Cài đặt (Settings -> Secrets) trên AI Studio.' 
      });
    }
    
    const client = getAdminSupabaseClient(req);
    let userId: string = crypto.randomUUID();
    
    // Tạo auth user bằng Admin API
    try {
      const { data: authData, error: authError } = await client.auth.admin.createUser({
        email,
        password: password || '12345678a',
        email_confirm: true,
        user_metadata: { full_name }
      });
      
      if (authError) throw authError;
      if (authData && authData.user) {
        userId = authData.user.id;
      }
    } catch (authErr: any) {
      console.error('Lỗi khi tạo tài khoản Auth:', authErr);
      return res.status(400).json({ error: `Lỗi đăng ký tài khoản Auth: ${authErr.message || authErr}` });
    }
    
    const { error: pError } = await client.from('profiles').upsert({
      id: userId,
      full_name,
      phone: phone || '',
      company_name: company_name || '',
      role: role || 'CTV'
    });
    
    if (pError) {
      return res.status(400).json({ error: `Lỗi lưu thông tin profile: ${pError.message}` });
    }
    
    res.json({
      success: true,
      user: {
        id: userId,
        full_name,
        phone,
        company_name,
        role,
        email,
        created_at: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('Lỗi API /api/admin/users POST:', err);
    res.status(500).json({ error: err.message || 'Lỗi thêm người dùng mới' });
  }
});

// UPDATE user details and role
app.put('/api/admin/users/:id', express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, company_name, role, email, password } = req.body;
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      const userIndex = mockUsers.findIndex(u => u.id === id);
      if (userIndex !== -1) {
        mockUsers[userIndex] = {
          ...mockUsers[userIndex],
          full_name: full_name !== undefined ? full_name : mockUsers[userIndex].full_name,
          phone: phone !== undefined ? phone : mockUsers[userIndex].phone,
          company_name: company_name !== undefined ? company_name : mockUsers[userIndex].company_name,
          role: role !== undefined ? role : mockUsers[userIndex].role,
          email: email !== undefined ? email : mockUsers[userIndex].email
        };
        return res.json({ success: true, user: mockUsers[userIndex] });
      }
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }
    
    if (!hasServiceRole) {
      return res.status(400).json({ 
        error: 'Tính năng cập nhật tài khoản yêu cầu cấu hình biến môi trường SUPABASE_SERVICE_ROLE_KEY trong mục Cài đặt (Settings -> Secrets) trên AI Studio.' 
      });
    }
    
    const client = getAdminSupabaseClient(req);
    
    const { error: pError } = await client.from('profiles').update({
      full_name,
      phone,
      company_name,
      role
    }).eq('id', id);
    
    if (pError) {
      return res.status(400).json({ error: `Lỗi cập nhật profile: ${pError.message}` });
    }
    
    try {
      const updateData: any = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;
      
      if (Object.keys(updateData).length > 0) {
        const { error: authError } = await client.auth.admin.updateUserById(id, updateData);
        if (authError) console.warn('Lưu ý khi cập nhật thông tin Auth:', authError.message);
      }
    } catch (authErr: any) {
      console.warn('Không thể cập nhật thông tin Auth (thiếu quyền):', authErr.message || authErr);
    }
    
    res.json({ success: true });
  } catch (err: any) {
    console.error('Lỗi API /api/admin/users PUT:', err);
    res.status(500).json({ error: err.message || 'Lỗi cập nhật thông tin người dùng' });
  }
});

// DELETE user
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      mockUsers = mockUsers.filter(u => u.id !== id);
      return res.json({ success: true });
    }
    
    if (!hasServiceRole) {
      return res.status(400).json({ 
        error: 'Tính năng xóa tài khoản yêu cầu cấu hình biến môi trường SUPABASE_SERVICE_ROLE_KEY trong mục Cài đặt (Settings -> Secrets) trên AI Studio.' 
      });
    }
    
    const client = getAdminSupabaseClient(req);
    
    const { error: pError } = await client.from('profiles').delete().eq('id', id);
    if (pError) {
      return res.status(400).json({ error: `Lỗi xóa profile: ${pError.message}` });
    }
    
    try {
      const { error: authError } = await client.auth.admin.deleteUser(id);
      if (authError) console.warn('Lưu ý khi xóa tài khoản Auth:', authError.message);
    } catch (authErr: any) {
      console.warn('Không thể xóa tài khoản Auth (thiếu quyền):', authErr.message || authErr);
    }
    
    res.json({ success: true });
  } catch (err: any) {
    console.error('Lỗi API /api/admin/users DELETE:', err);
    res.status(500).json({ error: err.message || 'Lỗi xóa người dùng' });
  }
});

// Global JSON error handler to prevent HTML error responses
app.use('/api/*', (req, res, next) => {
  console.warn(`[404] API Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: `API route ${req.originalUrl} không tồn tại trên máy chủ.` });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error Handler]:', err);
  const status = err.status || err.statusCode || 500;
  
  if (req.path.startsWith('/api/')) {
    return res.status(status).json({
      error: err.message || 'Đã xảy ra lỗi hệ thống trên API',
      status
    });
  }
  
  next(err);
});

// Serve frontend assets & mount Vite dev server middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Khởi động thành công tại http://localhost:${PORT}`);
      console.log(`[Server] Đang sử dụng Supabase Storage`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
