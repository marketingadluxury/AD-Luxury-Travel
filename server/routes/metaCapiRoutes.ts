import express from 'express';
import { 
  sendMetaConversionEvent, 
  getMetaCapiConfig, 
  normalizeAndHashPhone, 
  normalizeAndHashEmail,
  MetaCapiEventParams 
} from '../services/metaCapiService.js';
import { getAdminSupabaseClient } from '../services/supabaseService.js';

const router = express.Router();

/**
 * Gửi sự kiện chuyển đổi lên Meta Conversions API
 */
router.post('/api/meta-capi/send-event', async (req, res) => {
  try {
    const params: MetaCapiEventParams = {
      event_name: req.body.event_name || 'Lead',
      tracking_type: req.body.tracking_type || 'PHONE_LEAD',
      event_id: req.body.event_id,
      order_id: req.body.order_id,
      tour_id: req.body.tour_id,
      tour_code: req.body.tour_code,
      tour_name: req.body.tour_name,
      customer_name: req.body.customer_name,
      customer_phone: req.body.customer_phone,
      customer_email: req.body.customer_email,
      meta_lead_id: req.body.meta_lead_id,
      revenue_value: req.body.revenue_value,
      currency: req.body.currency || 'VND',
      pax_count: req.body.pax_count,
      test_event_code: req.body.test_event_code,
      client_ip_address: req.ip || req.headers['x-forwarded-for'] as string,
      client_user_agent: req.headers['user-agent'],
      utm_source: req.body.utm_source,
      utm_campaign: req.body.utm_campaign
    };

    const result = await sendMetaConversionEvent(params);
    res.json(result);
  } catch (error: any) {
    console.error('[Meta CAPI Route] Lỗi:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi máy chủ khi gửi sự kiện Meta CAPI'
    });
  }
});

/**
 * Lấy cấu hình Meta Pixel & CAPI hiện tại
 */
router.get('/api/meta-capi/config', async (req, res) => {
  try {
    const config = await getMetaCapiConfig();
    const maskedToken = config.access_token 
      ? (config.access_token.length > 12 
          ? `${config.access_token.substring(0, 6)}...${config.access_token.substring(config.access_token.length - 4)}` 
          : '******')
      : '';

    res.json({
      success: true,
      data: {
        pixel_id: config.pixel_id || '',
        access_token_masked: maskedToken,
        has_access_token: Boolean(config.access_token),
        test_event_code: config.test_event_code || '',
        is_enabled: config.is_enabled
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy cấu hình Meta CAPI'
    });
  }
});

/**
 * Cập nhật cấu hình Meta Pixel & CAPI vào Database
 */
router.post('/api/meta-capi/config', async (req, res) => {
  try {
    const { pixel_id, access_token, test_event_code, is_enabled } = req.body;

    const supabase = getAdminSupabaseClient();
    
    // Đọc token hiện tại nếu người dùng không đổi
    let finalAccessToken = access_token;
    if (!finalAccessToken || finalAccessToken.includes('...')) {
      const currentConfig = await getMetaCapiConfig();
      finalAccessToken = currentConfig.access_token;
    }

    const payload: Record<string, any> = {
      pixel_id: pixel_id ? String(pixel_id).trim() : '',
      access_token: finalAccessToken ? String(finalAccessToken).trim() : '',
      test_event_code: test_event_code ? String(test_event_code).trim() : null,
      is_enabled: is_enabled !== undefined ? Boolean(is_enabled) : true,
      updated_at: new Date().toISOString()
    };

    // Kiểm tra xem đã có bản ghi cấu hình nào chưa
    const { data: existingList } = await supabase
      .from('meta_capi_settings')
      .select('id')
      .limit(1);

    let data;
    if (existingList && existingList.length > 0) {
      const { data: updated, error } = await supabase
        .from('meta_capi_settings')
        .update(payload)
        .eq('id', existingList[0].id)
        .select()
        .single();

      if (error) throw error;
      data = updated;
    } else {
      const { data: inserted, error } = await supabase
        .from('meta_capi_settings')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      data = inserted;
    }

    res.json({
      success: true,
      message: 'Cập nhật cấu hình Meta CAPI thành công!',
      data
    });
  } catch (error: any) {
    console.error('[Meta CAPI Save Config] Lỗi:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lưu cấu hình Meta CAPI'
    });
  }
});

/**
 * Lấy danh sách lịch sử chuyển đổi Meta Conversion Logs
 */
router.get('/api/meta-capi/logs', async (req, res) => {
  try {
    const supabase = getAdminSupabaseClient();
    const limit = parseInt(req.query.limit as string) || 100;
    const eventName = req.query.event_name as string;

    let query = supabase
      .from('meta_conversion_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (eventName && eventName !== 'all') {
      query = query.eq('event_name', eventName);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    console.error('[Meta CAPI Logs] Lỗi:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy danh sách log Meta CAPI'
    });
  }
});

/**
 * Gửi sự kiện Test lên Meta để kiểm tra kết nối Pixel & Token
 */
router.post('/api/meta-capi/test-connection', async (req, res) => {
  try {
    const { test_event_code, pixel_id, access_token } = req.body;

    const testPhone = '0988888888';
    const testEmail = 'test.lead@adluxury.net';

    const testParams: MetaCapiEventParams = {
      event_name: 'Lead',
      tracking_type: 'PHONE_LEAD',
      customer_name: 'Khách Hàng Test Meta CAPI',
      customer_phone: testPhone,
      customer_email: testEmail,
      tour_name: 'Tour Test Thử Nghiệm Meta CAPI',
      revenue_value: 10000000,
      currency: 'VND',
      pax_count: 1,
      test_event_code: test_event_code || undefined,
      client_ip_address: req.ip || '127.0.0.1',
      client_user_agent: req.headers['user-agent']
    };

    // Nếu người dùng cung cấp pixel/token tạm để test
    if (pixel_id && access_token) {
      const { normalized, hashed: hashedPhone } = normalizeAndHashPhone(testPhone);
      const hashedEmail = normalizeAndHashEmail(testEmail);

      const eventPayload = {
        data: [
          {
            event_name: 'Lead',
            event_time: Math.floor(Date.now() / 1000),
            event_id: crypto.randomUUID(),
            action_source: 'system_generated',
            user_data: {
              ph: [hashedPhone],
              em: [hashedEmail]
            },
            custom_data: {
              currency: 'VND',
              value: 10000000,
              content_name: 'Tour Test Thử Nghiệm Meta CAPI'
            }
          }
        ],
        ...(test_event_code ? { test_event_code } : {})
      };

      const metaRes = await fetch(`https://graph.facebook.com/v19.0/${pixel_id}/events?access_token=${access_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload)
      });

      const metaData = await metaRes.json();
      if (!metaRes.ok || metaData.error) {
        return res.status(400).json({
          success: false,
          error: metaData.error?.message || 'Meta API báo lỗi kết nối',
          details: metaData
        });
      }

      return res.json({
        success: true,
        message: 'Kết nối Meta Pixel & CAPI thành công mỹ mãn!',
        events_received: metaData.events_received || 1,
        details: metaData
      });
    }

    // Nếu dùng cấu hình đã lưu
    const result = await sendMetaConversionEvent(testParams);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Gửi sự kiện test thất bại',
        details: result.response
      });
    }

    res.json({
      success: true,
      message: 'Đã gửi sự kiện Lead thử nghiệm thành công lên Meta Events Manager!',
      event_id: result.event_id,
      details: result.response
    });
  } catch (error: any) {
    console.error('[Meta CAPI Test Connection] Lỗi:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi gửi sự kiện test'
    });
  }
});

export default router;
