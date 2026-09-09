/**
 * Bộ quy tắc phân quyền người dùng và vai trò theo chuẩn AGENTS.md
 */

export type UserRole =
  | 'admin'
  | 'sale'
  | 'sale_leader'
  | 'operator'
  | 'accounting'
  | 'visa'
  | 'agent'
  | 'CTV'
  | 'bod'
  | 'tour_guide'
  | 'hr'
  | 'marketing'
  | 'marketing_leader';

/**
 * Kiểm tra quyền quản lý tour (Thêm ngày khởi hành, Sửa, Xóa, Tạo hàng loạt)
 * Chỉ có admin, operator, và sale_leader mới có quyền quản lý tour.
 * Hướng dẫn viên (tour_guide), Sale, CTV, Kế toán, Visa KHÔNG có quyền.
 */
export function canManageTours(role?: string | null): boolean {
  if (!role) return false;
  return ['admin', 'operator', 'sale_leader'].includes(role);
}

/**
 * Kiểm tra quyền truy cập tab Hạch toán Chi phí - Lãi lỗ tour
 * Ẩn hoàn toàn với Hướng dẫn viên (tour_guide), CTV, Đại lý, Visa, Sale thường.
 */
export function canAccessTourCosts(role?: string | null): boolean {
  if (!role) return false;
  return ['admin', 'bod', 'operator', 'accounting', 'sale_leader'].includes(role);
}

/**
 * Kiểm tra quyền thao tác với Tour tự vận hành (internal)
 * Sale Leader KHÔNG có quyền sửa/xóa/xem chi phí của Tour tự vận hành.
 */
export function canSaleLeaderOperateTour(role: string | null | undefined, tourType?: string | null): boolean {
  if (role !== 'sale_leader') return true;
  if (!tourType || tourType === 'internal') return false;
  return true; // Được phép với partner (outsourced) hoặc private
}

/**
 * Kiểm tra quyền truy cập tab Hành chính nhân sự (Đề nghị thanh toán & Nghỉ phép)
 * Ẩn hoàn toàn đối với Đại lý & CTV (role === 'agent' hoặc 'CTV')
 */
export function canAccessHRSection(role?: string | null): boolean {
  if (!role) return false;
  return role !== 'agent' && role !== 'CTV';
}

/**
 * Kiểm tra quyền xem thẻ thông tin đối tác F2 (Gửi khách đối tác)
 * Chỉ hiển thị cho admin, operator, sale_leader, bod.
 */
export function canViewPartnerCard(role?: string | null): boolean {
  if (!role) return false;
  return ['admin', 'operator', 'sale_leader', 'bod'].includes(role);
}

/**
 * Phân quyền duyệt đơn nghỉ phép Cấp 1 (Quản lý trực tiếp)
 * Gồm: sale_leader, marketing_leader, hr, admin, bod.
 * (Lưu ý: operator và accounting KHÔNG có quyền duyệt cấp 1)
 */
export function canApproveLeaveLevel1(role?: string | null): boolean {
  if (!role) return false;
  return ['sale_leader', 'marketing_leader', 'hr', 'admin', 'bod'].includes(role);
}

/**
 * Phân quyền duyệt đơn nghỉ phép Cấp 2 (Duyệt cấp cuối & trừ phép)
 * Chỉ có: hr, bod, admin.
 */
export function canApproveLeaveLevel2(role?: string | null): boolean {
  if (!role) return false;
  return ['hr', 'bod', 'admin'].includes(role);
}
