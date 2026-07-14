import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  FileText, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle, 
  Edit, 
  Map, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  Smartphone,
  Calendar,
  Key,
  ShieldAlert,
  History,
  Briefcase,
  Trash2
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { Passenger, Order } from '../types';
import EditPassengerModal from '../components/EditPassengerModal';
import ActionModal from '../components/ActionModal';

interface BookingInfo {
  passenger_id: string;
  order_id: string;
  tour_id?: string;
  tour_code?: string;
  tour_name?: string;
  is_payer: boolean;
  visa_status: Passenger['visa_status'];
  passport_url?: string;
  status?: Order['status'];
  created_at?: string;
  visa_disqualified_reason?: string;
}

interface CustomerGroup {
  id: string; // Grouping key
  full_name: string;
  dob?: string;
  passport_number?: string;
  phone?: string;
  bookings: BookingInfo[];
  totalSpent: number;
}

export default function PassengersManagement() {
  const { 
    passengers, 
    orders: allOrders, 
    tours, 
    currentRole, 
    updatePassenger,
    deletePassenger,
    membershipSettings
  } = useCRM();
  
  const { profile } = useAuth();

  // Guard access
  const isDenied = useMemo(() => {
    return ['CTV', 'Đại lý', 'accounting'].includes(currentRole);
  }, [currentRole]);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTourId, setSelectedTourId] = useState('all');
  const [selectedVisaStatus, setSelectedVisaStatus] = useState('all');
  const [selectedTier, setSelectedTier] = useState('all');

  const getMembershipTier = (spent: number) => {
    const silver = membershipSettings?.silverMin ?? 20000000;
    const gold = membershipSettings?.goldMin ?? 50000000;
    const platinum = membershipSettings?.platinumMin ?? 100000000;

    if (spent >= platinum) {
      return {
        name: 'Hạng Kim Cương',
        badge: 'bg-purple-100 text-purple-800 border-purple-200 shadow-xs',
        color: 'text-purple-700'
      };
    } else if (spent >= gold) {
      return {
        name: 'Hạng Vàng',
        badge: 'bg-amber-100 text-amber-800 border-amber-200 shadow-xs',
        color: 'text-amber-700'
      };
    } else if (spent >= silver) {
      return {
        name: 'Hạng Bạc',
        badge: 'bg-slate-100 text-slate-800 border-slate-200 shadow-xs',
        color: 'text-slate-700'
      };
    } else {
      return {
        name: 'Hạng Đồng',
        badge: 'bg-amber-50/70 text-amber-900/80 border-amber-100',
        color: 'text-amber-900/60'
      };
    }
  };
  
  // Expanded row state to show booking history
  const [expandedCustomerKeys, setExpandedCustomerKeys] = useState<string[]>([]);

  // Editing passenger state
  const [editingPassenger, setEditingPassenger] = useState<Passenger | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [disqualifiedReasonModal, setDisqualifiedReasonModal] = useState<{ name: string; reason: string } | null>(null);
  
  // Passenger Delete Modal
  const [passengerToDelete, setPassengerToDelete] = useState<{ id: string; name: string } | null>(null);

  // 1. Filter orders based on user permissions
  const myOrders = useMemo(() => {
    if (['admin', 'operator', 'visa'].includes(currentRole)) {
      return allOrders;
    }
    return allOrders.filter(o => o.user_id === profile?.id);
  }, [allOrders, currentRole, profile]);

  // 2. Filtered raw passengers belonging to my orders, discarding placeholder drafts
  const validPassengers = useMemo(() => {
    return passengers.filter(p => {
      const belongsToMyOrder = myOrders.some(o => o.id === p.order_id);
      if (!belongsToMyOrder) return false;

      // Discard pure un-filled placeholders
      const name = (p.full_name || p.name || '').trim();
      const isPlaceholder = name === 'Chưa cung cấp (Giữ chỗ tạm)' ||
        name === 'Chưa cung cấp' ||
        name.startsWith('Người lớn #') ||
        name.startsWith('Trẻ em #') ||
        name.startsWith('Trẻ nhỏ #');

      // Keep if it's not a placeholder
      return !isPlaceholder;
    });
  }, [passengers, myOrders]);

  // 3. Group valid passengers into single Customer Profiles
  const customerProfiles = useMemo(() => {
    const groups: { [key: string]: CustomerGroup } = {};

    validPassengers.forEach(p => {
      const order = myOrders.find(o => o.id === p.order_id);
      const tour = order ? tours.find(t => t.id === order.tour_id) : null;

      const pName = (p.full_name || p.name || '').trim();
      const pDob = (p.dob || '').trim();
      const pPassport = (p.passport_number || '').trim().toUpperCase();
      const pPhone = (p.phone || '').trim();

      // Determine an accurate profile key
      let key = '';
      if (pPassport && pPassport !== '-') {
        key = `PP_${pPassport}`;
      } else if (pPhone && pPhone !== 'Chưa cung cấp' && pPhone !== '-') {
        key = `PH_${pName.toUpperCase().replace(/\s+/g, '')}_${pPhone}`;
      } else {
        key = `DB_${pName.toUpperCase().replace(/\s+/g, '')}_${pDob}`;
      }

      if (!groups[key]) {
        groups[key] = {
          id: key,
          full_name: pName,
          dob: p.dob || undefined,
          passport_number: p.passport_number || undefined,
          phone: p.phone && p.phone !== 'Chưa cung cấp' ? p.phone : undefined,
          bookings: [],
          totalSpent: 0
        };
      }

      groups[key].bookings.push({
        passenger_id: p.id,
        order_id: p.order_id,
        tour_id: tour?.id,
        tour_code: tour?.code,
        tour_name: tour?.name,
        is_payer: p.is_payer,
        visa_status: p.visa_status,
        passport_url: p.passport_url,
        status: order?.status,
        created_at: order?.created_at,
        visa_disqualified_reason: p.visa_disqualified_reason
      });
    });

    // Sort bookings inside each customer by date (newest first)
    Object.values(groups).forEach(g => {
      g.bookings.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      // Calculate total spent for payer bookings of 'sure' or 'paid' status
      let spent = 0;
      const processed = new Set<string>();
      g.bookings.forEach(b => {
        if (b.is_payer && (b.status === 'sure' || b.status === 'paid') && !processed.has(b.order_id)) {
          processed.add(b.order_id);
          const order = myOrders.find(o => o.id === b.order_id);
          if (order) {
            spent += (order.total_price || 0);
          }
        }
      });
      g.totalSpent = spent;
    });

    return Object.values(groups);
  }, [validPassengers, myOrders, tours]);

  // 4. Search and filter logic on grouped Customer Profiles
  const filteredCustomers = useMemo(() => {
    return customerProfiles.filter(c => {
      // Search match
      const nameMatch = c.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      const passportMatch = c.passport_number?.toLowerCase().includes(searchTerm.toLowerCase());
      const phoneMatch = c.phone?.toLowerCase().includes(searchTerm.toLowerCase());
      const bookingMatch = c.bookings.some(b => 
        b.order_id.toLowerCase().includes(searchTerm.toLowerCase()) || 
        b.tour_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.tour_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchesSearch = !searchTerm || nameMatch || passportMatch || phoneMatch || bookingMatch;

      // Tour match (any of the customer's registered tours)
      const matchesTour = selectedTourId === 'all' || c.bookings.some(b => b.tour_id === selectedTourId);

      // Visa status match (based on their latest booking)
      const latestBooking = c.bookings[0];
      const matchesVisa = selectedVisaStatus === 'all' || (latestBooking && latestBooking.visa_status === selectedVisaStatus);

      // Membership tier match
      let matchesTier = true;
      if (selectedTier !== 'all') {
        const tierInfo = getMembershipTier(c.totalSpent);
        matchesTier = tierInfo.name === selectedTier;
      }

      return matchesSearch && matchesTour && matchesVisa && matchesTier;
    });
  }, [customerProfiles, searchTerm, selectedTourId, selectedVisaStatus, selectedTier, membershipSettings]);

  // Stats derived from Customer Profiles
  const stats = useMemo(() => {
    const totalCustomers = customerProfiles.length;
    let totalBookingsCount = 0;
    
    // Counting overall visa status based on latest registration
    let pending = 0;
    let processing = 0;
    let approved = 0;
    let rejected = 0;
    let notRequired = 0;

    customerProfiles.forEach(c => {
      totalBookingsCount += c.bookings.length;
      const latest = c.bookings[0];
      if (latest) {
        if (latest.visa_status === 'approved') approved++;
        else if (latest.visa_status === 'processing') processing++;
        else if (latest.visa_status === 'rejected') rejected++;
        else if (latest.visa_status === 'not_required') notRequired++;
        else pending++;
      }
    });

    return {
      totalCustomers,
      totalBookingsCount,
      pending,
      processing,
      approved,
      rejected,
      notRequired
    };
  }, [customerProfiles]);

  const toggleExpand = (key: string) => {
    setExpandedCustomerKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const getVisaBadge = (status: Passenger['visa_status'], reason?: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Đã có Visa
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5" />
            Đang xử lý
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
            <XCircle className="w-3.5 h-3.5" />
            Bị từ chối
          </span>
        );
      case 'disqualified':
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDisqualifiedReasonModal({
                name: 'Hành khách',
                reason: reason || 'Chưa cập nhật lý do chi tiết.'
              });
            }}
            title="Bấm để xem lý do hồ sơ chưa đạt"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap cursor-pointer hover:bg-rose-200 transition-colors shadow-sm"
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            Hồ sơ chưa đạt
          </button>
        );
      case 'not_required':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
            <AlertCircle className="w-3.5 h-3.5" />
            Miễn Visa
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5" />
            Chờ nộp hồ sơ
          </span>
        );
    }
  };

  const formatDob = (dobString?: string) => {
    if (!dobString) return '-';
    try {
      const d = new Date(dobString);
      if (isNaN(d.getTime())) return dobString;
      return d.toLocaleDateString('vi-VN');
    } catch {
      return dobString;
    }
  };

  // Blocked Screen UI for restricted roles
  if (isDenied) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-gray-200 max-w-xl mx-auto mt-12 shadow-sm font-sans animate-fade-in">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4 animate-bounce" />
        <h3 className="text-base font-black text-gray-950 uppercase tracking-tight">Quyền truy cập bị từ chối</h3>
        <p className="text-sm text-gray-500 mt-2">
          Hệ thống ghi nhận bạn đang đăng nhập với vai trò <strong className="text-rose-600">{currentRole}</strong>. 
          Menu <strong>Khách hàng đi Tour</strong> chỉ được mở khóa cho Ban quản trị (Admin), Điều hành (Operator), Sale và Visa.
        </p>
        <p className="text-xs text-gray-400 mt-4 italic border-t border-gray-100 pt-3">
          Vui lòng liên hệ với Quản lý Điều hành nếu bạn cho rằng đây là một sự sai sót.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans animate-fade-in">
      
      {/* Header section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Quản lý Khách hàng</h2>
        <p className="text-sm text-gray-500 mt-1">
          Hồ sơ tập trung toàn bộ khách hàng đã tham gia dịch vụ. Mỗi hồ sơ tích hợp lịch sử đăng ký, tổng chi tiêu tích lũy, phân hạng thành viên và các tài liệu đính kèm.
        </p>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Khách hàng duy nhất</span>
          <span className="text-2xl font-black text-slate-800 mt-1 block">{stats.totalCustomers}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500 block">Chờ nộp hồ sơ (Mới nhất)</span>
          <span className="text-2xl font-black text-amber-600 mt-1 block">{stats.pending}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-500 block">Đang xử lý (Mới nhất)</span>
          <span className="text-2xl font-black text-blue-600 mt-1 block">{stats.processing}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500 block">Đã duyệt (Mới nhất)</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">{stats.approved}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500 block">Bị từ chối (Mới nhất)</span>
          <span className="text-2xl font-black text-rose-600 mt-1 block">{stats.rejected}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Miễn visa</span>
          <span className="text-2xl font-black text-slate-600 mt-1 block">{stats.notRequired}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo Tên khách, Số điện thoại, Số hộ chiếu hoặc Mã đơn hàng..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800"
            />
          </div>

          {/* Membership Tier Filter */}
          <div className="w-full md:w-48">
            <select
              value={selectedTier}
              onChange={e => setSelectedTier(e.target.value)}
              className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg text-xs font-bold bg-white text-slate-700 outline-none cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">👑 Mọi Hạng thành viên</option>
              <option value="Hạng Đồng">🟤 Hạng Đồng</option>
              <option value="Hạng Bạc">⚪ Hạng Bạc</option>
              <option value="Hạng Vàng">🟡 Hạng Vàng</option>
              <option value="Hạng Kim Cương">🟣 Hạng Kim Cương</option>
            </select>
          </div>

          {/* Visa Status Filter */}
          <div className="w-full md:w-48">
            <select
              value={selectedVisaStatus}
              onChange={e => setSelectedVisaStatus(e.target.value)}
              className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg text-xs font-bold bg-white text-slate-700 outline-none cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">🛂 Mọi Visa status (Mới nhất)</option>
              <option value="pending">⏳ Chờ nộp hồ sơ</option>
              <option value="processing">⚙️ Đang xử lý</option>
              <option value="approved">✅ Đã có Visa</option>
              <option value="rejected">❌ Bị từ chối</option>
              <option value="not_required">⚪ Miễn Visa</option>
            </select>
          </div>

          {/* Tour Selection Filter */}
          <div className="w-full md:w-56">
            <select
              value={selectedTourId}
              onChange={e => setSelectedTourId(e.target.value)}
              className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg text-xs font-bold bg-white text-slate-700 outline-none cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">🗺️ Khách từng đi bất kỳ Tour nào</option>
              {tours.map(t => (
                <option key={t.id} value={t.id}>
                  [{t.code}] {t.name.length > 20 ? t.name.substring(0, 20) + '...' : t.name}
                </option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Main Grouped Customers Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-250">
            <thead className="bg-gray-50/75">
              <tr>
                <th scope="col" className="w-[60px] px-4 py-3.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider"></th>
                <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Họ và tên khách</th>
                <th scope="col" className="px-4 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Ngày sinh</th>
                <th scope="col" className="px-4 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Số hộ chiếu</th>
                <th scope="col" className="px-4 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Số điện thoại</th>
                <th scope="col" className="px-4 py-3.5 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tổng chi tiêu</th>
                <th scope="col" className="px-4 py-3.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">Hạng thành viên</th>
                <th scope="col" className="px-4 py-3.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">Số Tour</th>
                <th scope="col" className="px-4 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Visa (Gần nhất)</th>
                <th scope="col" className="px-4 py-3.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-150">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm font-semibold text-gray-400">
                    Không tìm thấy khách hàng nào khớp với điều kiện lọc.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(c => {
                  const isExpanded = expandedCustomerKeys.includes(c.id);
                  const latestBooking = c.bookings[0];
                  
                  return (
                    <React.Fragment key={c.id}>
                      {/* Main Row */}
                      <tr className={`hover:bg-gray-50/50 transition-colors ${isExpanded ? 'bg-blue-50/10' : ''}`}>
                        {/* Expand / Collapse Button */}
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleExpand(c.id)}
                            className="p-1 rounded hover:bg-gray-150 text-gray-500 transition-all"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-blue-600 font-extrabold" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Name */}
                        <td className="px-6 py-4">
                          <span className="font-extrabold text-gray-900 text-xs tracking-tight uppercase">
                            {c.full_name}
                          </span>
                        </td>

                        {/* DOB */}
                        <td className="px-4 py-4 text-xs font-bold text-gray-600">
                          {formatDob(c.dob)}
                        </td>

                        {/* Passport */}
                        <td className="px-4 py-4 text-xs font-mono font-bold text-slate-800 uppercase">
                          {c.passport_number || <span className="text-gray-300">-</span>}
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-4 text-xs font-semibold text-gray-700">
                          {c.phone || <span className="text-gray-300">-</span>}
                        </td>

                        {/* Total Spent */}
                        <td className="px-4 py-4 text-xs font-bold text-gray-900 text-right">
                          {c.totalSpent.toLocaleString('vi-VN')} đ
                        </td>

                        {/* Membership Tier */}
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border ${getMembershipTier(c.totalSpent).badge}`}>
                            {getMembershipTier(c.totalSpent).name}
                          </span>
                        </td>

                        {/* Booking Count */}
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
                            <History className="w-3 h-3" />
                            {c.bookings.length}
                          </span>
                        </td>

                        {/* Latest Visa */}
                        <td className="px-4 py-4">
                          {latestBooking ? getVisaBadge(latestBooking.visa_status, latestBooking.visa_disqualified_reason) : <span className="text-gray-300">-</span>}
                        </td>

                        {/* Toggle Expand View */}
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleExpand(c.id)}
                            className="text-xs font-extrabold text-blue-600 hover:text-blue-800 focus:outline-none"
                          >
                            {isExpanded ? 'Đóng lịch sử' : 'Xem lịch sử'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Section showing all tour registrations */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="p-0 bg-slate-50/70 border-b border-gray-200">
                            <div className="p-6 space-y-4 border-l-4 border-blue-500 ml-4 my-2">
                              <h4 className="text-xs font-black text-gray-950 uppercase tracking-wider flex items-center gap-1.5">
                                <Briefcase className="w-4 h-4 text-blue-600" />
                                Lịch sử đăng ký tour của hành khách {c.full_name}
                              </h4>
                              
                              <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm bg-white">
                                <table className="min-w-full divide-y divide-gray-150">
                                  <thead className="bg-gray-100/70">
                                    <tr className="whitespace-nowrap">
                                      <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">Mã đơn hàng</th>
                                      <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">Tour tham gia</th>
                                      <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">Ngày đi</th>
                                      <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">Vai trò</th>
                                      <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">Hồ sơ / Visa</th>
                                      <th scope="col" className="px-4 py-2 text-center text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">Thao tác</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 bg-white">
                                    {c.bookings.map((b, bIdx) => {
                                      return (
                                        <tr key={b.passenger_id} className="hover:bg-gray-50/40">
                                          {/* Order ID */}
                                          <td className="px-4 py-3 text-xs font-bold text-blue-600 font-mono whitespace-nowrap">
                                            {b.order_id}
                                          </td>

                                          {/* Tour Code & Name */}
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex flex-col">
                                              <span className="inline-block self-start px-1 py-0.2 text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-100 rounded uppercase whitespace-nowrap">
                                                {b.tour_code || 'TOUR'}
                                              </span>
                                              <span className="text-[11px] font-semibold text-gray-800 mt-0.5 max-w-xs truncate" title={b.tour_name}>
                                                {b.tour_name || 'N/A'}
                                              </span>
                                            </div>
                                          </td>

                                          {/* Date */}
                                          <td className="px-4 py-3 text-[11px] font-medium text-gray-500 whitespace-nowrap">
                                            {b.created_at ? formatDob(b.created_at) : '-'}
                                          </td>

                                          {/* Role */}
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            {b.is_payer ? (
                                              <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-blue-100 text-blue-800 uppercase tracking-wide whitespace-nowrap inline-block">
                                                Trưởng đoàn
                                              </span>
                                            ) : (
                                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-600 uppercase tracking-wide whitespace-nowrap inline-block">
                                                Đi cùng
                                              </span>
                                            )}
                                          </td>

                                          {/* Documents / Visa badge */}
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                              <div className="whitespace-nowrap">{getVisaBadge(b.visa_status, b.visa_disqualified_reason)}</div>
                                              {b.passport_url && (
                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                  {b.passport_url.split(',').map((url, uIdx) => {
                                                    const isSupabaseFolder = url.includes('supabase.com/dashboard/project') || url.includes('supabase.co');
                                                    const isGoogleDriveFolder = url.includes('drive.google.com');
                                                    
                                                    let label = `Tài liệu đính kèm #${uIdx + 1}`;
                                                    let linkClass = "inline-flex items-center gap-1 text-[9px] text-blue-600 hover:text-blue-800 hover:underline font-bold bg-blue-50/50 border border-blue-100 px-1.5 py-0.5 rounded";
                                                    
                                                    if (isGoogleDriveFolder) {
                                                      label = 'Mở tài liệu';
                                                      linkClass = "inline-flex items-center gap-1.5 text-[10px] text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 font-bold bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md transition-colors shadow-sm cursor-pointer";
                                                    } else if (isSupabaseFolder) {
                                                      label = 'Mở thư mục hồ sơ (Hệ thống)';
                                                      linkClass = "inline-flex items-center gap-1.5 text-[10px] text-blue-700 hover:text-blue-900 hover:bg-blue-100 font-bold bg-blue-50 border border-blue-200 px-2 py-1 rounded-md transition-colors shadow-sm cursor-pointer";
                                                    }
                                                    
                                                    return (
                                                      <a 
                                                        key={uIdx}
                                                        href={url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className={linkClass}
                                                      >
                                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                                        <span>{label}</span>
                                                      </a>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          </td>

                                          {/* Action button inside this booking */}
                                          <td className="px-4 py-3 text-center">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                // Find the real passenger record in state
                                                const realP = passengers.find(rp => rp.id === b.passenger_id);
                                                if (realP) {
                                                  setEditingPassenger(realP);
                                                  setIsEditModalOpen(true);
                                                }
                                              }}
                                              className="px-2.5 py-1 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded transition-all"
                                            >
                                              <Edit className="w-3 h-3" />
                                              Sửa hồ sơ
                                            </button>
                                            {currentRole === 'admin' && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const realP = passengers.find(rp => rp.id === b.passenger_id);
                                                  setPassengerToDelete({
                                                    id: b.passenger_id,
                                                    name: realP?.full_name || 'Khách hàng'
                                                  });
                                                }}
                                                className="px-2.5 py-1 inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded transition-all ml-2"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                                Xóa
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {/* Related passengers section */}
                              {(() => {
                                // Find all related passengers across all orders that c participated in
                                const relatedList: Array<{
                                  order_id: string;
                                  tour_code?: string;
                                  tour_name?: string;
                                  passenger_name: string;
                                  relationship: 'paid_by_them' | 'paid_for_them';
                                  phone?: string;
                                  passport?: string;
                                  visa_status: Passenger['visa_status'];
                                  visa_disqualified_reason?: string;
                                }> = [];

                                c.bookings.forEach(b => {
                                  if (b.is_payer) {
                                    // Current customer is the payer. Any other passenger in this order is a companion
                                    const companions = passengers.filter(p => p.order_id === b.order_id && p.id !== b.passenger_id);
                                    companions.forEach(comp => {
                                      const compName = (comp.full_name || comp.name || '').trim();
                                      const isPlaceholder = compName === 'Chưa cung cấp (Giữ chỗ tạm)' ||
                                        compName === 'Chưa cung cấp' ||
                                        compName.startsWith('Người lớn #') ||
                                        compName.startsWith('Trẻ em #') ||
                                        compName.startsWith('Trẻ nhỏ #');

                                      if (compName && !isPlaceholder) {
                                        relatedList.push({
                                          order_id: b.order_id,
                                          tour_code: b.tour_code,
                                          tour_name: b.tour_name,
                                          passenger_name: compName,
                                          relationship: 'paid_by_them',
                                          phone: comp.phone,
                                          passport: comp.passport_number,
                                          visa_status: comp.visa_status,
                                          visa_disqualified_reason: comp.visa_disqualified_reason
                                        });
                                      }
                                    });
                                  } else {
                                    // Current customer is NOT the payer. Find the payer of this order
                                    const orderPayer = passengers.find(p => p.order_id === b.order_id && p.is_payer);
                                    if (orderPayer) {
                                      const payerName = (orderPayer.full_name || orderPayer.name || '').trim();
                                      const isPlaceholder = payerName === 'Chưa cung cấp (Giữ chỗ tạm)' ||
                                        payerName === 'Chưa cung cấp' ||
                                        payerName.startsWith('Người lớn #') ||
                                        payerName.startsWith('Trẻ em #') ||
                                        payerName.startsWith('Trẻ nhỏ #');

                                      if (payerName && !isPlaceholder) {
                                        relatedList.push({
                                          order_id: b.order_id,
                                          tour_code: b.tour_code,
                                          tour_name: b.tour_name,
                                          passenger_name: payerName,
                                          relationship: 'paid_for_them',
                                          phone: orderPayer.phone,
                                          passport: orderPayer.passport_number,
                                          visa_status: orderPayer.visa_status,
                                          visa_disqualified_reason: orderPayer.visa_disqualified_reason
                                        });
                                      }
                                    }
                                  }
                                });

                                if (relatedList.length === 0) return null;

                                return (
                                  <div className="mt-6 space-y-3">
                                    <h5 className="text-[11px] font-black text-gray-950 uppercase tracking-wider flex items-center gap-1.5">
                                      <Users className="w-4 h-4 text-emerald-600" />
                                      Hành khách liên quan (Người liên quan trong đơn hàng)
                                    </h5>
                                    <div className="overflow-hidden border border-emerald-100 rounded-lg shadow-sm bg-white">
                                      <table className="min-w-full divide-y divide-gray-150">
                                        <thead className="bg-emerald-50/40">
                                          <tr>
                                            <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold text-emerald-800 uppercase">Họ và tên</th>
                                            <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold text-emerald-800 uppercase">Mối quan hệ đơn hàng</th>
                                            <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold text-emerald-800 uppercase">Mã đơn</th>
                                            <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold text-emerald-800 uppercase">Hộ chiếu</th>
                                            <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold text-emerald-800 uppercase">Điện thoại</th>
                                            <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold text-emerald-800 uppercase">Visa</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white text-xs">
                                          {relatedList.map((rel, rIdx) => (
                                            <tr key={rIdx} className="hover:bg-slate-50/50">
                                              <td className="px-4 py-2.5 font-bold text-gray-900 uppercase">{rel.passenger_name}</td>
                                              <td className="px-4 py-2.5">
                                                {rel.relationship === 'paid_by_them' ? (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                    Được khách này chi tiền (Đi cùng)
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                                    Người chi tiền (Trưởng đoàn của họ)
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-4 py-2.5 font-mono text-gray-500">{rel.order_id}</td>
                                              <td className="px-4 py-2.5 font-mono text-gray-600">{rel.passport || '-'}</td>
                                              <td className="px-4 py-2.5 text-gray-600">{rel.phone || '-'}</td>
                                              <td className="px-4 py-2.5">{getVisaBadge(rel.visa_status, rel.visa_disqualified_reason)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ActionModal
        isOpen={!!passengerToDelete}
        onClose={() => setPassengerToDelete(null)}
        title="Xóa khách hàng"
        message={`Bạn có chắc chắn muốn xóa khách hàng "${passengerToDelete?.name}" khỏi hệ thống không? Hành động này không thể hoàn tác.`}
        onConfirm={() => {
          if (passengerToDelete) {
            deletePassenger(passengerToDelete.id);
            setPassengerToDelete(null);
          }
        }}
      />

      {/* Edit Passenger Dialog Modal */}
      {isEditModalOpen && editingPassenger && (
        <EditPassengerModal 
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingPassenger(null);
          }}
          passenger={editingPassenger}
          tourPriceVisa={editingPassenger ? tours.find(t => t.id === allOrders.find(o => o.id === editingPassenger.order_id)?.tour_id)?.price_visa_tour : undefined}
          onSave={(passengerId, updatedData) => {
            updatePassenger(passengerId, updatedData);
            setIsEditModalOpen(false);
            setEditingPassenger(null);
          }}
        />
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

    </div>
  );
}
