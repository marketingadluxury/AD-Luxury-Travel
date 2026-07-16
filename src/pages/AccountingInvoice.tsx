import { useState, useMemo } from 'react';
import { useCRM } from '@/context/CRMContext';
import { useAuth } from '@/context/AuthContext';
import { Order, Invoice } from '@/types';
import { 
  Receipt, 
  Check, 
  X,
  FileText, 
  Filter, 
  DollarSign, 
  Calendar, 
  ExternalLink, 
  Clock, 
  AlertCircle,
  TrendingUp,
  User,
  Hash,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function AccountingInvoice() {
  const { 
    orders, 
    tours, 
    passengers, 
    updateInvoiceStatus,
    invoices,
    approveInvoiceReceipt,
    rejectInvoiceReceipt
  } = useCRM();
  
  const { profile } = useAuth();
  const verifierName = profile?.full_name || 'Kế toán';

  const [activeTab, setActiveTab] = useState<'receipts' | 'vat'>('receipts');
  const [filterInvoice, setFilterInvoice] = useState<string>('pending');
  const [filterReceiptStatus, setFilterReceiptStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  // State quản lý việc xác nhận duyệt phiếu thu
  const [approveTarget, setApproveTarget] = useState<{ id: string; amount: number; orderCode: string } | null>(null);
  
  // State quản lý việc từ chối phiếu thu
  const [rejectTarget, setRejectTarget] = useState<{ id: string; orderCode: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('Sai thông tin số tiền / hóa đơn không khớp');

  // State quản lý việc xác nhận xuất hóa đơn VAT đỏ
  const [vatTarget, setVatTarget] = useState<{ orderId: string; orderCode: string; targetStatus: 'issued' | 'pending' } | null>(null);

  // State quản lý các đơn hàng đang được mở rộng chi tiết hóa đơn
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Filter receipt invoices (Phiếu thu chuyển khoản)
  const receiptInvoices = invoices
    .filter(inv => {
      if (inv.type !== 'receipt') return false;
      if (filterReceiptStatus === 'all') return true;
      return inv.status === filterReceiptStatus;
    })
    .sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

  // Gom nhóm hóa đơn chuyển khoản theo mã đơn hàng
  const groupedReceipts = useMemo(() => {
    const groups: {
      orderId: string;
      orderCode: string;
      order?: Order;
      tourName?: string;
      leadName: string;
      invoices: Invoice[];
      totalAmount: number;
    }[] = [];

    receiptInvoices.forEach(inv => {
      let group = groups.find(g => g.orderId === inv.order_id);
      if (!group) {
        const order = orders.find(o => o.id === inv.order_id);
        const tour = order ? tours.find(t => t.id === order.tour_id) : null;
        const orderCode = order ? `BK-${order.id.substring(0, 8).toUpperCase()}` : 'Chưa rõ';
        const orderPassengers = order ? passengers.filter(p => p.order_id === order.id) : [];
        const leadPassenger = orderPassengers.find(p => p.is_payer) || orderPassengers[0];
        const leadName = order?.booker_name || leadPassenger?.full_name || 'Khách trưởng đoàn';

        group = {
          orderId: inv.order_id,
          orderCode,
          order,
          tourName: tour?.name || '',
          leadName,
          invoices: [],
          totalAmount: 0
        };
        groups.push(group);
      }
      group.invoices.push(inv);
      group.totalAmount += inv.amount;
    });

    return groups;
  }, [receiptInvoices, orders, tours, passengers]);

  // Filter VAT orders (Only orders that requested VAT)
  const invoiceOrders = orders
    .filter(o => {
      if (o.status !== 'sure' && o.status !== 'paid') return false;
      if (o.vat_option !== 'Xuất VAT') return false;
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

  const getReceiptStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 mr-1 text-amber-600 animate-spin" /> Chờ kế toán duyệt
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-green-50 text-green-800 border border-green-200">
            <Check className="w-3 h-3 mr-1 text-green-600" /> Công ty đã nhận
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-800 border border-rose-200">
            <X className="w-3 h-3 mr-1 text-rose-600" /> Bị từ chối
          </span>
        );
      default:
        return null;
    }
  };

  // Stats
  const pendingReceiptsCount = invoices.filter(inv => inv.type === 'receipt' && inv.status === 'pending').length;
  const approvedReceiptsCount = invoices.filter(inv => inv.type === 'receipt' && inv.status === 'approved').length;
  const rejectedReceiptsCount = invoices.filter(inv => inv.type === 'receipt' && inv.status === 'rejected').length;
  const totalReceiptsCount = invoices.filter(inv => inv.type === 'receipt').length;

  const pendingVatCount = orders.filter(o => (o.status === 'sure' || o.status === 'paid') && o.vat_option === 'Xuất VAT' && o.invoice_status === 'pending').length;
  const issuedVatCount = orders.filter(o => (o.status === 'sure' || o.status === 'paid') && o.vat_option === 'Xuất VAT' && o.invoice_status === 'issued').length;
  const totalVatCount = orders.filter(o => (o.status === 'sure' || o.status === 'paid') && o.vat_option === 'Xuất VAT').length;

  const approvedReceiptsSum = invoices.filter(inv => inv.type === 'receipt' && inv.status === 'approved').reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Kế toán & Phê duyệt Tài chính</h2>
          <p className="text-sm text-gray-500 mt-1">
            Xác thực hóa đơn chuyển khoản của khách hàng, cập nhật công nợ và duyệt xuất hóa đơn (VAT).
          </p>
        </div>
        <div className="flex bg-gray-100 p-1.5 rounded-lg border border-gray-200 self-stretch md:self-auto">
          <button
            onClick={() => setActiveTab('receipts')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              activeTab === 'receipts'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Duyệt phiếu thu ({pendingReceiptsCount})
          </button>
          <button
            onClick={() => setActiveTab('vat')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              activeTab === 'vat'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Yêu cầu xuất VAT ({pendingVatCount})
          </button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-500">Phiếu thu chờ duyệt</span>
            <div className="text-3xl font-extrabold text-amber-600 mt-2">
              {pendingReceiptsCount} phiếu
            </div>
            <p className="text-xs text-gray-400 mt-1">Cần đối soát tài khoản ngân hàng</p>
          </div>
          <div className="bg-amber-50 p-3.5 rounded-lg">
            <Clock className="w-6 h-6 text-amber-600 animate-pulse" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-500">Đã thu thực tế (Tổng cọc)</span>
            <div className="text-3xl font-extrabold text-green-600 mt-2">
              {new Intl.NumberFormat('vi-VN').format(approvedReceiptsSum)} đ
            </div>
            <p className="text-xs text-gray-400 mt-1">Từ các phiếu thu đã duyệt</p>
          </div>
          <div className="bg-green-50 p-3.5 rounded-lg">
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-500">Chờ xuất VAT</span>
            <div className="text-3xl font-extrabold text-red-600 mt-2">
              {orders.filter(o => (o.status === 'sure' || o.status === 'paid') && o.vat_option === 'Xuất VAT' && o.invoice_status === 'pending').length} đơn
            </div>
            <p className="text-xs text-gray-400 mt-1">Đơn hàng chắc chắn yêu cầu hóa đơn</p>
          </div>
          <div className="bg-red-50 p-3.5 rounded-lg">
            <Receipt className="w-6 h-6 text-red-600" />
          </div>
        </div>
      </div>

      {activeTab === 'receipts' ? (
        /* TAB 1: DUYỆT PHIẾU THU CHUYỂN KHOẢN */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50/50">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Danh sách hóa đơn/phiếu chuyển tiền</h3>
              <p className="text-xs text-gray-500 mt-0.5">Đối chiếu tài khoản công ty và bấm phê duyệt tương ứng</p>
            </div>
            
            {/* Thanh chuyển đổi trạng thái (Sub-tabs) hiện đại và trực quan */}
            <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setFilterReceiptStatus('pending')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterReceiptStatus === 'pending'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <span>Chờ phê duyệt</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  filterReceiptStatus === 'pending' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {pendingReceiptsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterReceiptStatus('approved')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterReceiptStatus === 'approved'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <span>Công ty đã nhận</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  filterReceiptStatus === 'approved' ? 'bg-green-700 text-white' : 'bg-green-100 text-green-800'
                }`}>
                  {approvedReceiptsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterReceiptStatus('rejected')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterReceiptStatus === 'rejected'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <span>Bị từ chối</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  filterReceiptStatus === 'rejected' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'
                }`}>
                  {rejectedReceiptsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterReceiptStatus('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterReceiptStatus === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <span>Tất cả</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  filterReceiptStatus === 'all' ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-800'
                }`}>
                  {totalReceiptsCount}
                </span>
              </button>
            </div>
          </div>

          {groupedReceipts.length === 0 ? (
            <div className="text-center py-20 bg-gray-50/50">
              <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-semibold">Không tìm thấy phiếu thu nào.</p>
              <p className="text-xs text-gray-400 mt-1">Các phiếu thu do Sales tải lên sẽ hiển thị tại đây.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 bg-white">
              {groupedReceipts.map(group => {
                const isExpanded = !!expandedOrders[group.orderId];
                const pendingInGroup = group.invoices.filter(i => i.status === 'pending');
                const hasPending = pendingInGroup.length > 0;

                return (
                  <div key={group.orderId} className="transition-all duration-150 hover:bg-slate-50/30">
                    {/* Header dòng gộp */}
                    <div 
                      onClick={() => setExpandedOrders(prev => ({ ...prev, [group.orderId]: !isExpanded }))}
                      className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-start gap-3 md:w-1/3">
                        <div className={`p-2.5 rounded-lg shrink-0 ${hasPending ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                          <Hash className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-black text-gray-900 text-base flex items-center gap-2 flex-wrap">
                            {group.orderCode}
                            {hasPending && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 animate-pulse" />
                                {pendingInGroup.length} phiếu mới
                              </span>
                            )}
                          </div>
                          {group.tourName && (
                            <div className="text-xs text-gray-500 font-semibold max-w-[280px] truncate" title={group.tourName}>
                              Tour: {group.tourName}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 md:w-1/4">
                        <User className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                        <div>
                          <div className="text-sm font-extrabold text-gray-800">{group.leadName}</div>
                          <div className="text-[11px] text-gray-400 font-medium">Khách trưởng đoàn / Người nộp</div>
                        </div>
                      </div>

                      <div className="text-left md:text-right md:w-1/4">
                        <div className="text-lg font-black text-blue-700">
                          {new Intl.NumberFormat('vi-VN').format(group.totalAmount)} đ
                        </div>
                        <div className="text-xs text-gray-500 font-bold">
                          Tổng thu ({group.invoices.length} lần thanh toán)
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 shrink-0">
                        {isExpanded ? (
                          <span className="text-xs text-blue-600 font-bold bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                            Thu gọn <ChevronUp className="w-4 h-4" />
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600 font-bold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-gray-100">
                            Mở rộng <ChevronDown className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Danh sách các lần thanh toán (mở rộng) */}
                    {isExpanded && (
                      <div className="bg-gray-50/50 border-t border-gray-100 px-6 py-4 animate-fadeIn">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-100 text-xs">
                              <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                <tr>
                                  <th className="px-4 py-3 text-left">Mã giao dịch (Hóa đơn)</th>
                                  <th className="px-4 py-3 text-left">Ngày nộp</th>
                                  <th className="px-4 py-3 text-left">Ghi chú & Đợt nộp</th>
                                  <th className="px-4 py-3 text-right">Số tiền nộp</th>
                                  <th className="px-4 py-3 text-center">Chứng từ đính kèm</th>
                                  <th className="px-4 py-3 text-center">Trạng thái duyệt</th>
                                  <th className="px-4 py-3 text-center">Thao tác</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 text-gray-700 bg-white">
                                {group.invoices.map(inv => {
                                  return (
                                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="px-4 py-3.5 font-mono font-bold text-blue-700">
                                        {inv.invoice_code || 'N/A'}
                                      </td>
                                      <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">
                                        {inv.created_at ? format(new Date(inv.created_at), 'dd/MM/yyyy HH:mm') : 'N/A'}
                                      </td>
                                      <td className="px-4 py-3.5">
                                        <div className="font-semibold text-gray-800">{inv.description || 'Chuyển khoản thanh toán'}</div>
                                      </td>
                                      <td className="px-4 py-3.5 text-right font-black text-blue-600 text-sm whitespace-nowrap">
                                        {new Intl.NumberFormat('vi-VN').format(inv.amount)} đ
                                      </td>
                                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                        {inv.file_url ? (
                                          <a
                                            href={inv.file_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors border border-blue-200"
                                          >
                                            <FileText className="w-3.5 h-3.5 mr-1" /> Minh chứng <ExternalLink className="w-3 h-3 ml-1" />
                                          </a>
                                        ) : (
                                          <span className="text-xs text-gray-400 italic">Không có file</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                        {getReceiptStatusBadge(inv.status)}
                                        {inv.verified_by && (
                                          <div className="text-[9px] text-gray-400 mt-0.5">
                                            Bởi {inv.verified_by}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                        {inv.status === 'pending' ? (
                                          <div className="flex items-center justify-center space-x-1.5">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setApproveTarget({
                                                  id: inv.id,
                                                  amount: inv.amount,
                                                  orderCode: group.orderCode
                                                });
                                              }}
                                              className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm cursor-pointer"
                                            >
                                              <Check className="w-3 h-3 mr-0.5" /> Duyệt nhận
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setRejectTarget({
                                                  id: inv.id,
                                                  orderCode: group.orderCode
                                                });
                                              }}
                                              className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors cursor-pointer"
                                            >
                                              <X className="w-3 h-3 mr-0.5" /> Từ chối
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="text-gray-400 italic font-medium">Đã xử lý</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* TAB 2: YÊU CẦU XUẤT HÓA ĐƠN VAT */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50/50">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Danh sách đơn hàng xuất hóa đơn (VAT)</h3>
              <p className="text-xs text-gray-500 mt-0.5">Xử lý các yêu cầu viết hóa đơn thuế giá trị gia tăng</p>
            </div>
            
            {/* Thanh chuyển đổi trạng thái (Sub-tabs) hiện đại và trực quan cho VAT */}
            <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setFilterInvoice('pending')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterInvoice === 'pending'
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <span>Chờ xuất VAT</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  filterInvoice === 'pending' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800'
                }`}>
                  {pendingVatCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterInvoice('issued')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterInvoice === 'issued'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <span>Đã xuất VAT</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  filterInvoice === 'issued' ? 'bg-green-700 text-white' : 'bg-green-100 text-green-800'
                }`}>
                  {issuedVatCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterInvoice('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterInvoice === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <span>Tất cả</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  filterInvoice === 'all' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800'
                }`}>
                  {totalVatCount}
                </span>
              </button>
            </div>
          </div>

          {invoiceOrders.length === 0 ? (
            <div className="text-center py-20 bg-gray-50/50">
              <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-semibold">Không tìm thấy yêu cầu xuất hóa đơn nào.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-150 bg-white">
              {invoiceOrders.map(order => {
                const tour = tours.find(t => t.id === order.tour_id);
                const orderPassengers = passengers.filter(p => p.order_id === order.id);
                const leadPassenger = orderPassengers.find(p => p.is_payer) || orderPassengers[0];
                const orderCode = `BK-${order.id.substring(0, 8).toUpperCase()}`;
                const isExpanded = !!expandedOrders[order.id];

                return (
                  <div key={order.id} className="p-5 hover:bg-slate-50/40 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Đơn hàng & Tour */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-mono font-black text-gray-950 text-xs bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-100">
                            {orderCode}
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium">
                            {order.created_at ? format(new Date(order.created_at), 'dd/MM/yyyy HH:mm') : 'N/A'}
                          </span>
                          {getInvoiceBadge(order.invoice_status)}
                        </div>
                        {tour && (
                          <div className="text-xs space-y-0.5 mt-1">
                            <span className="font-bold text-blue-600 mr-2">{tour.code}</span>
                            <span className="text-gray-700 font-semibold">{tour.name}</span>
                          </div>
                        )}
                      </div>

                      {/* Middle: Người mua & Tổng tiền */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-6 lg:gap-10">
                        <div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Người mua & Số khách</div>
                          <div className="font-bold text-gray-950 text-xs">{leadPassenger?.full_name || 'Khách lẻ'}</div>
                          <div className="text-[11px] text-gray-500">{leadPassenger?.phone || 'Chưa cung cấp'}</div>
                          <span className="inline-block mt-1 bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {orderPassengers.length} người
                          </span>
                        </div>

                        <div className="lg:text-right lg:min-w-[120px]">
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5 lg:text-right">Tổng tiền</div>
                          <div className="font-black text-gray-900 text-sm lg:text-right">
                            {new Intl.NumberFormat('vi-VN').format(order.total_price)} đ
                          </div>
                        </div>
                      </div>

                      {/* Right: Thao tác & Nút mở rộng */}
                      <div className="flex flex-wrap items-center gap-2 lg:gap-3 shrink-0 self-start lg:self-center">
                        {order.vat_option === 'Xuất VAT' ? (
                          <button
                            onClick={() => setExpandedOrders(prev => ({ ...prev, [order.id]: !isExpanded }))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                              isExpanded 
                                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <span>{isExpanded ? 'Ẩn thông tin VAT' : 'Xem thông tin VAT'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Không có yêu cầu viết VAT đỏ</span>
                        )}

                        <div>
                          {order.invoice_status === 'pending' ? (
                            <button
                              onClick={() => {
                                setVatTarget({
                                  orderId: order.id,
                                  orderCode,
                                  targetStatus: 'issued'
                                });
                              }}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-lg text-white bg-green-600 hover:bg-green-700 shadow-sm transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" /> Đã xuất VAT
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setVatTarget({
                                  orderId: order.id,
                                  orderCode,
                                  targetStatus: 'pending'
                                });
                              }}
                              className="text-xs text-gray-400 hover:text-red-500 underline font-bold transition-colors cursor-pointer px-2"
                            >
                              Đánh dấu chưa xuất VAT
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Details Card */}
                    {isExpanded && order.vat_option === 'Xuất VAT' && (
                      <div className="mt-4 bg-blue-50/50 rounded-xl border border-blue-100 p-4 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="text-[10px] font-bold text-blue-900 mb-3 uppercase tracking-wider border-b border-blue-100 pb-1.5 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-blue-600" />
                          Thông tin chi tiết xuất hóa đơn (VAT)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Tên công ty</span>
                            <span className="text-xs font-black text-gray-900 select-all break-words">{order.vat_company_name || 'Chưa cung cấp'}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Mã số thuế (MST)</span>
                            <span className="text-xs font-black text-blue-800 font-mono select-all bg-white px-2 py-0.5 rounded border border-blue-150 inline-block">{order.vat_tax_code || 'Chưa cung cấp'}</span>
                          </div>
                          <div className="md:col-span-2">
                            <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Địa chỉ công ty</span>
                            <span className="text-xs font-medium text-gray-800 select-all break-words">{order.vat_address || 'Chưa cung cấp'}</span>
                          </div>
                          <div className="md:col-span-2">
                            <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Email nhận hóa đơn</span>
                            <span className="text-xs font-black text-gray-800 select-all font-mono break-all bg-white px-2 py-0.5 rounded border border-blue-150 inline-block">{order.vat_email || 'Chưa cung cấp'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Xác nhận Duyệt Phiếu Thu */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl border border-gray-100 overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mx-auto mb-4">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-950 text-center mb-2">Xác nhận Đã nhận tiền</h3>
              <p className="text-sm text-gray-600 text-center">
                Bạn có chắc chắn xác nhận tài khoản công ty đã nhận số tiền{' '}
                <strong className="text-blue-600">
                  {new Intl.NumberFormat('vi-VN').format(approveTarget.amount)}đ
                </strong>{' '}
                cho đơn hàng{' '}
                <strong>
                  {approveTarget.orderCode}
                </strong>?
              </p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setApproveTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await approveInvoiceReceipt(approveTarget.id, verifierName);
                    setApproveTarget(null);
                  } catch (err) {
                    toast.error('Gặp sự cố khi phê duyệt phiếu thu');
                  }
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Từ chối Phiếu Thu */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl border border-gray-100 overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto mb-4">
                <X className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-950 text-center mb-2">Từ chối Phiếu thu</h3>
              <p className="text-sm text-gray-600 text-center mb-4">
                Vui lòng nhập lý do từ chối phiếu thu cho đơn hàng{' '}
                <strong>
                  {rejectTarget.orderCode}
                </strong>:
              </p>
              
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
                rows={3}
                placeholder="Ví dụ: Sai thông tin số tiền / hóa đơn không khớp..."
              />
            </div>
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason('Sai thông tin số tiền / hóa đơn không khớp');
                }}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!rejectReason.trim()) {
                    toast.error('Vui lòng nhập lý do từ chối');
                    return;
                  }
                  try {
                    await rejectInvoiceReceipt(rejectTarget.id, verifierName);
                    setRejectTarget(null);
                    setRejectReason('Sai thông tin số tiền / hóa đơn không khớp');
                  } catch (err) {
                    toast.error('Gặp sự cố khi từ chối phiếu thu');
                  }
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors"
              >
                Từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Trạng thái Hóa đơn VAT */}
      {vatTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl border border-gray-100 overflow-hidden transform transition-all">
            <div className="p-6">
              <div className={`flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4 ${
                vatTarget.targetStatus === 'issued' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
              }`}>
                {vatTarget.targetStatus === 'issued' ? <Check className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              </div>
              <h3 className="text-lg font-bold text-gray-950 text-center mb-2">
                {vatTarget.targetStatus === 'issued' ? 'Xác nhận Đã viết VAT' : 'Đánh dấu Chưa viết VAT'}
              </h3>
              <p className="text-sm text-gray-600 text-center">
                {vatTarget.targetStatus === 'issued' 
                  ? `Bạn có chắc chắn muốn xác nhận ĐÃ XUẤT hóa đơn tài chính VAT đỏ cho đơn hàng ${vatTarget.orderCode}?`
                  : `Bạn có chắc chắn muốn đánh dấu đơn hàng ${vatTarget.orderCode} là CHƯA XUẤT hóa đơn VAT đỏ?`
                }
              </p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setVatTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await updateInvoiceStatus(vatTarget.orderId, vatTarget.targetStatus);
                    toast.success('Cập nhật trạng thái hóa đơn thành công!');
                    setVatTarget(null);
                  } catch (err) {
                    toast.error('Gặp sự cố khi cập nhật trạng thái hóa đơn');
                  }
                }}
                className={`px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors ${
                  vatTarget.targetStatus === 'issued' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
