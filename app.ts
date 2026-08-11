import express from 'express';
import path from 'path';
import { JWT, OAuth2Client } from 'google-auth-library';
import multer from 'multer';
// Vite will be imported dynamically in development mode only
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import cors from 'cors';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

// Load environment variables
dotenv.config();

// Clean up Google Drive environment variables (remove surrounding quotes if any)
const googleEnvVars = [
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
  'GOOGLE_DRIVE_CLIENT_ID',
  'GOOGLE_DRIVE_CLIENT_SECRET',
  'GOOGLE_DRIVE_REFRESH_TOKEN',
  'GOOGLE_DRIVE_PARENT_FOLDER_ID',
  'GOOGLE_DRIVE_ROOT_FOLDER_ID',
  'GOOGLE_DRIVE_FOLDER_ID',
  'DRIVE_PARENT_FOLDER_ID',
  'DRIVE_ROOT_ID'
];

googleEnvVars.forEach(name => {
  const val = process.env[name];
  if (val) {
    let cleanVal = val.trim();
    if (cleanVal.startsWith('"') && cleanVal.endsWith('"')) {
      cleanVal = cleanVal.slice(1, -1).trim();
    }
    if (cleanVal.startsWith("'") && cleanVal.endsWith("'")) {
      cleanVal = cleanVal.slice(1, -1).trim();
    }
    // Specially handle GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY newlines if escaped
    if (name === 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY') {
      if (cleanVal.includes('\\n')) {
        cleanVal = cleanVal.replace(/\\n/g, '\n');
      }
    }
    process.env[name] = cleanVal;
  }
});

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
      
      if (hasServiceAccount) {
        console.log('[Drive] OAuth 2.0 thất bại, tự động chuyển sang sử dụng Service Account làm phương án dự phòng hoạt động...');
      } else {
        // Nếu không có cấu hình Service Account dự phòng, báo lỗi chi tiết hướng dẫn fix trên OAuth Playground
        throw new Error(
          `Xác thực OAuth 2.0 thất bại (${errMsg}). ` +
          `Vui lòng lấy lại Refresh Token tại Google OAuth 2.0 Playground (developers.google.com/oauthplayground). ` +
          `LƯU Ý QUAN TRỌNG: Mở bánh răng ⚙️ (Settings) góc trên bên phải OAuth Playground, tích chọn "Use your own OAuth credentials", ` +
          `sau đó nhập đúng Client ID và Client Secret của bạn trước khi bấm Authorize APIs.`
        );
      }
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

async function getAuthenticatedUserEmail(req?: express.Request): Promise<string | undefined> {
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

async function makeFolderPublic(fileId: string, token?: string, userEmail?: string | string[]): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`;
  
  // Option B: Restrict permissions to company domain and specific company/admin emails
  const targets: Array<{ type: string; role: string; domain?: string; emailAddress?: string }> = [
    { type: 'domain', domain: 'adluxury.net', role: 'reader' },
    { type: 'user', emailAddress: 'marketing@adluxury.net', role: 'reader' },
    { type: 'user', emailAddress: 'marketing.adluxury@gmail.com', role: 'reader' }
  ];

  if (userEmail) {
    const emails = Array.isArray(userEmail) ? userEmail : [userEmail];
    emails.forEach(email => {
      if (email && email.trim() && email.includes('@')) {
        const cleanEmail = email.trim().toLowerCase();
        if (!targets.some(t => t.emailAddress === cleanEmail)) {
          targets.push({ type: 'user', emailAddress: cleanEmail, role: 'reader' });
        }
      }
    });
  }

  await Promise.all(targets.map(async (target) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(target)
      });
      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[Drive] Failed to share with ${target.type === 'domain' ? target.domain : target.emailAddress}:`, errText);
      } else {
        console.log(`[Drive] Successfully shared with ${target.type === 'domain' ? target.domain : target.emailAddress}`);
      }
    } catch (err) {
      console.error(`[Drive] Error sharing with ${target.type === 'domain' ? target.domain : target.emailAddress}:`, err);
    }
  }));
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
  token: string,
  userEmail?: string
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
  
  // Make the file public so people with link can view it (using Option B restrictions inside makeFolderPublic)
  await makeFolderPublic(data.id, token, userEmail);
  
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

