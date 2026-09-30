import { getAdminSupabaseClient } from './supabaseService.js';

export interface WooCommerceConfig {
  id?: string;
  site_url: string;
  consumer_key: string;
  consumer_secret: string;
  is_active: boolean;
  auto_sync_on_save: boolean;
  auto_sync_on_booking: boolean;
  field_mappings: Record<string, string>;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_FIELD_MAPPINGS: Record<string, string> = {
  start_date: 'ngay_khoi_hanh',
  end_date: 'ngay_ve',
  duration: 'thoi_luong',
  price_child: 'gia_tre_em',
  price_infant: 'gia_em_be',
  single_room_surcharge: 'phu_thu_phong_don',
  price_visa_tour: 'phi_visa',
  airline: 'hang_hang_khong',
  hotel: 'khach_san',
  destination: 'diem_den',
  itinerary_pdf_url: 'link_lich_trinh',
  flight_out: 'chuyen_bay_di',
  flight_in: 'chuyen_bay_ve'
};

// Bộ nhớ đệm tạm thời (In-memory fallback nếu chưa tạo bảng trong Supabase)
let memoryConfig: WooCommerceConfig = {
  site_url: process.env.WOOCOMMERCE_SITE_URL || '',
  consumer_key: process.env.WOOCOMMERCE_CONSUMER_KEY || '',
  consumer_secret: process.env.WOOCOMMERCE_CONSUMER_SECRET || '',
  is_active: true,
  auto_sync_on_save: false,
  auto_sync_on_booking: false,
  field_mappings: DEFAULT_FIELD_MAPPINGS
};

/**
 * Lấy cấu hình kết nối WooCommerce
 */
export async function getWooCommerceConfig(): Promise<WooCommerceConfig> {
  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from('woocommerce_configs')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      memoryConfig = {
        id: data.id,
        site_url: data.site_url || '',
        consumer_key: data.consumer_key || '',
        consumer_secret: data.consumer_secret || '',
        is_active: data.is_active ?? true,
        auto_sync_on_save: data.auto_sync_on_save ?? false,
        auto_sync_on_booking: data.auto_sync_on_booking ?? false,
        field_mappings: data.field_mappings || DEFAULT_FIELD_MAPPINGS,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
      return memoryConfig;
    }
  } catch (err) {
    console.warn('[WooCommerce] Chưa đọc được từ bảng woocommerce_configs, sử dụng memory config:', err);
  }
  return memoryConfig;
}

/**
 * Lưu hoặc cập nhật cấu hình kết nối WooCommerce
 */
export async function saveWooCommerceConfig(newConfig: Partial<WooCommerceConfig>): Promise<WooCommerceConfig> {
  // Chuẩn hóa URL (bỏ dấu gạch chéo cuối nếu có)
  let cleanUrl = (newConfig.site_url || memoryConfig.site_url).trim();
  if (cleanUrl.endsWith('/')) {
    cleanUrl = cleanUrl.slice(0, -1);
  }

  const updated: WooCommerceConfig = {
    ...memoryConfig,
    ...newConfig,
    site_url: cleanUrl,
    field_mappings: {
      ...DEFAULT_FIELD_MAPPINGS,
      ...(newConfig.field_mappings || memoryConfig.field_mappings)
    },
    updated_at: new Date().toISOString()
  };

  memoryConfig = updated;

  try {
    const supabase = getAdminSupabaseClient();
    const { data: existing } = await supabase
      .from('woocommerce_configs')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from('woocommerce_configs')
        .update({
          site_url: updated.site_url,
          consumer_key: updated.consumer_key,
          consumer_secret: updated.consumer_secret,
          is_active: updated.is_active,
          auto_sync_on_save: updated.auto_sync_on_save,
          auto_sync_on_booking: updated.auto_sync_on_booking,
          field_mappings: updated.field_mappings,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('woocommerce_configs')
        .insert([{
          site_url: updated.site_url,
          consumer_key: updated.consumer_key,
          consumer_secret: updated.consumer_secret,
          is_active: updated.is_active,
          auto_sync_on_save: updated.auto_sync_on_save,
          auto_sync_on_booking: updated.auto_sync_on_booking,
          field_mappings: updated.field_mappings,
          updated_at: new Date().toISOString()
        }]);
    }
  } catch (err) {
    console.warn('[WooCommerce] Lưu DB thất bại, lưu tạm vào bộ nhớ:', err);
  }

  return updated;
}

/**
 * Hàm gọi API WooCommerce bằng native fetch
 */
async function callWooCommerceApi(
  config: WooCommerceConfig,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any,
  queryParams?: Record<string, string | number>
) {
  const baseUrl = config.site_url;
  if (!baseUrl) {
    throw new Error('Chưa cấu hình URL website WordPress.');
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const urlObj = new URL(`${baseUrl}/wp-json/wc/v3${cleanEndpoint}`);

  // Thêm auth qua query params để hỗ trợ cả server chặn Basic Auth
  urlObj.searchParams.set('consumer_key', config.consumer_key);
  urlObj.searchParams.set('consumer_secret', config.consumer_secret);

  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      urlObj.searchParams.set(k, String(v));
    }
  }

  const authHeader = 'Basic ' + Buffer.from(`${config.consumer_key}:${config.consumer_secret}`).toString('base64');

  const headers: Record<string, string> = {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    'User-Agent': 'TourCRM-WooCommerce-Sync/1.0'
  };

  const options: RequestInit = {
    method,
    headers
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(urlObj.toString(), options);
  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    const errorMsg = json?.message || `HTTP ${response.status}: ${response.statusText}`;
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.data = json;
    throw err;
  }

  return {
    status: response.status,
    headers: response.headers,
    data: json
  };
}

