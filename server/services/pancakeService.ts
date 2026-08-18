import { getAdminSupabaseClient } from './supabaseService.js';
import { extractVietnamesePhone, extractEmail, saveLeadToDatabase, LeadRecord } from './metaMessengerService.js';
import { sendMetaConversionEvent, getMetaCapiConfig } from './metaCapiService.js';

export interface PancakeConfig {
  api_key?: string;
  is_active?: boolean;
  auto_sync?: boolean;
  last_synced_at?: string;
}

/**
 * Lấy cấu hình Pancake Public API từ database
 */
export async function getPancakeConfig(): Promise<PancakeConfig> {
  const supabase = getAdminSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('system_integrations')
      .select('config, is_active, updated_at')
      .eq('integration_type', 'pancake')
      .maybeSingle();

    if (error || !data) {
      // Fallback: check environment variable
      return {
        api_key: process.env.PANCAKE_PUBLIC_API_TOKEN || '',
        is_active: Boolean(process.env.PANCAKE_PUBLIC_API_TOKEN),
        auto_sync: true
      };
    }

    return {
      api_key: data.config?.api_key || '',
      is_active: data.is_active !== false,
      auto_sync: data.config?.auto_sync !== false,
      last_synced_at: data.updated_at
    };
  } catch (err: any) {
    console.warn('[Pancake Service] Lỗi khi lấy config:', err.message);
    return {
      api_key: process.env.PANCAKE_PUBLIC_API_TOKEN || '',
      is_active: false
    };
  }
}

/**
 * Lưu cấu hình Pancake Public API
 */
export async function savePancakeConfig(config: PancakeConfig): Promise<{ success: boolean; error?: string }> {
  const supabase = getAdminSupabaseClient();
  const now = new Date().toISOString();
  try {
    const { data: existing } = await supabase
      .from('system_integrations')
      .select('id')
      .eq('integration_type', 'pancake')
      .maybeSingle();

    const payload = {
      integration_type: 'pancake',
      config: {
        api_key: config.api_key ? config.api_key.trim() : '',
        auto_sync: config.auto_sync !== false
      },
      is_active: config.is_active !== false,
      updated_at: now
    };

    if (existing) {
      const { error } = await supabase
        .from('system_integrations')
        .update(payload)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('system_integrations')
        .insert([payload]);
      if (error) throw error;
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Pancake Service] Lỗi khi lưu config:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Hàm helper phân tích JWT Token (nếu token là JWT)
 */
function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.trim().split('.');
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = Buffer.from(payloadBase64, 'base64').toString('utf8');
      return JSON.parse(jsonStr);
    }
  } catch (e) {
    // Không phải JWT token hợp lệ
  }
  return null;
}

/**
 * Hàm helper gọi API Pancake lấy danh sách Pages/Shops an toàn
 */