// Helper for strict Google Drive file upload with smart Supabase fallback
async function uploadWith3TierFallback(
  req: express.Request,
  file: Express.Multer.File,
  fileName: string,
  getDriveFolderId: (token: string) => Promise<string>,
  supabaseStoragePath: string,
  strictDriveOnly: boolean = false
): Promise<{ url: string; fileId?: string; storage: string; error?: string }> {
  const hasServiceAccount = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.includes('PRIVATE KEY'));
  const hasOAuth = !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
  const driveActive = hasServiceAccount || hasOAuth;

  if (!driveActive) {
    if (strictDriveOnly) {
      throw new Error('Hệ thống chưa được cấu hình liên kết tài khoản Google Drive. Vui lòng thiết lập biến môi trường Google Drive API trong cài đặt hệ thống để lưu trữ tài liệu.');
    }
    // Fallback to Supabase Storage
    console.log('[Upload Fallback] Google Drive is not configured. Falling back to Supabase Storage...');
    const supabase = getAdminSupabaseClient(req);
    const publicUrl = await uploadFileToSupabase('crm-attachments', supabaseStoragePath, file.buffer, file.mimetype, supabase);
    return { url: publicUrl, storage: 'supabase' };
  }

  try {
    const token = await getGoogleDriveAccessToken();
    const folderId = await getDriveFolderId(token);
    const userEmail = await getAuthenticatedUserEmail(req);
    const result = await uploadFileToGoogleDrive(fileName, file.mimetype, file.buffer, folderId, token, userEmail);
    return { url: result.webViewLink, fileId: result.id, storage: 'drive' };
  } catch (driveErr: any) {
    const driveErrorMsg = driveErr.message || String(driveErr);
    console.warn('[Google Drive Upload Failure] Upload failed:', driveErrorMsg);
    if (strictDriveOnly) {
      throw new Error(`Lỗi tải file lên Google Drive: ${driveErrorMsg}. Hệ thống yêu cầu lưu trữ trên Google Drive và không dùng Supabase Storage làm dự phòng.`);
    }
    // Fallback to Supabase Storage
    console.log('[Upload Fallback] Google Drive upload failed. Falling back to Supabase Storage...', driveErrorMsg);
    try {
      const supabase = getAdminSupabaseClient(req);
      const publicUrl = await uploadFileToSupabase('crm-attachments', supabaseStoragePath, file.buffer, file.mimetype, supabase);
      return { url: publicUrl, storage: 'supabase' };
    } catch (supErr: any) {
      throw new Error(`Lỗi tải file: Cả Google Drive (${driveErrorMsg}) và Supabase Storage (${supErr.message || supErr}) đều thất bại.`);
    }
  }
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
        false
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
        tourCode: resolvedTourCode,
        error: resData.error || null
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

    if (!driveActive) {
      res.status(400).json({ error: 'Chưa cấu hình tài khoản Google Drive. Hệ thống yêu cầu chỉ lưu trữ file trên Google Drive.' });
      return;
    }

    // Khởi tạo Supabase để tra cứu mối quan hệ giữa Booking và Tour
    const supabase = getAdminSupabaseClient(req);
    const { tourCode, isTourCodeDirectly, orderId } = await getTourCodeFromOrderOrTour(orderCodeReq, bodyTourCodeReq, supabase);

    const actualOrderCode = formatOrderCode(orderId || orderCodeReq || bodyTourCodeReq || 'CHIPHI');
    const cleanOriginalName = file.originalname.trim().replace(/\s+/g, '_');
    const fileName = `${actualOrderCode}_${Date.now()}_${cleanOriginalName}`;

    try {
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
    } catch (driveErr: any) {
      console.error('[Google Drive Upload Receipt Failure]:', driveErr);
      res.status(500).json({ error: `Lỗi khi tải hóa đơn lên Google Drive: ${driveErr.message || driveErr}` });
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
  team_id?: string | null;
  team_name?: string | null;
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

let mockTeams = [
  {
    id: 'e8c3b7a5-9a84-4632-bd88-0677efbc2891',
    name: 'Team Đông Nam Á',
    leader_id: null,
    leader_name: 'Trần Văn Trưởng (Leader)',
    kpi_target: 800000000,
    created_at: new Date().toISOString()
  },
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    name: 'Team Châu Âu & Mỹ',
    leader_id: null,
    leader_name: 'Nguyễn Thị Hương (Leader)',
    kpi_target: 1200000000,
    created_at: new Date().toISOString()
  },
  {
    id: '6ec0bd7f-11c0-43da-975e-2bab1a9cef77',
    name: 'Team Nội Địa & Khác',
    leader_id: null,
    leader_name: 'Lê Minh Tuấn (Leader)',
    kpi_target: 500000000,
    created_at: new Date().toISOString()
  }
];

