import { describe, it, expect } from 'vitest';
import { oklchToRgb, sanitizeOklchColors } from '../colorSanitizer';

describe('PDF Generator OKLCH Sanitizer', () => {
  it('chuyển đổi oklch đen / xám sang chuẩn rgb', () => {
    const res = oklchToRgb(0.205, 0, 0);
    expect(res).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
    expect(res).toBe('rgb(23, 23, 23)');
  });

  it('chuyển đổi oklch có alpha sang rgba', () => {
    const res = oklchToRgb(0.869, 0.022, 252.894, 0.5);
    expect(res).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*0\.5\)$/);
  });

  it('sanitizeOklchColors thay thế chính xác các chuỗi oklch trong CSS', () => {
    const css = 'color: oklch(0.205 0 0); border: 1px solid oklch(0.869 0.022 252.894 / 0.5);';
    const sanitized = sanitizeOklchColors(css);
    expect(sanitized).not.toContain('oklch');
    expect(sanitized).toContain('color: rgb(23, 23, 23);');
    expect(sanitized).toContain('rgba(');
  });

  it('sanitizeOklchColors xử lý an toàn giá trị none hoặc phần trăm', () => {
    const css = 'background-color: oklch(20.5% none none);';
    const sanitized = sanitizeOklchColors(css);
    expect(sanitized).not.toContain('oklch');
    expect(sanitized).toContain('rgb(');
  });

  it('giữ nguyên chuỗi màu không chứa oklch', () => {
    const hexCss = 'color: #333333; background: rgb(255, 255, 255);';
    expect(sanitizeOklchColors(hexCss)).toBe(hexCss);
  });
});
