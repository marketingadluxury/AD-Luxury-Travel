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
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let serviceKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  const hasOAuth = !!(clientId && clientSecret && refreshToken);
  const hasServiceAccount = !!(serviceEmail && serviceKey && serviceKey.includes('PRIVATE KEY'));

  // 1. Ưu tiên OAuth 2.0 (Dùng dung lượng của Google Account cá nhân/công ty)
  if (hasOAuth) {
    try {
      console.log('[Drive] Authorizing using OAuth 2.0 Refresh Token...');
      const oauth2Client = new OAuth2Client(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const tokenResponse = await oauth2Client.getAccessToken();
      if (tokenResponse.token) {
        console.log('[Drive] OAuth 2.0 authorization successful.');
        return tokenResponse.token;
      }
    } catch (err: any) {
      const errMsg = err.message || String(err);
      console.error('[Drive] OAuth 2.0 authorization failed:', errMsg);
      
      // Nếu có cấu hình OAuth nhưng bị lỗi token/credentials, báo lỗi chi tiết hướng dẫn fix trên OAuth Playground
      throw new Error(
        `Xác thực OAuth 2.0 thất bại (${errMsg}). ` +
        `Vui lòng lấy lại Refresh Token tại Google OAuth 2.0 Playground (developers.google.com/oauthplayground). ` +
        `LƯU Ý QUAN TRỌNG: Mở bánh răng ⚙️ (Settings) góc trên bên phải OAuth Playground, tích chọn "Use your own OAuth credentials", ` +
        `sau đó nhập đúng Client ID và Client Secret của bạn trước khi bấm Authorize APIs.`
      );
    }
  }

  // 2. Dự phòng Service Account (Chỉ dùng khi không có cấu hình OAuth)
  if (hasServiceAccount) {
    try {
      console.log('[Drive] Authorizing using Service Account...');
      if (serviceKey && serviceKey.includes('\\n')) {
        serviceKey = serviceKey.replace(/\\n/g, '\n');
      }
      const client = new JWT({
        email: serviceEmail,
        key: serviceKey,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/spreadsheets'
        ],
      });
      const tokens = await client.authorize();
      if (tokens.access_token) {
        return tokens.access_token;
      }
    } catch (sErr: any) {
      console.error('[Drive] Service Account auth failed:', sErr.message || sErr);
      throw new Error(`Service Account auth failed: ${sErr.message || sErr}`);
    }
  }

  throw new Error('Chưa cấu hình Google Drive credentials (vui lòng cấu hình GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET và GOOGLE_DRIVE_REFRESH_TOKEN).');
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

async function getOrCreateTourSubFolderV2(tourCode: string, subFolder: 'Đơn hàng' | 'Chi phí' | 'Anh_Doan' | 'Ảnh đoàn' | string, token: string): Promise<string> {
  const tourFolderId = await getOrCreateTourFolderV2(tourCode, token);

  let subFolderId = await searchFolder(subFolder, tourFolderId, token);
  if (!subFolderId && (subFolder === 'Ảnh đoàn' || subFolder === 'Anh_Doan')) {
    subFolderId = await searchFolder(subFolder === 'Ảnh đoàn' ? 'Anh_Doan' : 'Ảnh đoàn', tourFolderId, token);
  }
  if (!subFolderId) {
    subFolderId = await createFolder(subFolder, tourFolderId, token);
    await makeFolderPublic(subFolderId, token);
  }

  return subFolderId;
}

