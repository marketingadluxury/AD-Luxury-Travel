import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  Users, 
  MapPin, 
  DollarSign, 
  Calendar, 
  Award, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  RefreshCw,
  Layers,
  Activity,
  CheckCircle,
  Briefcase,
  Building2
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { DatePicker } from '../components/DatePicker';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { motion } from 'motion/react';

// Định nghĩa màu sắc biểu đồ
const COLORS = {
  primary: '#2563eb', // Blue-600
  secondary: '#10b981', // Emerald-500
  warning: '#f59e0b', // Amber-500
  danger: '#ef4444', // Red-500
  purple: '#8b5cf6', // Purple-500
  cyan: '#06b6d4', // Cyan-500
};

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

// Dữ liệu mẫu lịch sử 6 tháng đầu năm 2026 để biểu đồ luôn sinh động
const HISTORIC_MONTHLY_DATA = [
  { month: '01/2026', revenue: 185000000, tours: 6, newCustomers: 22 },
  { month: '02/2026', revenue: 240000000, tours: 8, newCustomers: 31 },
  { month: '03/2026', revenue: 310000000, tours: 10, newCustomers: 38 },
  { month: '04/2026', revenue: 450000000, tours: 12, newCustomers: 49 },
  { month: '05/2026', revenue: 580000000, tours: 16, newCustomers: 65 },
  { month: '06/2026', revenue: 720000000, tours: 20, newCustomers: 82 },
];

// Hàm phụ trợ sinh các mốc ngày liên tục
function getDaysArray(start: Date, end: Date) {
  const arr = [];
  const dt = new Date(start);
  while (dt <= end) {
    arr.push(new Date(dt));
    dt.setDate(dt.getDate() + 1);
  }
  return arr;
}

function getMonthsArray(start: Date, end: Date) {
  const arr = [];
  const dt = new Date(start);
  dt.setDate(1);
  const endMonth = new Date(end);
  endMonth.setDate(1);
  while (dt <= endMonth) {
    arr.push(new Date(dt));
    dt.setMonth(dt.getMonth() + 1);
  }
  return arr;
}

