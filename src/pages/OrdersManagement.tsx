import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Select from 'react-select';
import { useCRM, canUnlockOrder } from '@/context/CRMContext';
import { useAuth } from '@/context/AuthContext';
import { Tour, Order, Passenger } from '@/types';
import { ShoppingCart, User, Users, Clock, AlertTriangle, FileText, Check, X, ShieldAlert, Plus, ArrowUpRight, ChevronDown, ChevronUp, ChevronRight, ShieldCheck, Trash2, Info, Edit, ExternalLink, AlertCircle, Search, CreditCard, DollarSign, TrendingUp, UploadCloud, CheckCircle, Eye, Upload, Lock, Unlock } from 'lucide-react';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';
import ActionModal from '../components/ActionModal';
import PassengerInputModal from '../components/PassengerInputModal';
import EditPassengerModal from '../components/EditPassengerModal';
import EditOrderModal from '../components/EditOrderModal';
import PaymentModal from '../components/PaymentModal';
import { PassengerDocumentList } from '../components/PassengerDocumentList';
import { parseRefundInfo } from '@/lib/utils';

export default function OrdersManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tours, orders: allOrders, passengers, invoices, createOrder, cancelOrder, requestExtension, confirmOrder, updatePassenger, addPassengersToOrder, updateOrder, createInvoiceReceipt, currentRole, profilesList } = useCRM();
  const { profile, user } = useAuth();

  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [orderFilterStatus, setOrderFilterStatus] = useState('hold');
  const [orderFilterTimeRange, setOrderFilterTimeRange] = useState('all');
  const [orderSortBy, setOrderSortBy] = useState('newest');
  const [contractUploadProgress, setContractUploadProgress] = useState<Record<string, boolean>>({});

  const handleUploadContract = async (orderId: string, orderCode: string, file: File) => {
    setContractUploadProgress(prev => ({ ...prev, [orderId]: true }));
    const toastId = toast.loading(`Đang tải hợp đồng của booking ${orderCode || orderId.substring(0,8)}...`);
    try {
      const targetOrder = allOrders.find(o => o.id === orderId);
      const targetTour = targetOrder ? tours.find(t => t.id === targetOrder.tour_id) : null;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('orderCode', orderId);
      if (targetTour?.code) {
        formData.append('tourCode', targetTour.code);
      }

      const response = await fetch('/api/upload-invoice-receipt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData = { error: 'Tải lên không thành công' };
        try { errorData = JSON.parse(errorText); } catch {}
        throw new Error(errorData.error || 'Tải lên không thành công');
      }

      const resText = await response.text();
      let resData;
      try {
        resData = JSON.parse(resText);
      } catch {
        throw new Error('Định dạng phản hồi từ máy chủ không đúng.');
      }
      await updateOrder(orderId, { contract_url: resData.url });
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
      console.error(err);
      toast.error(err.message || 'Lỗi khi gỡ hợp đồng', { id: toastId });
    }
  };

  // Xử lý click từ thông báo
  useEffect(() => {
    if (location.state?.searchTarget) {
      setOrderSearchTerm(location.state.searchTarget);
      setOrderFilterStatus('all'); // Mở rộng bộ lọc
      setOrderFilterTimeRange('all');

      // Clear state để không tự nhảy lại khi F5
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const orders = React.useMemo(() => {
    // 1. Filter by role/ownership
    let filtered = ['admin', 'operator', 'sale_leader'].includes(currentRole)
      ? allOrders
      : allOrders.filter(o => o.user_id === profile?.id);

    // 2. Filter out Visa-only service orders (separation of concerns)
    filtered = filtered.filter(o => {
      const tour = tours.find(t => t.id === o.tour_id);
      return tour?.tour_type !== 'visa';
    });

    // 3. Search term filter (code, booker_name, booker_phone, tour code, tour name)
    if (orderSearchTerm.trim() !== '') {
      const q = orderSearchTerm.toLowerCase().trim();
      filtered = filtered.filter(o => {
        const tour = tours.find(t => t.id === o.tour_id);
        const nameMatch = o.booker_name && o.booker_name.toLowerCase().includes(q);
        const phoneMatch = o.booker_phone && o.booker_phone.includes(q);
        const codeMatch = o.id && o.id.toLowerCase().includes(q);
        const tourCodeMatch = tour && tour.code && tour.code.toLowerCase().includes(q);
        const tourNameMatch = tour && tour.name && tour.name.toLowerCase().includes(q);
        return nameMatch || phoneMatch || codeMatch || tourCodeMatch || tourNameMatch;
      });
    }

    // 4. Status filter
    if (orderFilterStatus !== 'all') {
      filtered = filtered.filter(o => {
        if (orderFilterStatus === 'paid') {
          return o.status === 'paid' || o.status === 'sure';
        }
        if (orderFilterStatus === 'refund') {
          return o.status === 'cancelled' && invoices.some(inv => inv.order_id === o.id && inv.type === 'payment');
        }
        if (orderFilterStatus === 'cancelled') {
          return o.status === 'cancelled' && !invoices.some(inv => inv.order_id === o.id && inv.type === 'payment');
        }
        return o.status === orderFilterStatus;
      });
    }

    // 5. Time range filter
    if (orderFilterTimeRange !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      filtered = filtered.filter(o => {
        if (!o.created_at) return false;
        const orderDate = new Date(o.created_at);
        orderDate.setHours(0, 0, 0, 0);

        if (orderFilterTimeRange === 'today') {
          return orderDate.getTime() === today.getTime();
        } else if (orderFilterTimeRange === 'this_week') {
          const firstDay = new Date(today);
          firstDay.setDate(today.getDate() - today.getDay() + 1);
          const lastDay = new Date(firstDay);
          lastDay.setDate(firstDay.getDate() + 6);
          return orderDate >= firstDay && orderDate <= lastDay;
        } else if (orderFilterTimeRange === 'this_month') {
          return orderDate.getMonth() === today.getMonth() && orderDate.getFullYear() === today.getFullYear();
        }
        return true;
      });
    }

    // Sort logic
    return [...filtered].sort((a, b) => {
      if (orderSortBy === 'newest') {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      } else if (orderSortBy === 'oldest') {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateA - dateB;
      } else if (orderSortBy === 'highest_price') {
        return (b.total_price || 0) - (a.total_price || 0);
      } else if (orderSortBy === 'lowest_price') {
        return (a.total_price || 0) - (b.total_price || 0);
      } else if (orderSortBy === 'hold_expiry') {
        const expA = a.hold_expiry ? new Date(a.hold_expiry).getTime() : Infinity;
        const expB = b.hold_expiry ? new Date(b.hold_expiry).getTime() : Infinity;
        return expA - expB;
      }
      return 0;
    });
  }, [allOrders, currentRole, profile, tours, orderSearchTerm, orderFilterStatus, orderFilterTimeRange, orderSortBy, invoices]);

  const holdStatistics = React.useMemo(() => {
    const stats: Record<string, { orderCount: number; seatsHold: number; detailTours: Record<string, number> }> = {};

    allOrders.forEach(o => {
      if (o.status === 'hold') {
        const creator = o.created_by || 'Chưa rõ';
        const tour = tours.find(t => t.id === o.tour_id);
        const tourCode = tour?.code || 'Chưa rõ Tour';
        const seats = (o.adult_count || 0) + (o.child_count || 0);

        if (!stats[creator]) {
          stats[creator] = {
            orderCount: 0,
            seatsHold: 0,
            detailTours: {}
          };
        }

        stats[creator].orderCount += 1;
        stats[creator].seatsHold += seats;
        stats[creator].detailTours[tourCode] = (stats[creator].detailTours[tourCode] || 0) + seats;
      }
    });

    return Object.entries(stats).map(([creator, data]) => ({
      creator,
      ...data
    })).sort((a, b) => b.seatsHold - a.seatsHold);
  }, [allOrders, tours]);

  const salesOverviewStats = React.useMemo(() => {
    // 1. Filter by role/ownership
    let baseOrders = ['admin', 'operator', 'sale_leader'].includes(currentRole)
      ? allOrders
      : allOrders.filter(o => o.user_id === profile?.id);

    // 2. Filter out Visa-only service orders
    baseOrders = baseOrders.filter(o => {
      const tour = tours.find(t => t.id === o.tour_id);
      return tour?.tour_type !== 'visa';
    });

    const slotsHold = baseOrders
      .filter(o => o.status === 'hold')
      .reduce((sum, o) => sum + (o.adult_count || 0) + (o.child_count || 0), 0);

    const slotsSure = baseOrders
      .filter(o => ['sure', 'paid'].includes(o.status))
      .reduce((sum, o) => sum + (o.adult_count || 0) + (o.child_count || 0), 0);

    const totalRev = baseOrders
      .filter(o => ['sure', 'paid'].includes(o.status))
      .reduce((sum, o) => sum + (o.total_price || 0), 0);

    const totalPaid = baseOrders
      .filter(o => ['sure', 'paid'].includes(o.status))
      .reduce((sum, o) => {
        const orderInvoices = invoices.filter(inv => inv.order_id === o.id);
        const approvedPaid = orderInvoices
          .filter(inv => inv.type === 'receipt' && inv.status === 'approved')
          .reduce((s, inv) => s + inv.amount, 0);
        return sum + (approvedPaid || o.paid_amount || 0);
      }, 0);

    const totalRemaining = Math.max(0, totalRev - totalPaid);

    const holdOrdersCount = baseOrders.filter(o => o.status === 'hold').length;
    const sureOrdersCount = baseOrders.filter(o => ['sure', 'paid'].includes(o.status)).length;

    return {
      slotsHold,
      slotsSure,
      totalRevenue: totalRev,
      totalPaid,
      totalRemaining,
      holdOrdersCount,
      sureOrdersCount
    };
  }, [allOrders, currentRole, profile, tours, invoices]);

  // Tính số lượng đơn hàng cho từng tab (sau khi đã áp dụng tìm kiếm, lọc thời gian...)
  const tabCounts = React.useMemo(() => {
    // 1. Filter by role/ownership
    let base = ['admin', 'operator', 'sale_leader'].includes(currentRole)
      ? allOrders
      : allOrders.filter(o => o.user_id === profile?.id);

    // 2. Filter out Visa-only service orders
    base = base.filter(o => {
      const tour = tours.find(t => t.id === o.tour_id);
      return tour?.tour_type !== 'visa';
    });

    // 3. Search term filter
    if (orderSearchTerm.trim() !== '') {
      const q = orderSearchTerm.toLowerCase().trim();
      base = base.filter(o => {
        const tour = tours.find(t => t.id === o.tour_id);
        const nameMatch = o.booker_name && o.booker_name.toLowerCase().includes(q);
        const phoneMatch = o.booker_phone && o.booker_phone.includes(q);
        const codeMatch = o.id && o.id.toLowerCase().includes(q);
        const tourCodeMatch = tour && tour.code && tour.code.toLowerCase().includes(q);
        const tourNameMatch = tour && tour.name && tour.name.toLowerCase().includes(q);
        return nameMatch || phoneMatch || codeMatch || tourCodeMatch || tourNameMatch;
      });
    }

    // 4. Time range filter
    if (orderFilterTimeRange !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      base = base.filter(o => {
        if (!o.created_at) return false;
        const orderDate = new Date(o.created_at);
        orderDate.setHours(0, 0, 0, 0);

        if (orderFilterTimeRange === 'today') {
          return orderDate.getTime() === today.getTime();
        } else if (orderFilterTimeRange === 'this_week') {
          const firstDay = new Date(today);
          firstDay.setDate(today.getDate() - today.getDay() + 1);
          const lastDay = new Date(firstDay);
          lastDay.setDate(firstDay.getDate() + 6);
          return orderDate >= firstDay && orderDate <= lastDay;
        } else if (orderFilterTimeRange === 'this_month') {
          return orderDate.getMonth() === today.getMonth() && orderDate.getFullYear() === today.getFullYear();
        }
        return true;
      });
    }

    return {
      paid: base.filter(o => o.status === 'paid' || o.status === 'sure').length,
      hold: base.filter(o => o.status === 'hold').length,
      cancelled: base.filter(o => o.status === 'cancelled' && !invoices.some(inv => inv.order_id === o.id && inv.type === 'payment')).length,
      refund: base.filter(o => o.status === 'cancelled' && invoices.some(inv => inv.order_id === o.id && inv.type === 'payment')).length,
      total: base.length
    };
  }, [allOrders, currentRole, profile, tours, orderSearchTerm, orderFilterTimeRange, invoices]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [activeTabs, setActiveTabs] = useState<Record<string, 'details' | 'payment_history'>>({});
  const [isPassengerModalOpen, setIsPassengerModalOpen] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<string | null>(null);
  const [orderToAddPassengers, setOrderToAddPassengers] = useState<string | null>(null);
  const [editingPassenger, setEditingPassenger] = useState<Passenger | null>(null);
  const [isEditPassengerOpen, setIsEditPassengerOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [disqualifiedReasonModal, setDisqualifiedReasonModal] = useState<{ name: string; reason: string } | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isEditOrderOpen, setIsEditOrderOpen] = useState(false);
  const [selectedInvoiceNote, setSelectedInvoiceNote] = useState<{ code: string; note: string } | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [isCancelPaymentModalOpen, setIsCancelPaymentModalOpen] = useState(false);
  const [cancelPaymentOrder, setCancelPaymentOrder] = useState<Order | null>(null);
  const [cancelPaymentReason, setCancelPaymentReason] = useState('');
  const [cancelPaymentRefundAmount, setCancelPaymentRefundAmount] = useState<number>(0);
  const [cancelPaymentRefundInput, setCancelPaymentRefundInput] = useState('');
  const [cancelConfirmFile, setCancelConfirmFile] = useState<File | null>(null);
  const [cancelRefundMethod, setCancelRefundMethod] = useState<'cash' | 'transfer'>('transfer');
  const [cancelRefundBankName, setCancelRefundBankName] = useState('');
  const [cancelRefundAccountNumber, setCancelRefundAccountNumber] = useState('');
  const [cancelRefundAccountName, setCancelRefundAccountName] = useState('');
  const [isCancelUploading, setIsCancelUploading] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (input?: string) => void;
    showInput?: boolean;
    inputPlaceholder?: string;
    inputLabel?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrderId(prev => prev === orderId ? null : orderId);
  };

  // New Order Form State
  const [selectedTourId, setSelectedTourId] = useState('');
  const [orderStatus, setOrderStatus] = useState<'hold' | 'sure'>('hold');

  // Booker/Representative
  const [bookerName, setBookerName] = useState('');
  const [bookerPhone, setBookerPhone] = useState('');
  const [suggestions, setSuggestions] = useState<Passenger[]>([]);
  const [focusedInput, setFocusedInput] = useState<'name' | 'phone' | null>(null);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const normalizePhone = (phone: string) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('84') && cleaned.length > 2) {
      cleaned = '0' + cleaned.substring(2);
    }
    return cleaned;
  };

  const removeDiacritics = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  };

  // Get unique customers from all passengers in database
  const uniqueCustomers = React.useMemo(() => {
    const map = new Map<string, Passenger>();
    passengers.forEach(p => {
      if (p.full_name) {
        const key = `${p.full_name.trim().toUpperCase()}|${p.phone ? normalizePhone(p.phone) : ''}`;
        if (!map.has(key)) {
          map.set(key, p);
        }
      }
    });
    return Array.from(map.values());
  }, [passengers]);

  useEffect(() => {
    if (focusedInput === 'phone') {
      const searchPhone = normalizePhone(bookerPhone);
      if (searchPhone.length >= 3) {
        const matches = uniqueCustomers.filter(c => c.phone && normalizePhone(c.phone).includes(searchPhone));
        setSuggestions(matches.slice(0, 5));
      } else {
        setSuggestions([]);
      }
    } else if (focusedInput === 'name') {
      const searchName = removeDiacritics(bookerName.trim().toLowerCase());
      if (searchName.length >= 2) {
        const matches = uniqueCustomers.filter(c => c.full_name && removeDiacritics(c.full_name.toLowerCase()).includes(searchName));
        setSuggestions(matches.slice(0, 5));
      } else {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  }, [bookerPhone, bookerName, focusedInput, uniqueCustomers]);

  const selectSuggestion = (p: Passenger) => {
    setBookerName(p.full_name);
    setBookerPhone(p.phone || '');
    setSuggestions([]);
    setFocusedInput(null);
  };

  // Passenger counts
  const [adultCount, setAdultCount] = useState<number>(1);
  const [childCount, setChildCount] = useState<number>(0);
  const [infantCount, setInfantCount] = useState<number>(0);

  // Surcharges & Advanced
  const [singleRoomCount, setSingleRoomCount] = useState<number>(0);
  const [roomShareInfo, setRoomShareInfo] = useState<string>('Không ghép');
  const [specialRequests, setSpecialRequests] = useState<string>('');
  const [vatOption, setVatOption] = useState<string>('Không xuất VAT');
  const [vatCompanyName, setVatCompanyName] = useState<string>('');
  const [vatTaxCode, setVatTaxCode] = useState<string>('');
  const [vatAddress, setVatAddress] = useState<string>('');
  const [vatEmail, setVatEmail] = useState<string>('');

  // Countdown timer for form completion
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds

  useEffect(() => {
    if (!showCreateForm) return;
    setCountdown(300);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowCreateForm(false);
          toast('Thời hạn nhập thông tin giữ chỗ (5 phút) đã hết! Form đặt chỗ đã tự động đóng để nhường tài nguyên hệ thống.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showCreateForm]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedTour = tours.find(t => t.id === selectedTourId);

  const handleTourChange = (tourId: string) => {
    setSelectedTourId(tourId);
    if (!tourId) return;
    const targetTour = tours.find(t => t.id === tourId);
    if (!targetTour) return;

    const maxAllowed = Math.max(0, targetTour.total_seats + (targetTour.overbook_limit || 0) - targetTour.sold_seats - targetTour.hold_seats);
    if (adultCount + childCount > maxAllowed) {
      let newAdult = Math.min(adultCount, maxAllowed);
      if (newAdult < 1) newAdult = 1;
      const remainingForChild = maxAllowed - newAdult;
      const newChild = Math.min(childCount, remainingForChild);

      setAdultCount(newAdult);
      setChildCount(newChild);

      toast(`Tour mới chọn chỉ cho phép tối đa ${maxAllowed} chỗ (bao gồm cả overbooking được phê duyệt)! Số lượng khách đã được điều chỉnh về mức tối đa: ${newAdult} người lớn, ${newChild} trẻ em.`);
    }
  };

  const handleAdultCountChange = (val: number) => {
    if (!selectedTour) return;
    const maxAllowed = Math.max(0, selectedTour.total_seats + (selectedTour.overbook_limit || 0) - selectedTour.sold_seats - selectedTour.hold_seats);
    const potentialTotal = val + childCount;
    if (potentialTotal > maxAllowed) {
      const allowedAdult = Math.max(1, maxAllowed - childCount);
      setAdultCount(allowedAdult);
      toast.error(`Số lượng khách vượt quá số chỗ trống và overbooking cho phép! Hệ thống tự động giới hạn tối đa ${allowedAdult} người lớn (trong tổng số ${maxAllowed} chỗ khả dụng còn lại).`);
    } else {
      setAdultCount(Math.max(1, val));
    }
  };

  const handleChildCountChange = (val: number) => {
    if (!selectedTour) return;
    const maxAllowed = Math.max(0, selectedTour.total_seats + (selectedTour.overbook_limit || 0) - selectedTour.sold_seats - selectedTour.hold_seats);
    const potentialTotal = adultCount + val;
    if (potentialTotal > maxAllowed) {
      const allowedChild = Math.max(0, maxAllowed - adultCount);
      setChildCount(allowedChild);
      toast.error(`Số lượng khách vượt quá số chỗ trống và overbooking cho phép! Hệ thống tự động giới hạn tối đa ${allowedChild} trẻ em (trong tổng số ${maxAllowed} chỗ khả dụng còn lại).`);
    } else {
      setChildCount(Math.max(0, val));
    }
  };

  const priceAdult = selectedTour ? (selectedTour.price_adult ?? (selectedTour.price - (selectedTour.discount || 0))) : 0;
  const priceChild = selectedTour ? (selectedTour.price_child ?? Math.round((selectedTour.price - (selectedTour.discount || 0)) * 0.8)) : 0;
  const priceInfant = selectedTour ? (selectedTour.price_infant ?? Math.round((selectedTour.price - (selectedTour.discount || 0)) * 0.3)) : 0;
  const singleRoomSurcharge = selectedTour ? (selectedTour.single_room_surcharge ?? 7500000) : 0;

  const subtotalPrice = selectedTour
    ? (priceAdult * adultCount) + (priceChild * childCount) + (priceInfant * infantCount) + (singleRoomSurcharge * singleRoomCount)
    : 0;

  const vatAmount = vatOption === 'Xuất VAT' ? Math.round(subtotalPrice * 0.1) : 0;
  const calculatedTotalPrice = subtotalPrice + vatAmount;

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTourId) {
      toast.error('Vui lòng chọn Tour khởi hành!');
      return;
    }

    if (!bookerName.trim() || !bookerPhone.trim()) {
      toast.error('Vui lòng nhập đầy đủ Họ và tên và Số điện thoại khách trưởng nhóm!');
      return;
    }

    const orderPassengers: any[] = [];
    const finalBookerName = bookerName.trim();
    const finalBookerPhone = bookerPhone.trim();

    // Create lead passenger
    orderPassengers.push({
      is_payer: true,
      full_name: finalBookerName,
      phone: finalBookerPhone,
      visa_status: 'pending'
    });

    // Add remaining adults
    for (let i = 1; i < adultCount; i++) {
      orderPassengers.push({
        is_payer: false,
        full_name: `Người lớn #${i + 1} (Đi cùng)`,
        visa_status: 'pending'
      });
    }

    // Add children
    for (let i = 0; i < childCount; i++) {
      orderPassengers.push({
        is_payer: false,
        full_name: `Trẻ em #${i + 1} (Đi cùng)`,
        visa_status: 'not_required'
      });
    }

    // Add infants
    for (let i = 0; i < infantCount; i++) {
      orderPassengers.push({
        is_payer: false,
        full_name: `Trẻ nhỏ #${i + 1} (Đi cùng)`,
        visa_status: 'not_required'
      });
    }

    const partnerDisplayName = profile?.full_name || user?.email || 'Ẩn danh';
    const roleLabel = currentRole === 'CTV' ? 'CTV' : currentRole === 'Đại lý' ? 'Đại lý' : currentRole === 'sale' ? 'Sale' : currentRole === 'sale_leader' ? 'Sale Leader' : currentRole === 'operator' ? 'Điều hành' : 'Quản trị viên';
    const creatorFullName = `${roleLabel} - ${partnerDisplayName}`;

    const executeCreateOrder = () => {
      createOrder({
        tour_id: selectedTourId,
        status: orderStatus,
        total_price: calculatedTotalPrice,
        adult_price: priceAdult,
        passengers: orderPassengers,
        booker_name: finalBookerName,
        booker_phone: finalBookerPhone,
        created_by: creatorFullName,
        user_id: profile?.id,
        adult_count: adultCount,
        child_count: childCount,
        infant_count: infantCount,
        single_room_count: singleRoomCount,
        room_share_info: roomShareInfo,
        vat_option: vatOption,
        vat_company_name: vatCompanyName,
        vat_tax_code: vatTaxCode,
        vat_address: vatAddress,
        vat_email: vatEmail,
        special_requests: specialRequests,
        is_locked: true,
      });

      // Reset Form
      setSelectedTourId('');
      setOrderStatus('hold');
      setBookerName('');
      setBookerPhone('');
      setAdultCount(1);
      setChildCount(0);
      setInfantCount(0);
      setSingleRoomCount(0);
      setRoomShareInfo('Không ghép');
      setSpecialRequests('');
      setVatOption('Không xuất VAT');
      setVatCompanyName('');
      setVatTaxCode('');
      setVatAddress('');
      setVatEmail('');
      setShowCreateForm(false);
    };

    if (!['admin', 'sale_leader'].includes(currentRole)) {
      setConfirmModalData({
        isOpen: true,
        title: '🔒 Cảnh báo: Tự động khóa booking sau khi lưu',
        message: 'Sau khi lưu thông tin booking này, hệ thống sẽ TỰ ĐỘNG KHÓA các thông tin giá tiền, VAT, phụ thu & doanh thu để bảo vệ dữ liệu kế toán. Chỉ Quản trị viên (Admin) hoặc Sale Leader mới có quyền mở khóa. Bạn có chắc chắn muốn tiến hành tạo booking không?',
        onConfirm: executeCreateOrder
      });
      return;
    }

    executeCreateOrder();
  };

  // Helper to format remaining hold time
  const getRemainingHoldTime = (expiryString?: string) => {
    if (!expiryString) return null;
    const expiry = new Date(expiryString);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    if (diffMs <= 0) return 'Đã hết hạn';

    const hours = Math.floor(diffMs / (3600 * 1000));
    const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
    return `${hours} giờ ${mins} phút`;
  };

  const getHoldTimeSeverity = (expiryString?: string) => {
    if (!expiryString) return 'normal';
    const expiry = new Date(expiryString);
    const now = new Date();
    const diffHours = differenceInHours(expiry, now);
    if (diffHours < 4) return 'danger';
    if (diffHours < 12) return 'warning';
    return 'normal';
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Quản lý Booking (Sales & Đại lý)</h2>
          <p className="text-sm text-gray-500 mt-1">
            Giữ chỗ tạm thời, chốt chắc chắn (Sure) và theo dõi đếm ngược thời hạn giải phóng booking tự động.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center px-4 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          {showCreateForm ? 'Đóng form' : 'Tạo Booking Mới'}
        </button>
      </div>

      {/* Overview Statistics Cards Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4 font-sans">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-950 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>Bảng Tổng quan Giữ chỗ & Doanh thu</span>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                ['admin', 'operator', 'sale_leader'].includes(currentRole)
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
                {['admin', 'operator', 'sale_leader'].includes(currentRole) ? 'Toàn hệ thống (Admin/Leader/Điều hành)' : 'Cá nhân (Sales/CTV)'}
              </span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Tổng số chỗ giữ tạm, số chỗ đã xác nhận chắc chắn, doanh số và dư nợ cần nộp.</p>
          </div>
          <span className="text-xs text-gray-400 font-medium italic hidden sm:inline">Cập nhật theo thời gian thực</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Slots Hold */}
          <div className="bg-amber-50/40 rounded-xl p-4 border border-amber-200/60 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Chỗ giữ tạm (HOLD)</span>
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 border border-amber-200/50">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-950">{salesOverviewStats.slotsHold}</span>
              <span className="text-xs font-bold text-amber-700">chỗ</span>
            </div>
            <p className="text-[11px] text-amber-600/95 mt-1 font-semibold">
              Từ {salesOverviewStats.holdOrdersCount} đơn đang giữ chỗ tạm
            </p>
          </div>

          {/* Card 2: Slots Sure */}
          <div className="bg-green-50/40 rounded-xl p-4 border border-green-200/60 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-green-800 uppercase tracking-wider">Chỗ đã chốt (SURE)</span>
              <div className="p-1.5 rounded-lg bg-green-100 text-green-700 border border-green-200/50">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-green-950">{salesOverviewStats.slotsSure}</span>
              <span className="text-xs font-bold text-green-700">chỗ</span>
            </div>
            <p className="text-[11px] text-green-600/95 mt-1 font-semibold">
              Từ {salesOverviewStats.sureOrdersCount} đơn chốt chắc chắn / đã mua
            </p>
          </div>

          {/* Card 3: Total Revenue */}
          <div className="bg-blue-50/40 rounded-xl p-4 border border-blue-200/60 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Doanh thu chốt (SURE)</span>
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 border border-blue-200/50">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black text-blue-950 break-all">
                {new Intl.NumberFormat('vi-VN').format(salesOverviewStats.totalRevenue)}đ
              </span>
              <span className="text-[10px] text-blue-600/90 mt-1 font-medium">
                Giá trị từ các đơn SURE & PAID
              </span>
            </div>
          </div>

          {/* Card 4: Total Paid */}
          <div className="bg-teal-50/40 rounded-xl p-4 border border-teal-200/60 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">Đã thanh toán</span>
              <div className="p-1.5 rounded-lg bg-teal-100 text-teal-700 border border-teal-200/50">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black text-teal-950 break-all">
                {new Intl.NumberFormat('vi-VN').format(salesOverviewStats.totalPaid)}đ
              </span>
              <span className="text-[10px] text-teal-600/90 mt-1 font-medium">
                Số tiền kế toán đã duyệt thực thu
              </span>
            </div>
          </div>

          {/* Card 5: Remaining Debt */}
          <div className="bg-rose-50/40 rounded-xl p-4 border border-rose-200/60 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Còn lại cần nộp</span>
              <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 border border-rose-200/50">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black text-rose-950 break-all">
                {new Intl.NumberFormat('vi-VN').format(salesOverviewStats.totalRemaining)}đ
              </span>
              <span className="text-[10px] text-rose-600/90 mt-1 font-medium">
                Số dư còn lại khách cần hoàn tất
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hold Statistics Dashboard */}
      {['admin', 'operator', 'sale_leader'].includes(currentRole) && holdStatistics.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4 font-sans">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-4.5 h-4.5 text-blue-600" />
              <span>Thống kê giữ chỗ theo Đối tác (Sale / CTV / Đại lý)</span>
              <span className="bg-blue-50 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                {holdStatistics.length} đối tác đang giữ chỗ
              </span>
            </h3>
            <span className="text-xs text-gray-400 font-medium italic">Tự động cập nhật theo thời gian thực</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {holdStatistics.map((stat, idx) => (
              <div key={idx} className="bg-slate-50/70 rounded-xl p-4 border border-gray-150 hover:border-blue-200 hover:bg-slate-50 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-extrabold text-sm text-gray-800 line-clamp-1" title={stat.creator}>
                      {stat.creator}
                    </span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0">
                      {stat.seatsHold} chỗ
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 font-semibold">
                    Đang giữ {stat.orderCount} booking tạm tính
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-gray-200/60 space-y-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Chi tiết Tour giữ chỗ:</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {Object.entries(stat.detailTours).map(([tourCode, count]) => (
                      <span key={tourCode} className="inline-flex items-center bg-white px-2 py-0.5 rounded text-[10px] font-bold text-gray-700 border border-gray-200">
                        {tourCode}: <strong className="text-blue-600 ml-1 font-extrabold">{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Order Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateOrder} className="bg-white rounded-xl border border-gray-200 shadow-md p-6 space-y-6 animate-in slide-in-from-top-4 duration-200 relative">
          {/* Form Header with live countdown */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 gap-3 bg-slate-50 -mx-6 -mt-6 p-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2 text-blue-600" />
                Phiếu thông tin giữ chỗ & Đặt tour
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Vui lòng hoàn thành thông tin đặt giữ chỗ theo biểu mẫu tiêu chuẩn dưới đây.</p>
            </div>
            <div className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold ${countdown < 60 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-green-100 text-green-700'}`}>
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              <span>Cửa sổ sẽ tự đóng sau {formatCountdown(countdown)} phút!</span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Step 1: Choose Tour and Hold type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Chọn Tour du lịch *</label>
                <Select
                  placeholder="-- Chọn Tour khởi hành --"
                  options={tours
                    .filter(t => t.tour_type !== 'visa')
                    .map(t => {
                      const maxAllowed = Math.max(0, t.total_seats + (t.overbook_limit || 0) - t.sold_seats - t.hold_seats);
                      return {
                        value: t.id,
                        label: `[${t.code}] ${t.name} (Còn ${t.available_seats} chỗ${t.overbook_limit ? `, OB tối đa: +${t.overbook_limit}` : ''})`,
                        isDisabled: maxAllowed <= 0
                      };
                    })}
                  value={tours.find(t => t.id === selectedTourId) ? {
                    value: selectedTourId,
                    label: `[${tours.find(t => t.id === selectedTourId)?.code}] ${tours.find(t => t.id === selectedTourId)?.name} (Còn ${tours.find(t => t.id === selectedTourId)?.available_seats} chỗ${tours.find(t => t.id === selectedTourId)?.overbook_limit ? `, OB tối đa: +${tours.find(t => t.id === selectedTourId)?.overbook_limit}` : ''})`
                  } : null}
                  onChange={(option: any) => handleTourChange(option ? option.value : '')}
                  className="text-sm"
                  isClearable
                  menuPortalTarget={document.body}
                  styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Hình thức giữ chỗ *</label>
                <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse flex-shrink-0"></span>
                    <div>
                      <div className="font-bold text-blue-900 text-sm">Hold tạm thời</div>
                      <div className="text-xs text-blue-700 mt-0.5">
                        Hệ thống tự động nhả chỗ sau {selectedTour?.hold_duration_hours || 48} giờ. Booking sẽ chuyển sang Sure chỗ sau khi ghi nhận thanh toán.
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold bg-blue-100 text-blue-800 px-3 py-1 rounded-lg border border-blue-200 whitespace-nowrap ml-2">Hold</span>
                </div>
              </div>
            </div>

            {/* Display Tour Price List if selected */}
            {selectedTour && (
              <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700">Bảng giá tour áp dụng</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div className="bg-white p-2.5 rounded border border-gray-200">
                    <span className="text-gray-500 block">Người lớn (≥ 10 tuổi):</span>
                    <span className="font-bold text-gray-900">{new Intl.NumberFormat('vi-VN').format(priceAdult)} VND</span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-gray-200">
                    <span className="text-gray-500 block">Trẻ em (2 - dưới 10):</span>
                    <span className="font-bold text-gray-900">{new Intl.NumberFormat('vi-VN').format(priceChild)} VND</span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-gray-200">
                    <span className="text-gray-500 block">Trẻ nhỏ (&lt; 2 tuổi):</span>
                    <span className="font-bold text-gray-900">{new Intl.NumberFormat('vi-VN').format(priceInfant)} VND</span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-gray-200">
                    <span className="text-gray-500 block">Phụ thu phòng đơn:</span>
                    <span className="font-bold text-red-600">{new Intl.NumberFormat('vi-VN').format(singleRoomSurcharge)} VND</span>
                  </div>
                </div>
              </div>
            )}

            {/* Section 1: Booker info */}
            <div className="border-t border-gray-150 pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-gray-900 flex items-center">
                  <span className="w-1.5 h-3.5 bg-blue-600 rounded mr-2 inline-block"></span>
                  1. Thông tin khách đặt tour
                </h4>
                {uniqueCustomers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCustomerSelector(!showCustomerSelector)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-150 transition-all shadow-sm"
                  >
                    <Users className="w-3.5 h-3.5" />
                    {showCustomerSelector ? 'Đóng tìm kiếm' : 'Chọn từ khách hàng cũ'}
                  </button>
                )}
              </div>

              {showCustomerSelector && (
                <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Tìm theo tên, SĐT hoặc hộ chiếu..."
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                      value={customerSearchQuery}
                      onChange={e => setCustomerSearchQuery(e.target.value)}
                    />
                    {customerSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setCustomerSearchQuery('')}
                        className="text-xs text-gray-500 hover:text-gray-700 font-medium shrink-0 bg-white border border-gray-200 px-2 py-1 rounded"
                      >
                        Xoá
                      </button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-gray-150 border border-gray-200 rounded-lg bg-white shadow-inner">
                    {uniqueCustomers
                      .filter(c => {
                        const q = removeDiacritics(customerSearchQuery.toLowerCase().trim());
                        if (!q) return true;
                        const nameMatch = c.full_name && removeDiacritics(c.full_name.toLowerCase()).includes(q);
                        const phoneMatch = c.phone && normalizePhone(c.phone).includes(q);
                        const passportMatch = c.passport_number && c.passport_number.toLowerCase().includes(q);
                        return nameMatch || phoneMatch || passportMatch;
                      })
                      .map(c => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setBookerName(c.full_name);
                            setBookerPhone(c.phone || '');
                            setShowCustomerSelector(false);
                          }}
                          className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex justify-between items-center text-xs transition-colors"
                        >
                          <div>
                            <div className="font-bold text-slate-800">{c.full_name}</div>
                            {c.passport_number && (
                              <div className="text-[10px] text-gray-500 font-mono mt-0.5">Hộ chiếu: {c.passport_number}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-blue-600">{c.phone || 'Chưa có SĐT'}</div>
                            {c.dob && (
                              <div className="text-[10px] text-gray-400 mt-0.5">NS: {c.dob}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    {uniqueCustomers.filter(c => {
                      const q = removeDiacritics(customerSearchQuery.toLowerCase().trim());
                      if (!q) return true;
                      const nameMatch = c.full_name && removeDiacritics(c.full_name.toLowerCase()).includes(q);
                      const phoneMatch = c.phone && normalizePhone(c.phone).includes(q);
                      const passportMatch = c.passport_number && c.passport_number.toLowerCase().includes(q);
                      return nameMatch || phoneMatch || passportMatch;
                    }).length === 0 && (
                      <div className="text-center py-4 text-xs text-gray-400 font-medium">
                        Không tìm thấy khách hàng nào khớp.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`relative ${focusedInput === 'name' ? 'z-30' : 'z-20'}`}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Họ và tên khách trưởng nhóm *</label>
                    <input
                      type="text"
                      required
                      placeholder="Nhập họ và tên trưởng nhóm đại diện"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold uppercase"
                      value={bookerName}
                      onChange={e => setBookerName(e.target.value.toUpperCase())}
                      onFocus={() => setFocusedInput('name')}
                      onBlur={() => setTimeout(() => setFocusedInput(null), 250)}
                    />
                    {focusedInput === 'name' && suggestions.length > 0 && (
                      <div className="absolute z-50 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-xl divide-y divide-gray-100">
                        {suggestions.map(p => (
                          <div
                            key={p.id}
                            className="px-3.5 py-2.5 hover:bg-blue-50 cursor-pointer text-xs flex justify-between items-center"
                            onMouseDown={() => selectSuggestion(p)}
                          >
                            <div>
                              <div className="font-bold text-slate-800">{p.full_name}</div>
                              {p.passport_number && (
                                <span className="text-[10px] text-gray-400 font-mono">HC: {p.passport_number}</span>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-blue-600">{p.phone || 'Chưa có SĐT'}</div>
                              {p.dob && (
                                <div className="text-[9px] text-gray-400">NS: {p.dob}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={`relative ${focusedInput === 'phone' ? 'z-30' : 'z-10'}`}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Số điện thoại liên hệ *</label>
                    <input
                      type="text"
                      required
                      placeholder="Nhập số điện thoại trưởng nhóm"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold"
                      value={bookerPhone}
                      onChange={e => setBookerPhone(e.target.value)}
                      onFocus={() => setFocusedInput('phone')}
                      onBlur={() => setTimeout(() => setFocusedInput(null), 250)}
                    />
                    {focusedInput === 'phone' && suggestions.length > 0 && (
                      <div className="absolute z-50 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-xl divide-y divide-gray-100">
                        {suggestions.map(p => (
                          <div
                            key={p.id}
                            className="px-3.5 py-2.5 hover:bg-blue-50 cursor-pointer text-xs flex justify-between items-center"
                            onMouseDown={() => selectSuggestion(p)}
                          >
                            <div>
                              <div className="font-bold text-slate-800">{p.full_name}</div>
                              {p.passport_number && (
                                <span className="text-[10px] text-gray-400 font-mono">HC: {p.passport_number}</span>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-blue-600">{p.phone || 'Chưa có SĐT'}</div>
                              {p.dob && (
                                <div className="text-[9px] text-gray-400">NS: {p.dob}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
            </div>

            {/* Section 2: Classified guest counts */}
            <div className="border-t border-gray-150 pt-4 space-y-4">
              <h4 className="text-sm font-bold text-gray-900 flex items-center">
                <span className="w-1.5 h-3.5 bg-blue-600 rounded mr-2 inline-block"></span>
                2. Số lượng khách phân loại để tính giá tạm tính
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-gray-200 space-y-1">
                  <label className="block text-xs font-bold text-gray-700">Số người lớn (≥ 10 tuổi) *</label>
                  <span className="text-[10px] text-gray-500 block pb-1">Tính 100% biểu giá người lớn</span>
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm bg-white font-bold text-blue-700"
                    value={adultCount}
                    onChange={e => handleAdultCountChange(Number(e.target.value))}
                  />
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-gray-200 space-y-1">
                  <label className="block text-xs font-bold text-gray-700">Số trẻ em (2 - dưới 10 tuổi)</label>
                  <span className="text-[10px] text-gray-500 block pb-1">Tính theo giá trẻ em của tour</span>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm bg-white font-bold"
                    value={childCount}
                    onChange={e => handleChildCountChange(Number(e.target.value))}
                  />
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-gray-200 space-y-1">
                  <label className="block text-xs font-bold text-gray-700">Số trẻ nhỏ (&lt; 2 tuổi)</label>
                  <span className="text-[10px] text-gray-500 block pb-1">Tính theo giá trẻ nhỏ của tour</span>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm bg-white font-bold"
                    value={infantCount}
                    onChange={e => setInfantCount(Math.max(0, Number(e.target.value)))}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Surcharges and Advanced Options */}
            <div className="border-t border-gray-150 pt-4 space-y-4">
              <h4 className="text-sm font-bold text-gray-900 flex items-center">
                <span className="w-1.5 h-3.5 bg-blue-600 rounded mr-2 inline-block"></span>
                3. Phụ thu & Tùy chọn nâng cao
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-600">Số lượng phụ thu phòng đơn</label>
                  <span className="text-[10px] text-gray-500 block">Cộng thêm đơn giá phòng đơn quy định</span>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    value={singleRoomCount}
                    onChange={e => setSingleRoomCount(Math.max(0, Number(e.target.value)))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-600">Thông tin ghép phòng (Lẻ nam / Lẻ nữ)</label>
                  <span className="text-[10px] text-gray-500 block">Lựa chọn ghép nhóm hoặc đi lẻ</span>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    value={roomShareInfo}
                    onChange={e => setRoomShareInfo(e.target.value)}
                  >
                    <option value="Không ghép">Không ghép (Tự sắp xếp)</option>
                    <option value="Lẻ nam">Lẻ nam (Mong muốn ghép phòng nam)</option>
                    <option value="Lẻ nữ">Lẻ nữ (Mong muốn ghép phòng nữ)</option>
                    <option value="Yêu cầu khác">Yêu cầu ghép linh hoạt khác</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-600">Yêu cầu xuất hóa đơn VAT</label>
                  <span className="text-[10px] text-gray-500 block">Hóa đơn giá trị gia tăng</span>
                  <div className="flex gap-4 pt-1">
                    <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name="vatOption"
                        value="Không xuất VAT"
                        className="text-blue-600 focus:ring-blue-500"
                        checked={vatOption === 'Không xuất VAT'}
                        onChange={() => setVatOption('Không xuất VAT')}
                      />
                      <span>Không xuất VAT</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name="vatOption"
                        value="Xuất VAT"
                        className="text-blue-600 focus:ring-blue-500"
                        checked={vatOption === 'Xuất VAT'}
                        onChange={() => setVatOption('Xuất VAT')}
                      />
                      <span>Xuất hoá đơn VAT</span>
                    </label>
                  </div>
                </div>
                {vatOption === 'Xuất VAT' && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3 mb-4">
                    <h4 className="text-xs font-bold text-gray-700 uppercase mb-2">Thông tin xuất hóa đơn</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Tên công ty <span className="text-red-500">*</span></label>
                        <input type="text" value={vatCompanyName} onChange={e => setVatCompanyName(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm bg-white" placeholder="CÔNG TY TNHH..." required />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Mã số thuế <span className="text-red-500">*</span></label>
                        <input type="text" value={vatTaxCode} onChange={e => setVatTaxCode(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm bg-white" placeholder="Nhập mã số thuế..." required />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Địa chỉ xuất hóa đơn <span className="text-red-500">*</span></label>
                        <input type="text" value={vatAddress} onChange={e => setVatAddress(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm bg-white" placeholder="Địa chỉ đăng ký kinh doanh..." required />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Email nhận hóa đơn <span className="text-red-500">*</span></label>
                        <input type="email" value={vatEmail} onChange={e => setVatEmail(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm bg-white" placeholder="Email nhận hóa đơn điện tử..." required />
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-600">Yêu cầu đặc biệt (Ghi chú thêm)</label>
                  <span className="text-[10px] text-gray-500 block">Ăn chay, dị ứng, trẻ sơ sinh...</span>
                  <textarea
                    rows={2}
                    placeholder="Nhập các yêu cầu ăn uống, phòng ở đặc biệt..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    value={specialRequests}
                    onChange={e => setSpecialRequests(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pricing calculation summary */}
          {selectedTour && (
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-150 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="text-xs space-y-1 text-gray-700">
                <div className="font-semibold text-blue-800 text-sm">Tổng hợp chi tiết tạm tính:</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                  <div>• Người lớn ({adultCount}):</div>
                  <div className="font-semibold">{new Intl.NumberFormat('vi-VN').format(priceAdult * adultCount)} VND</div>
                  {childCount > 0 && (
                    <>
                      <div>• Trẻ em ({childCount}):</div>
                      <div className="font-semibold">{new Intl.NumberFormat('vi-VN').format(priceChild * childCount)} VND</div>
                    </>
                  )}
                  {infantCount > 0 && (
                    <>
                      <div>• Trẻ nhỏ ({infantCount}):</div>
                      <div className="font-semibold">{new Intl.NumberFormat('vi-VN').format(priceInfant * infantCount)} VND</div>
                    </>
                  )}
                  {singleRoomCount > 0 && (
                    <>
                      <div>• Phụ thu phòng đơn ({singleRoomCount}):</div>
                      <div className="font-semibold text-red-600">{new Intl.NumberFormat('vi-VN').format(singleRoomSurcharge * singleRoomCount)} VND</div>
                    </>
                  )}
                  {vatOption === 'Xuất VAT' && (
                    <>
                      <div>• Thuế VAT (10%):</div>
                      <div className="font-semibold text-blue-600">+{new Intl.NumberFormat('vi-VN').format(vatAmount)} VND</div>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right sm:border-l sm:border-gray-200 sm:pl-6 shrink-0 w-full sm:w-auto">
                <div className="text-xs text-gray-500 font-medium">Tổng giá trị giữ chỗ tạm tính</div>
                <div className="text-2xl font-black text-red-600">
                  {new Intl.NumberFormat('vi-VN').format(calculatedTotalPrice)} VND
                </div>
                <span className="text-[10px] text-gray-400 font-medium">Đã bao gồm thuế phí áp dụng</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 bg-slate-50 -mx-6 -mb-6 p-6">
            <button
              type="button"
              onClick={() => {
                // reset form
                setBookerName('');
                setBookerPhone('');
                setAdultCount(1);
                setChildCount(0);
                setInfantCount(0);
                setSingleRoomCount(0);
                setRoomShareInfo('Không ghép');
                setSpecialRequests('');
                setVatOption('Không xuất VAT');
    setVatCompanyName('');
    setVatTaxCode('');
    setVatAddress('');
    setVatEmail('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 bg-white transition-colors"
            >
              Nhập lại (Reset)
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 bg-white transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all"
            >
              Lưu thông tin giữ chỗ
            </button>
          </div>
        </form>
      )}

      {/* Orders list and monitoring */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-150 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>Danh sách Booking của bạn</span>
          </h3>
          <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full border border-gray-250 shrink-0">
            Đang hiển thị: {orders.length} booking
          </span>
        </div>

        {/* Tabs phân loại trạng thái trực quan và sang trọng */}
        <div className="flex border-b border-gray-200 bg-white">
          <button
            onClick={() => setOrderFilterStatus('hold')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-4 px-6 text-sm font-bold border-b-2 transition-all relative ${
              orderFilterStatus === 'hold'
                ? 'border-amber-500 text-amber-600 bg-amber-50/10'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/30'
            }`}
          >
            <Clock className={`w-4.5 h-4.5 ${orderFilterStatus === 'hold' ? 'text-amber-500' : 'text-gray-400'}`} />
            <span>Giữ chỗ</span>
            <span className={orderFilterStatus === 'hold'
              ? 'text-[11px] px-2 py-0.5 rounded-full font-black bg-amber-100 text-amber-800'
              : 'text-[11px] px-2 py-0.5 rounded-full font-black bg-gray-100 text-gray-600'
            }>
              {tabCounts.hold}
            </span>
          </button>

          <button
            onClick={() => setOrderFilterStatus('paid')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-4 px-6 text-sm font-bold border-b-2 transition-all relative ${
              orderFilterStatus === 'paid'
                ? 'border-blue-500 text-blue-600 bg-blue-50/10'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/30'
            }`}
          >
            <CreditCard className={`w-4.5 h-4.5 ${orderFilterStatus === 'paid' ? 'text-blue-500' : 'text-gray-400'}`} />
            <span>Đã thanh toán</span>
            <span className={orderFilterStatus === 'paid'
              ? 'text-[11px] px-2 py-0.5 rounded-full font-black bg-blue-100 text-blue-800'
              : 'text-[11px] px-2 py-0.5 rounded-full font-black bg-gray-100 text-gray-600'
            }>
              {tabCounts.paid}
            </span>
          </button>

          <button
            onClick={() => setOrderFilterStatus('cancelled')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-4 px-6 text-sm font-bold border-b-2 transition-all relative ${
              orderFilterStatus === 'cancelled'
                ? 'border-slate-500 text-slate-700 bg-slate-50/20'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/30'
            }`}
          >
            <X className={`w-4.5 h-4.5 ${orderFilterStatus === 'cancelled' ? 'text-slate-500' : 'text-gray-400'}`} />
            <span>Đã hủy</span>
            <span className={orderFilterStatus === 'cancelled'
              ? 'text-[11px] px-2 py-0.5 rounded-full font-black bg-slate-100 text-slate-700'
              : 'text-[11px] px-2 py-0.5 rounded-full font-black bg-gray-100 text-gray-600'
            }>
              {tabCounts.cancelled}
            </span>
          </button>

          <button
            onClick={() => setOrderFilterStatus('refund')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-4 px-6 text-sm font-bold border-b-2 transition-all relative ${
              orderFilterStatus === 'refund'
                ? 'border-rose-500 text-rose-600 bg-rose-50/10'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/30'
            }`}
          >
            <DollarSign className={`w-4.5 h-4.5 ${orderFilterStatus === 'refund' ? 'text-rose-500' : 'text-gray-400'}`} />
            <span>Hủy hoàn tiền</span>
            <span className={orderFilterStatus === 'refund'
              ? 'text-[11px] px-2 py-0.5 rounded-full font-black bg-rose-100 text-rose-800'
              : 'text-[11px] px-2 py-0.5 rounded-full font-black bg-gray-100 text-gray-600'
            }>
              {tabCounts.refund}
            </span>
          </button>
        </div>

        {/* Filters and Sorting Controls (Adjusted to grid-cols-3) */}
        <div className="bg-slate-50 border-b border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Tìm kiếm */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </span>
            <input
              type="text"
              placeholder="Tìm mã, khách, tour..."
              value={orderSearchTerm}
              onChange={e => setOrderSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Lọc thời gian tạo */}
          <select
            value={orderFilterTimeRange}
            onChange={e => setOrderFilterTimeRange(e.target.value)}
            className="w-full pl-3 pr-10 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Mọi thời gian</option>
            <option value="today">Hôm nay</option>
            <option value="this_week">Tuần này</option>
            <option value="this_month">Tháng này</option>
          </select>

          {/* Sắp xếp */}
          <select
            value={orderSortBy}
            onChange={e => setOrderSortBy(e.target.value)}
            className="w-full pl-3 pr-10 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="newest">Sắp xếp: Mới nhất</option>
            <option value="oldest">Sắp xếp: Cũ nhất</option>
            <option value="highest_price">Sắp xếp: Tổng tiền giảm dần</option>
            <option value="lowest_price">Sắp xếp: Tổng tiền tăng dần</option>
            <option value="hold_expiry">Sắp xếp: Hạn giữ chỗ gần nhất</option>
          </select>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">Bạn chưa có đơn đặt chỗ nào hoặc không tìm thấy kết quả phù hợp với bộ lọc.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-150">
            {orders.map(order => {
              const tour = tours.find(t => t.id === order.tour_id);
              const orderPassengers = passengers.filter(p => p.order_id === order.id);
              const leadPassenger = orderPassengers.find(p => p.is_payer) || orderPassengers[0];
              const timeSeverity = getHoldTimeSeverity(order.hold_expiry);
              const remainingTime = getRemainingHoldTime(order.hold_expiry);
              const isExpanded = expandedOrderId === order.id;
              const orderInvoices = invoices.filter(inv => inv.order_id === order.id);
              const approvedPaidAmount = orderInvoices.filter(inv => inv.type === 'receipt' && inv.status === 'approved').reduce((sum, inv) => sum + inv.amount, 0);
              const hasApprovedReceipt = approvedPaidAmount > 0;
              const isPartiallyPaid = hasApprovedReceipt && approvedPaidAmount < order.total_price;
              const isFullyPaid = hasApprovedReceipt && approvedPaidAmount >= order.total_price;

              const visaPassengersCount = orderPassengers.filter(p => p.needs_visa_service).length;
              const priceAdult = tour?.price_adult || (tour?.price - (tour?.discount || 0)) || 0;
              const priceChild = tour?.price_child || Math.round(priceAdult * 0.9);
              const priceInfant = tour?.price_infant || Math.round(priceAdult * 0.3);
              const singleRoomSurcharge = tour?.single_room_surcharge || 0;
              const priceVisaTour = tour?.price_visa_tour || 0;

              const totalAdult = (order.adult_count || 0) * priceAdult;
              const totalChild = (order.child_count || 0) * priceChild;
              const totalInfant = (order.infant_count || 0) * priceInfant;
              const totalSingleRoom = (order.single_room_count || 0) * singleRoomSurcharge;
              const totalVisa = visaPassengersCount * priceVisaTour;

              const totalSubtotal = totalAdult + totalChild + totalInfant + totalSingleRoom + totalVisa;
              const discountAmount = order.discount_type === 'percent'
                ? (totalSubtotal * (order.discount_value || 0)) / 100
                : (order.discount_value || 0);
              const customSurchargeAmount = order.surcharge_amount || 0;
              const totalBeforeVat = totalSubtotal - discountAmount + customSurchargeAmount;
              const computedVat = order.vat_option === 'Xuất VAT' ? Math.round(totalBeforeVat * 0.1) : 0;

              return (
                <div
                  key={order.id}
                  className={`transition-all duration-200 ${
                    isExpanded
                      ? 'bg-blue-50/10'
                      : 'hover:bg-gray-50/60'
                  }`}
                >
                  {/* Summary / Header block clickable */}
                  <div
                    onClick={() => toggleOrderExpand(order.id)}
                    className="p-5 flex flex-col gap-3.5 cursor-pointer select-none"
                  >
                    {/* Row 1: Core Information Grid */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Order ID & Time */}
                      <div className="flex items-center gap-3.5 min-w-[150px] shrink-0">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 border border-blue-100">
                          <ShoppingCart className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-black text-gray-900 text-sm tracking-tight">#{order.id.substring(0, 8)}</div>
                          <div className="text-[11px] text-gray-400 font-medium mt-0.5">
                            {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}
                          </div>
                        </div>
                      </div>

                      {/* Tour info (Full Name) */}
                      <div className="flex-1 min-w-[240px]">
                        <div className="inline-block px-1.5 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/60 rounded uppercase tracking-wider">{tour?.code}</div>
                        <div className="text-sm font-bold text-gray-800 mt-1 break-words leading-relaxed" title={tour?.name}>
                          {tour?.name}
                        </div>
                      </div>

                      {/* Representative guest */}
                      <div className="min-w-[170px] shrink-0">
                        <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Khách trưởng nhóm</div>
                        <div className="text-sm font-bold text-gray-800 mt-0.5">
                          {(order.booker_name && !order.booker_name.includes('Giữ chỗ tạm'))
                            ? order.booker_name
                            : (leadPassenger?.full_name || 'Chưa cung cấp')}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {order.booker_phone || leadPassenger?.phone || 'Chưa cung cấp'}
                        </div>
                      </div>

                      {/* Quantity of guests */}
                      <div className="min-w-[130px] shrink-0">
                        <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Tổng hành khách</div>
                        <div className="inline-flex items-center gap-1.5 mt-1 bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-700 border border-slate-200">
                          <Users className="w-3.5 h-3.5" />
                          <span>
                            {order.adult_count !== undefined ? ((order.adult_count || 0) + (order.child_count || 0) + (order.infant_count || 0)) : orderPassengers.length} người
                          </span>
                        </div>
                        {order.adult_count !== undefined && (
                          <div className="text-[10px] text-gray-400 font-semibold mt-1">
                            ({order.adult_count}NL {order.child_count ? `- ${order.child_count}TE` : ''} {order.infant_count ? `- ${order.infant_count}TN` : ''})
                          </div>
                        )}
                      </div>

                      {/* Total Booking Cost */}
                      <div className="min-w-[140px] shrink-0">
                        <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Tổng cộng</div>
                        <div className="text-base font-black text-rose-600 mt-0.5">
                          {new Intl.NumberFormat('vi-VN').format(order.total_price)} VND
                        </div>
                      </div>

                      {/* Non-hold Status & Expand Indicator */}
                      <div className="flex items-center justify-between lg:justify-end gap-3.5 min-w-[110px] shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-gray-100">
                        <div>
                          {order.status === 'sure' && !hasApprovedReceipt && (
                            <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Sure chỗ
                            </span>
                          )}
                          {(order.payment_status === 'paid' || isFullyPaid) && order.status !== 'cancelled' && (
                            <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              Đã thanh toán
                            </span>
                          )}
                          {(order.status === 'sure' && isPartiallyPaid && order.payment_status !== 'paid') && (
                            <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                              Thanh toán một phần
                            </span>
                          )}
                          {order.status === 'cancelled' && (() => {
                            const refundInvoices = invoices.filter(inv => inv.order_id === order.id && inv.type === 'payment');
                            if (refundInvoices.length === 0) {
                              return orderFilterStatus !== 'refund' ? (
                                <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-slate-50 text-slate-400 border border-slate-200">
                                  Đã huỷ
                                </span>
                              ) : null;
                            }

                            const anyApproved = refundInvoices.some(inv => inv.status === 'approved');
                            const anyPending = refundInvoices.some(inv => inv.status === 'pending');
                            const allRejected = refundInvoices.every(inv => inv.status === 'rejected');

                            let progressText = '';
                            let progressStyle = '';

                            if (anyApproved && !anyPending) {
                              progressText = 'Hoàn tiền: Hoàn tất';
                              progressStyle = 'bg-green-50 text-green-700 border-green-200';
                            } else if (anyApproved && anyPending) {
                              progressText = 'Hoàn tiền: Đang xử lý';
                              progressStyle = 'bg-cyan-50 text-cyan-700 border-cyan-200 animate-pulse';
                            } else if (allRejected) {
                              progressText = 'Hoàn tiền: Từ chối';
                              progressStyle = 'bg-rose-50 text-rose-700 border-rose-200';
                            } else {
                              progressText = 'Hoàn tiền: Chờ duyệt';
                              progressStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                            }

                            return (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {orderFilterStatus !== 'refund' && (
                                  <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-slate-50 text-slate-400 border border-slate-200">
                                    Đã huỷ
                                  </span>
                                )}
                                <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full border ${progressStyle}`}>
                                  {progressText}
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="text-gray-400 p-1 hover:bg-slate-100 rounded-full transition-colors ml-auto lg:ml-0">
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-blue-600" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Hold Status and Remaining Time Banner (Separate Row) */}
                    {order.status === 'hold' && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-dashed border-gray-200 pt-3 mt-1 bg-amber-50/50 p-3 rounded-lg border border-amber-100/60">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider mr-1">Chế độ đặt chỗ:</span>
                          <span className="inline-flex items-center px-3 py-1 text-xs font-black uppercase tracking-wider rounded-lg bg-amber-500 text-white shadow-sm">
                            Giữ chỗ tạm (Hold)
                          </span>
                        </div>
                        {remainingTime && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Thời gian hết hạn tự động còn:</span>
                            <span className={`inline-flex items-center text-xs font-bold px-3 py-1 rounded-lg border shadow-sm ${
                              timeSeverity === 'danger' ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' :
                              timeSeverity === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              <Clock className="w-3.5 h-3.5 mr-1.5" />
                              {remainingTime}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expandable Details Container */}
                  {isExpanded && (() => {
                    const orderInvoices = invoices
                      .filter(inv => inv.order_id === order.id)
                      .sort((a, b) => {
                        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                        return dateB - dateA;
                      });
                    const approvedPaid = orderInvoices.filter(inv => inv.type === 'receipt' && inv.status === 'approved').reduce((sum, inv) => sum + inv.amount, 0);
                    const pendingPaid = orderInvoices.filter(inv => inv.type === 'receipt' && inv.status === 'pending').reduce((sum, inv) => sum + inv.amount, 0);
                    const remainingAmount = Math.max(0, order.total_price - approvedPaid);
                    const currentTab = activeTabs[order.id] || 'details';

                    return (
                      <div className="px-5 pb-6 pt-3 bg-slate-50/40 border-t border-gray-100 space-y-5 animate-in fade-in duration-150">
                        {/* Tabs Bar */}
                        <div className="flex border-b border-gray-200 gap-1">
                          <button
                            type="button"
                            onClick={() => setActiveTabs(prev => ({ ...prev, [order.id]: 'details' }))}
                            className={`py-2 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                              currentTab === 'details'
                                ? 'border-blue-600 text-blue-600 bg-white shadow-sm font-extrabold'
                                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50'
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                            Chi tiết booking
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTabs(prev => ({ ...prev, [order.id]: 'payment_history' }))}
                            className={`py-2 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                              currentTab === 'payment_history'
                                ? 'border-blue-600 text-blue-600 bg-white shadow-sm font-extrabold'
                                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50'
                            }`}
                          >
                            <DollarSign className="w-4 h-4 text-emerald-600" />
                            Lịch sử thanh toán
                            {orderInvoices.length > 0 && (
                              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black rounded-full bg-blue-100 text-blue-800">
                                {orderInvoices.length}
                              </span>
                            )}
                          </button>
                        </div>

                        {currentTab === 'details' ? (
                          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                        {/* Box 1: Surcharges & Room config */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm space-y-3.5">
                          <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-blue-600" />
                              Phụ thu & Dịch vụ
                            </span>
                            {/* Nút sửa booking */}
                            {(['admin', 'operator'].includes(currentRole) || order.user_id === profile?.id || order.created_by === profile?.full_name) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingOrder(order);
                                  setIsEditOrderOpen(true);
                                }}
                                className="text-blue-600 hover:text-blue-800 text-[10px] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit className="w-3 h-3" />
                                Chỉnh sửa
                              </button>
                            )}
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                              <span className="text-gray-500">Phòng đơn:</span>
                              <span className="font-bold text-gray-900">
                                {order.single_room_count ? `${order.single_room_count} phòng` : 'Không'}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                              <span className="text-gray-500">Ghép giường:</span>
                              <span className="font-semibold text-gray-800">{order.room_share_info || 'Không'}</span>
                            </div>
                            <div className="flex flex-col py-2 border-b border-dashed border-gray-100">
                              <div className="flex justify-between">
                                <span className="text-gray-500">VAT:</span>
                                <span className={`font-bold ${order.vat_option === 'Xuất VAT' ? 'text-blue-600' : 'text-gray-500'}`}>
                                  {order.vat_option || 'Không'}
                                </span>
                              </div>
                              {order.vat_option === 'Xuất VAT' && (
                                <div className="mt-2 p-2 bg-blue-50/50 rounded-md border border-blue-100 space-y-1">
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">Công ty:</span>
                                    <span className="font-semibold text-slate-700 text-right">{order.vat_company_name || '---'}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">MST:</span>
                                    <span className="font-semibold text-slate-700 text-right">{order.vat_tax_code || '---'}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">Địa chỉ:</span>
                                    <span className="font-semibold text-slate-700 text-right line-clamp-2" title={order.vat_address || ''}>{order.vat_address || '---'}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">Email:</span>
                                    <span className="font-semibold text-slate-700 text-right">{order.vat_email || '---'}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            {order.special_requests && (
                              <div className="pt-2">
                                <span className="text-gray-500 block mb-1">Ghi chú đặc biệt:</span>
                                <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-amber-900 italic leading-relaxed text-[11px]">
                                  "{order.special_requests}"
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Box 1.5: Detailed Pricing Breakdown */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm space-y-3.5">
                          <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2 flex items-center gap-1.5">
                            <CreditCard className="w-4 h-4 text-rose-500" />
                            Chi tiết bảng tính giá
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                              <span className="text-gray-500">NL ({order.adult_count}):</span>
                              <span className="font-bold text-gray-900">{new Intl.NumberFormat('vi-VN').format(totalAdult)} đ</span>
                            </div>
                            {order.child_count > 0 && (
                              <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                                <span className="text-gray-500">TE ({order.child_count}):</span>
                                <span className="font-bold text-gray-900">{new Intl.NumberFormat('vi-VN').format(totalChild)} đ</span>
                              </div>
                            )}
                            {order.infant_count > 0 && (
                              <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                                <span className="text-gray-500">TN ({order.infant_count}):</span>
                                <span className="font-bold text-gray-900">{new Intl.NumberFormat('vi-VN').format(totalInfant)} đ</span>
                              </div>
                            )}
                            {totalSingleRoom > 0 && (
                              <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                                <span className="text-gray-500">Phòng đơn:</span>
                                <span className="font-bold text-red-600">{new Intl.NumberFormat('vi-VN').format(totalSingleRoom)} đ</span>
                              </div>
                            )}
                            {totalVisa > 0 && (
                              <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                                <span className="text-gray-500">Visa ({visaPassengersCount}):</span>
                                <span className="font-bold text-blue-600">+{new Intl.NumberFormat('vi-VN').format(totalVisa)} đ</span>
                              </div>
                            )}
                            {(order.discount_value || 0) > 0 && (
                              <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                                <span className="text-rose-500">Giảm giá {order.discount_type === 'percent' ? `(${order.discount_value}%)` : ''} : </span>
                                <span className="font-bold text-rose-600">-{new Intl.NumberFormat('vi-VN').format(
                                  order.discount_type === 'percent'
                                    ? ((totalAdult + totalChild + totalInfant + totalSingleRoom) * (order.discount_value || 0)) / 100
                                    : (order.discount_value || 0)
                                )} đ</span>
                              </div>
                            )}
                            {(order.surcharge_amount || 0) > 0 && (
                              <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                                <span className="text-blue-500">{order.surcharge_name || 'Phụ thu khác'}:</span>
                                <span className="font-bold text-blue-600">+{new Intl.NumberFormat('vi-VN').format(order.surcharge_amount || 0)} đ</span>
                              </div>
                            )}
                            {order.vat_option === 'Xuất VAT' && (
                              <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                                <span className="text-gray-500">Thuế VAT (10%):</span>
                                <span className="font-bold text-blue-600">+{new Intl.NumberFormat('vi-VN').format(computedVat)} đ</span>
                              </div>
                            )}
                            <div className="flex justify-between py-2 mt-1 bg-slate-50 px-2 rounded border border-slate-100">
                              <span className="font-black text-gray-900 uppercase text-[10px]">Tổng cộng:</span>
                              <span className="font-black text-rose-600">{new Intl.NumberFormat('vi-VN').format(order.total_price)} đ</span>
                            </div>
                          </div>
                        </div>

                        {/* Box 2: Full passenger manifests or Hold Overview */}
                        {order.status === 'hold' ? (
                          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm space-y-4 lg:col-span-2">
                            <div className="border-b border-gray-100 pb-2 flex items-center justify-between">
                              <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-amber-500" />
                                Tổng quan hành khách giữ chỗ ({order.adult_count !== undefined ? ((order.adult_count || 0) + (order.child_count || 0) + (order.infant_count || 0)) : orderPassengers.length || 1} khách)
                              </h4>
                              <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded border border-amber-150 uppercase tracking-wider">
                                Trạng thái: Giữ chỗ tạm
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 space-y-2.5">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Cơ cấu hành khách</span>
                                <div className="space-y-2 text-xs">
                                  <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-100">
                                    <span className="text-gray-600 font-medium">Người lớn (Adult):</span>
                                    <span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-150">
                                      {order.adult_count !== undefined ? (order.adult_count || 0) : orderPassengers.filter(p => !p.full_name.includes('Trẻ em') && !p.full_name.includes('Trẻ nhỏ')).length || 1} khách
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-100">
                                    <span className="text-gray-600 font-medium">Trẻ em (Child, 2-11 tuổi):</span>
                                    <span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-150">
                                      {order.child_count !== undefined ? (order.child_count || 0) : orderPassengers.filter(p => p.full_name.includes('Trẻ em')).length} khách
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center py-1">
                                    <span className="text-gray-600 font-medium">Trẻ nhỏ (Infant, &lt;2 tuổi):</span>
                                    <span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-150">
                                      {order.infant_count !== undefined ? (order.infant_count || 0) : orderPassengers.filter(p => p.full_name.includes('Trẻ nhỏ')).length} khách
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 space-y-2.5">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Thông tin liên hệ đặt chỗ</span>
                                <div className="space-y-2 text-xs">
                                  <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-100">
                                    <span className="text-gray-600 font-medium">Người đặt chỗ:</span>
                                    <span className="font-bold text-gray-900">
                                      {(order.booker_name && !order.booker_name.includes('Giữ chỗ tạm'))
                                        ? order.booker_name
                                        : (leadPassenger?.full_name || 'Chưa cung cấp')}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-100">
                                    <span className="text-gray-600 font-medium">Số điện thoại:</span>
                                    <span className="font-mono font-bold text-gray-900">
                                      {order.booker_phone || leadPassenger?.phone || 'Chưa cung cấp'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-100">
                                    <span className="text-gray-600 font-medium">Sales / CTV phụ trách:</span>
                                    <span className="font-bold text-blue-700">
                                      {order.created_by || 'Chưa rõ'}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between py-1.5 border-t border-dashed border-gray-100 mt-1 pt-1 gap-2">
                                    <span className="text-gray-600 font-medium flex items-center gap-1.5 whitespace-nowrap">
                                      <FileText className="w-4 h-4 text-blue-600 shrink-0" /> Hợp đồng dịch vụ:
                                    </span>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {order.contract_url ? (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                            Đã tải hợp đồng
                                          </span>
                                          <a
                                            href={order.contract_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-bold text-[10px] flex items-center gap-1 transition-all whitespace-nowrap"
                                          >
                                            <Eye className="w-3 h-3 shrink-0" /> Xem
                                          </a>
                                          {(['admin', 'operator'].includes(currentRole) || order.user_id === profile?.id || order.created_by === profile?.full_name) && (
                                            <button
                                              onClick={() => handleDeleteContract(order.id)}
                                              className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded transition-colors cursor-pointer shrink-0"
                                              title="Gỡ hợp đồng"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <label className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer text-[10px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm whitespace-nowrap">
                                            <Upload className="w-3 h-3 shrink-0" />
                                            Tải hợp đồng lên
                                            <input
                                              type="file"
                                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                              className="hidden"
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleUploadContract(order.id, order.id.substring(0,8), file);
                                              }}
                                              disabled={contractUploadProgress[order.id]}
                                            />
                                          </label>
                                          {contractUploadProgress[order.id] && <Clock className="w-3 h-3 animate-spin text-blue-600 shrink-0" />}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-blue-50/60 border border-blue-100/80 rounded-xl p-3.5 text-blue-800 flex items-start gap-2.5">
                              <Info className="w-4.5 h-4.5 shrink-0 mt-0.5 text-blue-500" />
                              <div className="space-y-0.5">
                                <p className="font-bold text-xs">Yêu cầu khai báo thông tin & Hồ sơ Visa</p>
                                <p className="text-gray-600 leading-relaxed text-[11px]">
                                  Trong trạng thái giữ chỗ tạm thời, hệ thống chỉ hiển thị tổng quan số lượng khách đặt chỗ để tối ưu hóa hiệu năng hiển thị.
                                  Bản khai chi tiết từng hành khách (Họ tên, Ngày sinh, Hộ chiếu) và chức năng tải lên hồ sơ Visa sẽ tự động kích hoạt sau khi booking được chuyển sang trạng thái <strong>Sure chỗ (Xác nhận chắc chắn)</strong>.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm space-y-3.5 lg:col-span-2">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                              <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-emerald-600" />
                                Bản khai hành khách & Visa ({orderPassengers.length} / {(order.adult_count || 0) + (order.child_count || 0) + (order.infant_count || 0)} khách)
                              </h4>
                              {((order.adult_count || 0) + (order.child_count || 0) + (order.infant_count || 0) - orderPassengers.length) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setOrderToAddPassengers(order.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Nhập thông tin {(order.adult_count || 0) + (order.child_count || 0) + (order.infant_count || 0) - orderPassengers.length} khách còn thiếu
                                </button>
                              )}
                            </div>
                            {orderPassengers.length === 0 ? (
                              <p className="text-xs text-gray-500 italic py-4 text-center">Chưa có thông tin chi tiết từng hành khách. Vui lòng thêm khách hàng.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-xs text-left text-gray-700 table-auto">
                                  <thead>
                                    <tr className="border-b border-gray-150 text-gray-400 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap">
                                      <th className="sticky left-0 bg-white z-10 py-2.5 pr-4 min-w-[160px] whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Họ và tên khách</th>
                                      <th className="py-2.5 px-3 min-w-[90px] whitespace-nowrap">Ngày sinh</th>
                                      <th className="py-2.5 px-3 min-w-[110px] whitespace-nowrap">Số hộ chiếu</th>
                                      <th className="py-2.5 px-3 min-w-[100px] whitespace-nowrap">Số điện thoại</th>
                                      <th className="py-2.5 px-3 min-w-[150px] whitespace-nowrap">Tài liệu</th>
                                      <th className="py-2.5 px-3 min-w-[140px] whitespace-nowrap">Thời gian nộp</th>
                                      <th className="py-2.5 px-3 min-w-[100px] whitespace-nowrap">Loại khách</th>
                                      <th className="py-2.5 px-3 text-center min-w-[125px] whitespace-nowrap">Hồ sơ / Visa</th>
                                      <th className="py-2.5 pl-3 pr-1 text-right min-w-[65px] whitespace-nowrap">Thao tác</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {orderPassengers.map((passenger) => (
                                      <tr key={passenger.id} className="group hover:bg-slate-50/50">
                                        <td className="sticky left-0 bg-white group-hover:bg-slate-50 z-10 py-2.5 pr-4 font-bold text-gray-900 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-gray-100">{passenger.full_name}</td>
                                        <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">
                                          {passenger.dob ? new Date(passenger.dob).toLocaleDateString('vi-VN') : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-gray-700 uppercase whitespace-nowrap">
                                          {passenger.passport_number || '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{passenger.phone || '-'}</td>
                                        <td className="py-2.5 px-3">
                                          <PassengerDocumentList 
                                            passportUrl={passenger.passport_url}
                                            laborContractUrl={passenger.labor_contract_url}
                                            maxInitialDisplay={2}
                                            variant="compact"
                                          />
                                        </td>
                                        <td className="py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">
                                          {passenger.visa_submitted_at ? format(new Date(passenger.visa_submitted_at), 'dd/MM/yyyy HH:mm') : <span className="text-gray-300 italic">-</span>}
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                          {passenger.is_payer ? (
                                            <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded border border-blue-200 text-[10px] whitespace-nowrap inline-block">Trưởng đoàn</span>
                                          ) : (
                                            <span className="text-gray-500 bg-slate-100 px-2 py-0.5 rounded text-[10px] whitespace-nowrap inline-block">Đi cùng</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                          {passenger.visa_status === 'pending' && (
                                            <span className="px-2 py-0.5 font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap inline-block">Chờ nộp hồ sơ</span>
                                          )}
                                          {passenger.visa_status === 'processing' && (
                                            <span className="px-2 py-0.5 font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap inline-block">Đang xét duyệt</span>
                                          )}
                                          {passenger.visa_status === 'approved' && (
                                            <span className="px-2 py-0.5 font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap inline-block">Đạt Visa</span>
                                          )}
                                          {passenger.visa_status === 'rejected' && (
                                            <span className="px-2 py-0.5 font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap inline-block">Từ chối Visa</span>
                                          )}
                                          {passenger.visa_status === 'disqualified' && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setDisqualifiedReasonModal({
                                                  name: passenger.full_name,
                                                  reason: passenger.visa_disqualified_reason || 'Chưa cập nhật lý do chi tiết.'
                                                });
                                              }}
                                              title="Bấm để xem lý do hồ sơ chưa đạt"
                                              className="px-2 py-0.5 font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200 transition-colors whitespace-nowrap inline-flex items-center gap-1 cursor-pointer"
                                            >
                                              <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                                              Hồ sơ chưa đạt
                                            </button>
                                          )}
                                          {passenger.visa_status === 'not_required' && (
                                            <span className="px-2 py-0.5 font-semibold rounded-full bg-slate-100 text-slate-500 whitespace-nowrap inline-block">Miễn Visa</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 pl-3 pr-1 text-right font-semibold whitespace-nowrap">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingPassenger(passenger);
                                              setIsEditPassengerOpen(true);
                                            }}
                                            className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                                          >
                                            Sửa
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm space-y-3.5 lg:col-span-2 flex flex-col">
                                <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 space-y-2.5">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Thông tin liên hệ đặt chỗ</span>
                                  <div className="space-y-2 text-xs">
                                    <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-100">
                                      <span className="text-gray-600 font-medium">Người đặt chỗ:</span>
                                      <span className="font-bold text-gray-900">
                                        {(order.booker_name && !order.booker_name.includes('Giữ chỗ tạm'))
                                          ? order.booker_name
                                          : (leadPassenger?.full_name || 'Chưa cung cấp')}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-100">
                                      <span className="text-gray-600 font-medium">Số điện thoại:</span>
                                      <span className="font-mono font-bold text-gray-900">
                                        {order.booker_phone || leadPassenger?.phone || 'Chưa cung cấp'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-100">
                                      <span className="text-gray-600 font-medium">Sales / CTV phụ trách:</span>
                                      <span className="font-bold text-blue-700">
                                        {order.created_by || 'Chưa rõ'}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between py-1.5 border-t border-dashed border-gray-100 mt-1 pt-1 gap-2">
                                      <span className="text-gray-600 font-medium flex items-center gap-1.5 whitespace-nowrap">
                                        <FileText className="w-4 h-4 text-blue-600 shrink-0" /> Hợp đồng dịch vụ:
                                      </span>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {order.contract_url ? (
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                              Đã tải hợp đồng
                                            </span>
                                            <a
                                              href={order.contract_url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-bold text-[10px] flex items-center gap-1 transition-all whitespace-nowrap"
                                            >
                                              <Eye className="w-3 h-3 shrink-0" /> Xem
                                            </a>
                                            {(['admin', 'operator'].includes(currentRole) || order.user_id === profile?.id || order.created_by === profile?.full_name) && (
                                              <button
                                                onClick={() => handleDeleteContract(order.id)}
                                                className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded transition-colors cursor-pointer shrink-0"
                                                title="Gỡ hợp đồng"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <label className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer text-[10px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm whitespace-nowrap">
                                              <Upload className="w-3 h-3 shrink-0" />
                                              Tải hợp đồng lên
                                              <input
                                                type="file"
                                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                                className="hidden"
                                                onChange={(e) => {
                                                  const file = e.target.files?.[0];
                                                  if (file) handleUploadContract(order.id, order.id.substring(0,8), file);
                                                }}
                                                disabled={contractUploadProgress[order.id]}
                                              />
                                            </label>
                                            {contractUploadProgress[order.id] && <Clock className="w-3 h-3 animate-spin text-blue-600 shrink-0" />}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                          </div>
                          </>
                        )}
                      </div>
                    ) : (
                      /* Tab Lịch sử thanh toán */
                          <div className="space-y-5 animate-in fade-in duration-150">
                            {/* Khối thống kê số tiền */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-center justify-between">
                                <div>
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Tổng giá trị đơn</span>
                                  <span className="text-sm font-black text-slate-800 block mt-1">
                                    {new Intl.NumberFormat('vi-VN').format(order.total_price)} đ
                                  </span>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                                  <DollarSign className="w-5 h-5" />
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-center justify-between">
                                <div>
                                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider block">Đã thanh toán (Đã duyệt)</span>
                                  <span className="text-sm font-black text-emerald-600 block mt-1">
                                    {new Intl.NumberFormat('vi-VN').format(approvedPaid)} đ
                                  </span>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                                  <Check className="w-5 h-5" />
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-center justify-between">
                                <div>
                                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider block">Đang chờ phê duyệt</span>
                                  <span className="text-sm font-black text-amber-600 block mt-1">
                                    {new Intl.NumberFormat('vi-VN').format(pendingPaid)} đ
                                  </span>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
                                  <Clock className="w-5 h-5" />
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-center justify-between">
                                <div>
                                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider block">Số tiền còn lại</span>
                                  <span className={`text-sm font-black block mt-1 ${remainingAmount === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {new Intl.NumberFormat('vi-VN').format(remainingAmount)} đ
                                  </span>
                                </div>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${remainingAmount === 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                                  {remainingAmount === 0 ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-5 h-5" />}
                                </div>
                              </div>
                            </div>

                            {/* Danh sách lịch sử giao dịch */}
                            <div className="bg-white rounded-2xl border border-slate-200/85 shadow-md overflow-hidden" id="transaction_history_section">
                              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
                                    <FileText className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                                      Lịch sử giao dịch thu/chi liên quan
                                    </h4>
                                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                                      Danh sách phiếu thu và phiếu chi đã khởi tạo cho booking này
                                    </p>
                                  </div>
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
                                  {orderInvoices.length} Giao dịch
                                </span>
                              </div>

                              {orderInvoices.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 text-xs italic bg-slate-50/20">
                                  Chưa có lịch sử thanh toán hay biên lai thu chi nào được ghi nhận cho booking này.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {orderInvoices.map((inv) => {
                                    const isReceipt = inv.type === "receipt";
                                    const isExpanded = expandedInvoiceId === inv.id;
                                    const cardBgClass = isExpanded
                                      ? "bg-white border border-slate-200 shadow-sm rounded-xl ring-1 ring-slate-900/5 transition-all overflow-hidden"
                                      : "bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 hover:shadow-2xs transition-all overflow-hidden";
                                    return (
                                      <div key={inv.id} className={cardBgClass}>
                                        {/* Row Header (Collapsed State) */}
                                        <div
                                          onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 transition-colors cursor-pointer select-none hover:bg-slate-50/60"
                                        >
                                          <div className="flex items-center gap-3 min-w-0">
                                            {/* Chevron indicator */}
                                            <div className="text-slate-400 shrink-0">
                                              {isExpanded ? (
                                                <ChevronDown className="w-4 h-4 text-slate-600" />
                                              ) : (
                                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                              )}
                                            </div>

                                            {/* Invoice Code and Type Badge */}
                                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-[11px] font-mono font-medium shrink-0">
                                                {inv.invoice_code || inv.id.substring(0, 8).toUpperCase()}
                                              </span>
                                              {isReceipt ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60 uppercase tracking-wide">
                                                  Phiếu thu
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-800 border border-rose-200/60 uppercase tracking-wide">
                                                  Phiếu chi (Hoàn)
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 ml-7 sm:ml-0">
                                            {/* Amount */}
                                            <div className="text-left sm:text-right whitespace-nowrap">
                                              <span className={`font-semibold text-sm ${isReceipt ? "text-emerald-700" : "text-rose-700"}`}>
                                                {isReceipt ? "+" : "-"} {new Intl.NumberFormat("vi-VN").format(inv.amount)} đ
                                              </span>
                                            </div>

                                            {/* Date Time */}
                                            <div className="hidden md:block text-slate-500 font-normal text-[11px] whitespace-nowrap">
                                              {inv.created_at ? (
                                                <div className="flex flex-col text-right leading-tight">
                                                  <span className="font-medium text-slate-700">
                                                    {new Date(inv.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                                  </span>
                                                  <span className="text-[10px] text-slate-400">
                                                    {new Date(inv.created_at).toLocaleDateString("vi-VN")}
                                                  </span>
                                                </div>
                                              ) : (
                                                "---"
                                              )}
                                            </div>

                                            {/* Status Badge */}
                                            <div className="shrink-0 text-right">
                                              {inv.status === "approved" && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                                  <Check className="w-3 h-3 text-emerald-600" />
                                                  Đã duyệt
                                                </span>
                                              )}
                                              {inv.status === "pending" && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/70">
                                                  <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                                                  Chờ duyệt
                                                </span>
                                              )}
                                              {inv.status === "rejected" && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-800 border border-rose-200/70">
                                                  <AlertCircle className="w-3 h-3 text-rose-600" />
                                                  Từ chối
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Expanded Details Area */}
                                        {isExpanded && (
                                          <div className="p-4 border-t border-slate-150 bg-slate-50/50 text-xs text-slate-700 animate-fadeIn space-y-3">
                                            {/* Metadata Tiles Grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                              {/* Payment Method */}
                                              <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs flex items-center gap-3">
                                                <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
                                                <div className="min-w-0">
                                                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Phương thức thanh toán</span>
                                                  <span className="font-medium text-slate-800 text-xs truncate block">{inv.payment_method || "Chuyển khoản"}</span>
                                                </div>
                                              </div>

                                              {/* Transaction Time */}
                                              <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs flex items-center gap-3">
                                                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                                <div className="min-w-0">
                                                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Thời gian giao dịch</span>
                                                  <span className="font-medium text-slate-800 text-xs truncate block">
                                                    {inv.created_at ? (
                                                      `${new Date(inv.created_at).toLocaleTimeString("vi-VN")} ngày ${new Date(inv.created_at).toLocaleDateString("vi-VN")}`
                                                    ) : "---"}
                                                  </span>
                                                </div>
                                              </div>

                                              {/* Creator / Payer */}
                                              <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs flex items-center gap-3">
                                                <User className="w-4 h-4 text-slate-400 shrink-0" />
                                                <div className="min-w-0">
                                                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Người nộp / Tạo</span>
                                                  <span className="font-medium text-slate-800 text-xs truncate block">
                                                    {(inv.created_by && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inv.created_by))
                                                      ? inv.created_by
                                                      : (order.created_by || order.booker_name || leadPassenger?.full_name || "Hệ thống")}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Note / Description Box */}
                                            <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs space-y-1.5">
                                              <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px] uppercase tracking-wider">
                                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                                <span>Ghi chú / Mô tả chi tiết</span>
                                              </div>
                                              <div className="p-2.5 rounded-md bg-slate-50/80 text-slate-800 text-xs font-normal leading-relaxed whitespace-pre-wrap break-words border border-slate-200/60">
                                                {inv.description || "Chuyển khoản thanh toán"}
                                              </div>
                                            </div>

                                            {/* Verification Details if verified */}
                                            {(inv.verified_by || inv.verified_at) && (
                                              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs">
                                                <div className="flex items-center gap-2">
                                                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                                  <span className="text-slate-600 font-medium">Người duyệt: <strong className="text-slate-800 font-semibold">{inv.verified_by || "Hệ thống"}</strong></span>
                                                </div>
                                                {inv.verified_at && (
                                                  <span className="text-slate-400 text-[11px]">
                                                    Ngày duyệt: {new Date(inv.verified_at).toLocaleDateString("vi-VN")}
                                                  </span>
                                                )}
                                              </div>
                                            )}

                                            {/* Proof File Attachment Footer */}
                                            <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                              <div className="flex items-center gap-2 text-slate-600 font-medium text-xs">
                                                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                                                <span>Minh chứng giao dịch:</span>
                                              </div>
                                              {inv.file_url ? (
                                                <a
                                                  href={inv.file_url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors cursor-pointer"
                                                >
                                                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                                                  Xem ảnh minh chứng giao dịch
                                                </a>
                                              ) : (
                                                <span className="text-slate-400 italic text-xs">
                                                  Không có ảnh minh chứng được đính kèm
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                          </div>
                        </div>
                      )}

                      {/* Box 3: Action center bar */}
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            order.status === 'cancelled' ? 'bg-slate-50 text-slate-500' :
                            order.status === 'hold' ? 'bg-amber-50 text-amber-600' :
                            (order.status === 'paid' || isFullyPaid) ? 'bg-blue-50 text-blue-600' :
                            isPartiallyPaid ? 'bg-cyan-50 text-cyan-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {order.status === 'cancelled' ? <ShieldCheck className="w-4 h-4" /> :
                             order.status === 'hold' ? <Clock className="w-4 h-4" /> :
                             (order.status === 'paid' || isFullyPaid) ? <Check className="w-4 h-4" /> :
                             isPartiallyPaid ? <CreditCard className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                          </div>
                          <div className="text-xs">
                            <span className="font-bold text-gray-900 block">
                              Yêu cầu nghiệp vụ: {
                                order.status === 'cancelled' ? 'Booking đã đóng (Huỷ)' :
                                order.status === 'hold' ? 'Nhận thanh toán đặt cọc' :
                                (order.status === 'paid' || isFullyPaid) ? 'Booking đã hoàn tất thanh toán' :
                                isPartiallyPaid ? 'Booking còn dư nợ, cần thanh toán thêm' :
                                order.status === 'sure' ? 'Xác nhận dịch vụ hoàn tất' : 'Booking đã đóng'
                              }
                            </span>
                            <span className="text-gray-500 mt-0.5 block">
                              {order.status === 'cancelled'
                                ? 'Đơn đặt đã huỷ. Quỹ vé đã được giải phóng để bán cho khách hàng khác.'
                                : order.status === 'hold'
                                ? 'Cần chuyển trạng thái đơn sang Sure để giữ phòng & vé máy bay chính thức trước khi đếm ngược kết thúc.'
                                : (order.status === 'paid' || isFullyPaid)
                                ? 'Booking đã được thanh toán đầy đủ, không còn dư nợ.'
                                : isPartiallyPaid
                                ? 'Booking mới được thanh toán một phần. Cần hoàn tất số dư còn lại.'
                                : order.status === 'sure'
                                ? 'Booking an toàn. Điều hành tour và Đại lý có thể tiến hành chuẩn bị hồ sơ visa, vé máy bay.'
                                : 'Đơn đặt đã huỷ.'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
                          {/* Nút Khóa / Mở khóa booking dành cho Admin & Sale Leader */}
                          {['admin', 'sale_leader'].includes(currentRole) && order.status !== 'cancelled' && (() => {
                            const isAllowedToUnlock = canUnlockOrder(order, currentRole, profile, profilesList);
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  if (order.is_locked) {
                                    if (!isAllowedToUnlock) {
                                      const creatorName = order.created_by || 'nhân viên thuộc nhóm khác';
                                      toast.error(`Bạn không có quyền mở khóa booking này. Booking do ${creatorName} tạo. Leader chỉ được mở khóa đơn của thành viên nhóm mình.`);
                                      return;
                                    }
                                    updateOrder(order.id, { is_locked: false });
                                    toast.success(`Đã mở khóa booking #${order.id.substring(0, 8)}. Hệ thống cho phép chỉnh sửa lại thông tin.`);
                                  } else {
                                    updateOrder(order.id, { is_locked: true });
                                    toast.success(`Đã khóa booking #${order.id.substring(0, 8)}`);
                                  }
                                }}
                                className={`px-3.5 py-2 text-xs font-bold rounded-lg border transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                                  order.is_locked
                                    ? isAllowedToUnlock
                                      ? 'text-amber-800 bg-amber-50 border-amber-300 hover:bg-amber-100'
                                      : 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed opacity-75'
                                    : 'text-slate-700 bg-slate-50 border-slate-200 hover:bg-slate-100'
                                }`}
                                title={
                                  order.is_locked
                                    ? isAllowedToUnlock
                                      ? 'Bấm để mở khóa booking'
                                      : 'Bạn không có quyền mở khóa booking của thành viên thuộc nhóm khác'
                                    : 'Bấm để khóa booking'
                                }
                              >
                                {order.is_locked ? (
                                  <>
                                    <Unlock className={`w-3.5 h-3.5 ${isAllowedToUnlock ? 'text-amber-600' : 'text-gray-400'}`} />
                                    Mở khóa đơn
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                                    Khóa đơn
                                  </>
                                )}
                              </button>
                            );
                          })()}

                          {order.status !== 'cancelled' && order.status !== 'paid' && !isFullyPaid && (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentOrder(order);
                                setIsPaymentModalOpen(true);
                              }}
                              className="px-3.5 py-2 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:text-blue-800 transition-colors inline-flex items-center"
                            >
                              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                              Thanh toán
                            </button>
                          )}
                          {order.status === 'hold' && currentRole !== 'sale' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setOrderToConfirm(order.id);
                                  setIsPassengerModalOpen(true);
                                }}
                                className="px-3.5 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 hover:text-emerald-800 transition-colors inline-flex items-center"
                              >
                                <Check className="w-3.5 h-3.5 mr-1.5" />
                                Xác nhận
                              </button>

                              {/* Extensions Request Button */}
                              {order.is_extended ? (
                                <span className="text-xs text-emerald-600 font-extrabold bg-emerald-50 px-3.5 py-2 rounded-lg border border-emerald-200 inline-flex items-center">
                                  <Check className="w-4 h-4 mr-1.5" /> Đã gia hạn thành công
                                </span>
                              ) : order.extension_status === 'requested' ? (
                                <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-3.5 py-2 rounded-lg border border-amber-200 inline-flex items-center animate-pulse">
                                  <Clock className="w-4 h-4 mr-1.5" /> Chờ duyệt gia hạn...
                                </span>
                              ) : order.extension_status === 'rejected' ? (
                                <span className="text-xs text-rose-600 font-medium bg-rose-50 px-3.5 py-2 rounded-lg border border-rose-200">
                                  Bị từ chối gia hạn
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmModalData({
                                      isOpen: true,
                                      title: 'Yêu cầu gia hạn',
                                      message: `Gia hạn thời gian giữ chỗ cho booking #${order.id.substring(0, 8)}.`,
                                      showInput: true,
                                      inputLabel: 'Số giờ gia hạn',
                                      inputPlaceholder: '24',
                                      onConfirm: (hours) => requestExtension(order.id, Number(hours)),
                                    });
                                  }}
                                  className="px-3.5 py-2 text-xs font-extrabold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:text-blue-800 transition-colors inline-flex items-center"
                                >
                                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                                  Yêu cầu gia hạn
                                </button>
                              )}
                            </>
                          )}

                          {/* Universal Cancel Order Button */}
                          {order.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => {
                                console.log('Cancel button clicked for:', order.id);
                                const orderInvoices = invoices.filter(inv => inv.order_id === order.id);
                                const approvedPaidAmount = orderInvoices.filter(inv => inv.type === 'receipt' && inv.status === 'approved').reduce((sum, inv) => sum + inv.amount, 0) || order.paid_amount || 0;
                                const hasPayment = approvedPaidAmount > 0;
                                if (hasPayment) {
                                  setCancelPaymentOrder({ ...order, paid_amount: approvedPaidAmount });
                                  setCancelPaymentReason('');
                                  setCancelPaymentRefundAmount(approvedPaidAmount);
                                  setCancelPaymentRefundInput(new Intl.NumberFormat('vi-VN').format(approvedPaidAmount));
                                  setCancelConfirmFile(null);
                                  setCancelRefundMethod('transfer');
                                  setCancelRefundBankName('');
                                  setCancelRefundAccountNumber('');
                                  setCancelRefundAccountName('');
                                  setIsCancelPaymentModalOpen(true);
                                } else {
                                  setConfirmModalData({
                                    isOpen: true,
                                    title: 'Hủy booking',
                                    message: `Bạn có chắc chắn muốn HỦY đơn đặt giữ chỗ #${order.id.substring(0, 8)}? Hành động này sẽ trả lại ${orderPassengers.length} chỗ trống về quỹ tour khởi hành.`,
                                    showInput: false,
                                    onConfirm: async () => {
                                      try {
                                        await cancelOrder(order.id, '');
                                        toast.success('Đã hủy đơn đặt giữ chỗ thành công!');
                                      } catch (err) {
                                        toast.error('Gặp sự cố khi hủy booking!');
                                      }
                                    },
                                  });
                                }
                              }}
                              className="px-3.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 hover:text-rose-800 transition-colors inline-flex items-center cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                              Hủy booking
                            </button>
                          )}

                          {order.status === 'sure' && !hasApprovedReceipt && (
                            <span className="px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg inline-flex items-center">
                              <Check className="w-4 h-4 mr-1.5" /> Đã chốt thành công (Sure)
                            </span>
                          )}

                          {(order.status === 'paid' || isFullyPaid) && (
                            <span className="px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg inline-flex items-center">
                              <Check className="w-4 h-4 mr-1.5" /> Đã hoàn tất thanh toán
                            </span>
                          )}

                          {(order.status === 'sure' && isPartiallyPaid) && (
                            <span className="px-3.5 py-2 text-xs font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg inline-flex items-center">
                              <CreditCard className="w-4 h-4 mr-1.5" /> Đã thanh toán một phần
                            </span>
                          )}

                          {order.status === 'cancelled' && (() => {
                            const orderInvoices = invoices.filter(inv => inv.order_id === order.id);
                            const refundInvoices = orderInvoices.filter(inv => inv.type === 'payment');
                            const approvedPaidAmount = orderInvoices.filter(inv => inv.type === 'receipt' && inv.status === 'approved').reduce((sum, inv) => sum + inv.amount, 0) || order.paid_amount || 0;
                            const hasRefundPendingOrApproved = refundInvoices.some(inv => inv.status === 'pending' || inv.status === 'approved');
                            const hasRejectedRefund = refundInvoices.some(inv => inv.status === 'rejected');

                            return (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-3.5 py-2 text-xs font-semibold text-gray-400 bg-gray-50 border border-gray-200 rounded-lg inline-flex items-center">
                                  Đã hủy booking
                                </span>
                                {approvedPaidAmount > 0 && !hasRefundPendingOrApproved && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCancelPaymentOrder({ ...order, paid_amount: approvedPaidAmount });
                                      setCancelPaymentReason(hasRejectedRefund ? 'Yêu cầu hoàn tiền lại sau khi bị từ chối' : '');
                                      setCancelPaymentRefundAmount(approvedPaidAmount);
                                      setCancelPaymentRefundInput(new Intl.NumberFormat('vi-VN').format(approvedPaidAmount));
                                      setCancelConfirmFile(null);
                                      setCancelRefundMethod('transfer');
                                      setCancelRefundBankName('');
                                      setCancelRefundAccountNumber('');
                                      setCancelRefundAccountName('');
                                      setIsCancelPaymentModalOpen(true);
                                    }}
                                    className="px-3.5 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors inline-flex items-center cursor-pointer"
                                  >
                                    <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                                    {hasRejectedRefund ? 'Yêu cầu hoàn tiền lại' : 'Tạo phiếu chi hoàn tiền'}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ActionModal
        isOpen={confirmModalData.isOpen}
        onClose={() => setConfirmModalData(prev => ({ ...prev, isOpen: false }))}
        title={confirmModalData.title}
        message={confirmModalData.message}
        onConfirm={confirmModalData.onConfirm}
        showInput={confirmModalData.showInput}
        inputPlaceholder={confirmModalData.inputPlaceholder}
        inputLabel={confirmModalData.inputLabel}
      />
      <PassengerInputModal
        isOpen={isPassengerModalOpen}
        onClose={() => setIsPassengerModalOpen(false)}
        adultCount={orderToConfirm ? allOrders.find(o => o.id === orderToConfirm)?.adult_count || 1 : 1}
        childCount={orderToConfirm ? allOrders.find(o => o.id === orderToConfirm)?.child_count || 0 : 0}
        infantCount={orderToConfirm ? allOrders.find(o => o.id === orderToConfirm)?.infant_count || 0 : 0}
        tourPriceVisa={orderToConfirm ? tours.find(t => t.id === allOrders.find(o => o.id === orderToConfirm)?.tour_id)?.price_visa_tour : 0}
        onConfirm={(passengers) => {
          if (orderToConfirm) {
            if (!['admin', 'sale_leader'].includes(currentRole)) {
              setConfirmModalData({
                isOpen: true,
                title: '🔒 Cảnh báo: Chốt Sure & Tự động khóa booking',
                message: 'Chuyển booking sang trạng thái Chắc chắn (Sure) sẽ TỰ ĐỘNG KHÓA toàn bộ thông tin giá tiền & doanh thu. Chỉ Admin hoặc Sale Leader mới có quyền mở khóa hoặc điều chỉnh lại. Bạn có chắc chắn danh sách hành khách và thông tin booking đã chính xác?',
                onConfirm: () => {
                  confirmOrder(orderToConfirm, passengers);
                  setIsPassengerModalOpen(false);
                  setOrderToConfirm(null);
                }
              });
            } else {
              confirmOrder(orderToConfirm, passengers);
              setIsPassengerModalOpen(false);
              setOrderToConfirm(null);
            }
          }
        }}
      />
      <PassengerInputModal
        isOpen={!!orderToAddPassengers}
        onClose={() => setOrderToAddPassengers(null)}
        adultCount={orderToAddPassengers ? (allOrders.find(o => o.id === orderToAddPassengers)?.adult_count || 0) + (allOrders.find(o => o.id === orderToAddPassengers)?.child_count || 0) + (allOrders.find(o => o.id === orderToAddPassengers)?.infant_count || 0) - passengers.filter(p => p.order_id === orderToAddPassengers).length : 1}
        childCount={0}
        infantCount={0}
        tourPriceVisa={orderToAddPassengers ? tours.find(t => t.id === allOrders.find(o => o.id === orderToAddPassengers)?.tour_id)?.price_visa_tour : 0}
        onConfirm={(passengersData) => {
          if (orderToAddPassengers) {
            addPassengersToOrder(orderToAddPassengers, passengersData);
            setOrderToAddPassengers(null);
          }
        }}
      />
      <EditPassengerModal
        isOpen={isEditPassengerOpen}
        onClose={() => {
          setIsEditPassengerOpen(false);
          setEditingPassenger(null);
        }}
        passenger={editingPassenger}
        tourPriceVisa={editingPassenger ? tours.find(t => t.id === allOrders.find(o => o.id === editingPassenger.order_id)?.tour_id)?.price_visa_tour : undefined}
        onSave={(passengerId, updatedData) => {
          updatePassenger(passengerId, updatedData);
        }}
      />
      <EditOrderModal
        isOpen={isEditOrderOpen}
        onClose={() => {
          setIsEditOrderOpen(false);
          setEditingOrder(null);
        }}
        order={editingOrder}
        onSave={(orderId, updatedData) => {
          updateOrder(orderId, updatedData);
        }}
      />

      {/* Selected Invoice Note Modal */}
      {selectedInvoiceNote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="invoice_note_modal">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 transform transition-all duration-200 scale-100">
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Chi tiết Ghi chú / Mô tả</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoiceNote(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors text-lg font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mã hóa đơn / Phiếu</span>
                <span className="text-xs font-mono font-extrabold text-slate-900 mt-0.5 block uppercase">{selectedInvoiceNote.code}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 max-h-[300px] overflow-y-auto">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Nội dung ghi chú</span>
                <p className="text-xs font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {selectedInvoiceNote.note || 'Không có ghi chú chi tiết.'}
                </p>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-3.5 flex justify-end border-t border-slate-150">
              <button
                type="button"
                onClick={() => setSelectedInvoiceNote(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 active:scale-95 transition-all text-white font-extrabold text-xs rounded-lg uppercase shadow-md shadow-slate-900/10 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disqualified Reason Modal */}
      {disqualifiedReasonModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="disqualified_reason_modal">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-rose-100 transform transition-all duration-300 scale-100">
            <div className="bg-rose-50 px-6 py-4 flex items-center justify-between border-b border-rose-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-black text-rose-950 uppercase tracking-wide">Chi tiết hồ sơ chưa đạt</h3>
              </div>
              <button
                type="button"
                onClick={() => setDisqualifiedReasonModal(null)}
                className="text-rose-400 hover:text-rose-600 transition-colors text-lg font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Khách hàng</span>
                <span className="text-sm font-extrabold text-gray-950 uppercase mt-0.5 block">{disqualifiedReasonModal.name}</span>
              </div>
              <div className="p-4 bg-rose-50/50 rounded-lg border border-rose-100">
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block mb-1">Lý do cụ thể</span>
                <p className="text-xs font-semibold text-rose-950 whitespace-pre-wrap leading-relaxed">{disqualifiedReasonModal.reason}</p>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end">
              <button
                type="button"
                onClick={() => setDisqualifiedReasonModal(null)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all text-white font-extrabold text-xs rounded-lg uppercase shadow-md shadow-rose-600/10 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hủy booking có thanh toán */}
      {isCancelPaymentModalOpen && cancelPaymentOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full shadow-xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-950 flex items-center gap-2">
                ⚠️ Hủy Booking Có Thanh Toán
              </h3>
              <button
                onClick={() => {
                  setIsCancelPaymentModalOpen(false);
                  setCancelPaymentOrder(null);
                }}
                className="text-gray-400 hover:text-gray-600 bg-white hover:bg-gray-100 rounded-full p-1.5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 font-semibold leading-relaxed">
                Booking <span className="font-mono font-bold">#{cancelPaymentOrder.id.substring(0, 8)}</span> này đã được thanh toán. Khi hủy, hệ thống sẽ tự động tạo một phiếu chi hoàn trả cho khách hàng tương ứng với số tiền bạn thiết lập dưới đây.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Số tiền đã thanh toán
                  </label>
                  <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-black text-gray-800">
                    {new Intl.NumberFormat('vi-VN').format(cancelPaymentOrder.paid_amount || 0)}đ
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Số tiền hoàn trả cho khách <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={cancelPaymentRefundInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const cleanVal = raw.replace(/\D/g, '');
                        if (!cleanVal) {
                          setCancelPaymentRefundInput('');
                          setCancelPaymentRefundAmount(0);
                          return;
                        }
                        const numVal = Number(cleanVal);
                        const maxPaid = cancelPaymentOrder.paid_amount || 0;
                        const capVal = Math.min(numVal, maxPaid);
                        setCancelPaymentRefundAmount(capVal);
                        setCancelPaymentRefundInput(new Intl.NumberFormat('vi-VN').format(capVal));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-950 focus:ring-2 focus:ring-blue-500 bg-white pr-8"
                      placeholder="Nhập số tiền hoàn trả..."
                    />
                    <span className="absolute right-3 top-2.5 text-sm text-gray-400 font-bold">đ</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Số tiền còn lại (giữ lại)
                  </label>
                  <div className="px-3 py-2 bg-rose-50 border border-rose-100 rounded-lg text-sm font-black text-rose-700">
                    {new Intl.NumberFormat('vi-VN').format(Math.max(0, (cancelPaymentOrder.paid_amount || 0) - cancelPaymentRefundAmount))}đ
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Lý do hủy booking <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={cancelPaymentReason}
                    onChange={(e) => setCancelPaymentReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="Lý do khách hủy..."
                  />
                </div>
              </div>

              {/* Upload ảnh minh chứng xác nhận của khách hàng */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Ảnh minh chứng xác nhận hủy của khách <span className="text-red-500">*</span>
                </label>
                <p className="text-[10px] text-gray-400">Tải lên ảnh chụp màn hình tin nhắn Zalo, SMS, Email... xác nhận hủy và hoàn tiền từ khách hàng</p>
                <div className="mt-1 flex justify-center px-6 pt-4 pb-4 border-2 border-gray-300 border-dashed rounded-lg hover:border-blue-400 transition-colors bg-slate-50/50">
                  <div className="space-y-1 text-center">
                    <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
                    <div className="flex text-xs text-gray-600 justify-center">
                      <label
                        htmlFor="cancel-confirm-file"
                        className="relative cursor-pointer bg-white rounded-md font-bold text-blue-600 hover:text-blue-500 focus-within:outline-none"
                      >
                        <span>Tải ảnh minh chứng</span>
                        <input
                          id="cancel-confirm-file"
                          name="cancel-confirm-file"
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setCancelConfirmFile(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                    {cancelConfirmFile ? (
                      <div className="mt-2 text-xs font-bold text-emerald-600 flex items-center justify-center gap-1.5">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span className="truncate max-w-[200px]">{cancelConfirmFile.name}</span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400">Chưa chọn ảnh (Hỗ trợ PNG, JPG, JPEG)</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Thông tin hoàn trả (Chỉ hiển thị khi số tiền hoàn trả > 0) */}
              {cancelPaymentRefundAmount > 0 && (
                <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider block border-b border-slate-200/80 pb-1.5">
                    💳 Phương án hoàn trả tiền
                  </span>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Hình thức hoàn trả <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setCancelRefundMethod('transfer')}
                        className={`px-3 py-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                          cancelRefundMethod === 'transfer'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        Chuyển khoản ngân hàng
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancelRefundMethod('cash')}
                        className={`px-3 py-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                          cancelRefundMethod === 'cash'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        Nhận tiền mặt
                      </button>
                    </div>
                  </div>

                  {cancelRefundMethod === 'transfer' && (
                    <div className="space-y-3 animate-fadeIn">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                            Tên ngân hàng <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={cancelRefundBankName}
                            onChange={(e) => setCancelRefundBankName(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500 bg-white"
                            placeholder="Ví dụ: Vietcombank"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                            Số tài khoản <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={cancelRefundAccountNumber}
                            onChange={(e) => setCancelRefundAccountNumber(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500 bg-white"
                            placeholder="Nhập số tài khoản..."
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Tên chủ tài khoản <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={cancelRefundAccountName}
                          onChange={(e) => setCancelRefundAccountName(e.target.value.toUpperCase())}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 bg-white"
                          placeholder="VÍ DỤ: NGUYEN VAN A"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                disabled={isCancelUploading}
                onClick={() => {
                  setIsCancelPaymentModalOpen(false);
                  setCancelPaymentOrder(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isCancelUploading}
                onClick={async () => {
                  if (!cancelPaymentReason.trim()) {
                    toast.error('Vui lòng nhập lý do hủy booking!');
                    return;
                  }
                  if (!cancelConfirmFile) {
                    toast.error('Vui lòng tải lên ảnh minh chứng xác nhận hủy của khách hàng!');
                    return;
                  }
                  if (cancelPaymentRefundAmount > (cancelPaymentOrder.paid_amount || 0)) {
                    toast.error('Số tiền hoàn trả không được vượt quá số tiền đã thanh toán!');
                    return;
                  }
                  if (cancelPaymentRefundAmount > 0 && cancelRefundMethod === 'transfer') {
                    if (!cancelRefundBankName.trim() || !cancelRefundAccountNumber.trim() || !cancelRefundAccountName.trim()) {
                      toast.error('Vui lòng điền đầy đủ thông tin tài khoản ngân hàng để hoàn tiền chuyển khoản!');
                      return;
                    }
                  }

                  setIsCancelUploading(true);
                  try {
                    // 1. Upload ảnh minh chứng lên Google Drive qua backend API
                    const targetTour = tours.find(t => t.id === cancelPaymentOrder.tour_id);
                    const formData = new FormData();
                    formData.append('file', cancelConfirmFile);
                    formData.append('orderCode', cancelPaymentOrder.id.substring(0, 8));
                    if (targetTour?.code) {
                      formData.append('tourCode', targetTour.code);
                    }

                    const uploadRes = await fetch('/api/upload-invoice-receipt', {
                      method: 'POST',
                      body: formData,
                    });

                    if (!uploadRes.ok) {
                      throw new Error('Lỗi tải ảnh minh chứng lên hệ thống lưu trữ.');
                    }

                    const resText = await uploadRes.text();
                    let resData;
                    try {
                      resData = JSON.parse(resText);
                    } catch {
                      throw new Error('Định dạng phản hồi từ máy chủ không đúng.');
                    }

                    // 2. Hủy đơn hàng nếu chưa hủy
                    if (cancelPaymentOrder.status !== 'cancelled') {
                      await cancelOrder(cancelPaymentOrder.id, cancelPaymentReason);
                    }

                    // 3. Tạo phiếu chi hoàn tiền nếu số tiền hoàn trả > 0
                    if (cancelPaymentRefundAmount > 0) {
                      const paymentMethodLabel = cancelRefundMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản';
                      let finalDesc = cancelPaymentOrder.status === 'cancelled'
                        ? `Yêu cầu hoàn tiền mới cho đơn đặt chỗ đã hủy #${cancelPaymentOrder.id.substring(0, 8)}. Lý do: ${cancelPaymentReason}`
                        : `Hoàn tiền cho khách hàng do hủy booking #${cancelPaymentOrder.id.substring(0, 8)}. Lý do: ${cancelPaymentReason}`;

                      if (cancelRefundMethod === 'transfer') {
                        finalDesc += `\n[Hoàn trả qua Ngân hàng]: ${cancelRefundBankName.trim()} - STK: ${cancelRefundAccountNumber.trim()} - Chủ TK: ${cancelRefundAccountName.trim()}`;
                      } else {
                        finalDesc += `\n[Hoàn trả]: Nhận tiền mặt trực tiếp tại văn phòng`;
                      }

                      await createInvoiceReceipt({
                        order_id: cancelPaymentOrder.id,
                        amount: cancelPaymentRefundAmount,
                        description: finalDesc,
                        payment_method: paymentMethodLabel,
                        type: 'payment',
                        file_url: resData.url, // đính kèm ảnh minh chứng hủy xác nhận của khách hàng
                        created_by: profile?.full_name || user?.email || 'Hệ thống',
                        refund_method: cancelRefundMethod,
                        refund_bank_name: cancelRefundMethod === 'transfer' ? cancelRefundBankName.trim() : undefined,
                        refund_account_number: cancelRefundMethod === 'transfer' ? cancelRefundAccountNumber.trim() : undefined,
                        refund_account_name: cancelRefundMethod === 'transfer' ? cancelRefundAccountName.trim() : undefined,
                      });

                      toast.success(cancelPaymentOrder.status === 'cancelled'
                        ? `Đã gửi lại yêu cầu hoàn trả ${new Intl.NumberFormat('vi-VN').format(cancelPaymentRefundAmount)}đ thành công!`
                        : `Đã tự động tạo phiếu chi hoàn trả ${new Intl.NumberFormat('vi-VN').format(cancelPaymentRefundAmount)}đ thành công!`
                      );
                    } else {
                      toast.success(cancelPaymentOrder.status === 'cancelled' ? 'Đã lưu thông tin.' : 'Đã hủy booking thành công (Không có tiền hoàn trả).');
                    }

                    setIsCancelPaymentModalOpen(false);
                    setCancelPaymentOrder(null);
                  } catch (err: any) {
                    console.error(err);
                    toast.error(err.message || 'Có lỗi xảy ra khi hủy booking hoặc tạo phiếu chi hoàn tiền!');
                  } finally {
                    setIsCancelUploading(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isCancelUploading && (
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {isCancelUploading ? 'Đang xử lý...' : 'Xác nhận Hủy & Hoàn tiền'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentOrder(null);
        }}
        order={paymentOrder}
      />
    </div>
  );
}