/**
 * Kiểm tra kết nối với WordPress WooCommerce
 */
export async function testWooCommerceConnection(customConfig?: Partial<WooCommerceConfig>) {
  const config = customConfig ? { ...memoryConfig, ...customConfig } : await getWooCommerceConfig();
  
  if (!config.site_url || !config.consumer_key || !config.consumer_secret) {
    return {
      success: false,
      message: 'Vui lòng điền đầy đủ Website URL, Consumer Key và Consumer Secret.'
    };
  }

  try {
    // Thử truy vấn 1 sản phẩm để kiểm tra quyền đọc
    const res = await callWooCommerceApi(config, '/products', 'GET', undefined, { per_page: 1 });
    
    // Thử lấy thông tin hệ thống WooCommerce (nếu có quyền)
    let wcVersion = 'Hoạt động';
    try {
      const sysRes = await callWooCommerceApi(config, '/system_status');
      if (sysRes.data?.environment?.version) {
        wcVersion = `WooCommerce v${sysRes.data.environment.version}`;
      }
    } catch {
      // Bỏ qua nếu endpoint system_status bị hạn chế
    }

    const totalStr = res.headers.get('x-wp-total') || '0';
    return {
      success: true,
      message: `Kết nối thành công tới ${config.site_url}! (${wcVersion})`,
      site_url: config.site_url,
      version: wcVersion,
      total_products: parseInt(totalStr, 10)
    };
  } catch (err: any) {
    let errorMsg = err.message || 'Lỗi không xác định khi kết nối tới WordPress';
    if (err.status === 401) {
      errorMsg = 'Xác thực thất bại: Consumer Key hoặc Consumer Secret không đúng, hoặc không có quyền Read/Write.';
    } else if (err.status === 404) {
      errorMsg = `Không tìm thấy WooCommerce REST API tại ${config.site_url}. Vui lòng kiểm tra lại URL và chắc chắn WooCommerce đã được kích hoạt.`;
    } else if (err.data?.message) {
      errorMsg = `Lỗi từ WordPress: ${err.data.message} (${err.data.code || err.status})`;
    } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      errorMsg = `Không thể kết nối tới tên miền ${config.site_url}. Vui lòng kiểm tra lại đường dẫn website.`;
    }
    return {
      success: false,
      message: errorMsg
    };
  }
}

/**
 * Xây dựng payload sản phẩm WooCommerce từ Tour
 */
function buildWooCommercePayload(tour: any, mappings: Record<string, string>) {
  const adultPrice = Number(tour.price_adult || tour.price || 0);
  const seats = Number(tour.available_seats ?? tour.total_seats ?? 0);

  // Mảng ACF metadata
  const metaData: { key: string; value: any }[] = [];

  const addMeta = (fieldKey: string, val: any) => {
    const acfKey = mappings[fieldKey] || fieldKey;
    if (acfKey && val !== undefined && val !== null) {
      metaData.push({ key: acfKey, value: val });
    }
  };

  addMeta('start_date', tour.start_date || '');
  addMeta('end_date', tour.end_date || '');
  addMeta('duration', tour.duration || '');
  addMeta('price_child', Number(tour.price_child || 0));
  addMeta('price_infant', Number(tour.price_infant || 0));
  addMeta('single_room_surcharge', Number(tour.single_room_surcharge || 0));
  addMeta('price_visa_tour', Number(tour.price_visa_tour || 0));
  addMeta('airline', tour.airline || '');
  addMeta('hotel', tour.hotel || '');
  addMeta('destination', tour.destination || '');
  addMeta('itinerary_pdf_url', tour.itinerary_pdf_url || '');
  addMeta('flight_out', tour.flight_out || '');
  addMeta('flight_in', tour.flight_in || '');

  // Thêm cờ nhận diện từ Tour CRM
  metaData.push({ key: '_synced_by_tour_crm', value: 'yes' });
  metaData.push({ key: '_tour_crm_id', value: tour.id });

  // Tóm tắt lịch trình
  const shortDesc = `
<p><strong>Mã Tour:</strong> ${tour.code}</p>
<p><strong>Khởi hành:</strong> ${tour.start_date ? tour.start_date.split('-').reverse().join('/') : 'Liên hệ'} - <strong>Thời lượng:</strong> ${tour.duration || 'N/A'}</p>
<p><strong>Hãng bay:</strong> ${tour.airline || 'N/A'} - <strong>Khách sạn:</strong> ${tour.hotel || 'N/A'}</p>
${tour.itinerary_pdf_url ? `<p><a href="${tour.itinerary_pdf_url}" target="_blank" rel="noopener noreferrer">📄 Tải lịch trình chi tiết (PDF)</a></p>` : ''}
  `.trim();

  return {
    name: tour.name,
    type: 'simple',
    sku: tour.code,
    regular_price: adultPrice > 0 ? adultPrice.toString() : '0',
    manage_stock: true,
    stock_quantity: seats >= 0 ? seats : 0,
    stock_status: seats > 0 ? 'instock' : 'outofstock',
    status: 'publish',
    short_description: shortDesc,
    meta_data: metaData
  };
}

