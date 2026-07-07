import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCRM } from '@/context/CRMContext';
import { Tour, TourStatus } from '@/types';
import { 
  Plus, 
  User, 
  Phone, 
  Check, 
  X, 
  Clock, 
  HelpCircle, 
  Edit3, 
  Trash2, 
  Copy, 
  FileText, 
  FolderOpen, 
  ExternalLink, 
  Tag, 
  Grid,
  MapPin,
  Plane,
  Building,
  DollarSign,
  ChevronDown,
  ChevronUp,
  UploadCloud
} from 'lucide-react';
import { format } from 'date-fns';

// Formatted numeric input component with thousands separators on input
const NumericFormatInput: React.FC<{
  label: string;
  value: number | '';
  onChange: (val: number | '') => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}> = ({ label, value, onChange, required = false, placeholder = '', className = '' }) => {
  const [displayValue, setDisplayValue] = useState(() => {
    if (value === '' || value === undefined || value === null) return '';
    return new Intl.NumberFormat('vi-VN').format(value);
  });

  useEffect(() => {
    if (value === '' || value === undefined || value === null) {
      setDisplayValue('');
    } else {
      const parsedDisplay = displayValue.replace(/\./g, '');
      if (Number(parsedDisplay) !== value) {
        setDisplayValue(new Intl.NumberFormat('vi-VN').format(value));
      }
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, ''); // digits only
    if (rawValue === '') {
      setDisplayValue('');
      onChange('');
    } else {
      const numValue = Number(rawValue);
      setDisplayValue(new Intl.NumberFormat('vi-VN').format(numValue));
      onChange(numValue);
    }
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        value={displayValue}
        onChange={handleChange}
      />
    </div>
  );
};

// Helper to format tour code based on base code and departure date (DDMMYY)
const getFormattedCode = (currentCode: string, departureDateIso: string) => {
  if (!departureDateIso) return currentCode;
  const date = new Date(departureDateIso);
  if (isNaN(date.getTime())) return currentCode;

  // Clean any trailing -CLONE
  let cleanCode = currentCode.replace(/-CLONE/gi, '');
  
  // Strip trailing 6-digit date suffix (e.g., -150726 or 150726)
  const hasHyphenSuffix = /-\d{6}$/.test(cleanCode);
  const hasPlainSuffix = /\d{6}$/.test(cleanCode) && !/-\d{6}$/.test(cleanCode);
  
  let basePart = cleanCode;
  let separator = '';
  
  if (hasHyphenSuffix) {
    basePart = cleanCode.replace(/-\d{6}$/, '');
    separator = '-';
  } else if (hasPlainSuffix) {
    basePart = cleanCode.replace(/\d{6}$/, '');
    separator = '';
  } else {
    separator = cleanCode.includes('-') ? '-' : '';
  }
  
  const yy = date.getFullYear().toString().slice(-2);
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  
  return `${basePart}${separator}${dd}${mm}${yy}`;
};

// Custom fully Vietnamese Date and Time Picker component
interface VietnameseDateTimePickerProps {
  label: string;
  value: string; // ISO String or empty
  onChange: (isoString: string) => void;
  required?: boolean;
  showTime?: boolean;
  placeholder?: string;
  align?: 'left' | 'right' | 'auto';
}

const VietnameseDateTimePicker: React.FC<VietnameseDateTimePickerProps> = ({
  label,
  value,
  onChange,
  required = false,
  showTime = false,
  placeholder = '',
  align = 'left'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => {
    return value ? new Date(value) : new Date();
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    return value ? new Date(value) : null;
  });

  const [hours, setHours] = useState(() => {
    return value ? new Date(value).getHours() : 8;
  });
  const [minutes, setMinutes] = useState(() => {
    return value ? new Date(value).getMinutes() : 0;
  });

  // Keep internal states in sync with external value
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      setSelectedDate(d);
      setCurrentDate(d);
      setHours(d.getHours());
      setMinutes(d.getMinutes());
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday, 1 is Monday...

  // Map Sunday (0) to index 6, and Monday (1) to Saturday (6) as 0 to 5.
  const adjustedFirstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const days: Array<Date | null> = [];
  for (let i = 0; i < adjustedFirstDayIndex; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month, d));
  }

  const handleSelectDay = (day: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    const newD = new Date(day);
    if (showTime) {
      newD.setHours(hours, minutes, 0, 0);
    } else {
      newD.setHours(0, 0, 0, 0);
    }
    setSelectedDate(newD);
    onChange(newD.toISOString());
    if (!showTime) {
      setIsOpen(false);
    }
  };

  const handleTimeChange = (h: number, m: number) => {
    setHours(h);
    setMinutes(m);
    if (selectedDate) {
      const newD = new Date(selectedDate);
      newD.setHours(h, m, 0, 0);
      setSelectedDate(newD);
      onChange(newD.toISOString());
    }
  };

  const formattedValue = selectedDate
    ? format(selectedDate, showTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy')
    : '';

  const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const monthLabels = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
    'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
    'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  return (
    <div className="relative">
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white cursor-pointer flex items-center justify-between hover:border-blue-500 transition-colors shadow-xs"
      >
        <span className={formattedValue ? 'text-slate-800 font-bold' : 'text-slate-400 font-semibold'}>
          {formattedValue || placeholder || (showTime ? 'Chọn ngày giờ (dd/MM/yyyy HH:mm)' : 'Chọn ngày (dd/MM/yyyy)')}
        </span>
        <Clock className="w-4 h-4 text-slate-400" />
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div 
            onClick={e => e.stopPropagation()}
            className={`absolute ${align === 'right' ? 'right-0' : align === 'auto' ? 'left-0 md:left-auto md:right-0' : 'left-0'} mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-50 w-72 animate-in fade-in slide-in-from-top-1 duration-150`}
          >
            <div className="flex items-center justify-between mb-3">
              <button 
                type="button" 
                onClick={handlePrevMonth}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors font-bold text-sm w-7 h-7 flex items-center justify-center"
              >
                &lt;
              </button>
              <div className="font-bold text-xs text-slate-800">
                {monthLabels[month]} {year}
              </div>
              <button 
                type="button" 
                onClick={handleNextMonth}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors font-bold text-sm w-7 h-7 flex items-center justify-center"
              >
                &gt;
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {dayLabels.map(l => (
                <span key={l} className="text-[10px] font-bold text-slate-400 uppercase">{l}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 mb-3">
              {days.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} />;
                const isSelected = selectedDate && 
                  day.getDate() === selectedDate.getDate() &&
                  day.getMonth() === selectedDate.getMonth() &&
                  day.getFullYear() === selectedDate.getFullYear();
                
                const isToday = new Date().getDate() === day.getDate() &&
                  new Date().getMonth() === day.getMonth() &&
                  new Date().getFullYear() === day.getFullYear();

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => handleSelectDay(day, e)}
                    className={`py-1 text-xs rounded-md font-semibold transition-all ${
                      isSelected 
                        ? 'bg-blue-600 text-white font-bold' 
                        : isToday
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            {showTime && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold text-slate-500">Giờ khởi hành:</span>
                <div className="flex items-center gap-1">
                  <select
                    value={hours}
                    onChange={e => handleTimeChange(Number(e.target.value), minutes)}
                    className="border border-slate-200 rounded p-1 text-xs bg-slate-50 font-bold"
                  >
                    {Array.from({ length: 24 }).map((_, h) => (
                      <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                  <span className="text-slate-400 font-bold">:</span>
                  <select
                    value={minutes}
                    onChange={e => handleTimeChange(hours, Number(e.target.value))}
                    className="border border-slate-200 rounded p-1 text-xs bg-slate-50 font-bold"
                  >
                    {Array.from({ length: 60 }).map((_, m) => (
                      <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                className="bg-blue-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors w-full text-center"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Default Travel disclaimers structure (identical to user screenshot)
const DEFAULT_NOTICE_SECTIONS = [
  {
    title: "1. Hành lý và chỗ ngồi trên máy bay:",
    items: [
      { key: "Hành lý ký gửi", value: "Hành lý ký gửi: Theo quy định chung của các hãng hàng không đối với hành trình quốc tế, mỗi hành khách được miễn cước phí vận chuyển 02 kiện hành lý 23 kg # 50 Pound cho chặng quốc tế & nội địa của Mỹ (nếu Quý khách mua thêm kiện hành lý thứ 3 phải trả thêm tiền)." },
      { key: "Hành lý xách tay", value: "Hành lý xách tay: KHÔNG NẶNG QUÁ 10KG, kích thước không cồng kềnh, Quý khách TUYỆT ĐỐI KHÔNG để trong xách tay những vật nhọn bằng kim loại như kéo, kềm, dao nhỏ.. & các loại chất lỏng như: dầu tắm, mỹ phẩm, nước hoa, nước uống & sữa... Các loại chất lỏng chỉ cho phép dung tích tối đa dưới 100ml, nếu hơn 100ml phải để trong hành lý ký gửi." },
      { key: "Chỗ ngồi trên máy bay", value: "- Đây là vé đoàn hạng phổ thông nên chỗ ngồi tùy theo tình hình thực tế chuyến bay.\n- Nếu khách có yêu cầu chỗ ngồi tốt hơn thì phải đóng thêm phí (tùy hãng hàng không)." }
    ]
  },
  {
    title: "2. Xuất/nhập cảnh Việt Nam:",
    items: [
      { key: "Thủ tục cần thiết", value: "Khi nhập cảnh Mỹ ngay tại cửa khẩu, Quý khách vui lòng tập trung theo nhóm. Nhân viên Hải quan cửa khẩu Mỹ là người có quyền quyết định cho Quý khách nhập cảnh vào Mỹ hay không dù đã có visa & thời gian lưu trú bao lâu tại Mỹ cũng tùy thuộc vào cách trả lời các câu hỏi của Quý khách." },
      { key: "Số tiền mang theo", value: "Theo quy định về quản lý ngoại hối, khi xuất cảnh mỗi người (kể cả trẻ em đi kèm) được mang theo 5.000USD tiền mặt. Tiền đồng Việt Nam được mang dưới 15.000.000đ. Các loại thẻ thanh toán quốc tế như: Visa hoặc Mastercard được sử dụng rộng rãi tại Mỹ." }
    ]
  },
  {
    title: "3. Nhập cảnh nước sở tại:",
    items: [
      { key: "Quy định thực phẩm", value: "CÁC LOẠI THỰC PHẨM TƯƠI SỐNG HOẶC ĐÓNG HỘP TỪ THỊT ĐỘNG VẬT, CÁC CHẾ PHẨM TỪ TRỨNG, SỮA & LOẠI HOA QUẢ TƯƠI CÁC LOẠI..., KHÔNG ĐƯỢC NHẬP CẢNH VÀO MỸ, Quý khách có thể mang theo các loại thực phẩm khô như mì gói. Nếu có mang theo hàng hóa vui lòng khai báo cụ thể theo mẫu đơn của Hải Quan. Trưởng đoàn sẽ tư vấn kỹ cho Quý khách trước khi làm thủ tục nhập cảnh Hoa Kỳ." }
    ]
  }
];

export default function VisaServices() {
  const location = useLocation();
  const { 
    tours, 
    orders, 
    addTour, 
    updateTour, 
    deleteTour, 
    handleExtensionRequest,
    categories,
    addCategory,
    deleteCategory,
    updateCategory
  } = useCRM();

  // Navigation tabs: 'tours' | 'categories'
  const [activeTab, setActiveTab] = useState<'tours' | 'categories'>('tours');

  // View mode for tour listing: 'grouped' (default) | 'flat'
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({});

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const isCurrentlyExpanded = prev[groupName];
      const newExpanded: { [key: string]: boolean } = {};
      if (!isCurrentlyExpanded) {
        newExpanded[groupName] = true;
      }
      return newExpanded;
    });
  };

  // Group tours by name for easier bulk management
  const groupedTours = React.useMemo<Record<string, Tour[]>>(() => {
    const groups: { [key: string]: Tour[] } = {};
    const displayTours = tours.filter(t => t.tour_type === 'visa');
    displayTours.forEach(tour => {
      const key = tour.name || 'Hành trình chưa đặt tên';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(tour);
    });
    // Sort departures within each group by created_at descending (newest first)
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
    });
    return groups;
  }, [tours]);

  // Handle auto-expanding new groups
  useEffect(() => {
    setExpandedGroups(prev => {
      const updated = { ...prev };
      Object.keys(groupedTours).forEach(groupName => {
        if (updated[groupName] === undefined) {
          updated[groupName] = true; // default to expanded
        }
      });
      return updated;
    });
  }, [groupedTours]);

  // Bulk creation states
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkBaseTour, setBulkBaseTour] = useState<Tour | null>(null);
  const [bulkCustomDate, setBulkCustomDate] = useState<string>('');
  const [bulkDatesList, setBulkDatesList] = useState<Array<{ date: Date; selected: boolean }>>([]);

  const handleOpenBulkModal = (tour: Tour) => {
    setBulkBaseTour(tour);
    setBulkCustomDate('');
    setBulkDatesList([]);
    setShowBulkModal(true);
  };

  const handleAddBulkDate = () => {
    if (!bulkCustomDate || !bulkBaseTour) {
      alert('Vui lòng chọn ngày khởi hành trước!');
      return;
    }
    const baseDep = new Date(bulkBaseTour.departure_time);
    const dateToAdd = new Date(bulkCustomDate);
    // Set hours and minutes to match base tour's departure time so they have the exact same time
    dateToAdd.setHours(baseDep.getHours(), baseDep.getMinutes(), 0, 0);

    const isDuplicate = bulkDatesList.some(item => item.date.getTime() === dateToAdd.getTime());
    if (isDuplicate) {
      alert('Ngày khởi hành này đã tồn tại trong danh sách!');
      return;
    }
    setBulkDatesList(prev => [...prev, { date: dateToAdd, selected: true }].sort((a, b) => a.date.getTime() - b.date.getTime()));
    setBulkCustomDate('');
  };

  const handleCreateBulkSeries = () => {
    if (!bulkBaseTour) return;
    const selectedDates = bulkDatesList.filter(d => d.selected);
    if (selectedDates.length === 0) {
      alert('Vui lòng chọn hoặc thêm ít nhất một ngày khởi hành hợp lệ!');
      return;
    }

    // Calculate duration difference in MS from base tour
    const baseDep = new Date(bulkBaseTour.departure_time);
    const baseRet = new Date(bulkBaseTour.return_time);
    const durationMs = baseRet.getTime() - baseDep.getTime();

    selectedDates.forEach(({ date }) => {
      // Use getFormattedCode to generate correct DDMMYY structure
      const generatedCode = getFormattedCode(bulkBaseTour.code, date.toISOString());

      // Calculate return date
      const generatedReturnTime = new Date(date.getTime() + durationMs);

      // Visa deadline (if base tour had one, shift it by same difference)
      let generatedVisaDeadline: string | undefined = undefined;
      if (bulkBaseTour.visa_deadline) {
        const baseVisa = new Date(bulkBaseTour.visa_deadline);
        const visaDiffMs = baseDep.getTime() - baseVisa.getTime();
        generatedVisaDeadline = new Date(date.getTime() - visaDiffMs).toISOString();
      }

      // Clone notice sections
      let noticeSecs = DEFAULT_NOTICE_SECTIONS;
      if (bulkBaseTour.notice_sections) {
        try {
          noticeSecs = JSON.parse(bulkBaseTour.notice_sections);
        } catch (e) {
          // fallback
        }
      }

      const newTourData = {
        code: generatedCode,
        name: bulkBaseTour.name,
        duration: bulkBaseTour.duration,
        departure_time: date.toISOString(),
        return_time: generatedReturnTime.toISOString(),
        airline: bulkBaseTour.airline || 'Vietnam Airlines',
        hotel: bulkBaseTour.hotel || 'Khách sạn 4*',
        price: bulkBaseTour.price,
        commission: bulkBaseTour.commission,
        total_seats: bulkBaseTour.total_seats,
        flight_out: bulkBaseTour.flight_out || undefined,
        flight_out_transit: bulkBaseTour.flight_out_transit || undefined,
        flight_in: bulkBaseTour.flight_in || undefined,
        flight_in_transit: bulkBaseTour.flight_in_transit || undefined,
        transit_info: bulkBaseTour.transit_info || undefined,
        guide_name: bulkBaseTour.guide_name || undefined,
        guide_phone: bulkBaseTour.guide_phone || undefined,
        ticket_status: bulkBaseTour.ticket_status || 'CHỜ XUẤT VÉ',
        visa_deadline: generatedVisaDeadline,
        description: bulkBaseTour.description || undefined,
        tour_status: 'available' as TourStatus,
        category: bulkBaseTour.category || categories[0],
        hold_duration_hours: bulkBaseTour.hold_duration_hours || 48,
        price_adult: bulkBaseTour.price_adult ?? bulkBaseTour.price,
        price_child: bulkBaseTour.price_child ?? Math.round(bulkBaseTour.price * 0.8),
        price_infant: bulkBaseTour.price_infant ?? Math.round(bulkBaseTour.price * 0.3),
        single_room_surcharge: bulkBaseTour.single_room_surcharge ?? 7500000,
        itinerary_pdf_url: bulkBaseTour.itinerary_pdf_url || undefined,
        notice_sections: JSON.stringify(noticeSecs),
      };

      addTour(newTourData);
    });

    alert(`Đã khởi tạo thành công chuỗi gồm ${selectedDates.length} ngày khởi hành cho Tour series này!`);
    setShowBulkModal(false);
  };

  // Form toggles
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTour, setEditingTour] = useState<Tour | null>(null);

  // Categories form states
  const [newCatName, setNewCatName] = useState('');
  const [editingCatOldName, setEditingCatOldName] = useState<string | null>(null);
  const [editingCatNewName, setEditingCatNewName] = useState('');

  // Tour Form State (for both create & edit)
  const [code, setCode] = useState('');
  const [isCodeDuplicate, setIsCodeDuplicate] = useState(false);

  useEffect(() => {
    if (!code) {
      setIsCodeDuplicate(false);
      return;
    }
    
    // Check if code exists in tours
    const isDuplicate = tours.some(t => 
      t.code.toLowerCase() === code.toLowerCase() && 
      (!editingTour || t.id !== editingTour.id)
    );
    
    setIsCodeDuplicate(isDuplicate);
  }, [code, tours, editingTour]);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('5 ngày 4 đêm');
  const [departureTime, setDepartureTime] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [airline, setAirline] = useState('Vietnam Airlines');
  const [hotel, setHotel] = useState('Khách sạn 4*');
  const [price, setPrice] = useState<number | ''>(8500000);
  const [priceVisaTour, setPriceVisaTour] = useState<number | ''>('');
  const [commission, setCommission] = useState<number | ''>(600000);
  const [priceAdult, setPriceAdult] = useState<number | ''>('');
  const [priceChild, setPriceChild] = useState<number | ''>('');
  const [priceInfant, setPriceInfant] = useState<number | ''>('');
  const [singleRoomSurcharge, setSingleRoomSurcharge] = useState<number | ''>(7500000);
  const [totalSeats, setTotalSeats] = useState(30);
  const [overbookLimit, setOverbookLimit] = useState(0);
  const [holdDuration, setHoldDuration] = useState(48);
  const [flightOut, setFlightOut] = useState('');
  const [flightOutTransit, setFlightOutTransit] = useState('');
  const [flightIn, setFlightIn] = useState('');
  const [flightInTransit, setFlightInTransit] = useState('');
  const [transitInfo, setTransitInfo] = useState('');
  const [guideName, setGuideName] = useState('');
  const [guidePhone, setGuidePhone] = useState('');
  const [ticketStatus, setTicketStatus] = useState('CHỜ XUẤT VÉ');
  const [visaDeadline, setVisaDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [tourStatus, setTourStatus] = useState<TourStatus>('available');
  const [category, setCategory] = useState('');
  const [itineraryPdfUrl, setItineraryPdfUrl] = useState('');
  const [isUploadingItinerary, setIsUploadingItinerary] = useState(false);
  const [itineraryUploadError, setItineraryUploadError] = useState<string | null>(null);

  const handleItineraryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!code.trim()) {
      alert('Vui lòng nhập Mã Tour trước khi tải file lịch trình lên để hệ thống đặt tên file chính xác!');
      e.target.value = '';
      return;
    }

    setIsUploadingItinerary(true);
    setItineraryUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadType', 'tour');
      formData.append('tourCode', code.trim());
      formData.append('category', category || 'Chung');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Không thể tải file lên hệ thống');
      }

      const data = await res.json();
      if (data.success && data.url) {
        setItineraryPdfUrl(data.url);
      } else {
        throw new Error(data.error || 'Lỗi từ máy chủ khi lưu file');
      }
    } catch (err: any) {
      console.error(err);
      setItineraryUploadError(err.message || 'Lỗi tải file lên');
    } finally {
      setIsUploadingItinerary(false);
      e.target.value = '';
    }
  };

  // Tour Type fields
  const [tourType, setTourType] = useState<'internal' | 'partner' | 'private' | 'visa'>('internal');
  const [partnerName, setPartnerName] = useState('');
  const [partnerContact, setPartnerContact] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [groupLeaderContact, setGroupLeaderContact] = useState('');
  const [customRequirements, setCustomRequirements] = useState('');
  const [visaCountry, setVisaCountry] = useState('');
  const [visaServiceType, setVisaServiceType] = useState('');
  const [visaSpeed, setVisaSpeed] = useState<'standard' | 'urgent'>('standard');

  // Inline category creation state
  const [showInlineCatForm, setShowInlineCatForm] = useState(false);
  const [inlineCatName, setInlineCatName] = useState('');

  const handleAddInlineCategory = async () => {
    const trimmed = inlineCatName.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      alert('Danh mục này đã tồn tại!');
      return;
    }
    await addCategory(trimmed);
    setCategory(trimmed);
    setInlineCatName('');
    setShowInlineCatForm(false);
  };

  // Travel Notes/Disclaimer Builder state
  const [noticeSections, setNoticeSections] = useState<Array<{ title: string; items: Array<{ key: string; value: string }> }>>(DEFAULT_NOTICE_SECTIONS);

  // Set default category when categories are loaded
  useEffect(() => {
    if (categories && categories.length > 0 && !category) {
      setCategory(categories[0]);
    }
  }, [categories, category]);

  // Auto-format tour code based on selected departure time when creating a new tour or adding departure quick
  useEffect(() => {
    if (!editingTour && departureTime && code) {
      const formatted = getFormattedCode(code, departureTime);
      if (formatted !== code) {
        setCode(formatted);
      }
    }
  }, [departureTime, code, editingTour]);

  // Handle Extension requests list
  const extensionRequests = orders.filter(o => o.extension_status === 'requested');

  // Trigger editing mode and populate states
  const startEdit = (tour: Tour) => {
    setEditingTour(tour);
    setCode(tour.code);
    setName(tour.name);
    setDuration(tour.duration);
    
    // Format dates to YYYY-MM-DDTHH:MM for inputs
    if (tour.departure_time) {
      const depDate = new Date(tour.departure_time);
      const tzOffset = depDate.getTimezoneOffset() * 60000;
      const localDep = new Date(depDate.getTime() - tzOffset);
      setDepartureTime(localDep.toISOString().slice(0, 16));
    } else {
      setDepartureTime('');
    }

    if (tour.return_time) {
      const retDate = new Date(tour.return_time);
      const tzOffset = retDate.getTimezoneOffset() * 60000;
      const localRet = new Date(retDate.getTime() - tzOffset);
      setReturnTime(localRet.toISOString().slice(0, 16));
    } else {
      setReturnTime('');
    }

    setAirline(tour.airline || 'Vietnam Airlines');
    setHotel(tour.hotel || 'Khách sạn 4*');
    setPrice(tour.price);
    setCommission(tour.commission);
    setPriceAdult(tour.price_adult ?? '');
    setPriceChild(tour.price_child ?? '');
    setPriceInfant(tour.price_infant ?? '');
    setSingleRoomSurcharge(tour.single_room_surcharge ?? '');
    setTotalSeats(tour.total_seats);
    setOverbookLimit(tour.overbook_limit || 0);
    setHoldDuration(tour.hold_duration_hours || 48);
    setFlightOut(tour.flight_out || '');
    setFlightOutTransit(tour.flight_out_transit || '');
    setFlightIn(tour.flight_in || '');
    setFlightInTransit(tour.flight_in_transit || '');
    setTransitInfo(tour.transit_info || '');
    setGuideName(tour.guide_name || '');
    setGuidePhone(tour.guide_phone || '');
    setTicketStatus(tour.ticket_status || 'CHỜ XUẤT VÉ');
    
    if (tour.visa_deadline) {
      setVisaDeadline(tour.visa_deadline.split('T')[0]);
    } else {
      setVisaDeadline('');
    }
    
    setDescription(tour.description || '');
    setTourStatus(tour.tour_status || 'available');
    setCategory(tour.category || (categories && categories[0]) || '');
    setItineraryPdfUrl(tour.itinerary_pdf_url || '');

    setTourType(tour.tour_type || 'internal');
    setPartnerName(tour.partner_name || '');
    setPartnerContact(tour.partner_contact || '');
    setOrganizationName(tour.organization_name || '');
    setGroupLeaderContact(tour.group_leader_contact || '');
    setCustomRequirements(tour.custom_requirements || '');
    setVisaCountry(tour.visa_country || '');
    setVisaServiceType(tour.visa_service_type || '');
    setVisaSpeed(tour.visa_speed || 'standard');

    // Parse disclaimers
    if (tour.notice_sections) {
      try {
        setNoticeSections(JSON.parse(tour.notice_sections));
      } catch (e) {
        setNoticeSections(DEFAULT_NOTICE_SECTIONS);
      }
    } else {
      setNoticeSections(DEFAULT_NOTICE_SECTIONS);
    }

    setShowAddForm(false);
    // Scroll smoothly to form
    setTimeout(() => {
      document.getElementById('tour-form-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Trigger duplicate/clone and populate form
  const handleCloneTour = (tour: Tour) => {
    setCode(`${tour.code}-CLONE`);
    setName(`[Sao chép] ${tour.name}`);
    setDuration(tour.duration);
    setDepartureTime('');
    setReturnTime('');
    setAirline(tour.airline || 'Vietnam Airlines');
    setHotel(tour.hotel || 'Khách sạn 4*');
    setPrice(tour.price);
    setCommission(tour.commission);
    setPriceAdult(tour.price_adult ?? '');
    setPriceChild(tour.price_child ?? '');
    setPriceInfant(tour.price_infant ?? '');
    setSingleRoomSurcharge(tour.single_room_surcharge ?? '');
    setTotalSeats(tour.total_seats);
    setOverbookLimit(tour.overbook_limit || 0);
    setHoldDuration(tour.hold_duration_hours || 48);
    setFlightOut(tour.flight_out || '');
    setFlightOutTransit(tour.flight_out_transit || '');
    setFlightIn(tour.flight_in || '');
    setFlightInTransit(tour.flight_in_transit || '');
    setTransitInfo(tour.transit_info || '');
    setGuideName(tour.guide_name || '');
    setGuidePhone(tour.guide_phone || '');
    setTicketStatus(tour.ticket_status || 'CHỜ XUẤT VÉ');
    setVisaDeadline('');
    setDescription(tour.description || '');
    setTourStatus('available');
    setCategory(tour.category || (categories && categories[0]) || '');
    setItineraryPdfUrl(tour.itinerary_pdf_url || '');

    setTourType(tour.tour_type || 'internal');
    setPartnerName(tour.partner_name || '');
    setPartnerContact(tour.partner_contact || '');
    setOrganizationName(tour.organization_name || '');
    setGroupLeaderContact(tour.group_leader_contact || '');
    setCustomRequirements(tour.custom_requirements || '');
    setVisaCountry(tour.visa_country || '');
    setVisaServiceType(tour.visa_service_type || '');
    setVisaSpeed(tour.visa_speed || 'standard');

    if (tour.notice_sections) {
      try {
        setNoticeSections(JSON.parse(tour.notice_sections));
      } catch (e) {
        setNoticeSections(DEFAULT_NOTICE_SECTIONS);
      }
    } else {
      setNoticeSections(DEFAULT_NOTICE_SECTIONS);
    }

    setEditingTour(null);
    setShowAddForm(true);
    
    setTimeout(() => {
      document.getElementById('tour-form-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Pre-fill form to quickly add a new departure under the same Tour series
  const handleAddDepartureQuick = (tour: Tour) => {
    // Try to strip any date suffix or clone suffix from the code
    const baseCode = tour.code.replace(/-CLONE/g, '').replace(/-\d{6}$/g, '');
    setCode(baseCode);
    setName(tour.name);
    setDuration(tour.duration);
    setDepartureTime('');
    setReturnTime('');
    setAirline(tour.airline || 'Vietnam Airlines');
    setHotel(tour.hotel || 'Khách sạn 4*');
    setPrice(tour.price);
    setCommission(tour.commission);
    setPriceAdult(tour.price_adult ?? '');
    setPriceChild(tour.price_child ?? '');
    setPriceInfant(tour.price_infant ?? '');
    setSingleRoomSurcharge(tour.single_room_surcharge ?? '');
    setTotalSeats(tour.total_seats);
    setOverbookLimit(tour.overbook_limit || 0);
    setHoldDuration(tour.hold_duration_hours || 48);
    setFlightOut(tour.flight_out || '');
    setFlightOutTransit(tour.flight_out_transit || '');
    setFlightIn(tour.flight_in || '');
    setFlightInTransit(tour.flight_in_transit || '');
    setTransitInfo(tour.transit_info || '');
    setGuideName(tour.guide_name || '');
    setGuidePhone(tour.guide_phone || '');
    setTicketStatus(tour.ticket_status || 'CHỜ XUẤT VÉ');
    setVisaDeadline('');
    setDescription(tour.description || '');
    setTourStatus('available');
    setCategory(tour.category || (categories && categories[0]) || '');
    setItineraryPdfUrl(tour.itinerary_pdf_url || '');

    setTourType(tour.tour_type || 'internal');
    setPartnerName(tour.partner_name || '');
    setPartnerContact(tour.partner_contact || '');
    setOrganizationName(tour.organization_name || '');
    setGroupLeaderContact(tour.group_leader_contact || '');
    setCustomRequirements(tour.custom_requirements || '');
    setVisaCountry(tour.visa_country || '');
    setVisaServiceType(tour.visa_service_type || '');
    setVisaSpeed(tour.visa_speed || 'standard');

    if (tour.notice_sections) {
      try {
        setNoticeSections(JSON.parse(tour.notice_sections));
      } catch (e) {
        setNoticeSections(DEFAULT_NOTICE_SECTIONS);
      }
    } else {
      setNoticeSections(DEFAULT_NOTICE_SECTIONS);
    }

    setEditingTour(null);
    setShowAddForm(true);
    
    setTimeout(() => {
      document.getElementById('tour-form-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Reset/Clear Form State
  const resetForm = () => {
    setCode('');
    setName('');
    setDuration('5 ngày 4 đêm');
    setDepartureTime('');
    setReturnTime('');
    setAirline('Vietnam Airlines');
    setHotel('Khách sạn 4*');
    setPrice(8500000);
    setPriceVisaTour('');
    setCommission(600000);
    setPriceAdult('');
    setPriceChild('');
    setPriceInfant('');
    setSingleRoomSurcharge(7500000);
    setTotalSeats(30);
    setOverbookLimit(0);
    setHoldDuration(48);
    setFlightOut('');
    setFlightOutTransit('');
    setFlightIn('');
    setFlightInTransit('');
    setTransitInfo('');
    setGuideName('');
    setGuidePhone('');
    setTicketStatus('CHỜ XUẤT VÉ');
    setVisaDeadline('');
    setDescription('');
    setTourStatus('available');
    setCategory(categories[0] || 'Du lịch Đông Nam Á');
    setItineraryPdfUrl('');
    setNoticeSections(DEFAULT_NOTICE_SECTIONS);
    setTourType('internal');
    setPartnerName('');
    setPartnerContact('');
    setOrganizationName('');
    setGroupLeaderContact('');
    setCustomRequirements('');
    setVisaCountry('');
    setVisaServiceType('');
    setVisaSpeed('standard');
    setEditingTour(null);
    setShowAddForm(false);
    setShowInlineCatForm(false);
    setInlineCatName('');
  };

  // Trigger auto open create form when navigate from Departure Calendar
  useEffect(() => {
    if (location.state && (location.state as any).openCreateModal) {
      resetForm();
      setShowAddForm(true);
      // Clean history state so it won't open again on page refresh/re-mount
      try {
        window.history.replaceState({}, document.title);
      } catch (e) {
        // ignore
      }
      setTimeout(() => {
        document.getElementById('tour-form-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [location.state]);

  // Submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tourType !== 'visa' && (!code || !name || !departureTime || !returnTime)) {
      alert('Vui lòng nhập đầy đủ các trường thông tin bắt buộc (Mã tour, Tên tour, Ngày đi, Ngày về)!');
      return;
    }
    if (tourType === 'visa' && (!code || !name)) {
      alert('Vui lòng nhập Mã visa và Tên visa!');
      return;
    }

    const calculatedPrice = price === '' ? 0 : Number(price);
    const calculatedCommission = commission === '' ? 0 : Number(commission);

    const tourData = {
      code,
      name,
      duration,
      departure_time: (tourType !== 'visa' && departureTime) ? new Date(departureTime).toISOString() : null,
      return_time: (tourType !== 'visa' && returnTime) ? new Date(returnTime).toISOString() : null,
      airline,
      hotel,
      price: calculatedPrice,
      price_visa_tour: priceVisaTour === '' ? 0 : Number(priceVisaTour),
      commission: calculatedCommission,
      total_seats: Number(totalSeats),
      overbook_limit: Number(overbookLimit),
      flight_out: flightOut || undefined,
      flight_out_transit: flightOutTransit || undefined,
      flight_in: flightIn || undefined,
      flight_in_transit: flightInTransit || undefined,
      transit_info: transitInfo || undefined,
      guide_name: guideName || undefined,
      guide_phone: guidePhone || undefined,
      ticket_status: ticketStatus || undefined,
      visa_deadline: visaDeadline ? new Date(visaDeadline).toISOString() : undefined,
      description: description || undefined,
      tour_status: tourStatus,
      category: category || categories[0],
      hold_duration_hours: Number(holdDuration),
      price_adult: priceAdult !== '' ? Number(priceAdult) : calculatedPrice,
      price_child: priceChild !== '' ? Number(priceChild) : Math.round(calculatedPrice * 0.8),
      price_infant: priceInfant !== '' ? Number(priceInfant) : Math.round(calculatedPrice * 0.3),
      single_room_surcharge: singleRoomSurcharge !== '' ? Number(singleRoomSurcharge) : 7500000,
      itinerary_pdf_url: itineraryPdfUrl || undefined,
      notice_sections: JSON.stringify(noticeSections),
      tour_type: tourType,
      partner_name: partnerName || undefined,
      partner_contact: partnerContact || undefined,
      organization_name: organizationName || undefined,
      group_leader_contact: groupLeaderContact || undefined,
      custom_requirements: customRequirements || undefined,
      visa_country: visaCountry || undefined,
      visa_service_type: visaServiceType || undefined,
      visa_speed: visaSpeed || undefined,
    };

    if (editingTour) {
      // Logic edit
      updateTour({
        ...editingTour,
        ...tourData,
      } as Tour);
      alert(`Đã cập nhật thông tin tour ${code} thành công!`);
    } else {
      // Logic add
      addTour(tourData);
      alert(`Đã thêm tour ${code} khởi hành mới thành công!`);
    }

    resetForm();
  };

  // Interactive controls for visualTravelNotesBuilder
  const updateSectionTitle = (secIndex: number, newTitle: string) => {
    setNoticeSections(prev => prev.map((sec, i) => i === secIndex ? { ...sec, title: newTitle } : sec));
  };

  const updateSectionRow = (secIndex: number, rowIndex: number, field: 'key' | 'value', value: string) => {
    setNoticeSections(prev => prev.map((sec, i) => {
      if (i !== secIndex) return sec;
      const updatedItems = sec.items.map((row, r) => r === rowIndex ? { ...row, [field]: value } : row);
      return { ...sec, items: updatedItems };
    }));
  };

  const addRowToSection = (secIndex: number) => {
    setNoticeSections(prev => prev.map((sec, i) => {
      if (i !== secIndex) return sec;
      return {
        ...sec,
        items: [...sec.items, { key: "Tiêu đề lưu ý", value: "Nội dung quy định chi tiết mới..." }]
      };
    }));
  };

  const removeRowFromSection = (secIndex: number, rowIndex: number) => {
    setNoticeSections(prev => prev.map((sec, i) => {
      if (i !== secIndex) return sec;
      return {
        ...sec,
        items: sec.items.filter((_, r) => r !== rowIndex)
      };
    }));
  };

  const addNoticeSection = () => {
    setNoticeSections(prev => [
      ...prev,
      {
        title: `${prev.length + 1}. Mục thông tin lưu ý mới:`,
        items: [
          { key: "Yêu cầu", value: "Mô tả nội dung cụ thể..." }
        ]
      }
    ]);
  };

  const removeNoticeSection = (secIndex: number) => {
    setNoticeSections(prev => prev.filter((_, i) => i !== secIndex));
  };

  // Delete tour helper
  const handleDeleteTourClick = (tour: Tour) => {
    if (confirm(`Bạn có chắc chắn muốn XÓA vĩnh viễn tour ${tour.code}? Các đơn đặt giữ chỗ liên quan có thể bị ảnh hưởng.`)) {
      deleteTour(tour.id);
      alert(`Đã xóa tour ${tour.code} ra khỏi cơ sở dữ liệu.`);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Extension Requests Pending Operator approval */}
      {extensionRequests.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-orange-900 flex items-center mb-4">
            <Clock className="w-5 h-5 mr-2 text-orange-600 animate-pulse" />
            Yêu cầu gia hạn giữ chỗ cần duyệt ({extensionRequests.length})
          </h3>
          <div className="space-y-4">
            {extensionRequests.map(order => {
              const tour = tours.find(t => t.id === order.tour_id);
              return (
                <div key={order.id} className="bg-white p-4 rounded-lg border border-orange-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{order.id}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700">{tour?.code}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">
                      Sale <span className="font-semibold text-gray-900">{order.created_by}</span> yêu cầu gia hạn thêm <span className="font-bold text-orange-600">{(order as any).extension_hours} giờ</span> giữ chỗ.
                    </p>
                    {order.hold_expiry && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Hạn giữ chỗ hiện tại: {format(new Date(order.hold_expiry), 'HH:mm dd/MM/yyyy')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => handleExtensionRequest(order.id, false)}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center px-3.5 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <X className="w-4 h-4 mr-1 text-red-500" /> Từ chối
                    </button>
                    <button 
                      onClick={() => handleExtensionRequest(order.id, true)}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center px-3.5 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 shadow-sm"
                    >
                      <Check className="w-4 h-4 mr-1" /> Đồng ý gia hạn
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Header section with Tabs */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900" style={{ fontSize: '28px' }}>Bảng điều hành Tour & Danh mục</h2>
          <p className="text-sm text-gray-500 mt-1">Quản lý danh sách dịch vụ Visa, hồ sơ và các yêu cầu cấp Visa.</p>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab('tours')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'tours' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Quản lý Dịch vụ Visa ({tours.length})
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'categories' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Danh mục Tour ({categories.length})
            </button>
          </div>

          {activeTab === 'tours' && !showAddForm && !editingTour && (
            <button 
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Thêm Tour Mới
            </button>
          )}
        </div>
      </div>

      {activeTab === 'categories' ? (
        /* CATEGORIES MANAGEMENT TAB */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">Tạo Danh Mục Mới</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Tên danh mục mới *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Du lịch Bắc Mỹ, Tour Cao Cấp..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!newCatName.trim()) return;
                  addCategory(newCatName);
                  setNewCatName('');
                  alert('Đã thêm danh mục mới!');
                }}
                className="w-full inline-flex items-center justify-center bg-blue-600 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" /> Thêm danh mục
              </button>
            </div>
          </div>

          <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-slate-50/50">
              <h3 className="font-bold text-gray-900 text-sm">Danh sách danh mục đang kích hoạt</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {categories.map(cat => {
                const tourCount = tours.filter(t => t.category === cat).length;
                const isEditingThis = editingCatOldName === cat;

                return (
                  <div key={cat} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                    {isEditingThis ? (
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          className="flex-1 px-3 py-1 border border-blue-400 rounded-md text-sm bg-white"
                          value={editingCatNewName}
                          onChange={e => setEditingCatNewName(e.target.value)}
                        />
                        <button
                          onClick={() => {
                            updateCategory(cat, editingCatNewName);
                            setEditingCatOldName(null);
                          }}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700"
                        >
                          Lưu
                        </button>
                        <button
                          onClick={() => setEditingCatOldName(null)}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-bold hover:bg-gray-300"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-slate-400" />
                          <span className="font-semibold text-gray-800 text-sm">{cat}</span>
                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                            {tourCount} tour liên kết
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingCatOldName(cat);
                              setEditingCatNewName(cat);
                            }}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-all"
                            title="Sửa tên danh mục"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (tourCount > 0) {
                                alert(`Không thể xóa danh mục này vì đang có ${tourCount} tour liên kết. Vui lòng chuyển đổi danh mục của các tour này trước.`);
                                return;
                              }
                              if (confirm(`Xác nhận xóa danh mục "${cat}"?`)) {
                                deleteCategory(cat);
                              }
                            }}
                            className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded transition-all"
                            title="Xóa danh mục"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* TOURS MANAGEMENT TAB */
        <>
          {/* TOUR FORM SECTION (Both Add & Edit) */}
          {(showAddForm || editingTour) && (
            <div id="tour-form-section" className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden animate-in fade-in duration-200">
              <div className="px-6 py-4 border-b border-gray-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-base font-black text-gray-900">
                  {editingTour ? `Cập Nhật Tour: ${editingTour.code}` : 'Khai Báo Tour Du Lịch Mới'}
                </h3>
                <button 
                  onClick={resetForm}
                  className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-8">
                {/* 1. Basic Info */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                    <Grid className="w-4 h-4 text-blue-600" /> General / Thông tin cơ bản
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tourType === 'visa' ? 'Mã visa *' : 'Mã tour *'}</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ví dụ: THAILAN-5D-ART"
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-bold ${isCodeDuplicate ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                      />
                      {isCodeDuplicate && <p className="text-red-500 text-xs mt-1 font-semibold">{tourType === 'visa' ? 'Mã visa này đã tồn tại!' : 'Mã tour này đã tồn tại!'}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tourType === 'visa' ? 'Tên visa *' : 'Tên tour *'}</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ví dụ: [SÀI GÒN] THÁI LAN: BANGKOK - PATTAYA..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={name}
                        onChange={e => setName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Loại hình sản phẩm *</label>
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 font-semibold text-slate-800">
                        🛂 Dịch vụ Visa lẻ
                      </div>
                    </div>
                  </div>
                  
                  {tourType !== 'internal' && (
                    <div className={`p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-200 mt-4 ${
                      tourType === 'partner' ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900' :
                      tourType === 'private' ? 'bg-amber-50/40 border-amber-200 text-amber-900' :
                      'bg-purple-50/40 border-purple-200 text-purple-900'
                    }`}>
                      <h5 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        {tourType === 'partner' && <>🤝 Thông tin Gửi khách sang Công ty đối tác</>}
                        {tourType === 'private' && <>👑 Thông tin Yêu cầu Tour đoàn riêng / Custom</>}
                        {tourType === 'visa' && <>🛂 Thông tin Dịch vụ Visa lẻ đặc thù</>}
                      </h5>

                      {tourType === 'partner' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Tên công ty đối tác nhận khách *</label>
                            <input
                              type="text"
                              required
                              placeholder="Ví dụ: Saigontourist, Vietravel..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-950 font-medium"
                              value={partnerName}
                              onChange={e => setPartnerName(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Thông tin liên hệ đối tác (SĐT/Người phụ trách) *</label>
                            <input
                              type="text"
                              required
                              placeholder="Ví dụ: Anh Nam - 0987xxxxxx"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-950 font-medium"
                              value={partnerContact}
                              onChange={e => setPartnerContact(e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {tourType === 'private' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Tên cơ quan / Đoàn khách / Doanh nghiệp *</label>
                            <input
                              type="text"
                              required
                              placeholder="Ví dụ: Công ty Techcombank chi nhánh Sài Gòn"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-950 font-medium"
                              value={organizationName}
                              onChange={e => setOrganizationName(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Đại diện liên hệ (Tên, SĐT, Chức vụ) *</label>
                            <input
                              type="text"
                              required
                              placeholder="Ví dụ: Chị Lan Anh (HR) - 0912xxxxxx"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-950 font-medium"
                              value={groupLeaderContact}
                              onChange={e => setGroupLeaderContact(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Yêu cầu đặc biệt (Gala, Teambuilding, v.v.)</label>
                            <input
                              type="text"
                              placeholder="Ví dụ: Cần Gala dinner, quay phim flycam, Backdrop teambuilding"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-950 font-medium"
                              value={customRequirements}
                              onChange={e => setCustomRequirements(e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {tourType === 'visa' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Loại visa lẻ (Du lịch, Công tác, Thăm thân...) *</label>
                            <input
                              type="text"
                              required
                              placeholder="Ví dụ: Visa Du lịch Hàn Quốc 5 năm, Visa Thương mại..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-950 font-medium"
                              value={visaServiceType}
                              onChange={e => setVisaServiceType(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Yêu cầu hồ sơ đính kèm (Hoặc lưu ý cần chuẩn bị)</label>
                            <input
                              type="text"
                              placeholder="Ví dụ: Hộ chiếu gốc còn hạn 6 tháng, 2 ảnh 4x6 nền trắng, CCCD công chứng..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-950 font-medium"
                              value={customRequirements}
                              onChange={e => setCustomRequirements(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tourType === 'visa' ? 'Thời gian xử lý *' : 'Thời gian hành trình *'}</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ví dụ: 5 ngày 4 đêm"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={duration}
                        onChange={e => setDuration(e.target.value)}
                      />
                    </div>
                    {tourType !== 'visa' && (
                      <VietnameseDateTimePicker
                        label="Ngày giờ đi"
                        required
                        showTime
                        value={departureTime}
                        onChange={setDepartureTime}
                      />
                    )}
                    {tourType !== 'visa' && (
                      <VietnameseDateTimePicker
                        label="Ngày giờ về"
                        required
                        showTime
                        value={returnTime}
                        onChange={setReturnTime}
                      />
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700">Danh mục sản phẩm *</label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowInlineCatForm(!showInlineCatForm);
                            setInlineCatName('');
                          }}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {showInlineCatForm ? "Hủy" : "+ Tạo danh mục mới"}
                        </button>
                      </div>
                      
                      {showInlineCatForm ? (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                          <input
                            type="text"
                            placeholder="Tên danh mục mới..."
                            className="flex-1 px-3 py-1.5 border border-blue-400 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                            value={inlineCatName}
                            onChange={e => setInlineCatName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddInlineCategory();
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleAddInlineCategory}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                          >
                            Thêm
                          </button>
                        </div>
                      ) : (
                        <select 
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          value={category}
                          onChange={e => setCategory(e.target.value)}
                        >
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Airline, Hotel, PDF Itinerary */}
                {tourType !== 'visa' && (
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 pb-1.5 flex items-center gap-1.5">
                    <Plane className="w-4 h-4 text-emerald-600" /> Logistics & Lịch Trình PDF
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hãng hàng không</label>
                      <input 
                        type="text" 
                        placeholder="Vietnam Airlines, Vietjet..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={airline}
                        onChange={e => setAirline(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu chuẩn Khách sạn</label>
                      <input 
                        type="text" 
                        placeholder="Khách sạn 4 sao, Resort 5 sao..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={hotel}
                        onChange={e => setHotel(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                        📂 Lịch trình chi tiết (File PDF)
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                      </label>
                      
                      {isUploadingItinerary ? (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 bg-blue-50/30 rounded-xl p-4 text-center">
                          <div className="w-8 h-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mb-2" />
                          <p className="text-xs font-semibold text-blue-700">Đang tải file lên hệ thống...</p>
                          <p className="text-[10px] text-blue-500 mt-1">Đang đồng bộ và sắp xếp vào thư mục Drive...</p>
                        </div>
                      ) : itineraryPdfUrl ? (
                        <div className="p-3 border border-emerald-200 bg-emerald-50/40 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-emerald-800 truncate" title={itineraryPdfUrl}>
                                {code ? `${code.trim().toUpperCase()}.pdf` : 'Lich_trinh.pdf'}
                              </p>
                              <a 
                                href={itineraryPdfUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-[11px] text-blue-600 hover:underline font-semibold flex items-center gap-1 mt-0.5"
                              >
                                Xem tài liệu <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                          
                          <label className="cursor-pointer bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
                            Thay đổi
                            <input 
                              type="file" 
                              accept=".pdf,application/pdf" 
                              className="hidden" 
                              onChange={handleItineraryUpload}
                            />
                          </label>
                        </div>
                      ) : (
                        <label className={`group cursor-pointer flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                          code.trim() 
                            ? 'border-gray-300 bg-white hover:border-blue-500 hover:bg-blue-50/10' 
                            : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                        }`}>
                          <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${
                            code.trim() ? 'text-gray-400 group-hover:text-blue-500' : 'text-gray-300'
                          }`} />
                          <p className="text-xs font-bold text-gray-700">
                            {code.trim() ? 'Kéo thả hoặc click để tải lên tệp PDF' : 'Vui lòng nhập Mã Tour trước'}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {code.trim() ? 'Chỉ chấp nhận file định dạng PDF' : 'Để hệ thống đặt tên file theo mã tour'}
                          </p>
                          {code.trim() && (
                            <input 
                              type="file" 
                              accept=".pdf,application/pdf" 
                              className="hidden" 
                              onChange={handleItineraryUpload}
                            />
                          )}
                        </label>
                      )}
                      
                      {itineraryUploadError && (
                        <p className="text-xs font-semibold text-rose-600 mt-1.5 flex items-center gap-1 bg-rose-50 border border-rose-100 p-2 rounded-lg">
                          ⚠️ {itineraryUploadError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                )}

                {/* 3. Numeric inputs with dynamic thousands separator formatting */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 pb-1.5 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-rose-600" /> Biểu giá & Hoa hồng (Phân cách hàng nghìn khi nhập)
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <NumericFormatInput
                      label={tourType === 'visa' ? "Giá visa (VND) *" : "Giá Tour niêm yết (VND) *"}
                      required
                      value={price}
                      onChange={setPrice}
                    />
                    <NumericFormatInput
                      label="Hoa hồng Sales / Đại lý *"
                      required
                      value={commission}
                      onChange={setCommission}
                    />
                    {tourType !== 'visa' && (
                      <NumericFormatInput
                        label="Giá visa đi tour (VND)"
                        value={priceVisaTour}
                        onChange={setPriceVisaTour}
                      />
                    )}
                    <div className="md:col-span-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 space-y-1">
                      <div className="text-xs font-bold text-blue-800">Gợi ý tỷ lệ:</div>
                      <div className="text-[11px] text-blue-600 leading-relaxed">
                        Sales sẽ thấy giá bán cuối cùng đã trừ hoa hồng hoặc cộng thêm tùy chỉnh. Hãy thiết lập hoa hồng cân đối để tối ưu doanh số của đại lý.
                      </div>
                    </div>
                  </div>

                  {tourType !== 'visa' && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-4">
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-600">Cấu hình giá chi tiết theo độ tuổi (Không nhập hệ thống tự tính)</h5>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <NumericFormatInput
                        label="Giá người lớn"
                        value={priceAdult}
                        onChange={setPriceAdult}
                        placeholder={price ? `Mặc định: ${new Intl.NumberFormat('vi-VN').format(Number(price))}` : 'Như giá tour'}
                      />
                      <NumericFormatInput
                        label="Giá trẻ em (2-10T)"
                        value={priceChild}
                        onChange={setPriceChild}
                        placeholder={price ? `Mặc định: ${new Intl.NumberFormat('vi-VN').format(Math.round(Number(price) * 0.8))}` : '80% giá tour'}
                      />
                      <NumericFormatInput
                        label="Giá trẻ nhỏ (<2T)"
                        value={priceInfant}
                        onChange={setPriceInfant}
                        placeholder={price ? `Mặc định: ${new Intl.NumberFormat('vi-VN').format(Math.round(Number(price) * 0.3))}` : '30% giá tour'}
                      />
                      <NumericFormatInput
                        label="Phụ thu phòng đơn"
                        value={singleRoomSurcharge}
                        onChange={setSingleRoomSurcharge}
                        placeholder="Mặc định: 7.500.000"
                      />
                    </div>
                  </div>
                )}
                </div>

                {/* 4. Seats & Holds */}
                {tourType !== 'visa' && (
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 pb-1.5 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-purple-600" /> Quỹ Chỗ & Quy Định Hold
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tổng số chỗ mở bán *</label>
                      <input 
                        type="number" 
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        value={totalSeats}
                        onChange={e => setTotalSeats(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Overbooking cho phép</label>
                      <input 
                        type="number" 
                        min="0"
                        placeholder="Mặc định: 0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        value={overbookLimit}
                        onChange={e => setOverbookLimit(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mặc định Hold (Giờ) *</label>
                      <input 
                        type="number" 
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        value={holdDuration}
                        onChange={e => setHoldDuration(Number(e.target.value))}
                      />
                    </div>
                    <VietnameseDateTimePicker
                      label="Hạn nộp Visa"
                      showTime={false}
                      value={visaDeadline}
                      onChange={setVisaDeadline}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái mở bán</label>
                      <select 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        value={tourStatus}
                        onChange={e => setTourStatus(e.target.value as TourStatus)}
                      >
                        <option value="available">Còn chỗ</option>
                        <option value="noshop">No shop</option>
                        <option value="last_minute">Giờ chót</option>
                        <option value="holiday">Lễ Tết</option>
                        <option value="on_sale">Đang giảm giá</option>
                        <option value="full">Kín chỗ</option>
                      </select>
                    </div>
                  </div>
                </div>
                )}

                {/* Flight numbers / transit details */}
                {tourType !== 'visa' && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 pb-1.5 flex items-center gap-1.5">
                    <Plane className="w-4 h-4 text-teal-600" /> Mã hiệu chuyến bay / Quá cảnh
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Chuyến bay đi (Chặng 1)</label>
                        <input 
                          type="text" 
                          placeholder="VD: QR971 SGN - DOH 19:55 - 23:25"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                          value={flightOut}
                          onChange={e => setFlightOut(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Chặng bay đi tiếp theo (Quá cảnh)</label>
                        <input 
                          type="text" 
                          placeholder="VD: QR039 DOH - CDG 01:25 - 07:25"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                          value={flightOutTransit}
                          onChange={e => setFlightOutTransit(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Chuyến bay về (Chặng 1)</label>
                        <input 
                          type="text" 
                          placeholder="VD: QR116 FCO - DOH 16:35 - 23:10"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                          value={flightIn}
                          onChange={e => setFlightIn(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Chặng bay về tiếp theo (Quá cảnh)</label>
                        <input 
                          type="text" 
                          placeholder="VD: QR970 DOH - SGN 02:35 - 14:25"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                          value={flightInTransit}
                          onChange={e => setFlightInTransit(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Ghi chú quá cảnh</label>
                      <input 
                        type="text" 
                        placeholder="VD: Quá cảnh tại Doha 3 tiếng"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                        value={transitInfo}
                        onChange={e => setTransitInfo(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Tình trạng vé đoàn</label>
                      <input 
                        type="text" 
                        placeholder="CHỜ XUẤT VÉ, ĐÃ CHỐT XUẤT VÉ..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                        value={ticketStatus}
                        onChange={e => setTicketStatus(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Hướng dẫn viên trưởng đoàn</label>
                      <input 
                        type="text" 
                        placeholder="Họ tên HDV"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                        value={guideName}
                        onChange={e => setGuideName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Số điện thoại liên hệ HDV</label>
                      <input 
                        type="text" 
                        placeholder="Số điện thoại"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                        value={guidePhone}
                        onChange={e => setGuidePhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                )}

                {/* 5. VISUAL TRAVEL NOTES & DISCLAIMER BUILDER (identical to screenshot format) */}
                <div className="space-y-5 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-orange-600" />
                      Biểu mẫu Thông Tin / Quy định / Lưu ý đi tour chi tiết
                    </h4>
                    <button
                      type="button"
                      onClick={addNoticeSection}
                      className="inline-flex items-center text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Thêm phần mới
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 leading-normal">
                    Thiết lập bảng thông tin quy định chi tiết về hành lý, hải quan, ăn uống và sức khỏe. Mục này sẽ xuất hiện dưới dạng một bảng tra cứu thông tin chuyên nghiệp (như ảnh chụp quy chuẩn) khi người dùng click vào nút <strong>"Thông tin lưu ý"</strong> ở màn hình lịch khởi hành.
                  </p>

                  <div className="space-y-6">
                    {noticeSections.map((sec, secIdx) => (
                      <div key={secIdx} className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 relative">
                        {/* Remove Section button */}
                        <button
                          type="button"
                          onClick={() => removeNoticeSection(secIdx)}
                          className="absolute right-3 top-3 text-gray-400 hover:text-red-600 transition-colors"
                          title="Xóa mục lớn này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="max-w-md mb-4">
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tên mục lớn (Ví dụ: II. THỦ TỤC HÀNG KHÔNG VÀ HẢI QUAN)</label>
                          <input
                            type="text"
                            required
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm font-bold text-blue-800 bg-white"
                            value={sec.title}
                            onChange={(e) => updateSectionTitle(secIdx, e.target.value)}
                          />
                        </div>

                        {/* Rows list */}
                        <div className="space-y-3.5 pl-2 border-l-2 border-blue-100">
                          {sec.items.map((row, rowIdx) => (
                            <div key={rowIdx} className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start bg-white p-3 rounded-lg border border-gray-150">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Tiêu đề hàng (Trái)</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Hành lý ký gửi..."
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-semibold text-emerald-800 bg-gray-50"
                                  value={row.key}
                                  onChange={(e) => updateSectionRow(secIdx, rowIdx, 'key', e.target.value)}
                                />
                              </div>
                              <div className="lg:col-span-2 flex items-start gap-2.5">
                                <div className="flex-1">
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Nội dung giải trình (Phải)</label>
                                  <textarea
                                    rows={2}
                                    required
                                    placeholder="Nội dung cụ thể quy định..."
                                    className="w-full px-2.5 py-1 border border-gray-300 rounded text-xs leading-relaxed text-gray-700 bg-white"
                                    value={row.value}
                                    onChange={(e) => updateSectionRow(secIdx, rowIdx, 'value', e.target.value)}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeRowFromSection(secIdx, rowIdx)}
                                  className="p-1 mt-4 text-gray-400 hover:text-rose-600 transition-colors"
                                  title="Xóa hàng này"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => addRowToSection(secIdx)}
                            className="inline-flex items-center text-xs text-emerald-600 hover:text-emerald-700 font-bold mt-1"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Thêm hàng quy định
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit Center */}
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 bg-white"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    type="submit"
                    disabled={isCodeDuplicate}
                    className={`px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm ${isCodeDuplicate ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {editingTour ? 'Cập Nhật Tour' : 'Lưu & Đăng Bán'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SUMMARY DASHBOARD FOR OPERATOR */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-500">Tổng số Tour hoạt động</span>
                <div className="text-3xl font-extrabold text-gray-900 mt-1">{tours.length}</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <FolderOpen className="w-6 h-6 text-blue-600" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-500">Chỗ đã bán (Sure)</span>
                <div className="text-3xl font-extrabold text-emerald-600 mt-1">
                  {tours.reduce((sum, t) => sum + t.sold_seats, 0)} chỗ
                </div>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                <Check className="w-6 h-6 text-emerald-600" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-500">Chỗ đang giữ tạm thời</span>
                <div className="text-3xl font-extrabold text-amber-600 mt-1">
                  {tours.reduce((sum, t) => sum + t.hold_seats, 0)} chỗ
                </div>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          {/* LIST OF ACTIVE TOURS WITH FULL CRUD OPERATIONS */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Danh sách điều phối chỗ & Lịch trình</h3>
                <span className="text-xs text-gray-500 mt-1 block">Tạo và quản lý các loại dịch vụ Visa lẻ.</span>
              </div>

              {/* View mode toggle switcher */}
              <div className="flex bg-slate-200/60 p-1 rounded-lg border border-slate-300/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('grouped')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    viewMode === 'grouped' 
                      ? 'bg-white text-blue-700 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Gom nhóm theo Hành Trình
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('flat')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    viewMode === 'flat' 
                      ? 'bg-white text-blue-700 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Danh sách phẳng
                </button>
              </div>
            </div>

            {viewMode === 'grouped' ? (
              <div className="p-6 space-y-6">
                {Object.keys(groupedTours).length === 0 ? (
                  <div className="text-center py-12 text-sm text-gray-400">Chưa có tour du lịch nào được tạo.</div>
                ) : (
                  Object.entries(groupedTours)
                    .sort((entryA, entryB) => {
                      const toursA = entryA[1] as Tour[];
                      const toursB = entryB[1] as Tour[];
                      const latestA = Math.max(...toursA.map(t => t.created_at ? new Date(t.created_at).getTime() : 0));
                      const latestB = Math.max(...toursB.map(t => t.created_at ? new Date(t.created_at).getTime() : 0));
                      return latestB - latestA;
                    })
                    .map(([groupName, groupToursList]) => {
                    const groupTours = groupToursList as Tour[];
                    const isExpanded = expandedGroups[groupName];
                    const firstTour = groupTours[0];
                    const totalSold = groupTours.reduce((sum, t) => sum + t.sold_seats, 0);
                    const totalHold = groupTours.reduce((sum, t) => sum + t.hold_seats, 0);
                    const totalSeatsSum = groupTours.reduce((sum, t) => sum + t.total_seats, 0);

                    return (
                      <div key={groupName} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white hover:shadow transition-all duration-200">
                        {/* Group Header (Accordion toggle) */}
                        <div 
                          onClick={() => toggleGroup(groupName)}
                          className="bg-slate-50 hover:bg-slate-100/80 px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none transition-colors border-b border-slate-150"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-black text-blue-700 bg-blue-100/75 border border-blue-200 px-2 py-0.5 rounded uppercase tracking-wider">
                                {firstTour.category || 'Chưa phân mục'}
                              </span>
                              <span className="text-xs font-bold text-gray-500 flex items-center">
                                <Plane className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                {firstTour.airline}
                              </span>
                              <span className="text-xs font-bold text-gray-500 flex items-center">
                                <Building className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                {firstTour.hotel}
                              </span>
                              {firstTour.itinerary_pdf_url && (
                                <span className="text-[10px] font-black text-emerald-700 flex items-center bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  <FileText className="w-3 h-3 mr-1" />
                                  LỊCH TRÌNH PDF
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-black text-gray-900 leading-snug uppercase tracking-wide">
                              {groupName}
                            </h4>
                            <div className="text-xs text-gray-500 font-semibold flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span>Thời lượng: <strong className="text-gray-700 font-bold">{firstTour.duration}</strong></span>
                              <span className="text-gray-300">|</span>
                              <span>Chuỗi gồm: <strong className="text-blue-700 font-bold">{groupTours.length} đợt khởi hành</strong></span>
                              {firstTour.tour_type !== 'visa' && (
                                <>
                                  <span className="text-gray-300">|</span>
                                  <span>Đã bán chuỗi: <strong className="text-emerald-700 font-bold">{totalSold}</strong> — Giữ chỗ: <strong className="text-amber-700 font-bold">{totalHold}</strong> — Trống: <strong className="text-slate-800 font-bold">{totalSeatsSum - totalSold - totalHold}</strong></span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 self-end md:self-auto" onClick={e => e.stopPropagation()}>
                            {/* Quick Add Departure button */}
                            <button
                              type="button"
                              onClick={() => handleAddDepartureQuick(firstTour)}
                              className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black transition-all shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5 mr-1.5" />
                              Thêm ngày đi mới
                            </button>

                            {/* Bulk Create Series button */}
                            <button
                              type="button"
                              onClick={() => handleOpenBulkModal(firstTour)}
                              className="inline-flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-black transition-all shadow-sm"
                            >
                              <Grid className="w-3.5 h-3.5 mr-1.5" />
                              Tạo hàng loạt (Series)
                            </button>

                            {/* Collapse/Expand indicator */}
                            <button
                              type="button"
                              onClick={() => toggleGroup(groupName)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        {/* Group Content: Departure Dates Table */}
                        {isExpanded && (
                          <div className="overflow-x-auto border-t border-slate-100 bg-white">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-slate-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                <tr>
                                  <th className="px-6 py-3 text-left w-36">Mã Tour</th>
                                  <th className="px-6 py-3 text-left">Khởi hành & Hạn Visa</th>
                                  <th className="px-6 py-3 text-right">Giá Tour & HH</th>
                                  <th className="px-6 py-3 text-center">Giờ Giữ & Vé</th>
                                  <th className="px-6 py-3 text-center">Trạng thái chỗ</th>
                                  <th className="px-6 py-3 text-center w-28">Hành động</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-150 text-xs text-gray-700">
                                {groupTours.map(t => (
                                  <tr key={t.id} className="hover:bg-slate-50/40 transition-colors">
                                    <td className="px-6 py-3">
                                      <span className="font-mono font-bold text-blue-700 tracking-tight bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-md inline-block">
                                        {t.code}
                                      </span>
                                    </td>
                                    <td className="px-6 py-3">
                                      <div className="font-semibold text-gray-800 text-xs">
                                        {t.tour_type === 'visa' ? t.duration : (t.departure_time ? format(new Date(t.departure_time), 'dd/MM/yyyy HH:mm') : '-')}
                                      </div>
                                      {t.visa_deadline && (
                                        <div className="text-[9px] text-red-600 font-bold mt-1 uppercase tracking-wide bg-red-50 border border-red-100 px-1.5 py-0.5 rounded inline-block">
                                          Hạn visa: {format(new Date(t.visa_deadline), 'dd/MM')}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-6 py-3 text-right font-bold text-rose-600 whitespace-nowrap">
                                      <div>{new Intl.NumberFormat('vi-VN').format(t.price)} VND</div>
                                      <div className="text-[10px] text-gray-400 font-medium">HH: {new Intl.NumberFormat('vi-VN').format(t.commission)}</div>
                                    </td>
                                    <td className="px-6 py-3 text-center whitespace-nowrap">
                                      {t.tour_type === 'visa' ? (
                                        <span className="text-[10px] text-gray-400 italic">Không áp dụng</span>
                                      ) : (
                                        <>
                                          <div className="text-[11px] font-semibold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded inline-block">
                                            {t.hold_duration_hours || 48}h
                                          </div>
                                          <div className="text-[10px] text-slate-500 mt-1 italic max-w-[100px] truncate mx-auto" title={t.ticket_status}>
                                            {t.ticket_status || 'Chờ xuất vé'}
                                          </div>
                                        </>
                                      )}
                                    </td>
                                    <td className="px-6 py-3 text-center whitespace-nowrap">
                                      {t.tour_type === 'visa' ? (
                                        <span className="text-[10px] text-gray-400 italic">Không giới hạn</span>
                                      ) : (
                                        <div className="inline-flex gap-1.5 font-bold text-[10px] items-center">
                                          <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100" title="Đã bán chắc chắn">
                                            {t.sold_seats} Sure
                                          </span>
                                          <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100" title="Đang giữ tạm">
                                            {t.hold_seats} Hold
                                          </span>
                                          <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100" title="Còn trống để đăng ký">
                                            {t.available_seats} Trống
                                          </span>
                                          {t.overbook_limit ? (
                                            <span className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100" title="Overbooking tối đa được cho phép">
                                              +{t.overbook_limit} OB
                                            </span>
                                          ) : null}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-6 py-3 text-center whitespace-nowrap">
                                      <div className="flex items-center justify-center gap-1.5">
                                        {/* Duplicate/Clone */}
                                        <button
                                          onClick={() => handleCloneTour(t)}
                                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100 bg-blue-50/40"
                                          title="Sao chép ngày khởi hành"
                                        >
                                          <Copy className="w-4 h-4" />
                                        </button>
                                        {/* Edit */}
                                        <button
                                          onClick={() => startEdit(t)}
                                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-amber-100 bg-amber-50/40"
                                          title="Sửa chi tiết"
                                        >
                                          <Edit3 className="w-4 h-4" />
                                        </button>
                                        {/* Delete */}
                                        <button
                                          onClick={() => handleDeleteTourClick(t)}
                                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100 bg-rose-50/40"
                                          title="Xóa"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-slate-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 text-left">Mã tour / Danh mục</th>
                      <th className="px-6 py-4 text-left">Tên Hành Trình</th>
                      <th className="px-6 py-4 text-center">Khởi Hành</th>
                      <th className="px-6 py-4 text-center">Giá Tour</th>
                      <th className="px-6 py-4 text-center">Hold / Vé</th>
                      <th className="px-6 py-4 text-center">Ghế (Bán / Giữ / Trống)</th>
                      <th className="px-6 py-4 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                    {tours
                      .filter(t => t.tour_type === 'visa')
                      .sort((a, b) => {
                        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                        return dateB - dateA;
                      })
                      .map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-blue-700 tracking-tight text-xs bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md inline-block">
                            {t.code}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1 font-bold uppercase tracking-wider">{t.category || 'Chưa phân mục'}</div>
                          {/* Tour Type Badge */}
                          <div className="mt-1.5">
                            {t.tour_type === 'partner' && (
                              <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full font-bold uppercase">
                                🤝 Gửi khách đối tác
                              </span>
                            )}
                            {t.tour_type === 'private' && (
                              <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold uppercase">
                                👑 Tour đoàn riêng
                              </span>
                            )}
                            {t.tour_type === 'visa' && (
                              <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full font-bold uppercase">
                                🛂 Dịch vụ Visa lẻ
                              </span>
                            )}
                            {(t.tour_type === 'internal' || !t.tour_type) && (
                              <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-full font-bold uppercase">
                                🏢 Tour tự chạy
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="font-bold text-gray-900 text-xs line-clamp-2" title={t.name}>{t.name}</div>
                          <div className="text-[10px] text-gray-400 mt-1 font-semibold flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span>{t.duration}</span>
                              <span>•</span>
                              <span>Hotel: {t.hotel}</span>
                            </div>
                            
                            {/* Product-Specific Subtext */}
                            {t.tour_type === 'partner' && (
                              <div className="text-[10px] text-indigo-700 font-bold bg-indigo-50/50 px-1.5 py-0.5 rounded border border-indigo-100/30 mt-1">
                                Đối tác: <span className="underline">{t.partner_name}</span> ({t.partner_contact})
                              </div>
                            )}
                            {t.tour_type === 'private' && (
                              <div className="text-[10px] text-amber-800 font-bold bg-amber-50/40 px-1.5 py-0.5 rounded border border-amber-100/30 mt-1">
                                Khách đoàn: <span className="underline">{t.organization_name}</span> | Y/C: {t.custom_requirements || 'Không có'}
                              </div>
                            )}
                            {t.tour_type === 'visa' && (
                              <div className="text-[10px] text-purple-800 font-bold bg-purple-50/40 px-1.5 py-0.5 rounded border border-purple-100/30 mt-1">
                                Quốc gia: <span className="underline">{t.visa_country}</span> | {t.visa_service_type} ({t.visa_speed === 'urgent' ? '⚡ Khẩn' : '⏳ Thường'})
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <div className="font-semibold text-gray-800 text-xs">
                            {t.tour_type === 'visa' 
                              ? t.duration 
                              : (t.departure_time ? format(new Date(t.departure_time), 'dd/MM/yyyy HH:mm') : '-')
                            }
                          </div>
                          {t.visa_deadline && (
                            <div className="text-[9px] text-red-600 font-bold mt-1 uppercase tracking-wide bg-red-50 border border-red-100 px-1.5 py-0.5 rounded inline-block">
                              Hạn visa: {format(new Date(t.visa_deadline), 'dd/MM')}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap font-bold text-rose-600 text-xs">
                          <div>{new Intl.NumberFormat('vi-VN').format(t.price)} VND</div>
                          <div className="text-[10px] text-gray-400 font-medium">HH: {new Intl.NumberFormat('vi-VN').format(t.commission)}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {t.tour_type === 'visa' ? (
                            <span className="text-xs text-gray-400 italic">Không áp dụng</span>
                          ) : (
                            <>
                              <div className="text-xs font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded-md inline-block">
                                {t.hold_duration_hours || 48}h
                              </div>
                              <div className="text-[10px] text-slate-500 mt-1 italic max-w-[100px] truncate" title={t.ticket_status}>
                                {t.ticket_status || 'Chờ xuất vé'}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {t.tour_type === 'visa' ? (
                            <span className="text-xs text-gray-400 italic">Không giới hạn</span>
                          ) : (
                            <div className="inline-flex gap-1.5 text-[11px] font-bold items-center">
                              <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100" title="Đã bán chắc chắn">
                                {t.sold_seats} Sure
                              </span>
                              <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100" title="Đang giữ tạm">
                                {t.hold_seats} Hold
                              </span>
                              <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100" title="Còn trống để đăng ký">
                                {t.available_seats} Trống
                              </span>
                              {t.overbook_limit ? (
                                <span className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100" title="Overbooking tối đa được cho phép">
                                  +{t.overbook_limit} OB
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Duplicate/Clone action */}
                            <button
                              onClick={() => handleCloneTour(t)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100 bg-blue-50/40"
                              title="Sao chép tour sang ngày khởi hành khác"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            
                            {/* Edit action */}
                            <button
                              onClick={() => startEdit(t)}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-amber-100 bg-amber-50/40"
                              title="Sửa thông tin chi tiết tour"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Delete action */}
                            <button
                              onClick={() => handleDeleteTourClick(t)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100 bg-rose-50/40"
                              title="Xóa tour khởi hành này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL BỘ TẠO TOUR KHỞI HÀNH HÀNG LOẠT (SERIES) */}
      {showBulkModal && bulkBaseTour && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <Grid className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Bộ tạo đoàn khởi hành hàng loạt</h3>
                  <p className="text-xs text-slate-500 font-semibold">Tự động hóa nhân bản tour sang nhiều ngày khởi hành tùy chọn trong tích tắc.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50/40">
              {/* Left Column: Rules configuration (5 cols) */}
              <div className="md:col-span-5 space-y-4">
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
                  <h4 className="text-xs font-black text-purple-700 uppercase tracking-wider">Hành trình gốc</h4>
                  <div>
                    <div className="text-xs font-bold text-slate-800 line-clamp-2 uppercase" title={bulkBaseTour.name}>
                      {bulkBaseTour.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-semibold mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                      <span>{bulkBaseTour.duration}</span>
                      <span>•</span>
                      <span>Hotel: {bulkBaseTour.hotel}</span>
                      <span>•</span>
                      <span>{bulkBaseTour.airline}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-between text-xs">
                    <span className="text-slate-500 font-semibold">Mã gốc:</span>
                    <strong className="text-slate-800 font-mono">{bulkBaseTour.code}</strong>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-4">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Thêm ngày khởi hành mới</h4>
                  
                  {/* Select Custom Date using custom VietnameseDateTimePicker */}
                  <VietnameseDateTimePicker
                    label="Chọn Ngày khởi hành muốn tạo"
                    required
                    showTime={false}
                    value={bulkCustomDate}
                    onChange={setBulkCustomDate}
                    placeholder="Chọn ngày khởi hành..."
                  />

                  <button
                    type="button"
                    onClick={handleAddBulkDate}
                    className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-black transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Thêm ngày này vào danh sách
                  </button>
                </div>
              </div>

              {/* Right Column: Generated Dates Preview (7 cols) */}
              <div className="md:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[350px]">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider font-sans">Danh sách đoàn sắp khởi tạo</span>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded">
                    Tổng số: {bulkDatesList.length} ngày
                  </span>
                </div>

                <div className="overflow-y-auto divide-y divide-slate-100 flex-1 max-h-[320px]">
                  {bulkDatesList.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 text-xs px-6">
                      <p className="font-semibold">Chưa có ngày khởi hành nào được chọn.</p>
                      <p className="text-[11px] mt-1 text-slate-400">Vui lòng chọn ngày khởi hành ở cột bên trái và bấm thêm.</p>
                    </div>
                  ) : (
                    bulkDatesList.map((item, idx) => {
                      // Calculate return date preview
                      const baseDep = new Date(bulkBaseTour.departure_time);
                      const baseRet = new Date(bulkBaseTour.return_time);
                      const durationMs = baseRet.getTime() - baseDep.getTime();
                      const retDate = new Date(item.date.getTime() + durationMs);

                      // Format for preview code using the helper
                      const tourCodePreview = getFormattedCode(bulkBaseTour.code, item.date.toISOString());

                      // Day name translation to Vietnamese
                      const dayNamesMap = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
                      const vietnameseDayName = dayNamesMap[item.date.getDay()];

                      return (
                        <div key={idx} className={`p-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors ${!item.selected ? 'opacity-50' : ''}`}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                                {tourCodePreview}
                              </span>
                              <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">
                                {vietnameseDayName}
                              </span>
                            </div>
                            <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                              <span>Đi: <strong className="text-slate-800">{format(item.date, 'dd/MM/yyyy HH:mm')}</strong></span>
                              <span>→</span>
                              <span>Về: <strong className="text-slate-800">{format(retDate, 'dd/MM/yyyy HH:mm')}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(e) => {
                                const updated = [...bulkDatesList];
                                updated[idx].selected = e.target.checked;
                                setBulkDatesList(updated);
                              }}
                              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer animate-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setBulkDatesList(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Xóa ngày này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={bulkDatesList.filter(d => d.selected).length === 0}
                onClick={handleCreateBulkSeries}
                className="px-5 py-2 text-xs font-black text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm hover:shadow transition-all inline-flex items-center"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Xác nhận tạo {bulkDatesList.filter(d => d.selected).length} Tour khởi hành
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
