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

  const hasOAuth = !!(clientId && clientSecret && refreshToken);

  if (!hasOAuth) {
    throw new Error('Cấu hình Google Drive OAuth 2.0 chưa hoàn tất. Vui lòng định nghĩa GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, và GOOGLE_DRIVE_REFRESH_TOKEN trong biến môi trường.');
  }

  try {
    console.log('[Drive] Authorizing using OAuth 2.0 Refresh Token...');
    const oauth2Client = new OAuth2Client(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const tokenResponse = await oauth2Client.getAccessToken();
    if (!tokenResponse.token) {
      throw new Error('Failed to retrieve access token from Google OAuth Refresh Token.');
    }
    console.log('[Drive] OAuth 2.0 authorization successful.');
    return tokenResponse.token;
  } catch (err: any) {
    console.error('[Drive] OAuth 2.0 authorization failed:', err.message || err);
    throw new Error(`Google Drive authorization failed: ${err.message || err}`);
  }
}

async function searchFolder(folderName: string, parentId?: string, token?: string): Promise<string | null> {
  const safeName = folderName.replace(/'/g, "\\'");
  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
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
  
  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink&supportsAllDrives=true', {
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
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`;
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
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink&supportsAllDrives=true`;
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

function getDriveRootParentId(): string | undefined {
  return process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || 
         process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || 
         process.env.GOOGLE_DRIVE_FOLDER_ID ||
         process.env.DRIVE_PARENT_FOLDER_ID ||
         process.env.DRIVE_ROOT_ID;
}

async function getOrCreateADLuxuryTravelRootFolder(baseParentId: string | undefined, token: string): Promise<string> {
  let rootId = await searchFolder('AD Luxury Travel', baseParentId, token);
  if (!rootId && baseParentId) {
    console.log('[Drive] Không tìm thấy "AD Luxury Travel" trong thư mục cha chỉ định. Đang tìm kiếm trên toàn bộ Drive phòng trường hợp người dùng di chuyển ra ngoài...');
    rootId = await searchFolder('AD Luxury Travel', undefined, token);
  }
  
  if (!rootId) {
    console.log('[Drive] Thư mục "AD Luxury Travel" chưa tồn tại, đang tạo mới...');
    rootId = await createFolder('AD Luxury Travel', baseParentId, token);
    await makeFolderPublic(rootId, token);
  } else {
    console.log(`[Drive] Đã tìm thấy thư mục "AD Luxury Travel" hiện có (ID: ${rootId})`);
  }
  return rootId;
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
  const baseParentId = getDriveRootParentId();

  // 1. Get or create AD Luxury Travel root folder
  const rootId = await getOrCreateADLuxuryTravelRootFolder(baseParentId, token);

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
  const baseParentId = getDriveRootParentId();

  // 1. Get or create AD Luxury Travel root folder
  const rootId = await getOrCreateADLuxuryTravelRootFolder(baseParentId, token);

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

async function getOrCreateVisaFolder(token: string): Promise<string> {
  const baseParentId = getDriveRootParentId();

  // 1. Get or create AD Luxury Travel root folder
  const rootId = await getOrCreateADLuxuryTravelRootFolder(baseParentId, token);

  // 2. Search for existing "Visa" folder in AD Luxury Travel first
  let visaFolderId = await searchFolder('Visa', rootId, token);
  if (!visaFolderId && !baseParentId) {
    // Search for any existing "Visa" folder globally, in case user created it at root level (only if no parent is specified)
    visaFolderId = await searchFolder('Visa', undefined, token);
  }
  
  if (!visaFolderId) {
    // If not found anywhere, create under AD Luxury Travel
    visaFolderId = await createFolder('Visa', rootId, token);
    await makeFolderPublic(visaFolderId, token);
  }

  return visaFolderId;
}

async function getOrCreateVisaServiceFolder(visaCode: string, visaFolderId: string, token: string): Promise<string> {
  const cleanVisaCode = (visaCode || 'Dich_vu_Visa').trim().replace(/[\/\\\:\*\?\"\<\>\|]/g, '_'); // Loại bỏ ký tự đặc biệt không hợp lệ trong tên folder
  let serviceFolderId = await searchFolder(cleanVisaCode, visaFolderId, token);
  if (!serviceFolderId) {
    serviceFolderId = await createFolder(cleanVisaCode, visaFolderId, token);
    await makeFolderPublic(serviceFolderId, token);
  }
  return serviceFolderId;
}

async function getOrCreateTourFolderV2(tourCode: string, token: string): Promise<string> {
  const cleanTourCode = (tourCode || 'TOUR_CHUNG').trim().replace(/[\/\\\:\*\?\"\<\>\|]/g, '_');
  const baseParentId = getDriveRootParentId();

  // 1. Get or create AD Luxury Travel root folder
  const rootId = await getOrCreateADLuxuryTravelRootFolder(baseParentId, token);

  // 2. Get or create "Tour" folder inside root
  let tourFolderId = await searchFolder('Tour', rootId, token);
  if (!tourFolderId) {
    tourFolderId = await createFolder('Tour', rootId, token);
    await makeFolderPublic(tourFolderId, token);
  }

  // 3. Get or create [Mã Tour] folder inside "Tour"
  let targetTourFolderId = await searchFolder(cleanTourCode, tourFolderId, token);
  if (!targetTourFolderId) {
    targetTourFolderId = await createFolder(cleanTourCode, tourFolderId, token);
    await makeFolderPublic(targetTourFolderId, token);
  }

  return targetTourFolderId;
}

async function getOrCreateTourSubFolderV2(tourCode: string, subFolder: 'Đơn hàng' | 'Chi phí', token: string): Promise<string> {
  const tourFolderId = await getOrCreateTourFolderV2(tourCode, token);

  let subFolderId = await searchFolder(subFolder, tourFolderId, token);
  if (!subFolderId) {
    subFolderId = await createFolder(subFolder, tourFolderId, token);
    await makeFolderPublic(subFolderId, token);
  }

  return subFolderId;
}

async function getOrCreateOrderFolderV2(tourCode: string, orderCode: string, token: string): Promise<string> {
  const donHangFolderId = await getOrCreateTourSubFolderV2(tourCode, 'Đơn hàng', token);

  const cleanOrderCode = (orderCode || 'Don_hang').trim().replace(/[\/\\\:\*\?\"\<\>\|]/g, '_');
  let orderFolderId = await searchFolder(cleanOrderCode, donHangFolderId, token);
  if (!orderFolderId) {
    orderFolderId = await createFolder(cleanOrderCode, donHangFolderId, token);
    await makeFolderPublic(orderFolderId, token);
  }

  return orderFolderId;
}

async function getTourCodeFromOrderOrTour(
  orderCode: string, 
  bodyTourCode: string | undefined, 
  supabase: any
): Promise<{ tourCode: string; isTourCodeDirectly: boolean; orderId?: string }> {
  const cleanTourCodeParam = (bodyTourCode || '').trim();
  const cleanOrderCodeParam = (orderCode || '').trim();

  const invalidPlaceholders = ['CHUA_RO', 'CHIPHI_TOUR', 'TOUR_CHUNG', 'TOUR', 'DON_HANG', 'CHIPHI'];
  
  // 1. If explicit tourCode is provided and valid
  if (cleanTourCodeParam && !invalidPlaceholders.includes(cleanTourCodeParam.toUpperCase())) {
    const isGenericOrderCode = !cleanOrderCodeParam || invalidPlaceholders.includes(cleanOrderCodeParam.toUpperCase()) || cleanOrderCodeParam.toUpperCase() === cleanTourCodeParam.toUpperCase();
    return {
      tourCode: cleanTourCodeParam.toUpperCase(),
      isTourCodeDirectly: isGenericOrderCode,
      orderId: isGenericOrderCode ? undefined : cleanOrderCodeParam
    };
  }

  const cleanCode = cleanOrderCodeParam;
  if (!cleanCode || invalidPlaceholders.includes(cleanCode.toUpperCase())) {
    return { tourCode: 'TOUR_CHUNG', isTourCodeDirectly: true };
  }

  try {
    // 2. Check if cleanCode is directly a tour code in `tours` table
    const { data: tourByCode } = await supabase
      .from('tours')
      .select('code')
      .eq('code', cleanCode)
      .maybeSingle();

    if (tourByCode && tourByCode.code) {
      return { tourCode: tourByCode.code, isTourCodeDirectly: true };
    }

    // 3. Check if cleanCode matches an order/booking ID
    const { data: bookingData } = await supabase
      .from('bookings')
      .select('id, tour_id')
      .eq('id', cleanCode)
      .maybeSingle();

    let targetBooking = bookingData;

    if (!targetBooking) {
      const { data: bookingsLike } = await supabase
        .from('bookings')
        .select('id, tour_id')
        .ilike('id', `${cleanCode}%`)
        .limit(1);

      if (bookingsLike && bookingsLike.length > 0) {
        targetBooking = bookingsLike[0];
      }
    }

    if (targetBooking && targetBooking.tour_id) {
      const { data: tourData } = await supabase
        .from('tours')
        .select('code')
        .eq('id', targetBooking.tour_id)
        .maybeSingle();

      if (tourData && tourData.code) {
        return { tourCode: tourData.code, isTourCodeDirectly: false, orderId: targetBooking.id };
      }
    }

    // 4. Check if cleanCode is an invoice ID or invoice code in `invoices` table
    const { data: invoiceData } = await supabase
      .from('invoices')
      .select('id, order_id, description')
      .or(`id.eq.${cleanCode},invoice_code.eq.${cleanCode}`)
      .maybeSingle();

    if (invoiceData) {
      if (invoiceData.order_id) {
        const { data: invBooking } = await supabase
          .from('bookings')
          .select('id, tour_id')
          .eq('id', invoiceData.order_id)
          .maybeSingle();

        if (invBooking && invBooking.tour_id) {
          const { data: tourData } = await supabase
            .from('tours')
            .select('code')
            .eq('id', invBooking.tour_id)
            .maybeSingle();

          if (tourData && tourData.code) {
            return { tourCode: tourData.code, isTourCodeDirectly: false, orderId: invBooking.id };
          }
        }
      }

      // Try extracting Tour from description if present
      const desc = invoiceData.description || '';
      const match = desc.match(/Tour:\s*"([^"]+)"/i) || desc.match(/\[Tour:\s*"([^"]+)"\]/i) || desc.match(/Tour:\s*([A-Z0-9_-]+)/i);
      if (match && match[1]) {
        const raw = match[1].trim();
        const extractedCode = raw.split(' - ')[0].trim().toUpperCase();
        if (extractedCode) {
          return { tourCode: extractedCode, isTourCodeDirectly: true };
        }
      }
    }

    // 5. Query tours list to see if cleanCode contains a tour code
    const { data: toursList } = await supabase.from('tours').select('code').limit(100);
    if (toursList) {
      const matched = toursList.find((t: any) => t.code && cleanCode.toUpperCase().includes(t.code.toUpperCase()));
      if (matched) {
        return { tourCode: matched.code, isTourCodeDirectly: true };
      }
    }
  } catch (error) {
    console.warn('[Storage Config] Lỗi khi truy vấn thông tin Tour/Booking từ database:', error);
  }

  // Fallback: if cleanCode is not a known order, treat as direct tour cost
  return { tourCode: 'TOUR_CHUNG', isTourCodeDirectly: true };
}

async function getOrCreateOrderFolder(orderCode: string, token: string): Promise<string> {
  const cleanOrderCode = (orderCode || 'Don_hang').trim().replace(/[\/\\\:\*\?\"\<\>\|]/g, '_');
  const baseParentId = getDriveRootParentId();
  
  // 1. Get or create AD Luxury Travel root folder
  const rootId = await getOrCreateADLuxuryTravelRootFolder(baseParentId, token);

  // 2. Get or create "Đơn hàng" folder inside root
  let donHangFolderId = await searchFolder('Đơn hàng', rootId, token);
  if (!donHangFolderId) {
    donHangFolderId = await createFolder('Đơn hàng', rootId, token);
    await makeFolderPublic(donHangFolderId, token);
  }

  // 3. Get or create [Mã đơn hàng] folder inside "Đơn hàng"
  let orderFolderId = await searchFolder(cleanOrderCode, donHangFolderId, token);
  if (!orderFolderId) {
    orderFolderId = await createFolder(cleanOrderCode, donHangFolderId, token);
    await makeFolderPublic(orderFolderId, token);
  }

  return orderFolderId;
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

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true', {
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
  // Hỗ trợ các định dạng URL Google Drive phổ biến bao gồm cả các tham số query
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]+)/,
    /\/folders\/([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)/,
    /[?&]id=([a-zA-Z0-9-_]+)/,
    /\/open\?id=([a-zA-Z0-9-_]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  
  return null;
}

async function deleteGoogleDriveFile(fileId: string, token: string): Promise<void> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
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
app.get(['/api/config', '/config'], (req, res) => {
  res.json({
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  });
});

// Get current storage system status
app.get(['/api/drive-status', '/drive-status'], (req, res) => {
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
app.post(['/api/create-folder', '/create-folder'], async (req, res) => {
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
app.post(['/api/upload', '/upload'], upload.single('file'), async (req, res) => {
  console.log('[API] /api/upload - Start processing');
  try {
    if (!req.file) {
      console.warn('[API] /api/upload - No file received');
      res.status(400).json({ error: 'Không tìm thấy file nào được gửi lên.' });
      return;
    }

    console.log('[API] /api/upload - File received:', req.file.originalname, 'Size:', req.file.size);
    console.log('[API] /api/upload - Body:', req.body);

    // Decode UTF-8 for filename and body fields (Multer defaults to latin1 for multipart forms)
    const decodeUTF8 = (str: string | undefined) => {
      if (!str) return str;
      try {
        // Multer/busboy interprets UTF-8 as Latin1. Convert back to buffer and decode correctly.
        return Buffer.from(str, 'latin1').toString('utf8');
      } catch (e) {
        return str;
      }
    };

    if (req.file) {
      req.file.originalname = decodeUTF8(req.file.originalname) || req.file.originalname;
    }

    // Decode relevant body fields
    const body = { ...req.body };
    const fieldsToDecode = ['fullName', 'visaName', 'tourTitle', 'category', 'visaCode', 'tourCode'];
    fieldsToDecode.forEach(field => {
      if (body[field]) body[field] = decodeUTF8(body[field]);
    });

    const hasServiceAccount = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.includes('PRIVATE KEY'));
    const hasOAuth = !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
    const driveActive = hasServiceAccount || hasOAuth;

    const file = req.file;
    const isTourUpload = body.uploadType === 'tour' || !!body.tourCode;
    const isVisaUpload = body.uploadType === 'visa';

    if (isVisaUpload) {
      const fileName = file.originalname.trim(); // Giữ nguyên tên file gốc theo yêu cầu người dùng

      if (driveActive) {
        console.log(`[Drive] Đang tải file mẫu visa lên Google Drive vào thư mục Visa chung`);
        const token = await getGoogleDriveAccessToken();
        const visaFolderId = await getOrCreateVisaFolder(token);
        const result = await uploadFileToGoogleDrive(fileName, file.mimetype, file.buffer, visaFolderId, token);
        res.json({
          success: true,
          url: result.webViewLink,
          fileName: fileName,
          storage: 'drive'
        });
      } else {
        console.log(`[Supabase Fallback] Đang tải file mẫu visa lên Supabase: Visa/${fileName}`);
        const supabase = getSupabaseClient(req);
        const publicUrl = await uploadFileToSupabase(
          'crm-attachments',
          `Visa/${fileName}`,
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

    if (isTourUpload) {
      const tourCode = body.tourCode || 'TOUR_CODE';
      const category = body.category || 'Chung';

      if (category === 'Visa') {
        // File mẫu của từng dịch vụ visa: Lưu trong thư mục của visa đó, với tên thư mục là mã visa (ví dụ: AD Luxury Travel > Visa > VIAU)
        const fileName = file.originalname.trim();

        if (driveActive) {
          console.log(`[Drive] Đang tải file mẫu visa của từng dịch vụ lên Google Drive: AD Luxury Travel > Visa > ${tourCode}`);
          const token = await getGoogleDriveAccessToken();
          const visaFolderId = await getOrCreateVisaFolder(token);
          const serviceFolderId = await getOrCreateVisaServiceFolder(tourCode, visaFolderId, token);
          const result = await uploadFileToGoogleDrive(fileName, file.mimetype, file.buffer, serviceFolderId, token);
          res.json({
            success: true,
            url: result.webViewLink,
            fileName: fileName,
            storage: 'drive'
          });
        } else {
          console.log(`[Supabase Fallback] Đang tải file mẫu visa của từng dịch vụ lên Supabase: Visa/${tourCode}/${fileName}`);
          const supabase = getSupabaseClient(req);
          const publicUrl = await uploadFileToSupabase(
            'crm-attachments',
            `Visa/${tourCode.trim().toUpperCase()}/${fileName}`,
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

      const ext = path.extname(file.originalname) || '.pdf';
      const fileName = `${tourCode.trim().toUpperCase()}${ext}`;

      if (driveActive) {
        console.log(`[Drive] Đang tải file lịch trình tour lên Google Drive cho Tour: ${tourCode}`);
        const token = await getGoogleDriveAccessToken();
        const tourFolderId = await getOrCreateTourFolderV2(tourCode, token);
        const result = await uploadFileToGoogleDrive(fileName, file.mimetype, file.buffer, tourFolderId, token);
        res.json({
          success: true,
          url: result.webViewLink,
          fileName: fileName,
          storage: 'drive'
        });
      } else {
        console.log(`[Supabase Fallback] Đang tải file lịch trình tour lên Supabase: Tour/${tourCode.trim().toUpperCase()}/${fileName}`);
        const supabase = getSupabaseClient(req);
        const publicUrl = await uploadFileToSupabase(
          'crm-attachments',
          `Tour/${tourCode.trim().toUpperCase()}/${fileName}`,
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
    const passportNumber = body.passportNumber || '';
    const fullName = body.fullName || '';

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

// Unified Invoice Receipt Upload API (Google Drive with Supabase Storage fallback)
app.post(['/api/upload-invoice-receipt', '/upload-invoice-receipt', '/api/drive/upload', '/drive/upload'], upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { orderCode, tourCode: bodyTourCode } = req.body;

    if (!file) {
      res.status(400).json({ error: 'Không tìm thấy file để tải lên.' });
      return;
    }

    if (!orderCode && !bodyTourCode) {
      res.status(400).json({ error: 'Thiếu thông tin mã đơn hàng hoặc mã tour.' });
      return;
    }

    const hasServiceAccount = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
    const hasOAuth = !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
    const driveActive = hasServiceAccount || hasOAuth;

    const rawOrderCode = (orderCode || bodyTourCode || 'CHIPHI').trim();
    const cleanOrderCode = rawOrderCode.toUpperCase().replace(/\s+/g, '_');
    const cleanOriginalName = file.originalname.trim().replace(/\s+/g, '_');
    const fileName = `${cleanOrderCode}_${Date.now()}_${cleanOriginalName}`;

    // Khởi tạo Supabase để tra cứu mối quan hệ giữa Booking và Tour
    const supabase = getAdminSupabaseClient(req);
    const { tourCode, isTourCodeDirectly, orderId } = await getTourCodeFromOrderOrTour(orderCode, bodyTourCode, supabase);
    const actualOrderCode = orderId ? orderId.substring(0, 8).toUpperCase() : cleanOrderCode;

    if (driveActive) {
      const token = await getGoogleDriveAccessToken();
      let folderId = '';

      if (isTourCodeDirectly) {
        console.log(`[Drive] Đang tải file chi phí lên Google Drive cho Tour: ${tourCode}`);
        folderId = await getOrCreateTourSubFolderV2(tourCode, 'Chi phí', token);
      } else {
        console.log(`[Drive] Đang tải file đơn hàng lên Google Drive cho Tour: ${tourCode}, Đơn hàng: ${actualOrderCode}`);
        folderId = await getOrCreateOrderFolderV2(tourCode, actualOrderCode, token);
      }

      const result = await uploadFileToGoogleDrive(fileName, file.mimetype, file.buffer, folderId, token);
      res.json({
        success: true,
        url: result.webViewLink,
        fileName: fileName,
        storage: 'drive'
      });
    } else {
      let storagePath = '';
      if (isTourCodeDirectly) {
        storagePath = `Tour/${tourCode.toUpperCase()}/Chi_phi/${fileName}`;
      } else {
        storagePath = `Tour/${tourCode.toUpperCase()}/Don_hang/${actualOrderCode}/${fileName}`;
      }

      console.log(`[Supabase Fallback] Đang tải file hóa đơn lên Supabase: ${storagePath}`);
      const publicUrl = await uploadFileToSupabase(
        'crm-attachments',
        storagePath,
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
    console.error('Lỗi API /api/upload-invoice-receipt:', error);
    res.status(500).json({ error: error.message || 'Lỗi tải hóa đơn thanh toán lên hệ thống' });
  }
});

// Unified File Deletion API (Google Drive with legacy Supabase Support)
app.post(['/api/delete', '/delete'], async (req, res) => {
  try {
    const { url } = req.body;
    console.log(`[Delete] Nhận yêu cầu xóa URL: ${url}`);
    
    if (!url) {
      console.error('[Delete] Thiếu URL.');
      res.status(400).json({ error: 'Thiếu URL của file cần xóa.' });
      return;
    }
    
    const isGoogleDrive = url.includes('drive.google.com') || 
                         url.includes('docs.google.com') || 
                         url.includes('ouid=') || 
                         url.includes('usp=drivesdk') ||
                         url.includes('/file/d/');
    const isSupabase = url.includes('supabase.com/dashboard/project') || url.includes('supabase.co');
    
    console.log(`[Delete] isGoogleDrive: ${isGoogleDrive}, isSupabase: ${isSupabase}`);
    
    if (isGoogleDrive) {
        const hasServiceAccount = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.includes('PRIVATE KEY'));
        const hasOAuth = !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
        console.log(`[Delete] Google Drive Config: hasServiceAccount: ${hasServiceAccount}, hasOAuth: ${hasOAuth}`);
    }

    if (isGoogleDrive) {
      console.log(`[Drive] Đang xóa file trên Google Drive: ${url}`);
      const fileId = getGoogleDriveFileId(url);
      if (!fileId) {
        console.warn(`[Drive] Không thể trích xuất ID file từ URL: ${url}. Chỉ gỡ bỏ liên kết.`);
        res.json({ success: true, message: 'Không thể xóa file vật lý (ID không hợp lệ), đã gỡ liên kết trong database.', storage: 'drive' });
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
      console.log(`[Delete] Đường dẫn không được hỗ trợ để xóa vật lý, chỉ gỡ bỏ liên kết: ${url}`);
      res.json({ success: true, message: 'Đường dẫn file không được hỗ trợ để xóa vật lý, đã gỡ liên kết trong hệ thống.', storage: 'unknown' });
    }
  } catch (error: any) {
    console.error('Lỗi API /api/delete:', error);
    res.status(500).json({ error: 'Lỗi xóa file: ' + (error.message || 'Unknown error') });
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
app.get(['/api/admin/users', '/admin/users'], async (req, res) => {
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
app.post(['/api/admin/users', '/admin/users'], express.json(), async (req, res) => {
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
app.put(['/api/admin/users/:id', '/admin/users/:id'], express.json(), async (req, res) => {
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
app.delete(['/api/admin/users/:id', '/admin/users/:id'], async (req, res) => {
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
export default app;