// GET list of teams
app.get(['/api/admin/teams', '/admin/teams', '/api/teams'], async (req, res) => {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      return res.json(mockTeams);
    }
    const client = getAdminSupabaseClient(req);
    const { data: teams, error } = await client.from('teams').select('*').order('created_at', { ascending: true });
    if (error || !teams || teams.length === 0) {
      return res.json(mockTeams);
    }
    res.json(teams);
  } catch (err) {
    res.json(mockTeams);
  }
});

// CREATE team
app.post(['/api/admin/teams', '/admin/teams', '/api/teams'], express.json(), async (req, res) => {
  try {
    const { name, leader_id, leader_name, kpi_target } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên Team là bắt buộc.' });
    }
    const newTeam = {
      id: crypto.randomUUID(),
      name: name.trim(),
      leader_id: leader_id || null,
      leader_name: leader_name || null,
      kpi_target: Number(kpi_target) || 0,
      created_at: new Date().toISOString()
    };

    mockTeams.unshift(newTeam);

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      const client = getAdminSupabaseClient(req);
      const { data, error } = await client.from('teams').insert([{
        id: newTeam.id,
        name: newTeam.name,
        leader_id: newTeam.leader_id,
        leader_name: newTeam.leader_name,
        kpi_target: newTeam.kpi_target
      }]).select().maybeSingle();
      if (!error && data) {
        return res.json({ success: true, team: data });
      }
    }
    res.json({ success: true, team: newTeam });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Lỗi tạo team mới' });
  }
});

// UPDATE team
app.put(['/api/admin/teams/:id', '/admin/teams/:id', '/api/teams/:id'], express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, leader_id, leader_name, kpi_target } = req.body;

    const idx = mockTeams.findIndex(t => t.id === id);
    if (idx !== -1) {
      mockTeams[idx] = {
        ...mockTeams[idx],
        name: name !== undefined ? name.trim() : mockTeams[idx].name,
        leader_id: leader_id !== undefined ? leader_id : mockTeams[idx].leader_id,
        leader_name: leader_name !== undefined ? leader_name : mockTeams[idx].leader_name,
        kpi_target: kpi_target !== undefined ? Number(kpi_target) : mockTeams[idx].kpi_target
      };
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      const client = getAdminSupabaseClient(req);
      // Sử dụng upsert thay vì update để chèn mới mock team nếu nó chưa từng được lưu trong DB
      await client.from('teams').upsert({
        id: id,
        name: name?.trim(),
        leader_id: leader_id || null,
        leader_name: leader_name || null,
        kpi_target: Number(kpi_target) || 0
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Lỗi cập nhật team' });
  }
});

