import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useCRM } from '@/context/CRMContext';
import { useAuth } from '@/context/AuthContext';
import { Order, Invoice } from '@/types';
import { parseRefundInfo } from '@/lib/utils';
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
  ChevronUp,
  Upload,
  Search
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
    rejectInvoiceReceipt,
    createInvoiceReceipt,
    uploadInvoiceProof,
    currentRole
  } = useCRM();
  
  const { profile } = useAuth();
  const verifierName = profile?.full_name || 'Kế toán';
  const isAccountantOrAdmin = currentRole === 'accounting' || currentRole === 'admin';

  const [activeTab, setActiveTab] = useState<'receipts' | 'vat' | 'payments'>(
    (currentRole === 'accounting' || currentRole === 'admin') ? 'receipts' : 'payments'
  );
  const [filterInvoice, setFilterInvoice] = useState<string>('pending');
  const [filterReceiptStatus, setFilterReceiptStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  // State quản lý việc xác nhận duyệt phiếu thu
  const [approveTarget, setApproveTarget] = useState<{ id: string; amount: number; orderCode: string } | null>(null);
  
  // State quản lý việc từ chối phiếu thu
  const [rejectTarget, setRejectTarget] = useState<{ id: string; orderCode: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('Sai thông tin số tiền / hóa đơn không khớp');

  // State quản lý việc phê duyệt và từ chối phiếu chi (payments)
  const [approvePaymentTarget, setApprovePaymentTarget] = useState<Invoice | null>(null);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [paymentFileName, setPaymentFileName] = useState<string>('');
  const [isUpload,
  SearchingPaymentFile, setIsUploadingPaymentFile] = useState(false);
  const [uploadProofTarget, setUpload,
  SearchProofTarget] = useState<Invoice | null>(null);
  const [rejectPaymentTarget, setRejectPaymentTarget] = useState<Invoice | null>(null);
  const [rejectPaymentReason, setRejectPaymentReason] = useState('Đề xuất chi chưa chính xác hoặc thiếu chứng từ đối chiếu');

  // State quản lý việc xác nhận xuất hóa đơn VAT đỏ
  const [vatTarget, setVatTarget] = useState<{ orderId: string; orderCode: string; targetStatus: 'issued' | 'pending' } | null>(null);

  // State quản lý các đơn hàng đang được mở rộng chi tiết hóa đơn
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // State quản lý việc tạo phiếu chi
  const [isCreatePaymentModalOpen, setIsCreatePaymentModalOpen] = useState(false);
  const [newPaymentData, setNewPaymentData] = useState<{
    amount: string;
    description: string;
    payment_method: string;
    order_id: string | null;
  }>({
    amount: '',
    description: '',
    payment_method: 'Chuyển khoản',
    order_id: null,
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');

  // Handle click from notifications
  useEffect(() => {
    if (location.state?.searchTarget) {
      setSearchTerm(location.state.searchTarget);
      setFilterReceiptStatus('all');
      setFilterPaymentStatus('all');
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'payments' || tabParam === 'receipts' || tabParam === 'vat') {
      setActiveTab(tabParam as any);
    }
    
    const createParam = searchParams.get('create');
    const orderIdParam = searchParams.get('order_id');
    const amountParam = searchParams.get('amount');
    const reasonParam = searchParams.get('reason');
    
    if (createParam === 'true') {
      setIsCreatePaymentModalOpen(true);
      setNewPaymentData({
        amount: amountParam || '',
        description: reasonParam 
          ? `Hoàn tiền cho đơn hàng đã hủy #${orderIdParam?.substring(0, 8)}. Lý do: ${decodeURIComponent(reasonParam)}`
          : (orderIdParam ? `Hoàn tiền cho đơn hàng đã hủy #${orderIdParam?.substring(0, 8)}` : ''),
        payment_method: 'Chuyển khoản',
        order_id: orderIdParam || null,
      });
      // Clean up search parameters to avoid resetting form unexpectedly
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('create');
      newParams.delete('order_id');
      newParams.delete('amount');
      newParams.delete('reason');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Filter receipt invoices (Phiếu thu chuyển khoản)
  const receiptInvoices = invoices
    .filter(inv => {
      if (searchTerm && (!inv.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) && !inv.invoice_code?.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
      if (inv.type !== 'receipt') return false;
      if (filterReceiptStatus === 'all') return true;
      return inv.status === filterReceiptStatus;
    })
    .sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

  // Filter payment invoices (Phiếu chi)
  const paymentInvoices = invoices
    .filter(inv => {
      if (inv.type !== 'payment') return false;
      if (searchTerm && (!inv.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) && !inv.invoice_code?.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
      
      // If not accountant/admin, only show their own requests or refunds on their own bookings
      if (!isAccountantOrAdmin) {
        const isCreator = inv.created_by === (profile?.full_name || 'Admin');
        let isMyOrder = false;
        if (inv.order_id) {
          const associatedOrder = orders.find(o => o.id === inv.order_id);
          if (associatedOrder && (associatedOrder.user_id === profile?.id || associatedOrder.created_by === profile?.full_name)) {
            isMyOrder = true;
          }
        }
        if (!isCreator && !isMyOrder) return false;
      }

      if (filterPaymentStatus === 'all') return true;
      return inv.status === filterPaymentStatus;
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
            {isAccountantOrAdmin 
              ? 'Xác thực hóa đơn chuyển khoản của khách hàng, cập nhật công nợ, duyệt xuất hóa đơn (VAT) hoặc xử lý phiếu chi.'
              : 'Yêu cầu hoàn tiền cho đơn hàng bị hủy, đề xuất các phiếu chi và theo dõi trạng thái phê duyệt từ kế toán.'}
          </p>
        </div>
        <div className="flex flex-wrap md:flex-nowrap bg-gray-100 p-1.5 rounded-lg border border-gray-200 self-stretch md:self-auto gap-1 md:gap-0">
          {isAccountantOrAdmin && (
            <>
              <button
                onClick={() => setActiveTab('receipts')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'receipts'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Duyệt phiếu thu ({pendingReceiptsCount})
              </button>
              <button
                onClick={() => setActiveTab('vat')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'vat'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Yêu cầu xuất VAT ({pendingVatCount})
              </button>
            </>
          )}
          <button
            onClick={() => setActiveTab('payments')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'payments'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {isAccountantOrAdmin ? 'Phiếu chi / Hoàn tiền' : 'Đề xuất phiếu chi'}
          </button>
        </div>
      </div>

      
      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm kiếm theo mã đơn hàng hoặc mã phiếu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
          <TrendingUp className="w-4 h-4" />
          <span>Theo dõi các luồng dòng tiền</span>
        </div>
      </div>

      {/* Stats summary */}
      {isAccountantOrAdmin ? (
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-500">Yêu cầu chi chờ duyệt</span>
              <div className="text-3xl font-extrabold text-amber-600 mt-2">
                {paymentInvoices.filter(inv => inv.status === 'pending').length} phiếu
              </div>
              <p className="text-xs text-gray-400 mt-1">Đang chờ kế toán duyệt chi</p>
            </div>
            <div className="bg-amber-50 p-3.5 rounded-lg">
              <Clock className="w-6 h-6 text-amber-600 animate-pulse" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-500">Đã được duyệt chi</span>
              <div className="text-3xl font-extrabold text-green-600 mt-2">
                {paymentInvoices.filter(inv => inv.status === 'approved').length} phiếu
              </div>
              <p className="text-xs text-gray-400 mt-1">Yêu cầu hoàn/chi đã chi tiền</p>
            </div>
            <div className="bg-green-50 p-3.5 rounded-lg">
              <Check className="w-6 h-6 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-500">Số tiền được hoàn/chi</span>
              <div className="text-3xl font-extrabold text-blue-600 mt-2">
                {new Intl.NumberFormat('vi-VN').format(paymentInvoices.filter(inv => inv.status === 'approved').reduce((sum, inv) => sum + inv.amount, 0))} đ
              </div>
              <p className="text-xs text-gray-400 mt-1">Tổng tiền mặt/chuyển khoản đã nhận</p>
            </div>
            <div className="bg-blue-50 p-3.5 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'receipts' && (
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
                <span className={filterReceiptStatus === 'all' 
                  ? 'px-1.5 py-0.5 rounded-full text-[10px] bg-blue-700 text-white' 
                  : 'px-1.5 py-0.5 rounded-full text-[10px] bg-gray-200 text-gray-800'
                }>
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
                                              className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-md text-slate-700 bg-white border border-gray-300 hover:bg-slate-100 hover:text-rose-600 hover:border-rose-200 transition-colors cursor-pointer"
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
      )}
      
      {activeTab === 'vat' && (
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
                          <span className="font-mono font-black text-blue-950 text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
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

      {activeTab === 'payments' && (
        /* TAB 3: PHIẾU CHI */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gray-50/50">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Danh sách phiếu chi & Hoàn tiền</h3>
              <p className="text-xs text-gray-500 mt-0.5">Quản lý, phê duyệt các khoản chi tiền, hoàn tiền cho khách hàng hoặc đại lý</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Thanh chuyển đổi trạng thái phiếu chi (Sub-tabs) */}
              <div className="flex flex-wrap items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => setFilterPaymentStatus('pending')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center cursor-pointer ${
                    filterPaymentStatus === 'pending'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Chờ duyệt
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPaymentStatus('approved')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center cursor-pointer ${
                    filterPaymentStatus === 'approved'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Đã duyệt chi
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPaymentStatus('rejected')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center cursor-pointer ${
                    filterPaymentStatus === 'rejected'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Bị từ chối
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPaymentStatus('all')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center cursor-pointer ${
                    filterPaymentStatus === 'all'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Tất cả
                </button>
              </div>

              <button
                onClick={() => setIsCreatePaymentModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer"
              >
                + Tạo phiếu chi mới
              </button>
            </div>
          </div>

          <div className="p-4 md:p-6 space-y-4">
            {paymentInvoices.length === 0 ? (
              <div className="text-center py-12 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h4 className="text-gray-900 font-bold text-sm">Chưa có phiếu chi nào</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">Các phiếu chi, hoàn tiền thuộc trạng thái bộ lọc hiện tại sẽ hiển thị tại đây.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {paymentInvoices.map((inv) => (
                  <div key={inv.id} className="border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden bg-white hover:border-blue-200 transition-all flex flex-col justify-between">
                    <div>
                      {/* Top Code and Amount */}
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-150">
                        <div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Mã Phiếu Chi</div>
                          <div className="font-mono font-black text-gray-800 text-xs flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                            {inv.invoice_code || 'Chưa cấp'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Số Tiền Chi</div>
                          <div className="font-black text-rose-600 text-sm select-all">{new Intl.NumberFormat('vi-VN').format(inv.amount)}đ</div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center justify-between mb-3 text-xs">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Trạng thái</span>
                        {inv.status === 'pending' ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 mr-1 animate-spin" /> Chờ duyệt chi
                          </span>
                        ) : inv.status === 'approved' ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-50 text-green-700 border border-green-200">
                            <Check className="w-3.5 h-3.5 mr-1" /> Đã duyệt chi
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <X className="w-3.5 h-3.5 mr-1" /> Bị từ chối
                          </span>
                        )}
                      </div>

                      {/* Verification Detail */}
                      {inv.status === 'approved' && inv.verified_by && (
                        <div className="text-[10px] text-green-700 bg-green-50/50 p-2 rounded-lg border border-green-100 mb-3 flex items-center justify-between font-semibold">
                          <span>Duyệt bởi: <strong>{inv.verified_by}</strong></span>
                          {inv.verified_at && <span>{format(new Date(inv.verified_at), 'dd/MM/yyyy')}</span>}
                        </div>
                      )}

                      {/* Order Association if available */}
                      {inv.order_id && (
                        <div className="text-[10px] text-blue-700 bg-blue-50/50 p-2 rounded-lg border border-blue-100 mb-3 font-semibold flex items-center justify-between">
                          <span>Đơn hàng liên kết:</span>
                          <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200 font-bold">
                            #{inv.order_id.substring(0, 8).toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Description */}
                      <div className="bg-gray-50 rounded-lg p-2.5 mb-3 text-xs text-gray-600 border border-gray-100">
                        <span className="font-bold text-gray-700 block mb-1">Lý do chi:</span>
                        <p className="leading-relaxed break-words">
                          {parseRefundInfo(inv).cleanDescription || 'Không có mô tả chi tiết'}
                        </p>
                      </div>

                      {/* Refund Method Info */}
                      {parseRefundInfo(inv).method === 'transfer' && (
                        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 mb-3">
                          <span className="text-blue-800 font-black uppercase text-[10px] tracking-wider block mb-2 border-b border-blue-200/50 pb-1">
                            Hoàn trả qua Ngân hàng
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <span className="text-blue-500 font-bold text-[9px] uppercase tracking-wider block mb-0.5">Ngân hàng</span>
                              <span className="font-semibold text-blue-950 text-xs">{parseRefundInfo(inv).bankName || '---'}</span>
                            </div>
                            <div>
                              <span className="text-blue-500 font-bold text-[9px] uppercase tracking-wider block mb-0.5">Số tài khoản</span>
                              <span className="font-semibold text-blue-950 text-xs">{parseRefundInfo(inv).accountNumber || '---'}</span>
                            </div>
                            <div>
                              <span className="text-blue-500 font-bold text-[9px] uppercase tracking-wider block mb-0.5">Chủ tài khoản</span>
                              <span className="font-bold text-blue-950 text-xs">{parseRefundInfo(inv).accountName || '---'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {parseRefundInfo(inv).method === 'cash' && (
                        <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 mb-3">
                          <span className="text-amber-800 font-black uppercase text-[10px] tracking-wider block mb-1">
                            Hoàn trả: Nhận tiền mặt
                          </span>
                          <p className="text-amber-700 text-xs font-semibold">Khách hàng nhận tiền mặt trực tiếp tại văn phòng.</p>
                        </div>
                      )}

                      {/* Minh chứng chuyển khoản cho phiếu chi */}
                      <div className="mt-3 p-2.5 bg-slate-50/80 rounded-lg border border-gray-150 text-xs flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-500 uppercase text-[10px]">Xác nhận</span>
                          {inv.file_url ? (
                            <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 font-bold px-1.5 py-0.5 rounded">
                              Đã có minh chứng
                            </span>
                          ) : (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-1.5 py-0.5 rounded">
                              Chưa có minh chứng
                            </span>
                          )}
                        </div>

                        {inv.file_url ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={inv.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" /> Xem ảnh chuyển tiền
                            </a>
                            {isAccountantOrAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  setUpload,
  SearchProofTarget(inv);
                                }}
                                className="px-2.5 py-1.5 text-xs font-bold text-gray-600 bg-white hover:bg-gray-100 rounded-md border border-gray-200 transition-colors cursor-pointer"
                                title="Cập nhật ảnh khác"
                              >
                                <Upload className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div>
                            {isAccountantOrAdmin ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setUpload,
  SearchProofTarget(inv);
                                }}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-200 transition-colors cursor-pointer"
                              >
                                <Upload className="w-3.5 h-3.5 text-gray-500" /> Tải lên biên lai chuyển khoản
                              </button>
                            ) : (
                              <span className="text-gray-400 italic block text-center py-1">Chưa cập nhật ảnh chuyển khoản</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      {/* Footer Info */}
                      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span className="truncate max-w-[120px]" title={inv.created_by}>{inv.created_by || 'Hệ thống'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>{inv.created_at ? format(new Date(inv.created_at), 'dd/MM/yyyy') : 'N/A'}</span>
                        </div>
                      </div>

                      {/* Accountant Actions */}
                      {isAccountantOrAdmin && inv.status === 'pending' && (
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100">
                          <button
                            type="button"
                            onClick={() => setRejectPaymentTarget(inv)}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" /> Từ chối chi
                          </button>
                          <button
                            type="button"
                            onClick={() => setApprovePaymentTarget(inv)}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> Phê duyệt chi
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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

      {/* Modal Xác nhận Duyệt Chi Phiếu Chi */}
      {approvePaymentTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mx-auto mb-4">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-950 text-center mb-2 font-sans tracking-tight">Xác nhận Duyệt chi tiền</h3>
              <p className="text-xs text-gray-600 text-center leading-relaxed">
                Bạn có chắc chắn muốn PHÊ DUYỆT và đánh dấu ĐÃ CHI cho phiếu chi{' '}
                <strong className="text-gray-900 font-mono">
                  {approvePaymentTarget.invoice_code}
                </strong>{' '}
                với số tiền{' '}
                <strong className="text-rose-600 font-black">
                  {new Intl.NumberFormat('vi-VN').format(approvePaymentTarget.amount)}đ
                </strong>? Hành động này sẽ cập nhật trực tiếp vào số dư đơn hàng liên quan nếu có.
              </p>

              {/* Thêm phần tải ảnh hóa đơn chuyển khoản chuyển tiền */}
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <label className="text-xs font-extrabold text-gray-700 uppercase block text-left">
                  Ảnh hóa đơn/biên lai chuyển khoản (Khuyên dùng)
                </label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors relative cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setPaymentFile(f);
                      setPaymentFileName(f ? f.name : '');
                    }}
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-600">
                      {paymentFileName || 'Nhấp để chọn ảnh biên lai chuyển tiền'}
                    </p>
                    <p className="text-[10px] text-gray-400">Hỗ trợ JPG, PNG, PDF</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                disabled={isUpload,
  SearchingPaymentFile}
                onClick={() => {
                  setPaymentFile(null);
                  setPaymentFileName('');
                  setApprovePaymentTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isUpload,
  SearchingPaymentFile}
                onClick={async () => {
                  setIsUpload,
  SearchingPaymentFile(true);
                  try {
                    let fileUrl = '';
                    if (paymentFile) {
                      const targetOrder = orders.find(o => o.id === approvePaymentTarget.order_id);
                      const orderCode = targetOrder ? targetOrder.id : 'CHUA_RO';
                      
                      const formData = new FormData();
                      formData.append('file', paymentFile);
                      formData.append('orderCode', orderCode);

                      const uploadRes = await fetch('/api/upload-invoice-receipt', {
                        method: 'POST',
                        body: formData,
                      });

                      if (!uploadRes.ok) {
                        const text = await uploadRes.text();
                        let errData = { error: 'Lỗi upload file' };
                        try { errData = JSON.parse(text); } catch {}
                        throw new Error(errData.error || 'Lỗi khi upload hóa đơn lên Google Drive.');
                      }

                      const resText = await uploadRes.text();
                      let resData = JSON.parse(resText);
                      fileUrl = resData.url;
                    }

                    await approveInvoiceReceipt(approvePaymentTarget.id, verifierName, fileUrl);
                    
                    // Reset state
                    setPaymentFile(null);
                    setPaymentFileName('');
                    setApprovePaymentTarget(null);
                  } catch (err: any) {
                    console.error(err);
                    toast.error(err.message || 'Gặp sự cố khi phê duyệt phiếu chi');
                  } finally {
                    setIsUpload,
  SearchingPaymentFile(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isUpload,
  SearchingPaymentFile ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  'Duyệt & Chi tiền'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Từ chối Duyệt Chi Phiếu Chi */}
      {rejectPaymentTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto mb-4">
                <X className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-950 text-center mb-2 font-sans tracking-tight">Từ chối Phiếu chi</h3>
              <p className="text-xs text-gray-600 text-center mb-4 leading-relaxed">
                Vui lòng nhập lý do từ chối phiếu chi{' '}
                <strong className="text-gray-900 font-mono">
                  {rejectPaymentTarget.invoice_code}
                </strong> ({new Intl.NumberFormat('vi-VN').format(rejectPaymentTarget.amount)}đ):
              </p>
              
              <textarea
                value={rejectPaymentReason}
                onChange={(e) => setRejectPaymentReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
                rows={3}
                placeholder="Ví dụ: Đề xuất chi chưa chính xác hoặc thiếu chứng từ đối chiếu..."
              />
            </div>
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setRejectPaymentTarget(null);
                  setRejectPaymentReason('Đề xuất chi chưa chính xác hoặc thiếu chứng từ đối chiếu');
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!rejectPaymentReason.trim()) {
                    toast.error('Vui lòng nhập lý do từ chối chi');
                    return;
                  }
                  try {
                    await rejectInvoiceReceipt(rejectPaymentTarget.id, verifierName);
                    setRejectPaymentTarget(null);
                    setRejectPaymentReason('Đề xuất chi chưa chính xác hoặc thiếu chứng từ đối chiếu');
                  } catch (err) {
                    toast.error('Gặp sự cố khi từ chối phiếu chi');
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Từ chối chi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Upload,
  Search/Cập nhật minh chứng chuyển khoản */}
      {uploadProofTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mx-auto mb-4">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-950 text-center mb-2 font-sans tracking-tight">Cập nhật ảnh chuyển khoản</h3>
              <p className="text-xs text-gray-600 text-center mb-4 leading-relaxed">
                Tải lên hóa đơn chuyển khoản (biên lai) cho phiếu chi{' '}
                <strong className="text-gray-900 font-mono">
                  {uploadProofTarget.invoice_code}
                </strong>{' '}
                với số tiền{' '}
                <strong className="text-rose-600 font-black">
                  {new Intl.NumberFormat('vi-VN').format(uploadProofTarget.amount)}đ
                </strong>.
              </p>

              <div className="space-y-2">
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors relative cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setPaymentFile(f);
                      setPaymentFileName(f ? f.name : '');
                    }}
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                    <Upload className="w-6 h-6 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-600">
                      {paymentFileName || 'Nhấp để chọn ảnh biên lai mới'}
                    </p>
                    <p className="text-[10px] text-gray-400">Hỗ trợ JPG, PNG, PDF</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                disabled={isUpload,
  SearchingPaymentFile}
                onClick={() => {
                  setPaymentFile(null);
                  setPaymentFileName('');
                  setUpload,
  SearchProofTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={!paymentFile || isUpload,
  SearchingPaymentFile}
                onClick={async () => {
                  if (!paymentFile) return;
                  setIsUpload,
  SearchingPaymentFile(true);
                  try {
                    const targetOrder = orders.find(o => o.id === uploadProofTarget.order_id);
                    const orderCode = targetOrder ? targetOrder.id : 'CHUA_RO';
                    
                    const formData = new FormData();
                    formData.append('file', paymentFile);
                    formData.append('orderCode', orderCode);

                    const uploadRes = await fetch('/api/upload-invoice-receipt', {
                      method: 'POST',
                      body: formData,
                    });

                    if (!uploadRes.ok) {
                      const text = await uploadRes.text();
                      let errData = { error: 'Lỗi upload file' };
                      try { errData = JSON.parse(text); } catch {}
                      throw new Error(errData.error || 'Lỗi khi upload hóa đơn lên Google Drive.');
                    }

                    const resText = await uploadRes.text();
                    let resData = JSON.parse(resText);
                    
                    await uploadInvoiceProof(uploadProofTarget.id, resData.url);
                    
                    // Reset state
                    setPaymentFile(null);
                    setPaymentFileName('');
                    setUpload,
  SearchProofTarget(null);
                  } catch (err: any) {
                    console.error(err);
                    toast.error(err.message || 'Gặp lỗi khi lưu minh chứng');
                  } finally {
                    setIsUpload,
  SearchingPaymentFile(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isUpload,
  SearchingPaymentFile ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    Đang tải lên...
                  </>
                ) : (
                  'Lưu minh chứng'
                )}
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

      {/* Modal Tạo Phiếu Chi */}
      {isCreatePaymentModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl border border-gray-100 overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Tạo Phiếu Chi Mới</h3>
              <button 
                onClick={() => setIsCreatePaymentModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 bg-white hover:bg-gray-100 rounded-full p-1.5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Số tiền chi <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    value={newPaymentData.amount}
                    onChange={(e) => setNewPaymentData({ ...newPaymentData, amount: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Nhập số tiền..."
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">VND</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Lý do chi <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={newPaymentData.description}
                  onChange={(e) => setNewPaymentData({ ...newPaymentData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  rows={3}
                  placeholder="Ví dụ: Hoàn tiền khách hủy tour, chi phí marketing..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Phương thức <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newPaymentData.payment_method}
                  onChange={(e) => setNewPaymentData({ ...newPaymentData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                >
                  <option value="Chuyển khoản">Chuyển khoản</option>
                  <option value="Tiền mặt">Tiền mặt</option>
                </select>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsCreatePaymentModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newPaymentData.amount || Number(newPaymentData.amount) <= 0) {
                    toast.error('Vui lòng nhập số tiền hợp lệ');
                    return;
                  }
                  if (!newPaymentData.description.trim()) {
                    toast.error('Vui lòng nhập lý do chi');
                    return;
                  }
                  
                  try {
                    await createInvoiceReceipt({
                      order_id: newPaymentData.order_id,
                      amount: Number(newPaymentData.amount),
                      description: newPaymentData.description,
                      payment_method: newPaymentData.payment_method,
                      type: 'payment',
                      created_by: profile?.full_name || 'Admin',
                    });
                    
                    toast.success('Tạo phiếu chi thành công!');
                    setIsCreatePaymentModalOpen(false);
                    setNewPaymentData({ amount: '', description: '', payment_method: 'Chuyển khoản', order_id: null });
                  } catch (error) {
                    toast.error('Gặp sự cố khi tạo phiếu chi');
                  }
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
              >
                Tạo Phiếu Chi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
