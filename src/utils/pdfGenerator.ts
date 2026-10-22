import html2pdf from 'html2pdf.js';

export interface GeneratePdfOptions {
  filename?: string;
  margin?: number | [number, number, number, number];
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
        windowWidth: 800
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