// DELETE team
app.delete(['/api/admin/teams/:id', '/admin/teams/:id', '/api/teams/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    mockTeams = mockTeams.filter(t => t.id !== id);

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      const client = getAdminSupabaseClient(req);
      await client.from('profiles').update({ team_id: null, team_name: null }).eq('team_id', id);
      await client.from('teams').delete().eq('id', id);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Lỗi xóa team' });
  }
});

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
        team_id: p.team_id || null,
        team_name: p.team_name || null,
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
    const { full_name, phone, company_name, role, email, password, leader_id, team_id, team_name } = req.body;
    
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
      team_id: team_id || null,
      team_name: team_name || null,
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
      leader_id: leader_id || null,
      team_id: team_id || null,
      team_name: team_name || null
    };

    let { error: pError } = await client.from('profiles').upsert(profileUpsertData);
    
    if (pError && (pError.message?.includes('team_id') || pError.message?.includes('leader_id') || pError.message?.includes('schema cache'))) {
      console.warn('Cột team_id/leader_id chưa có trong Supabase schema cache. Thử lại lọc bớt cột...');
      delete profileUpsertData.team_id;
      delete profileUpsertData.team_name;
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
        team_id: team_id || null,
        team_name: team_name || null,
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
    const { full_name, phone, company_name, role, email, password, leader_id, team_id, team_name } = req.body;
    
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
        team_id: team_id !== undefined ? team_id : (mockUsers[userIndex] as any).team_id,
        team_name: team_name !== undefined ? team_name : (mockUsers[userIndex] as any).team_name,
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
    if (leader_id !== undefined) profileUpdateData.leader_id = leader_id || null;
    if (team_id !== undefined) profileUpdateData.team_id = team_id || null;
    if (team_name !== undefined) profileUpdateData.team_name = team_name || null;

    let { error: pError } = await client.from('profiles').update(profileUpdateData).eq('id', id);
    
    if (pError && (pError.message?.includes('team_id') || pError.message?.includes('leader_id') || pError.message?.includes('schema cache'))) {
      console.warn('Cột team_id/leader_id chưa có trong Supabase schema cache. Thử lại không có team_id...');
      delete profileUpdateData.team_id;
      delete profileUpdateData.team_name;
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

// AI ERP Copilot Chat API
app.post('/api/ai/chat', async (req: express.Request, res: express.Response) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'Chưa cấu hình GEMINI_API_KEY trong hệ thống. Vui lòng thêm GEMINI_API_KEY tại mục Cài đặt (Settings).'
      });
    }

    const { messages, currentRole } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Dữ liệu tin nhắn (messages) không hợp lệ.' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const systemInstruction = `
Bạn là "Trợ lý hướng dẫn" - Trợ lý AI thông minh trực thuộc Hệ thống Quản lý Tour CRM của công ty du lịch AD Luxury Travel.
Nhiệm vụ chính: Hướng dẫn nhân viên, đại lý, điều hành, sale, kế toán, nhân viên visa và HDV hiểu rõ, sử dụng thành thạo và thực hiện chính xác tất cả quy trình nghiệp vụ trên hệ thống ERP này dựa trên cấu trúc mã nguồn toàn diện.

CẤU TRÚC MÃ NGUỒN & CÁC MÔ-ĐƯN CHÍNH CỦA HỆ THỐNG ERP AD LUXURY:

1. BẢNG ĐIỀU KHIỂN & BÁO CÁO KINH DOANH (Dashboard - /):
   - Phân cấp theo 3 nhóm vai trò:
     + Sale Công Ty (role === 'sale'): Xem 4 thẻ chỉ số cá nhân (Doanh số chốt, % KPI, Pax, Slot sắp hết hạn Hold) và 2 bảng chi tiết (Booking cá nhân, Đơn hỗ trợ CTV/Đại lý).
     + Sale Leader (role === 'sale_leader'): Xem tổng quan team (Doanh số team, % KPI team, Pax team, Hold slots mở), Leaderboard xếp hạng nhân viên và Báo cáo hạch toán Lãi/Lỗ Tour gửi đối tác (partner) & Đoàn riêng (private).
     + Admin & Ban Giám Đốc (role === 'admin' | 'bod'): Bảng chiến lược toàn cty (Doanh thu, Lãi gộp, Net Margin %, Pax), Biểu đồ cơ cấu kênh bán & Lãi theo loại tour, Báo cáo hiệu quả theo Team & Chi tiết Sale.
   - Bộ chuyển đổi 4 chế độ xem báo cáo: Bảng dữ liệu (Table), Biểu đồ cột (BarChart), Biểu đồ đường (LineChart), Biểu đồ hình tròn (PieChart).

