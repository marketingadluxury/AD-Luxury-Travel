import { describe, it, expect } from 'vitest';
import {
  canManageTours,
  canAccessTourCosts,
  canSaleLeaderOperateTour,
  canAccessHRSection,
  canViewPartnerCard,
  canApproveLeaveLevel1,
  canApproveLeaveLevel2
} from '../permissionUtils';

describe('Phần 2: Automation Tests - Kiểm thử logic Phân quyền (PermissionUtils)', () => {
  describe('Quyền quản lý Tour (canManageTours)', () => {
    it('Cho phép admin, operator, sale_leader quản lý tour', () => {
      expect(canManageTours('admin')).toBe(true);
      expect(canManageTours('operator')).toBe(true);
      expect(canManageTours('sale_leader')).toBe(true);
    });

    it('Chặn nghiêm ngặt Hướng dẫn viên (tour_guide), Sale, CTV, Kế toán', () => {
      expect(canManageTours('tour_guide')).toBe(false);
      expect(canManageTours('sale')).toBe(false);
      expect(canManageTours('CTV')).toBe(false);
      expect(canManageTours('agent')).toBe(false);
      expect(canManageTours('accounting')).toBe(false);
      expect(canManageTours('visa')).toBe(false);
      expect(canManageTours(null)).toBe(false);
    });
  });

  describe('Quyền xem tab Hạch toán chi phí - Lãi lỗ (canAccessTourCosts)', () => {
    it('Cho phép admin, bod, operator, accounting, sale_leader', () => {
      expect(canAccessTourCosts('admin')).toBe(true);
      expect(canAccessTourCosts('bod')).toBe(true);
      expect(canAccessTourCosts('operator')).toBe(true);
      expect(canAccessTourCosts('accounting')).toBe(true);
      expect(canAccessTourCosts('sale_leader')).toBe(true);
    });

    it('Ẩn hoàn toàn với Hướng dẫn viên (tour_guide), Sale, CTV', () => {
      expect(canAccessTourCosts('tour_guide')).toBe(false);
      expect(canAccessTourCosts('sale')).toBe(false);
      expect(canAccessTourCosts('CTV')).toBe(false);
      expect(canAccessTourCosts('agent')).toBe(false);
    });
  });

  describe('Quyền của Sale Leader với các loại Tour (canSaleLeaderOperateTour)', () => {
    it('Sale Leader bị chặn với Tour tự vận hành (internal hoặc null)', () => {
      expect(canSaleLeaderOperateTour('sale_leader', 'internal')).toBe(false);
      expect(canSaleLeaderOperateTour('sale_leader', null)).toBe(false);
      expect(canSaleLeaderOperateTour('sale_leader', undefined)).toBe(false);
    });

    it('Sale Leader được phép với Tour đối tác (partner) hoặc đoàn riêng (private)', () => {
      expect(canSaleLeaderOperateTour('sale_leader', 'partner')).toBe(true);
      expect(canSaleLeaderOperateTour('sale_leader', 'private')).toBe(true);
    });

    it('Các vai trò khác (như admin, operator) không bị giới hạn này', () => {
      expect(canSaleLeaderOperateTour('admin', 'internal')).toBe(true);
      expect(canSaleLeaderOperateTour('operator', 'internal')).toBe(true);
    });
  });

  describe('Quyền truy cập Hành chính nhân sự (canAccessHRSection)', () => {
    it('Cho phép nhân sự nội bộ công ty', () => {
      expect(canAccessHRSection('admin')).toBe(true);
      expect(canAccessHRSection('sale')).toBe(true);
      expect(canAccessHRSection('operator')).toBe(true);
      expect(canAccessHRSection('accounting')).toBe(true);
      expect(canAccessHRSection('tour_guide')).toBe(true);
    });

    it('Chặn hoàn toàn Đại lý và CTV ngoài', () => {
      expect(canAccessHRSection('agent')).toBe(false);
      expect(canAccessHRSection('CTV')).toBe(false);
    });
  });

  describe('Quyền xem Thẻ Đối tác gửi khách (canViewPartnerCard)', () => {
    it('Chỉ cho phép 4 vai trò quản trị/điều hành xem', () => {
      expect(canViewPartnerCard('admin')).toBe(true);
      expect(canViewPartnerCard('operator')).toBe(true);
      expect(canViewPartnerCard('sale_leader')).toBe(true);
      expect(canViewPartnerCard('bod')).toBe(true);
    });

    it('Ẩn với Sale, CTV, Đại lý, Hướng dẫn viên', () => {
      expect(canViewPartnerCard('sale')).toBe(false);
      expect(canViewPartnerCard('tour_guide')).toBe(false);
      expect(canViewPartnerCard('agent')).toBe(false);
      expect(canViewPartnerCard('CTV')).toBe(false);
    });
  });

  describe('Quy trình duyệt nghỉ phép 2 cấp', () => {
    it('Cấp 1: Trực tiếp quản lý (sale_leader, marketing_leader, hr, admin, bod)', () => {
      expect(canApproveLeaveLevel1('sale_leader')).toBe(true);
      expect(canApproveLeaveLevel1('marketing_leader')).toBe(true);
      expect(canApproveLeaveLevel1('hr')).toBe(true);
      expect(canApproveLeaveLevel1('admin')).toBe(true);
      expect(canApproveLeaveLevel1('bod')).toBe(true);

      // Operator và Accounting KHÔNG có quyền duyệt cấp 1
      expect(canApproveLeaveLevel1('operator')).toBe(false);
      expect(canApproveLeaveLevel1('accounting')).toBe(false);
    });

    it('Cấp 2: Duyệt cấp cuối & trừ phép (chỉ hr, bod, admin)', () => {
      expect(canApproveLeaveLevel2('hr')).toBe(true);
      expect(canApproveLeaveLevel2('bod')).toBe(true);
      expect(canApproveLeaveLevel2('admin')).toBe(true);

      // Sale leader, operator, accounting KHÔNG được duyệt cấp 2
      expect(canApproveLeaveLevel2('sale_leader')).toBe(false);
      expect(canApproveLeaveLevel2('operator')).toBe(false);
      expect(canApproveLeaveLevel2('accounting')).toBe(false);
    });
  });
});
