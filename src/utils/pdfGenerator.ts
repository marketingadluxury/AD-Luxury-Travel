import html2pdf from 'html2pdf.js';
import { COLOR_PROPERTIES, sanitizeOklchColors } from './colorSanitizer';

export interface GeneratePdfOptions {
  filename?: string;
  margin?: number | [number, number, number, number];
}

export { oklchToRgb, sanitizeOklchColors } from './colorSanitizer';

/**
 * Quét toàn bộ phần tử DOM và chuẩn hóa các giá trị màu oklch thành RGB
 */
function sanitizeElementTree(root: HTMLElement): void {
  const allElements = [root, ...Array.from(root.querySelectorAll('*'))] as HTMLElement[];

  allElements.forEach(el => {
    // 1. Chuẩn hóa thuộc tính style inline nếu có
    const styleAttr = el.getAttribute('style');
    if (styleAttr && styleAttr.includes('oklch')) {
      el.setAttribute('style', sanitizeOklchColors(styleAttr));
    }

    // 2. Chuẩn hóa SVG fill / stroke
    const fillAttr = el.getAttribute('fill');
    if (fillAttr && fillAttr.includes('oklch')) {
      el.setAttribute('fill', sanitizeOklchColors(fillAttr));
    }
    const strokeAttr = el.getAttribute('stroke');
    if (strokeAttr && strokeAttr.includes('oklch')) {
      el.setAttribute('stroke', sanitizeOklchColors(strokeAttr));
    }

    // 3. Chuẩn hóa computed style sang inline style để override triệt để
    if (typeof window !== 'undefined' && el.ownerDocument?.defaultView) {
      try {
        const computed = el.ownerDocument.defaultView.getComputedStyle(el);
        COLOR_PROPERTIES.forEach(prop => {
          const val = computed.getPropertyValue(prop);
          if (val && val.includes('oklch')) {
            el.style.setProperty(prop, sanitizeOklchColors(val), 'important');
          }
        });
      } catch {
        // bỏ qua nếu không thể đọc computed style của node
      }
    }
  });
}

/**
 * Xuất phần tử DOM thành file PDF (Blob) chuẩn khổ giấy A4
 * @param element Phần tử HTML cần chuyển đổi sang PDF
 * @param options Cấu hình tên file và lề trang in
 */
export async function exportElementToPdfBlob(
  element: HTMLElement,
  options: GeneratePdfOptions = {}
): Promise<Blob> {
  // Clone element để xóa border/shadow của khung preview màn hình
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';
  clone.style.margin = '0 auto';
  clone.style.width = '794px';
  clone.style.maxWidth = '794px';
  clone.style.padding = '20px 24px';
  clone.style.backgroundColor = '#ffffff';

  // Container ẩn tạm thời ngoài màn hình để html2pdf chụp ảnh chuẩn nhất
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-9999';
  container.appendChild(clone);
  document.body.appendChild(container);

  // Chuẩn hóa cây DOM clone trước khi render
  sanitizeElementTree(clone);

  // Intercept getComputedStyle của window chính làm tầng bảo vệ thứ nhất
  let origWindowGetComputedStyle: typeof window.getComputedStyle | null = null;
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    origWindowGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = function(el: Element, pseudo?: string | null) {
      const style = origWindowGetComputedStyle!(el, pseudo);
      return new Proxy(style, {
        get(target, prop, receiver) {
          const val = Reflect.get(target, prop, receiver);
          if (typeof val === 'function') {
            return function(...args: any[]) {
              const res = val.apply(target, args);
              if (typeof res === 'string' && res.includes('oklch')) {
                return sanitizeOklchColors(res);
              }
              return res;
            };
          }
          if (typeof val === 'string' && val.includes('oklch')) {
            return sanitizeOklchColors(val);
          }
          return val;
        }
      });
    };
  }

  try {
    const opt = {
      margin: options.margin ?? [10, 8, 10, 8],
      filename: options.filename || 'HopDong_DuLich.pdf',
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true,
        backgroundColor: '#ffffff',
        windowWidth: 800,
        onclone: (clonedDoc: Document) => {
          // 1. Quét và thay thế oklch trong toàn bộ thẻ <style> của iframe
          try {
            const styleNodes = clonedDoc.querySelectorAll('style');
            styleNodes.forEach(s => {
              if (s.textContent && s.textContent.includes('oklch')) {
                s.textContent = sanitizeOklchColors(s.textContent);
              }
            });
          } catch (e) {
            console.warn('[pdfGenerator] Error sanitizing cloned <style>:', e);
          }

          // 2. Đặt Proxy cho getComputedStyle của window trong iframe
          try {
            const clonedWin = clonedDoc.defaultView;
            if (clonedWin && clonedWin.getComputedStyle) {
              const origClonedGetComputedStyle = clonedWin.getComputedStyle.bind(clonedWin);
              clonedWin.getComputedStyle = function(el: Element, pseudo?: string | null) {
                const style = origClonedGetComputedStyle(el, pseudo);
                return new Proxy(style, {
                  get(target, prop, receiver) {
                    const val = Reflect.get(target, prop, receiver);
                    if (typeof val === 'function') {
                      return function(...args: any[]) {
                        const res = val.apply(target, args);
                        if (typeof res === 'string' && res.includes('oklch')) {
                          return sanitizeOklchColors(res);
                        }
                        return res;
                      };
                    }
                    if (typeof val === 'string' && val.includes('oklch')) {
                      return sanitizeOklchColors(val);
                    }
                    return val;
                  }
                });
              };
            }
          } catch (e) {
            console.warn('[pdfGenerator] Error proxying iframe getComputedStyle:', e);
          }

          // 3. Chuẩn hóa toàn bộ cây phần tử trong clonedDoc
          try {
            if (clonedDoc.body) {
              sanitizeElementTree(clonedDoc.body);
            }
          } catch (e) {
            console.warn('[pdfGenerator] Error sanitizing cloned DOM tree:', e);
          }
        }
      },
      jsPDF: {
        unit: 'mm' as const,
        format: 'a4' as const,
        orientation: 'portrait' as const
      },
      pagebreak: { 
        mode: ['avoid-all', 'css', 'legacy'],
        avoid: ['.avoid-break', 'tr', 'h1', 'h2', 'h3']
      }
    };

    const worker = html2pdf().from(clone).set(opt);
    const blob: Blob = await worker.output('blob');
    return blob;
  } finally {
    // Khôi phục getComputedStyle gốc của window chính
    if (origWindowGetComputedStyle && typeof window !== 'undefined') {
      window.getComputedStyle = origWindowGetComputedStyle;
    }
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Tải file PDF trực tiếp xuống máy tính của người dùng
 * @param blob File PDF dạng Blob
 * @param filename Tên file khi tải về máy
 */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
