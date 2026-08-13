import express from 'express';

const router = express.Router();

// Google Chat Webhook / Status API
router.get(['/google-chat/status', '/api/google-chat/status'], (req, res) => {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  res.json({
    active: !!webhookUrl,
    configured: !!webhookUrl
  });
});

router.post(['/google-chat/send', '/api/google-chat/send'], async (req, res) => {
  try {
    const { text, card, spaceUrl } = req.body;
    const targetWebhook = spaceUrl || process.env.GOOGLE_CHAT_WEBHOOK_URL;

    if (!targetWebhook) {
      res.status(400).json({ error: 'Chưa cấu hình Google Chat Webhook URL.' });
      return;
    }

    const payload: any = {};
    if (text) payload.text = text;
    if (card) payload.cardsV2 = Array.isArray(card) ? card : [card];

    const response = await fetch(targetWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(500).json({ error: `Gửi Google Chat tin nhắn thất bại: ${errText}` });
      return;
    }

    res.json({ success: true, message: 'Đã gửi thông báo thành công đến Google Chat' });
  } catch (error: any) {
    console.error('Lỗi API Google Chat send:', error);
    res.status(500).json({ error: error.message || 'Lỗi gửi tin nhắn đến Google Chat' });
  }
});

export default router;
