import { describe, it, expect } from 'vitest';
import { extractSkuPrefix, normalizeSku, matchTourToWooCommerceProduct } from '../skuUtils';

describe('extractSkuPrefix', () => {
  it('trích xuất chính xác tiền tố khi có đuôi ngày tháng dạng YYMMDD hoặc YYYYMMDD', () => {
    expect(extractSkuPrefix('AD-US01-201026')).toBe('AD-US01');
    expect(extractSkuPrefix('TOUR-VN-01-20261015')).toBe('TOUR-VN-01');
    expect(extractSkuPrefix('EUR-05-151026')).toBe('EUR-05');
    expect(extractSkuPrefix('US01_15102026')).toBe('US01');
  });

  it('trích xuất chính xác tiền tố khi có đuôi ký hiệu đợt như D1, DOT1, T10', () => {
    expect(extractSkuPrefix('TOUR-VN-01-D1')).toBe('TOUR-VN-01');
    expect(extractSkuPrefix('AD-US-01-DOT1')).toBe('AD-US-01');
    expect(extractSkuPrefix('JP-SAKURA-T11')).toBe('JP-SAKURA');
    expect(extractSkuPrefix('KOR-02_DOT2')).toBe('KOR-02');
  });

  it('giữ nguyên mã tour nếu mã đã là SKU gốc và không có đuôi ngày/đợt', () => {
    expect(extractSkuPrefix('AD-US01')).toBe('AD-US01');
    expect(extractSkuPrefix('TOUR-VN-HA-LONG')).toBe('TOUR-VN-HA-LONG');
    expect(extractSkuPrefix('')).toBe('');
  });
});

describe('normalizeSku', () => {
  it('loại bỏ khoảng trắng và chuyển chữ hoa', () => {
    expect(normalizeSku(' ad-us01 ')).toBe('AD-US01');
    expect(normalizeSku('tour vn 01')).toBe('TOURVN01');
  });
});

describe('matchTourToWooCommerceProduct (Quy tắc 4 tầng)', () => {
  const mockProducts = [
    {
      id: 101,
      name: 'Tour Bờ Tây Hoa Kỳ 8N7Đ',
      sku: 'AD-US01',
      permalink: 'https://adluxury.net/product/us-west',
      departures: ['AD-US01-201026', 'AD-US01-151126']
    },
    {
      id: 102,
      name: 'Tour Khám Phá Nhật Bản Mùa Thu',
      sku: 'JP-FALL',
      permalink: 'https://adluxury.net/product/japan-autumn',
      departures: ['JP-FALL-01', 'SPECIAL-OCT-DEPARTURE']
    },
    {
      id: 103,
      name: 'Tour Châu Âu 5 Nước Cổ Kính',
      sku: 'EUR-CLASSIC',
      permalink: 'https://adluxury.net/product/europe-classic',
      departures: []
    }
  ];

  it('Tầng 1: Ưu tiên tour đã có liên kết từ trước (wp_product_id)', () => {
    const tour = {
      id: 'tour-1',
      name: 'Tour Đổi Tên Khác',
      code: 'RANDOM-CODE-99',
      wp_product_id: 102
    };
    const result = matchTourToWooCommerceProduct(tour, mockProducts);
    expect(result.matchedType).toBe('linked');
    expect(result.targetProductId).toBe(102);
    expect(result.mode).toBe('existing');
  });

  it('Tầng 2: Khớp theo tiền tố SKU của sản phẩm WooCommerce', () => {
    const tour = {
      id: 'tour-2',
      name: 'Khởi hành Bờ Tây Mỹ Mới Nhất',
      code: 'AD-US01-251226',
      wp_product_id: null
    };
    const result = matchTourToWooCommerceProduct(tour, mockProducts);
    expect(result.matchedType).toBe('sku_matched');
    expect(result.targetProductId).toBe(101);
    expect(result.matchedProductSku).toBe('AD-US01');
    expect(result.mode).toBe('existing');
  });

  it('Tầng 3: Khớp khi mã lịch trình đã có trong danh sách đợt khởi hành ACF', () => {
    const tour = {
      id: 'tour-3',
      name: 'Đợt khởi hành mùa thu',
      code: 'SPECIAL-OCT-DEPARTURE', // Mã đặc biệt không khớp SKU JP-FALL nhưng nằm trong departures của SP 102
      wp_product_id: null
    };
    const result = matchTourToWooCommerceProduct(tour, mockProducts);
    expect(result.matchedType).toBe('departure_matched');
    expect(result.targetProductId).toBe(102);
    expect(result.mode).toBe('existing');
  });

  it('Tầng 4: So khớp theo tên chương trình tour tương đồng', () => {
    const tour = {
      id: 'tour-4',
      name: 'Tour Châu Âu 5 Nước Cổ Kính',
      code: 'EUR-NEW-2026',
      wp_product_id: null
    };
    const result = matchTourToWooCommerceProduct(tour, mockProducts);
    expect(result.matchedType).toBe('auto_matched');
    expect(result.targetProductId).toBe(103);
    expect(result.mode).toBe('existing');
  });

  it('Mặc định: Chưa có SKU tương ứng, gợi ý tạo sản phẩm mới với SKU là tiền tố', () => {
    const tour = {
      id: 'tour-5',
      name: 'Tour Hàn Quốc Seoul Đảo Nami',
      code: 'KOR-SEOUL-101126',
      wp_product_id: null
    };
    const result = matchTourToWooCommerceProduct(tour, mockProducts);
    expect(result.matchedType).toBe('new');
    expect(result.mode).toBe('new');
    expect(result.suggestedNewSku).toBe('KOR-SEOUL');
    expect(result.targetProductId).toBeNull();
  });
});