2. QUẢN LÝ TOUR DU LỊCH & LỊCH KHỞI HÀNH (/tours & /calendar):
   - Phân loại 3 loại tour: Tour tự vận hành (internal), Tour gửi đối tác (partner/F2), Tour đoàn riêng (private). Dịch vụ visa lẻ (tour_type === 'visa') không tính là Tour du lịch.
   - Nút "+ Thêm Tour Mới" (chỉ hiển thị cho Operator & Admin) nằm tại thanh tiêu đề Danh sách điều phối chỗ. Tích hợp tạo nhanh Danh mục sản phẩm mới ngay trên form khai báo Tour.
   - Biểu giá chi tiết theo thứ tự ưu tiên: (1) Người lớn (≥ 10 tuổi), (2) Trẻ em (2 - < 10 tuổi), (3) Trẻ nhỏ (< 2 tuổi), (4) Phụ thu phòng đơn, (5) Dịch vụ Visa, (6) Hoa hồng/khách.
   - Quản lý Tour (/tours): Hỗ trợ phân trang (5, 10, 20, 50 phần tử/trang), lọc từ khóa, tháng khởi hành, danh mục và bộ lọc thời gian (Sắp khởi hành, Đã khởi hành/Lưu trữ).
   - Lịch khởi hành (/calendar): Tự động lọc bỏ các tour đã khởi hành trước 00:00 hôm nay và khóa nút đặt chỗ đối với tour đã quá lịch.
   - Thẻ thông tin đối tác F2 chỉ hiển thị cho Operator, Admin, Sale Leader và BOD.

3. QUẢN LÝ BOOKING / ĐƠN HÀNG (/bookings):
   - Trạng thái thanh toán: Chưa thanh toán (unpaid), Thanh toán 1 phần (partially_paid), Đã thanh toán (paid).
   - Trạng thái booking: Chờ xác nhận (pending), Đã xác nhận (confirmed), Đã hủy (cancelled).
   - Quản lý nhiều khoản phụ thu (surcharges): Nâng hạng ghế, vé tham quan, phòng đơn... Chỉ cộng vào tổng giá trị booking, KHÔNG tính vào hoa hồng CTV/Đại lý.
   - Chênh lệch CTV (price_markup): CTV bán chênh giá -> Công ty thu phí (mặc định 25%, có thể chỉnh 0-100%) trên khoản chênh -> Hoa hồng CTV thực nhận = Hoa hồng định mức + (Khoản chênh - Phí công ty).
   - Bảng thống kê hoa hồng trình bày minh bạch 4 mục: (1) Hoa hồng gốc, (2) Giá chênh lệch & Phí công ty, (3) Khoản giảm giá cho khách (nếu có), (4) Tổng hoa hồng thực nhận.

4. QUẢN LÝ HÀNH KHÁCH & XIN VISA (/passengers & /visa):
   - Thông tin hành khách (pax): Tên, giới tính, ngày sinh, số hộ chiếu, hạn hộ chiếu, trạng thái visa.
   - Trạng thái visa: Chưa xin (none), Đã nộp (applied), Đã đạt (approved), Từ chối (rejected). Đính kèm file visa từ Storage.
   - Quản lý File mẫu hướng dẫn Visa riêng từng loại dịch vụ và mẫu chung toàn hệ thống.

5. KẾ TOÁN, THU CHI & ĐỀ NGHỊ THANH TOÁN (/invoices & /payment-proposals):
   - Phiếu thu (receipt) và Phiếu chi (payment).
   - Mã Đề nghị thanh toán chuẩn hóa: DNTT-mmyyyy-stt (ví dụ: DNTT-082026-001). Tự động phân loại Chi phí theo Tour hoặc Chi phí chung.
   - Ô nhập Hoa hồng trong Bảng Khai Báo Chi Phí Tour ở trạng thái chỉ đọc (read-only) và tự động tính tổng từ danh sách booking thuộc tour đó.

