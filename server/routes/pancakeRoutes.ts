import express from 'express';
import { 
  getPancakeConfig, 
  savePancakeConfig, 
  testPancakeConnection, 
  syncPancakeConversations,
  handleIncomingPancakeWebhook
} from '../services/pancakeService.js';

const router = express.Router();

/**
 * Endpoint xác thực Webhook Pancake (GET)
 */
router.get('/api/pancake/webhook', (req, res) => {
  const challenge = req.query['hub.challenge'] || req.query['challenge'] || 'ok';
  res.status(200).send(challenge);
});

/**
 * Endpoint nhận dữ liệu Webhook Realtime từ Pancake (POST)
 */
router.post('/api/pancake/webhook', async (req, res) => {
  try {
    const payload = req.body;
    console.log('[Pancake Webhook] Nhận dữ liệu sự kiện:', payload?.type || payload?.event || 'unknown');
    const result = await handleIncomingPancakeWebhook(payload);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('[Pancake Webhook] Lỗi:', error.message);
    res.status(200).json({ success: false, error: error.message });
  }
});

/**
 * Lấy cấu hình Pancake API
 */
router.get('/api/pancake/config', async (req, res) => {
  try {
    const config = await getPancakeConfig();
    const maskedKey = config.api_key 
      ? (config.api_key.length > 16 
          ? `${config.api_key.substring(0, 8)}...${config.api_key.substring(config.api_key.length - 6)}`
          : '******')
      : '';

    res.json({
      success: true,
      data: {
        api_key_masked: maskedKey,
        has_api_key: Boolean(config.api_key),
        is_active: config.is_active,
        auto_sync: config.auto_sync,
        last_synced_at: config.last_synced_at
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Cập nhật cấu hình Pancake API
 */
router.post('/api/pancake/config', async (req, res) => {
  try {
    const { api_key, is_active, auto_sync } = req.body;
    let finalKey = api_key;
    if (!finalKey || finalKey.includes('...')) {
      const current = await getPancakeConfig();
      finalKey = current.api_key;
    }

    const result = await savePancakeConfig({
      api_key: finalKey,
      is_active: is_active !== false,
      auto_sync: auto_sync !== false
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Kiểm tra kết nối với Pancake Public API
 */
router.post('/api/pancake/test-connection', async (req, res) => {
  try {
    let { api_key } = req.body;
    if (!api_key || api_key.includes('...')) {
      const current = await getPancakeConfig();
      api_key = current.api_key;
    }
    const result = await testPancakeConnection(api_key);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Thực hiện đồng bộ hội thoại & khách hàng có SĐT từ Pancake về CRM
 */
router.post('/api/pancake/sync', async (req, res) => {
  try {
    const result = await syncPancakeConversations();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