async function fetchPagesFromPancake(token: string): Promise<any[]> {
  const cleanToken = token.trim();
  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'TourCRM/1.0 (AD Luxury Travel)'
  };

  // 1. Kiểm tra nếu Token là dạng JWT (Page Access Token hoặc User Token mã hóa)
  const jwtPayload = decodeJwtPayload(cleanToken);
  if (jwtPayload) {
    const pageId = jwtPayload.page_id || jwtPayload.pageId || jwtPayload.id;
    const pageName = jwtPayload.page_name || jwtPayload.name || 'Fanpage Pancake';
    
    if (pageId) {
      try {
        const testUrl = `https://pages.fm/api/public_api/v1/pages/${pageId}/conversations?page_access_token=${encodeURIComponent(cleanToken)}&page_size=1`;
        const testRes = await fetch(testUrl, { headers });
        if (testRes.ok) {
          return [{
            id: String(pageId),
            name: pageName,
            page_access_token: cleanToken
          }];
        }
      } catch (e) {
        // Silent fallback
      }
    }
  }

  // 2. Thử endpoint v1 chuẩn của Pancake (User Access Token)
  const url1 = `https://pages.fm/api/v1/pages?access_token=${encodeURIComponent(cleanToken)}`;
  try {
    const res1 = await fetch(url1, { method: 'GET', headers });
    if (res1.ok) {
      const data1 = await res1.json() as any;
      const pages = data1.pages || data1.data || (Array.isArray(data1) ? data1 : []);
      if (pages && pages.length > 0) return pages;
    }
  } catch (e) {
    // Silent fallback
  }

  // 3. Thử endpoint public_api v1
  const url2 = `https://pages.fm/api/public_api/v1/pages?access_token=${encodeURIComponent(cleanToken)}`;
  try {
    const res2 = await fetch(url2, { method: 'GET', headers });
    if (res2.ok) {
      const data2 = await res2.json() as any;
      const pages = data2.pages || data2.data || (Array.isArray(data2) ? data2 : []);
      if (pages && pages.length > 0) return pages;
    }
  } catch (e) {
    // Silent fallback
  }

  // 4. Thử với Header Authorization: Bearer
  try {
    const res3 = await fetch('https://pages.fm/api/v1/pages', {
      method: 'GET',
      headers: {
        ...headers,
        'Authorization': `Bearer ${cleanToken}`
      }
    });
    if (res3.ok) {
      const data3 = await res3.json() as any;
      const pages = data3.pages || data3.data || (Array.isArray(data3) ? data3 : []);
      if (pages && pages.length > 0) return pages;
    }
  } catch (e) {
    // Silent fallback
  }

  // 5. Thử endpoint POS Cake (Shops)
  try {
    const posUrl = `https://pos.pages.fm/api/v1/shops?api_key=${encodeURIComponent(cleanToken)}`;
    const posRes = await fetch(posUrl, { method: 'GET', headers });
    if (posRes.ok) {
      const posData = await posRes.json() as any;
      const shops = posData.shops || posData.data || (Array.isArray(posData) ? posData : []);
      if (shops && shops.length > 0) {
        return shops.map((s: any) => ({
          id: String(s.id || s.shop_id),
          name: s.name || 'Cửa hàng POS Cake',
          is_pos: true,
          page_access_token: cleanToken
        }));
      }
    }
  } catch (e) {
    // Silent fallback
  }

  // 6. Kiểm tra nếu trong database đã có Fanpage sẵn từ Meta để test với Page Token này
  try {
    const supabase = getAdminSupabaseClient();
    const { data: dbPages } = await supabase.from('facebook_pages').select('page_id, page_name').limit(5);
    if (dbPages && dbPages.length > 0) {
      for (const p of dbPages) {
        const testConvUrl = `https://pages.fm/api/public_api/v1/pages/${p.page_id}/conversations?page_access_token=${encodeURIComponent(cleanToken)}&page_size=1`;
        const testConvRes = await fetch(testConvUrl, { headers });
        if (testConvRes.ok) {
          return [{
            id: p.page_id,
            name: p.page_name || 'Fanpage AD Luxury',
            page_access_token: cleanToken
          }];
        }
      }
    }
  } catch (e) {
    // ignore
  }

  // Nếu tất cả các cách trên không trả về dữ liệu thành công, gọi lại url1 để lấy thông điệp lỗi chính xác từ Pancake
  const finalRes = await fetch(url1, { method: 'GET', headers });
  if (!finalRes.ok) {
    const errText = await finalRes.text();
    let parsedMessage = errText;
    try {
      const jsonErr = JSON.parse(errText);
      parsedMessage = jsonErr.message || jsonErr.error || errText;
    } catch (e) {}
    throw new Error(`Pancake API phản hồi (${finalRes.status}): ${parsedMessage || 'Token không hợp lệ. Vui lòng lấy User Access Token tại Cài đặt cá nhân trên pages.fm'}`);
  }

  const finalData = await finalRes.json() as any;
  return finalData.pages || finalData.data || (Array.isArray(finalData) ? finalData : []);
}

/**
 * Kiểm tra kết nối với Pancake Public API bằng Token
 */