6. HƯỚNG DẪN VIÊN & BẢO TÀNG ẢNH ĐOÀN (/tour-media):
   - Dành cho HDV (tour_guide), Operator, Admin. Ẩn đối với CTV.
   - Nút duy nhất "📂 Mở Thư Mục Google Drive" dẫn tới: AD Luxury Travel > Tour > {MÃ_TOUR} > Ảnh đoàn.
   - Phân quyền upload ảnh đoàn và chèn link HDV freelance cho Operator, HDV và Admin.

7. BẢO BỘ LƯU TRỮ TÀI LIỆU (Google Drive & Supabase Storage):
   - Tất cả tài liệu, hóa đơn, minh chứng, hộ chiếu, visa tự động lưu vào Google Drive (thư mục gốc AD Luxury Travel) hoặc dự phòng Supabase Storage (bucket crm-attachments).
   - Thư mục Google Drive chuẩn hóa:
     + Tour & Chi phí: AD Luxury Travel > Tour > {MÃ_TOUR}
     + Hộ chiếu / Pax: AD Luxury Travel > Đơn hàng > {SỐ_HỘ_CHIẾU}
     + Kế toán DNTT: AD Luxury Travel > Kế toán > Tháng {MM-YYYY} > Chi phí
     + Ảnh kỷ niệm đoàn: AD Luxury Travel > Tour > {MÃ_TOUR} > Ảnh đoàn

8. PHÂN QUYỀN VAI TRÒ HỆ THỐNG (RBAC - 8 Vai trò):
   - admin & bod: Toàn quyền hệ thống, xem báo cáo toàn cty, sử dụng "Vai trò đang xem" (Role Switcher), hiệu chỉnh kiến thức Trợ lý AI. Admin mặc định: marketing@adluxury.net, marketing.adluxury@gmail.com.
   - operator: Tạo tour mới, cập nhật lịch khởi hành, quản lý slot, phân công HDV, xem/upload ảnh đoàn, phê duyệt dịch vụ tour.
   - sale_leader: Quản lý team sale, xem Leaderboard & KPI team. Được Tạo/Sửa/Xem Lãi Lỗ DUY NHẤT cho Tour gửi đối tác (partner) & Đoàn riêng (private). KHÔNG được thao tác với Tour tự vận hành (internal).
   - sale: Tạo booking, quản lý booking cá nhân, hỗ trợ nhập cọc/booking cho CTV, theo dõi KPI cá nhân.
   - accounting: Quản lý Thu/Chi, duyệt DNTT, đối soát thanh toán booking.
   - visa: Quản lý pax, nộp & cập nhật trạng thái visa, đính kèm kết quả visa.
   - tour_guide: Xem danh sách đoàn, mở thư mục Drive ảnh đoàn, upload ảnh kỷ niệm chuyến đi.
   - agent / CTV: Xem lịch khởi hành, giữ chỗ (hold slots), tạo booking cá nhân, theo dõi hoa hồng thực nhận.

VAI TRÒ HIỆN TẠI CỦA NGƯỜI DÙNG DỰA TRÊN PHIÊN ĐĂNG NHẬP: "${currentRole || 'N/A'}".

QUY TẮC TRẢ LỜI BẮT BUỘC (TUÂN THỦ 100%):
1. QUY ĐỊNH THUẬT NGỮ BẮT BUỘC:
   - Luôn sử dụng từ "booking" (hoặc "mã booking"), TUYỆT ĐỐI KHÔNG dùng từ "đơn hàng".
   - Luôn sử dụng các thuật ngữ du lịch chuẩn: "pax" (hoặc "hành khách"), "slot", "giữ chỗ (hold)", "lịch khởi hành", "CTV", "Đại lý", "DNTT (Đề nghị thanh toán)", "phiếu thu/chi".
