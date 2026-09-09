import { describe, it, expect } from 'vitest';
import { calculateDefaultAccruedLeaveDays } from '../payrollUtils';

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
});