export async function testPancakeConnection(apiKey?: string): Promise<{
  success: boolean;
  pages?: Array<{ id: string; name: string; username?: string; avatar?: string }>;
  error?: string;
}> {
  const token = apiKey || (await getPancakeConfig()).api_key;
  if (!token || !token.trim()) {
    return { success: false, error: 'Chưa cung cấp Pancake Public API Access Token' };
  }

  try {
    const rawPages = await fetchPagesFromPancake(token);
    const pages = rawPages.map((p: any) => ({
      id: String(p.id || p.page_id),
      name: p.name || p.page_name || 'Fanpage',
      username: p.username || '',
      avatar: p.avatar_url || p.picture?.data?.url || null
    }));

    return {
      success: true,
      pages
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Lỗi kết nối tới Pancake: ${err.message}`
    };
  }
}

/**
 * Hàm helper lấy Page Access Token cho một Page cụ thể từ User Access Token
 */
async function resolvePageAccessToken(pageId: string, pageObj: any, userToken: string, headers: any): Promise<string> {
  // 1. Nếu trong pageObj đã có sẵn token
  if (pageObj?.page_access_token) return pageObj.page_access_token;
  if (pageObj?.settings?.page_access_token) return pageObj.settings.page_access_token;
  if (pageObj?.access_token && pageObj.access_token !== userToken) return pageObj.access_token;

  // 2. Thử gọi API sinh/lấy page_access_token bằng User Token
  try {
    const genUrl = `https://pages.fm/api/v1/pages/${pageId}/generate_page_access_token?access_token=${encodeURIComponent(userToken)}`;
    const res = await fetch(genUrl, { method: 'POST', headers });
    if (res.ok) {
      const data = await res.json() as any;
      const tok = data.page_access_token || data.access_token || data.token || data.data?.page_access_token;
      if (tok) return tok;
    }
  } catch (e) {}

  try {
    const genUrl2 = `https://pages.fm/api/public_api/v1/pages/${pageId}/generate_page_access_token?access_token=${encodeURIComponent(userToken)}`;
    const res2 = await fetch(genUrl2, { method: 'POST', headers });
    if (res2.ok) {
      const data2 = await res2.json() as any;
      const tok2 = data2.page_access_token || data2.access_token || data2.token;
      if (tok2) return tok2;
    }
  } catch (e) {}

  // 3. Thử lấy thông tin chi tiết Page
  try {
    const pUrl = `https://pages.fm/api/v1/pages/${pageId}?access_token=${encodeURIComponent(userToken)}`;
    const pRes = await fetch(pUrl, { method: 'GET', headers });
    if (pRes.ok) {
      const pData = await pRes.json() as any;
      const tok3 = pData.page_access_token || pData.settings?.page_access_token || pData.page?.page_access_token || pData.access_token;
      if (tok3) return tok3;
    }
  } catch (e) {}

  return userToken;
}

/**
 * Hàm helper lấy chi tiết tin nhắn và SĐT trong một cuộc hội thoại từ Pancake
 */
async function fetchConversationDetailsAndMessages(
  pageId: string, 
  convId: string, 
  customerId: string | undefined,
  pageToken: string, 
  userToken: string, 
  headers: any
): Promise<{
  lastCustomerMessage: string;
  phone: string | null;
  email: string | null;
}> {
  let lastCustomerMessage = '';
  let phone: string | null = null;
  let email: string | null = null;

  // 1. Thử lấy tin nhắn trong hội thoại
  const msgEndpoints = [
    `https://pages.fm/api/public_api/v1/pages/${pageId}/conversations/${convId}/messages?page_access_token=${encodeURIComponent(pageToken)}&page_size=30`,
    `https://pages.fm/api/public_api/v2/pages/${pageId}/conversations/${convId}/messages?page_access_token=${encodeURIComponent(pageToken)}&page_size=30`,
    `https://pages.fm/api/v1/pages/${pageId}/conversations/${convId}/messages?page_access_token=${encodeURIComponent(pageToken)}&page_size=30`,
    `https://pages.fm/api/v1/pages/${pageId}/conversations/${convId}/messages?access_token=${encodeURIComponent(userToken)}&page_size=30`,
  ];

  for (const endpoint of msgEndpoints) {
    try {
      const res = await fetch(endpoint, { headers });
      if (res.ok) {
        const data = await res.json() as any;
        const msgList = data.messages || data.data || (Array.isArray(data) ? data : []);
        if (Array.isArray(msgList) && msgList.length > 0) {
          // Duyệt từ tin mới nhất đến cũ nhất
          for (const msg of msgList) {
            const txt = String(msg.message || msg.text || msg.content || msg.snippet || '');
            if (!txt) continue;

            if (!lastCustomerMessage) {
              lastCustomerMessage = txt;
            }

            if (!phone) {
              const p = extractVietnamesePhone(txt);
              if (p) phone = p;
            }

            if (!email) {
              const em = extractEmail(txt);
              if (em) email = em;
            }

            // Kiểm tra các trường phụ trong tin nhắn
            if (!phone && msg.phone_number) {
              phone = extractVietnamesePhone(String(msg.phone_number));
            }
          }
          break; // Đã lấy được danh sách tin nhắn
        }
      }
    } catch (e) {}
  }

  // 2. Nếu vẫn chưa có SĐT và có customerId -> Thử tra cứu hồ sơ khách hàng trên Pancake
  if (!phone && customerId) {
    const custEndpoints = [
      `https://pages.fm/api/public_api/v1/pages/${pageId}/customers/${customerId}?page_access_token=${encodeURIComponent(pageToken)}`,
      `https://pages.fm/api/v1/pages/${pageId}/customers/${customerId}?page_access_token=${encodeURIComponent(pageToken)}`,
      `https://pages.fm/api/v1/pages/${pageId}/customers/${customerId}?access_token=${encodeURIComponent(userToken)}`,
    ];

    for (const custUrl of custEndpoints) {
      try {
        const cRes = await fetch(custUrl, { headers });
        if (cRes.ok) {
          const cData = await cRes.json() as any;
          const cust = cData.customer || cData.data || cData;
          if (cust) {
            const rawP = cust.phone || cust.mobile || cust.phone_number || (Array.isArray(cust.phone_numbers) ? cust.phone_numbers[0] : '');
            if (rawP) {
              const p = extractVietnamesePhone(String(rawP)) || String(rawP);
              if (p) phone = p;
            }
            if (!email && cust.email) {
              email = cust.email;
            }
            break;
          }
        }
      } catch (e) {}
    }
  }

  return { lastCustomerMessage, phone, email };
}

/**
 * Đồng bộ hội thoại và Lead (SĐT) từ Pancake về Tour CRM
 */
export async function syncPancakeConversations(): Promise<{
  success: boolean;
  leads_synced: number;
  conversations_checked: number;
  phones_found: number;
  error?: string;
}> {
  const config = await getPancakeConfig();
  if (!config.api_key || !config.is_active) {
    return { success: false, leads_synced: 0, conversations_checked: 0, phones_found: 0, error: 'Pancake chưa được cấu hình hoặc đang tắt' };
  }

  const token = config.api_key.trim();
  let totalLeadsSynced = 0;
  let totalConversationsChecked = 0;
  let totalPhonesFound = 0;

  try {
    // 1. Lấy danh sách Fanpage từ Pancake
    const pagesList = await fetchPagesFromPancake(token);
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'TourCRM/1.0 (AD Luxury Travel)'
    };

    const supabase = getAdminSupabaseClient();

    // 2. Với mỗi Page, quét các cuộc hội thoại và danh sách khách hàng
    for (const page of pagesList) {
      const pageId = String(page.id || page.page_id);
      const pageName = page.name || page.page_name || 'Fanpage AD Luxury';
      
      // Tìm Token phù hợp nhất cho trang này
      const pageToken = await resolvePageAccessToken(pageId, page, token, headers);

      let allConversations: any[] = [];
      const seenConvIds = new Set<string>();

      // A. Thử các endpoint lấy hội thoại (Conversations)
      const convEndpoints = [
        `https://pages.fm/api/public_api/v2/pages/${pageId}/conversations?page_access_token=${encodeURIComponent(pageToken)}&page_size=100`,
        `https://pages.fm/api/public_api/v1/pages/${pageId}/conversations?page_access_token=${encodeURIComponent(pageToken)}&page_size=100`,
        `https://pages.fm/api/v1/pages/${pageId}/conversations?page_access_token=${encodeURIComponent(pageToken)}&page_size=100`,
        `https://pages.fm/api/v1/pages/${pageId}/conversations?access_token=${encodeURIComponent(token)}&page_size=100`,
        `https://pages.fm/api/public_api/v1/pages/${pageId}/conversations?access_token=${encodeURIComponent(token)}&page_size=100`,
      ];

      for (const endpoint of convEndpoints) {
        try {
          const res = await fetch(endpoint, { headers });
          if (res.ok) {
            const data = await res.json() as any;
            const list = data.conversations || data.data || (Array.isArray(data) ? data : []);
            if (Array.isArray(list) && list.length > 0) {
              for (const item of list) {
                const itemId = String(item.id || item._id || item.conversation_id || '');
                if (itemId && !seenConvIds.has(itemId)) {
                  seenConvIds.add(itemId);
                  allConversations.push(item);
                } else if (!itemId) {
                  allConversations.push(item);
                }
              }
              break; // Đã lấy thành công danh sách hội thoại từ endpoint này
            }
          }
        } catch (e) {}
      }

      // B. Thử thêm endpoint lấy khách hàng (Customers) từ Pancake
      const customerEndpoints = [
        `https://pages.fm/api/public_api/v1/pages/${pageId}/customers?page_access_token=${encodeURIComponent(pageToken)}&page_size=100`,
        `https://pages.fm/api/public_api/v2/pages/${pageId}/customers?page_access_token=${encodeURIComponent(pageToken)}&page_size=100`,
        `https://pages.fm/api/v1/pages/${pageId}/customers?access_token=${encodeURIComponent(token)}&page_size=100`,
        `https://pos.pages.fm/api/v1/shops/${pageId}/customers?api_key=${encodeURIComponent(token)}&page_size=100`,
      ];

      let customersList: any[] = [];
      for (const custEndpoint of customerEndpoints) {
        try {
          const res = await fetch(custEndpoint, { headers });
          if (res.ok) {
            const data = await res.json() as any;
            const list = data.customers || data.data || (Array.isArray(data) ? data : []);
            if (Array.isArray(list) && list.length > 0) {
              customersList = list;
              break;
            }
          }
        } catch (e) {}
      }

      totalConversationsChecked += allConversations.length + customersList.length;

      // 3. Xử lý danh sách hội thoại (Conversations)
      for (const conv of allConversations) {
        const convId = String(conv.id || conv._id || conv.conversation_id || '');
        const customer = conv.customer || (conv.customers && conv.customers[0]) || {};
        const customerName = customer.name || conv.customer_name || conv.name || 'Khách hàng Pancake';
        const psid = String(customer.id || customer.fb_id || conv.customer_id || conv.from?.id || conv.id || '');
        const avatar = customer.avatar_url || customer.avatar || conv.customer_avatar || null;

        // Trích xuất số điện thoại từ các thuộc tính trên object conversation
        let detectedPhone: string | null = null;
        if (conv.phone_numbers && Array.isArray(conv.phone_numbers) && conv.phone_numbers.length > 0) {
          detectedPhone = extractVietnamesePhone(String(conv.phone_numbers[0])) || String(conv.phone_numbers[0]);
        } else if (conv.phone_number) {
          detectedPhone = extractVietnamesePhone(String(conv.phone_number)) || String(conv.phone_number);
        } else if (conv.customer_phone) {
          detectedPhone = extractVietnamesePhone(String(conv.customer_phone)) || String(conv.customer_phone);
        } else if (customer.phone) {
          detectedPhone = extractVietnamesePhone(String(customer.phone)) || String(customer.phone);
        } else if (customer.mobile) {
          detectedPhone = extractVietnamesePhone(String(customer.mobile)) || String(customer.mobile);
        } else if (customer.phone_numbers && Array.isArray(customer.phone_numbers) && customer.phone_numbers.length > 0) {
          detectedPhone = extractVietnamesePhone(String(customer.phone_numbers[0])) || String(customer.phone_numbers[0]);
        }

        // Lấy nội dung tin nhắn gần nhất
        let lastMessage = conv.last_message?.message || conv.last_message?.text || conv.last_message_text || conv.snippet || conv.message || '';
        if (!detectedPhone && lastMessage) {
          detectedPhone = extractVietnamesePhone(lastMessage);
        }

        // Nếu có mảng tin nhắn sẵn trong conv
        if (!detectedPhone && Array.isArray(conv.messages)) {
          for (const msg of conv.messages) {
            const txt = msg.message || msg.text || msg.content || '';
            const p = extractVietnamesePhone(txt);
            if (p) {
              detectedPhone = p;
              break;
            }
          }
        }

        let detectedEmail = extractEmail(lastMessage) || customer.email || null;

        // BƯỚC NÂNG CẤP QUAN TRỌNG: Quét sâu vào API tin nhắn chi tiết nếu chưa có SĐT hoặc tin nhắn bị rỗng
        if (convId && (!detectedPhone || !lastMessage)) {
          const detailRes = await fetchConversationDetailsAndMessages(
            pageId, 
            convId, 
            customer.id || conv.customer_id, 
            pageToken, 
            token, 
            headers
          );

          if (!detectedPhone && detailRes.phone) {
            detectedPhone = detailRes.phone;
          }
          if (!lastMessage && detailRes.lastCustomerMessage) {
            lastMessage = detailRes.lastCustomerMessage;
          }
          if (!detectedEmail && detailRes.email) {
            detectedEmail = detailRes.email;
          }
        }

        if (detectedPhone) totalPhonesFound++;

        // Lưu vào bảng leads trong CRM
        const leadRecord: LeadRecord = {
          customer_name: customerName,
          customer_phone: detectedPhone || null,
          customer_email: detectedEmail || null,
          customer_avatar: avatar,
          source_channel: 'pancake_messenger',
          page_id: pageId,
          psid: psid || null,
          message_text: lastMessage || 'Khách hàng liên hệ qua Pancake Messenger',
          notes: `Đồng bộ từ Pancake (Fanpage: ${pageName})`,
          status: 'lead_captured',
          last_message_at: conv.updated_at || conv.last_message?.inserted_at || new Date().toISOString()
        };

        const saveRes = await saveLeadToDatabase(leadRecord);
        if (saveRes.success) {
          totalLeadsSynced++;

          // Lưu hoặc cập nhật vào meta_chat_conversations
          try {
            if (psid && pageId) {
              await supabase.from('meta_chat_conversations').upsert({
                page_id: pageId,
                psid: psid,
                customer_name: customerName,
                customer_avatar: avatar,
                customer_phone: detectedPhone,
                customer_email: detectedEmail,
                last_message_text: lastMessage || 'Đồng bộ từ Pancake',
                last_message_at: conv.updated_at || new Date().toISOString(),
                unread_count: 0,
                status: 'active'
              }, { onConflict: 'page_id,psid' });
            }
          } catch (e) {}

          // Nếu phát hiện có số điện thoại -> Bắn sự kiện Lead lên Meta CAPI
          if (detectedPhone) {
            try {
              await sendMetaConversionEvent({
                event_name: 'Lead',
                tracking_type: 'PHONE_LEAD',
                customer_name: customerName,
                customer_phone: detectedPhone,
                customer_email: detectedEmail || undefined,
                utm_source: 'pancake_messenger'
              });
            } catch (capiErr: any) {
              console.warn('[Pancake -> Meta CAPI] Lỗi bắn sự kiện CAPI:', capiErr.message);
            }
          }
        }
      }

      // 4. Xử lý danh sách khách hàng (Customers) từ Pancake
      for (const cust of customersList) {
        const custName = cust.name || cust.full_name || 'Khách hàng Pancake';
        const custPhone = extractVietnamesePhone(cust.phone || cust.mobile || cust.phone_number || (Array.isArray(cust.phone_numbers) ? cust.phone_numbers[0] : '')) || cust.phone || null;
        const custEmail = cust.email || null;
        const custPsid = String(cust.id || cust.fb_id || cust.psid || '');
        const custAvatar = cust.avatar_url || cust.avatar || null;

        if (custPhone) totalPhonesFound++;

        const leadRecord: LeadRecord = {
          customer_name: custName,
          customer_phone: custPhone,
          customer_email: custEmail,
          customer_avatar: custAvatar,
          source_channel: 'pancake_messenger',
          page_id: pageId,
          psid: custPsid || null,
          message_text: `Khách hàng từ danh sách Pancake (${pageName})`,
          notes: `Khách hàng từ Pancake Customer Directory (Fanpage: ${pageName})`,
          status: 'lead_captured',
          last_message_at: cust.updated_at || new Date().toISOString()
        };

        const saveRes = await saveLeadToDatabase(leadRecord);
        if (saveRes.success) {
          totalLeadsSynced++;

          if (custPhone) {
            try {
              await sendMetaConversionEvent({
                event_name: 'Lead',
                tracking_type: 'PHONE_LEAD',
                customer_name: custName,
                customer_phone: custPhone,
                customer_email: custEmail || undefined,
                utm_source: 'pancake_customer'
              });
            } catch (capiErr: any) {}
          }
        }
      }
    }

    return {
      success: true,
      leads_synced: totalLeadsSynced,
      conversations_checked: totalConversationsChecked,
      phones_found: totalPhonesFound
    };
  } catch (err: any) {
    console.error('[Pancake Sync] Lỗi khi đồng bộ:', err);
    return {
      success: false,
      leads_synced: totalLeadsSynced,
      conversations_checked: totalConversationsChecked,
      phones_found: totalPhonesFound,
      error: err.message
    };
  }
}

