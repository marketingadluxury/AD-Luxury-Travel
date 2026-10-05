import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { JWT } from 'google-auth-library';
import { getAdminSupabaseClient } from '../services/supabaseService.js';
import { getActiveDriveConfig, clearDriveConfigCache } from '../services/googleDriveService.js';

const router = express.Router();

// Middleware kiểm tra quyền Admin hoặc BOD
const requireAdminOrBOD = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Cho phép nếu có role được truyền từ header nội bộ
      const headerRole = req.headers['x-user-role'] as string;
      if (['admin', 'bod'].includes(headerRole)) {
        return next();
      }
      return res.status(401).json({ error: 'Chưa được xác thực hoặc không có quyền truy cập.' });
    }

    const token = authHeader.split(' ')[1];
    const supabase = getAdminSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !['admin', 'bod'].includes(profile.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền quản trị cài đặt Google Drive.' });
    }

    next();
  } catch (err: any) {
    console.error('[Drive Config] Auth error:', err);
    return res.status(500).json({ error: 'Lỗi xác thực quyền người dùng.' });
  }
};

/**
 * Lấy token thử nghiệm từ tham số hoặc cấu hình
 */
async function fetchTestDriveToken(config: {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  serviceEmail?: string;
  serviceKey?: string;
}): Promise<string> {
  const { clientId, clientSecret, refreshToken, serviceEmail, serviceKey } = config;

  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new OAuth2Client(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const tokenResponse = await oauth2Client.getAccessToken();
    if (tokenResponse.token) {
      return tokenResponse.token;
    }
    throw new Error('Không thể lấy Access Token từ OAuth 2.0 Refresh Token. Vui lòng kiểm tra lại Client ID, Client Secret và Refresh Token.');
  }

  if (serviceEmail && serviceKey && serviceKey.includes('PRIVATE KEY')) {
    let key = serviceKey;
    if (key.includes('\\n')) {
      key = key.replace(/\\n/g, '\n');
    }
    const client = new JWT({
      email: serviceEmail,
      key,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const tokens = await client.authorize();
    if (tokens.access_token) {
      return tokens.access_token;
    }
    throw new Error('Không thể xác thực Service Account.');
  }

  throw new Error('Vui lòng cung cấp đầy đủ thông tin xác thực OAuth 2.0 (Client ID, Secret, Refresh Token) hoặc Service Account.');
}

// 1. GET /api/drive/config - Lấy cấu hình Drive hiện tại
router.get(['/api/drive/config', '/drive/config'], requireAdminOrBOD, async (req, res) => {
  try {
    const supabase = getAdminSupabaseClient();
    
    // Lấy config từ app_settings
    const { data: dbSetting } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'google_drive_config')
      .maybeSingle();

    const activeConfig = await getActiveDriveConfig();

    const isCustomDb = !!(dbSetting && dbSetting.value && dbSetting.value.is_active !== false);
    const rawConfig = isCustomDb ? dbSetting.value : activeConfig;

    // Che mờ secret và refresh token khi gửi về client
    const maskString = (str?: string) => {
      if (!str) return '';
      if (str.length <= 8) return '••••••••';
      return str.slice(0, 4) + '••••••••' + str.slice(-4);
    };

    res.json({
      success: true,
      source: isCustomDb ? 'database' : 'env',
      is_active: rawConfig.is_active !== false,
      client_id: rawConfig.client_id || '',
      client_secret_masked: maskString(rawConfig.client_secret),
      has_client_secret: !!rawConfig.client_secret,
      refresh_token_masked: maskString(rawConfig.refresh_token),
      has_refresh_token: !!rawConfig.refresh_token,
      parent_folder_id: rawConfig.parent_folder_id || '',
      service_account_email: rawConfig.service_account_email || '',
      has_service_key: !!rawConfig.service_account_private_key,
      account_email: rawConfig.account_email || '',
      updated_at: dbSetting?.updated_at || null,
      updated_by: dbSetting?.updated_by || null,
      env_fallback_available: !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_REFRESH_TOKEN)
    });
  } catch (error: any) {
    console.error('[Drive Config] Get error:', error);
    res.status(500).json({ error: error.message || 'Lỗi khi nạp cấu hình Google Drive.' });
  }
});

