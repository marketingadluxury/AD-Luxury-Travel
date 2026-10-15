/**
 * skuUtils.ts - Tiện ích bóc tách tiền tố SKU và so khớp sản phẩm Tour giữa CRM và WooCommerce
 */

/**
 * Thuật toán bóc tách tiền tố SKU từ Mã lịch trình trên CRM
 * Tự động nhận diện phần đuôi ngày tháng/mã đợt của tour CRM mà vẫn bảo toàn cấu trúc mã tour gốc.
 * 
 * Ví dụ hợp lệ bóc tách:
 *  - AD-US01-201026 -> AD-US01 (đuôi ngày 201026)
 *  - TOUR-VN-01-20261015 -> TOUR-VN-01 (đuôi ngày 20261015)
 *  - TOUR-VN-01-D1 -> TOUR-VN-01 (đuôi đợt D1)
 *  - AD-US-01-DOT1 -> AD-US-01 (đuôi đợt DOT1)
 *  - EUR-05-151026 -> EUR-05 (đuôi ngày 151026)
 *  - JP-SAKURA-T11 -> JP-SAKURA (đuôi tháng T11)
 *  - US01_15102026 -> US01 (đuôi ngày 15102026)
 * 
 * Ví dụ giữ nguyên mã gốc:
 *  - AD-US01 -> AD-US01 (mã tour gốc, US01 là mã tuyến, không phải đuôi ngày)
 *  - TOUR-VN-HA-LONG -> TOUR-VN-HA-LONG
 *  - EUR-CLASSIC -> EUR-CLASSIC
 */
export function extractSkuPrefix(code: string): string {
  if (!code) return '';
  const trimmed = code.trim();

  // 1. Nhận diện các mẫu ngày tháng / mã đợt khởi hành ở đuôi:
  // - 4 đến 8 chữ số đại diện cho ngày tháng: ví dụ 201026 (YYMMDD), 20261015 (YYYYMMDD), 151026 (DDMMYY), 1510 (DDMM)
  // - Ký hiệu đợt khởi hành: D1, D01, DOT1, DOT-1, T10, T11 (tháng 10, tháng 11)
  const departureSuffixRegex = /^(.*?)([-_])([0-9]{4,8}|[dD][0-9]{1,3}|[dD][oO][tT][0-9]{1,3}|[tT][0-9]{1,2})$/i;
  const match = trimmed.match(departureSuffixRegex);
  if (match && match[1]) {
    return match[1].trim();
  }

  // 2. Nhận diện trường hợp có 2 chữ số cuối cùng nhưng đi sau dấu gạch và phía trước là năm/tháng (ví dụ: -26, _26)
  const shortDateRegex = /^(.*?)([-_])(2[4-9]|3[0-5])$/;
  const matchShort = trimmed.match(shortDateRegex);
  if (matchShort && matchShort[1]) {
    // Chỉ cắt nếu phần tiền tố chứa ít nhất một dấu gạch nữa (ví dụ: TOUR-US-26 -> TOUR-US)
    if (matchShort[1].includes('-') || matchShort[1].includes('_')) {
      return matchShort[1].trim();
    }
  }

  return trimmed;
}

/**
 * Chuẩn hóa SKU để so sánh không phân biệt hoa thường và khoảng trắng
 */
export function normalizeSku(sku: string): string {
  return (sku || '').trim().toUpperCase().replace(/\s+/g, '');
}

export type MatchTier = 'linked' | 'sku_matched' | 'departure_matched' | 'auto_matched' | 'new';

export interface ProductMatchResult<T> {
  mode: 'existing' | 'new';
  targetProductId: number | null;
  matchedType: MatchTier;
  matchedProductName?: string;
  matchedProductSku?: string;
  productUrl?: string;
  matchedProduct?: T;
  suggestedNewSku: string;
}

/**
 * Quy tắc 4 tầng so khớp thông minh giữa Tour CRM và danh sách sản phẩm WooCommerce
 * @param tour Tour cần so khớp
 * @param products Danh sách sản phẩm WooCommerce hiện có
 */