async function getOrCreateOrderFolderV2(tourCode: string, orderCode: string, token: string): Promise<string> {
  const donHangFolderId = await getOrCreateTourSubFolderV2(tourCode, 'Đơn hàng', token);

  const cleanOrderCode = formatOrderCode(orderCode).replace(/[\/\\\:\*\?\"\<\>\|]/g, '_');
  let orderFolderId = await searchFolder(cleanOrderCode, donHangFolderId, token);
  if (!orderFolderId) {
    orderFolderId = await createFolder(cleanOrderCode, donHangFolderId, token);
    await makeFolderPublic(orderFolderId, token);
  }

  return orderFolderId;
}

async function getOrCreateAccountingExpenseFolder(mmyyyyStr: string, token: string): Promise<string> {
  const baseParentId = getDriveRootParentId();

  // 1. Get or create AD Luxury Travel root folder
  const rootId = await getOrCreateADLuxuryTravelRootFolder(baseParentId, token);

  // 2. Get or create "Kế toán" folder inside AD Luxury Travel
  let keToanFolderId = await searchFolder('Kế toán', rootId, token);
  if (!keToanFolderId) {
    keToanFolderId = await createFolder('Kế toán', rootId, token);
    await makeFolderPublic(keToanFolderId, token);
  }

  // 3. Get or create "Tháng MM-YYYY" folder inside "Kế toán" (ví dụ: "Tháng 07-2026")
  const monthFolderName = `Tháng ${mmyyyyStr}`;
  let monthFolderId = await searchFolder(monthFolderName, keToanFolderId, token);
  if (!monthFolderId) {
    monthFolderId = await createFolder(monthFolderName, keToanFolderId, token);
    await makeFolderPublic(monthFolderId, token);
  }

  // 4. Get or create "Chi phí" folder inside "Tháng MM-YYYY"
  let chiPhiFolderId = await searchFolder('Chi phí', monthFolderId, token);
  if (!chiPhiFolderId) {
    chiPhiFolderId = await createFolder('Chi phí', monthFolderId, token);
    await makeFolderPublic(chiPhiFolderId, token);
  }

  return chiPhiFolderId;
}

function decodeUTF8(str: string | undefined): string {
  if (!str) return '';
  try {
    const decoded = Buffer.from(str, 'latin1').toString('utf8');
    if (!decoded.includes('\uFFFD') && decoded !== str) {
      return decoded;
    }
  } catch (e) {
    // fallback
  }
  return str;
}

function formatOrderCode(orderIdOrCode: string | undefined): string {
  if (!orderIdOrCode) return 'DON_HANG';
  let str = orderIdOrCode.trim();
  if (str.toUpperCase().startsWith('BK-')) {
    str = str.substring(3);
  }
  if (str.length > 8 && !str.toUpperCase().startsWith('TOUR') && !str.toUpperCase().startsWith('CHIPHI')) {
    str = str.substring(0, 8);
  }
  return str.toUpperCase();
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
      orderId: isGenericOrderCode ? undefined : formatOrderCode(cleanOrderCodeParam)
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
        return { tourCode: tourData.code, isTourCodeDirectly: false, orderId: formatOrderCode(targetBooking.id) };
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
            return { tourCode: tourData.code, isTourCodeDirectly: false, orderId: formatOrderCode(invBooking.id) };
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

async function getOrCreateFeedbackFolder(token: string): Promise<string> {
  const baseParentId = getDriveRootParentId();
  const rootId = await getOrCreateADLuxuryTravelRootFolder(baseParentId, token);
  let feedbackFolderId = await searchFolder('Góp Ý & Báo Lỗi', rootId, token);
  if (!feedbackFolderId) {
    feedbackFolderId = await createFolder('Góp Ý & Báo Lỗi', rootId, token);
    await makeFolderPublic(feedbackFolderId, token);
  }
  return feedbackFolderId;
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

// Helper for 3-tier file upload fallback (Google Drive -> Supabase Storage -> Base64 Data URL)
async function uploadWith3TierFallback(
  req: express.Request,
  file: Express.Multer.File,
  fileName: string,
  getDriveFolderId: (token: string) => Promise<string>,
  supabaseStoragePath: string,
  strictDriveOnly: boolean = false
): Promise<{ url: string; fileId?: string; storage: string }> {
  const hasServiceAccount = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.includes('PRIVATE KEY'));
  const hasOAuth = !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
  const driveActive = hasServiceAccount || hasOAuth;

  // Tier 1: Google Drive
  if (driveActive) {
    try {
      const token = await getGoogleDriveAccessToken();
      const folderId = await getDriveFolderId(token);
      const result = await uploadFileToGoogleDrive(fileName, file.mimetype, file.buffer, folderId, token);
      return { url: result.webViewLink, fileId: result.id, storage: 'drive' };
    } catch (driveErr: any) {
      console.warn('[Upload Tier 1 Failure] Google Drive upload failed:', driveErr.message || driveErr);
      if (strictDriveOnly) {
        throw new Error(`Lỗi lưu file lên Google Drive: ${driveErr.message || driveErr}. Hệ thống chỉ chấp nhận lưu trên Google Drive, không dùng Supabase Storage.`);
      }
    }
  } else if (strictDriveOnly) {
    throw new Error('Chưa kết nối Google Drive. Hệ thống yêu cầu chỉ lưu trữ file trên Google Drive, không sử dụng Supabase Storage.');
  }

  // Tier 2: Supabase Storage
  try {
    const supabase = getSupabaseClient(req);
    const publicUrl = await uploadFileToSupabase('crm-attachments', supabaseStoragePath, file.buffer, file.mimetype, supabase);
    return { url: publicUrl, storage: 'supabase' };
  } catch (sbErr: any) {
    console.warn('[Upload Tier 2 Failure] Supabase storage upload failed, falling back to Base64 Data URL:', sbErr.message || sbErr);
  }

  // Tier 3: Base64 Data URL fallback (guarantees upload never fails completely)
  const base64Data = file.buffer.toString('base64');
  const dataUrl = `data:${file.mimetype || 'image/jpeg'};base64,${base64Data}`;
  return { url: dataUrl, storage: 'data_url' };
}

// Unified File Upload API (Google Drive with Supabase Storage fallback)
app.post(['/api/upload', '/upload'], (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[Multer upload error]:', err);
      return res.status(400).json({ error: err.message || 'Lỗi tải file lên máy chủ' });
    }
    next();
  });
}, async (req, res) => {
  console.log('[API] /api/upload - Start processing');
  try {
    if (!req.file) {
      console.warn('[API] /api/upload - No file received');
      res.status(400).json({ error: 'Không tìm thấy file nào được gửi lên.' });
      return;
    }

    console.log('[API] /api/upload - File received:', req.file.originalname, 'Size:', req.file.size);
    console.log('[API] /api/upload - Body:', req.body);

    if (req.file) {
      req.file.originalname = decodeUTF8(req.file.originalname) || req.file.originalname;
    }

    // Decode relevant body fields
    const body = { ...req.body };
    const fieldsToDecode = ['fullName', 'passportNumber', 'visaName', 'tourTitle', 'category', 'visaCode', 'tourCode', 'orderCode', 'orderId', 'proposalCode', 'proposalType', 'proposal_code', 'proposal_type', 'tour_code'];
    fieldsToDecode.forEach(field => {
      if (body[field]) body[field] = decodeUTF8(body[field]);
    });

    const file = req.file;
    const isTourMediaUpload = body.uploadType === 'tour_media' || body.category === 'tour_media' || body.category === 'tour_photos';
    const isFeedbackUpload = body.uploadType === 'feedback' || body.category === 'feedback';
    const isPaymentProposal = body.uploadType === 'payment_proposal' || body.folder === 'payment_proposals' || !!body.proposalCode || !!body.proposal_code;
    const isTourUpload = (body.uploadType === 'tour' || !!body.tourCode) && !isTourMediaUpload;
    const isVisaUpload = body.uploadType === 'visa';

    if (isTourMediaUpload) {
      const supabaseAdmin = getAdminSupabaseClient(req);
      const rawTourCode = (body.tourCode || body.tour_code || body.tourId || body.uploadTourId || '').trim();
      const rawTourId = (body.tourId || body.tour_id || body.uploadTourId || '').trim();
      const uploaderName = (body.uploader || body.uploadedBy || body.uploaded_by || 'HDV Freelance').trim();
      const uploaderRole = (body.uploaderRole || body.uploader_role || 'tour_guide').trim();
      const caption = (body.caption || '').trim();

      let resolvedTourCode = 'TOUR_CHUNG';
      let resolvedTourId: string | null = null;

      // Tra cứu thông tin Tour trong CSDL nếu thiếu mã tour hoặc truyền sang dạng UUID
      try {
        if (rawTourId && rawTourId.length >= 20) {
          const { data: tourById } = await supabaseAdmin
            .from('tours')
            .select('id, code')
            .eq('id', rawTourId)
            .maybeSingle();

          if (tourById) {
            resolvedTourId = tourById.id;
            resolvedTourCode = tourById.code || resolvedTourCode;
          }
        }

        if (resolvedTourCode === 'TOUR_CHUNG' && rawTourCode) {
          const { data: tourByCode } = await supabaseAdmin
            .from('tours')
            .select('id, code')
            .eq('code', rawTourCode.toUpperCase())
            .maybeSingle();

          if (tourByCode) {
            resolvedTourId = tourByCode.id;
            resolvedTourCode = tourByCode.code;
          } else if (!rawTourCode.includes('-') || rawTourCode.length < 20) {
            resolvedTourCode = rawTourCode.toUpperCase();
          }
        }
      } catch (dbErr) {
        console.warn('[Upload Tour Media] Lỗi tra cứu Tour trong database:', dbErr);
      }

      const stt = body.stt || '1';
      const ext = path.extname(file.originalname) || '.jpg';
      const timestamp = Date.now();
      const fileName = `${resolvedTourCode}_HDV_${timestamp}_${stt}${ext}`;

      const resData = await uploadWith3TierFallback(
        req,
        file,
        fileName,
        (token) => getOrCreateTourSubFolderV2(resolvedTourCode, 'Ảnh đoàn', token),
        `Tour/${resolvedTourCode}/Anh_Doan/${fileName}`,
        true
      );

      // Lưu ngay siêu dữ liệu ảnh kỷ niệm vào bảng tour_media trên Supabase bằng Admin Client
      let insertedRecord = null;
      try {
        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from('tour_media')
          .insert({
            tour_id: resolvedTourId,
            tour_code: resolvedTourCode,
            file_url: resData.url,
            file_id: resData.fileId || null,
            file_name: fileName,
            file_size: file.size || 0,
            uploaded_by: uploaderName,
            uploader_role: uploaderRole,
            caption: caption || null
          })
          .select()
          .maybeSingle();

        if (insertErr) {
          console.warn('[Upload Tour Media] Lưu ý khi chèn bản ghi tour_media:', insertErr.message);
        } else {
          insertedRecord = inserted;
        }
      } catch (insertCatchErr) {
        console.warn('[Upload Tour Media] Lỗi khi tạo bản ghi tour_media:', insertCatchErr);
      }

      return res.json({
        success: true,
        url: resData.url,
        fileName: fileName,
        fileId: resData.fileId || '',
        storage: resData.storage,
        media: insertedRecord,
        tourCode: resolvedTourCode
      });
    }

    if (isPaymentProposal) {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = String(now.getFullYear());
      const mmyyyy = `${mm}${yyyy}`;
      const mmyyyyStr = `${mm}-${yyyy}`;

      const rawProposalCode = (body.proposalCode || body.proposal_code || '').trim().toUpperCase();
      const proposalCode = rawProposalCode || `DNTT-${mmyyyy}-001`;
      const proposalType = body.proposalType || body.proposal_type || (body.tourCode ? 'tour' : 'general');
      const tourCode = (body.tourCode || body.tour_code || body.tourCodeReq || '').trim().toUpperCase();

      const cleanOriginalName = file.originalname.trim().replace(/\s+/g, '_');
      const fileName = cleanOriginalName.startsWith(proposalCode) ? cleanOriginalName : `${proposalCode}_${cleanOriginalName}`;
      const isTourExpense = proposalType === 'tour' && tourCode && tourCode !== 'CHUNG' && tourCode !== 'CHIPHI_TOUR';

      const resData = await uploadWith3TierFallback(
        req,
        file,
        fileName,
        (token) => isTourExpense 
          ? getOrCreateTourSubFolderV2(tourCode, 'Chi phí', token) 
          : getOrCreateAccountingExpenseFolder(mmyyyyStr, token),
        isTourExpense ? `Tour/${tourCode}/Chi_phi/${fileName}` : `Ke_toan/Thang_${mmyyyyStr}/Chi_phi/${fileName}`
      );

      return res.json({
        success: true,
        url: resData.url,
        fileName: fileName,
        fileId: resData.fileId || '',
        storage: resData.storage
      });
    }

    if (isFeedbackUpload) {
      const cleanFileName = file.originalname.trim().replace(/\s+/g, '_');
      const fileName = `FB_${Date.now()}_${cleanFileName}`;

      const resData = await uploadWith3TierFallback(
        req,
        file,
        fileName,
        (token) => getOrCreateFeedbackFolder(token),
        `Feedback/${fileName}`
      );

      return res.json({
        success: true,
        url: resData.url,
        fileName: fileName,
        fileId: resData.fileId || '',
        storage: resData.storage
      });
    }

    if (isVisaUpload) {
      const fileName = file.originalname.trim();

      const resData = await uploadWith3TierFallback(
        req,
        file,
        fileName,
        (token) => getOrCreateVisaFolder(token),
        `Visa/${fileName}`
      );

      return res.json({
        success: true,
        url: resData.url,
        fileName: fileName,
        fileId: resData.fileId || '',
        storage: resData.storage
      });
    }

    if (isTourUpload) {
      const tourCode = body.tourCode || 'TOUR_CODE';
      const category = body.category || 'Chung';

      if (category === 'Visa') {
        const fileName = file.originalname.trim();

        const resData = await uploadWith3TierFallback(
          req,
          file,
          fileName,
          async (token) => {
            const visaFolderId = await getOrCreateVisaFolder(token);
            return getOrCreateVisaServiceFolder(tourCode, visaFolderId, token);
          },
          `Visa/${tourCode.trim().toUpperCase()}/${fileName}`
        );

        return res.json({
          success: true,
          url: resData.url,
          fileName: fileName,
          fileId: resData.fileId || '',
          storage: resData.storage
        });
      }

      const ext = path.extname(file.originalname) || '.pdf';
      const fileName = `${tourCode.trim().toUpperCase()}${ext}`;

      const resData = await uploadWith3TierFallback(
        req,
        file,
        fileName,
        (token) => getOrCreateTourFolderV2(tourCode, token),
        `Tour/${tourCode.trim().toUpperCase()}/${fileName}`
      );

      return res.json({
        success: true,
        url: resData.url,
        fileName: fileName,
        fileId: resData.fileId || '',
        storage: resData.storage
      });
    }

    // Passenger profile upload
    const passportNumber = body.passportNumber || '';
    const fullName = body.fullName || '';
    const cleanPassport = (passportNumber || 'CHUA_CO_HC').trim().toUpperCase();
    
    const getInitials = (name: string) => {
      if (!name) return 'KH';
      const words = name.trim().split(/\s+/);
      return words.map(w => w.charAt(0).toUpperCase()).join('');
    };
    const initials = getInitials(fullName);
    const originalName = file.originalname.trim();
    const fileName = originalName;

    const appendFilenameFragment = (linkUrl: string, name: string) => {
      if (!linkUrl) return linkUrl;
      if (linkUrl.includes('#filename=')) return linkUrl;
      return `${linkUrl}#filename=${encodeURIComponent(name)}`;
    };

    const resData = await uploadWith3TierFallback(
      req,
      file,
      fileName,
      (token) => getOrCreatePassengerFolder(fullName, passportNumber, token),
      `Khách hàng/${cleanPassport}-${initials}/${fileName}`
    );

    const finalUrl = appendFilenameFragment(resData.url, originalName);
    return res.json({
      success: true,
      url: finalUrl,
      fileName: originalName,
      fileId: resData.fileId || '',
      storage: resData.storage
    });
  } catch (error: any) {
    console.error('Lỗi API /api/upload:', error);
    res.status(500).json({ error: error.message || 'Lỗi tải file lên hệ thống' });
  }
});

