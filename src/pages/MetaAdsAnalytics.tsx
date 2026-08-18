import React, { useState, useEffect, useMemo } from 'react';
import { 
  Megaphone, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Save, 
  Send, 
  ShieldCheck, 
  Database, 
  Eye, 
  EyeOff, 
  Search, 
  Filter, 
  ChevronRight, 
  BarChart3, 
  DollarSign, 
  PhoneCall, 
  ShoppingCart, 
  Layers, 
  ExternalLink,
  Code2,
  Info,
  Sliders,
  Check,
  X,
  Zap,
  Users,
  MessageSquare,
  Bot
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/context/CRMContext';
import { supabase } from '@/lib/supabase';
import { MetaConversionLog, MetaEventName, MetaLead } from '@/types';
import { 
  fetchMetaCapiConfig, 
  saveMetaCapiConfig, 
  fetchMetaConversionLogs, 
  fetchMetaLeads,
  testMetaConnection,
  triggerMetaCapiEvent,
  fetchPancakeConfig,
  savePancakeConfig,
  testPancakeConnection,
  syncPancakeLeads,
  simulateMetaWebhook
} from '@/lib/metaCapiService';
import { MetaAdsPerformanceDashboard } from '@/components/MetaAdsPerformanceDashboard';
import { PotentialLeadsTab } from '@/components/PotentialLeadsTab';
import { formatCurrency } from '@/lib/utils';

interface DiagnosisResult {
  tokenValid: boolean;
  tokenOwner?: { id: string; name: string; type?: string; link?: string };
  permissions?: { name: string; status: string }[];
  pageStatus?: { id: string; name: string; isSubscribedToWebhook?: boolean; webhookApps?: any[]; error?: string };
  pixelStatus?: { id: string; name?: string; canAccess: boolean; error?: string };
  adAccountStatus?: { id: string; name?: string; currency?: string; status?: number; error?: string };
  recommendations: string[];
  rawErrors: string[];
}

export default function MetaAdsAnalytics() {
  const navigate = useNavigate();
  const { orders = [], tours = [] } = useCRM();

  // State cấu hình Meta CAPI
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [testEventCode, setTestEventCode] = useState('');
  const [pageId, setPageId] = useState('103836966010338');
  const [adAccountId, setAdAccountId] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);

  // State cấu hình Pancake
  const [pancakeApiKey, setPancakeApiKey] = useState('');
  const [showPancakeKey, setShowPancakeKey] = useState(false);
  const [isPancakeActive, setIsPancakeActive] = useState(true);
  const [isSavingPancake, setIsSavingPancake] = useState(false);
  const [isTestingPancake, setIsTestingPancake] = useState(false);
  const [isSyncingPancake, setIsSyncingPancake] = useState(false);
  const [pancakePages, setPancakePages] = useState<Array<{ id: string; name: string; username?: string }>>([]);

  // State Logs & Filter & Leads
  const [logs, setLogs] = useState<MetaConversionLog[]>([]);
  const [leads, setLeads] = useState<MetaLead[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLogDetail, setSelectedLogDetail] = useState<MetaConversionLog | null>(null);

  // Active Tab: leads | overview | campaigns | logs | settings
  const [activeTab, setActiveTab] = useState<'leads' | 'overview' | 'campaigns' | 'logs' | 'settings'>('leads');

  // Load config, logs & leads khi vào trang
  const loadData = async (isSilent: boolean = false) => {
    if (!isSilent) {
      setIsLoadingLogs(true);
    }
    try {
      const [configData, pancakeData, logsData, leadsData] = await Promise.all([
        fetchMetaCapiConfig(),
        fetchPancakeConfig(),
        fetchMetaConversionLogs(200),
        fetchMetaLeads()
      ]);

      if (configData) {
        setPixelId(configData.pixel_id || '');
        setAccessToken(configData.access_token_masked || '');
        setTestEventCode(configData.test_event_code || '');
        setIsEnabled(configData.is_enabled !== false);
      }

      if (pancakeData) {
        setPancakeApiKey(pancakeData.api_key_masked || '');
        setIsPancakeActive(pancakeData.is_active !== false);
      }

      setLogs(logsData || []);
      setLeads(leadsData || []);
    } catch (err) {
      console.error('Lỗi nạp dữ liệu Meta CAPI & Leads:', err);
      if (!isSilent) {
        toast.error('Không thể tải dữ liệu Meta CAPI');
      }
    } finally {
      if (!isSilent) {
        setIsLoadingLogs(false);
      }
    }
  };

  useEffect(() => {
    loadData();

    let debounceTimer: any = null;
    // Lắng nghe Realtime từ Supabase khi có lead mới từ Webhook / Auto-sync (debounced silent update)
    const leadsChannel = supabase
      .channel('realtime_meta_leads_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          loadData(true);
        }, 1500);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_conversion_logs' }, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          loadData(true);
        }, 1500);
      })
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(leadsChannel);
    };
  }, []);

  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState(false);

  // Bắn thử nghiệm giả lập Webhook Meta Messenger
  const handleSimulateMetaWebhook = async () => {
    setIsSimulatingWebhook(true);
    try {
      const randomPhone = '09' + Math.floor(10000000 + Math.random() * 90000000);
      const res = await simulateMetaWebhook({
        customer_name: 'Khách Test Realtime Meta Webhook',
        customer_phone: randomPhone,
        message_text: `Chào shop AD Luxury, em muốn đăng ký tư vấn tour! SĐT liên hệ của em là ${randomPhone}`,
        page_id: pageId || '100234567890123'
      });

      if (res.success) {
        toast.success(`⚡ Bắn Webhook Realtime thành công! Đã tạo Lead test [${randomPhone}] & đẩy vào hệ thống.`);
        loadData();
      } else {
        toast.error(res.error || 'Lỗi khi giả lập Webhook Meta');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi giả lập Webhook Meta');
    } finally {
      setIsSimulatingWebhook(false);
    }
  };

  // Lưu cấu hình CAPI
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pixelId.trim()) {
      toast.error('Vui lòng nhập Meta Pixel ID / Dataset ID');
      return;
    }

    setIsSavingConfig(true);
    try {
      const res = await saveMetaCapiConfig({
        pixel_id: pixelId.trim(),
        access_token: accessToken.trim(),
        test_event_code: testEventCode.trim() || undefined,
        is_enabled: isEnabled
      });

      if (res.success) {
        toast.success('Đã lưu cấu hình Meta CAPI thành công!');
        loadData();
      } else {
        toast.error(res.error || 'Lỗi khi lưu cấu hình');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Lưu cấu hình Pancake
  const handleSavePancakeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pancakeApiKey.trim()) {
      toast.error('Vui lòng nhập Pancake Public API Token');
      return;
    }

    setIsSavingPancake(true);
    try {
      const res = await savePancakeConfig({
        api_key: pancakeApiKey.trim(),
        is_active: isPancakeActive
      });

      if (res.success) {
        toast.success('Đã lưu cấu hình Pancake Public API thành công!');
        loadData();
      } else {
        toast.error(res.error || 'Lỗi khi lưu cấu hình Pancake');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình Pancake');
    } finally {
      setIsSavingPancake(false);
    }
  };

  // Kiểm tra kết nối Pancake
  const handleTestPancakeConnection = async () => {
    setIsTestingPancake(true);
    try {
      const res = await testPancakeConnection(pancakeApiKey.trim());
      if (res.success && res.pages) {
        setPancakePages(res.pages);
        toast.success(`✅ Kết nối Pancake thành công! Đã tìm thấy ${res.pages.length} Fanpage.`);
      } else {
        toast.error(res.error || 'Không thể kết nối Pancake API với Token này.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi kiểm tra kết nối Pancake');
    } finally {
      setIsTestingPancake(false);
    }
  };

  // Đồng bộ khách hàng tiềm năng từ Pancake
  const handleSyncPancake = async () => {
    setIsSyncingPancake(true);
    try {
      const res = await syncPancakeLeads();
      if (res.success) {
        toast.success(`⚡ Đồng bộ thành công! Quét ${res.conversations_checked || 0} hội thoại & khách hàng, lưu ${res.leads_synced || 0} khách (${res.phones_found || 0} SĐT).`);
        loadData();
      } else {
        toast.error(res.error || 'Lỗi khi đồng bộ dữ liệu Pancake');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi đồng bộ Pancake');
    } finally {
      setIsSyncingPancake(false);
    }
  };

  // Chuyển tới trang tạo booking khi click vào lead
  const handleSelectLeadForBooking = (lead: MetaLead) => {
    navigate('/', {
      state: {
        prefillCustomerName: lead.customer_name,
        prefillCustomerPhone: lead.customer_phone,
        prefillCustomerEmail: lead.customer_email,
        prefillMetaLeadId: lead.id,
        prefillUtmCampaign: lead.utm_campaign,
        prefillNotes: lead.notes || lead.last_message
      }
    });
  };

  // Test kết nối sự kiện
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const res = await testMetaConnection({
        pixel_id: pixelId.trim() || undefined,
        access_token: (!accessToken.includes('...') && accessToken.trim()) ? accessToken.trim() : undefined,
        test_event_code: testEventCode.trim() || undefined
      });

      if (res.success) {
        toast.success(res.message || 'Kết nối Meta CAPI thành công mỹ mãn!');
        loadData();
      } else {
        toast.error(res.error || 'Kiểm tra kết nối thất bại');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi kiểm tra kết nối Meta CAPI');
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Chẩn đoán Token & Quyền Meta
  const handleDiagnoseToken = async () => {
    const tokenToTest = accessToken.trim();

    setIsDiagnosing(true);
    setDiagnosisResult(null);
    try {
      const res = await fetch('/api/meta-capi/diagnose-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: tokenToTest || undefined,
          pageId: pageId.trim() || undefined,
          pixelId: pixelId.trim() || undefined,
          adAccountId: adAccountId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.diagnosis) {
        setDiagnosisResult(data.diagnosis);
        if (data.diagnosis.tokenValid) {
          toast.success('Đã hoàn tất chẩn đoán kết nối Meta API!');
        } else {
          toast.error('Token không hợp lệ hoặc đã hết hạn.');
        }
      } else {
        toast.error(data.message || 'Lỗi khi chẩn đoán kết nối.');
      }
    } catch (err: any) {
      toast.error('Lỗi gọi API chẩn đoán: ' + err.message);
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Thống kê tổng quan
  const stats = useMemo(() => {
    const totalEvents = logs.length;
    const successEvents = logs.filter(l => l.status === 'success').length;
    const leadEvents = logs.filter(l => l.event_name === 'Lead' || l.tracking_type === 'PHONE_LEAD' || l.tracking_type === 'ORDER_CREATED');
    const purchaseEvents = logs.filter(l => l.event_name === 'Purchase' || l.tracking_type === 'PURCHASE_REVENUE');
    
    const totalTrackedRevenue = purchaseEvents
      .filter(l => l.status === 'success')
      .reduce((sum, l) => sum + (Number(l.revenue_value) || 0), 0);

    const successRate = totalEvents > 0 ? Math.round((successEvents / totalEvents) * 100) : 100;

    return {
      totalEvents,
      successEvents,
      leadCount: leadEvents.length,
      purchaseCount: purchaseEvents.length,
      totalTrackedRevenue,
      successRate
    };
  }, [logs]);

  // Thống kê hiệu quả theo Campaign / UTM Source
  const campaignStats = useMemo(() => {
    const campaignsMap: Record<string, {
      campaign: string;
      source: string;
      leadCount: number;
      orderCount: number;
      totalRevenue: number;
    }> = {};

    // 1. Phân tích từ orders
    orders.forEach(order => {
      const campName = order.utm_campaign || order.meta_lead_id ? (order.utm_campaign || 'Meta Ads Direct') : 'Chưa gắn UTM';
      const srcName = order.utm_source || (order.meta_lead_id ? 'facebook' : 'Trực tiếp / Khác');
      const key = `${campName}__${srcName}`;

      if (!campaignsMap[key]) {
        campaignsMap[key] = {
          campaign: campName,
          source: srcName,
          leadCount: 0,
          orderCount: 0,
          totalRevenue: 0
        };
      }

      campaignsMap[key].orderCount += 1;
      campaignsMap[key].totalRevenue += (Number(order.total_price) || 0);
    });

    // 2. Phân tích từ logs
    logs.forEach(log => {
      const campName = log.payload?.data?.[0]?.custom_data?.utm_campaign || log.payload?.utm_campaign || (log.meta_lead_id ? 'Meta Ads Lead' : 'Chưa gắn UTM');
      const srcName = log.payload?.data?.[0]?.custom_data?.utm_source || (log.meta_lead_id ? 'facebook' : 'Khác');
      const key = `${campName}__${srcName}`;

      if (!campaignsMap[key]) {
        campaignsMap[key] = {
          campaign: campName,
          source: srcName,
          leadCount: 0,
          orderCount: 0,
          totalRevenue: 0
        };
      }

      if (log.event_name === 'Lead') {
        campaignsMap[key].leadCount += 1;
      }
    });

    return Object.values(campaignsMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [orders, logs]);

  // Lọc logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Lọc loại sự kiện
      if (selectedEventFilter !== 'all' && log.event_name !== selectedEventFilter) {
        return false;
      }
      // Lọc trạng thái
      if (selectedStatusFilter !== 'all' && log.status !== selectedStatusFilter) {
        return false;
      }
      // Tìm kiếm từ khóa
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchPhone = log.customer_phone?.toLowerCase().includes(term);
        const matchTour = log.tour_code?.toLowerCase().includes(term);
        const matchEventId = log.event_id?.toLowerCase().includes(term);
        const matchLeadId = log.meta_lead_id?.toLowerCase().includes(term);
        if (!matchPhone && !matchTour && !matchEventId && !matchLeadId) {
          return false;
        }
      }
      return true;
    });
  }, [logs, selectedEventFilter, selectedStatusFilter, searchTerm]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                <Megaphone className="w-3.5 h-3.5" /> Meta Ads Conversions API (CAPI)
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${isEnabled && pixelId ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                {isEnabled && pixelId ? '● Đang hoạt động' : '○ Chưa kết nối'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Đo Lường Hiệu Quả & Đồng Bộ Meta Ads
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Hệ thống tự động mã hóa PII (SHA-256) và bắn sự kiện chuyển đổi (Lead, Phone Lead, Purchase Doanh Thu) từ CRM về Meta Graph API chuẩn xác 100%.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => loadData()}
              disabled={isLoadingLogs}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all backdrop-blur-sm border border-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/30"
            >
              <Sliders className="w-4 h-4" />
              Cài đặt CAPI
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 Chỉ số KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng Sự Kiện Chuyển Đổi</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-800">{stats.totalEvents.toLocaleString('vi-VN')}</span>
            <span className="text-xs font-medium text-emerald-600">Đã bắn Meta</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Tỷ lệ thành công: <strong className="text-slate-700">{stats.successRate}%</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Leads / Đặt Tour Meta</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <PhoneCall className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-800">{stats.leadCount.toLocaleString('vi-VN')}</span>
            <span className="text-xs font-medium text-amber-600">Khách tiềm năng</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Gồm Lead SĐT & Đơn đặt tour tạo mới
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đơn Thu Tiền (Purchase)</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-800">{stats.purchaseCount.toLocaleString('vi-VN')}</span>
            <span className="text-xs font-medium text-emerald-600">Đã chốt & thu cọc</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Tự động gửi khi Kế toán duyệt Phiếu thu
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Doanh Thu Ghi Nhận Meta</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-indigo-700">{formatCurrency(stats.totalTrackedRevenue)}</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Tối ưu ROAS chiến dịch
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('leads')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'leads'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" /> Khách Hàng Tiềm Năng (Leads Hub) ({leads.length})
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Tổng Quan Hiệu Quả
        </button>

        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'campaigns'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" /> Báo Cáo Chiến Dịch UTM ({campaignStats.length})
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'logs'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" /> Nhật Ký Chuyển Đổi Meta ({filteredLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4" /> Cấu Hình Meta CAPI & Pancake
        </button>
      </div>

      {/* TAB KHÁCH HÀNG TIỀM NĂNG (LEADS HUB) */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Trung Tâm Khách Hàng Tiềm Năng (Messenger & Pancake)
                </h3>
                <p className="text-xs text-slate-600">
                  Tự động quét số điện thoại từ tin nhắn Pancake Fanpage & Meta Lead Form. Bấm nút bên cạnh để đồng bộ tức thì.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSyncPancake}
                disabled={isSyncingPancake}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPancake ? 'animate-spin' : ''}`} />
                {isSyncingPancake ? 'Đang đồng bộ...' : '⚡ Đồng bộ từ Pancake ngay'}
              </button>
            </div>
          </div>

          <PotentialLeadsTab onSelectLeadForBooking={handleSelectLeadForBooking} />
        </div>
      )}

      {/* TAB 1: TỔNG QUAN HIỆU QUẢ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Dashboard Recharts Báo Cáo Hiệu Suất Quảng Cáo Meta */}
          <MetaAdsPerformanceDashboard
            leads={leads}
            orders={orders}
            conversionLogs={logs}
            onRefresh={loadData}
            isLoading={isLoadingLogs}
          />

          {/* Hướng dẫn luồng dữ liệu CAPI */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Quy Trình Đo Lường & Tối Ưu Chiến Dịch Meta Ads (Conversions API)
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-1">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">1</span>
                  Thu Thập & Ghi Nhận Lead
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Khi khách điền biểu mẫu Lead, gọi điện hoặc Nhân viên Sale tạo đơn hàng mới trên CRM, hệ thống tự động gắn UTM, Meta Lead ID và chuẩn hóa số điện thoại theo chuẩn quốc tế <strong>84xxxxxxxxx</strong>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-1">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">2</span>
                  Mã Hóa Bảo Mật PII (SHA-256)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Mọi thông tin cá nhân (SĐT, Email, Tên) được mã hóa một chiều chuẩn <strong>SHA-256</strong> trước khi gửi lên Meta Graph API v19.0, tuân thủ nghiêm ngặt chính sách bảo mật dữ liệu khách hàng.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-1">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">3</span>
                  Bắn Doanh Thu Thực (Purchase)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Khi Kế toán duyệt Phiếu thu hoặc xác nhận thanh toán cọc/toàn phần, sự kiện <strong>Purchase</strong> kèm giá trị tiền thật (VND) được gửi về Meta để tối ưu máy học phân phối quảng cáo chính xác khách có tiền.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BÁO CÁO CHI TIẾT CHIẾN DỊCH UTM */}
      {activeTab === 'campaigns' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Hiệu Quả Chiến Dịch Meta Ads & Kênh Bán Hàng</h2>
              <p className="text-xs text-slate-500">Đối soát doanh số thực tế từ chiến dịch quảng cáo Facebook / Meta Ads</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase">
                  <th className="py-3.5 px-4">Chiến Dịch (Campaign)</th>
                  <th className="py-3.5 px-4">Nguồn (Source)</th>
                  <th className="py-3.5 px-4 text-center">Số Lead Ghi Nhận</th>
                  <th className="py-3.5 px-4 text-center">Số Đơn Hàng</th>
                  <th className="py-3.5 px-4 text-right">Tổng Doanh Thu</th>
                  <th className="py-3.5 px-4 text-right">Giá Trị Đơn Trung Bình</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {campaignStats.map((camp, idx) => {
                  const aov = camp.orderCount > 0 ? Math.round(camp.totalRevenue / camp.orderCount) : 0;
                  return (
                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {camp.campaign}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                          {camp.source}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-amber-600">
                        {camp.leadCount.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-emerald-600">
                        {camp.orderCount.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-indigo-700 text-sm">
                        {formatCurrency(camp.totalRevenue)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-600">
                        {formatCurrency(aov)}
                      </td>
                    </tr>
                  );
                })}
                {campaignStats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      Chưa có dữ liệu chiến dịch.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: NHẬT KÝ SỰ KIỆN CONVERSION LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Nhật Ký Sự Kiện Chuyển Đổi Meta (CAPI Logs)</h2>
              <p className="text-xs text-slate-500">Tra cứu chi tiết từng sự kiện Lead & Purchase được gửi về Meta Events Manager</p>
            </div>

            {/* Bộ lọc tìm kiếm */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm SĐT, Tour, Event ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-60"
                />
              </div>

              <select
                value={selectedEventFilter}
                onChange={(e) => setSelectedEventFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">Tất cả loại sự kiện</option>
                <option value="Lead">Lead (Khách tiềm năng)</option>
                <option value="Purchase">Purchase (Doanh thu)</option>
                <option value="Contact">Contact</option>
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="success">Thành công (Success)</option>
                <option value="error">Lỗi (Error)</option>
                <option value="pending_config">Chờ cấu hình</option>
              </select>
            </div>
          </div>

          {/* Table Logs */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase">
                  <th className="py-3 px-3">Thời gian</th>
                  <th className="py-3 px-3">Sự Kiện Meta</th>
                  <th className="py-3 px-3">Khách Hàng / SĐT</th>
                  <th className="py-3 px-3">Tour / Đơn Hàng</th>
                  <th className="py-3 px-3 text-right">Giá Trị (VND)</th>
                  <th className="py-3 px-3 text-center">Trạng Thái</th>
                  <th className="py-3 px-3 text-center">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLogs.map((log) => {
                  const logDate = new Date(log.created_at);
                  const formattedDate = !isNaN(logDate.getTime()) 
                    ? `${String(logDate.getHours()).padStart(2, '0')}:${String(logDate.getMinutes()).padStart(2, '0')} ${String(logDate.getDate()).padStart(2, '0')}/${String(logDate.getMonth() + 1).padStart(2, '0')}/${logDate.getFullYear()}`
                    : log.created_at;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap font-medium">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                          log.event_name === 'Purchase' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {log.event_name}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">
                          {log.customer_phone || (log.hashed_phone ? `SHA256: ${log.hashed_phone.substring(0, 8)}...` : 'Chưa có SĐT')}
                        </div>
                        {log.customer_email && (
                          <div className="text-[11px] text-slate-500">{log.customer_email}</div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-700">{log.tour_code || 'Chưa gán Tour'}</div>
                        {log.order_id && (
                          <div className="text-[11px] text-slate-400">Đơn #{log.order_id.substring(0, 8)}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-800 whitespace-nowrap">
                        {Number(log.revenue_value) > 0 ? formatCurrency(Number(log.revenue_value)) : '-'}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {log.status === 'success' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Thành công
                          </span>
                        )}
                        {log.status === 'error' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200" title={log.error_message || ''}>
                            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Báo lỗi
                          </span>
                        )}
                        {log.status === 'pending_config' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200" title={log.error_message || ''}>
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Thiếu Cài Đặt
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setSelectedLogDetail(log)}
                          className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                        >
                          Xem JSON
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      Không tìm thấy log chuyển đổi nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CÀI ĐẶT CẤU HÌNH META PIXEL, CAPI & PANCAKE */}
      {activeTab === 'settings' && (
        <div className="space-y-6">

          {/* KHỐI CẤU HÌNH PANCAKE PUBLIC API & FANPAGE CHAT */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-xs font-bold text-base">
                  🥞
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Kết Nối Pancake Public API & Chat Messenger
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                      Pancake v1
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tự động đồng bộ các hội thoại khách hàng trên Pancake, trích xuất Số Điện Thoại & Lead gửi về CRM và bắn CAPI.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncPancake}
                  disabled={isSyncingPancake}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPancake ? 'animate-spin' : ''}`} />
                  {isSyncingPancake ? 'Đang đồng bộ...' : '⚡ Đồng bộ từ Pancake'}
                </button>
              </div>
            </div>

            <form onSubmit={handleSavePancakeConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Pancake Public API Access Token <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPancakeKey ? 'text' : 'password'}
                    placeholder="Dán mã Token từ Pancake (Bắt đầu bằng eyJhbGciOi...)"
                    value={pancakeApiKey}
                    onChange={(e) => setPancakeApiKey(e.target.value)}
                    className="w-full text-sm px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPancakeKey(!showPancakeKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPancakeKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-orange-600" />
                    Hướng dẫn lấy Token trên Pancake (pages.fm):
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500">
                    <li>
                      <strong className="text-slate-700">Cách 1 (Quét tất cả Fanpage):</strong> Đăng nhập <em>pages.fm</em> &gt; Bấm vào <em>Ảnh đại diện tài khoản</em> (góc trên cùng bên phải) &gt; Chọn <strong>Cài đặt cá nhân</strong> &gt; Copy <strong>Mã truy cập API</strong>.
                    </li>
                    <li>
                      <strong className="text-slate-700">Cách 2 (Quét từng Fanpage):</strong> Mở Fanpage trên <em>pages.fm</em> &gt; Chọn <strong>Cài đặt</strong> (bánh răng) &gt; <strong>Công cụ</strong> &gt; Copy <strong>Page Access Token</strong>.
                    </li>
                  </ul>
                </div>
              </div>

              {/* AUTO-SYNC REALTIME POLLING ENGINE */}
              <div className="p-4 bg-orange-50/80 rounded-xl border border-orange-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-950">
                    <Zap className="w-4 h-4 text-orange-600 animate-pulse" />
                    Cơ Chế Tự Động Quét Nền Realtime (Auto-Sync Polling):
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                    Đang quét tự động mỗi 30s
                  </span>
                </div>

                <div className="text-[12px] text-slate-700 space-y-1.5 bg-white/80 p-3 rounded-lg border border-orange-100">
                  <p>
                    ⚡ <strong>Hoàn toàn tự động - Không cần cài Webhook:</strong> Do Pancake không mở mục cấu hình Webhook cho người dùng phổ thông, Tour CRM đã tích hợp sẵn <strong>Tiến trình Quét Ngầm (Background Worker)</strong>.
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    ● Mỗi <strong>30 giây</strong>, máy chủ tự động truy vấn qua API Pancake để lấy các cuộc trò chuyện, tin nhắn mới và bóc tách số điện thoại.<br />
                    ● Ngay khi phát hiện số điện thoại mới, hệ thống tự động lưu vào bảng <strong>Leads</strong> và kích hoạt sự kiện <strong>Meta Conversion API (Phone Lead)</strong> tức thì.
                  </p>
                </div>
              </div>

              {pancakePages.length > 0 && (
                <div className="p-3.5 bg-orange-50/60 rounded-xl border border-orange-200/80 space-y-2">
                  <span className="text-xs font-bold text-orange-900 block">
                    Danh Sách Fanpage Đã Kết Nối Trên Pancake ({pancakePages.length} trang):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {pancakePages.map(page => (
                      <span
                        key={page.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-slate-800 rounded-lg text-xs font-bold border border-orange-200 shadow-2xs"
                      >
                        <Check className="w-3.5 h-3.5 text-orange-600" />
                        {page.name} <span className="text-[10px] text-slate-400 font-normal">({page.id})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPancakeActive}
                    onChange={(e) => setIsPancakeActive(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                  />
                  <span className="text-xs font-bold text-slate-700">Bật tự động nhận diện khách hàng từ Pancake</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestPancakeConnection}
                    disabled={isTestingPancake}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <ShieldCheck className={`w-3.5 h-3.5 ${isTestingPancake ? 'animate-spin' : ''}`} />
                    {isTestingPancake ? 'Đang kiểm tra...' : '🔍 Kiểm Tra Kết Nối'}
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingPancake}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSavingPancake ? 'Đang lưu...' : 'Lưu Cấu Hình Pancake'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* CẤU HÌNH WEBHOOK META MESSENGER REALTIME (PHƯƠNG ÁN 1) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-600 animate-pulse" />
                  Cấu Hình Webhook Facebook Messenger (Realtime 100% - Phương Án 1)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nhận ngay số điện thoại và tin nhắn từ khách hàng trên Messenger theo thời gian thực (Realtime &lt; 0.5s) trực tiếp từ Meta.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                  Realtime Active
                </span>

                <button
                  type="button"
                  onClick={handleSimulateMetaWebhook}
                  disabled={isSimulatingWebhook}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${isSimulatingWebhook ? 'animate-spin' : ''}`} />
                  {isSimulatingWebhook ? 'Đang bắn test...' : '⚡ Bắn Thử Webhook Realtime'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  1. Webhook Callback URL (Điền vào Meta Developers / Page Webhook)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/api/meta-webhook`}
                    className="w-full text-xs font-mono px-3 py-2 bg-slate-50 rounded-xl border border-slate-300 text-slate-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/meta-webhook`);
                      toast.success('Đã copy Webhook Callback URL!');
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  2. Verify Token (Mã Xác Nhận Webhook)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value="adluxury_tour_crm_meta_webhook_token"
                    className="w-full text-xs font-mono px-3 py-2 bg-slate-50 rounded-xl border border-slate-300 text-slate-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('adluxury_tour_crm_meta_webhook_token');
                      toast.success('Đã copy Verify Token!');
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                  >
                    Copy Token
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs text-indigo-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-600" />
                Hướng dẫn tích hợp Webhook Realtime trên Meta for Developers / Fanpage:
              </div>
              <ol className="list-decimal pl-5 space-y-1 text-[11px] text-indigo-900">
                <li>Truy cập <strong>Meta Developers</strong> (developers.facebook.com) &gt; Chọn App của bạn &gt; Mục <strong>Webhooks</strong>.</li>
                <li>Chọn Object <strong>Page</strong> &gt; Nhấn <strong>Subscribe to this object</strong>.</li>
                <li>Dán <strong>Callback URL</strong> và <strong>Verify Token</strong> ở trên vào &gt; Nhấn <strong>Verify and Save</strong>.</li>
                <li>Tích chọn các trường sự kiện: <code>messages</code>, <code>messaging_postbacks</code>, <code>leadgen</code> để tự động nhận tin nhắn &amp; số điện thoại Realtime.</li>
              </ol>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-600" />
                Cấu Hình Kết Nối Meta Conversions API (CAPI) & Dataset
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Điền thông tin Meta Pixel ID / Dataset ID và Access Token để bắn dữ liệu chuyển đổi về Meta khi tạo/thanh toán đơn hàng.
              </p>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Meta Pixel ID / Dataset ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 123456789012345"
                      value={pixelId}
                      onChange={(e) => setPixelId(e.target.value)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      ID Fanpage Facebook (Page ID)
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 103836966010338"
                      value={pageId}
                      onChange={(e) => setPageId(e.target.value)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      ID Tài Khoản Quảng Cáo (Ad Account ID)
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: act_1234567890"
                      value={adAccountId}
                      onChange={(e) => setAdAccountId(e.target.value)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Mã Thử Nghiệm Sự Kiện (Test Event Code - CAPI)
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: TEST12345"
                      value={testEventCode}
                      onChange={(e) => setTestEventCode(e.target.value)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mã Truy Cập Hệ Thống / Page Token (Access Token) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showAccessToken ? 'text' : 'password'}
                      placeholder="Dán mã bắt đầu bằng EAATD... hoặc EAA..."
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      className="w-full text-sm px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccessToken(!showAccessToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showAccessToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Dán Page Access Token hoặc System User Token để hệ thống gọi Meta Graph API và Webhooks.
                  </p>
                </div>

                <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => setIsEnabled(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-700">Kích hoạt tự động bắn sự kiện CAPI</span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleDiagnoseToken}
                      disabled={isDiagnosing}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                    >
                      <ShieldCheck className={`w-4 h-4 ${isDiagnosing ? 'animate-spin' : ''}`} />
                      {isDiagnosing ? 'Đang kiểm tra...' : '🔍 Chẩn Đoán & Kiểm Tra Quyền Token'}
                    </button>

                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all disabled:opacity-50"
                    >
                      <Send className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
                      {isTestingConnection ? 'Đang test...' : 'Bắn Test Event'}
                    </button>

                    <button
                      type="submit"
                      disabled={isSavingConfig}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSavingConfig ? 'Đang lưu...' : 'Lưu Cấu Hình'}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Cột hướng dẫn */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />
                Hướng dẫn kiểm tra & kết nối
              </h3>

              <ol className="text-xs text-slate-600 space-y-2.5 list-decimal pl-4">
                <li>Dán mã <strong>Access Token</strong> của bạn vào ô bên cạnh.</li>
                <li>Bấm nút xanh lá <strong>"🔍 Chẩn Đoán & Kiểm Tra Quyền Token"</strong> để hệ thống quét toàn bộ quyền và trạng thái Webhook.</li>
                <li>Xem bảng kết quả chẩn đoán bên dưới để biết token hợp lệ hay thiếu quyền nào.</li>
                <li>Bấm <strong>Lưu Cấu Hình</strong> để hoàn tất.</li>
              </ol>

              <div className="pt-3 border-t border-slate-200 text-xs text-slate-500">
                Khi token có đủ quyền <code>pages_messaging</code> và <code>leads_retrieval</code>, hệ thống sẽ bắt trọn vẹn 100% tin nhắn và Lead Form từ Facebook.
              </div>
            </div>
          </div>

          {/* BẢNG KẾT QUẢ CHẨN ĐOÁN CHI TIẾT (NẾU ĐÃ BẤM CHẨN ĐOÁN) */}
          {diagnosisResult && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    diagnosisResult.tokenValid ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                  }`}>
                    {diagnosisResult.tokenValid ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      Kết Quả Chẩn Đoán Kết Nối Meta API
                    </h3>
                    <p className="text-xs text-slate-500">
                      {diagnosisResult.tokenValid 
                        ? `Mã Token Hợp Lệ • Chủ sở hữu: ${diagnosisResult.tokenOwner?.name || 'N/A'} (ID: ${diagnosisResult.tokenOwner?.id || 'N/A'})` 
                        : 'Mã Token Không Hợp Lệ Hoặc Đã Hết Hạn'}
                    </p>
                  </div>
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  diagnosisResult.tokenValid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {diagnosisResult.tokenValid ? '● ĐÃ XÁC THỰC' : '✕ LỖI KẾT NỐI'}
                </span>
              </div>

              {/* Lưới kiểm tra các thành phần */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Fanpage & Webhook Subscriptions */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase">1. Fanpage & Webhook</span>
                    {diagnosisResult.pageStatus?.isSubscribedToWebhook ? (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Đã kết nối Webhook
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Chưa Subscribed
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600">
                    <div><strong>Tên Trang:</strong> {diagnosisResult.pageStatus?.name || diagnosisResult.tokenOwner?.name || 'Chưa nhận diện'}</div>
                    <div><strong>Page ID:</strong> {diagnosisResult.pageStatus?.id || pageId || 'N/A'}</div>
                  </div>
                </div>

                {/* 2. Pixel / CAPI Dataset */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase">2. Pixel / Dataset CAPI</span>
                    {diagnosisResult.pixelStatus?.canAccess ? (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Quyền hợp lệ
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-500">
                        {pixelId ? '✕ Không truy cập được' : '○ Chưa nhập Pixel ID'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600">
                    <div><strong>Tên Pixel:</strong> {diagnosisResult.pixelStatus?.name || 'Dataset'}</div>
                    <div><strong>Pixel ID:</strong> {pixelId || 'Chưa điền'}</div>
                  </div>
                </div>

                {/* 3. Ad Account */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase">3. Tài Khoản Ads</span>
                    {diagnosisResult.adAccountStatus?.name ? (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Hoạt động
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-500">
                        {adAccountId ? '✕ Không tìm thấy' : '○ Tùy chọn'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600">
                    <div><strong>Tên TK:</strong> {diagnosisResult.adAccountStatus?.name || 'Tài khoản Ads'}</div>
                    <div><strong>Tiền tệ:</strong> {diagnosisResult.adAccountStatus?.currency || 'VND'}</div>
                  </div>
                </div>
              </div>

              {/* Danh sách Quyền hạn (Permissions) */}
              {diagnosisResult.permissions && diagnosisResult.permissions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Danh Sách Quyền Đã Cấp (Permissions):
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {diagnosisResult.permissions.map((p) => (
                      <span
                        key={p.name}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                          p.status === 'granted'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {p.status === 'granted' ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-slate-400" />}
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Gợi ý khắc phục (Recommendations) */}
              {diagnosisResult.recommendations.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Khuyến Nghị Khắc Phục Để Dữ Liệu Tự Động Đổ Về:
                  </div>
                  <ul className="text-xs text-amber-900 space-y-1 list-disc pl-5">
                    {diagnosisResult.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Lỗi thô nếu có */}
              {diagnosisResult.rawErrors.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-mono">
                  {diagnosisResult.rawErrors.join(' | ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL XEM CHI TIẾT LOG JSON */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold">Chi Tiết Sự Kiện Meta CAPI: {selectedLogDetail.event_name}</h3>
              </div>
              <button
                onClick={() => setSelectedLogDetail(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono">
              <div>
                <span className="font-bold text-slate-700 block mb-1">Payload Gửi Lên Meta Graph API:</span>
                <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(selectedLogDetail.payload, null, 2)}
                </pre>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">Phản Hồi Từ Meta Graph API (Response):</span>
                <pre className="bg-slate-950 text-blue-300 p-4 rounded-xl overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(selectedLogDetail.response_data, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLogDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl"
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
