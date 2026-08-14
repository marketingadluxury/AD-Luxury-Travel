import express from 'express';
import { 
  handleIncomingMessage, 
  handleIncomingLeadgen,
  sendReplyMessage, 
  getFacebookPages, 
  IncomingMessengerMessage,
  extractVietnamesePhone,
  saveLeadToDatabase,
  LeadRecord
} from '../services/metaMessengerService.js';
import { getAdminSupabaseClient } from '../services/supabaseService.js';

const router = express.Router();

const DEFAULT_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'TOUR_CRM_META_VERIFY_TOKEN_2026';

/**
 * 1. Webhook Verification (GET) cho Meta Messenger & Lead Ads Platform
 */
router.get(['/api/meta-messenger/webhook', '/api/meta/webhook'], (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && (token === DEFAULT_VERIFY_TOKEN || token === process.env.META_WEBHOOK_VERIFY_TOKEN)) {
      console.log('[Meta Webhook] Xác thực Webhook thành công! Challenge:', challenge);
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(String(challenge || ''));
    } else {
      console.warn('[Meta Webhook] Xác thực thất bại: Sai Verify Token:', token);
      return res.sendStatus(403);
    }
  }

  res.status(200).json({
    status: 'online',
    message: 'Meta Webhook Endpoint sẵn sàng. Sử dụng GET để verify và POST để nhận tin nhắn / lead forms.',
    verify_token_default: DEFAULT_VERIFY_TOKEN
  });
});

/**
 * 2. Webhook Event Handler (POST) nhận tin nhắn & biểu mẫu khách hàng tiềm năng thời gian thực từ Meta
 */
router.post(['/api/meta-messenger/webhook', '/api/meta/webhook'], async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    // Luôn phản hồi 200 OK ngay lập tức cho Meta
    res.status(200).send('EVENT_RECEIVED');

    try {
      for (const entry of body.entry || []) {
        const pageId = entry.id;

        // A. Xử lý Biểu mẫu khách hàng tiềm năng (Meta Lead Ads / Instant Forms)
        const changesList = entry.changes || [];
        for (const change of changesList) {
          if (change.field === 'leadgen' && change.value) {
            const val = change.value;
            await handleIncomingLeadgen({
              pageId: val.page_id || pageId,
              leadgenId: val.leadgen_id,
              formId: val.form_id,
              adId: val.ad_id,
              createdTime: val.created_time
            });
          }
        }

        // B. Xử lý Tin nhắn Messenger thời gian thực
        const messagingList = entry.messaging || [];
        for (const msgEvent of messagingList) {
          const senderId = msgEvent.sender?.id;
          const recipientId = msgEvent.recipient?.id || pageId;
          const timestamp = msgEvent.timestamp || Date.now();

          // Trường hợp tin nhắn văn bản thông thường hoặc đính kèm
          if (msgEvent.message) {
            const incoming: IncomingMessengerMessage = {
              senderId,
              recipientId,
              timestamp,
              messageId: msgEvent.message.mid,
              text: msgEvent.message.text,
              attachments: msgEvent.message.attachments,
              referral: msgEvent.referral || msgEvent.message.referral
            };

            await handleIncomingMessage(incoming);
          } 
          // Trường hợp bấm nút Postback kèm Referral (Quảng cáo Click-to-Messenger)
          else if (msgEvent.postback) {
            const incoming: IncomingMessengerMessage = {
              senderId,
              recipientId,
              timestamp,
              text: msgEvent.postback.title || msgEvent.postback.payload,
              referral: msgEvent.postback.referral || msgEvent.referral
            };

            await handleIncomingMessage(incoming);
          }
          // Trường hợp leadgen gửi qua messaging
          else if (msgEvent.leadgen) {
            await handleIncomingLeadgen({
              pageId: recipientId,
              leadgenId: msgEvent.leadgen.leadgen_id || msgEvent.leadgen.id,
              formId: msgEvent.leadgen.form_id,
              adId: msgEvent.leadgen.ad_id,
              createdTime: timestamp ? Math.floor(timestamp / 1000) : undefined
            });
          }
        }
      }
    } catch (error: any) {
      console.error('[Meta Webhook Event] Lỗi khi xử lý sự kiện Webhook:', error);
    }
  } else {
    res.sendStatus(404);
  }
});

/**
 * 3. Lấy danh sách Fanpage đã kết nối
 */