// Unified Invoice Receipt Upload API (Google Drive with Supabase Storage fallback)
app.post(['/api/upload-invoice-receipt', '/upload-invoice-receipt', '/api/drive/upload', '/drive/upload'], upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Không tìm thấy file để tải lên.' });
      return;
    }

    // Decode UTF-8 for filename and body fields
    if (file.originalname) {
      file.originalname = decodeUTF8(file.originalname) || file.originalname;
    }

    const orderCodeReq = decodeUTF8(req.body.orderCode);
    const bodyTourCodeReq = decodeUTF8(req.body.tourCode);

    if (!orderCodeReq && !bodyTourCodeReq) {
      res.status(400).json({ error: 'Thiếu thông tin mã đơn hàng hoặc mã tour.' });
      return;
    }

    const hasServiceAccount = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
    const hasOAuth = !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
    const driveActive = hasServiceAccount || hasOAuth;

    // Khởi tạo Supabase để tra cứu mối quan hệ giữa Booking và Tour
    const supabase = getAdminSupabaseClient(req);
    const { tourCode, isTourCodeDirectly, orderId } = await getTourCodeFromOrderOrTour(orderCodeReq, bodyTourCodeReq, supabase);

    const actualOrderCode = formatOrderCode(orderId || orderCodeReq || bodyTourCodeReq || 'CHIPHI');
    const cleanOriginalName = file.originalname.trim().replace(/\s+/g, '_');
    const fileName = `${actualOrderCode}_${Date.now()}_${cleanOriginalName}`;

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

