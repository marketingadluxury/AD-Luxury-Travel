import { useState } from 'react';
import { useCRM } from '@/context/CRMContext';
import { useAuth } from '@/context/AuthContext';
import OccupancyWarningWidget from '@/components/executive/OccupancyWarningWidget';
import VisaRiskWidget from '@/components/executive/VisaRiskWidget';
import NetMarginCard from '@/components/executive/NetMarginCard';
import AgentConversionTable from '@/components/executive/AgentConversionTable';
import {
  Building2,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ExecutiveDashboard() {
  const { tours, orders, passengers, tourCosts, refreshProfiles } = useCRM();
  const { profile } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshProfiles();
      toast.success('Đã làm mới dữ liệu điều hành chiến lược!');
    } catch (e) {
      toast.error('Có lỗi xảy ra khi làm mới dữ liệu!');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Compute total metrics for executive header bar
  const sureOrdersCount = orders.filter(o => o.status === 'sure' || o.status === 'paid').length;
  const totalRevenueSum = orders
    .filter(o => o.status === 'sure' || o.status === 'paid')
    .reduce((sum, o) => sum + (o.total_price || 0), 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 animate-fadeIn">
      {/* Executive Page Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 md:p-8 rounded-3xl shadow-lg border border-slate-700/80 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-indigo-500/30 text-indigo-300 rounded-full text-xs font-black uppercase tracking-wider border border-indigo-400/30">
                Board of Directors & Sales Director
              </span>
              <span className="text-xs text-slate-400 font-bold">
                Cập nhật: {new Date().toLocaleDateString('vi-VN')}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Building2 className="w-8 h-8 text-indigo-400" />
              Bảng Điều Hành Chiến Lược (Executive Dashboard)
            </h1>

            <p className="text-sm text-slate-300 font-medium max-w-3xl leading-relaxed">
              Trang thông tin quản trị nâng cao dành riêng cho Ban Giám đốc và Giám đốc Kinh doanh. Tập trung theo dõi tỉ lệ lấp đầy sát ngày bay, rủi ro visa, lợi nhuận thuần thực tế và hiệu suất chuyển đổi đại lý.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-2xl flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Làm mới dữ liệu
            </button>
          </div>
        </div>

        {/* Top Executive Stats Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-700/60">
          <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 uppercase block">Tổng Doanh Thu SURE</span>
            <span className="text-lg md:text-xl font-black text-emerald-400 mt-1 block">
              {totalRevenueSum.toLocaleString('vi-VN')} đ
            </span>
          </div>

          <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 uppercase block">Số Đơn Hàng SURE</span>
            <span className="text-lg md:text-xl font-black text-blue-400 mt-1 block">
              {sureOrdersCount} đơn chốt
            </span>
          </div>

          <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 uppercase block">Tổng Số Tour Đang Chạy</span>
            <span className="text-lg md:text-xl font-black text-indigo-300 mt-1 block">
              {tours.length} Tour
            </span>
          </div>

          <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 uppercase block">Vai Trò Đang Xem</span>
            <span className="text-lg md:text-xl font-black text-amber-300 mt-1 block uppercase">
              {profile?.full_name || 'Giám Đốc'}
            </span>
          </div>
        </div>
      </div>

      {/* 4 STRATEGIC WIDGETS SECTION */}

      {/* WIDGET 1: CẢNH BÁO LẤP ĐẦY SÁT NGÀY BAY */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-6 bg-red-600 rounded-full" />
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
            1. Cảnh Báo Lấp Đầy Sát Ngày Bay (Occupancy Warning)
          </h2>
        </div>
        <OccupancyWarningWidget tours={tours} />
      </section>

      {/* WIDGET 2: QUẢN TRỊ RỦI RO HẠN CHÓT VISA */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-6 bg-amber-500 rounded-full" />
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
            2. Quản Trị Rủi Ro Hạn Chót Visa (Visa Expiry Risk)
          </h2>
        </div>
        <VisaRiskWidget tours={tours} orders={orders} passengers={passengers} />
      </section>

      {/* WIDGET 3: BẢNG TÍNH LỢI NHUẬN THUẦN THỰC TẾ */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-6 bg-emerald-600 rounded-full" />
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
            3. Bảng Tính Lợi Nhuận Thuần Thực Tế (Net Profit Margin)
          </h2>
        </div>
        <NetMarginCard orders={orders} tours={tours} tourCosts={tourCosts} />
      </section>

      {/* WIDGET 4: BẢNG HIỆU SUẤT & TỈ LỆ ĐỔI ĐƠN CỦA ĐẠI LÝ */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-6 bg-indigo-600 rounded-full" />
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
            4. Hiệu Suất & Tỉ Lệ Đổi Đơn Đại Lý (Agent Conversion Rate)
          </h2>
        </div>
        <AgentConversionTable orders={orders} />
      </section>
    </div>
  );
}
