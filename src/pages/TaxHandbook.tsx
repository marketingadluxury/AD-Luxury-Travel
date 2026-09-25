import React, { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  Calculator, 
  Receipt, 
  Percent, 
  DollarSign, 
  Calendar, 
  HelpCircle, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Plane, 
  Building, 
  Users, 
  CreditCard, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Info,
  Scale,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount));
};

// Helper parse input currency
const parseCurrency = (str: string): number => {
  const cleaned = str.replace(/[^\d]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
};

export default function TaxHandbook() {
  const [activeTab, setActiveTab] = useState<'calculators' | 'handbook' | 'calendar'>('calculators');
  const [searchQuery, setSearchQuery] = useState('');

  // MCP Sync State
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<string>('Vừa xong');
  const [mcpStatus, setMcpStatus] = useState<{
    version: string;
    date: string;
    status: 'online' | 'cached' | 'error';
    message: string;
  }>({
    version: 'v2.2.0',
    date: '06/09/2026',
    status: 'online',
    message: 'Đã đồng bộ với MCP Server (thue-vietnam)'
  });

  const handleCheckMcpUpdate = async (isManual = true) => {
    setIsCheckingUpdate(true);
    try {
      const res = await fetch('/api/tax/check-mcp-update', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMcpStatus({
          version: data.latestVersion || 'v2.2.0',
          date: data.updatedAt || '06/09/2026',
          status: data.serverStatus === 'online' ? 'online' : 'cached',
          message: data.message || 'Hệ thống đang sử dụng dữ liệu mới nhất từ MCP Server'
        });
        setLastCheckedTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
        if (isManual) {
          toast.success('Hệ thống đã đồng bộ thành công với máy chủ MCP! Dữ liệu luật thuế đang ở phiên bản mới nhất.');
        }
      } else {
        throw new Error(data.error || 'Lỗi kết nối MCP');
      }
    } catch (err: any) {
      setMcpStatus(prev => ({
        ...prev,
        status: 'cached',
        message: 'Đang dùng dữ liệu quy chuẩn đóng gói sẵn'
      }));
      if (isManual) {
        toast.success('Hệ thống đang sử dụng bộ quy chuẩn thuế đóng gói sẵn (v2.2.0) đảm bảo tính ổn định.');
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  useEffect(() => {
    handleCheckMcpUpdate(false);
  }, []);

  // --- CALCULATOR 1: VAT TOUR DU LỊCH ---
  const [vatPriceInput, setVatPriceInput] = useState<string>('25,000,000');
  const [vatOutboundDeductionInput, setVatOutboundDeductionInput] = useState<string>('15,000,000');
  const [vatRate, setVatRate] = useState<number>(8); // 8% or 10% or 0%
  const [vatTourType, setVatTourType] = useState<'inbound_domestic' | 'outbound'>('outbound');
  const [vatCalcMode, setVatCalcMode] = useState<'gross_included' | 'net_excluded'>('gross_included');

  const vatPrice = parseCurrency(vatPriceInput);
  const vatOutboundDeduction = parseCurrency(vatOutboundDeductionInput);

  const vatResult = useMemo(() => {
    if (vatTourType === 'outbound') {
      // Tour Outbound: Giá tính thuế = Doanh thu trọn gói trừ (-) các chi phí thực tế phát sinh ở nước ngoài
      // Nếu giá đã bao gồm VAT:
      const taxableBaseBeforeTax = Math.max(0, vatPrice - vatOutboundDeduction);
      if (vatCalcMode === 'gross_included') {
        // Thuế GTGT = taxableBaseBeforeTax - (taxableBaseBeforeTax / (1 + vatRate / 100))
        const taxAmount = (taxableBaseBeforeTax * vatRate) / (100 + vatRate);
        const netPrice = vatPrice - taxAmount;
        return {
          totalPrice: vatPrice,
          netPrice: netPrice,
          taxableBase: taxableBaseBeforeTax - taxAmount,
          taxAmount: taxAmount,
          foreignCost: vatOutboundDeduction,
          effectiveRate: vatPrice > 0 ? (taxAmount / vatPrice) * 100 : 0
        };
      } else {
        // Giá chưa bao gồm VAT:
        const taxAmount = (taxableBaseBeforeTax * vatRate) / 100;
        return {
          totalPrice: vatPrice + taxAmount,
          netPrice: vatPrice,
          taxableBase: taxableBaseBeforeTax,
          taxAmount: taxAmount,
          foreignCost: vatOutboundDeduction,
          effectiveRate: (vatPrice + taxAmount) > 0 ? (taxAmount / (vatPrice + taxAmount)) * 100 : 0
        };
      }
    } else {
      // Tour Nội Địa / Inbound thông thường:
      if (vatCalcMode === 'gross_included') {
        const netPrice = (vatPrice * 100) / (100 + vatRate);
        const taxAmount = vatPrice - netPrice;
        return {
          totalPrice: vatPrice,
          netPrice: netPrice,
          taxableBase: netPrice,
          taxAmount: taxAmount,
          foreignCost: 0,
          effectiveRate: vatRate
        };
      } else {
        const taxAmount = (vatPrice * vatRate) / 100;
        return {
          totalPrice: vatPrice + taxAmount,
          netPrice: vatPrice,
          taxableBase: vatPrice,
          taxAmount: taxAmount,
          foreignCost: 0,
          effectiveRate: vatRate
        };
      }
    }
  }, [vatPrice, vatOutboundDeduction, vatRate, vatTourType, vatCalcMode]);

  // --- CALCULATOR 2: TNCN & HOA HỒNG CTV ---
  const [tncnMode, setTncnMode] = useState<'ctv' | 'salary'>('ctv');
  const [ctvCommissionInput, setCtvCommissionInput] = useState<string>('8,500,000');
  const [hasCommitment08, setHasCommitment08] = useState<boolean>(false);
  const [ctvThresholdOption, setCtvThresholdOption] = useState<'current_2m' | 'new_5m'>('current_2m');

  const ctvCommission = parseCurrency(ctvCommissionInput);

  const ctvResult = useMemo(() => {
    const threshold = ctvThresholdOption === 'current_2m' ? 2000000 : 5000000;
    if (ctvCommission < threshold || hasCommitment08) {
      return {
        grossCommission: ctvCommission,
        taxDeduction: 0,
        netPayment: ctvCommission,
        taxRate: 0,
        note: hasCommitment08 
          ? 'Áp dụng Cam kết mẫu 08/CK-TNCN: Tạm thời không khấu trừ 10% thuế TNCN'
          : `Khoản chi dưới ngưỡng ${formatCurrency(threshold)} đ/lần chi trả: Không bắt buộc khấu trừ thuế 10% tại nguồn.`
      };
    }
    const taxDeduction = ctvCommission * 0.1;
    return {
      grossCommission: ctvCommission,
      taxDeduction: taxDeduction,
      netPayment: ctvCommission - taxDeduction,
      taxRate: 10,
      note: 'Khấu trừ 10% tại nguồn trước khi chi trả. Doanh nghiệp xuất chứng từ khấu trừ thuế TNCN điện tử khi CTV yêu cầu.'
    };
  }, [ctvCommission, hasCommitment08, ctvThresholdOption]);

  // Salary Calculator
  const [salaryGrossInput, setSalaryGrossInput] = useState<string>('28,000,000');
  const [dependentsCount, setDependentsCount] = useState<number>(1);
  const [salaryTaxYear, setSalaryTaxYear] = useState<'2025' | '2026'>('2026');

  const salaryGross = parseCurrency(salaryGrossInput);

  const salaryResult = useMemo(() => {
    // BHXH 8%, BHYT 1.5%, BHTN 1% = 10.5%
    // Trần đóng BHXH 2025-2026
    const ceilingInsurance = salaryTaxYear === '2026' ? 50600000 : 46800000;
    const insuranceBase = Math.min(salaryGross, ceilingInsurance);
    const insuranceAmount = insuranceBase * 0.105;

    // Giảm trừ gia cảnh
    const personalRelief = salaryTaxYear === '2026' ? 15500000 : 11000000;
    const dependentRelief = salaryTaxYear === '2026' ? 6200000 : 4400000;
    const totalDependentRelief = dependentsCount * dependentRelief;
    const totalRelief = personalRelief + totalDependentRelief + insuranceAmount;

    const taxableIncome = Math.max(0, salaryGross - totalRelief);

    // Tính thuế lũy tiến
    let tax = 0;
    let brackets = [];

    if (salaryTaxYear === '2026') {
      // Biểu 5 bậc mới (Luật 109/2025):
      // Bậc 1: <= 10tr: 5%
      // Bậc 2: 10tr - 30tr: 10%
      // Bậc 3: 30tr - 60tr: 20%
      // Bậc 4: 60tr - 100tr: 30%
      // Bậc 5: > 100tr: 35%
      const b1 = Math.min(taxableIncome, 10000000);
      const b2 = Math.max(0, Math.min(taxableIncome - 10000000, 20000000));
      const b3 = Math.max(0, Math.min(taxableIncome - 30000000, 30000000));
      const b4 = Math.max(0, Math.min(taxableIncome - 60000000, 40000000));
      const b5 = Math.max(0, taxableIncome - 100000000);

      tax = b1 * 0.05 + b2 * 0.10 + b3 * 0.20 + b4 * 0.30 + b5 * 0.35;
      brackets = [
        { label: 'Bậc 1 (Đến 10 triệu - 5%)', amount: b1 * 0.05 },
        { label: 'Bậc 2 (10 - 30 triệu - 10%)', amount: b2 * 0.10 },
        { label: 'Bậc 3 (30 - 60 triệu - 20%)', amount: b3 * 0.20 },
        { label: 'Bậc 4 (60 - 100 triệu - 30%)', amount: b4 * 0.30 },
        { label: 'Bậc 5 (Trên 100 triệu - 35%)', amount: b5 * 0.35 },
      ].filter(b => b.amount > 0);
    } else {
      // Biểu 7 bậc cũ (2025):
      // Bậc 1: <= 5tr: 5%
      // Bậc 2: 5-10tr: 10%
      // Bậc 3: 10-18tr: 15%
      // Bậc 4: 18-32tr: 20%
      // Bậc 5: 32-52tr: 25%
      // Bậc 6: 52-80tr: 30%
      // Bậc 7: > 80tr: 35%
      const b1 = Math.min(taxableIncome, 5000000);
      const b2 = Math.max(0, Math.min(taxableIncome - 5000000, 5000000));
      const b3 = Math.max(0, Math.min(taxableIncome - 10000000, 8000000));
      const b4 = Math.max(0, Math.min(taxableIncome - 18000000, 14000000));
      const b5 = Math.max(0, Math.min(taxableIncome - 32000000, 20000000));
      const b6 = Math.max(0, Math.min(taxableIncome - 52000000, 28000000));
      const b7 = Math.max(0, taxableIncome - 80000000);

      tax = b1 * 0.05 + b2 * 0.10 + b3 * 0.15 + b4 * 0.20 + b5 * 0.25 + b6 * 0.30 + b7 * 0.35;
      brackets = [
        { label: 'Bậc 1 (Đến 5 triệu - 5%)', amount: b1 * 0.05 },
        { label: 'Bậc 2 (5 - 10 triệu - 10%)', amount: b2 * 0.10 },
        { label: 'Bậc 3 (10 - 18 triệu - 15%)', amount: b3 * 0.15 },
        { label: 'Bậc 4 (18 - 32 triệu - 20%)', amount: b4 * 0.20 },
        { label: 'Bậc 5 (32 - 52 triệu - 25%)', amount: b5 * 0.25 },
        { label: 'Bậc 6 (52 - 80 triệu - 30%)', amount: b6 * 0.30 },
        { label: 'Bậc 7 (Trên 80 triệu - 35%)', amount: b7 * 0.35 },
      ].filter(b => b.amount > 0);
    }

    const netSalary = salaryGross - insuranceAmount - tax;

    return {
      grossSalary: salaryGross,
      insuranceAmount,
      personalRelief,
      dependentRelief: totalDependentRelief,
      taxableIncome,
      taxAmount: tax,
      netSalary,
      brackets
    };
  }, [salaryGross, dependentsCount, salaryTaxYear]);

  // --- CALCULATOR 3: THUẾ NHÀ THẦU (META/GOOGLE ADS) ---
  const [fctExpenseInput, setFctExpenseInput] = useState<string>('20,000,000');
  const [fctType, setFctType] = useState<'meta_collected' | 'company_withheld'>('meta_collected');

  const fctExpense = parseCurrency(fctExpenseInput);

  const fctResult = useMemo(() => {
    if (fctType === 'meta_collected') {
      // Meta đã cộng trực tiếp 5% VAT trên receipt hóa đơn thẻ
      // Ví dụ: Ngân sách chạy 20.000.000đ, Meta trừ thêm 5% VAT = 1.000.000đ. Tổng trừ thẻ = 21.000.000đ
      // Toàn bộ 21.000.000đ này được tính là chi phí hợp lý được trừ TNDN nếu có sao kê thẻ công ty + receipt có mã số thuế
      const vatMeta = fctExpense * 0.05;
      const totalPaid = fctExpense + vatMeta;
      return {
        adsBudget: fctExpense,
        fctVat: vatMeta,
        fctCit: 0,
        totalPaid: totalPaid,
        deductibleExpense: totalPaid,
        explanation: 'Meta/Google đã đăng ký thuế tại Việt Nam và thu trực tiếp 5% thuế GTGT trên từng giao dịch. Doanh nghiệp không phải kê khai nộp thay, toàn bộ số tiền thanh toán (bao gồm 5% thuế Meta thu) được tính vào chi phí hợp lý được trừ khi có sao kê ngân hàng và receipt hợp lệ.'
      };
    } else {
      // Doanh nghiệp tự kê khai nộp thay nhà thầu (Tỷ lệ ngành dịch vụ: 5% GTGT + 5% TNDN)
      // Tính theo giá Net (Gross-up):
      const revenueTaxable = fctExpense / (1 - 0.05); // Gross-up doanh thu tính thuế TNDN
      const citAmount = revenueTaxable * 0.05;
      const vatAmount = revenueTaxable * 0.05;
      const totalTax = citAmount + vatAmount;
      return {
        adsBudget: fctExpense,
        fctVat: vatAmount,
        fctCit: citAmount,
        totalPaid: fctExpense + totalTax,
        deductibleExpense: fctExpense + totalTax,
        explanation: 'Doanh nghiệp nộp thay thuế nhà thầu mẫu 01/NTNN: 5% thuế GTGT + 5% thuế TNDN (tính trên doanh thu gross-up). Cả 2 khoản này đều được đưa vào chi phí hợp lệ hoặc khấu trừ thuế GTGT nếu có hợp đồng quy định rõ giá net.'
      };
    }
  }, [fctExpense, fctType]);

  // Handbook Articles
  const handbookArticles = [
    {
      id: 'vat-tour',
      category: 'Thuế GTGT (VAT)',
      title: 'Quy tắc tính thuế GTGT đối với Tour Du Lịch Lữ Hành & Thuế Suất 8%',
      summary: 'Áp dụng mức thuế suất ưu đãi 8% đến 31/12/2026. Hướng dẫn bóc tách doanh thu và chi phí phát sinh tại nước ngoài của tour Outbound.',
      content: [
        {
          heading: '1. Thuế suất GTGT áp dụng cho Tour du lịch',
          text: 'Theo Nghị định 174/2025/NĐ-CP, chính sách giảm thuế GTGT xuống mức 8% được tiếp tục áp dụng đến hết ngày 31/12/2026 đối với các nhóm hàng hóa, dịch vụ thuộc ngành du lịch lữ hành, dịch vụ lưu trú khách sạn, nhà hàng ăn uống, dịch vụ vận tải hành khách nội địa. Các dịch vụ khác ngoài danh mục ưu đãi vẫn áp dụng mức thuế suất phổ thông 10%.'
        },
        {
          heading: '2. Cách tính thuế GTGT tour Outbound (Đi nước ngoài)',
          text: 'Căn cứ Khoản 16 Điều 7 Thông tư 219/2013/TT-BTC và Luật Thuế GTGT:\n- Đối với dịch vụ du lịch lữ hành ra nước ngoài theo hợp đồng trọn gói thu tiền một lần của khách, giá tính thuế GTGT chỉ tính trên phần doanh thu công ty lữ hành được hưởng, được xác định bằng: [Tổng giá thanh toán trọn gói thu của khách hàng] trừ (-) [Toàn bộ các khoản chi phí thực tế phát sinh tại nước ngoài do các nhà cung cấp dịch vụ ở nước ngoài thực hiện].\n- Các chi phí được trừ ở nước ngoài bao gồm: Tiền vé máy bay quốc tế khứ hồi, tiền thuê khách sạn lưu trú, tiền ăn uống, vé tham quan danh lam thắng cảnh, tiền xe vận chuyển tại nước ngoài, tiền bảo hiểm du lịch quốc tế, chi phí đối tác land tour nước ngoài.\n- Doanh nghiệp cần lưu giữ hợp đồng với đối tác nước ngoài, hóa đơn/chứng từ hợp pháp và chứng từ thanh toán ngân hàng quốc tế để làm căn cứ trừ hợp lệ.'
        },
        {
          heading: '3. Quy định thanh toán không dùng tiền mặt (Ngưỡng 5 triệu đồng)',
          text: 'Lưu ý đặc biệt: Theo quy định mới nhất, ngưỡng thanh toán bắt buộc không dùng tiền mặt (chuyển khoản qua ngân hàng từ tài khoản công ty đến tài khoản nhà cung cấp) đã được hạ từ 20 triệu đồng xuống còn 5.000.000 đồng đối với cả điều kiện khấu trừ thuế GTGT đầu vào và điều kiện tính chi phí hợp lý được trừ TNDN. Các hóa đơn từng lần từ 5.000.000 đồng trở lên thanh toán bằng tiền mặt sẽ bị loại thuế GTGT và bị loại khỏi chi phí hợp lý.'
        }
      ]
    },
    {
      id: 'cit-expenses',
      category: 'Thuế TNDN',
      title: 'Hồ Sơ Chứng Từ Chi Phí Hợp Lý Được Trừ Của Công Ty Du Lịch',
      summary: 'Quy chuẩn hồ sơ vé máy bay, phòng khách sạn, tiếp khách, thuê hướng dẫn viên freelance và hoa hồng chi trả đại lý.',
      content: [
        {
          heading: '1. Thuế suất Thuế Thu Nhập Doanh Nghiệp (TNDN)',
          text: 'Thuế suất TNDN phổ thông là 20%. Theo Luật 67/2025/QH15 và Nghị định 320/2025/NĐ-CP, áp dụng mức thuế suất ưu đãi 15% đối với doanh nghiệp có tổng doanh thu năm không quá 3 tỷ đồng; và mức 17% đối với doanh nghiệp có doanh thu từ trên 3 tỷ đến 50 tỷ đồng.'
        },
        {
          heading: '2. Chứng từ vé máy bay hành khách đoàn',
          text: 'Để chi phí vé máy bay được tính vào chi phí hợp lý khi tính thuế TNDN, công ty lữ hành cần lưu trữ đầy đủ:\n- Hóa đơn điện tử hoặc vé máy bay điện tử (e-ticket) có ghi đầy đủ mã đặt chỗ, tên hành khách.\n- Danh sách hành khách đoàn đi tour khớp với vé máy bay.\n- Chứng từ thanh toán ngân hàng không dùng tiền mặt (ủy nhiệm chi hoặc sao kê tài khoản công ty chuyển tiền cho hãng bay/đại lý vé).\n- Thẻ lên máy bay (Boarding pass) hoặc biên bản xác nhận hoàn thành chuyến bay của hãng hàng không.'
        },
        {
          heading: '3. Chi phí thuê Hướng dẫn viên (Tour Guide) và CTV bán tour',
          text: 'Đối với hướng dẫn viên ngoài (freelance) hoặc CTV bán tour không có hợp đồng lao động dài hạn:\n- Ký Hợp đồng dịch vụ hoặc Hợp đồng cộng tác viên ghi rõ nội dung công việc và định mức thù lao/hoa hồng.\n- Biên bản nghiệm thu công việc / Báo cáo kết thúc đoàn tour.\n- Chứng từ chi tiền chuyển khoản ngân hàng.\n- Khấu trừ 10% thuế TNCN tại nguồn đối với từng lần chi trả từ 2.000.000 đồng trở lên (hoặc lưu trữ Bản cam kết 08/CK-TNCN nếu cá nhân đủ điều kiện).\n- Cấp chứng từ khấu trừ thuế TNCN điện tử cho HDV/CTV khi họ yêu cầu để phục vụ quyết toán thuế cuối năm.'
        },
        {
          heading: '4. Chi phí tiếp khách, quà tặng khách hàng và công tác phí',
          text: '- Chi phí tiếp khách: Cần có hóa đơn GTGT hợp pháp, phiếu thanh toán kèm bảng kê chi tiết món ăn/đồ uống, giấy đề xuất tiếp khách hoặc kế hoạch làm việc với đối tác du lịch.\n- Chi phí quà tặng tour cho khách hàng: Doanh nghiệp phải lập hóa đơn GTGT đầu ra khi tặng quà cho khách hàng (dù giá trị 0 đồng) và hạch toán vào chi phí bán hàng hợp lý.'
        }
      ]
    },
    {
      id: 'pit-ctv',
      category: 'Thuế TNCN',
      title: 'Chính Sách Khấu Trừ Thuế TNCN Đối Với Hoa Hồng Đại Lý & CTV Ngoài',
      summary: 'Quy định khấu trừ 10%, điều kiện áp dụng bản cam kết mẫu 08/CK-TNCN và mức giảm trừ gia cảnh mới.',
      content: [
        {
          heading: '1. Khấu trừ 10% tại nguồn',
          text: 'Căn cứ Điều 25 Thông tư 111/2013/TT-BTC:\n- Các tổ chức, doanh nghiệp trả tiền hoa hồng, tiền công, tiền thù lao cho cá nhân cư trú không ký hợp đồng lao động hoặc ký hợp đồng lao động dưới 03 tháng có tổng mức chi trả thu nhập từ 2.000.000 đồng/lần trở lên thì phải khấu trừ thuế theo mức 10% trên tổng thu nhập trước khi chi trả cho cá nhân.\n- Từ ngày 01/07/2026 (theo Nghị định 253/2026/NĐ-CP), ngưỡng bắt đầu khấu trừ thuế đối với thu nhập vãng lai được điều chỉnh nâng lên từ 5.000.000 đồng/lần.'
        },
        {
          heading: '2. Bản cam kết mẫu 08/CK-TNCN (trước đây là 02/CK-TNCN)',
          text: 'Điều kiện để cá nhân được làm cam kết tạm không bị khấu trừ 10%:\n- Cá nhân chỉ có duy nhất thu nhập thuộc đối tượng phải khấu trừ thuế theo tỷ lệ nêu trên.\n- Ước tính tổng mức thu nhập chịu thuế của cá nhân sau khi trừ gia cảnh chưa đến mức phải nộp thuế trong cả năm tài chính.\n- Cá nhân phải đăng ký thuế và đã có mã số thuế cá nhân tại thời điểm cam kết.\n- Doanh nghiệp lưu giữ bản cam kết này để làm căn cứ không khấu trừ thuế và quyết toán thay.'
        },
        {
          heading: '3. Mức giảm trừ gia cảnh mới (Áp dụng từ kỳ tính thuế 2026)',
          text: '- Mức giảm trừ cho bản thân người nộp thuế: 15.500.000 đồng/tháng (186 triệu đồng/năm).\n- Mức giảm trừ cho mỗi người phụ thuộc: 6.200.000 đồng/tháng (74,4 triệu đồng/năm).\n- (Kỳ tính thuế 2025 vẫn áp dụng mức cũ: Bản thân 11.000.000 đồng/tháng và người phụ thuộc 4.400.000 đồng/tháng).'
        }
      ]
    },
    {
      id: 'fct-ads',
      category: 'Thuế Nhà Thầu',
      title: 'Nghĩa Vụ Thuế Khi Chạy Quảng Cáo Facebook (Meta Ads) & Google Ads',
      summary: 'Cách xử lý hóa đơn receipt từ Meta, kê khai thuế nhà thầu và điều kiện để được trừ chi phí quảng cáo tour.',
      content: [
        {
          heading: '1. Meta & Google đã đăng ký thuế trực tiếp tại Việt Nam',
          text: 'Hiện nay, Meta Platforms (Facebook, Instagram) và Google Asia Pacific đã đăng ký mã số thuế nhà thầu tại Việt Nam (thông qua Cổng thông tin điện tử dành cho Nhà cung cấp nước ngoài của Tổng cục Thuế).\n- Khi doanh nghiệp hoặc nhân viên thiết lập tài khoản quảng cáo và nhập Mã số thuế (MST) của công ty, Meta sẽ tự động tính và thu thêm 5% thuế GTGT trên từng hóa đơn quảng cáo (Receipt) trừ qua thẻ thanh toán quốc tế.'
        },
        {
          heading: '2. Điều kiện để chi phí quảng cáo được tính vào chi phí hợp lý TNDN',
          text: 'Để cơ quan thuế chấp thuận chi phí quảng cáo Meta/Google làm chi phí hợp lý được trừ:\n- 1. Tài khoản quảng cáo phải khai báo đúng tên công ty, địa chỉ và Mã số thuế của doanh nghiệp.\n- 2. Hóa đơn điện tử / Phiếu thu (Receipt) tải về từ trình quản lý quảng cáo có đầy đủ thông tin mã số thuế và tên công ty.\n- 3. Thanh toán bằng thẻ tín dụng / thẻ ghi nợ của công ty (mang tên công ty). Nếu thanh toán bằng thẻ cá nhân của giám đốc/nhân sự: Công ty phải có quy chế tài chính ủy quyền chi hộ và thực hiện hoàn ứng chuyển khoản qua ngân hàng cho cá nhân đó.'
        }
      ]
    }
  ];

  // Calendar Deadlines
  const taxDeadlines = [
    {
      date: 'Ngày 20 hàng tháng',
      title: 'Tờ khai thuế GTGT & TNCN (Kê khai theo tháng)',
      desc: 'Áp dụng cho doanh nghiệp có tổng doanh thu năm trước liền kề trên 50 tỷ đồng.',
      badge: 'Hàng tháng',
      badgeColor: 'bg-blue-100 text-blue-700'
    },
    {
      date: 'Ngày cuối cùng tháng đầu quý sau (30/04, 31/07, 31/10, 31/01)',
      title: 'Nộp tờ khai thuế GTGT & TNCN Quý',
      desc: 'Áp dụng cho doanh nghiệp kê khai theo quý (doanh thu năm trước từ 50 tỷ đồng trở xuống). Hạn nộp tờ khai và tiền thuế trùng nhau.',
      badge: 'Hàng quý',
      badgeColor: 'bg-emerald-100 text-emerald-700'
    },
    {
      date: 'Ngày 30 của tháng đầu quý sau (30/04, 30/07, 30/10, 30/01)',
      title: 'Tạm nộp thuế Thu nhập doanh nghiệp (TNDN) Quý',
      desc: 'Doanh nghiệp tự tính và tạm nộp tiền thuế TNDN phát sinh của quý. Tổng số thuế TNDN tạm nộp 4 quý phải đạt tối thiểu 80% số thuế TNDN phải nộp cả năm.',
      badge: 'TNDN Quý',
      badgeColor: 'bg-amber-100 text-amber-700'
    },
    {
      date: 'Ngày 31/03 năm sau',
      title: 'Hồ sơ Quyết toán Thuế TNDN & Thuế TNCN của Công ty',
      desc: 'Hạn chót nộp Báo cáo tài chính, Tờ khai quyết toán thuế TNDN (Mẫu 03/TNDN) và Tờ khai quyết toán thuế TNCN (Mẫu 05/QTT-TNCN) cho kỳ tính thuế năm trước.',
      badge: 'Quyết toán năm',
      badgeColor: 'bg-rose-100 text-rose-700'
    },
    {
      date: 'Ngày 30/04 năm sau',
      title: 'Quyết toán thuế TNCN trực tiếp của Cá nhân',
      desc: 'Dành cho cá nhân nhân viên, CTV có thu nhập từ 2 nơi trở lên tự đi quyết toán trực tiếp với cơ quan thuế.',
      badge: 'Cá nhân',
      badgeColor: 'bg-purple-100 text-purple-700'
    }
  ];

  // Filter articles based on search
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return handbookArticles;
    const query = searchQuery.toLowerCase().trim();
    return handbookArticles.filter(art => 
      art.title.toLowerCase().includes(query) ||
      art.category.toLowerCase().includes(query) ||
      art.summary.toLowerCase().includes(query) ||
      art.content.some(c => c.heading.toLowerCase().includes(query) || c.text.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-950 text-white p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-blue-500/30 text-blue-200 text-xs font-bold rounded-full border border-blue-400/30 flex items-center gap-1.5 backdrop-blur-xs">
                <Scale className="w-3.5 h-3.5 text-blue-300" />
                <span>Quy chuẩn Thuế Du Lịch 2025 – 2026</span>
              </span>
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-full border border-emerald-400/30">
                VAT 8% đến hết 2026
              </span>
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-full border border-amber-400/30">
                Thanh toán không tiền mặt ≥ 5 triệu
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Sổ Tay Thuế &amp; Công Cụ Tính Nhanh Kế Toán
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              Hệ thống tra cứu quy chuẩn pháp lý thuế GTGT tour lữ hành, chi phí hợp lý TNDN, khấu trừ 10% hoa hồng CTV và công cụ bóc tách số liệu tự động dành cho nhân sự AD Luxury Travel.
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCheckMcpUpdate(true)}
                disabled={isCheckingUpdate}
                className="flex items-center gap-2 px-3.5 py-2 bg-blue-500/30 hover:bg-blue-500/40 active:scale-95 text-white text-xs font-bold rounded-xl border border-blue-400/40 transition-all cursor-pointer backdrop-blur-md shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 text-blue-200", isCheckingUpdate && "animate-spin")} />
                <span>{isCheckingUpdate ? "Đang đồng bộ..." : "Kiểm tra cập nhật MCP"}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[11px] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>MCP Skill: <strong className="text-white font-semibold">{mcpStatus.version}</strong> ({mcpStatus.date})</span>
              <span className="text-slate-400">· {lastCheckedTime}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('calculators')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
            activeTab === 'calculators'
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          )}
        >
          <Calculator className="w-4 h-4" />
          <span>Bộ công cụ tính thuế nhanh</span>
        </button>

        <button
          onClick={() => setActiveTab('handbook')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
            activeTab === 'handbook'
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          )}
        >
          <FileText className="w-4 h-4" />
          <span>Cẩm nang quy chuẩn thuế du lịch</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
            activeTab === 'calendar'
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          )}
        >
          <Calendar className="w-4 h-4" />
          <span>Lịch nộp tờ khai &amp; nộp thuế</span>
        </button>
      </div>

      {/* TAB 1: CALCULATORS */}
      {activeTab === 'calculators' && (
        <div className="space-y-6">
          {/* CALCULATOR 1: VAT TOUR DU LỊCH */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  1. Tính Thuế GTGT (VAT) Tour Du Lịch Lữ Hành
                </h2>
                <p className="text-xs text-slate-500">
                  Hỗ trợ tính VAT cho tour Outbound (trừ chi phí nước ngoài) hoặc tour Nội địa / Inbound.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Input */}
              <div className="lg:col-span-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Loại hình tour
                    </label>
                    <select
                      value={vatTourType}
                      onChange={(e) => setVatTourType(e.target.value as any)}
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="outbound">Tour Outbound (Đi nước ngoài)</option>
                      <option value="inbound_domestic">Tour Nội địa / Inbound</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kiểu giá nhập
                    </label>
                    <select
                      value={vatCalcMode}
                      onChange={(e) => setVatCalcMode(e.target.value as any)}
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="gross_included">Giá đã gồm VAT (Bóc tách)</option>
                      <option value="net_excluded">Giá chưa gồm VAT (Cộng thêm)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {vatCalcMode === 'gross_included' ? 'Tổng tiền thu của khách (Đã gồm VAT)' : 'Giá tour trước thuế (Chưa VAT)'} (VNĐ)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={vatPriceInput}
                      onChange={(e) => setVatPriceInput(formatCurrency(parseCurrency(e.target.value)))}
                      className="w-full text-sm font-bold px-3 py-2 pl-8 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>

                {vatTourType === 'outbound' && (
                  <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 space-y-1.5">
                    <label className="block text-xs font-bold text-blue-900">
                      Chi phí thực tế phát sinh ở nước ngoài được trừ (VNĐ)
                    </label>
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                      Bao gồm: vé máy bay quốc tế, khách sạn lưu trú, ăn uống, xe đưa đón và vé tham quan tại nước ngoài có chứng từ hợp pháp.
                    </p>
                    <div className="relative mt-2">
                      <input
                        type="text"
                        value={vatOutboundDeductionInput}
                        onChange={(e) => setVatOutboundDeductionInput(formatCurrency(parseCurrency(e.target.value)))}
                        className="w-full text-sm font-bold px-3 py-2 pl-8 border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                      <Plane className="w-4 h-4 text-blue-500 absolute left-2.5 top-2.5" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Thuế suất áp dụng
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { rate: 8, label: '8% (Ưu đãi du lịch)' },
                      { rate: 10, label: '10% (Phổ thông)' },
                      { rate: 0, label: '0% (Miễn thuế)' },
                    ].map((item) => (
                      <button
                        key={item.rate}
                        type="button"
                        onClick={() => setVatRate(item.rate)}
                        className={cn(
                          "py-2 px-2 text-xs font-bold rounded-lg border transition-all cursor-pointer text-center",
                          vatRate === item.rate
                            ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Result Summary */}
              <div className="lg:col-span-6 bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Kết quả bóc tách hóa đơn VAT
                  </div>

                  <div className="space-y-2 text-xs divide-y divide-slate-200/60 font-medium">
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-slate-600">Tổng tiền thanh toán của khách:</span>
                      <span className="text-slate-900 font-bold">{formatCurrency(vatResult.totalPrice)} đ</span>
                    </div>

                    {vatTourType === 'outbound' && (
                      <div className="flex justify-between items-center pt-1.5 text-blue-700">
                        <span>Chi phí nước ngoài được trừ:</span>
                        <span className="font-semibold">- {formatCurrency(vatResult.foreignCost)} đ</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-slate-600">Doanh thu tính thuế GTGT ({vatRate}%):</span>
                      <span className="text-slate-900 font-bold">{formatCurrency(vatResult.taxableBase)} đ</span>
                    </div>

                    <div className="flex justify-between items-center pt-1.5 text-rose-600">
                      <span className="font-bold">Tiền thuế GTGT (VAT phải nộp):</span>
                      <span className="font-bold text-sm">{formatCurrency(vatResult.taxAmount)} đ</span>
                    </div>

                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-slate-600">Doanh thu thuần của tour (sau thuế):</span>
                      <span className="text-slate-900 font-semibold">{formatCurrency(vatResult.netPrice)} đ</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200">
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-[11px] text-emerald-800 leading-relaxed">
                    <div className="font-bold mb-0.5">📌 Lưu ý xuất hóa đơn:</div>
                    Trên hóa đơn điện tử, dòng tiền thuế ghi rõ: <span className="font-bold">{formatCurrency(vatResult.taxAmount)} đ</span>. 
                    {vatTourType === 'outbound' && ' Đính kèm bảng kê chi tiết các khoản chi phí vé máy bay và dịch vụ nước ngoài được trừ theo Điều 7 Thông tư 219.'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CALCULATOR 2: TNCN & HOA HỒNG CTV */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    2. Tính Thuế TNCN &amp; Hoa Hồng Chi Trả CTV
                  </h2>
                  <p className="text-xs text-slate-500">
                    Khấu trừ 10% tại nguồn cho CTV ngoài hoặc tính biểu thuế lũy tiến lương nhân sự.
                  </p>
                </div>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTncnMode('ctv')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer",
                    tncnMode === 'ctv' ? "bg-white text-purple-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Hoa hồng CTV ngoài
                </button>
                <button
                  type="button"
                  onClick={() => setTncnMode('salary')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer",
                    tncnMode === 'salary' ? "bg-white text-purple-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Lương nhân sự công ty
                </button>
              </div>
            </div>

            {tncnMode === 'ctv' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tổng tiền hoa hồng chi trả CTV (VNĐ)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={ctvCommissionInput}
                        onChange={(e) => setCtvCommissionInput(formatCurrency(parseCurrency(e.target.value)))}
                        className="w-full text-sm font-bold px-3 py-2 pl-8 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="0"
                      />
                      <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Ngưỡng khấu trừ
                      </label>
                      <select
                        value={ctvThresholdOption}
                        onChange={(e) => setCtvThresholdOption(e.target.value as any)}
                        className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="current_2m">Từ 2.000.000 đ/lần</option>
                        <option value="new_5m">Từ 5.000.000 đ/lần (từ 01/07/2026)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-2 p-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={hasCommitment08}
                          onChange={(e) => setHasCommitment08(e.target.checked)}
                          className="w-4 h-4 text-purple-600 rounded"
                        />
                        <span className="text-xs font-bold text-slate-700">Có Cam kết 08/CK-TNCN</span>
                      </label>
                    </div>
                  </div>

                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 text-xs text-purple-900 leading-relaxed font-medium">
                    {ctvResult.note}
                  </div>
                </div>

                <div className="lg:col-span-6 bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Bảng tính chi trả CTV
                    </div>

                    <div className="space-y-2 text-xs divide-y divide-slate-200/60 font-medium">
                      <div className="flex justify-between items-center pt-1.5">
                        <span className="text-slate-600">Hoa hồng phê duyệt (Gross):</span>
                        <span className="text-slate-900 font-bold">{formatCurrency(ctvResult.grossCommission)} đ</span>
                      </div>

                      <div className="flex justify-between items-center pt-1.5 text-rose-600">
                        <span className="font-bold">Thuế TNCN khấu trừ 10%:</span>
                        <span className="font-bold text-sm">- {formatCurrency(ctvResult.taxDeduction)} đ</span>
                      </div>

                      <div className="flex justify-between items-center pt-1.5 text-emerald-700 bg-emerald-50/70 p-2 rounded-lg">
                        <span className="font-bold">Thực chuyển khoản cho CTV:</span>
                        <span className="font-black text-base">{formatCurrency(ctvResult.netPayment)} đ</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                    💡 Doanh nghiệp có trách nhiệm nộp khoản thuế 10% này vào ngân sách nhà nước theo tờ khai quý và cấp chứng từ khấu trừ thuế điện tử cho CTV khi có yêu cầu.
                  </div>
                </div>
              </div>
            ) : (
              /* Salary Calculator */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Kỳ tính thuế
                      </label>
                      <select
                        value={salaryTaxYear}
                        onChange={(e) => setSalaryTaxYear(e.target.value as any)}
                        className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="2026">Kỳ 2026 (Giảm trừ 15,5tr / 6,2tr - Biểu 5 bậc)</option>
                        <option value="2025">Kỳ 2025 (Giảm trừ 11tr / 4,4tr - Biểu 7 bậc)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Số người phụ thuộc
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={dependentsCount}
                        onChange={(e) => setDependentsCount(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full text-xs font-bold px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tổng thu nhập Gross (Lương + Phụ cấp + Thưởng) (VNĐ)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={salaryGrossInput}
                        onChange={(e) => setSalaryGrossInput(formatCurrency(parseCurrency(e.target.value)))}
                        className="w-full text-sm font-bold px-3 py-2 pl-8 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="0"
                      />
                      <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Trừ bảo hiểm bắt buộc (10.5%):</span>
                      <span className="font-bold text-slate-800">{formatCurrency(salaryResult.insuranceAmount)} đ</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Giảm trừ bản thân:</span>
                      <span className="font-bold text-slate-800">{formatCurrency(salaryResult.personalRelief)} đ</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Giảm trừ người phụ thuộc:</span>
                      <span className="font-bold text-slate-800">{formatCurrency(salaryResult.dependentRelief)} đ</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6 bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Bảng tổng hợp tiền lương Net &amp; Thuế
                    </div>

                    <div className="space-y-2 text-xs divide-y divide-slate-200/60 font-medium">
                      <div className="flex justify-between items-center pt-1.5">
                        <span className="text-slate-600">Thu nhập chịu thuế (sau giảm trừ):</span>
                        <span className="text-slate-900 font-bold">{formatCurrency(salaryResult.taxableIncome)} đ</span>
                      </div>

                      <div className="flex justify-between items-center pt-1.5 text-rose-600">
                        <span className="font-bold">Thuế TNCN phải nộp:</span>
                        <span className="font-bold text-sm">{formatCurrency(salaryResult.taxAmount)} đ</span>
                      </div>

                      <div className="flex justify-between items-center pt-1.5 text-emerald-700 bg-emerald-50/70 p-2 rounded-lg">
                        <span className="font-bold">Lương thực nhận (Net):</span>
                        <span className="font-black text-base">{formatCurrency(salaryResult.netSalary)} đ</span>
                      </div>
                    </div>

                    {salaryResult.brackets.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-200 space-y-1">
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Chi tiết theo từng bậc:</div>
                        {salaryResult.brackets.map((b, idx) => (
                          <div key={idx} className="flex justify-between text-[11px] text-slate-600">
                            <span>{b.label}:</span>
                            <span className="font-semibold">{formatCurrency(b.amount)} đ</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CALCULATOR 3: THUẾ NHÀ THẦU ADS */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  3. Tính Thuế Nhà Thầu (FCT) Chạy Quảng Cáo Facebook &amp; Google
                </h2>
                <p className="text-xs text-slate-500">
                  Xác định chi phí hợp lý được trừ TNDN và nghĩa vụ thuế khi chi tiền quảng cáo tour.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hình thức thanh toán quảng cáo
                  </label>
                  <select
                    value={fctType}
                    onChange={(e) => setFctType(e.target.value as any)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="meta_collected">Meta/Google thu trực tiếp 5% thuế trên hóa đơn thẻ</option>
                    <option value="company_withheld">Doanh nghiệp tự kê khai nộp thay (5% GTGT + 5% TNDN)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngân sách chạy quảng cáo (VNĐ)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={fctExpenseInput}
                      onChange={(e) => setFctExpenseInput(formatCurrency(parseCurrency(e.target.value)))}
                      className="w-full text-sm font-bold px-3 py-2 pl-8 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="0"
                    />
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>

                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 text-xs text-amber-900 leading-relaxed font-medium">
                  {fctResult.explanation}
                </div>
              </div>

              <div className="lg:col-span-6 bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Hạch toán chi phí hợp lệ
                  </div>

                  <div className="space-y-2 text-xs divide-y divide-slate-200/60 font-medium">
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-slate-600">Ngân sách quảng cáo thực tế:</span>
                      <span className="text-slate-900 font-bold">{formatCurrency(fctResult.adsBudget)} đ</span>
                    </div>

                    <div className="flex justify-between items-center pt-1.5 text-amber-700">
                      <span>Thuế GTGT nhà thầu (5%):</span>
                      <span className="font-semibold">{formatCurrency(fctResult.fctVat)} đ</span>
                    </div>

                    {fctResult.fctCit > 0 && (
                      <div className="flex justify-between items-center pt-1.5 text-amber-700">
                        <span>Thuế TNDN nhà thầu (5%):</span>
                        <span className="font-semibold">{formatCurrency(fctResult.fctCit)} đ</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-1.5 text-emerald-700 bg-emerald-50/70 p-2 rounded-lg">
                      <span className="font-bold">Tổng chi phí được trừ khi tính thuế TNDN:</span>
                      <span className="font-black text-base">{formatCurrency(fctResult.deductibleExpense)} đ</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                  📑 Điều kiện bắt buộc: Cần in Receipt từ Ads Manager có ghi MST công ty và kẹp cùng Sao kê ngân hàng thanh toán của công ty.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HANDBOOK ARTICLES */}
      {activeTab === 'handbook' && (
        <div className="space-y-6">
          {/* Search Box */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm quy định thuế: vé máy bay, hóa đơn 5 triệu, 8%, hoa hồng, giảm trừ gia cảnh, Facebook ads..."
              className="w-full text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
              >
                Xóa
              </button>
            )}
          </div>

          {/* Articles List */}
          <div className="space-y-6">
            {filteredArticles.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">
                Không tìm thấy quy định nào khớp với từ khóa "{searchQuery}".
              </div>
            ) : (
              filteredArticles.map((article) => (
                <div key={article.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-md">
                      {article.category}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">Quy chuẩn áp dụng 2025 - 2026</span>
                  </div>

                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {article.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      {article.summary}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    {article.content.map((sec, idx) => (
                      <div key={idx} className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1">
                        <div className="text-xs font-bold text-slate-800">
                          {sec.heading}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line font-medium">
                          {sec.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TAX DEADLINES CALENDAR */}
      {activeTab === 'calendar' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Lịch Tuân Thủ Nộp Tờ Khai &amp; Nộp Thuế Năm 2025 – 2026
              </h2>
              <p className="text-xs text-slate-500">
                Nhắc nhở thời hạn nộp tờ khai và thuế hàng tháng, hàng quý và quyết toán năm cho kế toán.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {taxDeadlines.map((item, idx) => (
              <div key={idx} className="p-4 bg-slate-50 hover:bg-blue-50/40 rounded-xl border border-slate-200 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider", item.badgeColor)}>
                      {item.badge}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{item.title}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {item.desc}
                  </p>
                </div>

                <div className="sm:text-right shrink-0">
                  <div className="text-[11px] text-slate-400 font-medium">Hạn chót:</div>
                  <div className="text-xs font-bold text-rose-600">{item.date}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Chế tài xử phạt chậm nộp tờ khai và chậm nộp thuế:</span>
            </div>
            <div>
              - Tiền chậm nộp thuế: Tính 0,03%/ngày trên số tiền thuế chậm nộp.
            </div>
            <div>
              - Phạt nộp chậm tờ khai: Từ 2.000.000đ đến 25.000.000đ tùy theo số ngày quá hạn theo Nghị định 125/2020/NĐ-CP.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
