import React, { useState, useMemo } from 'react';
import { Tour, Order, TourCost } from '@/types';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  Plane,
  Building2,
  Users,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Info,
  Briefcase
} from 'lucide-react';

interface NetMarginCardProps {
  orders: Order[];
  tours: Tour[];
  tourCosts: TourCost[];
}

export default function NetMarginCard({ orders, tours, tourCosts }: NetMarginCardProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [selectedTourFilter, setSelectedTourFilter] = useState<string>('all');

  // Compute financial numbers from SURE/PAID orders and tour costs
  const financialSummary = useMemo(() => {
    // Filter confirmed orders
    const confirmedOrders = orders.filter(o => 
      (o.status === 'sure' || o.status === 'paid') &&
      (selectedTourFilter === 'all' || o.tour_id === selectedTourFilter)
    );

    // 1. Gross Revenue (Total Revenue from SURE/PAID orders)
    const grossRevenue = confirmedOrders.reduce((sum, order) => sum + (order.total_price || 0), 0);

    // Filter relevant tours
    const relevantTours = tours.filter(t => selectedTourFilter === 'all' || t.id === selectedTourFilter);

    // 2. Cost Items Breakdown
    let totalFlightCost = 0;
    let totalLandtourCost = 0;
    let totalCommissionCost = 0;
    let totalOtherCosts = 0; // Insurance, Guide, Advertising, Visa, etc.

    relevantTours.forEach(tour => {
      const costData = tourCosts.find(tc => tc.tourId === tour.id);

      if (costData) {
        totalFlightCost += costData.flightAmount || 0;
        
        // Sum landtours
        const landtoursSum = (costData.landtours || []).reduce((acc, l) => acc + (l.amount || 0), 0);
        const partnerPaySum = (costData.partnerPayments || []).reduce((acc, p) => acc + (p.amountToPay || 0), 0);
        totalLandtourCost += Math.max(landtoursSum, partnerPaySum);

        // Commission
        totalCommissionCost += costData.commissionAmount || 0;

        // Other operational costs
        totalOtherCosts += (costData.insuranceAmount || 0) +
                           (costData.tourGuideAmount || 0) +
                           (costData.giftAmount || 0) +
                           (costData.advertisingAmount || 0) +
                           (costData.otherAmount || 0) +
                           (costData.visaAmount || 0);
      } else {
        // Fallback default estimation if tourCost record hasn't been manually populated yet
        const soldSeats = tour.sold_seats || 0;
        const estCommission = (tour.commission || 600000) * soldSeats;
        const estLandtour = Math.round((tour.price || 8000000) * 0.55 * soldSeats);
        const estFlight = Math.round((tour.price || 8000000) * 0.25 * soldSeats);

        totalCommissionCost += estCommission;
        totalLandtourCost += estLandtour;
        totalFlightCost += estFlight;
      }
    });

    // Total Expenses & Commissions
    const totalExpenses = totalFlightCost + totalLandtourCost + totalCommissionCost + totalOtherCosts;

    // 3. ACTUAL RETAINED NET PROFIT
    const netProfit = grossRevenue - totalExpenses;

    // Profit margin percentage
    const profitMargin = grossRevenue > 0 ? ((netProfit / grossRevenue) * 100).toFixed(1) : '0';

    return {
      grossRevenue,
      totalFlightCost,
      totalLandtourCost,
      totalCommissionCost,
      totalOtherCosts,
      totalExpenses,
      netProfit,
      profitMargin,
      confirmedOrdersCount: confirmedOrders.length
    };
  }, [orders, tours, tourCosts, selectedTourFilter]);

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-5 md:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl font-bold flex items-center justify-center border border-indigo-400/20">
              <DollarSign className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                Bảng Tính Lợi Nhuận Thuần Thực Tế
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-black uppercase">
                  Net Margin Strategy
                </span>
              </h3>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Báo cáo tổng hợp Doanh thu gộp, Chi phí vận hành & Lợi nhuận giữ lại thực tế
              </p>
            </div>
          </div>
        </div>

        {/* Filter Tour */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-slate-400">Lọc Tour:</span>
          <select
            value={selectedTourFilter}
            onChange={(e) => setSelectedTourFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 text-white border border-slate-700 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tất cả Tour ({tours.length})</option>
            {tours.map(t => (
              <option key={t.id} value={t.id}>{t.code} - {t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 3 Prominent Large Numbers KPI Display */}
      <div className="p-5 md:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Doanh Thu Gộp */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs space-y-3 relative overflow-hidden group hover:border-blue-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
                1. Doanh Thu Gộp (Revenue)
              </span>
              <span className="p-2 bg-blue-100 text-blue-700 rounded-xl font-bold">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>

            <div>
              <h4 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                {formatVND(financialSummary.grossRevenue)}
              </h4>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Từ <strong className="text-blue-700">{financialSummary.confirmedOrdersCount} đơn chốt SURE/PAID</strong>
              </p>
            </div>
          </div>

          {/* Card 2: Tổng Chi Phí & Hoa Hồng */}
          <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200 shadow-2xs space-y-3 relative overflow-hidden group hover:border-amber-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-amber-800 tracking-wider">
                2. Tổng Chi Phí & Hoa Hồng
              </span>
              <span className="p-2 bg-amber-100 text-amber-700 rounded-xl font-bold">
                <TrendingDown className="w-4 h-4" />
              </span>
            </div>

            <div>
              <h4 className="text-2xl lg:text-3xl font-black text-amber-900 tracking-tight">
                {formatVND(financialSummary.totalExpenses)}
              </h4>
              <p className="text-xs text-amber-700 font-semibold mt-1">
                Gồm vé máy bay, landtour, hoa hồng & vận hành
              </p>
            </div>
          </div>

          {/* Card 3: LỢI NHUẬN THUẦN GIỮ LẠI THỰC TẾ */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md space-y-3 relative overflow-hidden group hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-emerald-100 tracking-wider">
                3. LỢI NHUẬN THUẦN GIỮ LẠI THỰC TẾ
              </span>
              <span className="p-2 bg-white/20 text-white rounded-xl font-bold backdrop-blur-xs">
                <ShieldCheck className="w-5 h-5" />
              </span>
            </div>

            <div>
              <h4 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                {formatVND(financialSummary.netProfit)}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-black bg-white/20 text-white px-2.5 py-0.5 rounded-full">
                  Biên lợi nhuận: {financialSummary.profitMargin}%
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Detailed Cost Line-Item Breakdown Toggle */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full p-4 bg-slate-50 hover:bg-slate-100 text-slate-800 font-black text-xs uppercase flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-600" />
              Chi Tiết Phân Bổ Các Khoản Chi Phí Vận Hành
            </span>
            <span className="flex items-center gap-1 text-indigo-600 font-bold">
              {showBreakdown ? 'Thu gọn' : 'Xem chi tiết'}
              {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>

          {showBreakdown && (
            <div className="p-5 bg-white space-y-4 border-t border-slate-200 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Item 1: Vé Máy Bay */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      <Plane className="w-3.5 h-3.5 text-blue-600" />
                      Vé máy bay
                    </span>
                    <span>{financialSummary.grossRevenue > 0 ? ((financialSummary.totalFlightCost / financialSummary.grossRevenue) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <p className="text-base font-black text-slate-900">
                    {formatVND(financialSummary.totalFlightCost)}
                  </p>
                </div>

                {/* Item 2: Landtour & Đối tác */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-amber-600" />
                      Landtour / Đối tác
                    </span>
                    <span>{financialSummary.grossRevenue > 0 ? ((financialSummary.totalLandtourCost / financialSummary.grossRevenue) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <p className="text-base font-black text-slate-900">
                    {formatVND(financialSummary.totalLandtourCost)}
                  </p>
                </div>

                {/* Item 3: Hoa hồng Đại lý / CTV */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      Hoa hồng Đại lý / CTV
                    </span>
                    <span>{financialSummary.grossRevenue > 0 ? ((financialSummary.totalCommissionCost / financialSummary.grossRevenue) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <p className="text-base font-black text-slate-900">
                    {formatVND(financialSummary.totalCommissionCost)}
                  </p>
                </div>

                {/* Item 4: Vận hành khác (HDV, Bảo hiểm, Visa, Marketing) */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-purple-600" />
                      Chi phí khác
                    </span>
                    <span>{financialSummary.grossRevenue > 0 ? ((financialSummary.totalOtherCosts / financialSummary.grossRevenue) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <p className="text-base font-black text-slate-900">
                    {formatVND(financialSummary.totalOtherCosts)}
                  </p>
                </div>

              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center gap-2 text-xs text-blue-900 font-medium">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Công thức tính: <strong>Lợi Nhuận Thuần = Doanh Thu Gộp - (Chi Phí Vé + Landtour + Hoa Hồng CTV + Vận Hành Khác)</strong>. Số liệu được cập nhật tự động khi Kế toán duyệt chứng từ phiếu thu/chi.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