2. PHONG CÁCH TRẢ LỜI NGẮN GỌN & SÚC TÍCH:
   - Trả lời cực kỳ ngắn gọn, súc tích, đi thẳng vào trọng tâm, tuyệt đối không viết dài dòng lê thê.
   - Trình bày dạng gạch đầu dòng (bullet points) rõ ràng, sử dụng thụt lùi đầu dòng cho danh sách nhiều tầng, dùng chữ in đậm (**bold**) để làm nổi bật từ khóa chính.
3. KHÔNG DÙNG CÔNG THỨC TOÁN HỌC KHÔ KHAN:
   - Không đưa phương trình hay công thức toán học phức tạp. Chỉ giải thích nguyên tắc ngắn gọn và LUÔN kèm theo VÍ DỤ SỐ TIỀN THỰC TẾ cụ thể.
4. XƯNG HÔ & PHÂN QUYỀN:
   - Trả lời bằng Tiếng Việt chuẩn mực, xưng hô lịch sự, chuyên nghiệp.
   - Tùy chỉnh câu trả lời phù hợp với vai trò người dùng (${currentRole || 'mọi người dùng'}).
5. HỖ TRỢ ADMIN HIỆU CHỈNH:
   - Nếu người dùng là Quản trị viên (Admin) và thông báo thông tin bị sai lệch, hỗ trợ Admin hiệu chỉnh. TUYỆT ĐỐI KHÔNG tự động chèn/ghi thêm các câu ghi chú dạng "*(Nếu câu trả lời chưa đúng...)*" ở cuối câu trả lời. Giao diện UI đã tự động trang bị nút Góp ý cho Quản trị viên.
6. GIỚI HẠN PHẠM VI:
   - Nếu câu hỏi ngoài phạm vi hệ thống ERP AD Luxury Travel, nhẹ nhàng nhắc người dùng rằng bạn là Trợ lý AI chuyên trách hướng dẫn ERP AD Luxury Travel.
`.trim();

    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    let response;
    try {
      // Primary model: gemini-3.6-flash (high speed, accurate, available quota)
      response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.5
        }
      });
    } catch (modelError: any) {
      console.warn('[AI Copilot] Primary model error, trying gemini-3.1-flash-lite:', modelError?.message || modelError);
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.5
          }
        });
      } catch (fallbackError: any) {
        console.error('[AI Copilot] Fallback model also failed:', fallbackError?.message || fallbackError);
        throw fallbackError;
      }
    }

    const replyText = response.text || 'Xin lỗi, không nhận được phản hồi từ AI Copilot.';

    return res.json({ reply: replyText });
  } catch (err: any) {
    console.error('[AI Chatbot Error]:', err);
    return res.status(500).json({
      error: err.message || 'Đã xảy ra lỗi khi xử lý yêu cầu trò chuyện với AI Copilot.'
    });
  }
});

// Admin Feedback & Knowledge Correction Endpoint
app.post('/api/ai/feedback', async (req, res) => {
  try {
    const { originalQuestion, botResponse, feedbackContent, userRole } = req.body;
    
    if (!feedbackContent || !feedbackContent.trim()) {
      return res.status(400).json({ error: 'Nội dung góp ý không được để trống.' });
    }

    console.log('[AI Assistant Admin Feedback Received]:', {
      timestamp: new Date().toISOString(),
      userRole,
      originalQuestion,
      botResponse: botResponse?.substring(0, 100) + '...',
      feedbackContent
    });

    return res.json({
      success: true,
      message: 'Cảm ơn Admin! Hệ thống đã tiếp nhận nội dung góp ý & hiệu chỉnh của Quản trị viên thành công.'
    });
  } catch (err: any) {
    console.error('[AI Feedback Error]:', err);
    return res.status(500).json({ error: err.message || 'Lỗi xử lý phản hồi Admin.' });
  }
});

// Global JSON error handler to prevent HTML error responses

app.use('/api', (req, res) => {
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
