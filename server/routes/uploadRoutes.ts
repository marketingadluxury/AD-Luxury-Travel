import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  getGoogleDriveAccessToken,
  getFolderWebViewLink,
  getOrCreatePassengerFolder,
  getOrCreateTourSubFolderV2,
  getOrCreateAccountingExpenseFolder,
  getOrCreateFeedbackFolder,
  getOrCreateChatFolder,
  getOrCreateVisaFolder,
  getOrCreateVisaServiceFolder,
  getOrCreateTourFolderV2,
  getOrCreateOrderFolderV2,
  decodeUTF8,
  uploadWith3TierFallback,
  getTourCodeFromOrderOrTour,
  formatOrderCode,
  uploadFileToGoogleDrive,
  getGoogleDriveFileId,
  deleteGoogleDriveFile
} from '../services/googleDriveService.js';
import { getAdminSupabaseClient, getSupabaseClient, getPathFromPublicUrl } from '../services/supabaseService.js';

const router = express.Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Create Google Drive passenger folder
router.post(['/create-folder', '/api/create-folder'], async (req, res) => {
  try {
    const { passportNumber, fullName } = req.body;
    
    const hasServiceAccount = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.includes('PRIVATE KEY'));
    const hasOAuth = !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
    
    if (!hasServiceAccount && !hasOAuth) {
      res.status(400).json({ 
        error: 'Google Drive chưa được cấu hình. Vui lòng thiết lập biến môi trường trong file .env để sử dụng hệ thống.' 
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

// Unified File Upload API
router.post(['/upload', '/api/upload'], (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[Multer upload error]:', err);
      return res.status(400).json({ error: err.message || 'Lỗi tải file lên máy chủ' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Không tìm thấy file nào được gửi lên.' });
      return;
    }

    if (req.file) {
      req.file.originalname = decodeUTF8(req.file.originalname) || req.file.originalname;
    }

    const body = { ...req.body };
    const fieldsToDecode = ['fullName', 'passportNumber', 'visaName', 'tourTitle', 'category', 'visaCode', 'tourCode', 'orderCode', 'orderId', 'proposalCode', 'proposalType', 'proposal_code', 'proposal_type', 'tour_code'];
    fieldsToDecode.forEach(field => {
      if (body[field]) body[field] = decodeUTF8(body[field]);
    });

    const file = req.file;
    const isTourMediaUpload = body.uploadType === 'tour_media' || body.category === 'tour_media' || body.category === 'tour_photos';
    const isFeedbackUpload = body.uploadType === 'feedback' || body.category === 'feedback';
    const isChatUpload = body.uploadType === 'chat' || body.category === 'chat';
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
        console.warn('[Upload Tour Media] Lỗi tra cứu Tour:', dbErr);
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
          console.warn('[Upload Tour Media] Warning when inserting tour_media:', insertErr.message);
        } else {
          insertedRecord = inserted;
        }
      } catch (insertCatchErr) {
        console.warn('[Upload Tour Media] Error creating tour_media:', insertCatchErr);
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

    if (isChatUpload) {
      const cleanFileName = file.originalname.trim().replace(/\s+/g, '_');
      const fileName = `CHAT_${Date.now()}_${cleanFileName}`;

      const resData = await uploadWith3TierFallback(
        req,
        file,
        fileName,
        (token) => getOrCreateChatFolder(token),
        `Chat/${fileName}`
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

// Unified Invoice Receipt Upload API
router.post(['/upload-invoice-receipt', '/api/upload-invoice-receipt', '/drive/upload', '/api/drive/upload'], upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Không tìm thấy file để tải lên.' });
      return;
    }

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
router.post('/get-tour-folder', async (req, res) => {
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

// Unified File Deletion API
router.post(['/delete', '/api/delete'], async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: 'Thiếu URL của file cần xóa.' });
      return;
    }
    
    const isGoogleDrive = url.includes('drive.google.com') || 
                          url.includes('docs.google.com') || 
                          url.includes('ouid=') || 
                          url.includes('usp=drivesdk') ||
                          url.includes('/file/d/');
    const isSupabase = url.includes('supabase.com/dashboard/project') || url.includes('supabase.co');

    if (isGoogleDrive) {
      const fileId = getGoogleDriveFileId(url);
      if (!fileId) {
        res.json({ success: true, message: 'Không thể xóa file vật lý (ID không hợp lệ), đã gỡ liên kết trong database.', storage: 'drive' });
        return;
      }
      
      const hasServiceAccount = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.includes('PRIVATE KEY'));
      const hasOAuth = !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);

      if (!hasServiceAccount && !hasOAuth) {
        res.json({ success: true, message: 'Google Drive chưa được cấu hình, chỉ gỡ liên kết.', storage: 'drive' });
        return;
      }

      try {
        const token = await getGoogleDriveAccessToken();
        await deleteGoogleDriveFile(fileId, token);
        res.json({ success: true, storage: 'drive' });
      } catch (err: any) {
        console.error('Lỗi khi xóa file thực tế trên Google Drive:', err);
        res.json({ success: true, warning: 'Lỗi gỡ file vật lý nhưng đã đồng ý gỡ liên kết trong database.', storage: 'drive' });
      }
    } else if (isSupabase) {
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
      res.json({ success: true, message: 'Đường dẫn file không được hỗ trợ để xóa vật lý, đã gỡ liên kết trong hệ thống.', storage: 'unknown' });
    }
  } catch (error: any) {
    console.error('Lỗi API /api/delete:', error);
    res.status(500).json({ error: 'Lỗi xóa file: ' + (error.message || 'Unknown error') });
  }
});

// Drive Status Endpoint
router.get(['/drive-status', '/api/drive-status'], (req, res) => {
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

export default router;
