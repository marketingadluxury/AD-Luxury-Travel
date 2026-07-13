import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { useCRM } from '@/context/CRMContext';
import { useAuth } from '@/context/AuthContext';
import { Tour, Order, Passenger } from '@/types';
import { ShoppingCart, User, Users, Clock, AlertTriangle, FileText, Check, X, ShieldAlert, Plus, ArrowUpRight, ChevronDown, ChevronUp, ChevronRight, ShieldCheck, Trash2, Info, Edit, ExternalLink, AlertCircle, Search } from 'lucide-react';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';
import ActionModal from '../components/ActionModal';
import PassengerInputModal from '../components/PassengerInputModal';
import EditPassengerModal from '../components/EditPassengerModal';
import EditOrderModal from '../components/EditOrderModal';

export default function OrdersManagement() {
  const { tours, orders: allOrders, passengers, createOrder, cancelOrder, requestExtension, confirmOrder, updatePassenger, addPassengersToOrder, updateOrder, currentRole } = useCRM();
  const { profile, user } = useAuth();

  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [orderFilterStatus, setOrderFilterStatus] = useState('all');
  const [orderFilterTimeRange, setOrderFilterTimeRange] = useState('all');
  const [orderSortBy, setOrderSortBy] = useState('newest');
  
  const orders = React.useMemo(() => {
    // 1. Filter by role/ownership
    let filtered = ['admin', 'operator'].includes(currentRole)
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
      filtered = filtered.filter(o => o.status === orderFilterStatus);
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
  }, [allOrders, currentRole, profile, tours, orderSearchTerm, orderFilterStatus, orderFilterTimeRange, orderSortBy]);

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

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [isPassengerModalOpen, setIsPassengerModalOpen] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<string | null>(null);
  const [orderToAddPassengers, setOrderToAddPassengers] = useState<string | null>(null);
  const [editingPassenger, setEditingPassenger] = useState<Passenger | null>(null);
  const [isEditPassengerOpen, setIsEditPassengerOpen] = useState(false);
  const [disqualifiedReasonModal, setDisqualifiedReasonModal] = useState<{ name: string; reason: string } | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isEditOrderOpen, setIsEditOrderOpen] = useState(false);
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

  const priceAdult = selectedTour ? (selectedTour.price_adult ?? selectedTour.price) : 0;
  const priceChild = selectedTour ? (selectedTour.price_child ?? Math.round(selectedTour.price * 0.8)) : 0;
  const priceInfant = selectedTour ? (selectedTour.price_infant ?? Math.round(selectedTour.price * 0.3)) : 0;
  const singleRoomSurcharge = selectedTour ? (selectedTour.single_room_surcharge ?? 7500000) : 0;

  const calculatedTotalPrice = selectedTour 
    ? (priceAdult * adultCount) + (priceChild * childCount) + (priceInfant * infantCount) + (singleRoomSurcharge * singleRoomCount)
    : 0;

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTourId) {
      toast.error('Vui lòng chọn Tour khởi hành!');
      return;
    }

    if (orderStatus === 'sure' && (!bookerName.trim() || !bookerPhone.trim())) {
      toast.error('Vui lòng điền đầy đủ Họ tên và Số điện thoại của khách trưởng nhóm khi Đặt chắc chắn!');
      return;
    }

    const orderPassengers: any[] = [];
    const finalBookerName = bookerName.trim() || (orderStatus === 'hold' ? 'Chưa cung cấp (Giữ chỗ tạm)' : '');
    const finalBookerPhone = bookerPhone.trim() || (orderStatus === 'hold' ? 'Chưa cung cấp' : '');
    
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
    const roleLabel = currentRole === 'CTV' ? 'CTV' : currentRole === 'Đại lý' ? 'Đại lý' : currentRole === 'sale' ? 'Sale' : currentRole === 'operator' ? 'Điều hành' : 'Quản trị viên';
    const creatorFullName = `${roleLabel} - ${partnerDisplayName}`;

    createOrder({
      tour_id: selectedTourId,
      status: orderStatus,
      total_price: calculatedTotalPrice,
      adult_price: priceAdult,
      passengers: orderStatus === 'hold' ? [] : orderPassengers,
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
      special_requests: specialRequests,
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
    setShowCreateForm(false);
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
          <h2 className="text-xl font-bold text-gray-900">Quản lý Đơn hàng (Sales & Đại lý)</h2>
          <p className="text-sm text-gray-500 mt-1">
            Giữ chỗ tạm thời, chốt chắc chắn (Sure) và theo dõi đếm ngược thời hạn giải phóng booking tự động.
          </p>
        </div>
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center px-4 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          {showCreateForm ? 'Đóng form' : 'Đặt Đơn hàng Mới'}
        </button>
      </div>

      {/* Hold Statistics Dashboard */}
      {['admin', 'operator'].includes(currentRole) && holdStatistics.length > 0 && (
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
                    Đang giữ {stat.orderCount} đơn hàng tạm tính
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
                <div className="flex gap-4">
                  <label className="flex items-center flex-1 border border-gray-300 rounded-lg px-4 py-2 cursor-pointer hover:bg-gray-50 text-sm transition-colors">
                    <input 
                      type="radio" 
                      name="status" 
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 mr-2"
                      checked={orderStatus === 'hold'}
                      onChange={() => setOrderStatus('hold')}
                    />
                    <div>
                      <div className="font-semibold text-gray-900">Hold tạm thời</div>
                      <div className="text-[11px] text-gray-500">
                        Tự động nhả chỗ sau {selectedTour?.hold_duration_hours || 48} giờ
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center flex-1 border border-gray-300 rounded-lg px-4 py-2 cursor-pointer hover:bg-gray-50 text-sm transition-colors">
                    <input 
                      type="radio" 
                      name="status" 
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 mr-2"
                      checked={orderStatus === 'sure'}
                      onChange={() => setOrderStatus('sure')}
                    />
                    <div>
                      <div className="font-semibold text-gray-900">Sure chỗ (Đặt chắc chắn)</div>
                      <div className="text-[11px] text-gray-500">Yêu cầu kế toán xuất hóa đơn</div>
                    </div>
                  </label>
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
                {orderStatus !== 'hold' && uniqueCustomers.length > 0 && (
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

              {orderStatus !== 'hold' && showCustomerSelector && (
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

              {orderStatus === 'hold' ? (
                <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-150 space-y-1 text-xs">
                  <div className="font-bold text-blue-900 flex items-center">
                    <Clock className="w-4 h-4 mr-1.5 text-blue-600" />
                    Ghi nhận tự động từ tài khoản của bạn
                  </div>
                  <p className="text-gray-600 leading-relaxed font-semibold">
                    Hệ thống tự động ghi nhận người thực hiện giữ chỗ: <span className="text-blue-700 font-extrabold">{profile?.full_name || user?.email || 'Ẩn danh'} ({currentRole === 'CTV' ? 'CTV' : currentRole === 'Đại lý' ? 'Đại lý' : currentRole === 'sale' ? 'Sale' : currentRole === 'operator' ? 'Điều hành' : 'Quản trị viên'})</span>.
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    * Chế độ giữ chỗ tạm không yêu cầu thông tin của khách trưởng nhóm. Giao diện tối giản giúp bạn đặt giữ chỗ nhanh nhất có thể.
                  </p>
                </div>
              ) : (
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
              )}
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
        <div className="px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-gray-900">Danh sách Đơn hàng của bạn</h3>
          <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-250 shrink-0">
            Tổng cộng: {orders.length} đơn hàng
          </span>
        </div>

        {/* Filters and Sorting Controls */}
        <div className="bg-slate-50 border-b border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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

          {/* Lọc trạng thái */}
          <select
            value={orderFilterStatus}
            onChange={e => setOrderFilterStatus(e.target.value)}
            className="w-full pl-3 pr-10 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="hold">Giữ chỗ (Hold)</option>
            <option value="sure">Chắc chắn (Sure)</option>
            <option value="cancelled">Đã hủy</option>
          </select>

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
                          {order.booker_name || leadPassenger?.full_name}
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
                          {order.status === 'sure' && (
                            <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Sure chỗ
                            </span>
                          )}
                          {order.status === 'cancelled' && (
                            <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-slate-50 text-slate-400 border border-slate-200">
                              Đã huỷ
                            </span>
                          )}
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
                  {isExpanded && (
                    <div className="px-5 pb-6 pt-2 bg-slate-50/40 border-t border-gray-100 space-y-5 animate-in fade-in duration-150">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* Box 1: Surcharges & Room config */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm space-y-3.5">
                          <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-blue-600" />
                              Phụ thu & Dịch vụ nâng cao
                            </span>
                            {/* Nút sửa đơn hàng */}
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
                              <span className="text-gray-500">Phòng đơn (Surcharge):</span>
                              <span className="font-bold text-gray-900">
                                {order.single_room_count ? `${order.single_room_count} phòng` : 'Không đăng ký'}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                              <span className="text-gray-500">Yêu cầu ghép giường:</span>
                              <span className="font-semibold text-gray-800">{order.room_share_info || 'Không có'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                              <span className="text-gray-500">Hoá đơn VAT (10%):</span>
                              <span className={`font-bold ${order.vat_option === 'Xuất VAT' ? 'text-blue-600' : 'text-gray-500'}`}>
                                {order.vat_option || 'Không xuất VAT'}
                              </span>
                            </div>
                            {order.special_requests && (
                              <div className="pt-2">
                                <span className="text-gray-500 block mb-1">Ghi chú đặc biệt (Ăn uống, sức khoẻ...):</span>
                                <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-amber-900 italic leading-relaxed text-[11px]">
                                  "{order.special_requests}"
                                </div>
                              </div>
                            )}
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
                                      {order.booker_name || leadPassenger?.full_name || 'Chưa cung cấp'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-100">
                                    <span className="text-gray-600 font-medium">Số điện thoại:</span>
                                    <span className="font-mono font-bold text-gray-900">
                                      {order.booker_phone || leadPassenger?.phone || 'Chưa cung cấp'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center py-1">
                                    <span className="text-gray-600 font-medium">Người thực hiện:</span>
                                    <span className="text-gray-500 italic">
                                      {order.created_by}
                                    </span>
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
                                  Bản khai chi tiết từng hành khách (Họ tên, Ngày sinh, Hộ chiếu) và chức năng tải lên hồ sơ Visa sẽ tự động kích hoạt sau khi đơn hàng được chuyển sang trạng thái <strong>Sure chỗ (Xác nhận chắc chắn)</strong>.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
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
                                          {passenger.passport_url ? (
                                            <div className="flex flex-col gap-1">
                                              {passenger.passport_url.split(',').filter(Boolean).map((url, uIdx) => {
                                                const isSupabaseFolder = url.includes('supabase.com/dashboard/project') || url.includes('supabase.co');
                                                const isGoogleDriveFolder = url.includes('drive.google.com');
                                                
                                                let label = `Tài liệu #${uIdx + 1}`;
                                                let linkClass = "inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-bold max-w-[120px] truncate bg-blue-50/50 border border-blue-100 px-1.5 py-0.5 rounded whitespace-nowrap";
                                                
                                                if (isGoogleDriveFolder) {
                                                  label = 'Tài liệu';
                                                  linkClass = "inline-flex items-center gap-1 text-[10px] text-emerald-700 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-1 rounded transition-colors font-bold shadow-sm max-w-[150px] truncate cursor-pointer whitespace-nowrap";
                                                } else if (isSupabaseFolder) {
                                                  label = 'Thư mục hồ sơ (Hệ thống)';
                                                  linkClass = "inline-flex items-center gap-1 text-[10px] text-blue-700 hover:text-blue-950 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-1.5 py-1 rounded transition-colors font-bold shadow-sm max-w-[150px] truncate cursor-pointer whitespace-nowrap";
                                                }
                                                    
                                                return (
                                                  <a 
                                                    key={uIdx}
                                                    href={url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className={linkClass}
                                                    title={isGoogleDriveFolder ? 'Mở tài liệu' : isSupabaseFolder ? 'Mở thư mục' : `Xem tài liệu ${uIdx + 1}`}
                                                  >
                                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                                    <span className="truncate">{label}</span>
                                                  </a>
                                                );
                                              })}
                                            </div>
                                          ) : (
                                            <span className="text-gray-400 italic">Chưa tải</span>
                                          )}
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
                        )}
                      </div>

                      {/* Box 3: Action center bar */}
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            order.status === 'hold' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {order.status === 'hold' ? <Clock className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                          </div>
                          <div className="text-xs">
                            <span className="font-bold text-gray-900 block">
                              Yêu cầu nghiệp vụ: {order.status === 'hold' ? 'Nhận thanh toán đặt cọc' : order.status === 'sure' ? 'Xác nhận dịch vụ hoàn tất' : 'Booking đã đóng'}
                            </span>
                            <span className="text-gray-500 mt-0.5 block">
                              {order.status === 'hold' 
                                ? 'Cần chuyển trạng thái đơn sang Sure để giữ phòng & vé máy bay chính thức trước khi đếm ngược kết thúc.' 
                                : order.status === 'sure' 
                                ? 'Đơn hàng an toàn. Điều hành tour và Đại lý có thể tiến hành chuẩn bị hồ sơ visa, vé máy bay.' 
                                : 'Đơn đặt đã huỷ. Quỹ vé đã được giải phóng để bán cho khách hàng khác.'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
                          {order.status === 'hold' && (
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
                              {/* Cancel order booking button */}
                              <button
                                type="button"
                                onClick={() => {
                                  console.log('Cancel button clicked for:', order.id);
                                  setConfirmModalData({
                                    isOpen: true,
                                    title: 'Hủy đơn hàng',
                                    message: `Bạn có chắc chắn muốn HỦY đơn đặt giữ chỗ #${order.id.substring(0, 8)}? Hành động này sẽ trả lại ${orderPassengers.length} chỗ trống về quỹ tour khởi hành.`,
                                    onConfirm: () => cancelOrder(order.id),
                                  });
                                }}
                                className="px-3.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 hover:text-rose-800 transition-colors inline-flex items-center"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                Hủy giữ chỗ
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
                                      message: `Gia hạn thời gian giữ chỗ cho đơn hàng #${order.id.substring(0, 8)}.`,
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

                          {order.status === 'sure' && (
                            <span className="px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg inline-flex items-center">
                              <Check className="w-4 h-4 mr-1.5" /> Đã chốt thành công (Sure)
                            </span>
                          )}

                          {order.status === 'cancelled' && (
                            <span className="px-3.5 py-2 text-xs font-semibold text-gray-400 bg-gray-50 border border-gray-200 rounded-lg inline-flex items-center">
                              Đã hủy đơn hàng
                            </span>
                          )}
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
        onConfirm={(passengers) => {
          if (orderToConfirm) {
            confirmOrder(orderToConfirm, passengers);
            setIsPassengerModalOpen(false);
            setOrderToConfirm(null);
          }
        }}
      />
      <PassengerInputModal 
        isOpen={!!orderToAddPassengers} 
        onClose={() => setOrderToAddPassengers(null)}
        adultCount={orderToAddPassengers ? (allOrders.find(o => o.id === orderToAddPassengers)?.adult_count || 0) + (allOrders.find(o => o.id === orderToAddPassengers)?.child_count || 0) + (allOrders.find(o => o.id === orderToAddPassengers)?.infant_count || 0) - passengers.filter(p => p.order_id === orderToAddPassengers).length : 1}
        childCount={0}
        infantCount={0}
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
    </div>
  );
}
