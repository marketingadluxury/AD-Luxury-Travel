import { MetaConversionLog, MetaTrackingType, MetaEventName } from '@/types';
import { safeFetchApi } from './utils';

export interface TriggerMetaEventParams {
  event_name: MetaEventName | string;
  tracking_type: MetaTrackingType;
  event_id?: string;
  order_id?: string | null;
  tour_id?: string | null;
  tour_code?: string | null;
  tour_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  meta_lead_id?: string | null;
  revenue_value?: number;
  currency?: string;
  pax_count?: number;
  test_event_code?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
}

/**
 * Gửi sự kiện chuyển đổi Meta CAPI từ phía Client (an toàn, không block UI)
 */
export async function triggerMetaCapiEvent(params: TriggerMetaEventParams): Promise<{
  success: boolean;
  event_id?: string;
  status?: string;
  error?: string;
}> {
  try {
    const payload = {
      event_name: params.event_name,
      tracking_type: params.tracking_type,
      event_id: params.event_id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined),
      order_id: params.order_id,
      tour_id: params.tour_id,
      tour_code: params.tour_code,
      tour_name: params.tour_name,
      customer_name: params.customer_name,
      customer_phone: params.customer_phone,
      customer_email: params.customer_email,
      meta_lead_id: params.meta_lead_id,
      revenue_value: params.revenue_value || 0,
      currency: params.currency || 'VND',
      pax_count: params.pax_count,
      test_event_code: params.test_event_code,
      utm_source: params.utm_source,
      utm_campaign: params.utm_campaign
    };

    const res = await safeFetchApi('/api/meta-capi/send-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    return res;
  } catch (err: any) {
    console.warn('[Client Meta CAPI] Không thể gửi sự kiện Meta CAPI:', err);
    return {
      success: false,
      error: err.message || 'Lỗi kết nối Meta CAPI'
    };
  }
}

/**
 * Lấy cấu hình Meta CAPI từ backend
 */
export async function fetchMetaCapiConfig(): Promise<any> {
  try {
    const res = await safeFetchApi('/api/meta-capi/config', { method: 'GET' });
    return res.data;
  } catch (err) {
    console.warn('[Client Meta CAPI] Lỗi khi lấy config:', err);
    return null;
  }
}

/**
 * Lưu cấu hình Meta CAPI
 */
export async function saveMetaCapiConfig(config: {
  pixel_id: string;
  access_token: string;
  test_event_code?: string;
  is_enabled: boolean;
}): Promise<any> {
  return await safeFetchApi('/api/meta-capi/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
}

/**
 * Lấy nhật ký sự kiện Meta Conversion Logs
 */
export async function fetchMetaConversionLogs(limit: number = 100, eventName?: string): Promise<MetaConversionLog[]> {
  try {
    const url = `/api/meta-capi/logs?limit=${limit}${eventName && eventName !== 'all' ? `&event_name=${eventName}` : ''}`;
    const res = await safeFetchApi(url, { method: 'GET' });
    return res.data || [];
  } catch (err) {
    console.warn('[Client Meta CAPI] Lỗi khi lấy logs:', err);
    return [];
  }
}

/**
 * Gửi sự kiện kiểm tra kết nối Test Event
 */
export async function testMetaConnection(params?: {
  pixel_id?: string;
  access_token?: string;
  test_event_code?: string;
}): Promise<any> {
  return await safeFetchApi('/api/meta-capi/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {})
  });
}

/**
 * Lấy danh sách khách hàng tiềm năng (Leads) từ Meta Messenger Webhook
 */
export async function fetchMetaLeads(params?: {
  search?: string;
  status?: string;
  hasPhoneOnly?: boolean;
}): Promise<any[]> {
  try {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status && params.status !== 'all') query.append('status', params.status);
    if (params?.hasPhoneOnly) query.append('has_phone', 'true');

    const res = await safeFetchApi(`/api/meta-leads?${query.toString()}`, { method: 'GET' });
    return res.data || [];
  } catch (err) {
    console.warn('[Client Meta CAPI] Lỗi khi lấy danh sách Leads:', err);
    return [];
  }
}

/**
 * Cập nhật thông tin Lead (trạng thái, ghi chú, gán người phụ trách)
 */
export async function updateMetaLead(leadId: string, data: {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  status?: string;
  notes?: string;
  assigned_to?: string;
}): Promise<any> {
  return await safeFetchApi(`/api/meta-leads/${leadId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

/**
 * Xóa Lead khỏi danh sách
 */
export async function deleteMetaLead(leadId: string): Promise<any> {
  return await safeFetchApi(`/api/meta-leads/${leadId}`, {
    method: 'DELETE'
  });
}