export function matchTourToWooCommerceProduct<T extends {
  id: number;
  name: string;
  sku?: string;
  permalink?: string;
  departures?: string[];
}>(
  tour: { id: string; name: string; code: string; wp_product_id?: number | string | null },
  products: T[]
): ProductMatchResult<T> {
  const tourCode = (tour.code || '').trim();
  const skuPrefix = extractSkuPrefix(tourCode);
  const normalizedTourCode = normalizeSku(tourCode);
  const normalizedSkuPrefix = normalizeSku(skuPrefix);
  const normalizedTourName = (tour.name || '').trim().toLowerCase();

  // TẦNG 1: Tour đã có liên kết từ trước (wp_product_id)
  if (tour.wp_product_id) {
    const existingLinked = products.find(p => p.id === Number(tour.wp_product_id));
    if (existingLinked) {
      return {
        mode: 'existing',
        targetProductId: existingLinked.id,
        matchedType: 'linked',
        matchedProductName: existingLinked.name,
        matchedProductSku: existingLinked.sku,
        productUrl: existingLinked.permalink,
        matchedProduct: existingLinked,
        suggestedNewSku: skuPrefix || tourCode
      };
    }
  }

  // TẦNG 2 (MỚI): Khớp theo tiền tố SKU của sản phẩm WooCommerce
  // Tìm sản phẩm có product.sku trùng với tiền tố SKU của tour CRM hoặc trùng với tourCode
  if (normalizedSkuPrefix) {
    const matchedBySku = products.find(p => {
      if (!p.sku) return false;
      const normalizedProductSku = normalizeSku(p.sku);
      return (
        normalizedProductSku === normalizedSkuPrefix ||
        normalizedProductSku === normalizedTourCode ||
        normalizedSkuPrefix === extractSkuPrefix(p.sku).toUpperCase()
      );
    });

    if (matchedBySku) {
      return {
        mode: 'existing',
        targetProductId: matchedBySku.id,
        matchedType: 'sku_matched',
        matchedProductName: matchedBySku.name,
        matchedProductSku: matchedBySku.sku,
        productUrl: matchedBySku.permalink,
        matchedProduct: matchedBySku,
        suggestedNewSku: skuPrefix || tourCode
      };
    }
  }

  // TẦNG 3: Mã lịch trình đã có trong danh sách đợt khởi hành ACF departures của sản phẩm trên website
  if (tourCode) {
    const matchedByDeparture = products.find(p => {
      if (!Array.isArray(p.departures) || p.departures.length === 0) return false;
      return p.departures.some(d => normalizeSku(d) === normalizedTourCode);
    });

    if (matchedByDeparture) {
      return {
        mode: 'existing',
        targetProductId: matchedByDeparture.id,
        matchedType: 'departure_matched',
        matchedProductName: matchedByDeparture.name,
        matchedProductSku: matchedByDeparture.sku,
        productUrl: matchedByDeparture.permalink,
        matchedProduct: matchedByDeparture,
        suggestedNewSku: skuPrefix || tourCode
      };
    }
  }

  // TẦNG 4: So khớp theo tên chương trình tour tương đồng
  if (normalizedTourName) {
    const matchedByName = products.find(p => {
      const pName = (p.name || '').trim().toLowerCase();
      return pName === normalizedTourName || pName.includes(normalizedTourName) || normalizedTourName.includes(pName);
    });

    if (matchedByName) {
      return {
        mode: 'existing',
        targetProductId: matchedByName.id,
        matchedType: 'auto_matched',
        matchedProductName: matchedByName.name,
        matchedProductSku: matchedByName.sku,
        productUrl: matchedByName.permalink,
        matchedProduct: matchedByName,
        suggestedNewSku: skuPrefix || tourCode
      };
    }
  }

  // MẶC ĐỊNH: Chưa có SKU Web - Gợi ý chế độ tạo mới với mã SKU là tiền tố đã bóc tách
  return {
    mode: 'new',
    targetProductId: null,
    matchedType: 'new',
    suggestedNewSku: skuPrefix || tourCode
  };
}