// Get Google Drive folder URL for a tour and subfolder
app.post('/api/get-tour-folder', async (req, res) => {
  try {
    const { tourCode, subFolder = 'Ảnh đoàn' } = req.body;
    if (!tourCode) {
      res.status(400).json({ error: 'Thiếu mã tour' });
      return;
    }
    const cleanTourCode = String(tourCode).trim().toUpperCase();
    const hasServiceAccount = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.includes('PRIVATE KEY'));
    const hasOAuth = !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
    const driveActive = hasServiceAccount || hasOAuth;

    if (driveActive) {
      const token = await getGoogleDriveAccessToken();
      const folderId = await getOrCreateTourSubFolderV2(cleanTourCode, subFolder, token);
      const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
      res.json({ success: true, folderUrl, folderId, storage: 'drive' });
    } else {
      res.json({ success: true, folderUrl: null, storage: 'supabase' });
    }
  } catch (error: any) {
    console.error('Lỗi API /api/get-tour-folder:', error);
    res.status(500).json({ error: error.message || 'Lỗi khi lấy thư mục Drive' });
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

let mockUsers: {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  role: string;
  leader_id?: string | null;
  created_at: string;
}[] = [
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
        leader_id: p.leader_id || null,
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
    const { full_name, phone, company_name, role, email, password, leader_id } = req.body;
    
    if (!email || !full_name) {
      return res.status(400).json({ error: 'Email và họ tên là bắt buộc.' });
    }
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const newUserObj = {
      id: crypto.randomUUID(),
      full_name,
      phone: phone || '',
      company_name: company_name || '',
      role: role || 'CTV',
      leader_id: leader_id || null,
      email,
      created_at: new Date().toISOString()
    };

    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      mockUsers.unshift(newUserObj);
      return res.json({ success: true, user: newUserObj });
    }
    
    const client = getAdminSupabaseClient(req);
    let userId: string = newUserObj.id;
    
    // Tạo auth user nếu có Service Role Key
    if (hasServiceRole) {
      try {
        const { data: authData, error: authError } = await client.auth.admin.createUser({
          email,
          password: password || '12345678a',
          email_confirm: true,
          user_metadata: { full_name }
        });
        
        if (authError) console.warn('Lưu ý khi tạo tài khoản Auth:', authError.message);
        if (authData && authData.user) {
          userId = authData.user.id;
        }
      } catch (authErr: any) {
        console.warn('Không thể tạo tài khoản Auth (thiếu quyền):', authErr.message || authErr);
      }
    }
    
    let profileUpsertData: any = {
      id: userId,
      full_name,
      phone: phone || '',
      company_name: company_name || '',
      role: role || 'CTV',
      leader_id: leader_id || null
    };

    let { error: pError } = await client.from('profiles').upsert(profileUpsertData);
    
    if (pError && (pError.message?.includes('leader_id') || pError.message?.includes('schema cache'))) {
      console.warn('Cột leader_id chưa có trong Supabase schema cache. Thử lại không có leader_id...');
      delete profileUpsertData.leader_id;
      const retryRes = await client.from('profiles').upsert(profileUpsertData);
      pError = retryRes.error;
    }
    
    if (pError) {
      console.warn('Lỗi lưu profile Supabase, lưu tạm vào memory:', pError.message);
      mockUsers.unshift(newUserObj);
      return res.json({ success: true, user: newUserObj });
    }

    mockUsers.unshift({ ...newUserObj, id: userId });
    
    res.json({
      success: true,
      user: {
        id: userId,
        full_name,
        phone,
        company_name,
        role,
        leader_id: leader_id || null,
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
    const { full_name, phone, company_name, role, email, password, leader_id } = req.body;
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Cập nhật trong memory mockUsers trước
    const userIndex = mockUsers.findIndex(u => u.id === id);
    if (userIndex !== -1) {
      mockUsers[userIndex] = {
        ...mockUsers[userIndex],
        full_name: full_name !== undefined ? full_name : mockUsers[userIndex].full_name,
        phone: phone !== undefined ? phone : mockUsers[userIndex].phone,
        company_name: company_name !== undefined ? company_name : mockUsers[userIndex].company_name,
        role: role !== undefined ? role : mockUsers[userIndex].role,
        leader_id: leader_id !== undefined ? leader_id : (mockUsers[userIndex] as any).leader_id,
        email: email !== undefined ? email : mockUsers[userIndex].email
      };
    }

    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      if (userIndex !== -1) {
        return res.json({ success: true, user: mockUsers[userIndex] });
      }
      return res.json({ success: true });
    }
    
    const client = getAdminSupabaseClient(req);
    
    let profileUpdateData: any = {
      full_name,
      phone,
      company_name,
      role
    };
    if (leader_id !== undefined) {
      profileUpdateData.leader_id = leader_id || null;
    }

    let { error: pError } = await client.from('profiles').update(profileUpdateData).eq('id', id);
    
    if (pError && (pError.message?.includes('leader_id') || pError.message?.includes('schema cache'))) {
      console.warn('Cột leader_id chưa có trong Supabase schema cache. Thử lại không có leader_id...');
      delete profileUpdateData.leader_id;
      const retryRes = await client.from('profiles').update(profileUpdateData).eq('id', id);
      pError = retryRes.error;
    }
    
    if (pError) {
      console.warn('Lỗi cập nhật profile Supabase:', pError.message);
    }
    
    if (hasServiceRole) {
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
    
    // Always remove from mockUsers in memory
    mockUsers = mockUsers.filter(u => u.id !== id);

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      return res.json({ success: true });
    }
    
    const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = getAdminSupabaseClient(req);
    
    // Step 1: Unassign foreign key references in related tables so Postgres won't reject deletion
    try {
      await client.from('profiles').update({ leader_id: null }).eq('leader_id', id);
    } catch (e: any) {
      console.warn('[Delete User] Không thể bỏ gán leader_id:', e.message || e);
    }

    try {
      await client.from('tours').update({ operator_id: null }).eq('operator_id', id);
    } catch (e: any) {
      console.warn('[Delete User] Không thể bỏ gán operator_id:', e.message || e);
    }

    try {
      await client.from('bookings').update({ salesperson_id: null }).eq('salesperson_id', id);
    } catch (e: any) {
      console.warn('[Delete User] Không thể bỏ gán salesperson_id:', e.message || e);
    }

    try {
      await client.from('bookings').update({ user_id: null }).eq('user_id', id);
    } catch (e: any) {
      console.warn('[Delete User] Không thể bỏ gán user_id:', e.message || e);
    }

    // Step 2: Delete from profiles table
    let { error: pError } = await client.from('profiles').delete().eq('id', id);

    // Fallback: If foreign key constraint prevents deletion, try reassigning salesperson_id & operator_id to current admin
    if (pError && pError.message && (pError.message.includes('foreign key constraint') || pError.message.includes('fkey'))) {
      console.warn('[Delete User] Bị vướng FK constraint, đang thử gán đơn hàng/tour về tài khoản Admin...', pError.message);
      
      let adminId: string | null = null;
      try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const { data: userData } = await client.auth.getUser(authHeader.substring(7));
          if (userData?.user?.id) {
            adminId = userData.user.id;
          }
        }
      } catch (e: any) {
        console.warn('[Delete User] Không tìm thấy admin ID từ token:', e.message);
      }

      if (adminId && adminId !== id) {
        await client.from('bookings').update({ salesperson_id: adminId }).eq('salesperson_id', id);
        await client.from('bookings').update({ user_id: adminId }).eq('user_id', id);
        await client.from('tours').update({ operator_id: adminId }).eq('operator_id', id);
        
        // Thử xóa lại profile sau khi chuyển giao
        const retryDelete = await client.from('profiles').delete().eq('id', id);
        pError = retryDelete.error;
      }
    }

    // Step 3: Delete from Auth if Service Role is available
    if (hasServiceRole && !pError) {
      try {
        const { error: authError } = await client.auth.admin.deleteUser(id);
        if (authError) console.warn('Lưu ý khi xóa tài khoản Auth:', authError.message);
      } catch (authErr: any) {
        console.warn('Không thể xóa tài khoản Auth (thiếu quyền):', authErr.message || authErr);
      }
    }

    if (pError) {
      console.error('Lỗi khi xóa profile Supabase:', pError.message);
      let friendlyMessage = pError.message;
      if (pError.message.includes('foreign key constraint') || pError.message.includes('fkey')) {
        friendlyMessage = 'Không thể xóa người dùng này do đang phụ trách Đơn hàng/Tour trong hệ thống. Hệ thống đã thử gỡ liên kết. Vui lòng chuyển giao Đơn hàng của người dùng cho nhân viên khác trước khi xóa.';
      }
      return res.status(400).json({ error: friendlyMessage });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Lỗi API /api/admin/users DELETE:', err);
    res.status(500).json({ error: err.message || 'Lỗi xóa người dùng' });
  }
});

