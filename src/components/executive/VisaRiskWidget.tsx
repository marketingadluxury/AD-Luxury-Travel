import React, { useState } from 'react';
import { Tour, Order, Passenger } from '@/types';
import { useCRM } from '@/context/CRMContext';
import {
  Bell,
  CheckCircle,
  User,
  Phone,
  Calendar,
  ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';

interface VisaRiskWidgetProps {
  tours: Tour[];
  orders: Order[];
  passengers: Passenger[];
}

export default function VisaRiskWidget({ tours, orders, passengers }: VisaRiskWidgetProps) {
  const { logActivity, profilesList } = useCRM();
  const [remindedList, setRemindedList] = useState<string[]>([]);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Find all visa risk passenger items
  const riskItems = React.useMemo(() => {
    const items: Array<{
      passenger: Passenger;
      order: Order;
      tour: Tour;
      visaDeadlineDate: Date;
      daysRemaining: number;
      salespersonName: string;
    }> = [];

    // Filter confirmed orders
    const sureOrders = orders.filter(o => o.status === 'sure' || o.status === 'paid');

    sureOrders.forEach(order => {
      const tour = tours.find(t => t.id === order.tour_id);
      if (!tour) return;

      // Visa deadline date string
      const visaDeadlineStr = tour.visa_deadline || order.created_at;
      if (!visaDeadlineStr) return;

      const deadlineDate = new Date(visaDeadlineStr);
      deadlineDate.setHours(23, 59, 59, 999);

      // Remaining days count
      const diffTime = deadlineDate.getTime() - new Date().getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Filter if deadline is within 5 days or past deadline but not processed
      if (daysRemaining <= 5) {
        // Find passengers in this order
        const orderPassengers = passengers.filter(p => p.order_id === order.id);

        orderPassengers.forEach(p => {
          // Check if passenger status is pending/processing ('pending', 'processing', 'CHỜ TIẾP NHẬN', 'CHỜ NỘP HỒ SƠ')
          const isPendingVisa = p.visa_status === 'pending' || 
                                p.visa_status === 'processing' || 
                                p.needs_visa_service === true;

          if (isPendingVisa) {
            // Find salesperson name
            const salesProfile = profilesList.find(pr => pr.id === order.user_id);
            const salesName = salesProfile?.full_name || order.created_by || 'Sales phụ trách';

            items.push({
              passenger: p,
              order,
              tour,
              visaDeadlineDate: deadlineDate,
              daysRemaining,
              salespersonName: salesName
            });
          }
        });
      }
    });

    return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [orders, tours, passengers, profilesList]);

  // Handle Quick Action: Nhắc nhở Sales phụ trách
  const handleRemindSales = async (itemKey: string, salesName: string, passengerName: string, tourCode: string) => {
    await logActivity({
      action: `Gửi nhắc nhở khẩn cấp tiến độ Visa tới ${salesName}`,
      module: 'Visa',
      details: `Hành khách: ${passengerName} - Tour: ${tourCode}`
    });

    setRemindedList(prev => [...prev, itemKey]);
    toast.success(`Đã gửi thông báo nhắc nhở tới Sales phụ trách (${salesName})!`, {
      icon: '🔔'
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Widget Header */}
      <div className="p-5 md:p-6 bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-100 text-amber-800 rounded-xl font-bold flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                Quản Trị Rủi Ro Hạn Chót Visa
                <span className="px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-[11px] font-black">
                  {riskItems.length} Hồ sơ
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Các đơn chốt <strong className="text-slate-800">SURE</strong> có hạn nộp Visa còn <strong className="text-amber-700">&lt; 5 ngày</strong> nhưng hồ sơ chưa hoàn tất
              </p>
            </div>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-500 bg-white/80 px-3 py-1.5 rounded-xl border border-slate-200 shrink-0">
          Chỉ số rủi ro: <strong className={riskItems.length > 0 ? "text-amber-600 font-black" : "text-emerald-600 font-black"}>
            {riskItems.length > 0 ? 'Cần xử lý ngay' : 'An toàn'}
          </strong>
        </div>
      </div>

      {/* Widget Body */}
      <div className="p-5 md:p-6">
        {riskItems.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h4 className="text-sm font-extrabold text-slate-800">Tất cả hồ sơ Visa sát ngày đều đã được phê duyệt / nộp đúng hạn!</h4>
            <p className="text-xs text-slate-500 mt-1">Không có hành khách nào bị trễ hạn nộp hồ sơ visa trong 5 ngày tới.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {riskItems.map((item, index) => {
              const itemKey = `${item.order.id}-${item.passenger.id}`;
              const isReminded = remindedList.includes(itemKey);

              return (
                <div 
                  key={itemKey}
                  className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 p-3 rounded-xl transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-black text-xs shrink-0 mt-0.5 border border-amber-200">
                      {index + 1}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-slate-900 text-sm uppercase">
                          {item.passenger.full_name || item.passenger.name || 'Khách chưa tên'}
                        </span>
                        
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          Đơn #{item.order.id.substring(0, 8)}
                        </span>

                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                          Chờ nộp Visa
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 font-semibold line-clamp-1">
                        Tour: <strong className="text-slate-800">{item.tour.name}</strong> ({item.tour.code})
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 font-medium pt-0.5">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          Sales phụ trách: <strong className="text-blue-700 font-bold">{item.salespersonName}</strong>
                        </span>
                        {item.passenger.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            SĐT khách: <strong className="text-slate-700">{item.passenger.phone}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Deadline & Quick Button */}
                  <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Hạn nộp Visa</span>
                      <span className={`text-xs font-black flex items-center gap-1 ${
                        item.daysRemaining <= 1 ? 'text-red-600' : 'text-amber-700'
                      }`}>
                        <Calendar className="w-3.5 h-3.5" />
                        {item.visaDeadlineDate.toLocaleDateString('vi-VN')}
                        <span className="text-[10px] underline font-extrabold ml-1">
                          ({item.daysRemaining <= 0 ? 'Hết hạn hôm nay' : `Còn ${item.daysRemaining} ngày`})
                        </span>
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isReminded}
                      onClick={() => handleRemindSales(itemKey, item.salespersonName, item.passenger.full_name || 'Khách hàng', item.tour.code)}
                      className={`py-2 px-3.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-2xs ${
                        isReminded 
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          : 'bg-amber-600 hover:bg-amber-700 text-white active:scale-95'
                      }`}
                    >
                      <Bell className="w-3.5 h-3.5" />
                      {isReminded ? 'Đã nhắc nhở' : 'Nhắc nhở Sales'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