// 2. POST /api/drive/test-connection - Thử nghiệm kết nối
router.post(['/api/drive/test-connection', '/drive/test-connection'], requireAdminOrBOD, async (req, res) => {
  try {
    const body = req.body || {};
    const activeConfig = await getActiveDriveConfig();

    // Lấy thông tin từ body nếu có, ngược lại dùng config đã lưu
    const clientId = body.client_id?.trim() || activeConfig.client_id;
    const clientSecret = body.client_secret?.trim() || activeConfig.client_secret;
    const refreshToken = body.refresh_token?.trim() || activeConfig.refresh_token;
    const parentFolderId = (body.parent_folder_id !== undefined ? body.parent_folder_id : activeConfig.parent_folder_id)?.trim();
    const serviceEmail = body.service_account_email?.trim() || activeConfig.service_account_email;
    const serviceKey = body.service_account_private_key || activeConfig.service_account_private_key;

    console.log('[Drive Test] Bắt đầu kiểm tra kết nối Google Drive...');
    const token = await fetchTestDriveToken({
      clientId,
      clientSecret,
      refreshToken,
      serviceEmail,
      serviceKey
    });

    // 1. Lấy thông tin tài khoản Google Drive & Dung lượng
    const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!aboutRes.ok) {
      const errText = await aboutRes.text();
      throw new Error(`Google Drive API trả về lỗi: ${errText}`);
    }

    const aboutData: any = await aboutRes.json();
    const user = aboutData.user || {};
    const quota = aboutData.storageQuota || {};

    let folderInfo: any = null;

    // 2. Kiểm tra Thư mục cha (Parent Folder ID) nếu có chỉ định
    if (parentFolderId) {
      const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files/${parentFolderId}?fields=id,name,mimeType,capabilities,trashed&supportsAllDrives=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!folderRes.ok) {
        throw new Error(`Không tìm thấy thư mục cha với ID "${parentFolderId}" hoặc tài khoản chưa được cấp quyền truy cập.`);
      }

      const folderData: any = await folderRes.json();
      if (folderData.trashed) {
        throw new Error(`Thư mục cha "${folderData.name}" (${parentFolderId}) đang nằm trong Thùng rác (Trash). Vui lòng khôi phục hoặc chọn thư mục khác.`);
      }

      if (folderData.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error(`ID "${parentFolderId}" là một tệp tin thông thường, không phải là Thư mục (Folder).`);
      }

      const canAddChildren = folderData.capabilities?.canAddChildren !== false;
      folderInfo = {
        id: folderData.id,
        name: folderData.name,
        canAddChildren
      };

      if (!canAddChildren) {
        console.warn(`[Drive Test] Cảnh báo: Tài khoản chỉ có quyền xem (Read-only) tại thư mục "${folderData.name}".`);
      }
    }

    res.json({
      success: true,
      message: 'Kết nối Google Drive thành công!',
      account: {
        displayName: user.displayName || 'Google Drive User',
        emailAddress: user.emailAddress || '',
        photoLink: user.photoLink || ''
      },
      storage: {
        limit: quota.limit ? Number(quota.limit) : null,
        usage: quota.usage ? Number(quota.usage) : 0,
        usageInDrive: quota.usageInDrive ? Number(quota.usageInDrive) : 0,
        usageInDriveTrash: quota.usageInDriveTrash ? Number(quota.usageInDriveTrash) : 0
      },
      folder: folderInfo
    });
  } catch (error: any) {
    console.error('[Drive Test] Lỗi kiểm tra kết nối:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Không thể kết nối đến Google Drive.'
    });
  }
});

// 3. POST /api/drive/config - Lưu cấu hình mới
router.post(['/api/drive/config', '/drive/config'], requireAdminOrBOD, async (req, res) => {
  try {
    const supabase = getAdminSupabaseClient();
    const body = req.body || {};

    const activeConfig = await getActiveDriveConfig();

    // Xử lý giữ nguyên secret / refresh_token nếu người dùng không nhập mới (để trống khi sửa)
    const client_id = body.client_id?.trim() || '';
    const client_secret = body.client_secret?.trim() || activeConfig.client_secret || '';
    const refresh_token = body.refresh_token?.trim() || activeConfig.refresh_token || '';
    const parent_folder_id = body.parent_folder_id?.trim() || '';
    const service_account_email = body.service_account_email?.trim() || '';
    const service_account_private_key = body.service_account_private_key || activeConfig.service_account_private_key || '';
    const account_email = body.account_email?.trim() || '';
    const is_active = body.is_active !== false;

    if (is_active) {
      if (!client_id && !service_account_email) {
        return res.status(400).json({ error: 'Vui lòng cung cấp Client ID (OAuth 2.0) hoặc Service Account Email.' });
      }
      if (client_id && (!client_secret || !refresh_token)) {
        return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ Client Secret và Refresh Token để xác thực OAuth 2.0.' });
      }
    }

    const payload = {
      client_id,
      client_secret,
      refresh_token,
      parent_folder_id,
      service_account_email,
      service_account_private_key,
      account_email,
      is_active
    };

    const userEmail = (req.headers['x-user-email'] as string) || 'Admin';

    const { error: saveErr } = await supabase
      .from('app_settings')
      .upsert({
        key: 'google_drive_config',
        value: payload,
        updated_at: new Date().toISOString(),
        updated_by: userEmail
      }, { onConflict: 'key' });

    if (saveErr) {
      throw new Error(`Lỗi lưu vào CSDL: ${saveErr.message}`);
    }

    // Xóa cache trong runtime để backend áp dụng ngay cấu hình mới
    clearDriveConfigCache();

    res.json({
      success: true,
      message: 'Đã lưu và kích hoạt cấu hình Google Drive mới thành công!'
    });
  } catch (error: any) {
    console.error('[Drive Config] Save error:', error);
    res.status(500).json({ error: error.message || 'Lỗi khi lưu cấu hình Google Drive.' });
  }
});

// 4. POST /api/drive/reset-config - Khôi phục về biến môi trường (.env)
router.post(['/api/drive/reset-config', '/drive/reset-config'], requireAdminOrBOD, async (req, res) => {
  try {
    const supabase = getAdminSupabaseClient();
    
    // Xóa bản ghi google_drive_config trong app_settings hoặc set is_active: false
    await supabase
      .from('app_settings')
      .delete()
      .eq('key', 'google_drive_config');

    clearDriveConfigCache();

    res.json({
      success: true,
      message: 'Đã khôi phục về cấu hình Google Drive mặc định từ biến môi trường (.env) thành công!'
    });
  } catch (error: any) {
    console.error('[Drive Config] Reset error:', error);
    res.status(500).json({ error: error.message || 'Lỗi khi khôi phục cấu hình mặc định.' });
  }
});

export default router;