async function saveFeedbackToGoogleDriveCSV(
  token: string,
  rootFolderId: string,
  timeStr: string,
  typeStr: string,
  senderStr: string,
  contactStr: string,
  roleStr: string,
  contentStr: string,
  imageUrlStr: string | null
): Promise<{ success: boolean; webViewLink?: string; error?: string }> {
  try {
    const feedbackFolderId = await getOrCreateFeedbackFolder(token);
    const csvFileName = "Góp_Ý_Và_Báo_Lỗi_Tour_CRM.csv";
    const safeCsvName = csvFileName.replace(/'/g, "\\'");
    const query = `name = '${safeCsvName}' and trashed = false and ('${feedbackFolderId}' in parents or '${rootFolderId}' in parents)`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

    const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${token}` } });
    let fileId: string | null = null;
    let webViewLink = '';

    if (searchRes.ok) {
      const data: any = await searchRes.json();
      if (data.files && data.files.length > 0) {
        fileId = data.files[0].id;
        webViewLink = data.files[0].webViewLink || '';
      }
    }

    const formatCsvCell = (val: string) => {
      if (!val) return '""';
      const escaped = val.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const newRow = [
      formatCsvCell(timeStr),
      formatCsvCell(typeStr),
      formatCsvCell(senderStr),
      formatCsvCell(contactStr),
      formatCsvCell(roleStr),
      formatCsvCell(contentStr),
      formatCsvCell(imageUrlStr || 'Không có'),
      formatCsvCell('Mới nhận')
    ].join(',') + '\n';

    if (fileId) {
      let existingContent = '';
      try {
        const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (getRes.ok) {
          existingContent = await getRes.text();
        }
      } catch (e) {
        console.warn('[Drive CSV] Không thể đọc nội dung file cũ:', e);
      }

      const updatedContent = existingContent
        ? (existingContent.endsWith('\n') ? existingContent + newRow : existingContent + '\n' + newRow)
        : newRow;

      const updateRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/csv; charset=utf-8'
        },
        body: updatedContent
      });

      if (updateRes.ok) {
        return { success: true, webViewLink };
      }
    } else {
      const header = '\uFEFF' + [
        'Thời Gian', 'Loại Phản Hồi', 'Người Gửi', 'Email / SĐT', 'Vai Trò', 'Nội Dung Góp Ý / Báo Lỗi', 'Ảnh Đính Kèm', 'Trạng Thái'
      ].map(formatCsvCell).join(',') + '\n';

      const initialContent = header + newRow;

      const createMetaRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,webViewLink', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: csvFileName,
          mimeType: 'text/csv',
          parents: [feedbackFolderId]
        })
      });

      if (createMetaRes.ok) {
        const metaData: any = await createMetaRes.json();
        fileId = metaData.id;
        webViewLink = metaData.webViewLink || '';
        await makeFolderPublic(fileId, token);

        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/csv; charset=utf-8'
          },
          body: initialContent
        });

        return { success: true, webViewLink };
      }
    }

    return { success: false, error: 'Không thể khởi tạo hoặc cập nhật file CSV trên Google Drive.' };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

// SUBMIT FEEDBACK & BUG REPORT (Ghi nhận góp ý & báo lỗi vào Google Sheet & Supabase)
app.post('/api/submit-feedback', express.json(), async (req, res) => {
  try {
    const { type, content, senderName, senderEmail, senderPhone, senderRole, imageUrl, image_url } = req.body;
    const finalImageUrl = imageUrl || image_url || null;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Nội dung phản hồi không được để trống.' });
    }

    const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const finalSender = senderName || 'Thành viên / Ẩn danh';
    const finalContact = [senderEmail, senderPhone].filter(Boolean).join(' - ') || 'Chưa cung cấp';
    const finalRole = senderRole || 'Thành viên';
    const finalType = type || 'Góp ý';

    // 1. Lưu vào bảng feedbacks của Supabase (nếu đã cấu hình)
    let supabaseSaved = false;
    try {
      const client = getAdminSupabaseClient(req);
      const { error: pError } = await client.from('feedbacks').insert([{
        type: finalType,
        content: content.trim(),
        image_url: finalImageUrl,
        sender_name: finalSender,
        sender_email: senderEmail || null,
        sender_phone: senderPhone || null,
        sender_role: finalRole,
        status: 'pending',
        created_at: new Date().toISOString()
      }]);
      if (!pError) {
        supabaseSaved = true;
      } else {
        console.warn('[Feedback] Supabase insert warning:', pError.message);
      }
    } catch (dbErr: any) {
      console.warn('[Feedback] Supabase insert skipped or table missing:', dbErr.message);
    }

    // 2. Ghi nhận trực tiếp vào File Google Sheet trong folder "AD Luxury Travel"
    let sheetSaved = false;
    let sheetUrl = '';
    let sheetError = '';

    try {
      const token = await getGoogleDriveAccessToken();
      const baseParentId = getDriveRootParentId();

      // Tìm hoặc tạo thư mục "AD Luxury Travel"
      const rootFolderId = await getOrCreateADLuxuryTravelRootFolder(baseParentId, token);

      const spreadsheetName = "Góp Ý & Báo Lỗi - Tour CRM";
      let spreadsheetId: string | null = null;
      const safeName = spreadsheetName.replace(/'/g, "\\'");

      // A. Tìm kiếm trong folder "AD Luxury Travel" trước
      const queryInFolder = `mimeType = 'application/vnd.google-apps.spreadsheet' and name = '${safeName}' and trashed = false and '${rootFolderId}' in parents`;
      const searchUrl1 = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queryInFolder)}&fields=files(id,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

      try {
        const searchRes1 = await fetch(searchUrl1, { headers: { Authorization: `Bearer ${token}` } });
        if (searchRes1.ok) {
          const data1: any = await searchRes1.json();
          if (data1.files && data1.files.length > 0) {
            spreadsheetId = data1.files[0].id;
            sheetUrl = data1.files[0].webViewLink || '';
          }
        }
      } catch (e: any) {
        console.warn('[Drive] Tìm kiếm Google Sheet trong thư mục cha bị lỗi nhẹ:', e.message || e);
      }

      // B. Nếu chưa thấy, tìm kiếm toàn bộ Drive phòng trường hợp file nằm ở ngoài
      if (!spreadsheetId) {
        const queryGlobal = `mimeType = 'application/vnd.google-apps.spreadsheet' and name = '${safeName}' and trashed = false`;
        const searchUrl2 = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queryGlobal)}&fields=files(id,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
        try {
          const searchRes2 = await fetch(searchUrl2, { headers: { Authorization: `Bearer ${token}` } });
          if (searchRes2.ok) {
            const data2: any = await searchRes2.json();
            if (data2.files && data2.files.length > 0) {
              spreadsheetId = data2.files[0].id;
              sheetUrl = data2.files[0].webViewLink || '';
            }
          }
        } catch (e: any) {
          console.warn('[Drive] Tìm kiếm Google Sheet toàn cục bị lỗi nhẹ:', e.message || e);
        }
      }

      // C. Nếu vẫn chưa có file Sheet, tiến hành khởi tạo mới
      if (!spreadsheetId) {
        console.log('[Drive] Google Sheet "Góp Ý & Báo Lỗi - Tour CRM" chưa tồn tại, đang tạo mới...');
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,webViewLink', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: spreadsheetName,
            mimeType: 'application/vnd.google-apps.spreadsheet',
            parents: [rootFolderId]
          })
        });

        if (createRes.ok) {
          const createData: any = await createRes.json();
          spreadsheetId = createData.id;
          sheetUrl = createData.webViewLink || '';
          await makeFolderPublic(spreadsheetId, token);
        } else {
          const errText = await createRes.text();
          sheetError = `Không thể tạo file Google Sheet mới: ${errText}`;
          console.error('[Drive]', sheetError);
        }
      }

      // D. Tiến hành ghi dữ liệu vào Google Sheet
      if (spreadsheetId) {
        // Lấy tên tab (sheet name) thực tế của file Google Sheet (ví dụ: Trang tính1 hoặc Sheet1)
        let sheetTitle = 'Sheet1';
        try {
          const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(title)`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (metaRes.ok) {
            const metaData: any = await metaRes.json();
            if (metaData.sheets && metaData.sheets.length > 0 && metaData.sheets[0].properties?.title) {
              sheetTitle = metaData.sheets[0].properties.title;
            }
          }
        } catch (mErr: any) {
          console.warn('[Sheets] Không lấy được thông tin tab, dùng mặc định Sheet1:', mErr.message);
        }

        // Kiểm tra xem dòng tiêu đề 1 đã có nội dung chưa, nếu chưa thì thêm tiêu đề cột
        try {
          const checkHeaderUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sheetTitle)}'!A1:H1`;
          const checkRes = await fetch(checkHeaderUrl, { headers: { Authorization: `Bearer ${token}` } });
          let hasHeader = false;
          if (checkRes.ok) {
            const checkData: any = await checkRes.json();
            if (checkData.values && checkData.values.length > 0) {
              hasHeader = true;
            }
          }

          if (!hasHeader) {
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sheetTitle)}'!A1:H1?valueInputOption=USER_ENTERED`, {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                range: `'${sheetTitle}'!A1:H1`,
                majorDimension: 'ROWS',
                values: [
                  ['Thời Gian', 'Loại Phản Hồi', 'Người Gửi', 'Email / SĐT', 'Vai Trò', 'Nội Dung Góp Ý / Báo Lỗi', 'Ảnh Đính Kèm', 'Trạng Thái']
                ]
              })
            });
          }
        } catch (hErr: any) {
          console.warn('[Sheets] Lỗi kiểm tra / cập nhật dòng tiêu đề:', hErr.message);
        }

        // Thêm dòng dữ liệu phản hồi vào Google Sheet
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sheetTitle)}'!A1:H1:append?valueInputOption=USER_ENTERED`;
        const appendRes = await fetch(appendUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            range: `'${sheetTitle}'!A1:H1`,
            majorDimension: 'ROWS',
            values: [
              [timeStr, finalType, finalSender, finalContact, finalRole, content.trim(), finalImageUrl || 'Không có', 'Mới nhận']
            ]
          })
        });

        if (appendRes.ok) {
          sheetSaved = true;
          console.log('[Drive] Ghi nhận góp ý vào Google Sheet thành công!');
        } else {
          const errText = await appendRes.text();
          sheetError = `Google Sheets API chưa bật hoặc bị từ chối: ${errText}`;
          console.error('[Sheets]', sheetError);
        }
      }

      // E. Dự phòng: Nếu Google Sheets API bị lỗi / chưa bật (SERVICE_DISABLED 403), tự động ghi dữ liệu vào file CSV trên Google Drive
      if (!sheetSaved) {
        console.log('[Drive CSV Fallback] Đang lưu góp ý vào file CSV trên Google Drive...');
        const csvResult = await saveFeedbackToGoogleDriveCSV(
          token,
          rootFolderId,
          timeStr,
          finalType,
          finalSender,
          finalContact,
          finalRole,
          content.trim(),
          finalImageUrl
        );

        if (csvResult.success) {
          sheetSaved = true;
          sheetUrl = csvResult.webViewLink || sheetUrl;
          sheetError = '';
          console.log('[Drive CSV Fallback] Đã ghi dữ liệu vào file Góp_Ý_Và_Báo_Lỗi_Tour_CRM.csv trên Google Drive thành công!');
        } else {
          sheetError = csvResult.error || sheetError;
        }
      }
    } catch (driveErr: any) {
      sheetError = driveErr.message || String(driveErr);
      console.warn('[Feedback] Google Drive sync error:', sheetError);
    }

    res.json({
      success: true,
      sheetSaved,
      supabaseSaved,
      sheetUrl,
      sheetError: sheetError || null,
      message: sheetSaved
        ? 'Gửi đóng góp thành công!'
        : `Gửi đóng góp thành công! (Lưu ý: chưa đồng bộ được Google Drive: ${sheetError || 'vui lòng kiểm tra quyền truy cập'})`
    });
  } catch (err: any) {
    console.error('Lỗi API /api/submit-feedback:', err);
    res.status(500).json({ error: err.message || 'Có lỗi xảy ra khi gửi phản hồi' });
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
  
  return res.status(status).json({
    error: err.message || 'Đã xảy ra lỗi hệ thống trên máy chủ',
    status
  });
});

// Serve frontend assets & mount Vite dev server middleware
export default app;