/**
 * Đồng bộ 1 Tour cụ thể sang WooCommerce
 */
export async function syncTourToWooCommerce(tourId: string) {
  const config = await getWooCommerceConfig();
  if (!config.is_active || !config.site_url) {
    throw new Error('Chưa kích hoạt hoặc cấu hình tích hợp WooCommerce.');
  }

  const supabase = getAdminSupabaseClient();
  const { data: tour, error: tourError } = await supabase
    .from('tours')
    .select('*')
    .eq('id', tourId)
    .single();

  if (tourError || !tour) {
    throw new Error(`Không tìm thấy tour ID: ${tourId}`);
  }

  const payload = buildWooCommercePayload(tour, config.field_mappings);

  let wpProductId = tour.wp_product_id;
  let isUpdate = false;

  // 1. Nếu chưa có wp_product_id, tìm xem trên WooCommerce đã có SKU này chưa
  if (!wpProductId && tour.code) {
    try {
      const searchRes = await callWooCommerceApi(config, '/products', 'GET', undefined, { sku: tour.code });
      if (Array.isArray(searchRes.data) && searchRes.data.length > 0) {
        wpProductId = searchRes.data[0].id;
      }
    } catch (e) {
      console.warn('[WooCommerce] Tìm SKU thất bại, tiếp tục tạo mới:', e);
    }
  }

  let finalProductId = wpProductId;
  let productUrl = '';

  try {
    if (wpProductId) {
      // Cập nhật sản phẩm có sẵn
      const updateRes = await callWooCommerceApi(config, `/products/${wpProductId}`, 'PUT', payload);
      finalProductId = updateRes.data.id;
      productUrl = updateRes.data.permalink || '';
      isUpdate = true;
    } else {
      // Tạo sản phẩm mới
      const createRes = await callWooCommerceApi(config, '/products', 'POST', payload);
      finalProductId = createRes.data.id;
      productUrl = createRes.data.permalink || '';
    }

    // Cập nhật lại trạng thái đồng bộ vào bảng tours trong Supabase
    const now = new Date().toISOString();
    await supabase
      .from('tours')
      .update({
        wp_product_id: finalProductId,
        wp_sync_status: 'synced',
        wp_last_synced_at: now,
        wp_sync_message: `Đồng bộ thành công (${isUpdate ? 'Cập nhật' : 'Tạo mới'} ID #${finalProductId})`
      })
      .eq('id', tourId);

    return {
      success: true,
      product_id: finalProductId,
      product_url: productUrl,
      action: isUpdate ? 'updated' : 'created',
      message: `Đã ${isUpdate ? 'cập nhật' : 'đăng mới'} tour lên website thành công (ID: #${finalProductId}).`
    };
  } catch (err: any) {
    const errorMsg = err.data?.message || err.message || 'Lỗi không xác định';
    
    // Ghi nhận lỗi vào tour
    await supabase
      .from('tours')
      .update({
        wp_sync_status: 'failed',
        wp_last_synced_at: new Date().toISOString(),
        wp_sync_message: `Lỗi: ${errorMsg}`
      })
      .eq('id', tourId);

    throw new Error(`Đồng bộ thất bại: ${errorMsg}`);
  }
}

/**
 * Đồng bộ toàn bộ tour đang hoạt động sang WooCommerce
 */
export async function syncAllToursToWooCommerce() {
  const config = await getWooCommerceConfig();
  if (!config.is_active || !config.site_url) {
    throw new Error('Chưa kích hoạt hoặc cấu hình tích hợp WooCommerce.');
  }

  const supabase = getAdminSupabaseClient();
  const { data: tours, error } = await supabase
    .from('tours')
    .select('id, code, name')
    .order('created_at', { ascending: false });

  if (error || !tours || tours.length === 0) {
    return {
      success: true,
      total: 0,
      synced: 0,
      failed: 0,
      results: []
    };
  }

  const results: any[] = [];
  let syncedCount = 0;
  let failedCount = 0;

  for (const t of tours) {
    try {
      const res = await syncTourToWooCommerce(t.id);
      results.push({
        id: t.id,
        code: t.code,
        name: t.name,
        success: true,
        product_id: res.product_id
      });
      syncedCount++;
    } catch (e: any) {
      results.push({
        id: t.id,
        code: t.code,
        name: t.name,
        success: false,
        error: e.message
      });
      failedCount++;
    }
  }

  return {
    success: true,
    total: tours.length,
    synced: syncedCount,
    failed: failedCount,
    results
  };
}
