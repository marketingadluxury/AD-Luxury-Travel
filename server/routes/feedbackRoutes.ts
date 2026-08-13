import express from 'express';
import { getAdminSupabaseClient } from '../services/supabaseService.js';
import { getGoogleDriveAccessToken, getOrCreateFeedbackFolder, uploadFileToGoogleDrive } from '../services/googleDriveService.js';

const router = express.Router();

// Feedback / Bug reports API
router.post(['/feedback', '/api/feedback'], async (req, res) => {
  try {
    const { type, title, description, user_email, user_name, page_url, screenshot_url, metadata } = req.body;
    
    if (!title || !description) {
      res.status(400).json({ error: 'Tiêu đề và nội dung góp ý/báo lỗi không được để trống' });
      return;
    }

    const supabase = getAdminSupabaseClient(req);

    // 1. Try to save to Supabase system_feedback table
    let feedbackRecord = null;
    try {
      const { data, error } = await supabase
        .from('system_feedback')
        .insert({
          type: type || 'bug',
          title,
          description,
          user_email: user_email || 'Khai báo ẩn danh',
          user_name: user_name || 'Người dùng CRM',
          page_url: page_url || '',
          screenshot_url: screenshot_url || null,
          metadata: metadata || {}
        })
        .select()
        .single();

      if (error) {
        console.warn('[Feedback API] Warning when saving feedback to database:', error.message);
      } else {
        feedbackRecord = data;
      }
    } catch (err) {
      console.warn('[Feedback API] Database table "system_feedback" might not exist or error:', err);
    }

    // 2. Export / save to Google Drive if Drive is active
    let driveFileUrl = null;
    const hasServiceAccount = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.includes('PRIVATE KEY'));
    const hasOAuth = !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);

    if (hasServiceAccount || hasOAuth) {
      try {
        const token = await getGoogleDriveAccessToken();
        const feedbackFolderId = await getOrCreateFeedbackFolder(token);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `Feedback_${type || 'bug'}_${timestamp}.json`;
        const content = JSON.stringify({
          type: type || 'bug',
          title,
          description,
          user_email,
          user_name,
          page_url,
          screenshot_url,
          metadata,
          created_at: new Date().toISOString()
        }, null, 2);

        const uploadRes = await uploadFileToGoogleDrive(
          filename,
          'application/json',
          Buffer.from(content, 'utf-8'),
          feedbackFolderId,
          token,
          user_email
        );
        driveFileUrl = uploadRes.webViewLink;
      } catch (driveErr) {
        console.warn('[Feedback API] Could not save feedback JSON to Drive:', driveErr);
      }
    }

    res.json({
      success: true,
      message: 'Cảm ơn bạn! Yêu cầu góp ý/báo lỗi đã được ghi nhận thành công.',
      feedback: feedbackRecord,
      driveUrl: driveFileUrl
    });
  } catch (error: any) {
    console.error('Lỗi API /api/feedback:', error);
    res.status(500).json({ error: error.message || 'Lỗi gửi góp ý' });
  }
});

router.get(['/feedback', '/api/feedback'], async (req, res) => {
  try {
    const supabase = getAdminSupabaseClient(req);
    const { data, error } = await supabase
      .from('system_feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ feedback: data || [] });
  } catch (error: any) {
    console.error('Lỗi API GET /api/feedback:', error);
    res.status(500).json({ error: error.message || 'Lỗi lấy danh sách góp ý' });
  }
});

export default router;
