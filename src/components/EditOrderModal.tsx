import React, { useState, useEffect } from 'react';
import { X, Bed, DollarSign, FileText, Percent, Info, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { Order } from '../types';
import { useCRM } from '../context/CRMContext';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSave: (orderId: string, updatedData: Partial<Order>) => void;
}

export default function EditOrderModal({
  isOpen,
  onClose,
  order,
  onSave,
}: EditOrderModalProps) {
  const { tours, currentRole } = useCRM();
  
  const [singleRoomCount, setSingleRoomCount] = useState(0);
  const [roomShareInfo, setRoomShareInfo] = useState('');
  const [vatOption, setVatOption] = useState('Không xuất VAT');
  const [specialRequests, setSpecialRequests] = useState('');
  const [totalPrice, setTotalPrice] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Find tour for pricing references
  const tour = order ? tours.find((t) => t.id === order.tour_id) || null : null;

  // Pricing formula definitions
  const priceAdult = tour ? (tour.price_adult ?? tour.price) : 0;
  const priceChild = tour ? (tour.price_child ?? Math.round(tour.price * 0.8)) : 0;
  const priceInfant = tour ? (tour.price_infant ?? Math.round(tour.price * 0.3)) : 0;
  const singleRoomSurcharge = tour ? (tour.single_room_surcharge ?? 7500000) : 7500000;

  const adultCount = order?.adult_count ?? 1;
  const childCount = order?.child_count ?? 0;
  const infantCount = order?.infant_count ?? 0;

  const baseAdultTotal = priceAdult * adultCount;
  const baseChildTotal = priceChild * childCount;
  const baseInfantTotal = priceInfant * infantCount;
  const baseSubtotal = baseAdultTotal + baseChildTotal + baseInfantTotal;
  const surchargeTotal = singleRoomSurcharge * singleRoomCount;
  const subtotalWithSurcharge = baseSubtotal + surchargeTotal;
  const vatAmount = vatOption === 'Xuất VAT' ? Math.round(subtotalWithSurcharge * 0.1) : 0;
  const computedTotalPrice = subtotalWithSurcharge + vatAmount;

  // Format money function
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount);
  };

  useEffect(() => {
    if (isOpen && order) {
      setSingleRoomCount(order.single_room_count || 0);
      setRoomShareInfo(order.room_share_info || '');
      setVatOption(order.vat_option || 'Không xuất VAT');
      setSpecialRequests(order.special_requests || '');
      setTotalPrice(order.total_price || 0);
      setIsInitialLoad(true);
    }
  }, [isOpen, order]);

  // Synchronize computed price when inputs change
  useEffect(() => {
    if (!isOpen || !order) return;

    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }

    const isAdmin = currentRole === 'admin';
    // If not admin, total price is strictly automatic. If admin, we still auto-calculate but they can override.
    if (!isAdmin || !isInitialLoad) {
      setTotalPrice(computedTotalPrice);
    }
  }, [singleRoomCount, vatOption, currentRole]);

  if (!isOpen || !order) return null;

  const isAdmin = currentRole === 'admin';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      onSave(order.id, {
        single_room_count: Number(singleRoomCount),
        room_share_info: roomShareInfo.trim(),
        vat_option: vatOption,
        special_requests: specialRequests.trim(),
        total_price: Number(totalPrice),
      });
      alert('Cập nhật thông tin đơn hàng thành công!');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Đã xảy ra lỗi khi cập nhật đơn hàng.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-100 font-sans">
        
        {/* Modal Header */}
        <div className="bg-slate-50 border-b border-slate-150 px-6 py-4 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-base font-black text-slate-800 flex items-center gap-1.5">
              <span>Chỉnh sửa thông tin đơn hàng #{order.id.substring(0, 8)}</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">
              Cập nhật phụ thu phòng đơn, VAT, ghi chú hoặc điều chỉnh tổng tiền
            </p>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Surcharge & VAT Block */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Số phòng đơn (Surcharge)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Bed className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  min="0"
                  value={singleRoomCount}
                  onChange={(e) => setSingleRoomCount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="pl-9 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                />
              </div>
              <p className="text-[10px] text-blue-600 font-medium">
                Đơn giá phụ thu: <span className="font-bold">{formatCurrency(singleRoomSurcharge)} đ</span> / phòng
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Hoá đơn VAT (10%)
              </label>
              <select
                value={vatOption}
                onChange={(e) => setVatOption(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold bg-white"
              >
                <option value="Không xuất VAT">Không xuất VAT</option>
                <option value="Xuất VAT">Xuất VAT (10%)</option>
              </select>
              {vatOption === 'Xuất VAT' && (
                <p className="text-[10px] text-emerald-600 font-medium">
                  Hệ thống sẽ tự động cộng thêm 10% thuế VAT
                </p>
              )}
            </div>
          </div>

          {/* Share Room Info */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Yêu cầu ghép giường / ghép phòng
            </label>
            <input
              type="text"
              value={roomShareInfo}
              onChange={(e) => setRoomShareInfo(e.target.value)}
              placeholder="Ví dụ: Ghép chung phòng với chị Hoa đoàn HN, lẻ nam/nữ..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Special notes */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Ghi chú đặc biệt
            </label>
            <textarea
              rows={2}
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="Yêu cầu ăn chay, dị ứng hải sản, em bé cần cũi nằm, ..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Automatic Calculator Breakdown Box */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2.5">
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              Chi tiết giá tạm tính tự động
            </h3>
            
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Người lớn ({adultCount} khách x {formatCurrency(priceAdult)} đ):</span>
                <span className="font-semibold text-slate-800">{formatCurrency(baseAdultTotal)} đ</span>
              </div>
              
              {childCount > 0 && (
                <div className="flex justify-between">
                  <span>Trẻ em ({childCount} khách x {formatCurrency(priceChild)} đ):</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(baseChildTotal)} đ</span>
                </div>
              )}
              
              {infantCount > 0 && (
                <div className="flex justify-between">
                  <span>Trẻ nhỏ ({infantCount} khách x {formatCurrency(priceInfant)} đ):</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(baseInfantTotal)} đ</span>
                </div>
              )}

              {singleRoomCount > 0 && (
                <div className="flex justify-between text-blue-700 font-medium">
                  <span>Phụ thu phòng đơn ({singleRoomCount} phòng x {formatCurrency(singleRoomSurcharge)} đ):</span>
                  <span className="font-bold">{formatCurrency(surchargeTotal)} đ</span>
                </div>
              )}

              {vatOption === 'Xuất VAT' && (
                <div className="flex justify-between text-emerald-700 font-medium border-t border-slate-200/60 pt-1.5">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-emerald-600" />
                    Thuế VAT (10%):
                  </span>
                  <span className="font-bold">+{formatCurrency(vatAmount)} đ</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm font-extrabold text-slate-800 border-t border-slate-200 pt-2 mt-1">
                <span className="text-blue-800">Tổng cộng (Giá tính toán):</span>
                <span className="text-base text-rose-600">{formatCurrency(computedTotalPrice)} đ</span>
              </div>
            </div>
          </div>

          {/* Total Price Box */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Tổng tiền đơn hàng (VND)
              </label>
              
              {isAdmin && totalPrice !== computedTotalPrice && (
                <button
                  type="button"
                  onClick={() => setTotalPrice(computedTotalPrice)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Đặt lại về giá tự động
                </button>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={totalPrice === 0 ? '0' : formatCurrency(totalPrice)}
                disabled={!isAdmin}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\D/g, '');
                  setTotalPrice(rawValue ? parseInt(rawValue, 10) : 0);
                }}
                className={`pl-9 w-full rounded-lg border px-3 py-2.5 text-base font-black focus:outline-none ring-offset-2 transition-all ${
                  isAdmin 
                    ? 'border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-rose-600 bg-white cursor-text' 
                    : 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed font-extrabold'
                }`}
              />
            </div>
            
            {isAdmin ? (
              <p className="text-[10px] text-gray-400 font-medium">
                * Bạn có quyền Quản trị viên (Admin) để điều chỉnh thủ công giá trị này vượt mức tự động của hệ thống.
              </p>
            ) : null}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-150 px-6 py-4 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
        </div>

      </div>
    </div>
  );
}
