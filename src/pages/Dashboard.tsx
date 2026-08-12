import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Award,
  Filter,
  Layers,
  Activity,
  CheckCircle,
  Briefcase,
  Building2,
  Clock,
  AlertTriangle,
  ChevronRight,
  UserCheck,
  Percent,
  ShieldAlert,
  ArrowUpRight,
  UserPlus,
  PieChart as PieChartIcon,
  BarChart3,
  FileText,
  Target,
  Table,
  LineChart as LineChartIcon
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { DatePicker } from '../components/DatePicker';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { motion } from 'motion/react';
import { Order, Tour, Profile, Role, TeamPerformanceSummary, SalePerformanceSummary } from '../types';

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

// Hàm format tiền VNĐ
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
};

// Hàm format ngày hh:mm dd/mm/yyyy
const formatDateTimeStr = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
};

export default function Dashboard() {
  const { tours, orders, passengers, currentRole, displayRole, profilesList } = useCRM();
  const { user, profile } = useAuth();

  // Xác định vai trò hiển thị hiệu lực
  const effectiveRole: Role = displayRole || currentRole || profile?.role || 'sale';

  // State bộ lọc thời gian & chế độ hiển thị báo cáo (Table, Bar, Line, Pie)
  const [timeRange, setTimeRange] = useState<'month' | '6m' | '1y' | 'all' | 'calendar'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');

  const [teamViewMode, setTeamViewMode] = useState<'table' | 'bar' | 'line' | 'pie'>('table');
  const [saleViewMode, setSaleViewMode] = useState<'table' | 'bar' | 'line' | 'pie'>('table');
  const [leaderboardViewMode, setLeaderboardViewMode] = useState<'table' | 'bar' | 'line' | 'pie'>('table');

  // Tải danh sách Teams động từ API backend / Supabase
  const [fetchedTeams, setFetchedTeams] = useState<any[]>([]);

  React.useEffect(() => {
    let isMounted = true;
    fetch('/api/admin/teams')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setFetchedTeams(data);
        }
      })
      .catch(err => console.warn('Lỗi khi tải danh sách teams:', err));
    return () => { isMounted = false; };
  }, []);

  const defaultTeams = useMemo(() => [
    { id: 'team-1', name: 'Team Đông Nam Á', leader_name: 'Trần Văn Trưởng (Leader)', kpi_target: 800000000 },
    { id: 'team-2', name: 'Team Châu Âu & Mỹ', leader_name: 'Nguyễn Thị Hương (Leader)', kpi_target: 1200000000 },
    { id: 'team-3', name: 'Team Nội Địa & Khác', leader_name: 'Lê Minh Tuấn (Leader)', kpi_target: 500000000 }
  ], []);

  const activeTeams = useMemo(() => {
    return fetchedTeams.length > 0 ? fetchedTeams : defaultTeams;
  }, [fetchedTeams, defaultTeams]);

  // Lọc đơn hàng theo thời gian được chọn
  const filteredOrders = useMemo(() => {
    const now = new Date();
    return orders.filter(order => {
      if (order.status === 'cancelled') return false;
      const orderDate = order.created_at ? new Date(order.created_at) : new Date();
      
      if (timeRange === 'month') {
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      }
      if (timeRange === '6m') {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        return orderDate >= sixMonthsAgo;
      }
      if (timeRange === '1y') {
        return orderDate.getFullYear() === now.getFullYear();
      }
      if (timeRange === 'calendar' && startDate && endDate) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        return orderDate >= s && orderDate <= e;
      }
      return true; // 'all'
    });
  }, [orders, timeRange, startDate, endDate]);

  // Lấy danh sách Sale profiles từ profilesList
  const salesProfiles = useMemo(() => {
    return profilesList.filter(p => p.role === 'sale' || p.role === 'sale_leader');
  }, [profilesList]);

  // =========================================================================
  // LOGIC DÀNH CHO NHÂN VIÊN SALE CÔNG TY (role === 'sale')
  // =========================================================================
  const salePersonalData = useMemo(() => {
    const currentUserName = profile?.full_name || user?.email || 'Sale';
    const currentUserId = user?.id || '';

    // Đơn hàng cá nhân
    const myOrders = filteredOrders.filter(o => 
      o.created_by === currentUserName || 
      o.user_id === currentUserId || 
      o.salesperson_id === currentUserId
    );

    // Đơn đã chốt / thanh toán
    const confirmedOrders = myOrders.filter(o => o.status === 'sure' || o.status === 'paid');
    
    // Doanh số chốt tháng (VNĐ)
    const totalRevenue = confirmedOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);

    // KPI chỉ tiêu cá nhân tháng (Mặc định 200,000,000 VNĐ)
    const kpiTarget = 200000000;
    const kpiProgress = Math.min(Math.round((totalRevenue / kpiTarget) * 100), 100);

    // Tổng số lượt khách đã chốt (Pax)
    const totalPax = confirmedOrders.reduce((sum, o) => {
      const p = (o.adult_count || 0) + (o.child_count || 0) + (o.infant_count || 0);
      return sum + (p > 0 ? p : 1);
    }, 0);

    // Đặt chỗ giữ chỗ sắp hết hạn (Hold Expiring)
    const holdOrders = myOrders.filter(o => o.status === 'hold');
    const holdExpiringSoon = holdOrders.filter(o => {
      if (!o.hold_expiry) return true;
      const expiry = new Date(o.hold_expiry);
      const diffHours = (expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60);
      return diffHours <= 24; // Hết hạn trong 24h
    });

    // Đơn hàng Sale hỗ trợ nhập hộ cho CTV / Đại lý
    const assistedOrders = myOrders.filter(o => 
      Boolean(o.ctv_info) || o.seller_type === 'agent' || (o.price_markup && o.price_markup > 0)
    );

    return {
      myOrders,
      confirmedOrders,
      totalRevenue,
      kpiTarget,
      kpiProgress,
      totalPax,
      holdOrders,
      holdExpiringSoon,
      assistedOrders
    };
  }, [filteredOrders, profile, user]);

  // =========================================================================
  // LOGIC DÀNH CHO TRƯỞNG NHÓM SALE (role === 'sale_leader')
  // =========================================================================
  const leaderTeamData = useMemo(() => {
    const currentUserId = user?.id || '';
    
    // Danh sách nhân viên thuộc nhóm do Leader này quản lý
    const teamMembers = salesProfiles.filter(p => p.leader_id === currentUserId || p.id === currentUserId);
    const teamMemberIds = new Set(teamMembers.map(m => m.id));
    const teamMemberNames = new Set(teamMembers.map(m => m.full_name));

    // Đơn hàng thuộc team
    const teamOrders = filteredOrders.filter(o => 
      teamMemberIds.has(o.user_id || '') || 
      teamMemberIds.has(o.salesperson_id || '') || 
      teamMemberNames.has(o.created_by || '')
    );

    const confirmedTeamOrders = teamOrders.filter(o => o.status === 'sure' || o.status === 'paid');

    // Tổng doanh số nhóm
    const totalRevenue = confirmedTeamOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);

    // Chỉ tiêu KPI nhóm (Mặc định 1,000,000,000 VNĐ)
    const teamKpiTarget = 1000000000;
    const teamKpiProgress = Math.min(Math.round((totalRevenue / teamKpiTarget) * 100), 100);

    // Tổng Pax của nhóm
    const totalPax = confirmedTeamOrders.reduce((sum, o) => {
      const p = (o.adult_count || 0) + (o.child_count || 0) + (o.infant_count || 0);
      return sum + (p > 0 ? p : 1);
    }, 0);

    // Đặt chỗ giữ chỗ/Hạn cọc của nhóm
    const holdTeamOrders = teamOrders.filter(o => o.status === 'hold');

    // Leaderboard từng Sale trong team
    const teamMemberStats = teamMembers.map(member => {
      const memberOrders = confirmedTeamOrders.filter(o => 
        o.user_id === member.id || o.salesperson_id === member.id || o.created_by === member.full_name
      );
      const rev = memberOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
      const pax = memberOrders.reduce((sum, o) => {
        const p = (o.adult_count || 0) + (o.child_count || 0) + (o.infant_count || 0);
        return sum + (p > 0 ? p : 1);
      }, 0);

      return {
        id: member.id,
        name: member.full_name || 'Nhân viên Sale',
        role: member.role,
        totalOrders: memberOrders.length,
        pax,
        revenue: rev,
        contributionPercent: totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // Bảng hạch toán Lãi/Lỗ dành cho Tour Gửi Đối tác (outsourced/partner) và Đoàn Riêng (private)
    const allowedTours = tours.filter(t => t.tour_type === 'outsourced' || t.tour_type === 'partner' || t.tour_type === 'private');
    const tourFinancials = allowedTours.map(t => {
      const tourOrders = confirmedTeamOrders.filter(o => o.tour_id === t.id);
      const rev = tourOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
      
      // Ước tính chi phí tour
      const estCost = (t.partner_net_cost ? t.partner_net_cost * t.sold_seats : 0) || Math.round(rev * 0.82);
      const profit = rev - estCost;
      const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;

      return {
        id: t.id,
        code: t.code,
        name: t.name,
        tour_type: t.tour_type,
        partner: t.partner_name || t.organization_name || 'Đối tác',
        sold_seats: t.sold_seats,
        revenue: rev,
        cost: estCost,
        profit,
        margin
      };
    });

    return {
      teamMembers,
      teamOrders,
      confirmedTeamOrders,
      totalRevenue,
      teamKpiTarget,
      teamKpiProgress,
      totalPax,
      holdTeamOrders,
      teamMemberStats,
      tourFinancials
    };
  }, [filteredOrders, salesProfiles, tours, user]);

  // =========================================================================
  // LOGIC DÀNH CHO GIÁM ĐỐC / BOD / ADMIN (role === 'admin' | 'bod')
  // =========================================================================
  const executiveData = useMemo(() => {
    const confirmedOrders = filteredOrders.filter(o => o.status === 'sure' || o.status === 'paid');

    // 1. Tổng doanh thu toàn công ty
    const totalRevenue = confirmedOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);

    // 2. Tổng chi phí tour ước tính (Giá vốn tour + Phí hoa hồng chi trả)
    const totalTourCosts = tours.reduce((sum, t) => {
      const netCost = (t.partner_net_cost ? t.partner_net_cost * t.sold_seats : 0) || Math.round((t.price * t.sold_seats) * 0.8);
      return sum + netCost;
    }, 0);

    // Tổng hoa hồng chi trả CTV/Đại lý từ các đơn hàng
    const totalCommissions = confirmedOrders.reduce((sum, o) => {
      return sum + (o.agent_commission_amount || o.net_commission_amount || 0);
    }, 0);

    // Lãi gộp & Lợi nhuận ròng toàn công ty
    const grossProfit = Math.max(0, totalRevenue - totalTourCosts);
    const netProfit = Math.max(0, grossProfit - totalCommissions);
    const netMarginPercent = totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;

    // Tổng lượt khách (Pax)
    const totalPax = confirmedOrders.reduce((sum, o) => {
      const p = (o.adult_count || 0) + (o.child_count || 0) + (o.infant_count || 0);
      return sum + (p > 0 ? p : 1);
    }, 0);

    // 3. Phân tích cơ cấu doanh thu theo Kênh Bán (Direct, Net Agent, Markup CTV)
    let directRevenue = 0;
    let netAgentRevenue = 0;
    let markupCtvRevenue = 0;

    confirmedOrders.forEach(o => {
      if (o.ctv_info || (o.price_markup && o.price_markup > 0)) {
        markupCtvRevenue += (o.total_price || 0);
      } else if (o.seller_type === 'agent') {
        netAgentRevenue += (o.total_price || 0);
      } else {
        directRevenue += (o.total_price || 0);
      }
    });

    const channelData = [
      { name: 'Khách lẻ Trực tiếp', value: directRevenue || 1 },
      { name: 'Đại lý (Giá Nét)', value: netAgentRevenue || 0 },
      { name: 'CTV (Bán Chênh Giá)', value: markupCtvRevenue || 0 }
    ].filter(item => item.value > 0);

    // 4. Phân tích Tỷ trọng Lợi nhuận theo Loại Tour (AD Tự vận hành vs Tour Gửi Đối tác / Đoàn riêng)
    let internalRevenue = 0;
    let outsourcedRevenue = 0;

    tours.forEach(t => {
      const tourOrders = confirmedOrders.filter(o => o.tour_id === t.id);
      const rev = tourOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
      if (t.tour_type === 'internal') {
        internalRevenue += rev;
      } else {
        outsourcedRevenue += rev;
      }
    });

    const productTypeData = [
      { name: 'AD Tự Vận Hành', revenue: internalRevenue, profit: Math.round(internalRevenue * 0.18) },
      { name: 'Gửi Đối Tác & Đoàn Riêng', revenue: outsourcedRevenue, profit: Math.round(outsourcedRevenue * 0.12) }
    ];

    // 5. Khối Báo cáo Hiệu Quả Kinh Doanh Theo Team (Team Performance Summary)
    const teamsMap: { [teamKey: string]: TeamPerformanceSummary } = {};

    activeTeams.forEach(t => {
      teamsMap[t.id] = {
        team_id: t.id,
        team_name: t.name,
        leader_name: t.leader_name || 'Chưa phân công',
        pax_count: 0,
        total_orders: 0,
        revenue: 0,
        net_profit: 0,
        kpi_target: t.kpi_target || 800000000,
        kpi_percentage: 0
      };
    });

    // Phân bổ dữ liệu đơn hàng vào từng Team
    confirmedOrders.forEach(o => {
      const creatorName = o.created_by || 'Sale';
      const orderPax = (o.adult_count || 0) + (o.child_count || 0) + (o.infant_count || 0) || 1;
      const orderRev = o.total_price || 0;
      const orderProfit = Math.round(orderRev * 0.15);

      // Tìm profile người tạo đơn trong profilesList
      const creatorProfile = profilesList.find(p => p.full_name?.toLowerCase() === creatorName.toLowerCase() || p.email?.toLowerCase() === creatorName.toLowerCase() || p.id === o.created_by);

      let targetTeamKey: string | null = null;

      if (creatorProfile?.team_id && teamsMap[creatorProfile.team_id]) {
        targetTeamKey = creatorProfile.team_id;
      } else if (creatorProfile?.team_name) {
        const found = Object.values(teamsMap).find(tm => tm.team_name.toLowerCase() === creatorProfile.team_name?.toLowerCase());
        if (found) targetTeamKey = found.team_id;
      }

      // Nếu chưa tìm thấy theo team_id, dùng phỏng đoán theo tên/lead
      if (!targetTeamKey) {
        const teamKeys = Object.keys(teamsMap);
        if (teamKeys.length > 0) {
          if (creatorName.toLowerCase().includes('hương') || creatorName.toLowerCase().includes('đông')) {
            targetTeamKey = teamKeys[1] || teamKeys[0];
          } else if (creatorName.toLowerCase().includes('tuấn') || creatorName.toLowerCase().includes('nam')) {
            targetTeamKey = teamKeys[2] || teamKeys[0];
          } else {
            targetTeamKey = teamKeys[0];
          }
        }
      }

      if (targetTeamKey && teamsMap[targetTeamKey]) {
        teamsMap[targetTeamKey].pax_count += orderPax;
        teamsMap[targetTeamKey].total_orders += 1;
        teamsMap[targetTeamKey].revenue += orderRev;
        teamsMap[targetTeamKey].net_profit += orderProfit;
      }
    });

    const teamPerformanceList = Object.values(teamsMap).map(t => ({
      ...t,
      kpi_percentage: Math.min(Math.round((t.revenue / (t.kpi_target || 1)) * 100), 100)
    }));

    // 6. Khối Báo cáo Hiệu Quả Theo Nhân Viên Sale (Sale Performance Breakdown)
    const saleMap: { [saleName: string]: SalePerformanceSummary } = {};

    salesProfiles.forEach(sp => {
      saleMap[sp.full_name] = {
        sale_id: sp.id,
        sale_name: sp.full_name,
        team_name: sp.team_name || 'Team Sale',
        total_orders: 0,
        pax_count: 0,
        revenue: 0,
        net_profit: 0,
        direct_orders_count: 0,
        assisted_ctv_orders_count: 0,
        kpi_target: 200000000,
        kpi_percentage: 0
      };
    });

    // Thêm các creator từ orders nếu chưa có trong profiles
    confirmedOrders.forEach(o => {
      const name = o.created_by || 'Khác';
      if (!saleMap[name]) {
        saleMap[name] = {
          sale_id: name,
          sale_name: name,
          team_name: 'Kinh Doanh',
          total_orders: 0,
          pax_count: 0,
          revenue: 0,
          net_profit: 0,
          direct_orders_count: 0,
          assisted_ctv_orders_count: 0,
          kpi_target: 200000000,
          kpi_percentage: 0
        };
      }

      const p = (o.adult_count || 0) + (o.child_count || 0) + (o.infant_count || 0) || 1;
      const rev = o.total_price || 0;
      const profit = Math.round(rev * 0.15);

      saleMap[name].total_orders += 1;
      saleMap[name].pax_count += p;
      saleMap[name].revenue += rev;
      saleMap[name].net_profit += profit;

      if (o.ctv_info || o.seller_type === 'agent' || (o.price_markup && o.price_markup > 0)) {
        saleMap[name].assisted_ctv_orders_count += 1;
      } else {
        saleMap[name].direct_orders_count += 1;
      }
    });

    const salePerformanceList = Object.values(saleMap)
      .map(s => ({
        ...s,
        kpi_percentage: Math.min(Math.round((s.revenue / (s.kpi_target || 200000000)) * 100), 100)
      }))
      .filter(s => s.revenue > 0 || s.total_orders > 0)
      .sort((a, b) => b.revenue - a.revenue);

    return {
      totalRevenue,
      totalTourCosts,
      totalCommissions,
      grossProfit,
      netProfit,
      netMarginPercent,
      totalPax,
      channelData,
      productTypeData,
      teamPerformanceList,
      salePerformanceList
    };
  }, [filteredOrders, tours, salesProfiles, activeTeams]);

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER KHU VỰC ĐIỀU HÀNH THÔNG MINH */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-blue-900/50">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded-full border border-blue-400/30 backdrop-blur-sm flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                {effectiveRole === 'sale' && '🏢 Bảng Điều Khiển Sale Công Ty'}
                {effectiveRole === 'sale_leader' && '👔 Bảng Điều Hành Trưởng Nhóm Sale'}
                {(effectiveRole === 'admin' || effectiveRole === 'bod') && '👑 Trung Tâm Điều Hành Chiến Lược (BOD)'}
                {!['sale', 'sale_leader', 'admin', 'bod'].includes(effectiveRole) && '📊 Bảng Điều Khiển Vận Hành'}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Cập nhật: {formatDateTimeStr(new Date().toISOString())}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Xin chào, {profile?.full_name || user?.email || 'Quản trị viên'} 👋
            </h1>
            <p className="text-sm text-slate-300 mt-1 font-medium">
              {effectiveRole === 'sale' && 'Theo dõi doanh số chốt, tiến độ KPI cá nhân và cảnh báo đơn hàng cần xử lý.'}
              {effectiveRole === 'sale_leader' && 'Quản lý hiệu quả kinh doanh của nhóm, xếp hạng nhân viên và hạch toán tour.'}
              {(effectiveRole === 'admin' || effectiveRole === 'bod') && 'Báo cáo toàn diện doanh thu, lợi nhuận ròng, kênh bán và hiệu suất theo từng Team.'}
            </p>
          </div>

          {/* BỘ LỌC THỜI GIAN ĐA NĂNG */}
          <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/15 flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-blue-300 ml-1" />
            <div className="flex bg-slate-900/60 p-1 rounded-lg border border-white/10 text-xs font-semibold">
              <button
                onClick={() => setTimeRange('month')}
                className={`px-3 py-1.5 rounded-md transition-all ${timeRange === 'month' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
              >
                Tháng này
              </button>
              <button
                onClick={() => setTimeRange('6m')}
                className={`px-3 py-1.5 rounded-md transition-all ${timeRange === '6m' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
              >
                6 Tháng
              </button>
              <button
                onClick={() => setTimeRange('1y')}
                className={`px-3 py-1.5 rounded-md transition-all ${timeRange === '1y' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
              >
                Năm nay
              </button>
              <button
                onClick={() => setTimeRange('all')}
                className={`px-3 py-1.5 rounded-md transition-all ${timeRange === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
              >
                Tất cả
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. GIAO DIỆN DÀNH CHO NHÂN VIÊN SALE CÔNG TY (role === 'sale') */}
      {/* ========================================================================= */}
      {effectiveRole === 'sale' && (
        <div className="space-y-6">
          {/* 4 STAT CARDS CHO SALE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Doanh số chốt tháng */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Doanh Số Chốt Tháng</span>
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {formatCurrency(salePersonalData.totalRevenue)}
              </div>
              <div className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                {salePersonalData.confirmedOrders.length} Đơn hàng đã chốt
              </div>
            </div>

            {/* Card 2: Tiến độ KPI tháng */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tiến Độ KPI Tháng</span>
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Target className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-2xl font-black text-slate-900">{salePersonalData.kpiProgress}%</span>
                <span className="text-xs text-slate-500 font-medium">Chỉ tiêu: 200 Tr</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${salePersonalData.kpiProgress}%` }}
                ></div>
              </div>
            </div>

            {/* Card 3: Số lượt khách chốt (Pax) */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Số Lượt Khách Chốt</span>
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {salePersonalData.totalPax} <span className="text-sm font-normal text-slate-500">Pax</span>
              </div>
              <div className="text-xs text-indigo-600 font-bold">
                Khách tham gia các tour chốt
              </div>
            </div>

            {/* Card 4: Đặt chỗ sắp hết hạn */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Giữ Chỗ Sắp Hết Hạn</span>
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-600 mb-1">
                {salePersonalData.holdExpiringSoon.length} <span className="text-sm font-normal text-slate-500">đơn</span>
              </div>
              <div className="text-xs text-amber-700 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Cần thúc cọc / hủy khẩn cấp
              </div>
            </div>
          </div>

          {/* BẢNG 1: CẢNH BÁO ĐẶT CHỖ & ĐƠN HÀNG CÁ NHÂN */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Danh Sách Đặt Chỗ (Hold) & Cảnh Báo Hạn Cọc Cá Nhân
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Tự động theo dõi thời gian giữ chỗ để nhắc khách chuyển cọc kịp thời.
                </p>
              </div>
              <Link to="/orders" className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1">
                Quản lý tất cả đơn <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Mã đơn / Khách hàng</th>
                    <th className="px-4 py-3">Mã Tour</th>
                    <th className="px-4 py-3">Số khách</th>
                    <th className="px-4 py-3">Tổng tiền</th>
                    <th className="px-4 py-3">Hạn Giữ Chỗ (Hold)</th>
                    <th className="px-4 py-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {salePersonalData.holdOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-medium">
                        Bạn hiện không có đơn hàng giữ chỗ nào cần xử lý.
                      </td>
                    </tr>
                  ) : (
                    salePersonalData.holdOrders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{o.customer_name || o.booker_name || 'Khách lẻ'}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{o.id.slice(0, 8)}</div>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">
                          {o.tour_id}
                        </td>
                        <td className="px-4 py-3">
                          {(o.adult_count || 0) + (o.child_count || 0)} Pax
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {formatCurrency(o.total_price)}
                        </td>
                        <td className="px-4 py-3 font-mono text-amber-600 font-bold">
                          {formatDateTimeStr(o.hold_expiry)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-bold rounded-md border border-amber-200">
                            ⏳ Giữ chỗ (Hold)
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* BẢNG 2: ĐƠN SALE HỖ TRỢ NHẬP HỘ CHO CTV / ĐẠI LÝ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Thống Kê Đơn Hàng Hỗ Trợ Nhập Hộ Cho CTV & Đại Lý Ngoài
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Các đơn hàng do bạn đứng ra tạo giúp CTV / Đại lý ngoài để theo dõi doanh số và phí công ty thu.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Tên CTV / Đại Lý</th>
                    <th className="px-4 py-3">Tên Khách Hàng</th>
                    <th className="px-4 py-3">Mã Tour</th>
                    <th className="px-4 py-3">Doanh Số Đơn</th>
                    <th className="px-4 py-3">Tiền Chênh Giá / Hoa Hồng</th>
                    <th className="px-4 py-3">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {salePersonalData.assistedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-medium">
                        Chưa có đơn hàng hỗ trợ nhập hộ nào.
                      </td>
                    </tr>
                  ) : (
                    salePersonalData.assistedOrders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-indigo-950">
                          {o.ctv_info || (o.seller_type === 'agent' ? 'Đại Lý Đối Tác' : 'CTV Ngoài')}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {o.customer_name || 'Khách hàng'}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">
                          {o.tour_id}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {formatCurrency(o.total_price)}
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-600">
                          {formatCurrency(o.price_markup || o.net_commission_amount || 0)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-md font-bold text-[11px] ${
                            o.status === 'sure' || o.status === 'paid' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {o.status === 'sure' || o.status === 'paid' ? '✓ Đã chốt' : '⏳ Đang hold'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. GIAO DIỆN DÀNH CHO TRƯỞNG NHÓM SALE (role === 'sale_leader') */}
      {/* ========================================================================= */}
      {effectiveRole === 'sale_leader' && (
        <div className="space-y-6">
          {/* 4 STAT CARDS CHO SALE LEADER */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Doanh số nhóm */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Doanh Số Nhóm</span>
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {formatCurrency(leaderTeamData.totalRevenue)}
              </div>
              <div className="text-xs text-blue-600 font-bold">
                {leaderTeamData.confirmedTeamOrders.length} Đơn hàng thành công
              </div>
            </div>

            {/* Card 2: % KPI nhóm */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tỷ Lệ Đạt KPI Nhóm</span>
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Target className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-2xl font-black text-slate-900">{leaderTeamData.teamKpiProgress}%</span>
                <span className="text-xs text-slate-500 font-medium">Chỉ tiêu: 1 Tỷ</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${leaderTeamData.teamKpiProgress}%` }}
                ></div>
              </div>
            </div>

            {/* Card 3: Khách của nhóm */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Số Khách Của Nhóm</span>
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {leaderTeamData.totalPax} <span className="text-sm font-normal text-slate-500">Pax</span>
              </div>
              <div className="text-xs text-indigo-600 font-bold">
                Tổng lượt khách mang về cho công ty
              </div>
            </div>

            {/* Card 4: Đặt chỗ giữ chỗ nhóm */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Giữ Chỗ Đang Mở (Hold)</span>
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-600 mb-1">
                {leaderTeamData.holdTeamOrders.length} <span className="text-sm font-normal text-slate-500">đơn</span>
              </div>
              <div className="text-xs text-amber-700 font-bold">
                Cần đôn đốc các Sale xử lý cọc
              </div>
            </div>
          </div>

          {/* BẢNG XẾP HẠNG SALES TRONG TEAM (LEADERBOARD) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  Bảng Xếp Hạng Doanh Số Nhân Viên Trong Team
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Theo dõi kết quả bán hàng và tỷ lệ đóng góp của từng Sale trong nhóm.
                </p>
              </div>

              {/* View Switcher Controls */}
              <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-2xs self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setLeaderboardViewMode('table')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    leaderboardViewMode === 'table' ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                  title="Xem dạng Bảng"
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Bảng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardViewMode('bar')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    leaderboardViewMode === 'bar' ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                  title="Xem dạng Biểu đồ Cột"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Cột</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardViewMode('line')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    leaderboardViewMode === 'line' ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                  title="Xem dạng Biểu đồ Đường"
                >
                  <LineChartIcon className="w-3.5 h-3.5" />
                  <span>Đường</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardViewMode('pie')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    leaderboardViewMode === 'pie' ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                  title="Xem dạng Biểu đồ Tròn"
                >
                  <PieChartIcon className="w-3.5 h-3.5" />
                  <span>Hình tròn</span>
                </button>
              </div>
            </div>

            {leaderboardViewMode === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Thứ hạng</th>
                      <th className="px-4 py-3">Tên Nhân Viên</th>
                      <th className="px-4 py-3">Số đơn chốt</th>
                      <th className="px-4 py-3">Số khách (Pax)</th>
                      <th className="px-4 py-3">Doanh Số Chốt</th>
                      <th className="px-4 py-3">Đóng góp % Nhóm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {leaderTeamData.teamMemberStats.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-medium">
                          Chưa có dữ liệu nhân viên trong nhóm.
                        </td>
                      </tr>
                    ) : (
                      leaderTeamData.teamMemberStats.map((member, idx) => (
                        <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                              idx === 0 ? 'bg-amber-100 text-amber-800' :
                              idx === 1 ? 'bg-slate-200 text-slate-700' :
                              idx === 2 ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              #{idx + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {member.name}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-700">
                            {member.totalOrders} đơn
                          </td>
                          <td className="px-4 py-3 font-bold text-indigo-600">
                            {member.pax} Pax
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {formatCurrency(member.revenue)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-blue-600 h-full rounded-full" style={{ width: `${member.contributionPercent}%` }}></div>
                              </div>
                              <span className="font-bold text-slate-700">{member.contributionPercent}%</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {leaderboardViewMode === 'bar' && (
              <div className="p-6 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leaderTeamData.teamMemberStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={val => `${val / 1000000}M`} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="revenue" name="Doanh Số Chốt" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {leaderboardViewMode === 'line' && (
              <div className="p-6 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={leaderTeamData.teamMemberStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={val => `${val / 1000000}M`} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Doanh Số Chốt" stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            )}

            {leaderboardViewMode === 'pie' && (
              <div className="p-6 h-80 flex items-center justify-center">
                {leaderTeamData.teamMemberStats.filter(m => m.revenue > 0).length === 0 ? (
                  <div className="text-center py-8 text-slate-400 font-medium text-xs">
                    <PieChartIcon className="w-8 h-8 mb-2 mx-auto text-slate-300" />
                    <p>Chưa có dữ liệu doanh số để hiển thị biểu đồ hình tròn.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={leaderTeamData.teamMemberStats.filter(m => m.revenue > 0)}
                        dataKey="revenue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        innerRadius={45}
                        paddingAngle={3}
                        label={(entry: any) =>
                          (entry.percent || 0) >= 0.05
                            ? `${entry.name}: ${((entry.percent || 0) * 100).toFixed(0)}%`
                            : ''
                        }
                      >
                        {leaderTeamData.teamMemberStats
                          .filter(m => m.revenue > 0)
                          .map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </div>

          {/* BẢNG HẠCH TOÁN LÃI/LỖ TOUR GỬI ĐỐI TÁC & ĐOÀN RIÊNG */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-600" />
                Báo Cáo Hạch Toán Lãi / Lỗ Tour Gửi Đối Tác & Đoàn Riêng
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Cho phép Sale Leader theo dõi chi phí và lợi nhuận các sản phẩm thuộc phân quyền quản lý.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Mã Tour / Tên Tour</th>
                    <th className="px-4 py-3">Đối Tác / Đơn Vị</th>
                    <th className="px-4 py-3">Khách (Pax)</th>
                    <th className="px-4 py-3">Doanh Số</th>
                    <th className="px-4 py-3">Chi Phí Tour</th>
                    <th className="px-4 py-3">Lãi / Lỗ Ròng</th>
                    <th className="px-4 py-3">Tỷ Lệ Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {leaderTeamData.tourFinancials.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-medium">
                        Không có Tour gửi đối tác hoặc đoàn riêng nào trong danh sách.
                      </td>
                    </tr>
                  ) : (
                    leaderTeamData.tourFinancials.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-blue-600 font-mono">{t.code}</div>
                          <div className="text-slate-900 font-semibold line-clamp-1">{t.name}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {t.partner}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {t.sold_seats} Pax
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {formatCurrency(t.revenue)}
                        </td>
                        <td className="px-4 py-3 font-bold text-rose-600">
                          {formatCurrency(t.cost)}
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-600">
                          {formatCurrency(t.profit)}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                            {t.margin}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. GIAO DIỆN DÀNH CHO GIÁM ĐỐC / BOD / ADMIN (role === 'admin' | 'bod') */}
      {/* ========================================================================= */}
      {(effectiveRole === 'admin' || effectiveRole === 'bod') && (
        <div className="space-y-6">
          {/* TOP 4 EXECUTIVE STAT CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Doanh thu toàn công ty */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Doanh Thu Toàn AD</span>
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {formatCurrency(executiveData.totalRevenue)}
              </div>
              <div className="text-xs text-blue-600 font-bold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Toàn bộ các đơn hàng đã chốt
              </div>
            </div>

            {/* Card 2: Tổng Chi phí & Lãi gộp */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lãi Gộp Tour</span>
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-indigo-900 mb-1">
                {formatCurrency(executiveData.grossProfit)}
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Đã trừ vốn Tour: {formatCurrency(executiveData.totalTourCosts)}
              </div>
            </div>

            {/* Card 3: Net Margin (%) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tỷ Lệ Net Margin</span>
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Percent className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-600 mb-1">
                {executiveData.netMarginPercent}%
              </div>
              <div className="text-xs text-emerald-700 font-bold">
                Lợi nhuận ròng: {formatCurrency(executiveData.netProfit)}
              </div>
            </div>

            {/* Card 4: Tổng Lượt Khách (Pax) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Lượt Khách (Pax)</span>
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {executiveData.totalPax} <span className="text-sm font-normal text-slate-500">Pax</span>
              </div>
              <div className="text-xs text-purple-600 font-bold">
                Quy mô phục vụ toàn hệ thống
              </div>
            </div>
          </div>

          {/* KHU VỰC BIỂU ĐỒ BẢNG ĐIỀU HÀNH STRATEGIC */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Cơ cấu doanh thu kênh bán */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-blue-600" />
                Cơ Cấu Doanh Thu Theo Kênh Bán
              </h3>
              <div className="h-64 flex items-center justify-center">
                {executiveData.channelData.filter(c => c.value > 0).length === 0 ? (
                  <div className="text-center text-slate-400 font-medium text-xs">
                    <PieChartIcon className="w-8 h-8 mb-2 mx-auto text-slate-300" />
                    <p>Chưa có dữ liệu kênh bán để hiển thị.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={executiveData.channelData.filter(c => c.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        label={(entry: any) =>
                          (entry.percent || 0) >= 0.05
                            ? `${entry.name}: ${((entry.percent || 0) * 100).toFixed(0)}%`
                            : ''
                        }
                      >
                        {executiveData.channelData
                          .filter(c => c.value > 0)
                          .map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Tỷ trọng Lợi nhuận theo Loại Tour */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                Doanh Thu & Lợi Nhuận Theo Loại Hình Tour
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={executiveData.productTypeData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={val => `${val / 1000000}M`} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="revenue" name="Doanh Thu" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="profit" name="Lợi Nhuận" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* KHỐI 1: BÁO CÁO HIỆU QUẢ KINH DOANH THEO TEAM */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Báo Cáo Hiệu Quả Kinh Doanh Theo Team (Team Performance)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  So sánh doanh số, lợi nhuận ròng mang lại và tiến độ KPI của các nhóm kinh doanh.
                </p>
              </div>

              {/* View Switcher Controls */}
              <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-2xs self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setTeamViewMode('table')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    teamViewMode === 'table' ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                  title="Xem dạng Bảng"
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Bảng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTeamViewMode('bar')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    teamViewMode === 'bar' ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                  title="Xem dạng Biểu đồ Cột"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Cột</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTeamViewMode('line')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    teamViewMode === 'line' ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                  title="Xem dạng Biểu đồ Đường"
                >
                  <LineChartIcon className="w-3.5 h-3.5" />
                  <span>Đường</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTeamViewMode('pie')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    teamViewMode === 'pie' ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                  title="Xem dạng Biểu đồ Tròn"
                >
                  <PieChartIcon className="w-3.5 h-3.5" />
                  <span>Hình tròn</span>
                </button>
              </div>
            </div>

            {teamViewMode === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Tên Team</th>
                      <th className="px-4 py-3">Trưởng Nhóm (Leader)</th>
                      <th className="px-4 py-3">Số khách (Pax)</th>
                      <th className="px-4 py-3">Số đơn</th>
                      <th className="px-4 py-3">Doanh Số Chốt</th>
                      <th className="px-4 py-3">Lợi Nhuận Ròng (AD)</th>
                      <th className="px-4 py-3">Tiến Độ KPI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {executiveData.teamPerformanceList.map((team, idx) => (
                      <tr key={team.team_id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {team.team_name}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {team.leader_name}
                        </td>
                        <td className="px-4 py-3 font-bold text-indigo-600">
                          {team.pax_count} Pax
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {team.total_orders} đơn
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {formatCurrency(team.revenue)}
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-600">
                          {formatCurrency(team.net_profit)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${team.kpi_percentage}%` }}></div>
                            </div>
                            <span className="font-bold text-slate-900">{team.kpi_percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {teamViewMode === 'bar' && (
              <div className="p-6 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={executiveData.teamPerformanceList}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="team_name" axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={val => `${val / 1000000}M`} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="revenue" name="Doanh Số Chốt" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="net_profit" name="Lợi Nhuận Ròng (AD)" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {teamViewMode === 'line' && (
              <div className="p-6 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={executiveData.teamPerformanceList}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="team_name" axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={val => `${val / 1000000}M`} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Doanh Số Chốt" stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }} />
                    <Line type="monotone" dataKey="net_profit" name="Lợi Nhuận Ròng (AD)" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            )}

            {teamViewMode === 'pie' && (
              <div className="p-6 h-80 flex items-center justify-center">
                {executiveData.teamPerformanceList.filter(t => t.revenue > 0).length === 0 ? (
                  <div className="text-center py-8 text-slate-400 font-medium text-xs">
                    <PieChartIcon className="w-8 h-8 mb-2 mx-auto text-slate-300" />
                    <p>Chưa có dữ liệu doanh số team để hiển thị biểu đồ hình tròn.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={executiveData.teamPerformanceList.filter(t => t.revenue > 0)}
                        dataKey="revenue"
                        nameKey="team_name"
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        innerRadius={45}
                        paddingAngle={3}
                        label={(entry: any) =>
                          (entry.percent || 0) >= 0.05
                            ? `${entry.team_name || entry.name}: ${((entry.percent || 0) * 100).toFixed(0)}%`
                            : ''
                        }
                      >
                        {executiveData.teamPerformanceList
                          .filter(t => t.revenue > 0)
                          .map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </div>

          {/* KHỐI 2: BÁO CÁO CHI TIẾT THEO NHÂN VIÊN SALE (SALE PERFORMANCE BREAKDOWN) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  Báo Cáo Hiệu Quả & Xếp Hạng Chi Tiết Theo Nhân Viên Sale
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Phân tích đơn hàng tự bán vs đơn hỗ trợ CTV/Đại lý và lợi nhuận ròng từng Sale mang về.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* View Switcher Controls */}
                <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setSaleViewMode('table')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      saleViewMode === 'table' ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                    title="Xem dạng Bảng"
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Bảng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaleViewMode('bar')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      saleViewMode === 'bar' ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                    title="Xem dạng Biểu đồ Cột"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Cột</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaleViewMode('line')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      saleViewMode === 'line' ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                    title="Xem dạng Biểu đồ Đường"
                  >
                    <LineChartIcon className="w-3.5 h-3.5" />
                    <span>Đường</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaleViewMode('pie')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      saleViewMode === 'pie' ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                    title="Xem dạng Biểu đồ Tròn"
                  >
                    <PieChartIcon className="w-3.5 h-3.5" />
                    <span>Hình tròn</span>
                  </button>
                </div>

                {/* Bộ lọc chọn Team */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Lọc theo Team:</span>
                  <select
                    value={selectedTeamFilter}
                    onChange={e => setSelectedTeamFilter(e.target.value)}
                    className="h-9 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                  >
                    <option value="all">Tất cả các Team</option>
                    {activeTeams.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {saleViewMode === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Hạng</th>
                      <th className="px-4 py-3">Nhân Viên Sale</th>
                      <th className="px-4 py-3">Team</th>
                      <th className="px-4 py-3">Số Đơn / Khách</th>
                      <th className="px-4 py-3">Đơn Tự Bán vs Đơn CTV/Đại lý</th>
                      <th className="px-4 py-3">Doanh Số (VNĐ)</th>
                      <th className="px-4 py-3">Lợi Nhuận Ròng (AD)</th>
                      <th className="px-4 py-3">Đạt KPI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {executiveData.salePerformanceList
                      .filter(s => selectedTeamFilter === 'all' || s.team_name === selectedTeamFilter)
                      .map((sale, idx) => (
                        <tr key={sale.sale_id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                              idx === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                              idx === 1 ? 'bg-slate-200 text-slate-700 border border-slate-300' :
                              idx === 2 ? 'bg-orange-100 text-orange-800 border border-orange-300' : 'bg-slate-100 text-slate-600'
                            }`}>
                              #{idx + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {sale.sale_name}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-600">
                            {sale.team_name}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900">{sale.total_orders} đơn</span> / <span className="text-indigo-600 font-bold">{sale.pax_count} Pax</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded">Trực tiếp: {sale.direct_orders_count}</span>
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-bold rounded">CTV/ĐL: {sale.assisted_ctv_orders_count}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {formatCurrency(sale.revenue)}
                          </td>
                          <td className="px-4 py-3 font-bold text-emerald-600">
                            {formatCurrency(sale.net_profit)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded font-bold ${
                              sale.kpi_percentage >= 100 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {sale.kpi_percentage}%
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {saleViewMode === 'bar' && (
              <div className="p-6 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={executiveData.salePerformanceList.filter(s => selectedTeamFilter === 'all' || s.team_name === selectedTeamFilter)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="sale_name" axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={val => `${val / 1000000}M`} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="revenue" name="Doanh Số (VNĐ)" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="net_profit" name="Lợi Nhuận Ròng (AD)" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {saleViewMode === 'line' && (
              <div className="p-6 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={executiveData.salePerformanceList.filter(s => selectedTeamFilter === 'all' || s.team_name === selectedTeamFilter)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="sale_name" axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={val => `${val / 1000000}M`} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Doanh Số (VNĐ)" stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }} />
                    <Line type="monotone" dataKey="net_profit" name="Lợi Nhuận Ròng (AD)" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            )}

            {saleViewMode === 'pie' && (
              <div className="p-6 h-80 flex items-center justify-center">
                {executiveData.salePerformanceList
                  .filter(s => (selectedTeamFilter === 'all' || s.team_name === selectedTeamFilter) && s.revenue > 0)
                  .length === 0 ? (
                  <div className="text-center py-8 text-slate-400 font-medium text-xs">
                    <PieChartIcon className="w-8 h-8 mb-2 mx-auto text-slate-300" />
                    <p>Chưa có dữ liệu doanh số nhân viên để hiển thị biểu đồ hình tròn.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={executiveData.salePerformanceList.filter(s => (selectedTeamFilter === 'all' || s.team_name === selectedTeamFilter) && s.revenue > 0)}
                        dataKey="revenue"
                        nameKey="sale_name"
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        innerRadius={45}
                        paddingAngle={3}
                        label={(entry: any) =>
                          (entry.percent || 0) >= 0.05
                            ? `${entry.sale_name || entry.name}: ${((entry.percent || 0) * 100).toFixed(0)}%`
                            : ''
                        }
                      >
                        {executiveData.salePerformanceList
                          .filter(s => (selectedTeamFilter === 'all' || s.team_name === selectedTeamFilter) && s.revenue > 0)
                          .map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. FALLBACK CHO CÁC VAI TRÒ KHÁC (OPERATOR, VISA, ACCOUNTING, GUIDE, CTV) */}
      {/* ========================================================================= */}
      {!['sale', 'sale_leader', 'admin', 'bod'].includes(effectiveRole) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-4 shadow-xs">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
            <Activity className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Giao Diện Bảng Điều Khiển Vận Hành</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Hệ thống tự động hiển thị các chỉ số theo đúng vai trò công việc của bạn ({effectiveRole.toUpperCase()}).
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link to="/" className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition-all">
              Xem Lịch Khởi Hành
            </Link>
            <Link to="/tours" className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200 transition-all">
              Quản Lý Tour
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
