import { describe, it, expect } from 'vitest';
import { calculateDefaultAccruedLeaveDays, calculateSeniority } from '../payrollUtils';

describe('Phần 2: Automation Tests - Kiểm thử quỹ phép tích lũy (payrollUtils)', () => {
  const currentYear = new Date().getFullYear();

  it('Năm trong tương lai (> năm hiện tại) mặc định là 0 ngày', () => {
    expect(calculateDefaultAccruedLeaveDays(currentYear + 1)).toBe(0);
    expect(calculateDefaultAccruedLeaveDays(currentYear + 2)).toBe(0);
  });

  it('Năm trong quá khứ (< năm hiện tại) mặc định đủ 12 ngày phép', () => {
    expect(calculateDefaultAccruedLeaveDays(currentYear - 1)).toBe(12);
  });

  it('Năm hiện tại tính tích lũy theo tháng hạch toán (1 ngày / tháng)', () => {
    // Nếu hạch toán vào tháng 8
    const daysInAugust = calculateDefaultAccruedLeaveDays(currentYear, null, 8);
    expect(daysInAugust).toBe(8);

    // Nếu hạch toán vào tháng 3
    const daysInMarch = calculateDefaultAccruedLeaveDays(currentYear, null, 3);
    expect(daysInMarch).toBe(3);
  });

  it('Nhân viên mới vào làm trong năm tính từ tháng bắt đầu đến tháng hạch toán', () => {
    // Nhân viên vào làm tháng 3 năm hiện tại
    const newEmployee = {
      join_date: `${currentYear}-03-15`
    };

    // Hạch toán vào tháng 8: từ tháng 3 đến tháng 8 là 6 tháng (8 - 3 + 1 = 6 ngày)
    const accruedDays = calculateDefaultAccruedLeaveDays(currentYear, newEmployee, 8);
    expect(accruedDays).toBe(6);
  });

  it('Nhân viên có ngày vào làm sau tháng hạch toán nhận 0 ngày', () => {
    const futureEmployee = {
      join_date: `${currentYear}-10-01`
    };
    // Hạch toán vào tháng 5 nhưng tháng 10 mới vào làm -> 0 ngày
    const accruedDays = calculateDefaultAccruedLeaveDays(currentYear, futureEmployee, 5);
    expect(accruedDays).toBe(0);
  });

  it('Nhân sự thử việc (employment_status = "probation") mặc định nhận 0 ngày phép', () => {
    const probationEmployee = {
      join_date: `${currentYear}-01-01`,
      employment_status: 'probation' as const
    };
    // Dù ở tháng 8 thì nhân sự thử việc vẫn là 0 ngày
    const accruedDays = calculateDefaultAccruedLeaveDays(currentYear, probationEmployee, 8);
    expect(accruedDays).toBe(0);
  });

  it('Nhân sự chính thức (employment_status = "official" hoặc không set) tích lũy bình thường', () => {
    const officialEmployee = {
      join_date: `${currentYear}-01-01`,
      employment_status: 'official' as const
    };
    const accruedDays = calculateDefaultAccruedLeaveDays(currentYear, officialEmployee, 8);
    expect(accruedDays).toBe(8);
  });

  it('Nhân sự đã nghỉ việc (employment_status = "resigned") mặc định nhận 0 ngày phép', () => {
    const resignedEmployee = {
      join_date: `${currentYear}-01-01`,
      employment_status: 'resigned' as const
    };
    const accruedDays = calculateDefaultAccruedLeaveDays(currentYear, resignedEmployee, 8);
    expect(accruedDays).toBe(0);
  });

  it('Nhân sự có thâm niên trên 5 năm được cộng thêm ngày phép thâm niên (+1 ngày / 5 năm)', () => {
    const seniorEmployee = {
      join_date: `${currentYear - 6}-01-01`, // 6 năm thâm niên
      employment_status: 'official' as const
    };
    // Tháng 8 hạch toán: 8 ngày cơ bản + 1 ngày phép thâm niên (Math.floor(6/5) = 1) = 9 ngày
    const accruedDays = calculateDefaultAccruedLeaveDays(currentYear, seniorEmployee, 8);
    expect(accruedDays).toBe(9);
  });
});

describe('Phần 2.2: Automation Tests - Kiểm thử tính thâm niên công tác (calculateSeniority)', () => {
  it('Xử lý trường hợp không có ngày vào làm', () => {
    const res = calculateSeniority(null);
    expect(res.years).toBe(0);
    expect(res.text).toBe('Chưa cập nhật ngày vào làm');
  });

  it('Tính chính xác nhân sự mới gia nhập trong tháng', () => {
    const res = calculateSeniority('2026-09-15', new Date('2026-09-29'));
    expect(res.years).toBe(0);
    expect(res.months).toBe(0);
    expect(res.days).toBe(14);
    expect(res.text).toContain('Mới gia nhập (14 ngày)');
  });

  it('Tính chính xác thâm niên theo năm và tháng', () => {
    const res = calculateSeniority('2024-03-10', new Date('2026-09-29'));
    expect(res.years).toBe(2);
    expect(res.months).toBe(6);
    expect(res.text).toBe('2 năm 6 tháng');
  });

  it('Tính ngày phép thưởng thâm niên (seniorityBonusDays) theo Luật lao động', () => {
    const res5yr = calculateSeniority('2021-01-01', new Date('2026-09-29'));
    expect(res5yr.seniorityBonusDays).toBe(1); // 5 năm -> +1 ngày

    const res11yr = calculateSeniority('2015-01-01', new Date('2026-09-29'));
    expect(res11yr.seniorityBonusDays).toBe(2); // 11 năm -> +2 ngày
  });

  it('Tính đúng thâm niên đến ngày thôi việc nếu nhân viên đã nghỉ việc (resignedAt)', () => {
    const res = calculateSeniority('2023-01-01', null, '2025-06-15');
    expect(res.years).toBe(2);
    expect(res.months).toBe(5);
    expect(res.text).toBe('2 năm 5 tháng');
  });
});

