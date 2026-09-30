import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Save, 
  ExternalLink, 
  HelpCircle, 
  Sliders, 
  Zap, 
  ArrowRightLeft, 
  Check, 
  Layers, 
  ShieldCheck, 
  Database,
  Share2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface WooCommerceConfigState {
  site_url: string;
  consumer_key: string;
  consumer_secret: string;
  is_active: boolean;
  auto_sync_on_save: boolean;
  auto_sync_on_booking: boolean;
  field_mappings: Record<string, string>;
  has_secret?: boolean;
}

const DEFAULT_MAPPINGS: Record<string, { label: string; desc: string; defaultKey: string }> = {
  start_date: { label: 'Ngày khởi hành', desc: 'Lưu ngày đi (định dạng YYYY-MM-DD)', defaultKey: 'ngay_khoi_hanh' },
  end_date: { label: 'Ngày kết thúc / Ngày về', desc: 'Lưu ngày về', defaultKey: 'ngay_ve' },
  duration: { label: 'Thời lượng tour', desc: 'Số ngày đêm (VD: 5 ngày 4 đêm)', defaultKey: 'thoi_luong' },
  price_child: { label: 'Giá vé trẻ em', desc: 'Giá tour cho trẻ em (VNĐ)', defaultKey: 'gia_tre_em' },
  price_infant: { label: 'Giá vé em bé', desc: 'Giá tour cho em bé dưới 2 tuổi (VNĐ)', defaultKey: 'gia_em_be' },
  single_room_surcharge: { label: 'Phụ thu phòng đơn', desc: 'Chi phí ở phòng đơn (VNĐ)', defaultKey: 'phu_thu_phong_don' },
  price_visa_tour: { label: 'Phí dịch vụ Visa', desc: 'Chi phí làm visa nếu có', defaultKey: 'phi_visa' },
  airline: { label: 'Hãng hàng không', desc: 'Hãng bay phụ trách (Vietnam Airlines, Bamboo...)', defaultKey: 'hang_hang_khong' },
  hotel: { label: 'Khách sạn / Tiêu chuẩn', desc: 'Khách sạn lưu trú (3 sao, 4 sao, 5 sao...)', defaultKey: 'khach_san' },
  destination: { label: 'Điểm đến / Quốc gia', desc: 'Quốc gia hoặc thành phố tour đến', defaultKey: 'diem_den' },
  itinerary_pdf_url: { label: 'Link file PDF lịch trình', desc: 'Đường dẫn file PDF chương trình chi tiết', defaultKey: 'link_lich_trinh' },
  flight_out: { label: 'Chuyến bay đi', desc: 'Mã chuyến bay đi & giờ bay', defaultKey: 'chuyen_bay_di' },
  flight_in: { label: 'Chuyến bay về', desc: 'Mã chuyến bay về & giờ bay', defaultKey: 'chuyen_bay_ve' },
};

