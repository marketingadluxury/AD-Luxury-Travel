import React, { useState, useMemo } from 'react';
import { Order } from '@/types';
import { useCRM } from '@/context/CRMContext';
import {
  Users,
  Search,
  AlertTriangle,
  CheckCircle,
  Filter,
  ShieldAlert
} from 'lucide-react';

interface AgentConversionTableProps {
  orders: Order[];
}

export default function AgentConversionTable({ orders }: AgentConversionTableProps) {
  const { profilesList } = useCRM();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'conversion' | 'sure' | 'expired' | 'total'>('conversion');

  // Group and calculate statistics for each Agent/Salesperson
  const agentStats = useMemo(() => {
    const statsMap: {
      [key: string]: {
        agentId: string;
        agentName: string;
        agentRole: string;
        holdCount: number;
        sureCount: number;
        expiredCount: number;
        totalOrders: number;
        totalRevenue: number;
      }
    } = {};

    // Map each order to creator/agent
    orders.forEach(order => {
      // Creator identification key
      const agentKey = order.user_id || order.created_by || 'Khách/Đại lý khác';
      const agentProfile = profilesList.find(p => p.id === order.user_id || p.full_name === order.created_by);
      const agentName = agentProfile?.full_name || order.created_by || 'Đại lý';
      const agentRole = agentProfile?.role || 'agent';

      if (!statsMap[agentKey]) {
        statsMap[agentKey] = {
          agentId: agentKey,
          agentName,
          agentRole,
          holdCount: 0,
          sureCount: 0,
          expiredCount: 0,
          totalOrders: 0,
          totalRevenue: 0
        };
      }

      const stat = statsMap[agentKey];
      stat.totalOrders += 1;

      if (order.status === 'hold') {
        stat.holdCount += 1;
      } else if (order.status === 'sure' || order.status === 'paid') {
        stat.sureCount += 1;
        stat.totalRevenue += (order.total_price || 0);
      } else if (order.status === 'cancelled') {
        stat.expiredCount += 1;
      }
    });

    // Convert map to array and filter/sort
    let list = Object.values(statsMap).map(s => {
      const conversionRate = s.totalOrders > 0 ? (s.sureCount / s.totalOrders) * 100 : 0;
      const expiredRate = s.totalOrders > 0 ? (s.expiredCount / s.totalOrders) * 100 : 0;
      const isHighExpiredWarning = expiredRate > 50 && s.totalOrders >= 2;

      return {
        ...s,
        conversionRate,
        expiredRate,
        isHighExpiredWarning
      };
    });

    // Filter by search term and role
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(item => 
        item.agentName.toLowerCase().includes(term) || 
        item.agentRole.toLowerCase().includes(term)
      );
    }

    if (roleFilter !== 'all') {
      list = list.filter(item => item.agentRole === roleFilter);
    }

    // Sort list
    return list.sort((a, b) => {
      if (sortBy === 'conversion') {
        return b.conversionRate - a.conversionRate;
      } else if (sortBy === 'sure') {
        return b.sureCount - a.sureCount;
      } else if (sortBy === 'expired') {
        return b.expiredCount - a.expiredCount;
      } else {
        return b.totalOrders - a.totalOrders;
      }
    });
  }, [orders, profilesList, searchTerm, roleFilter, sortBy]);

  // Overall metrics summary
  const summary = useMemo(() => {
    const totalSure = agentStats.reduce((acc, s) => acc + s.sureCount, 0);
    const totalAll = agentStats.reduce((acc, s) => acc + s.totalOrders, 0);
    const warningCount = agentStats.filter(s => s.isHighExpiredWarning).length;
    const avgConversion = totalAll > 0 ? Math.round((totalSure / totalAll) * 100) : 0;

    return { totalSure, totalAll, warningCount, avgConversion };
  }, [agentStats]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-5 md:p-6 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl font-bold flex items-center justify-center">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                Bảng Hiệu Suất & Tỉ Lệ Chuyển Đổi Đại Lý
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-black">
                  {agentStats.length} Đại lý/Sales
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Thống kê đơn HOLD, SURE, HỦY TỰ ĐỘNG & Phát hiện giam chỗ ảo (<strong className="text-red-600">&gt;50% Hủy</strong>)
              </p>
            </div>
          </div>
        </div>

        {/* Warning Indicator */}
        {summary.warningCount > 0 && (
          <div className="px-3.5 py-2 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-xs font-bold text-amber-900 shrink-0">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Phát hiện <strong className="text-red-600 font-black">{summary.warningCount} Đại lý</strong> có tỉ lệ hủy cao do giam chỗ ảo!</span>
          </div>
        )}
      </div>

      {/* Toolbar Filters */}
      <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm tên đại lý, sale..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Role */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tất cả vai trò</option>
            <option value="bod">BOD (Ban Giám đốc)</option>
            <option value="agent">Đại lý (Agent)</option>
            <option value="sale">Sales</option>
            <option value="sale_leader">Sale Leader</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="conversion">Xếp theo Tỉ lệ chuyển đổi (SURE %)</option>
            <option value="sure">Xếp theo Số đơn SURE nhiều nhất</option>
            <option value="expired">Xếp theo Số đơn HỦY nhiều nhất</option>
            <option value="total">Xếp theo Tổng đơn tạo</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left divide-y divide-slate-200">
          <thead className="bg-slate-100/80 text-[11px] font-black text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5">Đại lý / Sales</th>
              <th className="px-4 py-3.5 text-center">Vai trò</th>
              <th className="px-4 py-3.5 text-center text-amber-700">Đơn HOLD</th>
              <th className="px-4 py-3.5 text-center text-emerald-700">Đơn SURE</th>
              <th className="px-4 py-3.5 text-center text-red-600">Đơn EXPIRED</th>
              <th className="px-4 py-3.5 text-center">Tổng đơn</th>
              <th className="px-5 py-3.5 text-right">Doanh thu chốt</th>
              <th className="px-5 py-3.5 text-center">Tỉ lệ chuyển đổi</th>
              <th className="px-5 py-3.5 text-center">Cảnh báo rủi ro</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white text-xs font-medium">
            {agentStats.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500 font-bold">
                  Không tìm thấy dữ liệu Đại lý/Sales phù hợp.
                </td>
              </tr>
            ) : (
              agentStats.map((agent) => (
                <tr 
                  key={agent.agentId}
                  className={`hover:bg-slate-50/90 transition-colors ${
                    agent.isHighExpiredWarning ? 'bg-amber-50/30' : ''
                  }`}
                >
                  {/* Name */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 border ${
                        agent.isHighExpiredWarning 
                          ? 'bg-red-100 text-red-800 border-red-200' 
                          : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                      }`}>
                        {agent.agentName.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-extrabold text-slate-900 uppercase">
                        {agent.agentName}
                      </span>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-4 text-center">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {agent.agentRole}
                    </span>
                  </td>

                  {/* HOLD Count */}
                  <td className="px-4 py-4 text-center">
                    <span className="font-extrabold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/80">
                      {agent.holdCount}
                    </span>
                  </td>

                  {/* SURE Count */}
                  <td className="px-4 py-4 text-center">
                    <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/80">
                      {agent.sureCount}
                    </span>
                  </td>

                  {/* EXPIRED Count */}
                  <td className="px-4 py-4 text-center">
                    <span className="font-extrabold text-red-600 bg-red-50 px-2.5 py-1 rounded-md border border-red-200/80">
                      {agent.expiredCount}
                    </span>
                  </td>

                  {/* Total Orders */}
                  <td className="px-4 py-4 text-center font-black text-slate-800">
                    {agent.totalOrders}
                  </td>

                  {/* Revenue */}
                  <td className="px-5 py-4 text-right font-black text-slate-900">
                    {agent.totalRevenue.toLocaleString('vi-VN')} đ
                  </td>

                  {/* Conversion Rate */}
                  <td className="px-5 py-4 text-center">
                    <div className="space-y-1">
                      <span className={`font-black text-xs ${
                        agent.conversionRate >= 70 
                          ? 'text-emerald-600' 
                          : agent.conversionRate >= 40 
                            ? 'text-indigo-600' 
                            : 'text-amber-600'
                      }`}>
                        {agent.conversionRate.toFixed(1)}%
                      </span>

                      <div className="w-16 bg-slate-200 rounded-full h-1.5 mx-auto overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            agent.conversionRate >= 70 
                              ? 'bg-emerald-500' 
                              : agent.conversionRate >= 40 
                                ? 'bg-indigo-500' 
                                : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, agent.conversionRate)}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Warning Badge */}
                  <td className="px-5 py-4 text-center">
                    {agent.isHighExpiredWarning ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-red-100 text-red-800 border border-red-300 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                        Giam chỗ ảo ({agent.expiredRate.toFixed(0)}% Hủy)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400 text-[11px] font-bold">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        Bình thường
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
