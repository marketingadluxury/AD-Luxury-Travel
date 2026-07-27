import React, { useState } from 'react';
import { Tour } from '@/types';
import { useCRM } from '@/context/CRMContext';
import { 
  AlertTriangle, 
  Percent, 
  Calendar, 
  Users, 
  TrendingUp, 
  Flame, 
  DollarSign, 
  Check, 
  ArrowRight,
  Clock,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

interface OccupancyWarningWidgetProps {
  tours: Tour[];
}

export default function OccupancyWarningWidget({ tours }: OccupancyWarningWidgetProps) {
  const { updateTour, logActivity } = useCRM();
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [newCommission, setNewCommission] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(10);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  // Compute tours departing within the next 30 days
  const now = new Date();
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(now.getDate() + 30);

  const lowOccupancyTours = tours.filter(tour => {
    if (!tour.start_date) return false;
    const depDate = new Date(tour.start_date);
    
    // Must depart within 30 days from now (and not already in the past)
    const isDepartingSoon = depDate >= new Date(now.setHours(0,0,0,0)) && depDate <= thirtyDaysLater;
    if (!isDepartingSoon) return false;

    const totalSeats = tour.total_seats || 30;
    const filledSeats = (tour.sold_seats || 0) + (tour.hold_seats || 0);
    const occupancyRate = totalSeats > 0 ? (filledSeats / totalSeats) * 100 : 0;

    // Filter tours with occupancy BELOW 75%
    return occupancyRate < 75;
  }).sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  // Handle Quick Action: Tăng hoa hồng CTV
  const handleOpenCommissionModal = (tour: Tour) => {
    setSelectedTour(tour);
    setNewCommission(tour.commission ? tour.commission + 200000 : 800000);
    setShowCommissionModal(true);
  };

  const handleSaveCommission = async () => {
    if (!selectedTour) return;
    const updated = {
      ...selectedTour,
      commission: Number(newCommission)
    };
    await updateTour(updated);
    await logActivity({
      action: `Cập nhật tăng hoa hồng CTV lên ${newCommission.toLocaleString('vi-VN')}đ`,
      module: 'Tour',
      details: `Tour mã ${selectedTour.code} - ${selectedTour.name}`
    });
    toast.success(`Đã tăng hoa hồng CTV cho Tour ${selectedTour.code} lên ${newCommission.toLocaleString('vi-VN')} VNĐ!`);
    setShowCommissionModal(false);
    setSelectedTour(null);
  };

  // Handle Quick Action: Chạy giảm giá giờ chót
  const handleOpenDiscountModal = (tour: Tour) => {
    setSelectedTour(tour);
    setDiscountPercent(10);
    setShowDiscountModal(true);
  };

  const handleApplyDiscount = async () => {
    if (!selectedTour) return;
    const originalPrice = selectedTour.price || selectedTour.price_adult || 0;
    const discountAmount = Math.round((originalPrice * discountPercent) / 100);
    const newPrice = Math.max(0, originalPrice - discountAmount);

    const updated: Tour = {
      ...selectedTour,
      price: newPrice,
      price_adult: newPrice,
      discount: discountAmount,
      tour_status: 'last_minute',
      seat_status: 'Còn chỗ'
    };

    await updateTour(updated);
    await logActivity({
      action: `Chạy giảm giá giờ chót (-${discountPercent}%) cho Tour ${selectedTour.code}`,
      module: 'Tour',
      details: `Giá gốc: ${originalPrice.toLocaleString('vi-VN')}đ -> Giá mới: ${newPrice.toLocaleString('vi-VN')}đ`
    });

    toast.success(`Đã kích hoạt chế độ GIỜ CHÓT giảm ${discountPercent}% cho Tour ${selectedTour.code}!`);
    setShowDiscountModal(false);
    setSelectedTour(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header Widget */}
      <div className="p-5 md:p-6 bg-gradient-to-r from-red-50/80 via-amber-50/40 to-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-red-100 text-red-700 rounded-xl font-bold flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                Cảnh Báo Lấp Đầy Sát Ngày Bay
                <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-black">
                  {lowOccupancyTours.length} Tour
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Các chuyến bay khởi hành trong 30 ngày tới có tỉ lệ đặt chỗ <strong className="text-red-600">&lt; 75%</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-xl border border-slate-200 shrink-0">
          <Clock className="w-4 h-4 text-amber-500" />
          <span>Thời gian quét: 30 ngày gần nhất</span>
        </div>
      </div>

      {/* Widget Body */}
      <div className="p-5 md:p-6 space-y-4">
        {lowOccupancyTours.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h4 className="text-sm font-extrabold text-slate-800">Tất cả Tour sát ngày bay đều đạt tỉ lệ lấp đầy cao!</h4>
            <p className="text-xs text-slate-500 mt-1">Không có chuyến bay nào khởi hành trong 30 ngày tới có tỉ lệ lấp đầy dưới 75%.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {lowOccupancyTours.map((tour) => {
              const totalSeats = tour.total_seats || 30;
              const soldSeats = tour.sold_seats || 0;
              const holdSeats = tour.hold_seats || 0;
              const filledSeats = soldSeats + holdSeats;
              const occupancyRate = totalSeats > 0 ? Math.round((filledSeats / totalSeats) * 100) : 0;
              const availableSeats = tour.available_seats ?? Math.max(0, totalSeats - filledSeats);
              
              const depDate = new Date(tour.start_date);
              const daysLeft = Math.ceil((depDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

              return (
                <div 
                  key={tour.id} 
                  className="p-5 rounded-2xl border-2 border-red-500 bg-red-50/20 hover:bg-red-50/40 transition-all shadow-2xs space-y-4 relative"
                >
                  {/* Badge Warning */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[11px] font-black bg-red-100 text-red-800 px-2 py-0.5 rounded border border-red-200 uppercase">
                          {tour.code}
                        </span>
                        <span className="text-[11px] font-black text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded flex items-center gap-1 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          Còn {daysLeft} ngày
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 line-clamp-1 uppercase tracking-tight">
                        {tour.name}
                      </h4>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-red-600 block">
                        Lấp đầy {occupancyRate}%
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">
                        Thiếu {availableSeats} chỗ
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>Đã bán: <strong className="text-blue-700">{soldSeats}</strong> • Giữ: <strong className="text-amber-600">{holdSeats}</strong></span>
                      <span>Tổng: <strong className="text-slate-800">{totalSeats} ghế</strong></span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden p-0.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          occupancyRate < 50 ? 'bg-red-600' : 'bg-amber-500'
                        }`}
                        style={{ width: `${occupancyRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Additional Tour Specs */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600 bg-white p-2.5 rounded-xl border border-red-100">
                    <div>
                      <span className="text-slate-400 block font-semibold text-[10px] uppercase">Khởi hành</span>
                      <strong className="text-slate-800 font-extrabold">{tour.start_date}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold text-[10px] uppercase">Hoa hồng CTV hiện tại</span>
                      <strong className="text-emerald-700 font-extrabold">{(tour.commission || 0).toLocaleString('vi-VN')} đ</strong>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="pt-2 border-t border-red-200/80 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenCommissionModal(tour)}
                      className="flex-1 py-2 px-3 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:shadow-xs"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Tăng hoa hồng CTV
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenDiscountModal(tour)}
                      className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:shadow-xs"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      Chạy giảm giá giờ chót
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Tăng Hoa Hồng CTV */}
      {showCommissionModal && selectedTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-5 animate-scaleUp">
            <div className="flex items-center gap-3">
              <span className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase">Tăng Hoa Hồng CTV</h3>
                <p className="text-xs text-slate-500 font-medium">Mã tour: {selectedTour.code}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mức hoa hồng mới cho CTV/Sales (VNĐ):</label>
                <input 
                  type="number"
                  step="50000"
                  value={newCommission}
                  onChange={(e) => setNewCommission(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-600 space-y-1">
                <p>• Hoa hồng hiện tại: <strong>{(selectedTour.commission || 0).toLocaleString('vi-VN')} đ</strong></p>
                <p>• Sau khi lưu, hoa hồng sẽ tự động hiển thị hấp dẫn trên bảng Lịch khởi hành dành cho Đại lý & CTV để kích cầu bán vé.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCommissionModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveCommission}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Xác nhận tăng hoa hồng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chạy Giảm Giá Giờ Chót */}
      {showDiscountModal && selectedTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-5 animate-scaleUp">
            <div className="flex items-center gap-3">
              <span className="p-3 bg-red-100 text-red-700 rounded-xl">
                <Flame className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase">Kích Hoạt Giờ Chót</h3>
                <p className="text-xs text-slate-500 font-medium">Mã tour: {selectedTour.code}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Chọn phần trăm giảm giá (%):</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPercent(pct)}
                      className={`py-2 rounded-xl font-black text-xs border transition-all ${
                        discountPercent === pct 
                          ? 'bg-red-600 text-white border-red-600' 
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      -{pct}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-red-50 rounded-xl text-[11px] text-red-900 space-y-1.5 border border-red-200">
                <p>• Giá niêm yết hiện tại: <strong>{((selectedTour.price || selectedTour.price_adult || 0)).toLocaleString('vi-VN')} đ</strong></p>
                <p>• Giá giảm giờ chót: <strong className="text-red-700 text-sm font-black">{Math.max(0, (selectedTour.price || selectedTour.price_adult || 0) - Math.round(((selectedTour.price || selectedTour.price_adult || 0) * discountPercent)/100)).toLocaleString('vi-VN')} đ</strong></p>
                <p className="text-[10px] text-slate-500">Chế độ Tour sẽ chuyển sang "Giờ chót" (Last Minute) với huy hiệu nổi bật.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscountModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleApplyDiscount}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
              >
                <Flame className="w-4 h-4" />
                Áp dụng Giảm Giá Giờ Chót
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
