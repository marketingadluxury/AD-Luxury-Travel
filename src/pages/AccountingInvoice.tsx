import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useCRM } from '@/context/CRMContext';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { motion } from 'motion/react';
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
  Search,
  Folder,
  FolderOpen,
  FileCheck,
  Briefcase,
  Shield,
  Info,
  Percent,
  Trash2,
  Copy,
  Eye,
  Coins,
  Download,
  Plus,
  Compass,
  ChevronRight
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
    currentRole,
    tourCosts,
    updateTourCost,
    updateOrder
  } = useCRM();
  
  const { user, profile } = useAuth();
  const verifierName = profile?.full_name || 'Kế toán';
  const isAccountantOrAdmin = currentRole === 'accounting' || currentRole === 'admin';

  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchProfilesMap() {
      if (isSupabaseConfigured()) {
        try {
          const { data } = await supabase.from('profiles').select('id, full_name, phone');
          if (data && data.length > 0) {
            const map: Record<string, string> = {};
            data.forEach((p: any) => {
              if (p.id) {
                map[p.id] = p.full_name || p.phone || 'Thành viên CRM';
              }
            });
            setProfilesMap(map);
          }
        } catch (e) {
          console.error('Lỗi nạp danh sách thành viên:', e);
        }
      }
    }
    fetchProfilesMap();
  }, []);

  const resolveCreatorName = useCallback((createdBy?: string | null, orderId?: string | null) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!createdBy || createdBy.trim() === '') {
      if (orderId && Array.isArray(orders)) {
        const matchedOrder = orders.find(o => o.id === orderId);
        if (matchedOrder?.created_by && !uuidRegex.test(matchedOrder.created_by)) {
          return matchedOrder.created_by;
        }
        if (matchedOrder?.booker_name) {
          return matchedOrder.booker_name;
        }
      }
      return profile?.full_name || 'Hệ thống';
    }

    if (uuidRegex.test(createdBy)) {
      if (profilesMap[createdBy]) {
        return profilesMap[createdBy];
      }
      if ((profile?.id && createdBy === profile.id) || (user?.id && createdBy === user.id)) {
        return profile?.full_name || profile?.phone || user?.email || 'Quản trị viên';
      }
      if (orderId && Array.isArray(orders)) {
        const matchedOrder = orders.find(o => o.id === orderId);
        if (matchedOrder?.created_by && !uuidRegex.test(matchedOrder.created_by)) {
          return matchedOrder.created_by;
        }
        if (matchedOrder?.booker_name) {
          return matchedOrder.booker_name;
        }
      }
      return profile?.full_name || 'Nhân viên CRM';
    }

    return createdBy;
  }, [profilesMap, orders, profile, user]);

  const [activeTab, setActiveTab] = useState<'receipts' | 'vat' | 'payments' | 'tours'>(
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
  const [isUploadingPaymentFile, setIsUploadingPaymentFile] = useState(false);
  const [uploadProofTarget, setUploadProofTarget] = useState<Invoice | null>(null);
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
    refund_bank_name: string;
    refund_account_number: string;
    refund_account_name: string;
  }>({
    amount: '',
    description: '',
    payment_method: 'Chuyển khoản',
    order_id: null,
    refund_bank_name: '',
    refund_account_number: '',
    refund_account_name: '',
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');

  // Tour-card folder state for Accountant
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'bookings': true,
    'costs': true,
    'itinerary': false
  });
  const [contractUploadProgress, setContractUploadProgress] = useState<Record<string, boolean>>({});

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN').format(num || 0) + ' đ';

  // Get financial stats for each tour card
  const getTourStats = (tourId: string) => {
    const tourObj = tours.find(t => t.id === tourId);
    
    // Bookings of this tour (all active, non-cancelled bookings)
    const tourOrders = orders.filter(o => o.tour_id === tourId && o.status !== 'cancelled');
    
    // Total Revenue: sum of order total prices
    const totalRevenue = tourOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
    
    // Collected Revenue: sum of approved receipts associated with this tour's bookings
    const orderIds = tourOrders.map(o => o.id);
    const collectedRevenue = invoices
      .filter(inv => inv.type === 'receipt' && inv.status === 'approved' && inv.order_id && orderIds.includes(inv.order_id))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);
      
    // Remaining Revenue: totalRevenue - collectedRevenue
    const remainingRevenue = Math.max(0, totalRevenue - collectedRevenue);
    
    // Find TourCost for this tour
    const costRecord = tourCosts.find(c => c.tourId === tourId);
    const totalDirectCosts = costRecord 
      ? (costRecord.flightAmount || 0) + 
        (costRecord.insuranceAmount || 0) + 
        (costRecord.tourGuideAmount || 0) + 
        (costRecord.giftAmount || 0) + 
        (costRecord.commissionAmount || 0) + 
        (costRecord.advertisingAmount || 0) + 
        (costRecord.visaAmount || 0) + 
        (costRecord.otherAmount || 0) + 
        (costRecord.landtours || []).reduce((sum, lt) => sum + (lt.amount || 0), 0)
      : 0;

    // Paid Costs: sum of approved payments associated with this tour's partner payments (via invoiceId)
    const partnerPayments = costRecord?.partnerPayments || [];
    const partnerInvoiceIds = partnerPayments.map(p => p.invoiceId).filter(Boolean);
    
    const paidCosts = invoices
      .filter(inv => inv.type === 'payment' && inv.status === 'approved' && inv.id && partnerInvoiceIds.includes(inv.id))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);
      
    // Remaining costs: totalDirectCosts - paidCosts
    const remainingCosts = Math.max(0, totalDirectCosts - paidCosts);
    
    // Net Profit: totalRevenue - totalDirectCosts
    const netProfit = totalRevenue - totalDirectCosts;
    
    return {
      tourObj,
      tourOrders,
      totalRevenue,
      collectedRevenue,
      remainingRevenue,
      totalDirectCosts,
      paidCosts,
      remainingCosts,
      netProfit,
      costRecord,
      partnerPayments
    };
  };

  const handleUploadContract = async (orderId: string, orderCode: string, file: File) => {
    setContractUploadProgress(prev => ({ ...prev, [orderId]: true }));
    const toastId = toast.loading(`Đang tải hợp đồng của booking ${orderCode || orderId.substring(0,8)}...`);
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const targetTour = targetOrder ? tours.find(t => t.id === targetOrder.tour_id) : null;

      const formData = new FormData();
      formData.append('file', file);
      if (targetOrder) formData.append('orderCode', targetOrder.id.substring(0, 8));
      if (targetTour?.code) formData.append('tourCode', targetTour.code);
      if (!targetOrder && orderCode) formData.append('orderCode', orderCode.substring(0, 8));

      const uploadRes = await fetch('/api/upload-invoice-receipt', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        let errData = { error: 'Lỗi upload file' };
        try { errData = JSON.parse(text); } catch {}
        throw new Error(errData.error || 'Lỗi khi upload hợp đồng.');
      }

      const resText = await uploadRes.text();
      let resData = { url: '' };
      try { resData = JSON.parse(resText); } catch { throw new Error('Định dạng phản hồi từ máy chủ không đúng.'); }
      const contractUrl = resData.url;

      // Update in order
      await updateOrder(orderId, { contract_url: contractUrl });
      toast.success('Tải lên hợp đồng thành công!', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gặp lỗi khi tải lên hợp đồng', { id: toastId });
    } finally {
      setContractUploadProgress(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleDeleteContract = async (orderId: string) => {
    const toastId = toast.loading('Đang gỡ hợp đồng...');
    try {
      await updateOrder(orderId, { contract_url: undefined });
      toast.success('Đã gỡ hợp đồng thành công!', { id: toastId });
    } catch (err: any) {
      toast.error('Gỡ hợp đồng thất bại', { id: toastId });
    }
  };

  const handleApprovePaymentInline = async (invoiceId: string, orderCode: string, file: File) => {
    const toastId = toast.loading('Đang tải minh chứng chuyển khoản và duyệt phiếu chi...');
    try {
      const targetInvoice = invoices.find(inv => inv.id === invoiceId);
      const targetOrder = targetInvoice?.order_id ? orders.find(o => o.id === targetInvoice.order_id) : null;
      const targetTour = targetOrder ? tours.find(t => t.id === targetOrder.tour_id) : null;
      const parsedInfo = targetInvoice ? parseRefundInfo(targetInvoice, orders, tours) : null;
      const resolvedTourCode = targetTour?.code || parsedInfo?.tourCode || orderCode;

      const formData = new FormData();
      formData.append('file', file);
      if (targetOrder) formData.append('orderCode', targetOrder.id.substring(0, 8));
      if (resolvedTourCode) formData.append('tourCode', resolvedTourCode);
      if (!targetOrder && !resolvedTourCode) formData.append('orderCode', 'CHIPHI_TOUR');

      const uploadRes = await fetch('/api/upload-invoice-receipt', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        let errData = { error: 'Lỗi upload file' };
        try { errData = JSON.parse(text); } catch {}
        throw new Error(errData.error || 'Lỗi khi upload hóa đơn.');
      }

      const resText = await uploadRes.text();
      let resData = { url: '' };
      try { resData = JSON.parse(resText); } catch { throw new Error('Định dạng phản hồi từ máy chủ không đúng.'); }
      const fileUrl = resData.url;

      await approveInvoiceReceipt(invoiceId, verifierName, fileUrl);
      toast.success('Duyệt phiếu chi thành công!', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi duyệt phiếu chi', { id: toastId });
    }
  };

  const toggleFolder = (folderKey: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderKey]: !prev[folderKey]
    }));
  };

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
          ? `Hoàn tiền cho booking đã hủy #${orderIdParam?.substring(0, 8)}. Lý do: ${decodeURIComponent(reasonParam)}`
          : (orderIdParam ? `Hoàn tiền cho booking đã hủy #${orderIdParam?.substring(0, 8)}` : ''),
        payment_method: 'Chuyển khoản',
        order_id: orderIdParam || null,
        refund_bank_name: '',
        refund_account_number: '',
        refund_account_name: '',
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
      if (inv.type !== 'receipt') return false;
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim().replace(/^#/, '');
        const assocOrder = inv.order_id ? orders.find(o => o.id === inv.order_id) : null;
        const tour = assocOrder ? tours.find(t => t.id === assocOrder.tour_id) : null;

        const invCodeMatch = inv.invoice_code && inv.invoice_code.toLowerCase().includes(q);
        const orderIdMatch = inv.order_id && inv.order_id.toLowerCase().includes(q);
        const descMatch = inv.description && inv.description.toLowerCase().includes(q);
        const creatorMatch = inv.created_by && inv.created_by.toLowerCase().includes(q);
        const bookerMatch = assocOrder && assocOrder.booker_name && assocOrder.booker_name.toLowerCase().includes(q);
        const phoneMatch = assocOrder && assocOrder.booker_phone && assocOrder.booker_phone.includes(q);
        const tourCodeMatch = tour && tour.code && tour.code.toLowerCase().includes(q);

        if (!invCodeMatch && !orderIdMatch && !descMatch && !creatorMatch && !bookerMatch && !phoneMatch && !tourCodeMatch) {
          return false;
        }
      }
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
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim().replace(/^#/, '');
        const assocOrder = inv.order_id ? orders.find(o => o.id === inv.order_id) : null;
        const tour = assocOrder ? tours.find(t => t.id === assocOrder.tour_id) : null;

        const invCodeMatch = inv.invoice_code && inv.invoice_code.toLowerCase().includes(q);
        const orderIdMatch = inv.order_id && inv.order_id.toLowerCase().includes(q);
        const descMatch = inv.description && inv.description.toLowerCase().includes(q);
        const creatorMatch = inv.created_by && inv.created_by.toLowerCase().includes(q);
        const bookerMatch = assocOrder && assocOrder.booker_name && assocOrder.booker_name.toLowerCase().includes(q);
        const phoneMatch = assocOrder && assocOrder.booker_phone && assocOrder.booker_phone.includes(q);
        const tourCodeMatch = tour && tour.code && tour.code.toLowerCase().includes(q);

        if (!invCodeMatch && !orderIdMatch && !descMatch && !creatorMatch && !bookerMatch && !phoneMatch && !tourCodeMatch) {
          return false;
        }
      }
      
      // If not accountant/admin, only show their own requests or refunds on their own bookings
      if (!isAccountantOrAdmin) {
        const isCreator = inv.created_by === profile?.full_name || inv.created_by === profile?.id || inv.created_by === user?.id;
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
        const leadName = (order?.booker_name && !order.booker_name.includes('Giữ chỗ tạm'))
          ? order.booker_name
          : (leadPassenger?.full_name || 'Khách trưởng đoàn');

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

      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim().replace(/^#/, '');
        const tour = tours.find(t => t.id === o.tour_id);
        const codeMatch = o.id.toLowerCase().includes(q);
        const nameMatch = o.booker_name && o.booker_name.toLowerCase().includes(q);
        const companyMatch = o.vat_company_name && o.vat_company_name.toLowerCase().includes(q);
        const taxMatch = o.vat_tax_code && o.vat_tax_code.toLowerCase().includes(q);
        const tourCodeMatch = tour && tour.code && tour.code.toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !companyMatch && !taxMatch && !tourCodeMatch) return false;
      }

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
              : 'Yêu cầu hoàn tiền cho booking bị hủy, đề xuất các phiếu chi và theo dõi trạng thái phê duyệt từ kế toán.'}
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
          {isAccountantOrAdmin && (
            <button
              onClick={() => setActiveTab('tours')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'tours'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Báo cáo tour
            </button>
          )}
        </div>
      </div>

      
      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm kiếm theo mã booking hoặc mã phiếu..."
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
              <p className="text-xs text-gray-400 mt-1">Booking chắc chắn yêu cầu hóa đơn</p>
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
              <h3 className="text-lg font-bold text-gray-900">Danh sách booking xuất hóa đơn (VAT)</h3>
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
                      {/* Left: Booking & Tour */}
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
                {paymentInvoices.map((inv) => {
                  const parsedInfo = parseRefundInfo(inv, orders, tours);
                  return (
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

                        {/* Thông tin Tour du lịch - Hiển thị ngay phía dưới Mã Phiếu Chi */}
                        {(parsedInfo.tourCode || parsedInfo.tourName) && (
                          <div className="bg-blue-50/70 border border-blue-100/90 rounded-lg p-2.5 mb-3 shadow-2xs">
                            <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <Compass className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>Thông tin Tour</span>
                            </div>
                            <div className="text-xs space-y-1">
                              {parsedInfo.tourCode && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-gray-500">Mã Tour:</span>
                                  <span className="font-mono font-black text-blue-900 bg-white px-1.5 py-0.5 rounded border border-blue-200 text-xs">
                                    {parsedInfo.tourCode}
                                  </span>
                                </div>
                              )}
                              {parsedInfo.tourName && (
                                <div className="flex items-start gap-1.5 text-gray-800 font-semibold leading-snug">
                                  <span className="text-[10px] font-bold text-gray-500 shrink-0 mt-0.5">Tên Tour:</span>
                                  <span>{parsedInfo.tourName}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

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
                            <span>Booking liên kết:</span>
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                const code = `#${inv.order_id.substring(0, 8).toUpperCase()}`;
                                navigator.clipboard.writeText(code);
                                toast.success(`Đã sao chép mã booking: ${code}`);
                              }}
                              className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200 font-bold hover:bg-blue-50 hover:text-blue-900 cursor-pointer inline-flex items-center gap-1 group/copy transition-colors"
                              title="Bấm để sao chép mã booking"
                            >
                              #{inv.order_id.substring(0, 8).toUpperCase()}
                              <Copy className="w-3 h-3 text-blue-400 group-hover/copy:text-blue-700 transition-colors" />
                            </span>
                          </div>
                        )}

                        {/* Description */}
                        <div className="bg-gray-50 rounded-lg p-2.5 mb-3 text-xs text-gray-600 border border-gray-100">
                          <span className="font-bold text-gray-700 block mb-1">{inv.type === 'receipt' ? 'Lý do thu:' : 'Lý do chi:'}</span>
                          <p className="leading-relaxed break-words">
                            {parsedInfo.cleanDescription || 'Không có mô tả chi tiết'}
                          </p>
                        </div>

                        {/* Refund Method Info */}
                        {parsedInfo.method === 'transfer' && (
                          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 mb-3">
                            <span className="text-blue-800 font-black uppercase text-[10px] tracking-wider block mb-2 border-b border-blue-200/50 pb-1">
                              {inv.type === 'receipt' ? 'Thông tin nộp tiền qua Ngân hàng' : 'Thông tin chuyển khoản Ngân hàng'}
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <span className="text-blue-500 font-bold text-[9px] uppercase tracking-wider block mb-0.5">Ngân hàng</span>
                                <span className="font-semibold text-blue-950 text-xs">{parsedInfo.bankName || '---'}</span>
                              </div>
                              <div>
                                <span className="text-blue-500 font-bold text-[9px] uppercase tracking-wider block mb-0.5">Số tài khoản</span>
                                <span className="font-semibold text-blue-950 text-xs">{parsedInfo.accountNumber || '---'}</span>
                              </div>
                              <div>
                                <span className="text-blue-500 font-bold text-[9px] uppercase tracking-wider block mb-0.5">Chủ tài khoản</span>
                                <span className="font-bold text-blue-950 text-xs uppercase">{parsedInfo.accountName ? parsedInfo.accountName.toUpperCase() : '---'}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {parsedInfo.method === 'cash' && (
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
                                  setUploadProofTarget(inv);
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
                                  setUploadProofTarget(inv);
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
                        <div className="flex items-center gap-1.5 font-semibold text-gray-700">
                          <User className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span className="truncate max-w-[160px] font-bold text-gray-800" title={resolveCreatorName(inv.created_by, inv.order_id)}>
                            {resolveCreatorName(inv.created_by, inv.order_id)}
                          </span>
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
                );
              })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tours' && (
        /* TAB 4: HỒ SƠ & THẺ TOUR (BÁO CÁO CHI TIẾT) */
        <div className="space-y-6">
          {!selectedTourId ? (
            /* DS CARD TOUR */
            <div className="space-y-6">
              {/* Header and Search for Tours */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Quản lý chi tiết từng tour</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Dễ dàng quản lý, xem thông tin chi tiết, hợp đồng, chi phí và báo cáo tài chính của từng tour.</p>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    placeholder="Tìm theo mã tour hoặc tên tour..."
                  />
                </div>
              </div>

              {/* Grid Tour Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tours
                  .filter(tour => tour.tour_type !== 'visa')
                  .filter(tour => {
                    if (!searchTerm) return true;
                    return (
                      tour.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      tour.name?.toLowerCase().includes(searchTerm.toLowerCase())
                    );
                  })
                  .map(tour => {
                    const stats = getTourStats(tour.id);
                    const progressPercent = stats.totalRevenue > 0 
                      ? Math.round((stats.collectedRevenue / stats.totalRevenue) * 100) 
                      : 0;

                    const getTourStatusBadge = () => {
                      if (tour.status === 'cancelled') {
                        return { label: 'Đã hủy', className: 'bg-red-100 text-red-800 border border-red-200' };
                      }
                      const todayStr = new Date().toISOString().substring(0, 10);
                      const startDate = tour.start_date || (tour.departure_time ? tour.departure_time.substring(0, 10) : '');
                      const endDate = tour.end_date || (tour.return_time ? tour.return_time.substring(0, 10) : '');

                      if (tour.status === 'completed' || (endDate && endDate < todayStr)) {
                        return { label: 'Đã hoàn thành', className: 'bg-blue-100 text-blue-800 border border-blue-200' };
                      }
                      if (tour.status === 'active' || (startDate && endDate && startDate <= todayStr && endDate >= todayStr)) {
                        return { label: 'Đang chạy', className: 'bg-green-100 text-green-800 border border-green-200' };
                      }
                      return { label: 'Sắp khởi hành', className: 'bg-amber-100 text-amber-800 border border-amber-200' };
                    };
                    const statusBadge = getTourStatusBadge();
                    
                    return (
                      <motion.div
                        key={tour.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all overflow-hidden flex flex-col"
                      >
                        {/* Upper Section */}
                        <div className="p-5 border-b border-gray-100 flex-1 space-y-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className="inline-block bg-blue-50 text-blue-700 font-mono font-black text-xs px-2.5 py-1 rounded border border-blue-150">
                                🏷️ {tour.code || 'CHUA_CO_MA'}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${statusBadge.className}`}>
                                {statusBadge.label}
                              </span>
                            </div>
                            <h4 className="font-bold text-gray-900 text-sm leading-snug" title={tour.name}>
                              {tour.name}
                            </h4>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {tour.start_date ? format(new Date(tour.start_date), 'dd/MM/yyyy') : '---'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Briefcase className="w-3.5 h-3.5" />
                              {stats.tourOrders.length} bookings
                            </span>
                          </div>

                          {/* Cash indicators */}
                          <div className="space-y-2 pt-1 border-t border-dashed border-gray-100">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-400 font-medium">Doanh thu dự tính:</span>
                              <span className="font-extrabold text-gray-800">{formatVND(stats.totalRevenue)}</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400 font-medium">Tiền đã thu:</span>
                                <span className="font-black text-emerald-600">{formatVND(stats.collectedRevenue)} ({progressPercent}%)</span>
                              </div>
                              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-emerald-500 h-full rounded-full transition-all duration-300" 
                                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                                />
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-400 font-medium">Lãi/lỗ tạm tính:</span>
                              <span className={`font-extrabold ${stats.netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                {stats.netProfit >= 0 ? '+' : ''}{formatVND(stats.netProfit)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Button Action */}
                        <div className="bg-gray-50 p-3.5 border-t border-gray-100">
                          <button
                            onClick={() => setSelectedTourId(tour.id)}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <FolderOpen className="w-4 h-4" /> Mở thư mục tour
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}

                {tours
                  .filter(tour => tour.tour_type !== 'visa')
                  .filter(tour => {
                    if (!searchTerm) return true;
                    return (
                      tour.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      tour.name?.toLowerCase().includes(searchTerm.toLowerCase())
                    );
                  }).length === 0 && (
                  <div className="col-span-full bg-white p-12 text-center border border-gray-200 rounded-xl">
                    <Folder className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm font-medium">Không tìm thấy tour nào phù hợp với từ khóa.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* CHI TIẾT THƯ MỤC CỦA TOUR ĐÃ CHỌN */
            (() => {
              const stats = getTourStats(selectedTourId);
              if (!stats.tourObj) return null;
              
              const tour = stats.tourObj;
              const sureTourOrders = stats.tourOrders.filter(o => o.status === 'sure' || o.status === 'paid');

              return (
                <div className="space-y-6">
                  {/* Path & Back button */}
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                      <span className="hover:text-blue-600 cursor-pointer" onClick={() => setSelectedTourId(null)}>Trang tổng quan</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                      <span className="text-blue-700 font-mono font-black bg-blue-50 px-2.5 py-1 rounded border border-blue-150 flex items-center gap-1.5">
                        🏷️ {tour.code}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedTourId(null)}
                      className="px-3.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50 bg-white transition-all cursor-pointer flex items-center gap-1 text-gray-750"
                    >
                      Quay lại danh sách
                    </button>
                  </div>

                  {/* Layout Grid: Stats Sidebar + File Explorer */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* LEFT PANEL: FINANCIAL SUMMARY OF TOUR */}
                    <div className="lg:col-span-4 space-y-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <div className="border-b border-gray-100 pb-3 flex items-center gap-2">
                        <Coins className="w-5 h-5 text-blue-600" />
                        <h4 className="font-bold text-gray-900 text-sm">Báo cáo Tài chính Tour</h4>
                      </div>

                      {/* Cashflow breakdown */}
                      <div className="space-y-4 text-xs">
                        {/* Revenue */}
                        <div className="space-y-2 bg-slate-50/50 p-3.5 rounded-lg border border-slate-100">
                          <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1">
                            💵 DOANH THU & TIỀN THU (KHÁCH HÀNG)
                          </span>
                          <div className="flex justify-between mt-2.5">
                            <span className="text-gray-500">Tổng doanh thu (Bookings):</span>
                            <span className="font-extrabold text-gray-900">{formatVND(stats.totalRevenue)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Khách đã nộp (Đã thu):</span>
                            <span className="font-black text-emerald-600 flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-500" />
                              {formatVND(stats.collectedRevenue)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold">
                            <span className="text-gray-500">Còn lại cần thu (Công nợ):</span>
                            <span className="font-extrabold text-amber-600">{formatVND(stats.remainingRevenue)}</span>
                          </div>
                        </div>

                        {/* Costs */}
                        <div className="space-y-2 bg-slate-50/50 p-3.5 rounded-lg border border-slate-100">
                          <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1">
                            🛡️ CHI PHÍ & THANH TOÁN (ĐỐI TÁC)
                          </span>
                          <div className="flex justify-between mt-2.5">
                            <span className="text-gray-500">Tổng chi phí định mức:</span>
                            <span className="font-extrabold text-gray-900">{formatVND(stats.totalDirectCosts)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Đã chi cho đối tác:</span>
                            <span className="font-black text-blue-600 flex items-center gap-1">
                              <Check className="w-3 h-3 text-blue-500" />
                              {formatVND(stats.paidCosts)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold">
                            <span className="text-gray-500">Còn nợ / Chưa chi:</span>
                            <span className="font-extrabold text-rose-600">{formatVND(stats.remainingCosts)}</span>
                          </div>
                        </div>

                        {/* Profitability Meter */}
                        <div className="p-3.5 bg-blue-50/40 rounded-lg border border-blue-100 space-y-2">
                          <span className="font-bold text-blue-900 text-[11px] uppercase tracking-wider flex items-center gap-1">
                            📊 LỢI NHUẬN GỘP DỰ TÍNH (LÃI LỖ)
                          </span>
                          <div className="flex justify-between items-baseline mt-2.5">
                            <span className="text-gray-600">Lợi nhuận ròng:</span>
                            <span className={`text-base font-black ${stats.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {stats.netProfit >= 0 ? '+' : ''}{formatVND(stats.netProfit)}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 leading-normal">
                            (Được tính tự động dựa trên: Tổng giá trị booking được đặt trừ đi toàn bộ chi phí thực tế đã kê khai cho Tour).
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT PANEL: FINDER-STYLE FILE EXPLORER */}
                    <div className="lg:col-span-8 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                      {/* Finder OS TitleBar */}
                      <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
                          <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                          <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                          <span className="text-xs text-gray-500 font-bold ml-2 font-mono">Quản lý tour: {tour.code}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-gray-400 bg-gray-200/60 px-2 py-0.5 rounded-full">
                          {sureTourOrders.length} Bookings • {stats.partnerPayments.length} Phiếu chi
                        </span>
                      </div>

                      {/* Folders Explorer Area */}
                      <div className="p-6 space-y-4">
                        
                        {/* 1. FOLDER: BOOKINGS / HỢP ĐỒNG */}
                        <div className="border border-gray-150 rounded-xl overflow-hidden shadow-sm">
                          <button
                            onClick={() => toggleFolder('bookings')}
                            className="w-full bg-slate-50/60 hover:bg-slate-50 px-4 py-3 flex items-center justify-between text-xs font-bold text-gray-800 border-b border-gray-150 transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              {expandedFolders['bookings'] ? <FolderOpen className="w-4 h-4 text-amber-500 fill-amber-100" /> : <Folder className="w-4 h-4 text-amber-500 fill-amber-100" />}
                              Bookings & Hợp đồng ({sureTourOrders.length})
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">Chứa hợp đồng & Hóa đơn VAT</span>
                          </button>

                          {expandedFolders['bookings'] && (
                            <div className="p-4 bg-white space-y-3 divide-y divide-gray-100">
                              {sureTourOrders.length === 0 ? (
                                <p className="text-center py-4 text-xs italic text-gray-400">Chưa có Booking (sure chỗ) nào được đặt cho tour này.</p>
                              ) : (
                                sureTourOrders.map(order => {
                                  const isFolderExpanded = !!expandedFolders[`order_${order.id}`];
                                  const requiresVat = order.vat_option === 'Xuất VAT';
                                  const orderSeats = ((order.adult_count || 0) + (order.child_count || 0) + (order.infant_count || 0)) || 1;
                                  const orderPassengers = passengers.filter(p => p.order_id === order.id);
                                  const leadPassenger = orderPassengers.find(p => p.is_payer) || orderPassengers[0];
                                  const cleanBookerName = (order.booker_name && !order.booker_name.includes('Giữ chỗ tạm'))
                                    ? order.booker_name
                                    : (leadPassenger?.full_name || 'Chưa cung cấp');
                                  
                                  return (
                                    <div key={order.id} className="pt-3 first:pt-0">
                                      {/* Subfolder element */}
                                      <button
                                        onClick={() => toggleFolder(`order_${order.id}`)}
                                        className="w-full flex items-center justify-between text-[11px] sm:text-xs font-semibold py-1.5 px-3 hover:bg-blue-50/60 rounded-lg transition-colors text-gray-800 bg-gray-50 border border-gray-200"
                                      >
                                        <span className="flex items-center gap-1.5 flex-wrap">
                                          {isFolderExpanded ? <FolderOpen className="w-3.5 h-3.5 text-blue-500 fill-blue-50" /> : <Folder className="w-3.5 h-3.5 text-blue-500 fill-blue-50" />}
                                          <span>Booking: #{order.id.substring(0,8)} - {cleanBookerName} ({orderSeats} chỗ)</span>
                                          <span className="text-[9px] font-medium text-blue-800 bg-blue-50/80 px-2 py-0.5 rounded-full border border-blue-100">
                                            Sales: {resolveCreatorName(order.created_by, order.id)}
                                          </span>
                                        </span>
                                        <span className="font-bold text-gray-900 text-xs">{formatVND(order.total_price)}</span>
                                      </button>

                                      {/* Files inside Booking Folder */}
                                      {isFolderExpanded && (
                                        <div className="mt-2.5 ml-2 sm:ml-4 p-4 rounded-xl border border-slate-200 bg-slate-50/90 space-y-3.5 shadow-xs">
                                          
                                          {/* Salesperson banner */}
                                          <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs">
                                            <span className="text-gray-500 font-medium">Sales / CTV phụ trách:</span>
                                            <span className="font-bold text-blue-700">{resolveCreatorName(order.created_by, order.id)}</span>
                                          </div>

                                          {/* Hợp đồng dịch vụ du lịch */}
                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3 rounded-lg border border-slate-200">
                                            <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                                              <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                              <span className="font-bold text-gray-800 text-xs whitespace-nowrap shrink-0">Hợp đồng dịch vụ du lịch</span>
                                            </div>
                                            <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                                              {order.contract_url ? (
                                                <>
                                                  <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap shrink-0">
                                                    Đã có hợp đồng
                                                  </span>
                                                  <a
                                                    href={order.contract_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[11px] flex items-center gap-1 transition-all shadow-xs whitespace-nowrap shrink-0"
                                                  >
                                                    <Eye className="w-3 h-3 shrink-0" /> Xem hợp đồng
                                                  </a>
                                                </>
                                              ) : (
                                                <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[11px] font-semibold border border-amber-200 whitespace-nowrap shrink-0">
                                                  Chưa có hợp đồng (Chờ Sales tải)
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          {/* Hóa đơn đỏ VAT */}
                                          <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
                                              <div className="flex items-center gap-2">
                                                <FileCheck className="w-4 h-4 text-emerald-600" />
                                                <span className="font-bold text-gray-800 text-xs">Thông tin xuất Hóa đơn VAT</span>
                                              </div>
                                              {requiresVat && (
                                                <div className="flex items-center gap-2">
                                                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                                                    order.invoice_status === 'issued' 
                                                      ? 'bg-green-100 text-green-800 border border-green-200' 
                                                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                  }`}>
                                                    {order.invoice_status === 'issued' ? 'Đã xuất VAT' : 'Chờ xuất'}
                                                  </span>
                                                  <button
                                                    onClick={() => setVatTarget({
                                                      orderId: order.id,
                                                      orderCode: order.id.substring(0,8),
                                                      targetStatus: order.invoice_status === 'issued' ? 'pending' : 'issued'
                                                    })}
                                                    className="px-2 py-0.5 bg-[#c1ff00] text-black hover:bg-[#b0eb00] border border-lime-400 rounded text-[11px] font-bold transition-colors cursor-pointer shadow-xs"
                                                  >
                                                    Đổi trạng thái
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                            {requiresVat ? (
                                              <div className="pl-6 space-y-0.5 text-xs text-gray-600 pt-0.5">
                                                <p>Công ty: <span className="text-gray-900 font-bold">{order.vat_company_name}</span></p>
                                                <p>MST: <span className="text-blue-700 font-mono font-bold">{order.vat_tax_code}</span></p>
                                                <p>Địa chỉ: <span className="text-gray-800 font-medium">{order.vat_address}</span></p>
                                                <p>Email: <span className="text-gray-800 font-medium">{order.vat_email}</span></p>
                                              </div>
                                            ) : (
                                              <p className="pl-6 text-xs text-gray-500 italic">Khách hàng không yêu cầu hóa đơn đỏ VAT</p>
                                            )}
                                          </div>

                                          {/* Chi tiết thanh toán */}
                                          <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                                            <div className="flex items-center gap-2">
                                              <Receipt className="w-4 h-4 text-indigo-600" />
                                              <span className="font-bold text-gray-800 text-xs">Chi tiết thanh toán & Dòng tiền</span>
                                            </div>
                                            <div className="pl-6 text-xs space-y-1 max-w-md">
                                              <div className="flex justify-between items-center">
                                                <span className="text-gray-500 font-medium">Giá trị đơn:</span>
                                                <span className="font-bold text-gray-900 text-xs sm:text-sm">{formatVND(order.total_price)}</span>
                                              </div>
                                              <div className="flex justify-between items-center">
                                                <span className="text-gray-500 font-medium">Đã thu:</span>
                                                <span className="font-bold text-emerald-600 text-xs sm:text-sm">
                                                  {formatVND(invoices
                                                    .filter(inv => inv.type === 'receipt' && inv.status === 'approved' && inv.order_id === order.id)
                                                    .reduce((sum, inv) => sum + inv.amount, 0))}
                                                </span>
                                              </div>
                                              <div className="flex justify-between items-center border-t border-gray-100 pt-1 font-bold">
                                                <span className="text-gray-600">Còn thiếu:</span>
                                                <span className="font-black text-rose-600 text-sm sm:text-base">
                                                  {formatVND(Math.max(0, order.total_price - invoices
                                                    .filter(inv => inv.type === 'receipt' && inv.status === 'approved' && inv.order_id === order.id)
                                                    .reduce((sum, inv) => sum + inv.amount, 0)))}
                                                </span>
                                              </div>
                                            </div>
                                          </div>

                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>

                        {/* 2. FOLDER: COSTS & PAYMENTS */}
                        <div className="border border-gray-150 rounded-xl overflow-hidden shadow-sm">
                          <button
                            onClick={() => toggleFolder('costs')}
                            className="w-full bg-slate-50/60 hover:bg-slate-50 px-4 py-3 flex items-center justify-between text-xs font-bold text-gray-800 border-b border-gray-150 transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              {expandedFolders['costs'] ? <FolderOpen className="w-4 h-4 text-emerald-500 fill-emerald-100" /> : <Folder className="w-4 h-4 text-emerald-500 fill-emerald-100" />}
                              Chi phí & Đối tác ({stats.partnerPayments.length} thanh toán)
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">Chứa chứng từ & ảnh chuyển khoản chi</span>
                          </button>

                          {expandedFolders['costs'] && (
                            <div className="p-4 bg-white space-y-4">
                              
                              {/* Subfolder: Ảnh chuyển khoản cho đối tác */}
                              <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/30">
                                <h5 className="text-[11px] font-extrabold text-gray-800 uppercase tracking-wider mb-2.5 flex items-center gap-1">
                                  <Folder className="w-3.5 h-3.5 text-blue-500 fill-blue-50" />
                                  Ảnh chuyển khoản & Ủy nhiệm chi của kế toán (Partner Payments)
                                </h5>

                                <div className="space-y-3.5">
                                  {stats.partnerPayments.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic py-2 text-center">Chưa phát sinh phiếu đề xuất chi đối tác nào.</p>
                                  ) : (
                                    stats.partnerPayments.map(pay => {
                                      const associatedInvoice = invoices.find(inv => inv.id === pay.invoiceId);
                                      const isPaid = associatedInvoice?.status === 'approved';
                                      
                                      return (
                                        <div key={pay.id} className="p-3 bg-white rounded-lg border border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                          <div className="space-y-1">
                                            <p className="font-bold text-gray-800 text-sm">{pay.partnerName}</p>
                                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                                              <span>Số tiền cần chi: <strong className="text-gray-700">{formatVND(pay.amountToPay)}</strong></span>
                                              <span>•</span>
                                              <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[8px] tracking-wider ${
                                                isPaid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                              }`}>
                                                {isPaid ? 'Đã chi tiền' : 'Chờ chuyển khoản'}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex flex-wrap items-center gap-2">
                                            {pay.voucherUrl && (
                                              <a
                                                href={pay.voucherUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold text-[10px] transition-all flex items-center gap-1"
                                              >
                                                <Eye className="w-3.5 h-3.5 text-amber-600" /> Ảnh xác nhận chi phí
                                              </a>
                                            )}
                                            {isPaid && associatedInvoice?.file_url ? (
                                              <a
                                                href={associatedInvoice.file_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-bold text-[10px] transition-all flex items-center gap-1"
                                              >
                                                <Eye className="w-3.5 h-3.5" /> Ảnh chuyển tiền (UNC)
                                              </a>
                                            ) : associatedInvoice ? (
                                              /* Let accountant approve right here! */
                                              <div className="flex items-center gap-1.5">
                                                <label className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg cursor-pointer text-[10px] font-bold shadow-sm transition-all flex items-center gap-1">
                                                  <Upload className="w-3.5 h-3.5" />
                                                  Duyệt chi & Tải UNC
                                                  <input
                                                    type="file"
                                                    accept="image/*,.pdf"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                      const file = e.target.files?.[0];
                                                      if (file) handleApprovePaymentInline(associatedInvoice.id, tour.code, file);
                                                    }}
                                                  />
                                                </label>
                                              </div>
                                            ) : (
                                              <span className="text-[10px] text-gray-400 italic">Chưa gửi yêu cầu phiếu chi</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>

                            </div>
                          )}
                        </div>

                        {/* 3. FOLDER: TOUR ITINERARY / LỊCH TRÌNH */}
                        <div className="border border-gray-150 rounded-xl overflow-hidden shadow-sm">
                          <button
                            onClick={() => toggleFolder('itinerary')}
                            className="w-full bg-slate-50/60 hover:bg-slate-50 px-4 py-3 flex items-center justify-between text-xs font-bold text-gray-800 border-b border-gray-150 transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              {expandedFolders['itinerary'] ? <FolderOpen className="w-4 h-4 text-emerald-500 fill-emerald-100" /> : <Folder className="w-4 h-4 text-emerald-500 fill-emerald-100" />}
                              Lịch trình tour & Thông tin chung
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">Bản đồ chương trình</span>
                          </button>

                          {expandedFolders['itinerary'] && (
                            <div className="p-4 bg-white text-xs space-y-3">
                              <div className="flex justify-between border-b border-slate-50 pb-2">
                                <span className="text-gray-400 font-medium">Khởi hành:</span>
                                <span className="font-bold text-gray-700">{tour.start_date ? format(new Date(tour.start_date), 'dd/MM/yyyy') : 'Chưa định ngày'}</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-50 pb-2">
                                <span className="text-gray-400 font-medium">Kết thúc:</span>
                                <span className="font-bold text-gray-700">{tour.end_date ? format(new Date(tour.end_date), 'dd/MM/yyyy') : 'Chưa định ngày'}</span>
                              </div>
                              {tour.itinerary_pdf_url && (
                                <div className="flex items-center justify-between pt-2">
                                  <span className="text-gray-700 font-semibold text-xs">Chương trình / Lịch trình tour</span>
                                  <a
                                    href={tour.itinerary_pdf_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold"
                                  >
                                    Xem PDF lịch trình
                                  </a>
                                </div>
                              )}
                              <p className="text-gray-500 leading-relaxed text-[11px] pt-1">
                                Tập tin lịch trình của mã tour <strong className="font-semibold text-gray-800">{tour.code}</strong>. Được cập nhật bởi bộ phận điều hành tour lữ hành.
                              </p>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>

                  </div>
                </div>
              );
            })()
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
                cho booking{' '}
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
                Vui lòng nhập lý do từ chối phiếu thu cho booking{' '}
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
                </strong>? Hành động này sẽ cập nhật trực tiếp vào số dư booking liên quan nếu có.
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
                disabled={isUploadingPaymentFile}
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
                disabled={isUploadingPaymentFile}
                onClick={async () => {
                  setIsUploadingPaymentFile(true);
                  try {
                    let fileUrl = '';
                    if (paymentFile) {
                      const targetOrder = orders.find(o => o.id === approvePaymentTarget.order_id);
                      const targetTour = targetOrder ? tours.find(t => t.id === targetOrder.tour_id) : null;
                      const parsedInfo = parseRefundInfo(approvePaymentTarget, orders, tours);
                      const resolvedTourCode = targetTour?.code || parsedInfo.tourCode || '';

                      const formData = new FormData();
                      formData.append('file', paymentFile);
                      if (targetOrder) formData.append('orderCode', targetOrder.id.substring(0, 8));
                      if (resolvedTourCode) formData.append('tourCode', resolvedTourCode);
                      if (!targetOrder && !resolvedTourCode) formData.append('orderCode', 'CHIPHI_TOUR');

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
                    setIsUploadingPaymentFile(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isUploadingPaymentFile ? (
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
                disabled={isUploadingPaymentFile}
                onClick={() => {
                  setPaymentFile(null);
                  setPaymentFileName('');
                  setUploadProofTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={!paymentFile || isUploadingPaymentFile}
                onClick={async () => {
                  if (!paymentFile) return;
                  setIsUploadingPaymentFile(true);
                  try {
                    const targetOrder = orders.find(o => o.id === uploadProofTarget.order_id);
                    const targetTour = targetOrder ? tours.find(t => t.id === targetOrder.tour_id) : null;
                    const parsedInfo = parseRefundInfo(uploadProofTarget, orders, tours);
                    const resolvedTourCode = targetTour?.code || parsedInfo.tourCode || '';

                    const formData = new FormData();
                    formData.append('file', paymentFile);
                    if (targetOrder) formData.append('orderCode', targetOrder.id.substring(0, 8));
                    if (resolvedTourCode) formData.append('tourCode', resolvedTourCode);
                    if (!targetOrder && !resolvedTourCode) formData.append('orderCode', 'CHIPHI_TOUR');

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
                    setUploadProofTarget(null);
                  } catch (err: any) {
                    console.error(err);
                    toast.error(err.message || 'Gặp lỗi khi lưu minh chứng');
                  } finally {
                    setIsUploadingPaymentFile(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isUploadingPaymentFile ? (
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
                  ? `Bạn có chắc chắn muốn xác nhận ĐÃ XUẤT hóa đơn tài chính VAT đỏ cho booking ${vatTarget.orderCode}?`
                  : `Bạn có chắc chắn muốn đánh dấu booking ${vatTarget.orderCode} là CHƯA XUẤT hóa đơn VAT đỏ?`
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

              {newPaymentData.payment_method === 'Chuyển khoản' && (
                <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-150 space-y-3">
                  <div className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Thông tin tài khoản nhận chuyển khoản
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Tên Ngân hàng <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        placeholder="VD: Vietcombank, Techcombank..."
                        value={newPaymentData.refund_bank_name}
                        onChange={(e) => setNewPaymentData({ ...newPaymentData, refund_bank_name: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Số tài khoản <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        placeholder="VD: 10123456789..."
                        value={newPaymentData.refund_account_number}
                        onChange={(e) => setNewPaymentData({ ...newPaymentData, refund_account_number: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-mono font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Chủ tài khoản <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        placeholder="VD: NGUYEN VAN A..."
                        value={newPaymentData.refund_account_name}
                        onChange={(e) => setNewPaymentData({ ...newPaymentData, refund_account_name: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-bold text-gray-900 uppercase focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
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
                  if (newPaymentData.payment_method === 'Chuyển khoản') {
                    if (!newPaymentData.refund_bank_name.trim() || !newPaymentData.refund_account_number.trim() || !newPaymentData.refund_account_name.trim()) {
                      toast.error('Vui lòng điền đầy đủ thông tin tài khoản chuyển khoản!');
                      return;
                    }
                  }
                  
                  try {
                    await createInvoiceReceipt({
                      order_id: newPaymentData.order_id,
                      amount: Number(newPaymentData.amount),
                      description: newPaymentData.description.trim(),
                      payment_method: newPaymentData.payment_method,
                      type: 'payment',
                      refund_method: newPaymentData.payment_method === 'Chuyển khoản' ? 'transfer' : 'cash',
                      refund_bank_name: newPaymentData.refund_bank_name,
                      refund_account_number: newPaymentData.refund_account_number,
                      refund_account_name: newPaymentData.refund_account_name,
                      created_by: profile?.full_name || 'Admin',
                    });
                    
                    toast.success('Tạo phiếu chi thành công!');
                    setIsCreatePaymentModalOpen(false);
                    setNewPaymentData({ 
                      amount: '', 
                      description: '', 
                      payment_method: 'Chuyển khoản', 
                      order_id: null,
                      refund_bank_name: '',
                      refund_account_number: '',
                      refund_account_name: '' 
                    });
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
