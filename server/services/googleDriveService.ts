import { JWT, OAuth2Client } from 'google-auth-library';
import { uploadFileToSupabase, getAdminSupabaseClient } from './supabaseService.js';
import express from 'express';

export async function getGoogleDriveAccessToken(): Promise<string> {
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let serviceKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  const hasOAuth = !!(clientId && clientSecret && refreshToken);
  const hasServiceAccount = !!(serviceEmail && serviceKey && serviceKey.includes('PRIVATE KEY'));

  // 1. OAuth 2.0
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
        console.log('[Drive] OAuth 2.0 failed, falling back to Service Account...');
      } else {
        throw new Error(`Xác thực OAuth 2.0 thất bại (${errMsg}). Vui lòng kiểm tra lại Refresh Token trong OAuth Playground.`);
      }
    }
  }

  // 2. Service Account
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

export async function searchFolder(folderName: string, parentId?: string, token?: string): Promise<string | null> {
  const safeName = folderName.replace(/'/g, "\\'");
  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
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

export async function createFolder(folderName: string, parentId?: string, token?: string): Promise<string> {
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

export async function makeFolderPublic(fileId: string, token?: string, userEmail?: string | string[]): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`;
  
  const targets: Array<{ type: string; role: string; emailAddress?: string }> = [
    { type: 'anyone', role: 'reader' },
    { type: 'user', emailAddress: 'marketing.adluxury@gmail.com', role: 'reader' },
    { type: 'user', emailAddress: 'marketing@adluxury.net', role: 'reader' }
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
        console.warn(`[Drive] Failed to share with ${target.emailAddress || target.type}:`, errText);
      }
    } catch (err) {
      console.error(`[Drive] Error sharing with ${target.emailAddress || target.type}:`, err);
    }
  }));
}

export async function getFolderWebViewLink(fileId: string, token?: string): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink&supportsAllDrives=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[Drive] Failed to get webViewLink: ${errText}`);
  }
  
  const data: any = await res.json();
  return data.webViewLink;
}

export function getDriveRootParentId(): string | undefined {
  return process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || 
         process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || 
         process.env.GOOGLE_DRIVE_FOLDER_ID ||
         process.env.DRIVE_PARENT_FOLDER_ID ||
         process.env.DRIVE_ROOT_ID;
}

export async function getOrCreateADLuxuryTravelRootFolder(baseParentId: string | undefined, token: string): Promise<string> {
  let rootId = await searchFolder('AD Luxury Travel', baseParentId, token);
  if (!rootId && baseParentId) {
    rootId = await searchFolder('AD Luxury Travel', undefined, token);
  }
  
  if (!rootId) {
    rootId = await createFolder('AD Luxury Travel', baseParentId, token);
    await makeFolderPublic(rootId, token);
  }
  return rootId;
}

export async function getOrCreatePassengerFolder(fullName: string, passportNumber: string, token: string): Promise<string> {
  const cleanPassport = (passportNumber || 'CHUA_CO_HC').trim().toUpperCase();
  const getInitials = (name: string) => {
    if (!name) return 'KH';
    const words = name.trim().split(/\s+/);
    return words.map(w => w.charAt(0).toUpperCase()).join('');
  };
  const initials = getInitials(fullName);
  const folderName = `${cleanPassport}-${initials}`;
  const baseParentId = getDriveRootParentId();

  const rootId = await getOrCreateADLuxuryTravelRootFolder(baseParentId, token);

  let khachHangFolderId = await searchFolder('Khách hàng', rootId, token);
  if (!khachHangFolderId) {
    khachHangFolderId = await createFolder('Khách hàng', rootId, token);
    await makeFolderPublic(khachHangFolderId, token);
  }

  let passengerFolderId = await searchFolder(folderName, khachHangFolderId, token);
  if (!passengerFolderId) {
    passengerFolderId = await createFolder(folderName, khachHangFolderId, token);
    await makeFolderPublic(passengerFolderId, token);
  }

  return passengerFolderId;
}

export async function getOrCreateTourFolder(category: string, token: string): Promise<string> {
  const cleanCategory = (category || 'Chung').trim();
  const baseParentId = getDriveRootParentId();

  const rootId = await getOrCreateADLuxuryTravelRootFolder(baseParentId, token);

  let tourFolderId = await searchFolder('Tour', rootId, token);
  if (!tourFolderId) {
    tourFolderId = await createFolder('Tour', rootId, token);
    await makeFolderPublic(tourFolderId, token);
  }

  let categoryFolderId = await searchFolder(cleanCategory, tourFolderId, token);
  if (!categoryFolderId) {
    categoryFolderId = await createFolder(cleanCategory, tourFolderId, token);
    await makeFolderPublic(categoryFolderId, token);
  }

  return categoryFolderId;
}

