import { getAdminSupabaseClient } from './supabaseService.js';

export interface WooCommerceConfig {
  id?: string;
  site_url: string;
  consumer_key: string;
  consumer_secret: string;
  is_active: boolean;
  auto_sync_on_save: boolean;
  auto_sync_on_booking: boolean;
  repeater_slug?: string;
  sync_mode?: 'repeater' | 'simple';
  field_mappings: Record<string, string>;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_FIELD_MAPPINGS: Record<string, string> = {
  code: 'ma_lich_trinh',
  start_date: 'ngay_khoi_hanh',
  end_date: 'ngay_ve',
  duration: 'thoi_luong',
  price_adult: 'gia_nguoi_lon',
  price_child: 'gia_tre_em',
  price_infant: 'gia_em_be',
  single_room_surcharge: 'phu_thu_phong_don',
  price_visa_tour: 'phi_visa',
  airline: 'hang_hang_khong',
  hotel: 'khach_san',
  destination: 'diem_den',
  total_seats: 'tong_so_cho_mo_ban',
  available_seats: 'so_cho_con_lai',
  itinerary_pdf_url: 'link_lich_trinh',
  flight_out: 'chuyen_bay_di',
  flight_in: 'chuyen_bay_ve',
  tour_status: 'tinh_trang_tour',
  description: 'luu_y_dac_biet'
};

// Bộ nhớ đệm tạm thời (In-memory fallback nếu chưa tạo bảng trong Supabase)
let memoryConfig: WooCommerceConfig = {
  site_url: process.env.WOOCOMMERCE_SITE_URL || '',
  consumer_key: process.env.WOOCOMMERCE_CONSUMER_KEY || '',
  consumer_secret: process.env.WOOCOMMERCE_CONSUMER_SECRET || '',
  is_active: true,
  auto_sync_on_save: false,
  auto_sync_on_booking: false,
  repeater_slug: 'lich_trinh_khoi_hanh',
  sync_mode: 'repeater',
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
        repeater_slug: data.repeater_slug || 'lich_trinh_khoi_hanh',
        sync_mode: data.sync_mode || 'repeater',
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
          repeater_slug: updated.repeater_slug || 'lich_trinh_khoi_hanh',
          sync_mode: updated.sync_mode || 'repeater',
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
          repeater_slug: updated.repeater_slug || 'lich_trinh_khoi_hanh',
          sync_mode: updated.sync_mode || 'repeater',
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
 * Định dạng ngày YYYY-MM-DD sang chuẩn Việt Nam DD/MM/YYYY
 */
function formatDateVN(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim().split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Xây dựng 1 hàng (row) cho bảng ACF Repeater từ thông tin Tour
 */
function buildRepeaterRowFromTour(tour: any, mappings: Record<string, string>): Record<string, any> {
  const row: Record<string, any> = {};
  const adultPrice = Number(tour.price_adult || tour.price || 0);
  const childPrice = Number(tour.price_child || Math.round(adultPrice * 0.8));
  const infantPrice = Number(tour.price_infant || Math.round(adultPrice * 0.3));
  const singleRoom = Number(tour.single_room_surcharge || 0);
  const totalSeats = Number(tour.total_seats || 0);
  const availSeats = Number(tour.available_seats ?? tour.total_seats ?? 0);

  // Map theo các trường cấu hình
  for (const [crmField, acfSlug] of Object.entries(mappings)) {
    if (!acfSlug || typeof acfSlug !== 'string' || !acfSlug.trim()) continue;
    const cleanSlug = acfSlug.trim();
    let val: any = tour[crmField];

    if (crmField === 'code') val = tour.code;
    else if (crmField === 'price_adult') val = adultPrice;
    else if (crmField === 'price_child') val = childPrice;
    else if (crmField === 'price_infant') val = infantPrice;
    else if (crmField === 'single_room_surcharge') val = singleRoom;
    else if (crmField === 'total_seats') val = totalSeats;
    else if (crmField === 'available_seats') val = availSeats;
    else if (crmField === 'start_date') val = tour.start_date ? formatDateVN(tour.start_date) : '';
    else if (crmField === 'end_date') val = tour.end_date ? formatDateVN(tour.end_date) : '';
    else if (crmField === 'flight_out') val = tour.flight_out || '';
    else if (crmField === 'flight_in') val = tour.flight_in || '';
    else if (crmField === 'tour_status') val = tour.tour_status || 'available';
    else if (crmField === 'description') val = tour.description || '';

    if (val !== undefined && val !== null) {
      row[cleanSlug] = val;
    }
  }

  // Đảm bảo luôn có mã lịch trình
  const codeSlug = mappings.code || 'ma_lich_trinh';
  row[codeSlug] = tour.code;

  return row;
}

/**
 * Xây dựng payload sản phẩm WooCommerce từ Tour (hỗ trợ cả Simple Product & ACF Repeater)
 */
function buildWooCommercePayload(
  primaryTour: any,
  groupTours: any[],
  config: WooCommerceConfig,
  existingProduct?: any
) {
  const mappings = config.field_mappings || DEFAULT_FIELD_MAPPINGS;
  const repeaterSlug = (config.repeater_slug || 'lich_trinh_khoi_hanh').trim();
  const codeSlug = (mappings.code || 'ma_lich_trinh').trim();

  // Tìm mức giá người lớn thấp nhất của các đợt đang mở bán để hiển thị giá "Chỉ từ ..."
  const prices = groupTours
    .map(t => Number(t.price_adult || t.price || 0))
    .filter(p => p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : Number(primaryTour.price_adult || primaryTour.price || 0);

  // Tổng số chỗ khả dụng của toàn bộ các đợt khởi hành
  const totalAvailableSeats = groupTours.reduce((sum, t) => {
    return sum + Number(t.available_seats ?? t.total_seats ?? 0);
  }, 0);

  // Mảng ACF metadata
  const metaData: { key: string; value: any }[] = [];

  // 1. Thêm các trường metadata tổng quan của chương trình Tour
  if (mappings && typeof mappings === 'object') {
    for (const [crmField, acfSlug] of Object.entries(mappings)) {
      if (!acfSlug || typeof acfSlug !== 'string' || !acfSlug.trim()) continue;
      const cleanSlug = acfSlug.trim();
      let val = primaryTour[crmField];

      if (val === undefined || val === null) {
        if (crmField === 'price_adult') val = minPrice;
        else if (crmField === 'available_seats') val = totalAvailableSeats;
        else if (crmField === 'total_seats') val = groupTours.reduce((sum, t) => sum + Number(t.total_seats || 0), 0);
      }

      if (typeof val === 'number') {
        val = Number(val);
      } else if (val === undefined || val === null) {
        val = '';
      }

      metaData.push({ key: cleanSlug, value: val });
    }
  }

  // 2. Xây dựng bảng ACF Repeater Lịch Trình Khởi Hành
  // Lấy các dòng hiện có trên sản phẩm WordPress (nếu có) để merge
  let currentRows: Record<string, any>[] = [];
  if (existingProduct && Array.isArray(existingProduct.meta_data)) {
    const existingMeta = existingProduct.meta_data.find((m: any) => m.key === repeaterSlug);
    if (existingMeta && Array.isArray(existingMeta.value)) {
      currentRows = [...existingMeta.value];
    }
  }

  // Cập nhật hoặc thêm mới các đợt từ CRM vào bảng Repeater
  const rowsMap = new Map<string, Record<string, any>>();
  // Đưa các dòng cũ vào map
  currentRows.forEach(r => {
    const codeVal = r[codeSlug] || r.ma_lich_trinh || r.code;
    if (codeVal) rowsMap.set(String(codeVal).trim().toUpperCase(), r);
  });

  // Hợp nhất các đợt từ CRM
  groupTours.forEach(t => {
    const row = buildRepeaterRowFromTour(t, mappings);
    const codeVal = String(t.code).trim().toUpperCase();
    rowsMap.set(codeVal, row);
  });

  const finalRepeaterRows = Array.from(rowsMap.values());

  // Thêm dữ liệu Repeater vào meta_data dạng mảng chuẩn ACF REST API
  metaData.push({ key: repeaterSlug, value: finalRepeaterRows });

  // Đồng thời thêm cả chuẩn Indexed Meta của ACF Pro (lich_trinh_khoi_hanh = N, lich_trinh_khoi_hanh_0_ma_lich_trinh = ...)
  // để tương thích 100% với get_field(), have_rows() trong PHP của WordPress
  metaData.push({ key: repeaterSlug, value: finalRepeaterRows.length });
  finalRepeaterRows.forEach((r, idx) => {
    for (const [subKey, subVal] of Object.entries(r)) {
      metaData.push({
        key: `${repeaterSlug}_${idx}_${subKey}`,
        value: subVal
      });
    }
  });

  // Cờ nhận diện Tour CRM
  metaData.push({ key: '_synced_by_tour_crm', value: 'yes' });
  metaData.push({ key: '_tour_crm_primary_id', value: primaryTour.id });

  // Tóm tắt lịch trình đại diện
  const shortDesc = `
<p><strong>Chương trình Tour:</strong> ${primaryTour.name}</p>
<p><strong>Thời lượng:</strong> ${primaryTour.duration || 'N/A'} - <strong>Điểm đến:</strong> ${primaryTour.destination || 'N/A'}</p>
<p><strong>Hãng bay:</strong> ${primaryTour.airline || 'N/A'} - <strong>Khách sạn:</strong> ${primaryTour.hotel || 'N/A'}</p>
<p><strong>Số đợt khởi hành đang mở bán:</strong> ${groupTours.length} đợt</p>
${primaryTour.itinerary_pdf_url ? `<p><a href="${primaryTour.itinerary_pdf_url}" target="_blank" rel="noopener noreferrer">📄 Tải lịch trình chi tiết (PDF)</a></p>` : ''}
  `.trim();

  return {
    name: primaryTour.name,
    type: 'simple',
    sku: primaryTour.code,
    regular_price: minPrice > 0 ? minPrice.toString() : '0',
    manage_stock: true,
    stock_quantity: totalAvailableSeats >= 0 ? totalAvailableSeats : 0,
    stock_status: totalAvailableSeats > 0 ? 'instock' : 'outofstock',
    status: 'publish',
    short_description: shortDesc,
    meta_data: metaData
  };
}

/**
 * Lấy danh sách sản phẩm Tour hiện có trên website WordPress WooCommerce
 */
export async function getWooCommerceProducts(search?: string, perPage = 20, page = 1) {
  const config = await getWooCommerceConfig();
  if (!config.is_active || !config.site_url) {
    throw new Error('Chưa kích hoạt hoặc cấu hình kết nối WooCommerce.');
  }

  const queryParams: Record<string, string | number> = {
    per_page: perPage,
    page: page,
    status: 'publish,draft,private',
    orderby: 'title',
    order: 'asc'
  };

  if (search && search.trim()) {
    queryParams.search = search.trim();
  }

  const res = await callWooCommerceApi(config, '/products', 'GET', undefined, queryParams);
  const products = Array.isArray(res.data) ? res.data : [];
  const repeaterSlug = (config.repeater_slug || 'lich_trinh_khoi_hanh').trim();
  const codeSlug = (config.field_mappings?.code || 'ma_lich_trinh').trim();

  // Bóc tách danh sách các mã lịch trình đang có trong từng sản phẩm
  const parsedProducts = products.map((p: any) => {
    let departures: string[] = [];
    let departuresCount = 0;

    if (Array.isArray(p.meta_data)) {
      const repeaterMeta = p.meta_data.find((m: any) => m.key === repeaterSlug);
      if (repeaterMeta && Array.isArray(repeaterMeta.value)) {
        departures = repeaterMeta.value
          .map((row: any) => String(row[codeSlug] || row.ma_lich_trinh || row.code || '').trim())
          .filter(Boolean);
        departuresCount = departures.length;
      }
    }

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      permalink: p.permalink,
      price: p.price,
      regular_price: p.regular_price,
      sku: p.sku,
      status: p.status,
      stock_quantity: p.stock_quantity,
      stock_status: p.stock_status,
      departures_count: departuresCount,
      departures: departures
    };
  });

  const totalStr = res.headers.get('x-wp-total') || String(parsedProducts.length);
  const totalPagesStr = res.headers.get('x-wp-totalpages') || '1';

  return {
    success: true,
    total: parseInt(totalStr, 10),
    total_pages: parseInt(totalPagesStr, 10),
    products: parsedProducts
  };
}

/**
 * Đồng bộ 1 Tour cụ thể sang WooCommerce (Hỗ trợ chọn Sản phẩm có sẵn hoặc Tạo mới)
 */
export async function syncTourToWooCommerce(
  tourId: string, 
  options?: { target_product_id?: number | 'new'; force_new?: boolean }
) {
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

  // Xác định Target Product ID trên WooCommerce
  let targetWpProductId: number | undefined = undefined;

  if (options?.target_product_id && options.target_product_id !== 'new') {
    targetWpProductId = Number(options.target_product_id);
  } else if (!options?.force_new && options?.target_product_id !== 'new') {
    // Nếu không chỉ định, tìm theo wp_product_id đã lưu trước đó
    if (tour.wp_product_id) {
      targetWpProductId = Number(tour.wp_product_id);
    }
  }

  let existingProduct: any = null;

  if (targetWpProductId) {
    try {
      const getRes = await callWooCommerceApi(config, `/products/${targetWpProductId}`, 'GET');
      if (getRes.data?.id) {
        existingProduct = getRes.data;
      } else {
        targetWpProductId = undefined;
      }
    } catch (e) {
      console.warn(`[WooCommerce] Không tìm thấy sản phẩm ID #${targetWpProductId}, chuyển sang chế độ tạo mới:`, e);
      targetWpProductId = undefined;
    }
  }

  // Nếu không có target_product_id và không force_new, thử tìm theo tên tour
  if (!targetWpProductId && !options?.force_new && options?.target_product_id !== 'new' && tour.name) {
    try {
      const searchRes = await callWooCommerceApi(config, '/products', 'GET', undefined, {
        search: tour.name,
        per_page: 5
      });
      if (Array.isArray(searchRes.data) && searchRes.data.length > 0) {
        const exactMatch = searchRes.data.find(
          (p: any) => p.name?.trim().toLowerCase() === tour.name.trim().toLowerCase()
        ) || searchRes.data[0];
        if (exactMatch?.id) {
          targetWpProductId = exactMatch.id;
          existingProduct = exactMatch;
        }
      }
    } catch (e) {
      console.warn('[WooCommerce] Tìm sản phẩm theo tên thất bại:', e);
    }
  }

  // Tìm tất cả các tour trên CRM có cùng tên hoặc cùng liên kết với sản phẩm này
  const { data: siblingTours } = await supabase
    .from('tours')
    .select('*')
    .or(`name.eq."${tour.name}",wp_product_id.eq.${targetWpProductId || -1}`);

  const groupTours = (siblingTours && siblingTours.length > 0) ? siblingTours : [tour];

  // Kiểm tra xem mã lịch trình của tour này đã có trong sản phẩm chưa
  const repeaterSlug = (config.repeater_slug || 'lich_trinh_khoi_hanh').trim();
  const codeSlug = (config.field_mappings?.code || 'ma_lich_trinh').trim();
  let departureAction: 'added' | 'updated' = 'added';

  if (existingProduct && Array.isArray(existingProduct.meta_data)) {
    const existingMeta = existingProduct.meta_data.find((m: any) => m.key === repeaterSlug);
    if (existingMeta && Array.isArray(existingMeta.value)) {
      const hasCode = existingMeta.value.some((row: any) => {
        const c = String(row[codeSlug] || row.ma_lich_trinh || row.code || '').trim().toUpperCase();
        return c === String(tour.code).trim().toUpperCase();
      });
      if (hasCode) {
        departureAction = 'updated';
      }
    }
  }

  const payload = buildWooCommercePayload(tour, groupTours, config, existingProduct);

  let finalProductId = targetWpProductId;
  let productUrl = '';
  let isUpdate = false;

  try {
    if (targetWpProductId) {
      // Cập nhật sản phẩm có sẵn trên website
      const updateRes = await callWooCommerceApi(config, `/products/${targetWpProductId}`, 'PUT', payload);
      finalProductId = updateRes.data.id;
      productUrl = updateRes.data.permalink || '';
      isUpdate = true;
    } else {
      // Tạo sản phẩm mới hoàn toàn trên website
      const createRes = await callWooCommerceApi(config, '/products', 'POST', payload);
      finalProductId = createRes.data.id;
      productUrl = createRes.data.permalink || '';
    }

    // Cập nhật lại wp_product_id cho tour hiện tại trong Supabase
    const now = new Date().toISOString();
    const actionDesc = isUpdate 
      ? (departureAction === 'updated' ? `Cập nhật mã lịch ${tour.code} vào SP #${finalProductId}` : `Thêm mới mã lịch ${tour.code} vào SP #${finalProductId}`)
      : `Tạo mới sản phẩm #${finalProductId}`;

    await supabase
      .from('tours')
      .update({
        wp_product_id: finalProductId,
        wp_sync_status: 'synced',
        wp_last_synced_at: now,
        wp_sync_message: `Đồng bộ thành công (${actionDesc})`
      })
      .eq('id', tour.id);

    return {
      success: true,
      product_id: finalProductId,
      product_name: isUpdate && existingProduct?.name ? existingProduct.name : tour.name,
      product_url: productUrl,
      action: isUpdate ? 'updated' : 'created',
      departure_action: departureAction,
      message: isUpdate 
        ? `Đã ${departureAction === 'updated' ? 'cập nhật' : 'thêm mới'} ngày khởi hành [${tour.code}] vào sản phẩm "${existingProduct?.name || tour.name}" (#${finalProductId}) trên website.`
        : `Đã tạo mới sản phẩm "${tour.name}" (#${finalProductId}) trên website.`
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
 * Đồng bộ toàn bộ tour đang hoạt động sang WooCommerce (tự động gom nhóm theo Tên Tour)
 */
export async function syncAllToursToWooCommerce() {
  const config = await getWooCommerceConfig();
  if (!config.is_active || !config.site_url) {
    throw new Error('Chưa kích hoạt hoặc cấu hình tích hợp WooCommerce.');
  }

  const supabase = getAdminSupabaseClient();
  const { data: tours, error } = await supabase
    .from('tours')
    .select('*')
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

  // Gom nhóm các tour theo Tên Tour
  const groupsMap = new Map<string, any[]>();
  for (const t of tours) {
    const key = (t.name || t.code || 'Tour').trim();
    if (!groupsMap.has(key)) {
      groupsMap.set(key, []);
    }
    groupsMap.get(key)!.push(t);
  }

  const results: any[] = [];
  let syncedCount = 0;
  let failedCount = 0;

  for (const [tourName, group] of groupsMap.entries()) {
    const primaryTour = group[0];
    try {
      const res = await syncTourToWooCommerce(primaryTour.id);
      results.push({
        name: tourName,
        success: true,
        product_id: res.product_id,
        departures_count: group.length,
        departures: group.map(g => g.code)
      });
      syncedCount += group.length;
    } catch (e: any) {
      results.push({
        name: tourName,
        success: false,
        error: e.message,
        departures_count: group.length,
        departures: group.map(g => g.code)
      });
      failedCount += group.length;
    }
  }

  return {
    success: true,
    total: tours.length,
    total_groups: groupsMap.size,
    synced: syncedCount,
    failed: failedCount,
    results
  };
}
