/**
 * Tiện ích bóc tách tiền tố SKU và so khớp Tour CRM với Sản phẩm WooCommerce
 */

export interface WordPressProductMeta {
  id: number;
  name: string;
  slug?: string;
  permalink?: string;
  price?: string;
  regular_price?: string;
  sku?: string;
  status?: string;
  stock_quantity?: number | null;
  stock_status?: string;
  departures_count?: number;
  departures?: string[];
}

/**
 * Chuẩn hóa chuỗi văn bản tiếng Việt để so sánh không phân biệt dấu/hoa thường
 */
export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

/**
 * Trích xuất tiền tố SKU sản phẩm từ Mã lịch trình của CRM
 * Ví dụ:
 * - "AD-US01-201026" -> "AD-US01"
 * - "AD-EU05_15112026" -> "AD-EU05"
 * - "TOUR-VN-01-D1" -> "TOUR-VN-01"
 * - "AD-NB01" -> "AD-NB01"
 */
export function extractSkuFromTourCode(tourCode: string): string {
  if (!tourCode || typeof tourCode !== 'string') return '';
  const trimmed = tourCode.trim();

  // Kiểm tra nếu có dấu gạch ngang '-' hoặc gạch dưới '_'
  const lastDash = trimmed.lastIndexOf('-');
  const lastUnderscore = trimmed.lastIndexOf('_');
  const splitIdx = Math.max(lastDash, lastUnderscore);

  if (splitIdx > 0 && splitIdx < trimmed.length - 1) {
    const prefix = trimmed.substring(0, splitIdx).trim();
    const suffix = trimmed.substring(splitIdx + 1).trim();

    // Suffix là ngày khởi hành (ví dụ: 201026, 151126, 20261015, 1026 - 4 đến 8 chữ số)
    const isDateSuffix = /^\d{4,8}$/.test(suffix);
    // Suffix là mã đợt khởi hành (ví dụ: D1, D01, K1, K01, DOT1, LICH1)
    const isBatchSuffix = /^(D|K|DOT|LICH)\d+$/i.test(suffix);

    if (prefix.length >= 2 && (isDateSuffix || isBatchSuffix)) {
      return prefix;
    }
  }

  return trimmed;
}

/**
 * Thuật toán tự động tìm sản phẩm WooCommerce tương ứng cho một Tour CRM
 * Ưu tiên:
 * 1. Đã có wp_product_id lưu trước đó
 * 2. Khớp tiền tố SKU (Mã lịch trình bắt đầu bằng SKU của SP Web hoặc tiền tố trích xuất trùng SKU)
 * 3. Mã lịch trình đã có trong bảng ACF departures của SP Web
 * 4. So khớp theo tên chương trình tour
 * 5. Mặc định: Tạo mới sản phẩm trên Web
 */
export function findMatchedProductForTour<T extends WordPressProductMeta>(
  tour: { id: string; name?: string; code?: string; wp_product_id?: string | number | null },
  productsList: T[]
): {
  targetProductId: number | null;
  matchedType: 'linked' | 'sku_matched' | 'name_matched' | 'new';
  matchedSku?: string;
  matchedProductName?: string;
  productUrl?: string;
} {
  // 1. Kiểm tra nếu đã có wp_product_id
  if (tour.wp_product_id) {
    const linked = productsList.find(p => p.id === Number(tour.wp_product_id));
    if (linked) {
      return {
        targetProductId: linked.id,
        matchedType: 'linked',
        matchedSku: linked.sku,
        matchedProductName: linked.name,
        productUrl: linked.permalink
      };
    }
  }

  const cleanTourCode = (tour.code || '').trim().toUpperCase();
  const extractedSku = extractSkuFromTourCode(tour.code || '').toUpperCase();

  // 2. So khớp theo SKU / Tiền tố Mã lịch trình
  if (extractedSku) {
    const exactSkuMatch = productsList.find(p => (p.sku || '').trim().toUpperCase() === extractedSku);
    if (exactSkuMatch) {
      return {
        targetProductId: exactSkuMatch.id,
        matchedType: 'sku_matched',
        matchedSku: exactSkuMatch.sku,
        matchedProductName: exactSkuMatch.name,
        productUrl: exactSkuMatch.permalink
      };
    }
  }

  if (cleanTourCode) {
    // Sắp xếp các product có sku dài hơn lên trước để ưu tiên match chính xác nhất
    const candidateSkuMatches = productsList
      .filter(p => {
        const pSku = (p.sku || '').trim().toUpperCase();
        return pSku.length >= 2 && cleanTourCode.startsWith(pSku);
      })
      .sort((a, b) => ((b.sku || '').length) - ((a.sku || '').length));

    if (candidateSkuMatches.length > 0) {
      const bestMatch = candidateSkuMatches[0];
      return {
        targetProductId: bestMatch.id,
        matchedType: 'sku_matched',
        matchedSku: bestMatch.sku,
        matchedProductName: bestMatch.name,
        productUrl: bestMatch.permalink
      };
    }

    // Kiểm tra trong danh sách đợt khởi hành ACF hiện có của sản phẩm
    const matchByDeparture = productsList.find(p => {
      if (!Array.isArray(p.departures)) return false;
      return p.departures.some(d => d.trim().toUpperCase() === cleanTourCode);
    });
    if (matchByDeparture) {
      return {
        targetProductId: matchByDeparture.id,
        matchedType: 'sku_matched',
        matchedSku: matchByDeparture.sku,
        matchedProductName: matchByDeparture.name,
        productUrl: matchByDeparture.permalink
      };
    }
  }

  // 3. So khớp theo Tên Chương Trình Tour
  if (tour.name) {
    const normTourName = normalizeText(tour.name);
    if (normTourName) {
      let matchedByName = productsList.find(p => normalizeText(p.name) === normTourName);
      if (!matchedByName) {
        matchedByName = productsList.find(p => {
          const normProdName = normalizeText(p.name);
          return normProdName.includes(normTourName) || normTourName.includes(normProdName);
        });
      }
      if (matchedByName) {
        return {
          targetProductId: matchedByName.id,
          matchedType: 'name_matched',
          matchedSku: matchedByName.sku,
          matchedProductName: matchedByName.name,
          productUrl: matchedByName.permalink
        };
      }
    }
  }

  // 4. Không tìm thấy -> Tạo mới
  return {
    targetProductId: null,
    matchedType: 'new'
  };
}