export async function getOrCreateVisaFolder(token: string): Promise<string> {
  const baseParentId = getDriveRootParentId();

  const rootId = await getOrCreateADLuxuryTravelRootFolder(baseParentId, token);

  let visaFolderId = await searchFolder('Visa', rootId, token);
  if (!visaFolderId && !baseParentId) {
    visaFolderId = await searchFolder('Visa', undefined, token);
  }
  
  if (!visaFolderId) {
    visaFolderId = await createFolder('Visa', rootId, token);
    await makeFolderPublic(visaFolderId, token);
  }

  return visaFolderId;
}

export async function getOrCreateVisaServiceFolder(visaCode: string, visaFolderId: string, token: string): Promise<string> {
  const cleanVisaCode = (visaCode || 'Dich_vu_Visa').trim().replace(/[\/\\\:\*\?\"\<\>\|]/g, '_');
  let serviceFolderId = await searchFolder(cleanVisaCode, visaFolderId, token);
  if (!serviceFolderId) {
    serviceFolderId = await createFolder(cleanVisaCode, visaFolderId, token);
    await makeFolderPublic(serviceFolderId, token);
  }
  return serviceFolderId;
}

export async function getOrCreateTourFolderV2(tourCode: string, token: string): Promise<string> {
  const cleanTourCode = (tourCode || 'TOUR_CHUNG').trim().replace(/[\/\\\:\*\?\"\<\>\|]/g, '_');
  const baseParentId = getDriveRootParentId();

  const rootId = await getOrCreateADLuxuryTravelRootFolder(baseParentId, token);

  let tourFolderId = await searchFolder('Tour', rootId, token);
  if (!tourFolderId) {
    tourFolderId = await createFolder('Tour', rootId, token);
    await makeFolderPublic(tourFolderId, token);
  }

  let targetTourFolderId = await searchFolder(cleanTourCode, tourFolderId, token);
  if (!targetTourFolderId) {
    targetTourFolderId = await createFolder(cleanTourCode, tourFolderId, token);
    await makeFolderPublic(targetTourFolderId, token);
  }

  return targetTourFolderId;
}

export async function getOrCreateTourSubFolderV2(tourCode: string, subFolder: 'Đơn hàng' | 'Chi phí' | 'Anh_Doan' | 'Ảnh đoàn' | string, token: string): Promise<string> {
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

export async function getOrCreateOrderFolderV2(tourCode: string, orderCode: string, token: string): Promise<string> {
  const donHangFolderId = await getOrCreateTourSubFolderV2(tourCode, 'Đơn hàng', token);

  const cleanOrderCode = formatOrderCode(orderCode).replace(/[\/\\\:\*\?\"\<\>\|]/g, '_');
  let orderFolderId = await searchFolder(cleanOrderCode, donHangFolderId, token);
  if (!orderFolderId) {
    orderFolderId = await createFolder(cleanOrderCode, donHangFolderId, token);
    await makeFolderPublic(orderFolderId, token);
  }

  return orderFolderId;
}

export async function getOrCreateAccountingExpenseFolder(mmyyyyStr: string, token: string): Promise<string> {
  const baseParentId = getDriveRootParentId();

  const rootId = await getOrCreateADLuxuryTravelRootFolder(baseParentId, token);

  let keToanFolderId = await searchFolder('Kế toán', rootId, token);
  if (!keToanFolderId) {
    keToanFolderId = await createFolder('Kế toán', rootId, token);
    await makeFolderPublic(keToanFolderId, token);
  }

  const monthFolderName = `Tháng ${mmyyyyStr}`;
  let monthFolderId = await searchFolder(monthFolderName, keToanFolderId, token);
  if (!monthFolderId) {
    monthFolderId = await createFolder(monthFolderName, keToanFolderId, token);
    await makeFolderPublic(monthFolderId, token);
  }

  let chiPhiFolderId = await searchFolder('Chi phí', monthFolderId, token);
  if (!chiPhiFolderId) {
    chiPhiFolderId = await createFolder('Chi phí', monthFolderId, token);
    await makeFolderPublic(chiPhiFolderId, token);
  }

  return chiPhiFolderId;
}

export async function getOrCreateFeedbackFolder(token: string): Promise<string> {
  const baseParentId = getDriveRootParentId();
  const rootId = await getOrCreateADLuxuryTravelRootFolder(baseParentId, token);
  let feedbackFolderId = await searchFolder('Góp Ý & Báo Lỗi', rootId, token);
  if (!feedbackFolderId) {
    feedbackFolderId = await createFolder('Góp Ý & Báo Lỗi', rootId, token);
    await makeFolderPublic(feedbackFolderId, token);
  }
  return feedbackFolderId;
}

export async function getOrCreateChatFolder(token: string): Promise<string> {
  const baseParentId = getDriveRootParentId();
  const rootId = await getOrCreateADLuxuryTravelRootFolder(baseParentId, token);
  let chatFolderId = await searchFolder('Trò chuyện', rootId, token);
  if (!chatFolderId) {
    chatFolderId = await createFolder('Trò chuyện', rootId, token);
    await makeFolderPublic(chatFolderId, token);
  }
  return chatFolderId;
}

export async function uploadFileToGoogleDrive(
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
  await makeFolderPublic(data.id, token, userEmail);
  
  return {
    id: data.id,
    webViewLink: data.webViewLink
  };
}

export function getGoogleDriveFileId(url: string): string | null {
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

export async function deleteGoogleDriveFile(fileId: string, token: string): Promise<void> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 404) {
        console.log(`[Drive] File ${fileId} không tồn tại hoặc đã bị xóa.`);
        return;
      }
      console.warn(`[Drive] Không thể xóa file vật lý ${fileId}:`, errText);
    } else {
      console.log(`[Drive] Đã xóa thành công file ${fileId}.`);
    }
  } catch (error: any) {
    console.warn(`[Drive] Lỗi khi gọi API xóa file ${fileId}:`, error.message || error);
  }
}

export function decodeUTF8(str: string | undefined): string {
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

export function formatOrderCode(orderIdOrCode: string | undefined): string {
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

export async function getTourCodeFromOrderOrTour(
  orderCode: string, 
  bodyTourCode: string | undefined, 
  supabase: any
): Promise<{ tourCode: string; isTourCodeDirectly: boolean; orderId?: string }> {
  const cleanTourCodeParam = (bodyTourCode || '').trim();
  const cleanOrderCodeParam = (orderCode || '').trim();

  const invalidPlaceholders = ['CHUA_RO', 'CHIPHI_TOUR', 'TOUR_CHUNG', 'TOUR', 'DON_HANG', 'CHIPHI'];
  
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
    const { data: tourByCode } = await supabase
      .from('tours')
      .select('code')
      .eq('code', cleanCode)
      .maybeSingle();

    if (tourByCode && tourByCode.code) {
      return { tourCode: tourByCode.code, isTourCodeDirectly: true };
    }

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

    const { data: toursList } = await supabase.from('tours').select('code').limit(100);
    if (toursList) {
      const matched = toursList.find((t: any) => t.code && cleanCode.toUpperCase().includes(t.code.toUpperCase()));
      if (matched) {
        return { tourCode: matched.code, isTourCodeDirectly: true };
      }
    }
  } catch (error) {
    console.warn('[Storage Config] Lỗi khi truy vấn thông tin Tour/Booking:', error);
  }

  return { tourCode: 'TOUR_CHUNG', isTourCodeDirectly: true };
}

export async function uploadWith3TierFallback(
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
      throw new Error('Hệ thống chưa được cấu hình liên kết tài khoản Google Drive.');
    }
    console.log('[Upload Fallback] Google Drive is not configured. Falling back to Supabase Storage...');
    const supabase = getAdminSupabaseClient(req);
    const publicUrl = await uploadFileToSupabase('crm-attachments', supabaseStoragePath, file.buffer, file.mimetype, supabase);
    return { url: publicUrl, storage: 'supabase' };
  }

  try {
    const token = await getGoogleDriveAccessToken();
    const folderId = await getDriveFolderId(token);
    const userEmail = req.headers['x-user-email'] as string | undefined;
    const result = await uploadFileToGoogleDrive(fileName, file.mimetype, file.buffer, folderId, token, userEmail);
    return { url: result.webViewLink, fileId: result.id, storage: 'drive' };
  } catch (driveErr: any) {
    const driveErrorMsg = driveErr.message || String(driveErr);
    console.warn('[Google Drive Upload Failure] Upload failed:', driveErrorMsg);
    if (strictDriveOnly) {
      throw new Error(`Lỗi tải file lên Google Drive: ${driveErrorMsg}.`);
    }
    console.log('[Upload Fallback] Falling back to Supabase Storage...', driveErrorMsg);
    try {
      const supabase = getAdminSupabaseClient(req);
      const publicUrl = await uploadFileToSupabase('crm-attachments', supabaseStoragePath, file.buffer, file.mimetype, supabase);
      return { url: publicUrl, storage: 'supabase' };
    } catch (supErr: any) {
      throw new Error(`Lỗi tải file: Cả Google Drive (${driveErrorMsg}) và Supabase Storage (${supErr.message || supErr}) đều thất bại.`);
    }
  }
}