export default function WooCommerceSettingsSection() {
  const [config, setConfig] = useState<WooCommerceConfigState>({
    site_url: '',
    consumer_key: '',
    consumer_secret: '',
    is_active: true,
    auto_sync_on_save: false,
    auto_sync_on_booking: false,
    field_mappings: Object.fromEntries(
      Object.entries(DEFAULT_MAPPINGS).map(([k, v]) => [k, v.defaultKey])
    )
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    version?: string;
    total_products?: number;
  } | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'connection' | 'acf_mapping' | 'bulk_sync'>('connection');

  // Load config on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/woocommerce/config');
      const json = await res.json();
      if (json.success && json.data) {
        setConfig({
          site_url: json.data.site_url || '',
          consumer_key: json.data.consumer_key || '',
          consumer_secret: json.data.consumer_secret || '',
          is_active: json.data.is_active ?? true,
          auto_sync_on_save: json.data.auto_sync_on_save ?? false,
          auto_sync_on_booking: json.data.auto_sync_on_booking ?? false,
          field_mappings: {
            ...Object.fromEntries(Object.entries(DEFAULT_MAPPINGS).map(([k, v]) => [k, v.defaultKey])),
            ...(json.data.field_mappings || {})
          },
          has_secret: json.data.has_secret
        });
      }
    } catch (err) {
      console.error('Lỗi khi tải cấu hình WooCommerce:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setIsSaving(true);
      const res = await fetch('/api/woocommerce/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Đã lưu cấu hình kết nối WooCommerce thành công!');
        if (json.data) {
          setConfig(prev => ({
            ...prev,
            ...json.data,
            has_secret: json.data.has_secret
          }));
        }
      } else {
        toast.error(json.message || 'Lưu cấu hình thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi mạng khi lưu cấu hình: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await fetch('/api/woocommerce/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const json = await res.json();
      setTestResult(json);
      if (json.success) {
        toast.success(json.message);
      } else {
        toast.error(json.message);
      }
    } catch (err: any) {
      const msg = 'Lỗi kết nối tới máy chủ: ' + err.message;
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncAllTours = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn đồng bộ toàn bộ Tour hiện có sang Website WordPress không? Quá trình này có thể mất từ 10 - 30 giây.')) {
      return;
    }

    try {
      setIsSyncingAll(true);
      const res = await fetch('/api/woocommerce/sync-all-tours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Đã đồng bộ thành công ${json.synced}/${json.total} tour sang Website!`);
      } else {
        toast.error(json.message || 'Đồng bộ thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi đồng bộ: ' + err.message);
    } finally {
      setIsSyncingAll(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-600">Đang tải cấu hình kết nối WooCommerce & ACF...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black tracking-tight">Tích Hợp Website WordPress (WooCommerce + ACF)</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                REST API v3
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Tự động hóa đồng bộ giá tour, ngày khởi hành, mã tour, số chỗ trống khả dụng và các trường thông tin nâng cao (ACF) từ Tour CRM sang website bán tour WordPress của bạn chỉ với 1 cú click.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSaveConfig()}
              disabled={isSaving}
              className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}</span>
            </button>
          </div>
        </div>

        {/* Live connection badge */}
        {testResult && (
          <div className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2.5 border transition-all ${
            testResult.success
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}>
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <div className="flex-1">
              <span>{testResult.message}</span>
              {testResult.total_products !== undefined && (
                <span className="ml-2 font-normal text-slate-300">
                  (Tổng số sản phẩm WooCommerce hiện tại: {testResult.total_products})
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex bg-slate-100 rounded-2xl p-1 border border-slate-200 shadow-2xs gap-1">
        <button
          type="button"
          onClick={() => setActiveSubTab('connection')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === 'connection'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>1. Cấu hình kết nối API</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('acf_mapping')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === 'acf_mapping'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>2. Ghép trường ACF (Field Mapping)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('bulk_sync')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === 'bulk_sync'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>3. Đồng bộ hàng loạt & Tự động</span>
        </button>
      </div>

      {/* SUB-TAB 1: CẤU HÌNH KẾT NỐI API */}
      {activeSubTab === 'connection' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Thông Tin Xác Thực WooCommerce REST API</span>
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Các thông tin này được lấy từ mục Cài đặt Nâng cao trong WooCommerce của WordPress.
              </p>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              {/* Site URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  <span>Website URL (Tên miền WordPress) *</span>
                </label>
                <input
                  type="url"
                  placeholder="https://adluxury.vn"
                  required
                  value={config.site_url}
                  onChange={(e) => setConfig({ ...config, site_url: e.target.value })}
                  className="w-full h-10 px-3.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-2xs"
                />
                <p className="text-[11px] text-slate-500">
                  Nhập địa chỉ website có giao thức HTTPS đầy đủ (Ví dụ: <code className="text-blue-600">https://adluxury.vn</code>).
                </p>
              </div>

              {/* Consumer Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span>Consumer Key (Mã định danh API) *</span>
                </label>
                <input
                  type="text"
                  placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  required
                  value={config.consumer_key}
                  onChange={(e) => setConfig({ ...config, consumer_key: e.target.value })}
                  className="w-full h-10 px-3.5 border border-slate-300 rounded-xl text-xs font-mono font-medium text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-2xs"
                />
              </div>

              {/* Consumer Secret */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-600" />
                  <span>Consumer Secret (Mã bí mật API) *</span>
                </label>
                <input
                  type="password"
                  placeholder={config.has_secret ? '••••••••••••••••••••••••••••••••••••••••' : 'cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                  required={!config.has_secret}
                  value={config.consumer_secret}
                  onChange={(e) => setConfig({ ...config, consumer_secret: e.target.value })}
                  className="w-full h-10 px-3.5 border border-slate-300 rounded-xl text-xs font-mono font-medium text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-2xs"
                />
                <p className="text-[11px] text-slate-500">
                  Mã bí mật được bảo vệ an toàn ở máy chủ nội bộ và không bao giờ xuất hiện ở ngoài.
                </p>
              </div>

              {/* Kích hoạt kết nối */}
              <div className="pt-2">
                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={config.is_active}
                    onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Kích hoạt cổng kết nối với Website WordPress</span>
                    <span className="text-[11px] text-slate-500">Cho phép các tính năng đồng bộ tour và kiểm tra tình trạng chỗ trống hoạt động.</span>
                  </div>
                </label>
              </div>
            </form>
          </div>

          {/* Guide Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-150 rounded-2xl p-6 space-y-4 shadow-sm h-fit">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-600" />
              <h4 className="text-xs font-black text-blue-900 uppercase tracking-wide">Hướng Dẫn Lấy API Key</h4>
            </div>

            <ol className="text-xs text-slate-700 space-y-3 font-medium list-decimal list-inside leading-relaxed">
              <li>
                Đăng nhập vào trang quản trị <strong>WordPress Admin</strong> của website.
              </li>
              <li>
                Vào mục <strong>WooCommerce</strong> &gt; <strong>Cài đặt (Settings)</strong> &gt; Tab <strong>Nâng cao (Advanced)</strong>.
              </li>
              <li>
                Chọn mục <strong>REST API</strong> &gt; Bấm nút <strong>Thêm khóa (Add key)</strong>.
              </li>
              <li>
                Đặt mô tả: <span className="font-bold text-blue-700">Tour CRM Sync</span>.
              </li>
              <li>
                Mục Quyền (Permissions): Chọn <strong className="text-emerald-700">Đọc/Ghi (Read/Write)</strong>.
              </li>
              <li>
                Bấm <strong>Tạo khóa API</strong> và sao chép <em>Consumer Key</em> & <em>Consumer Secret</em> dán vào khung bên trái.
              </li>
            </ol>

            <div className="pt-3 border-t border-blue-200/60">
              <span className="text-[11px] text-blue-800 font-bold block mb-1">Lưu ý an toàn:</span>
              <p className="text-[11px] text-blue-700 leading-normal">
                Website của bạn cần chạy chứng chỉ bảo mật HTTPS (SSL) để WooCommerce REST API hoạt động ổn định.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: GHÉP TRƯỜNG ACF (FIELD MAPPING) */}
      {activeSubTab === 'acf_mapping' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Bảng Ghép Trường Thông Tin ACF (Advanced Custom Fields)</span>
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Khớp nối các trường dữ liệu của Tour CRM sang đúng tên định danh (Field Name / Slug) của plugin ACF trên website WordPress.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setConfig(prev => ({
                  ...prev,
                  field_mappings: Object.fromEntries(
                    Object.entries(DEFAULT_MAPPINGS).map(([k, v]) => [k, v.defaultKey])
                  )
                }));
                toast.success('Đã khôi phục về tên trường ACF mặc định');
              }}
              className="text-xs text-slate-500 hover:text-blue-600 font-bold transition-colors underline cursor-pointer"
            >
              Khôi phục về mặc định
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(DEFAULT_MAPPINGS).map(([fieldKey, meta]) => {
              const currentValue = config.field_mappings[fieldKey] || '';
              return (
                <div key={fieldKey} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 hover:border-slate-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      <span>{meta.label}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">CRM: {fieldKey}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 whitespace-nowrap">ACF Slug:</span>
                    <input
                      type="text"
                      value={currentValue}
                      placeholder={meta.defaultKey}
                      onChange={(e) => {
                        const newMappings = { ...config.field_mappings, [fieldKey]: e.target.value.trim() };
                        setConfig({ ...config, field_mappings: newMappings });
                      }}
                      className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-700 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <p className="text-[10px] text-slate-500 font-medium">
                    {meta.desc}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => handleSaveConfig()}
              disabled={isSaving}
              className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu bảng ghép trường ACF'}</span>
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ĐỒNG BỘ HÀNG LOẠT & TỰ ĐỘNG */}
      {activeSubTab === 'bulk_sync' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tùy chọn tự động */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Cơ Chế Đồng Bộ Tự Động (Auto-Sync)</span>
            </h4>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={config.auto_sync_on_save}
                  onChange={(e) => setConfig({ ...config, auto_sync_on_save: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer mt-0.5"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Tự động đồng bộ ngay khi Tạo hoặc Cập nhật Tour</span>
                  <span className="text-[11px] text-slate-500 leading-normal">
                    Khi Điều hành bấm "Lưu Tour" trên CRM, hệ thống sẽ tự động gửi dữ liệu sang WooCommerce để cập nhật ngay lập tức.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={config.auto_sync_on_booking}
                  onChange={(e) => setConfig({ ...config, auto_sync_on_booking: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer mt-0.5"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Tự động cập nhật số chỗ trống khi có Booking</span>
                  <span className="text-[11px] text-slate-500 leading-normal">
                    Khi Sales giữ chỗ hoặc chốt đơn làm giảm số chỗ còn lại, số lượng tồn kho trên website WordPress sẽ tự động được điều chỉnh.
                  </span>
                </div>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleSaveConfig()}
                disabled={isSaving}
                className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu thiết lập tự động'}</span>
              </button>
            </div>
          </div>

          {/* Nút bấm đồng bộ toàn bộ */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-blue-600" />
                <span>Đồng Bộ Toàn Bộ Danh Sách Tour (Bulk Sync)</span>
              </h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Đẩy toàn bộ các tour đang có trên Tour CRM lên website WordPress. Nếu sản phẩm đã tồn tại (trùng mã Tour/SKU), hệ thống sẽ cập nhật lại giá và ngày giờ mới nhất; nếu chưa có, hệ thống sẽ tự động tạo sản phẩm mới.
              </p>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Lưu ý trước khi bấm:</span>
              </span>
              <p className="text-[11px] leading-relaxed">
                Vui lòng đảm bảo bạn đã bấm <strong>"Kiểm tra kết nối"</strong> thành công ở Tab 1 trước khi thực hiện đồng bộ hàng loạt.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSyncAllTours}
              disabled={isSyncingAll}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
              <span>{isSyncingAll ? 'Đang đồng bộ toàn bộ Tour...' : 'Bắt đầu đồng bộ toàn bộ Tour sang Website'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
