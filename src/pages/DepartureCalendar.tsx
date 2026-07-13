import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/context/CRMContext';
import { useAuth } from '@/context/AuthContext';
import { Tour, TourStatus } from '@/types';
import { Filter, Search, Plus, Plane, Calendar as CalendarIcon, User, ChevronDown, ChevronUp, Building, Tag, X, Clock, ShoppingCart, Users, FileText, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { DatePicker } from '../components/DatePicker';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN').format(amount);
};

const formatDate = (dateString: string | undefined | null) => {
  if (!dateString) return 'Chưa xác định';
  try {
    return format(new Date(dateString), 'dd/MM/yyyy');
  } catch (e) {
    return 'Lỗi ngày';
  }
};

const SeatStatusBadge = ({ status }: { status: Tour['seat_status'] }) => {
  if (status === 'Còn chỗ') return <span className="inline-flex items-center px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-sm">{status}</span>;
  if (status === 'Hết chỗ') return <span className="inline-flex items-center px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 shadow-sm">{status}</span>;
  if (status === 'Overbooked') return <span className="inline-flex items-center px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-purple-50 text-purple-700 border border-purple-200/60 shadow-sm">{status}</span>;
  return null;
};

const TourCard: React.FC<{ 
  tour: Tour; 
  onBookClick: (tour: Tour) => void;
  onShowNotice: (tour: Tour) => void;
}> = ({ tour, onBookClick, onShowNotice }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow font-sans">

      <div 
        className="p-5 cursor-pointer flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Left side: Tour Name & Basic info */}
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h3 className="text-lg font-bold text-gray-900 leading-tight uppercase">
              {tour.name}
            </h3>
            
            {/* Action buttons horizontal next to tour name */}
            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              {tour.itinerary_pdf_url ? (
                <a
                  href={tour.itinerary_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-all shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5 mr-1 shrink-0 text-blue-600" />
                  Lịch trình tour
                </a>
              ) : (
                <button
                  onClick={() => alert("File PDF lịch trình chi tiết đang được cập nhật bởi Điều hành. Vui lòng kiểm tra lại sau!")}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-gray-400 bg-gray-50 border border-gray-200 rounded-md cursor-not-allowed"
                >
                  <FileText className="w-3.5 h-3.5 mr-1 shrink-0" />
                  Lịch trình tour
                </button>
              )}

              <button
                onClick={() => onShowNotice(tour)}
                className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-md transition-all shadow-sm"
              >
                <HelpCircle className="w-3.5 h-3.5 mr-1 shrink-0 text-orange-600" />
                Thông tin lưu ý
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <SeatStatusBadge status={tour.seat_status} />
              {tour.tour_status && (
                <span className={`inline-flex items-center px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full shadow-sm ${
                  tour.tour_status === 'on_sale' ? 'bg-amber-50 text-amber-700 border border-amber-200/60' :
                  tour.tour_status === 'last_minute' ? 'bg-rose-50 text-rose-700 border border-rose-200/60' :
                  tour.tour_status === 'holiday' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60' :
                  tour.tour_status === 'noshop' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                  'bg-blue-50 text-blue-700 border border-blue-200/60'
                }`}>
                  {tour.tour_status === 'on_sale' ? 'Giảm giá' :
                   tour.tour_status === 'last_minute' ? 'Giờ chót' :
                   tour.tour_status === 'holiday' ? 'Lễ Tết' :
                   tour.tour_status === 'noshop' ? 'No-shop' : 'Mở bán'}
                </span>
              )}
            </div>
          </div>

          {/* Product type badge and summary details */}
          {(tour.tour_type && tour.tour_type !== 'internal') && (
            <div className="flex flex-wrap gap-2 items-center text-xs mt-1">
              {tour.tour_type === 'partner' && (
                <span className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-bold uppercase tracking-wide text-[10px] shadow-sm flex items-center gap-1.5">
                  🤝 GỬI KHÁCH ĐỐI TÁC: <span className="underline">{tour.partner_name}</span> ({tour.partner_contact})
                </span>
              )}
              {tour.tour_type === 'private' && (
                <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200/60 font-bold uppercase tracking-wide text-[10px] shadow-sm flex items-center gap-1.5">
                  👑 TOUR ĐOÀN RIÊNG: <span className="underline">{tour.organization_name}</span> {tour.custom_requirements ? `| Yêu cầu: ${tour.custom_requirements}` : ''}
                </span>
              )}
              {tour.tour_type === 'visa' && (
                <span className="px-2.5 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200/60 font-bold uppercase tracking-wide text-[10px] shadow-sm flex items-center gap-1.5">
                  🛂 DỊCH VỤ VISA LẺ: <span className="underline">{tour.visa_country}</span> — {tour.visa_service_type} ({tour.visa_speed === 'urgent' ? '⚡ KHẨN CẤP' : '⏳ THƯỜNG QUY'})
                </span>
              )}
            </div>
          )}
          
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
            <div className="flex items-center text-blue-700 font-medium">
              <Tag className="w-4 h-4 mr-1.5" />
              {tour.code}
            </div>
            {tour.destination && (
              <div className="flex items-center font-bold text-slate-900">
                <Building className="w-4 h-4 mr-1.5 text-blue-500" />
                {tour.destination}
              </div>
            )}
            {tour.tour_type !== 'visa' && (
              <>
                <div className="flex items-center font-medium text-gray-900">
                  <CalendarIcon className="w-4 h-4 mr-1.5 text-gray-400" />
                  Ngày đi: {formatDate(tour.departure_time || tour.start_date)}
                </div>
                <div className="flex items-center">
                  <CalendarIcon className="w-4 h-4 mr-1.5 text-gray-400" />
                  {tour.duration}
                </div>
                <div className="flex items-center font-medium">
                  <Plane className="w-4 h-4 mr-1.5 text-gray-400" />
                  {tour.airline}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right side: Key Numbers */}
        <div className="flex flex-wrap sm:flex-nowrap gap-6 items-center w-full xl:w-auto">
          {/* Seats Info */}
          {tour.tour_type !== 'visa' && (
            <div className="flex gap-4 text-sm bg-gray-50 px-4 py-2.5 rounded-lg border border-gray-100 flex-1 sm:flex-none justify-center">
              <div className="flex flex-col items-center">
                <span className="text-gray-500 text-xs mb-1">Đã bán</span>
                <span className="font-semibold text-blue-700 text-base">{tour.sold_seats}</span>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="flex flex-col items-center">
                <span className="text-gray-500 text-xs mb-1">Giữ chỗ</span>
                <span className="font-semibold text-orange-500 text-base">{tour.hold_seats}</span>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="flex flex-col items-center">
                <span className="text-gray-500 text-xs mb-1">Còn lại</span>
                <span className="font-bold text-green-600 text-base">{tour.available_seats}</span>
              </div>
            </div>
          )}

          {/* Pricing */}
          <div className="text-right min-w-[140px]">
            <div className="text-xl font-bold text-red-600">{formatCurrency(tour.price)}</div>
            <div className="text-xs text-gray-500 font-medium">
              HH: <span className="font-semibold text-gray-900">{formatCurrency(tour.commission)}</span>
            </div>
          </div>

          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 self-center hidden sm:block">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>
      <div className="border-b border-dashed border-gray-200 mx-5" />

      {/* Expanded Details */}
      {expanded && (
        <div className="px-5 py-5 border-t border-gray-100 bg-gray-50/50 space-y-6 animate-in slide-in-from-top-2 duration-200">
          {/* Custom Pricing Table Row */}
          {tour.tour_type !== 'visa' && (
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <h4 className="font-bold text-xs uppercase tracking-wider text-blue-700 mb-3 flex items-center">
                <span className="w-1.5 h-3 bg-blue-600 rounded mr-2 inline-block"></span>
                Biểu giá tour chi tiết theo độ tuổi & dịch vụ
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                <div className="bg-blue-50/30 p-3 rounded-lg border border-blue-100/50">
                  <div className="text-xs text-gray-500 mb-1 font-semibold">Người lớn (≥ 10 tuổi)</div>
                  <div className="text-base font-bold text-gray-900">{formatCurrency(tour.price_adult ?? tour.price)} VND</div>
                </div>
                <div className="bg-green-50/30 p-3 rounded-lg border border-green-100/50">
                  <div className="text-xs text-gray-500 mb-1 font-semibold">Trẻ em (2 - dưới 10 tuổi)</div>
                  <div className="text-base font-bold text-gray-900">{formatCurrency(tour.price_child ?? Math.round(tour.price * 0.8))} VND</div>
                </div>
                <div className="bg-purple-50/30 p-3 rounded-lg border border-purple-100/50">
                  <div className="text-xs text-gray-500 mb-1 font-semibold">Trẻ nhỏ (&lt; 2 tuổi)</div>
                  <div className="text-base font-bold text-gray-900">{formatCurrency(tour.price_infant ?? Math.round(tour.price * 0.3))} VND</div>
                </div>
                <div className="bg-red-50/30 p-3 rounded-lg border border-red-100/50">
                  <div className="text-xs text-gray-500 mb-1 font-semibold">Phụ thu phòng đơn</div>
                  <div className="text-base font-bold text-red-600">{formatCurrency(tour.single_room_surcharge ?? 7500000)} VND</div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Column 1: Dates & Location */}
          <div className="space-y-3 text-sm">
            <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-blue-600" />
              Lịch trình & Dịch vụ
            </h4>
            {tour.tour_type !== 'visa' && (
              <>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-gray-500 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Ngày đi:</span>
                  </span>
                  <span className="font-medium text-gray-900">{formatDate(tour.departure_time)}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-gray-500 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Ngày về:</span>
                  </span>
                  <span className="font-medium text-gray-900">{formatDate(tour.return_time)}</span>
                </div>
              </>
            )}
            {tour.category && (
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-500 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Danh mục:</span>
                </span>
                <span className="font-medium text-gray-900">{tour.category}</span>
              </div>
            )}
            {tour.hold_duration_hours && tour.tour_type !== 'visa' && (
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-500 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Thời gian giữ chỗ:</span>
                </span>
                <span className="font-bold text-orange-600">{tour.hold_duration_hours} giờ</span>
              </div>
            )}
            {tour.tour_type !== 'visa' && (
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-500 flex items-center gap-2">
                  <Building className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Khách sạn:</span>
                </span>
                <span className="font-medium text-emerald-700 flex items-center gap-1">
                  {tour.hotel}
                </span>
              </div>
            )}
          </div>

          {/* Column 2: Flights & Guide */}
          {tour.tour_type !== 'visa' && (
            <div className="space-y-4 text-sm">
              <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">Vận chuyển & HDV</h4>
              {tour.flight_out && (
                <div className="flex gap-3">
                  <Plane className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 w-full">
                    <div className="text-gray-500 text-xs mb-0.5">Chuyến đi</div>
                    <div className="font-medium text-gray-900">{tour.flight_out}</div>
                    {tour.flight_out_transit && (
                      <div className="relative pl-4 mt-1 border-l-2 border-dashed border-gray-200 ml-1">
                        <div className="text-[11px] text-orange-600 font-medium mb-0.5 uppercase tracking-wide">Quá cảnh</div>
                        <div className="font-medium text-gray-900">{tour.flight_out_transit}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {tour.flight_in && (
                <div className="flex gap-3 mt-4">
                  <Plane className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 w-full">
                    <div className="text-gray-500 text-xs mb-0.5">Chuyến về</div>
                    <div className="font-medium text-gray-900">{tour.flight_in}</div>
                    {tour.flight_in_transit && (
                      <div className="relative pl-4 mt-1 border-l-2 border-dashed border-gray-200 ml-1">
                        <div className="text-[11px] text-orange-600 font-medium mb-0.5 uppercase tracking-wide">Quá cảnh</div>
                        <div className="font-medium text-gray-900">{tour.flight_in_transit}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {tour.transit_info && (
                <div className="mt-2 bg-orange-50 text-orange-800 px-3 py-2 rounded-lg border border-orange-100 flex items-center">
                   <span className="text-xs font-medium">{tour.transit_info}</span>
                </div>
              )}
              {tour.guide_name && (
                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                  <User className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-gray-500 text-xs mb-0.5">Hướng dẫn viên</div>
                    <div className="font-medium text-blue-700 uppercase">
                      {tour.guide_name} {tour.guide_phone && `- ${tour.guide_phone}`}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Column 3: Status & Action */}
          <div className="space-y-3 text-sm flex flex-col h-full">
            <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">Thông tin khác</h4>
            {tour.ticket_status && tour.tour_type !== 'visa' && (
              <div className="flex justify-between">
                <span className="text-gray-500">Tình trạng vé:</span>
                <span className="font-semibold text-blue-700">{tour.ticket_status}</span>
              </div>
            )}
            {tour.visa_deadline && (
              <div className="flex justify-between">
                <span className="text-gray-500">Hạn nhận hồ sơ:</span>
                <span className="font-medium text-red-600">{formatDate(tour.visa_deadline)}</span>
              </div>
            )}
            {tour.description && (
              <div className="flex flex-col gap-1 mt-2">
                <span className="text-gray-500">Ghi chú:</span>
                <span className="text-gray-700">{tour.description}</span>
              </div>
            )}
            <div className="mt-auto pt-6">
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBookClick(tour);
                }}
                className="w-full inline-flex items-center justify-center bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={tour.available_seats === 0}
              >
                Giữ chỗ / Đặt Đơn hàng
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default function DepartureCalendar() {
  const navigate = useNavigate();
  const { tours, createOrder, currentRole, passengers = [], categories = [] } = useCRM();
  const { profile, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [noticeTour, setNoticeTour] = useState<Tour | null>(null);
  
  // Dynamic filter states
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTourStatus, setSelectedTourStatus] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date_asc');

  // States for Booking Modal Popup
  const [selectedTourForBooking, setSelectedTourForBooking] = useState<Tour | null>(null);
  const [orderStatus, setOrderStatus] = useState<'hold' | 'sure'>('hold');
  const [bookerName, setBookerName] = useState('');
  const [bookerPhone, setBookerPhone] = useState('');
  const [createdByPartnerName, setCreatedByPartnerName] = useState('');
  const [adultCount, setAdultCount] = useState(1);
  const [childCount, setChildCount] = useState(0);
  const [infantCount, setInfantCount] = useState(0);
  const [singleRoomCount, setSingleRoomCount] = useState(0);
  const [roomShareInfo, setRoomShareInfo] = useState('Không ghép');
  const [vatOption, setVatOption] = useState('Không xuất VAT');
  const [specialRequests, setSpecialRequests] = useState('');
  const [countdown, setCountdown] = useState(300);

  // Auto-complete Customer suggestions logic
  const [suggestions, setSuggestions] = useState<any[]>([]);
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

  const uniqueCustomers = React.useMemo(() => {
    const map = new Map<string, any>();
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

  const selectSuggestion = (p: any) => {
    setBookerName(p.full_name.toUpperCase());
    setBookerPhone(p.phone || '');
    setSuggestions([]);
    setFocusedInput(null);
  };

  const handleAdultCountChange = (val: number) => {
    if (!selectedTourForBooking) return;
    const maxAllowed = Math.max(0, selectedTourForBooking.total_seats + (selectedTourForBooking.overbook_limit || 0) - selectedTourForBooking.sold_seats - selectedTourForBooking.hold_seats);
    const potentialTotal = val + childCount;
    if (potentialTotal > maxAllowed) {
      const allowedAdult = Math.max(1, maxAllowed - childCount);
      setAdultCount(allowedAdult);
      alert(`Số lượng khách vượt quá số chỗ trống và overbooking cho phép! Hệ thống tự động giới hạn tối đa ${allowedAdult} người lớn (trong tổng số ${maxAllowed} chỗ khả dụng còn lại).`);
    } else {
      setAdultCount(Math.max(1, val));
    }
  };

  const handleChildCountChange = (val: number) => {
    if (!selectedTourForBooking) return;
    const maxAllowed = Math.max(0, selectedTourForBooking.total_seats + (selectedTourForBooking.overbook_limit || 0) - selectedTourForBooking.sold_seats - selectedTourForBooking.hold_seats);
    const potentialTotal = adultCount + val;
    if (potentialTotal > maxAllowed) {
      const allowedChild = Math.max(0, maxAllowed - adultCount);
      setChildCount(allowedChild);
      alert(`Số lượng khách vượt quá số chỗ trống và overbooking cho phép! Hệ thống tự động giới hạn tối đa ${allowedChild} trẻ em (trong tổng số ${maxAllowed} chỗ khả dụng còn lại).`);
    } else {
      setChildCount(Math.max(0, val));
    }
  };

  // Booking Timer countdown
  useEffect(() => {
    if (!selectedTourForBooking) return;
    setCountdown(300); // 5 minutes
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setSelectedTourForBooking(null);
          alert('Hết giờ! Phiếu giữ chỗ đã tự động đóng để nhường tài nguyên hệ thống.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedTourForBooking]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Pricing helper variables based on selectedTourForBooking
  const priceAdult = selectedTourForBooking ? (selectedTourForBooking.price_adult ?? selectedTourForBooking.price) : 0;
  const priceChild = selectedTourForBooking ? (selectedTourForBooking.price_child ?? Math.round(selectedTourForBooking.price * 0.8)) : 0;
  const priceInfant = selectedTourForBooking ? (selectedTourForBooking.price_infant ?? Math.round(selectedTourForBooking.price * 0.3)) : 0;
  const singleRoomSurcharge = selectedTourForBooking ? (selectedTourForBooking.single_room_surcharge ?? 7500000) : 0;

  const subtotalPrice = selectedTourForBooking 
    ? (priceAdult * adultCount) + (priceChild * childCount) + (priceInfant * infantCount) + (singleRoomSurcharge * singleRoomCount)
    : 0;

  const vatAmount = vatOption === 'Xuất VAT' ? Math.round(subtotalPrice * 0.1) : 0;

  const calculatedTotalPrice = subtotalPrice + vatAmount;

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTourForBooking) return;

    if (orderStatus === 'sure' && (!bookerName.trim() || !bookerPhone.trim())) {
      alert('Vui lòng điền đầy đủ Họ tên và Số điện thoại của khách trưởng nhóm khi Đặt chắc chắn!');
      return;
    }

    const orderPassengers: any[] = [];
    const finalBookerName = bookerName.trim() || (orderStatus === 'hold' ? 'Chưa cung cấp (Giữ chỗ tạm)' : '');
    const finalBookerPhone = bookerPhone.trim() || (orderStatus === 'hold' ? 'Chưa cung cấp' : '');
    
    // Booker passenger
    orderPassengers.push({
      is_payer: true,
      full_name: finalBookerName,
      phone: finalBookerPhone,
      visa_status: 'pending'
    });

    // Other adults
    for (let i = 1; i < adultCount; i++) {
      orderPassengers.push({
        is_payer: false,
        full_name: `Người lớn #${i + 1} (Đi cùng)`,
        visa_status: 'pending'
      });
    }

    // Children
    for (let i = 0; i < childCount; i++) {
      orderPassengers.push({
        is_payer: false,
        full_name: `Trẻ em #${i + 1} (Đi cùng)`,
        visa_status: 'not_required'
      });
    }

    // Infants
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
      tour_id: selectedTourForBooking.id,
      status: orderStatus,
      adult_price: priceAdult,
      total_price: calculatedTotalPrice,
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

    // Reset fields
    setBookerName('');
    setBookerPhone('');
    setAdultCount(1);
    setChildCount(0);
    setInfantCount(0);
    setSingleRoomCount(0);
    setRoomShareInfo('Không ghép');
    setSpecialRequests('');
    setVatOption('Không xuất VAT');
    setSelectedTourForBooking(null);
    alert('Đặt giữ chỗ tour thành công!');
  };

  // Filter application
  const filteredTours = tours.filter(tour => {
    // Separation: Only exclude visa services from the main departure calendar. Partner and Private tours are still tours.
    if (tour.tour_type === 'visa') {
      return false;
    }

    // 0. Only show internal tours for external roles
    const isInternalUser = ['admin', 'operator', 'sale', 'accounting', 'visa'].includes(currentRole);
    if (!isInternalUser && tour.tour_type && tour.tour_type !== 'internal') return false;

    // 1. Search term match code or name
    const matchesSearch = tour.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          tour.code.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // 2. Category match
    if (selectedCategory !== 'all' && tour.category !== selectedCategory) return false;

    // 3. Tour Status match
    if (selectedTourStatus !== 'all' && tour.tour_status !== selectedTourStatus) return false;

    // 4. Time Range match
    if (selectedTimeRange !== 'all') {
      const departureDate = new Date(tour.departure_time);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tourDate = new Date(departureDate);
      tourDate.setHours(0, 0, 0, 0);

      if (selectedTimeRange === 'today') {
        if (tourDate.getTime() !== today.getTime()) return false;
      } else if (selectedTimeRange === 'this_week') {
        const firstDayOfWeek = new Date(today);
        firstDayOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
        const lastDayOfWeek = new Date(firstDayOfWeek);
        lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6); // Sunday
        
        if (tourDate < firstDayOfWeek || tourDate > lastDayOfWeek) return false;
      } else if (selectedTimeRange === 'this_month') {
        if (tourDate.getMonth() !== today.getMonth() || tourDate.getFullYear() !== today.getFullYear()) return false;
      } else if (selectedTimeRange === 'next_month') {
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        if (tourDate.getMonth() !== nextMonth.getMonth() || tourDate.getFullYear() !== nextMonth.getFullYear()) return false;
      } else if (selectedTimeRange === 'next_3_months') {
        const next3Months = new Date(today.getFullYear(), today.getMonth() + 3, 0);
        if (tourDate < today || tourDate > next3Months) return false;
      }
    }

    // 5. Specific Date match (Calendar picker)
    if (selectedDate) {
      try {
        const depDateStr = tour.departure_time ? format(new Date(tour.departure_time), 'yyyy-MM-dd') : '';
        const startDateStr = tour.start_date ? format(new Date(tour.start_date), 'yyyy-MM-dd') : '';
        if (depDateStr !== selectedDate && startDateStr !== selectedDate) return false;
      } catch (e) {
        // Fallback or ignore parse errors
      }
    }

    return true;
  });

  const sortedFilteredTours = [...filteredTours].sort((a, b) => {
    switch (sortBy) {
      case 'date_asc':
        return new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime();
      case 'date_desc':
        return new Date(b.departure_time).getTime() - new Date(a.departure_time).getTime();
      case 'price_asc':
        return (a.price_adult || a.price) - (b.price_adult || b.price);
      case 'price_desc':
        return (b.price_adult || b.price) - (a.price_adult || a.price);
      default:
        return 0;
    }
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Filters and Actions */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow"
              placeholder="Tìm kiếm theo mã tour, tên tour..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3 w-full lg:w-auto shrink-0 justify-end">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="inline-flex items-center px-4 py-2.5 border text-sm font-medium rounded-lg transition-colors bg-white text-gray-700 border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date_asc">Khởi hành gần nhất</option>
              <option value="date_desc">Khởi hành xa nhất</option>
              <option value="price_asc">Giá tăng dần</option>
              <option value="price_desc">Giá giảm dần</option>
            </select>
            <button 
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`inline-flex items-center px-4 py-2.5 border text-sm font-medium rounded-lg transition-colors ${
                showAdvancedFilters ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Bộ lọc nâng cao
            </button>
            {(currentRole === 'admin' || currentRole === 'operator') && (
              <button 
                onClick={() => navigate('/tours', { state: { openCreateModal: true } })}
                className="inline-flex items-center px-4 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-[#0038A8] hover:bg-[#002a80] transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-2" />
                Tạo Tour mới
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters section */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-150 animate-in fade-in duration-150">
            {/* Filter by Time */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Thời gian khởi hành</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                value={selectedTimeRange}
                onChange={e => setSelectedTimeRange(e.target.value)}
              >
                <option value="all">Tất cả thời gian</option>
                <option value="today">Hôm nay</option>
                <option value="this_week">Tuần này</option>
                <option value="this_month">Tháng này</option>
                <option value="next_month">Tháng sau</option>
                <option value="next_3_months">3 tháng tới</option>
              </select>
            </div>

            {/* Filter by Category */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Danh mục sản phẩm</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
              >
                <option value="all">Tất cả danh mục</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Filter by Tour Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Tình trạng tour</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                value={selectedTourStatus}
                onChange={e => setSelectedTourStatus(e.target.value)}
              >
                <option value="all">Tất cả tình trạng</option>
                <option value="available">Còn chỗ</option>
                <option value="noshop">No-shop</option>
                <option value="last_minute">Giờ chót</option>
                <option value="holiday">Lễ Tết</option>
                <option value="on_sale">Đang giảm giá</option>
                <option value="full">Kín chỗ</option>
              </select>
            </div>

            {/* Filter by Calendar Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Chọn ngày khởi hành (Lịch)</label>
              <DatePicker
                value={selectedDate}
                onChange={val => setSelectedDate(val)}
              />
            </div>

            {/* Reset Filters */}
            <div className="md:col-span-4 flex justify-end">
              <button
                onClick={() => {
                  setSelectedTimeRange('all');
                  setSelectedCategory('all');
                  setSelectedTourStatus('all');
                  setSelectedDate('');
                  setSearchTerm('');
                }}
                className="text-xs font-semibold text-red-600 hover:text-red-800 flex items-center"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Xóa bộ lọc
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tour List */}
      <div className="space-y-4">
        {sortedFilteredTours.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center shadow-sm">
            <CalendarIcon className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">Không tìm thấy tour du lịch phù hợp.</p>
          </div>
        ) : (
          sortedFilteredTours.map((tour) => (
            <TourCard key={tour.id} tour={tour} onBookClick={setSelectedTourForBooking} onShowNotice={setNoticeTour} />
          ))
        )}
      </div>

      {/* Booking Modal Popup */}
      {selectedTourForBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 relative">
            
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-50 border-b border-gray-150 p-5 z-10 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2 text-blue-600" />
                  Phiếu thông tin giữ chỗ & Đặt tour
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Tour: <span className="font-bold text-blue-700">{selectedTourForBooking.code}</span> - {selectedTourForBooking.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${countdown < 60 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-green-100 text-green-700'}`}>
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  <span>Cửa sổ sẽ tự đóng sau {formatCountdown(countdown)} phút!</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setSelectedTourForBooking(null)}
                  className="p-1.5 hover:bg-gray-200 rounded-full text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateOrder} className="p-6 space-y-6">
              {/* Step 1: Choose Hold type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Hình thức giữ chỗ *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center border border-gray-300 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm transition-colors">
                    <input 
                      type="radio" 
                      name="modalStatus" 
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 mr-3"
                      checked={orderStatus === 'hold'}
                      onChange={() => setOrderStatus('hold')}
                    />
                    <div>
                      <div className="font-bold text-gray-900">Hold tạm thời</div>
                      <div className="text-[11px] text-gray-500">
                        Hệ thống tự động nhả chỗ sau {selectedTourForBooking.hold_duration_hours || 48} giờ
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center border border-gray-300 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm transition-colors">
                    <input 
                      type="radio" 
                      name="modalStatus" 
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 mr-3"
                      checked={orderStatus === 'sure'}
                      onChange={() => setOrderStatus('sure')}
                    />
                    <div>
                      <div className="font-bold text-gray-900">Sure chỗ (Đặt chắc chắn)</div>
                      <div className="text-[11px] text-gray-500">Yêu cầu kế toán xuất hóa đơn chính thức</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Display Tour Price List */}
              <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700">Bảng giá áp dụng</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-500 block">Người lớn:</span>
                    <span className="font-bold text-gray-950">{formatCurrency(priceAdult)} đ</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-500 block">Trẻ em (2 - &lt;10):</span>
                    <span className="font-bold text-gray-950">{formatCurrency(priceChild)} đ</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-500 block">Trẻ nhỏ (&lt;2):</span>
                    <span className="font-bold text-gray-950">{formatCurrency(priceInfant)} đ</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-500 block">Phụ thu phòng đơn:</span>
                    <span className="font-bold text-red-600">{formatCurrency(singleRoomSurcharge)} đ</span>
                  </div>
                </div>
              </div>

              {/* Section 1: Booker info */}
              <div className="border-t border-gray-150 pt-4 space-y-3">
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
                              setBookerName(c.full_name.toUpperCase());
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={`relative ${focusedInput === 'name' ? 'z-30' : 'z-20'}`}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Họ và tên khách trưởng nhóm *
                      </label>
                      <input 
                        type="text"
                        required
                        placeholder="Nhập họ và tên trưởng nhóm đại diện"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white uppercase font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Số điện thoại liên hệ *
                      </label>
                      <input 
                        type="text"
                        required
                        placeholder="Nhập số điện thoại trưởng nhóm"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              <div className="border-t border-gray-150 pt-4 space-y-3">
                <h4 className="text-sm font-bold text-gray-900 flex items-center">
                  <span className="w-1.5 h-3.5 bg-blue-600 rounded mr-2 inline-block"></span>
                  2. Số lượng khách (Tính giá tạm tính)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-gray-200 space-y-1">
                    <label className="block text-xs font-bold text-gray-700">Người lớn (≥ 10 tuổi) *</label>
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
                    <label className="block text-xs font-bold text-gray-700">Trẻ em (2 - &lt; 10 tuổi)</label>
                    <input 
                      type="number"
                      min="0"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm bg-white font-bold"
                      value={childCount}
                      onChange={e => handleChildCountChange(Number(e.target.value))}
                    />
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-gray-200 space-y-1">
                    <label className="block text-xs font-bold text-gray-700">Trẻ nhỏ (&lt; 2 tuổi)</label>
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
                    <div className="flex gap-4 pt-1">
                      <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                        <input 
                          type="radio" 
                          name="modalVatOption" 
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
                          name="modalVatOption" 
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

              {/* Pricing calculation summary */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-150 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="text-xs space-y-1 text-gray-700 w-full sm:w-auto">
                  <div className="font-semibold text-blue-800 text-sm">Tổng hợp chi tiết tạm tính:</div>
                  <div className="space-y-1">
                    <div className="flex justify-between gap-8">
                      <span>• Người lớn ({adultCount} khách x {formatCurrency(priceAdult)} đ):</span>
                      <span className="font-semibold">{formatCurrency(priceAdult * adultCount)} đ</span>
                    </div>
                    {childCount > 0 && (
                      <div className="flex justify-between gap-8">
                        <span>• Trẻ em ({childCount} khách x {formatCurrency(priceChild)} đ):</span>
                        <span className="font-semibold">{formatCurrency(priceChild * childCount)} đ</span>
                      </div>
                    )}
                    {infantCount > 0 && (
                      <div className="flex justify-between gap-8">
                        <span>• Trẻ nhỏ ({infantCount} khách x {formatCurrency(priceInfant)} đ):</span>
                        <span className="font-semibold">{formatCurrency(priceInfant * infantCount)} đ</span>
                      </div>
                    )}
                    {singleRoomCount > 0 && (
                      <div className="flex justify-between gap-8">
                        <span>• Phụ thu phòng đơn ({singleRoomCount} phòng x {formatCurrency(singleRoomSurcharge)} đ):</span>
                        <span className="font-semibold text-red-600">{formatCurrency(singleRoomSurcharge * singleRoomCount)} đ</span>
                      </div>
                    )}
                    {vatOption === 'Xuất VAT' && (
                      <div className="flex justify-between gap-8 border-t border-blue-200/60 pt-1 text-emerald-700 font-medium">
                        <span>• Thuế VAT (10%):</span>
                        <span className="font-bold">+{formatCurrency(vatAmount)} đ</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right sm:border-l sm:border-gray-200 sm:pl-6 shrink-0 w-full sm:w-auto">
                  <div className="text-xs text-gray-500 font-medium">Tổng giá trị giữ chỗ tạm tính</div>
                  <div className="text-2xl font-black text-red-600">
                    {formatCurrency(calculatedTotalPrice)} VND
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">Đã bao gồm thuế phí áp dụng</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => {
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
                  onClick={() => setSelectedTourForBooking(null)}
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
          </div>
        </div>
      )}

      {/* Travel disclaimers modal */}
      {noticeTour && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200 relative">
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-50 border-b border-gray-200 p-5 z-10 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center uppercase tracking-wider">
                  <FileText className="w-5 h-5 mr-2 text-orange-600" />
                  Bảng thông tin & Quy định lưu ý đi Tour
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Mã tour: <span className="font-bold text-blue-700">{noticeTour.code}</span> — Tên hành trình: <span className="font-semibold text-gray-800">{noticeTour.name}</span>
                </p>
              </div>
              <button
                onClick={() => setNoticeTour(null)}
                className="p-1.5 hover:bg-gray-200 rounded-full transition-colors text-gray-500 hover:text-gray-800"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body: Styled Travel guidelines table */}
            <div className="p-6 space-y-8">
              {(() => {
                const sections = (() => {
                  if (!noticeTour.notice_sections) {
                    return [
                      {
                        title: "1. Hành lý và chỗ ngồi trên máy bay:",
                        items: [
                          { key: "Hành lý ký gửi", value: "Theo quy định chung của các hãng hàng không đối với hành trình quốc tế, mỗi hành khách được miễn cước phí vận chuyển tối đa 1 kiện 23kg." },
                          { key: "Hành lý xách tay", value: "KHÔNG NẶNG QUÁ 10KG, kích thước không cồng kềnh. Không mang các vật nhọn, chất lỏng quá 100ml trong hành lý xách tay." },
                          { key: "Chỗ ngồi trên máy bay", value: "- Đây là vé đoàn hạng phổ thông nên chỗ ngồi tùy thuộc theo tình hình thực tế chuyến bay.\n- Nếu khách có yêu cầu chỗ ngồi tốt hơn thì phải đóng thêm phí (tùy hãng hàng không)." }
                        ]
                      },
                      {
                        title: "2. Xuất/nhập cảnh Việt Nam:",
                        items: [
                          { key: "Thủ tục cần thiết", value: "Khi nhập cảnh, Quý khách vui lòng tập trung theo nhóm. Nhân viên hải quan sẽ hỏi nhanh một số câu hỏi liên quan đến lịch trình." },
                          { key: "Số tiền mang theo", value: "Theo quy định về quản lý ngoại hối, khi xuất cảnh mỗi người được mang theo dưới 5.000 USD tiền mặt và dưới 15.000.000 VNĐ." }
                        ]
                      }
                    ];
                  }
                  try {
                    return JSON.parse(noticeTour.notice_sections);
                  } catch (e) {
                    return [];
                  }
                })();

                return sections.map((sec: any, secIdx: number) => (
                  <div key={secIdx} className="space-y-3">
                    {/* Section Title */}
                    <div className="bg-red-800 text-white font-extrabold px-4 py-2.5 rounded-t-lg shadow-sm text-xs tracking-wide uppercase">
                      {sec.title}
                    </div>
                    
                    {/* Table Grid structure */}
                    <div className="border border-gray-250 rounded-b-lg overflow-hidden divide-y divide-gray-250">
                      {sec.items && sec.items.map((row: any, rowIdx: number) => (
                        <div key={rowIdx} className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-250 hover:bg-slate-50/50 transition-colors">
                          {/* Left column / key Label */}
                          <div className="md:w-[220px] shrink-0 bg-emerald-50/50 text-emerald-900 font-extrabold p-3 text-xs leading-relaxed flex items-center">
                            {row.key}
                          </div>
                          {/* Right column / value Description */}
                          <div className="flex-1 p-4 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {row.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-gray-200 p-4 flex justify-end">
              <button
                onClick={() => setNoticeTour(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-md transition-all"
              >
                Đóng thông tin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