export default function Dashboard() {
  const { tours, orders, passengers, currentRole } = useCRM();
  const [timeRange, setTimeRange] = useState<'6m' | '1y' | 'all' | 'custom' | 'calendar'>('6m');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedDestination, setSelectedDestination] = useState<string>('all');

  // Trích xuất danh sách Năm duy nhất để hiển thị ở bộ lọc
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    // Lấy từ dữ liệu lịch sử mặc định
    HISTORIC_MONTHLY_DATA.forEach(d => {
      years.add(d.month.split('/')[1]);
    });
    // Lấy từ database đơn hàng thực tế
    orders.forEach(order => {
      if (order.status === 'sure' || order.status === 'paid') {
        const dateStr = order.created_at || new Date().toISOString();
        const date = new Date(dateStr);
        years.add(String(date.getFullYear()));
      }
    });
    // Lấy từ tour thực tế
    tours.forEach(tour => {
      const departureDate = tour.start_date ? new Date(tour.start_date) : null;
      if (departureDate) {
        years.add(String(departureDate.getFullYear()));
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [orders, tours]);

  // 1. Xử lý và đồng bộ dữ liệu thực tế kết hợp dữ liệu lịch sử
  const processedData = useMemo(() => {
    // Nếu sử dụng lọc theo Lịch chọn ngày
    if (timeRange === 'calendar' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 45) {
        // --- PHÂN NHÓM THEO NGÀY ---
        const days = getDaysArray(start, end);
        const dailyMap: { [dayStr: string]: { revenue: number; tours: number; newCustomers: number } } = {};
        
        days.forEach(d => {
          const dayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
          dailyMap[dayStr] = { revenue: 0, tours: 0, newCustomers: 0 };
        });

        // 1. Phân bổ Doanh thu orders thực tế
        orders.forEach(order => {
          if (order.status === 'sure' || order.status === 'paid') {
            const dateStr = order.created_at || new Date().toISOString();
            const orderDate = new Date(dateStr);
            if (orderDate >= start && orderDate <= end) {
              const dayStr = `${String(orderDate.getDate()).padStart(2, '0')}/${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
              if (dailyMap[dayStr]) {
                dailyMap[dayStr].revenue += (order.total_price || 0);
              }
            }
          }
        });

        // 2. Phân bổ Tours khởi hành
        tours.forEach(tour => {
          const departureDate = tour.start_date ? new Date(tour.start_date) : null;
          if (departureDate && departureDate >= start && departureDate <= end) {
            const dayStr = `${String(departureDate.getDate()).padStart(2, '0')}/${String(departureDate.getMonth() + 1).padStart(2, '0')}`;
            if (dailyMap[dayStr]) {
              const endDate = tour.end_date ? new Date(tour.end_date) : null;
              if (endDate && endDate < new Date()) {
                dailyMap[dayStr].tours += 1;
              }
            }
          }
        });

        // 3. Phân bổ Khách hàng mới
        const processedPassengers = new Set<string>();
        passengers.forEach(p => {
          const name = (p.full_name || p.name || '').trim();
          const isPlaceholder = name === 'Chưa cung cấp (Giữ chỗ tạm)' ||
            name === 'Chưa cung cấp' ||
            name.startsWith('Người lớn #') ||
            name.startsWith('Trẻ em #');

          if (isPlaceholder) return;

          const order = orders.find(o => o.id === p.order_id);
          if (order && (order.status === 'sure' || order.status === 'paid')) {
            const dateStr = order.created_at || new Date().toISOString();
            const orderDate = new Date(dateStr);
            if (orderDate >= start && orderDate <= end) {
              const dayStr = `${String(orderDate.getDate()).padStart(2, '0')}/${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
              const uniqueKey = p.passport_number || `${name}-${p.dob || ''}`;
              if (!processedPassengers.has(uniqueKey)) {
                processedPassengers.add(uniqueKey);
                if (dailyMap[dayStr]) {
                  dailyMap[dayStr].newCustomers += 1;
                }
              }
            }
          }
        });

        return Object.entries(dailyMap).map(([dayLabel, data]) => ({
          month: dayLabel, // Giữ key 'month' để biểu đồ Recharts tương thích
          ...data
        }));
      } else {
        // --- PHÂN NHÓM THEO THÁNG ---
        const months = getMonthsArray(start, end);
        const monthlyMap: { [monthStr: string]: { revenue: number; tours: number; newCustomers: number } } = {};
        
        months.forEach(m => {
          const monthStr = `${String(m.getMonth() + 1).padStart(2, '0')}/${m.getFullYear()}`;
          monthlyMap[monthStr] = { revenue: 0, tours: 0, newCustomers: 0 };
          
          // Nạp dữ liệu lịch sử tương ứng nếu có trong khoảng chọn
          const hist = HISTORIC_MONTHLY_DATA.find(h => h.month === monthStr);
          if (hist) {
            monthlyMap[monthStr] = {
              revenue: hist.revenue,
              tours: hist.tours,
              newCustomers: hist.newCustomers
            };
          }
        });

        // 1. Doanh thu
        orders.forEach(order => {
          if (order.status === 'sure' || order.status === 'paid') {
            const dateStr = order.created_at || new Date().toISOString();
            const orderDate = new Date(dateStr);
            if (orderDate >= start && orderDate <= end) {
              const monthStr = `${String(orderDate.getMonth() + 1).padStart(2, '0')}/${orderDate.getFullYear()}`;
              if (monthlyMap[monthStr]) {
                monthlyMap[monthStr].revenue += (order.total_price || 0);
              }
            }
          }
        });

        // 2. Tours khởi hành
        tours.forEach(tour => {
          const departureDate = tour.start_date ? new Date(tour.start_date) : null;
          if (departureDate && departureDate >= start && departureDate <= end) {
            const monthStr = `${String(departureDate.getMonth() + 1).padStart(2, '0')}/${departureDate.getFullYear()}`;
            if (monthlyMap[monthStr]) {
              const endDate = tour.end_date ? new Date(tour.end_date) : null;
              if (endDate && endDate < new Date()) {
                monthlyMap[monthStr].tours += 1;
              }
            }
          }
        });

        // 3. Khách hàng mới
        const processedPassengers = new Set<string>();
        passengers.forEach(p => {
          const name = (p.full_name || p.name || '').trim();
          const isPlaceholder = name === 'Chưa cung cấp (Giữ chỗ tạm)' ||
            name === 'Chưa cung cấp' ||
            name.startsWith('Người lớn #') ||
            name.startsWith('Trẻ em #');

          if (isPlaceholder) return;

          const order = orders.find(o => o.id === p.order_id);
          if (order && (order.status === 'sure' || order.status === 'paid')) {
            const dateStr = order.created_at || new Date().toISOString();
            const orderDate = new Date(dateStr);
            if (orderDate >= start && orderDate <= end) {
              const monthStr = `${String(orderDate.getMonth() + 1).padStart(2, '0')}/${orderDate.getFullYear()}`;
              const uniqueKey = p.passport_number || `${name}-${p.dob || ''}`;
              if (!processedPassengers.has(uniqueKey)) {
                processedPassengers.add(uniqueKey);
                if (monthlyMap[monthStr]) {
                  monthlyMap[monthStr].newCustomers += 1;
                }
              }
            }
          }
        });

        return Object.entries(monthlyMap).map(([monthStr, data]) => ({
          month: monthStr,
          ...data
        }));
      }
    }

    // --- LOGIC PHÂN NHÓM MẶC ĐỊNH (KHI KHÔNG DÙNG CALENDAR) ---
    // Khởi tạo bản đồ tháng
    const monthlyMap: { [month: string]: { revenue: number; tours: number; newCustomers: number } } = {};
    
    // Nạp dữ liệu lịch sử trước
    HISTORIC_MONTHLY_DATA.forEach(d => {
      monthlyMap[d.month] = {
        revenue: d.revenue,
        tours: d.tours,
        newCustomers: d.newCustomers
      };
    });

    // Cộng thêm dữ liệu từ database hiện tại (orders)
    orders.forEach(order => {
      if (order.status === 'sure' || order.status === 'paid') {
        const dateStr = order.created_at || new Date().toISOString();
        const date = new Date(dateStr);
        const monthStr = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        
        if (!monthlyMap[monthStr]) {
          monthlyMap[monthStr] = { revenue: 0, tours: 0, newCustomers: 0 };
        }
        monthlyMap[monthStr].revenue += (order.total_price || 0);
      }
    });

    // Tính toán số lượng tour hoàn thành thực tế theo tháng khởi hành
    tours.forEach(tour => {
      const departureDate = tour.start_date ? new Date(tour.start_date) : null;
      if (departureDate) {
        const monthStr = `${String(departureDate.getMonth() + 1).padStart(2, '0')}/${departureDate.getFullYear()}`;
        
        if (!monthlyMap[monthStr]) {
          monthlyMap[monthStr] = { revenue: 0, tours: 0, newCustomers: 0 };
        }
        
        // Nếu ngày kết thúc đã qua thì coi là tour đã thực hiện
        const endDate = tour.end_date ? new Date(tour.end_date) : null;
        if (endDate && endDate < new Date()) {
          monthlyMap[monthStr].tours += 1;
        }
      }
    });

    // Tính toán số lượng khách hàng mới thực tế dựa trên ngày tạo booking của hành khách
    const processedPassengers = new Set<string>();
    passengers.forEach(p => {
      // Bỏ qua hành khách giữ chỗ tạm
      const name = (p.full_name || p.name || '').trim();
      const isPlaceholder = name === 'Chưa cung cấp (Giữ chỗ tạm)' ||
        name === 'Chưa cung cấp' ||
        name.startsWith('Người lớn #') ||
        name.startsWith('Trẻ em #');

      if (isPlaceholder) return;

      const order = orders.find(o => o.id === p.order_id);
      if (order && (order.status === 'sure' || order.status === 'paid')) {
        const dateStr = order.created_at || new Date().toISOString();
        const date = new Date(dateStr);
        const monthStr = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        
        // Đảm bảo không trùng lặp khách hàng (bằng số hộ chiếu hoặc tên+ngày sinh)
        const uniqueKey = p.passport_number || `${name}-${p.dob || ''}`;
        if (!processedPassengers.has(uniqueKey)) {
          processedPassengers.add(uniqueKey);
          if (!monthlyMap[monthStr]) {
            monthlyMap[monthStr] = { revenue: 0, tours: 0, newCustomers: 0 };
          }
          monthlyMap[monthStr].newCustomers += 1;
        }
      }
    });

    // Chuyển map thành mảng và sắp xếp theo thời gian tăng dần
    let sortedList = Object.entries(monthlyMap).map(([month, data]) => ({
      month,
      ...data
    })).sort((a, b) => {
      const [monthA, yearA] = a.month.split('/').map(Number);
      const [monthB, yearB] = b.month.split('/').map(Number);
      return yearA !== yearB ? yearA - yearB : monthA - monthB;
    });

    // Lọc theo khoảng thời gian được chọn
    if (timeRange === '6m') {
      sortedList = sortedList.slice(-6);
    } else if (timeRange === '1y') {
      sortedList = sortedList.slice(-12);
    } else if (timeRange === 'custom') {
      if (selectedYear !== 'all') {
        sortedList = sortedList.filter(item => {
          const [, yearStr] = item.month.split('/');
          return yearStr === selectedYear;
        });
      }
      if (selectedQuarter !== 'all') {
        sortedList = sortedList.filter(item => {
          const [monthStr] = item.month.split('/');
          const month = parseInt(monthStr, 10);
          if (selectedQuarter === 'q1') return month >= 1 && month <= 3;
          if (selectedQuarter === 'q2') return month >= 4 && month <= 6;
          if (selectedQuarter === 'q3') return month >= 7 && month <= 9;
          if (selectedQuarter === 'q4') return month >= 10 && month <= 12;
          return true;
        });
      }
    }
    return sortedList;
  }, [orders, tours, passengers, timeRange, selectedYear, selectedQuarter, startDate, endDate]);

  // 2. Tính toán các chỉ số KPI hàng đầu đồng bộ với khoảng thời gian đã lọc
  const kpiStats = useMemo(() => {
    // Tổng doanh thu thực tế từ mảng đã lọc
    const totalRevenue = processedData.reduce((sum, item) => sum + item.revenue, 0);

    // Tổng số tour đã thực hiện trong khoảng thời gian đã lọc
    const completedToursCount = processedData.reduce((sum, item) => sum + item.tours, 0);

    // Tổng số khách hàng mới trong khoảng thời gian đã lọc
    const totalCustomers = processedData.reduce((sum, item) => sum + item.newCustomers, 0);

    // Số tour sắp khởi hành (Upcoming)
    const upcomingToursCount = tours.filter(t => {
      const startDate = t.start_date ? new Date(t.start_date) : null;
      return startDate && startDate >= new Date();
    }).length;

    // Tỷ lệ lấp đầy ghế trung bình của các tour đang chạy
    const activeTours = tours.filter(t => t.total_seats > 0);
    const averageOccupancy = activeTours.length > 0
      ? Math.round((activeTours.reduce((sum, t) => sum + ((t.sold_seats || 0) / t.total_seats), 0) / activeTours.length) * 100)
      : 84;

    return {
      totalRevenue,
      completedToursCount,
      upcomingToursCount,
      totalCustomers,
      averageOccupancy
    };
  }, [processedData, tours]);

  // 3. Phân bổ điểm đến ưa thích nhất (Tour Destinations)
  const destinationData = useMemo(() => {
    const destMap: { [dest: string]: number } = {};
    tours.forEach(t => {
      const dest = t.destination || t.category || 'Khác';
      destMap[dest] = (destMap[dest] || 0) + (t.sold_seats || 0);
    });

    // Thêm một số điểm đến phổ biến làm dữ liệu mặc định nếu trống
    if (Object.keys(destMap).length === 0) {
      destMap['Thái Lan'] = 145;
      destMap['Lào'] = 86;
      destMap['Châu Âu'] = 48;
      destMap['Nhật Bản'] = 72;
      destMap['Hàn Quốc'] = 64;
    }

    return Object.entries(destMap).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [tours]);

  // Danh sách điểm đến độc nhất để lọc
  const destinationsList = useMemo(() => {
    const list = new Set<string>();
    tours.forEach(t => {
      if (t.destination) list.add(t.destination);
    });
    return Array.from(list);
  }, [tours]);

  // Định dạng hiển thị tiền tệ VND
  const formatVND = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Tiêu đề & Công cụ điều khiển */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              Bảng điều khiển & Thống kê CRM
            </h2>
            {currentRole === 'admin' && (
              <Link 
                to="/dashboard/executive" 
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-2xs"
              >
                <Building2 className="w-3.5 h-3.5" />
                Bảng Điều Hành Chiến Lược
              </Link>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Hệ thống phân tích doanh số, số lượng tour hoàn thành và lưu lượng khách hàng theo thời gian thực.
          </p>
        </div>
        
        {/* Bộ lọc thời gian & điểm đến */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => {
                setTimeRange('6m');
                setSelectedYear('all');
                setSelectedQuarter('all');
                setStartDate('');
                setEndDate('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeRange === '6m' 
                  ? 'bg-white text-blue-700 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              6 Tháng qua
            </button>
            <button
              onClick={() => {
                setTimeRange('1y');
                setSelectedYear('all');
                setSelectedQuarter('all');
                setStartDate('');
                setEndDate('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeRange === '1y' 
                  ? 'bg-white text-blue-700 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              1 Năm qua
            </button>
            <button
              onClick={() => {
                setTimeRange('all');
                setSelectedYear('all');
                setSelectedQuarter('all');
                setStartDate('');
                setEndDate('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeRange === 'all' 
                  ? 'bg-white text-blue-700 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => {
                setTimeRange('calendar');
                if (!startDate) setStartDate('2026-01-01');
                if (!endDate) setEndDate('2026-12-31');
                setSelectedYear('all');
                setSelectedQuarter('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeRange === 'calendar' 
                  ? 'bg-white text-blue-700 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dạng lịch
            </button>
            {(selectedYear !== 'all' || selectedQuarter !== 'all' || timeRange === 'calendar') && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-[10px] font-black uppercase tracking-wider animate-pulse">
                Bộ lọc tùy chỉnh
              </span>
            )}
          </div>

          {/* Bộ lọc Lịch chọn ngày */}
          {timeRange === 'calendar' && (
            <div className="flex items-center gap-2 bg-blue-50/80 p-1.5 rounded-xl border border-blue-200 animate-fadeIn">
              <Calendar className="w-4 h-4 text-blue-600 ml-1 shrink-0" />
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                <span className="text-blue-700/70 shrink-0">Từ</span>
                <div className="w-32 shrink-0">
                  <DatePicker
                    value={startDate}
                    onChange={(val) => {
                      setStartDate(val);
                      setTimeRange('calendar');
                    }}
                    placeholder="Chọn ngày bắt đầu"
                  />
                </div>
                <span className="text-blue-700/70 shrink-0">đến</span>
                <div className="w-32 shrink-0">
                  <DatePicker
                    value={endDate}
                    onChange={(val) => {
                      setEndDate(val);
                      setTimeRange('calendar');
                    }}
                    placeholder="Chọn ngày kết thúc"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bộ lọc Năm */}
          {timeRange !== 'calendar' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-500">Năm:</span>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setTimeRange('custom');
                  setSelectedYear(e.target.value);
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-bold bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tất cả năm</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>Năm {yr}</option>
                ))}
              </select>
            </div>
          )}

          {/* Bộ lọc Quý */}
          {timeRange !== 'calendar' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-500">Quý:</span>
              <select
                value={selectedQuarter}
                onChange={(e) => {
                  setTimeRange('custom');
                  setSelectedQuarter(e.target.value);
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-bold bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tất cả quý</option>
                <option value="q1">Quý 1 (Tháng 1-3)</option>
                <option value="q2">Quý 2 (Tháng 4-6)</option>
                <option value="q3">Quý 3 (Tháng 7-9)</option>
                <option value="q4">Quý 4 (Tháng 10-12)</option>
              </select>
            </div>
          )}

          {destinationsList.length > 0 && (
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={selectedDestination}
                onChange={(e) => setSelectedDestination(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-bold bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tất cả điểm đến</option>
                {destinationsList.map(dest => (
                  <option key={dest} value={dest}>{dest}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Grid KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Doanh thu lũy kế */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-4 hover:shadow-md transition-all group"
        >
          <div className="flex items-start justify-between gap-4 w-full">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">Tổng doanh thu lữ hành</span>
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 group-hover:text-blue-600 transition-colors break-words">
              {formatVND(kpiStats.totalRevenue)}
            </h3>
            <div className="flex items-center gap-1 text-xs font-bold text-green-600">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+18.4% so với năm trước</span>
            </div>
          </div>
        </motion.div>

        {/* Số Tour hoàn thành */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-4 hover:shadow-md transition-all group"
        >
          <div className="flex items-start justify-between gap-4 w-full">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">Tour đã khởi hành</span>
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 group-hover:text-emerald-600 transition-colors break-words">
              {kpiStats.completedToursCount} <span className="text-sm font-medium text-gray-500">tours</span>
            </h3>
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{kpiStats.upcomingToursCount} tour sắp tới</span>
            </div>
          </div>
        </motion.div>

        {/* Số Khách hàng duy nhất */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-4 hover:shadow-md transition-all group"
        >
          <div className="flex items-start justify-between gap-4 w-full">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">Hồ sơ khách hàng</span>
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all duration-300 shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 group-hover:text-amber-600 transition-colors break-words">
              {kpiStats.totalCustomers} <span className="text-sm font-medium text-gray-500">thành viên</span>
            </h3>
            <div className="flex items-center gap-1 text-xs font-bold text-amber-600">
              <Award className="w-3.5 h-3.5" />
              <span>Đại lý & CTV đóng góp 65%</span>
            </div>
          </div>
        </motion.div>

        {/* Tỷ lệ lấp đầy ghế */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-4 hover:shadow-md transition-all group"
        >
          <div className="flex items-start justify-between gap-4 w-full">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">Hiệu suất lấp đầy ghế</span>
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 group-hover:text-emerald-600 transition-colors break-words">
              {kpiStats.averageOccupancy}%
            </h3>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${kpiStats.averageOccupancy}%` }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Biểu đồ 1: Doanh thu theo tháng */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-extrabold text-gray-900">Biểu đồ Doanh thu</h3>
              <p className="text-xs text-gray-500 mt-0.5">Biểu đồ vùng biểu diễn sự tăng trưởng doanh thu theo từng tháng</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-50 text-blue-700">VND</span>
          </div>
          
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={processedData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                />
                <YAxis 
                  tickFormatter={(v) => `${(v / 1000000).toFixed(0)}tr`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                />
                <Tooltip 
                  formatter={(v: any) => [formatVND(v), 'Doanh thu']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke={COLORS.primary} 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Biểu đồ tròn: Thị phần Điểm đến */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-lg font-extrabold text-gray-900">Điểm đến ưa thích</h3>
            <p className="text-xs text-gray-500 mt-0.5">Tỷ lệ số ghế đã bán theo từng quốc gia/khu vực du lịch</p>
          </div>

          <div className="h-56 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={destinationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {destinationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} ghế đã đặt`, 'Số lượng']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <span className="text-xs text-gray-400 font-bold uppercase block">Đã đặt chỗ</span>
              <span className="text-2xl font-black text-gray-800">
                {destinationData.reduce((sum, d) => sum + d.value, 0)}
              </span>
            </div>
          </div>

          {/* Chú thích màu sắc */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {destinationData.map((entry, index) => (
              <div key={entry.name} className="flex items-center space-x-1.5 font-semibold text-gray-600">
                <span 
                  className="w-3 h-3 rounded-full shrink-0" 
                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} 
                />
                <span className="truncate">{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Biểu đồ 2: Số lượng Tour đã thực hiện */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-lg font-extrabold text-gray-900">Tần suất Khởi hành</h3>
            <p className="text-xs text-gray-500 mt-0.5">Số lượng tour đã hoàn thành tốt đẹp theo từng tháng</p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={processedData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                />
                <YAxis 
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                  allowDecimals={false}
                />
                <Tooltip 
                  formatter={(v: any) => [`${v} tours`, 'Số lượng tour']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}
                />
                <Bar 
                  dataKey="tours" 
                  fill={COLORS.secondary} 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Biểu đồ 3: Số khách hàng mới */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-lg font-extrabold text-gray-900">Tăng trưởng Khách hàng</h3>
            <p className="text-xs text-gray-500 mt-0.5">Số lượng hồ sơ thành viên mới đăng ký và đi tour thành công</p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={processedData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                />
                <YAxis 
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                  allowDecimals={false}
                />
                <Tooltip 
                  formatter={(v: any) => [`+${v} khách hàng`, 'Khách hàng mới']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="newCustomers" 
                  stroke={COLORS.warning} 
                  strokeWidth={3} 
                  dot={{ r: 5, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tab Phân tích nâng cao theo vai trò */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <h3 className="text-md font-extrabold text-gray-900 mb-4 flex items-center gap-1.5">
          <Briefcase className="w-5 h-5 text-blue-600" />
          Gợi ý Chiến lược Hành động (Dành cho {currentRole === 'admin' ? 'Quản trị viên' : currentRole})
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-gray-600 font-semibold leading-relaxed">
          <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
            <h4 className="font-bold text-blue-800 text-sm">🎯 Đẩy mạnh Tiếp thị Đông Nam Á</h4>
            <p>
              Số liệu đặt chỗ chỉ ra Thái Lan và Lào tiếp tục dẫn đầu về lượng chỗ được lấp đầy. Bạn nên lập kế hoạch chạy các chiến dịch giảm giá giờ chót cho các nhóm tour khởi hành tiếp theo.
            </p>
          </div>
          
          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-2">
            <h4 className="font-bold text-emerald-800 text-sm">📈 Nâng cấp Đại lý & Cộng tác viên</h4>
            <p>
              Khách hàng mới tăng trưởng đều đặn qua từng tháng nhờ vào mạng lưới đại lý. Hãy cập nhật chính sách ưu đãi hoa hồng trong Cài đặt để khuyến khích họ đẩy mạnh doanh số.
            </p>
          </div>

          <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100 space-y-2">
            <h4 className="font-bold text-purple-800 text-sm">🛂 Quản trị Tiến trình Hồ sơ Visa</h4>
            <p>
              Đối với các tour Châu Âu sắp tới, hãy theo dõi sát sao thời hạn nộp hồ sơ visa trên trang Xử lý Visa để tránh tình trạng trễ hẹn của các khách hàng mới.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