/**
 * Xử lý Webhook Realtime nhận tin nhắn & SĐT trực tiếp từ Pancake
 */
export async function handleIncomingPancakeWebhook(payload: any): Promise<{
  success: boolean;
  message?: string;
  lead?: any;
}> {
  if (!payload) return { success: false, message: 'Payload rỗng' };

  try {
    const supabase = getAdminSupabaseClient();
    
    // 1. Phân tích các dạng event của Pancake
    const eventType = payload.type || payload.event || payload.action || 'message:created';
    const pageId = String(payload.page_id || payload.pageId || payload.page?.id || '');
    const pageName = payload.page_name || payload.page?.name || 'Fanpage AD Luxury';

    // Trích xuất khách hàng
    const customer = payload.customer || payload.data?.customer || payload.conversation?.customer || {};
    const customerName = customer.name || customer.full_name || payload.customer_name || 'Khách hàng Pancake';
    const psid = String(customer.id || customer.fb_id || payload.psid || payload.from?.id || '');
    const avatar = customer.avatar_url || customer.avatar || null;

    // Trích xuất tin nhắn
    const msgObj = payload.message || payload.data?.message || payload.conversation?.last_message || {};
    const messageText = String(msgObj.message || msgObj.text || msgObj.content || payload.text || payload.message_text || '');

    // Trích xuất số điện thoại
    let detectedPhone: string | null = null;
    if (payload.phone_numbers && Array.isArray(payload.phone_numbers) && payload.phone_numbers.length > 0) {
      detectedPhone = extractVietnamesePhone(String(payload.phone_numbers[0])) || String(payload.phone_numbers[0]);
    } else if (customer.phone || customer.mobile || customer.phone_number) {
      const raw = customer.phone || customer.mobile || customer.phone_number;
      detectedPhone = extractVietnamesePhone(String(raw)) || String(raw);
    } else if (messageText) {
      detectedPhone = extractVietnamesePhone(messageText);
    }

    const detectedEmail = extractEmail(messageText) || customer.email || null;

    // Lưu vào database CRM
    const leadRecord: LeadRecord = {
      customer_name: customerName,
      customer_phone: detectedPhone || null,
      customer_email: detectedEmail || null,
      customer_avatar: avatar,
      source_channel: 'pancake_messenger',
      page_id: pageId || null,
      psid: psid || null,
      message_text: messageText || 'Tin nhắn Realtime từ Pancake',
      notes: `Nhận Realtime qua Pancake Webhook (${eventType})`,
      status: 'lead_captured',
      last_message_at: new Date().toISOString()
    };

    const saveRes = await saveLeadToDatabase(leadRecord);

    // Cập nhật hội thoại
    if (psid && pageId) {
      try {
        await supabase.from('meta_chat_conversations').upsert({
          page_id: pageId,
          psid: psid,
          customer_name: customerName,
          customer_avatar: avatar,
          customer_phone: detectedPhone,
          customer_email: detectedEmail,
          last_message_text: messageText || 'Tin nhắn mới từ Pancake',
          last_message_at: new Date().toISOString(),
          unread_count: 1,
          status: 'active'
        }, { onConflict: 'page_id,psid' });
      } catch (e) {}
    }

    // Bắn sự kiện Meta CAPI nếu có SĐT
    if (detectedPhone) {
      try {
        await sendMetaConversionEvent({
          event_name: 'Lead',
          tracking_type: 'PHONE_LEAD',
          customer_name: customerName,
          customer_phone: detectedPhone,
          customer_email: detectedEmail || undefined,
          utm_source: 'pancake_webhook'
        });
      } catch (capiErr) {}
    }

    return {
      success: true,
      message: 'Đã xử lý Webhook Pancake thành công',
      lead: leadRecord
    };
  } catch (err: any) {
    console.error('[Pancake Webhook] Lỗi xử lý webhook:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Worker chạy ngầm tự động đồng bộ Pancake định kỳ (mỗi 30s)
 */
let autoSyncInterval: any = null;

export function startPancakeAutoSyncWorker(intervalMs = 30000) {
  console.log('[Pancake Worker] Tính năng Polling ngầm Pancake đang tạm dừng theo yêu cầu.');
  return;
}