router.get('/api/meta-messenger/pages', async (req, res) => {
  try {
    const pages = await getFacebookPages();
    res.json({
      success: true,
      data: pages
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 4. Thêm hoặc cập nhật Fanpage
 */
router.post('/api/meta-messenger/pages', async (req, res) => {
  try {
    const { page_id, name, access_token, avatar_url } = req.body;
    if (!page_id || !name || !access_token) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp đầy đủ: page_id, name và access_token'
      });
    }

    const supabase = getAdminSupabaseClient();
    const payload = {
      page_id: String(page_id).trim(),
      name: String(name).trim(),
      access_token: String(access_token).trim(),
      avatar_url: avatar_url || null,
      is_active: true,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('facebook_pages')
      .upsert(payload, { onConflict: 'page_id' })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Lưu Fanpage thành công!',
      data
    });
  } catch (error: any) {
    console.error('[Meta Messenger] Lỗi lưu page:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 5. Xóa Fanpage khỏi hệ thống
 */
router.delete('/api/meta-messenger/pages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase
      .from('facebook_pages')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: 'Đã xóa Fanpage!' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 6. Lấy danh sách hội thoại khách hàng (Inbox)
 */
router.get('/api/meta-messenger/conversations', async (req, res) => {
  try {
    const { page_id, search, status } = req.query;
    const supabase = getAdminSupabaseClient();

    let query = supabase
      .from('meta_chat_conversations')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (page_id) {
      query = query.eq('page_id', page_id);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,last_message.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 7. Lấy danh sách tin nhắn của 1 cuộc hội thoại
 */
router.get('/api/meta-messenger/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabaseClient();

    // Đánh dấu đã đọc
    await supabase
      .from('meta_chat_conversations')
      .update({ unread_count: 0 })
      .eq('id', id);

    const { data, error } = await supabase
      .from('meta_chat_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 8. Trả lời tin nhắn cho khách hàng
 */
router.post('/api/meta-messenger/conversations/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, staff_name } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Nội dung tin nhắn không được để trống' });
    }

    const result = await sendReplyMessage(id, message.trim(), staff_name || 'Tư vấn viên AD Luxury');
    res.json(result);
  } catch (error: any) {
    console.error('[Meta Messenger Reply] Lỗi:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 9. Cập nhật thông tin khách hàng (SĐT, Email, Trạng thái Lead, Người phụ trách)
 */
router.put('/api/meta-messenger/conversations/:id/contact', async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, customer_phone, customer_email, status, assigned_to, ad_id, utm_campaign } = req.body;

    const supabase = getAdminSupabaseClient();
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (customer_name !== undefined) updatePayload.customer_name = customer_name;
    if (customer_phone !== undefined) updatePayload.customer_phone = customer_phone;
    if (customer_email !== undefined) updatePayload.customer_email = customer_email;
    if (status !== undefined) updatePayload.status = status;
    if (assigned_to !== undefined) updatePayload.assigned_to = assigned_to;
    if (ad_id !== undefined) updatePayload.ad_id = ad_id;
    if (utm_campaign !== undefined) updatePayload.utm_campaign = utm_campaign;

    const { data, error } = await supabase
      .from('meta_chat_conversations')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Cập nhật thông tin liên hệ thành công!',
      data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 10. Giả lập tin nhắn hoặc Form Lead đến (Simulation Tool)
 */
router.post('/api/meta-messenger/simulate-incoming', async (req, res) => {
  try {
    const { 
      type = 'message', // 'message' | 'lead_form'
      page_id = 'PAGE_ADLUXURY_DEMO', 
      psid = `user_${Math.floor(100000 + Math.random() * 900000)}`,
      customer_name = 'Nguyễn Thị Thu Trang', 
      customer_phone = '0988123456',
      customer_email = 'thutrang.nguyen@gmail.com',
      message_text = 'Chào công ty, mình muốn tư vấn Tour Nhật Bản mùa thu cho 4 người lớn 0988123456',
      ad_id = 'ad_autumn_japan_2026',
      utm_campaign = 'TourNhatBan_Thu2026',
      form_id = 'form_lead_autumn_2026'
    } = req.body;

    if (type === 'lead_form') {
      const leadRecord: LeadRecord = {
        customer_name,
        customer_phone,
        customer_email,
        source_channel: 'meta_lead_form',
        page_id,
        ad_id,
        form_id,
        leadgen_id: `leadgen_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        utm_source: 'facebook_lead_ad',
        utm_campaign,
        message_text: `Đăng ký tư vấn qua biểu mẫu Facebook: ${message_text}`,
        status: 'lead_captured',
        notes: `Simulated Lead Form: ${form_id}`
      };

      const result = await saveLeadToDatabase(leadRecord);
      return res.json({
        success: true,
        message: 'Đã giả lập gửi Form Lead thành công!',
        data: result
      });
    }

    const incoming: IncomingMessengerMessage = {
      senderId: psid,
      recipientId: page_id,
      timestamp: Date.now(),
      text: message_text,
      referral: {
        ad_id: ad_id,
        source: 'ADS',
        ref: utm_campaign
      }
    };

    const result = await handleIncomingMessage(incoming);

    if (customer_name && result.conversationId) {
      const supabase = getAdminSupabaseClient();
      await supabase
        .from('meta_chat_conversations')
        .update({
          customer_name: customer_name,
          customer_phone: customer_phone || extractVietnamesePhone(message_text),
          customer_email: customer_email || null
        })
        .eq('id', result.conversationId);
    }

    res.json({
      success: true,
      message: 'Đã giả lập gửi tin nhắn thành công!',
      conversationId: result.conversationId
    });
  } catch (error: any) {
    console.error('[Simulate Incoming] Lỗi:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 11. Lấy danh sách Khách hàng tiềm năng (Ưu tiên lấy trực tiếp từ bảng `leads` trong Supabase)
 */
router.get(['/api/meta-leads', '/api/leads'], async (req, res) => {
  try {
    const { search, status, has_phone, channel } = req.query;
    const supabase = getAdminSupabaseClient();

    // 1. Thử truy vấn từ bảng `leads`
    try {
      let query = supabase
        .from('leads')
        .select('*, profiles:assigned_to(full_name)')
        .order('created_at', { ascending: false });

      if (has_phone === 'true') {
        query = query.not('customer_phone', 'is', null).neq('customer_phone', '');
      }

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      if (channel && channel !== 'all') {
        query = query.eq('source_channel', channel);
      }

      if (search) {
        query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,customer_email.ilike.%${search}%,utm_campaign.ilike.%${search}%,notes.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        const leads = data.map((item: any) => ({
          ...item,
          assigned_name: item.profiles?.full_name || null
        }));
        return res.json({ success: true, data: leads });
      }
    } catch (leadsTableErr: any) {
      console.warn('[Leads API] Không thể truy vấn bảng leads, chuyển sang meta_chat_conversations:', leadsTableErr.message);
    }

    // 2. Dự phòng: Truy vấn từ `meta_chat_conversations` nếu bảng `leads` chưa có dữ liệu
    let fallbackQuery = supabase
      .from('meta_chat_conversations')
      .select('*, profiles:assigned_to(full_name)')
      .order('updated_at', { ascending: false });

    if (has_phone === 'true') {
      fallbackQuery = fallbackQuery.not('customer_phone', 'is', null).neq('customer_phone', '');
    }

    if (status && status !== 'all') {
      fallbackQuery = fallbackQuery.eq('status', status);
    }

    if (search) {
      fallbackQuery = fallbackQuery.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,customer_email.ilike.%${search}%,utm_campaign.ilike.%${search}%`);
    }

    const { data: convData, error: convErr } = await fallbackQuery;
    if (convErr) throw convErr;

    const fallbackLeads = (convData || []).map((item: any) => ({
      ...item,
      source_channel: item.utm_source || 'facebook_messenger',
      message_text: item.last_message,
      assigned_name: item.profiles?.full_name || null
    }));

    res.json({
      success: true,
      data: fallbackLeads
    });
  } catch (error: any) {
    console.error('[Meta Leads] Lỗi lấy danh sách leads:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 12. Tạo Lead thủ công (POST /api/leads)
 */
router.post(['/api/meta-leads', '/api/leads'], async (req, res) => {
  try {
    const leadData: LeadRecord = req.body;
    if (!leadData.customer_name) {
      return res.status(400).json({ success: false, error: 'Tên khách hàng không được để trống' });
    }

    const result = await saveLeadToDatabase(leadData);
    res.json({
      success: true,
      message: 'Tạo khách hàng tiềm năng thành công!',
      data: result
    });
  } catch (error: any) {
    console.error('[Create Lead] Lỗi:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 13. Cập nhật Lead (Trạng thái, ghi chú, SĐT, Người phụ trách)
 */
router.put(['/api/meta-leads/:id', '/api/leads/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, customer_phone, customer_email, status, notes, assigned_to, tour_interest } = req.body;
    const supabase = getAdminSupabaseClient();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (customer_name !== undefined) updatePayload.customer_name = customer_name;
    if (customer_phone !== undefined) updatePayload.customer_phone = customer_phone;
    if (customer_email !== undefined) updatePayload.customer_email = customer_email;
    if (status !== undefined) updatePayload.status = status;
    if (notes !== undefined) updatePayload.notes = notes;
    if (tour_interest !== undefined) updatePayload.tour_interest = tour_interest;
    if (assigned_to !== undefined) updatePayload.assigned_to = assigned_to || null;

    // Cập nhật bảng `leads`
    let updatedLead: any = null;
    try {
      const { data } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .maybeSingle();
      updatedLead = data;
    } catch (e) {}

    // Đồng bộ sang `meta_chat_conversations` nếu có
    try {
      await supabase
        .from('meta_chat_conversations')
        .update(updatePayload)
        .eq('id', id);
    } catch (e) {}

    res.json({
      success: true,
      message: 'Cập nhật thông tin khách hàng tiềm năng thành công!',
      data: updatedLead
    });
  } catch (error: any) {
    console.error('[Meta Leads] Lỗi cập nhật lead:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 14. Xóa Lead
 */
router.delete(['/api/meta-leads/:id', '/api/leads/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabaseClient();

    try {
      await supabase.from('leads').delete().eq('id', id);
    } catch (e) {}

    try {
      await supabase.from('meta_chat_conversations').delete().eq('id', id);
    } catch (e) {}

    res.json({
      success: true,
      message: 'Đã xóa khách hàng tiềm năng!'
    });
  } catch (error: any) {
    console.error('[Meta Leads] Lỗi xóa lead:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
