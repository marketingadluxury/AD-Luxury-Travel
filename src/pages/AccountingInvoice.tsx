import { useState } from 'react';
import { useCRM } from '@/context/CRMContext';
import { Order } from '@/types';
import { Receipt, Check, FileText, Filter, DollarSign, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function AccountingInvoice() {
  const { orders, tours, passengers, updateInvoiceStatus } = useCRM();
  const [filterInvoice, setFilterInvoice] = useState<string>('pending');

  // We care about orders that are 'sure' or 'paid' for invoice issuing
  const invoiceOrders = orders
    .filter(o => {
      if (o.status !== 'sure' && o.status !== 'paid') return false;
      if (filterInvoice === 'all') return true;
      return o.invoice_status === filterInvoice;
    })
    .sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

  const getInvoiceBadge = (status: Order['invoice_status']) => {
    switch (status) {
      case 'pending':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Chưa xuất hóa đơn</span>;
      case 'issued':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Đã xuất hóa đơn</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Kế toán & Quản lý Hóa đơn</h2>
        <p className="text-sm text-gray-500 mt-1">
          Theo dõi các đơn hàng chắc chắn (Sure) cần xuất hóa đơn tài chính và cập nhật chứng từ hoàn thành.
        </p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-500">Chờ xuất Hóa đơn</span>
            <div className="text-3xl font-extrabold text-red-600 mt-2">
              {orders.filter(o => (o.status === 'sure' || o.status === 'paid') && o.invoice_status === 'pending').length} đơn
            </div>
          </div>
          <div className="bg-red-50 p-3.5 rounded-lg">
            <Receipt className="w-6 h-6 text-red-600 animate-pulse" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-500">Đã xuất Hóa đơn</span>
            <div className="text-3xl font-extrabold text-green-600 mt-2">
              {orders.filter(o => (o.status === 'sure' || o.status === 'paid') && o.invoice_status === 'issued').length} đơn
            </div>
          </div>
          <div className="bg-green-50 p-3.5 rounded-lg">
            <Check className="w-6 h-6 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-500">Doanh thu chắc chắn (VND)</span>
            <div className="text-3xl font-extrabold text-blue-600 mt-2">
              {new Intl.NumberFormat('vi-VN').format(
                orders.filter(o => o.status === 'sure' || o.status === 'paid').reduce((sum, o) => sum + o.total_price, 0)
              )}
            </div>
          </div>
          <div className="bg-blue-50 p-3.5 rounded-lg">
            <DollarSign className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Filters and List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-gray-900">Danh sách đơn hàng xuất hóa đơn</h3>
          
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium"
              value={filterInvoice}
              onChange={e => setFilterInvoice(e.target.value)}
            >
              <option value="pending">Chờ xuất hóa đơn</option>
              <option value="issued">Đã xuất hóa đơn</option>
              <option value="all">Tất cả đơn chắc chắn</option>
            </select>
          </div>
        </div>

        {invoiceOrders.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">Không tìm thấy yêu cầu xuất hóa đơn nào.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-4 text-left">Đơn hàng</th>
                  <th className="px-6 py-4 text-left">Tour du lịch</th>
                  <th className="px-6 py-4 text-left">Người thanh toán</th>
                  <th className="px-6 py-4 text-center">Hành khách</th>
                  <th className="px-6 py-4 text-right">Tổng tiền</th>
                  <th className="px-6 py-4 text-center">Trạng thái Hóa đơn</th>
                  <th className="px-6 py-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                {invoiceOrders.map(order => {
                  const tour = tours.find(t => t.id === order.tour_id);
                  const orderPassengers = passengers.filter(p => p.order_id === order.id);
                  const leadPassenger = orderPassengers.find(p => p.is_payer) || orderPassengers[0];

                  return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-gray-900">#{order.id.substring(0, 8)}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-blue-600 text-xs">{tour?.code}</div>
                        <div className="text-xs text-gray-500 max-w-[200px] truncate">{tour?.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{leadPassenger?.full_name}</div>
                        <div className="text-xs text-gray-500">{leadPassenger?.phone || 'Chưa cung cấp'}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs font-semibold">
                          {orderPassengers.length} người
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">
                        {new Intl.NumberFormat('vi-VN').format(order.total_price)} VND
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {getInvoiceBadge(order.invoice_status)}
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {order.invoice_status === 'pending' ? (
                          <button
                            onClick={() => {
                              if (confirm(`Bạn có chắc chắn muốn xác nhận ĐÃ XUẤT hóa đơn cho đơn hàng #${order.id.substring(0, 8)}?`)) {
                                updateInvoiceStatus(order.id, 'issued');
                              }
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Xuất hóa đơn
                          </button>
                        ) : (
                          <button
                            onClick={() => updateInvoiceStatus(order.id, 'pending')}
                            className="text-xs text-gray-400 hover:text-red-500 underline"
                          >
                            Đánh dấu chưa xuất
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
