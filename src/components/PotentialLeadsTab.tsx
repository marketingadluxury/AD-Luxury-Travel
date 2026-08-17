import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Trash2, 
  Tag, 
  Plus, 
  Eye, 
  Share2, 
  RefreshCw, 
  ExternalLink,
  ChevronRight,
  UserCheck,
  Zap,
  Flame,
  User,
  Layers,
  HelpCircle,
  TrendingUp,
  Sliders
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCRM } from '@/context/CRMContext';
import { useAuth } from '@/context/AuthContext';
import { MetaLead, Tour } from '@/types';
import { fetchMetaLeads, updateMetaLead, deleteMetaLead } from '@/lib/metaCapiService';
import { format } from 'date-fns';

interface PotentialLeadsTabProps {
  onSelectLeadForBooking?: (lead: MetaLead) => void;
}

export const PotentialLeadsTab: React.FC<PotentialLeadsTabProps> = ({ onSelectLeadForBooking }) => {
  const { tours = [], profilesList = [], currentRole } = useCRM();
  const { profile } = useAuth();

  const [leads, setLeads] = useState<MetaLead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<MetaLead | null>(null);
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState('lead_captured');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Simulation State
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [simType, setSimType] = useState<'messenger' | 'lead_form'>('messenger');
  const [simName, setSimName] = useState('Nguyễn Văn Khách Test');
  const [simPhone, setSimPhone] = useState('0988123456');
  const [simEmail, setSimEmail] = useState('khachhang.test@gmail.com');
  const [simMessage, setSimMessage] = useState('Chào công ty, mình muốn tư vấn tour Dubai 5N4Đ cho 2 người lớn, sđt mình là 0988123456.');
  const [simTourInterest, setSimTourInterest] = useState('Tour Dubai 5N4Đ');
  const [simCampaign, setSimCampaign] = useState('Chiến dịch Quảng cáo Tour Mùa Thu 2026');
  const [isSimulating, setIsSimulating] = useState(false);

  // Load leads
  const loadLeads = async () => {
    setIsLoading(true);
    try {
      const data = await fetchMetaLeads({
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      });
      setLeads(data);
    } catch (err) {
      console.error('Lỗi khi tải danh sách leads:', err);
      toast.error('Không thể tải danh sách khách hàng tiềm năng');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadLeads();
  };

  // Quick action: Change status
  const handleUpdateStatus = async (leadId: string, newStatus: string) => {
    try {
      const res = await updateMetaLead(leadId, { status: newStatus });
      if (res.success) {
        toast.success('Đã cập nhật trạng thái Lead!');
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật trạng thái');
    }
  };

  // Open Edit Modal
  const openEditModal = (lead: MetaLead) => {
    setSelectedLead(lead);
    setEditNotes(lead.notes || '');
    setEditStatus(lead.status || 'lead_captured');
    setEditAssignedTo(lead.assigned_to || '');
    setIsEditingModalOpen(true);
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!selectedLead) return;
    setIsSaving(true);
    try {
      const res = await updateMetaLead(selectedLead.id, {
        status: editStatus,
        notes: editNotes,
        assigned_to: editAssignedTo || undefined
      });
      if (res.success) {
        toast.success('Đã lưu thông tin khách hàng tiềm năng!');
        setIsEditingModalOpen(false);
        loadLeads();
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Lead
  const handleDeleteLead = async (leadId: string, leadName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa khách hàng tiềm năng "${leadName}"?`)) return;
    try {
      const res = await deleteMetaLead(leadId);
      if (res.success) {
        toast.success('Đã xóa Lead thành công!');
        setLeads(prev => prev.filter(l => l.id !== leadId));
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xóa Lead');
    }
  };

  // Run Simulation Test
  const handleSimulateWebhook = async () => {
    if (!simName.trim() || !simPhone.trim()) {
      toast.error('Vui lòng nhập Tên khách hàng và Số điện thoại');
      return;
    }

    setIsSimulating(true);
    try {
      if (simType === 'messenger') {
        // Gửi Webhook giả lập Messenger y hệt Meta
        const fakePayload = {
          object: 'page',
          entry: [
            {
              id: '103836966010338',
              time: Date.now(),
              messaging: [
                {
                  sender: { id: `sim_psid_${Date.now()}` },
                  recipient: { id: '103836966010338' },
                  timestamp: Date.now(),
                  message: {
                    mid: `m_sim_${Date.now()}`,
                    text: simMessage
                  }
                }
              ]
            }
          ]
        };

        const res = await fetch('/api/meta-messenger/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fakePayload)
        });

        if (res.ok) {
          toast.success('✅ Đã gửi Webhook Messenger giả lập thành công!');
        } else {
          throw new Error('Lỗi gửi Webhook');
        }
      } else {
        // Gửi tạo Lead Form trực tiếp
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: simName,
            customer_phone: simPhone,
            customer_email: simEmail,
            source_channel: 'meta_lead_form',
            utm_campaign: simCampaign,
            tour_interest: simTourInterest,
            message_text: `Biểu mẫu đăng ký: Nhu cầu ${simTourInterest} (${simCampaign})`,
            status: 'lead_captured'
          })
        });

        if (res.ok) {
          toast.success('✅ Đã tạo Lead Form quảng cáo thành công!');
        } else {
          throw new Error('Lỗi tạo Lead Form');
        }
      }

      setIsSimModalOpen(false);
      // Đợi 500ms rồi reload danh sách
      setTimeout(() => {
        loadLeads();
      }, 500);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi chạy giả lập');
    } finally {
      setIsSimulating(false);
    }
  };

  // KPI Statistics
  const stats = useMemo(() => {
    const total = leads.length;
    const withPhone = leads.filter(l => Boolean(l.customer_phone)).length;
    const newLeads = leads.filter(l => l.status === 'lead_captured' || l.status === 'active').length;
    const converted = leads.filter(l => l.status === 'lead_converted').length;
    const contacted = leads.filter(l => l.status === 'contacted').length;
    const convRate = total > 0 ? Math.round((converted / total) * 100) : 0;
    return { total, withPhone, newLeads, converted, contacted, convRate };
  }, [leads]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'lead_captured':
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            Mới để lại SĐT
          </span>
        );
      case 'contacted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
            <Clock className="w-3 h-3 text-amber-600" />
            Đã liên hệ tư vấn
          </span>
        );
      case 'lead_converted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Đã chốt Booking
          </span>
        );
      case 'unqualified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
            <XCircle className="w-3 h-3 text-slate-400" />
            Chưa phù hợp
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200 whitespace-nowrap">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* 4 Thẻ KPI Chỉ Số Nổi Bật */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Tổng Leads Messenger</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl md:text-3xl font-black text-slate-900">{stats.total}</span>
            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              {stats.withPhone} có SĐT
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50/30 to-white shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700">Mới Nhận (Cần gọi)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Flame className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl md:text-3xl font-black text-blue-700">{stats.newLeads}</span>
            <span className="text-[11px] text-blue-800/70 block mt-0.5 font-medium">Khách vừa để lại SĐT</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50/30 to-white shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">Đang chăm sóc</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl md:text-3xl font-black text-amber-600">{stats.contacted}</span>
            <span className="text-[11px] text-amber-800/70 block mt-0.5 font-medium">Đã gọi điện tư vấn</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/30 to-white shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">Đã chốt Booking</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl md:text-3xl font-black text-emerald-700">{stats.converted}</span>
            <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
              Tỷ lệ: {stats.convRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Bộ Lọc & Tìm Kiếm */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearch} className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Tìm theo Tên khách, Số điện thoại, Email hoặc Chiến dịch quảng cáo..."
            className="w-full h-10 pl-10 pr-24 border border-slate-200 rounded-xl text-xs font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-900 placeholder:text-slate-400 bg-slate-50/60 focus:bg-white transition-all shadow-2xs"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
          >
            Tìm
          </button>
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-800 outline-none cursor-pointer focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-2xs"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="lead_captured">Mới để lại SĐT</option>
            <option value="contacted">Đã liên hệ tư vấn</option>
            <option value="lead_converted">Đã chốt Booking</option>
            <option value="unqualified">Chưa phù hợp</option>
          </select>

          <button
            type="button"
            onClick={loadLeads}
            disabled={isLoading}
            className="h-10 w-10 shrink-0 flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 transition-colors cursor-pointer"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsSimModalOpen(true)}
            className="h-10 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="Mở công cụ giả lập test Webhook & Lead Ads"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Giả lập Tin nhắn / Lead Ads</span>
          </button>
        </div>
      </div>

      {/* Danh Sách Khách Hàng Tiềm Năng (Bảng dữ liệu chuẩn Enterprise) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
            <p className="text-xs font-semibold">Đang tải danh sách khách hàng tiềm năng từ Meta...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Chưa có khách hàng tiềm năng nào</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Khi khách hàng nhắn tin để lại số điện thoại trên Facebook Messenger, hệ thống sẽ tự động đồng bộ và lưu trữ ngay tại đây.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Khách hàng</th>
                  <th className="py-3.5 px-4">Số điện thoại & Email</th>
                  <th className="py-3.5 px-4">Nội dung tin nhắn & Nhu cầu</th>
                  <th className="py-3.5 px-4">Chiến dịch / Nguồn</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Thời gian</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-blue-50/40 transition-colors">
                    
                    {/* Tên khách hàng - Chỉ hiển thị Họ và tên */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">
                          {lead.customer_name || 'Khách Meta'}
                        </div>
                        {lead.assigned_name && (
                          <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3" />
                            Sale: {lead.assigned_name}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* SĐT & Email */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        {lead.customer_phone ? (
                          <a
                            href={`tel:${lead.customer_phone}`}
                            className="inline-flex items-center gap-1.5 font-bold text-blue-600 hover:text-blue-800 hover:underline text-xs bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-200/60"
                          >
                            <Phone className="w-3 h-3 text-blue-500" />
                            {lead.customer_phone}
                          </a>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Chưa có SĐT</span>
                        )}
                        {lead.customer_email && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {lead.customer_email}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Nội dung tin nhắn & Ghi chú */}
                    <td className="py-3.5 px-4 max-w-[280px]">
                      <div className="space-y-1">
                        <p className="text-xs text-slate-700 font-medium line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-200/60" title={lead.last_message || ''}>
                          {lead.last_message || 'Khách hàng để lại thông tin quan tâm qua Messenger'}
                        </p>
                        {lead.notes && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold block truncate">
                            📝 Note: {lead.notes}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Campaign & UTM */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        {lead.utm_campaign ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            <Tag className="w-3 h-3 text-purple-500" />
                            {lead.utm_campaign}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">Tin nhắn tự nhiên</span>
                        )}
                        {lead.ad_id && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Ad ID: {lead.ad_id}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Trạng thái */}
                    <td className="py-3.5 px-4">
                      {getStatusBadge(lead.status)}
                    </td>

                    {/* Ngày tạo */}
                    <td className="py-3.5 px-4 text-slate-500 text-[11px] font-medium whitespace-nowrap">
                      {lead.created_at ? format(new Date(lead.created_at), 'HH:mm dd/MM/yyyy') : '-'}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {/* Nút Tạo Booking Ngay */}
                        {onSelectLeadForBooking && (
                          <button
                            type="button"
                            onClick={() => onSelectLeadForBooking(lead)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs hover:shadow transition-all cursor-pointer"
                            title="Tạo Booking từ Lead này"
                          >
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            <span>Tạo Booking</span>
                          </button>
                        )}

                        {/* Nút Chi tiết & Note */}
                        <button
                          type="button"
                          onClick={() => openEditModal(lead)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="Cập nhật ghi chú & trạng thái"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>

                        {/* Xóa Lead */}
                        {['admin', 'sale_leader'].includes(currentRole) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteLead(lead.id, lead.customer_name)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Xóa Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Chỉnh Sửa Ghi Chú & Trạng Thái Lead */}
      {isEditingModalOpen && selectedLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Cập nhật Khách Hàng Tiềm Năng
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 space-y-1">
                <div className="font-bold text-slate-900 text-sm">{selectedLead.customer_name}</div>
                <div className="text-blue-700 font-semibold">{selectedLead.customer_phone || 'Chưa có SĐT'}</div>
                {selectedLead.last_message && (
                  <div className="text-slate-600 text-[11px] mt-1 bg-white p-2 rounded border border-blue-100">
                    "{selectedLead.last_message}"
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Trạng thái chăm sóc:</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg font-semibold bg-white text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="lead_captured">Mới để lại SĐT</option>
                  <option value="contacted">Đã liên hệ tư vấn</option>
                  <option value="lead_converted">Đã chốt Booking</option>
                  <option value="unqualified">Chưa phù hợp / Hủy</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Gán Nhân viên Sale phụ trách:</label>
                <select
                  value={editAssignedTo}
                  onChange={e => setEditAssignedTo(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg font-semibold bg-white text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">-- Chưa gán (Chung cho đội Sale) --</option>
                  {profilesList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.email} ({p.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Ghi chú nhu cầu khách (Tuyến tour, ngày đi mong muốn, số khách...):</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Nhập ghi chú chi tiết..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-medium bg-white text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditingModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Giả Lập Test Webhook & Lead Ads */}
      {isSimModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Công Cụ Giả Lập Test Webhook & Lead Ads
              </h3>
              <button
                type="button"
                onClick={() => setIsSimModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 text-slate-700 space-y-1">
                <p className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  Mô phỏng sự kiện thực tế từ Meta:
                </p>
                <p className="text-[11px] text-amber-800">
                  Hệ thống sẽ gửi gói tin Webhook giả lập tới Backend, tự động lọc SĐT, bóc tách nhu cầu tour và lưu ngay vào database Supabase theo thời gian thực.
                </p>
              </div>

              {/* Loại giả lập */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Loại sự kiện muốn thử nghiệm:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSimType('messenger');
                      setSimMessage('Chào AD Luxury Travel, mình muốn tư vấn tour Dubai 5N4Đ, sđt mình 0988123456');
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      simType === 'messenger'
                        ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs">Tin nhắn Messenger</div>
                      <div className="text-[10px] text-slate-400 font-normal">Khách chat để lại SĐT</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSimType('lead_form');
                      setSimCampaign('Quảng cáo Chuyển đổi Lead Form - Tour Úc 2026');
                      setSimTourInterest('Tour Úc Sydney - Melbourne 7N6Đ');
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      simType === 'lead_form'
                        ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs">Biểu Mẫu Lead Ads</div>
                      <div className="text-[10px] text-slate-400 font-normal">Instant Form trên Facebook</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Tên khách & SĐT */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Tên khách hàng test:</label>
                  <input
                    type="text"
                    value={simName}
                    onChange={e => setSimName(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg font-semibold bg-white text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Số điện thoại:</label>
                  <input
                    type="text"
                    value={simPhone}
                    onChange={e => setSimPhone(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg font-bold text-blue-700 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {simType === 'messenger' ? (
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Nội dung tin nhắn khách gửi:</label>
                  <textarea
                    rows={3}
                    value={simMessage}
                    onChange={e => setSimMessage(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-medium bg-white text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Tuyến Tour quan tâm:</label>
                    <input
                      type="text"
                      value={simTourInterest}
                      onChange={e => setSimTourInterest(e.target.value)}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg font-semibold bg-white text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Tên Chiến Dịch Quảng Cáo:</label>
                    <input
                      type="text"
                      value={simCampaign}
                      onChange={e => setSimCampaign(e.target.value)}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg font-medium bg-white text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSimModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSimulateWebhook}
                disabled={isSimulating}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-300" />}
                Bắn Webhook Thử Nghiệm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
