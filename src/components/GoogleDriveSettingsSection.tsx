import React, { useState, useEffect } from 'react';
import { 
  HardDrive, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Save, 
  ExternalLink, 
  HelpCircle, 
  Zap, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Folder, 
  Key, 
  ShieldCheck, 
  Database,
  Cloud,
  Layers,
  ChevronDown,
  ChevronUp,
  Mail,
  User,
  PieChart
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

interface GoogleDriveConfigData {
  source: 'database' | 'env';
  is_active: boolean;
  client_id: string;
  client_secret_masked: string;
  has_client_secret: boolean;
  refresh_token_masked: string;
  has_refresh_token: boolean;
  parent_folder_id: string;
  service_account_email: string;
  has_service_key: boolean;
  account_email: string;
  updated_at: string | null;
  updated_by: string | null;
  env_fallback_available: boolean;
}

interface TestConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
  account?: {
    displayName: string;
    emailAddress: string;
    photoLink?: string;
  };
  storage?: {
    limit: number | null;
    usage: number;
    usageInDrive: number;
    usageInDriveTrash: number;
  };
  folder?: {
    id: string;
    name: string;
    canAddChildren: boolean;
  } | null;
}

export const GoogleDriveSettingsSection: React.FC = () => {
  const { session, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [config, setConfig] = useState<GoogleDriveConfigData | null>(null);
  const [authType, setAuthType] = useState<'oauth' | 'service_account'>('oauth');

  // Form states
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [parentFolderId, setParentFolderId] = useState('');
  const [serviceEmail, setServiceEmail] = useState('');
  const [serviceKey, setServiceKey] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Show/hide passwords
  const [showSecret, setShowSecret] = useState(false);
  const [showRefresh, setShowRefresh] = useState(false);
  const [showServiceKey, setShowServiceKey] = useState(false);

  // Test status
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Nạp cấu hình hiện tại
  const fetchConfig = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const token = session?.access_token;
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/drive/config', { headers });
      if (!res.ok) {
        throw new Error('Không thể nạp cấu hình Google Drive từ máy chủ.');
      }

      const data: GoogleDriveConfigData = await res.json();
      setConfig(data);

      setClientId(data.client_id || '');
      setParentFolderId(data.parent_folder_id || '');
      setServiceEmail(data.service_account_email || '');
      setIsActive(data.is_active !== false);

      if (data.service_account_email && !data.client_id) {
        setAuthType('service_account');
      } else {
        setAuthType('oauth');
      }

      // Xóa form password để không ghi đè nếu người dùng không sửa
      setClientSecret('');
      setRefreshToken('');
      setServiceKey('');
    } catch (err: any) {
      console.error('Fetch Drive config error:', err);
      if (!silent) {
        toast.error(err.message || 'Lỗi nạp cấu hình Google Drive');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Format dung lượng bytes sang GB / MB
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // 1. Kiểm tra kết nối realtime
  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      const token = session?.access_token;
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        client_id: authType === 'oauth' ? clientId : undefined,
        client_secret: authType === 'oauth' && clientSecret ? clientSecret : undefined,
        refresh_token: authType === 'oauth' && refreshToken ? refreshToken : undefined,
        parent_folder_id: parentFolderId || undefined,
        service_account_email: authType === 'service_account' ? serviceEmail : undefined,
        service_account_private_key: authType === 'service_account' && serviceKey ? serviceKey : undefined
      };

      const res = await fetch('/api/drive/test-connection', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setTestResult(data);

      if (data.success) {
        toast.success(`🎉 Kết nối thành công tới tài khoản ${data.account?.emailAddress || 'Google Drive'}!`);
      } else {
        toast.error(`❌ Kiểm tra thất bại: ${data.error || 'Không thể kết nối'}`);
      }
    } catch (err: any) {
      console.error('Test connection error:', err);
      const errObj = { success: false, error: err.message || 'Không thể gửi yêu cầu kiểm tra kết nối.' };
      setTestResult(errObj);
      toast.error(errObj.error);
    } finally {
      setTesting(false);
    }
  };

  // 2. Lưu cấu hình vào Supabase
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const token = session?.access_token;
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        client_id: authType === 'oauth' ? clientId.trim() : '',
        client_secret: authType === 'oauth' && clientSecret ? clientSecret.trim() : undefined,
        refresh_token: authType === 'oauth' && refreshToken ? refreshToken.trim() : undefined,
        parent_folder_id: parentFolderId.trim(),
        service_account_email: authType === 'service_account' ? serviceEmail.trim() : '',
        service_account_private_key: authType === 'service_account' && serviceKey ? serviceKey.trim() : undefined,
        account_email: testResult?.account?.emailAddress || profile?.email || '',
        is_active: isActive
      };

      const res = await fetch('/api/drive/config', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi lưu cấu hình Google Drive.');
      }

      toast.success('🎉 Đã cập nhật tài khoản Google Drive thành công!');
      await fetchConfig(true);
    } catch (err: any) {
      console.error('Save Drive config error:', err);
      toast.error(err.message || 'Lỗi lưu cấu hình Google Drive');
    } finally {
      setSaving(false);
    }
  };

  // 3. Khôi phục về biến môi trường (.env)
  const handleResetToEnv = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn khôi phục về cấu hình Google Drive mặc định từ file môi trường (.env) không?')) {
      return;
    }

    try {
      setResetting(true);
      const token = session?.access_token;
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/drive/reset-config', {
        method: 'POST',
        headers
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể khôi phục cấu hình.');
      }

      toast.success('Đã khôi phục về cấu hình Google Drive mặc định (.env)!');
      setTestResult(null);
      await fetchConfig();
    } catch (err: any) {
      console.error('Reset config error:', err);
      toast.error(err.message || 'Lỗi khôi phục cấu hình');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-600">Đang nạp thông tin kết nối Google Drive...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 backdrop-blur-xs">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <span>Tài Khoản Lưu Trữ Google Drive</span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/40">
                    Kho Đám Mây Chính
                  </span>
                </h2>
                <p className="text-xs text-blue-200/80 font-medium">
                  Quản lý tài khoản Google Drive dùng để lưu trữ ảnh đoàn tour, chứng từ thanh toán, hóa đơn kế toán và hồ sơ visa.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTestConnection()}
              disabled={testing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer backdrop-blur-xs shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
            </button>
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white transition-all cursor-pointer shadow-xs"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Hướng dẫn lấy Token</span>
              {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Nguồn cấu hình */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>Nguồn lưu trữ</span>
            </span>
            <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md border ${
              config?.source === 'database' 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              {config?.source === 'database' ? 'CSDL Supabase (Tùy chỉnh)' : 'Biến môi trường (.env)'}
            </span>
          </div>
          <div className="text-xs font-black text-slate-800">
            {config?.updated_at ? (
              <span className="text-[11px] text-slate-500 font-semibold block">
                Cập nhật lần cuối: {new Date(config.updated_at).toLocaleString('vi-VN')} {config.updated_by ? `bởi ${config.updated_by}` : ''}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 font-normal">Cấu hình khởi tạo mặc định</span>
            )}
          </div>
        </div>

        {/* Card 2: Tài khoản Drive */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-600" />
              <span>Tài khoản Google</span>
            </span>
            {testResult?.success ? (
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Hoạt động</span>
              </span>
            ) : (
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                Chờ kiểm tra
              </span>
            )}
          </div>
          <div className="text-xs font-extrabold text-slate-800 truncate">
            {testResult?.account?.emailAddress || config?.account_email || 'Chưa kiểm tra'}
          </div>
        </div>

        {/* Card 3: Thư mục cha & Quyền ghi */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-amber-600" />
              <span>Thư mục gốc (Root Folder)</span>
            </span>
            {testResult?.folder ? (
              <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md border ${
                testResult.folder.canAddChildren 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {testResult.folder.canAddChildren ? 'Toàn quyền ghi' : 'Chỉ xem'}
              </span>
            ) : (
              <span className="text-[11px] font-bold text-slate-400">Tự động tạo</span>
            )}
          </div>
          <div className="text-xs font-extrabold text-slate-800 truncate">
            {testResult?.folder?.name || (parentFolderId ? `ID: ${parentFolderId}` : 'Mặc định /AD Luxury Travel/')}
          </div>
        </div>
      </div>

      {/* Test Connection Details Banner (Nếu vừa test) */}
      {testResult && (
        <div className={`p-4 rounded-2xl border ${
          testResult.success 
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50/70 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-start gap-3">
            {testResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-2 flex-1">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider">
                  {testResult.success ? 'Kiểm tra xác thực Google Drive thành công' : 'Lỗi kết nối Google Drive'}
                </h4>
                <p className="text-xs font-medium mt-0.5">
                  {testResult.success 
                    ? `Đã xác thực thành công với tài khoản ${testResult.account?.displayName} (${testResult.account?.emailAddress}). Hệ thống sẵn sàng lưu trữ!` 
                    : testResult.error}
                </p>
              </div>

              {testResult.success && testResult.storage && (
                <div className="pt-2 border-t border-emerald-200/60 flex flex-wrap items-center gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <PieChart className="w-3.5 h-3.5 text-blue-600" />
                    <span>Dung lượng đã dùng:</span>
                    <strong className="text-slate-900">{formatBytes(testResult.storage.usage)}</strong>
                    {testResult.storage.limit && (
                      <span className="text-slate-500">/ {formatBytes(testResult.storage.limit)}</span>
                    )}
                  </div>
                  {testResult.folder && (
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Folder className="w-3.5 h-3.5 text-amber-600" />
                      <span>Thư mục cha:</span>
                      <strong className="text-emerald-800">{testResult.folder.name}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hướng dẫn 4 bước (Collapse) */}
      {showGuide && (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-2xl border border-blue-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-blue-200/80">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Hướng dẫn 4 bước lấy Client ID, Secret &amp; Refresh Token</span>
            </h3>
            <button
              onClick={() => setShowGuide(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              Đóng
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="font-extrabold text-blue-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">1</span>
                <span>Tạo OAuth 2.0 Credentials trên Google Cloud</span>
              </div>
              <p className="text-slate-600 font-medium leading-relaxed">
                Truy cập <strong>Google Cloud Console</strong> &gt; Bật <strong>Google Drive API</strong> &gt; Tạo <strong>OAuth Client ID</strong> (Loại Web Application).
              </p>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
              >
                <span>Mở Google Cloud Console</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="font-extrabold text-blue-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">2</span>
                <span>Cấu hình Redirect URI trong Google Cloud</span>
              </div>
              <p className="text-slate-600 font-medium leading-relaxed">
                Trong mục <em>Authorized redirect URIs</em>, thêm địa chỉ:
                <br />
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-800 select-all">
                  https://developers.google.com/oauthplayground
                </code>
              </p>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="font-extrabold text-blue-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">3</span>
                <span>Lấy Refresh Token tại OAuth Playground</span>
              </div>
              <p className="text-slate-600 font-medium leading-relaxed">
                Mở <strong>Google OAuth Playground</strong> &gt; Bấm biểu tượng ⚙️ (góc phải) &gt; Tick chọn <em>Use your own OAuth credentials</em> &gt; Điền Client ID &amp; Secret &gt; Chọn scope <code>https://www.googleapis.com/auth/drive</code> &gt; Bấm <em>Authorize APIs</em> &gt; Đăng nhập và bấm <em>Exchange authorization code for tokens</em>.
              </p>
              <a
                href="https://developers.google.com/oauthplayground"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
              >
                <span>Mở Google OAuth Playground</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="font-extrabold text-blue-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">4</span>
                <span>Lưu và Kiểm Tra Kết Nối</span>
              </div>
              <p className="text-slate-600 font-medium leading-relaxed">
                Dán <strong>Client ID</strong>, <strong>Client Secret</strong>, <strong>Refresh Token</strong> và <strong>ID Thư Mục Gốc</strong> (tùy chọn) vào form bên dưới &gt; Bấm <strong>Kiểm tra kết nối</strong> &gt; Bấm <strong>Lưu cấu hình</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form cấu hình */}
      <form onSubmit={handleSaveConfig} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-600" />
              <span>Cấu Hình Thông Tin Xác Thực Google Drive</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Cập nhật thông tin tài khoản Google Drive để toàn bộ hệ thống lưu trữ trực tiếp.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span>Kích hoạt lưu trữ Google Drive</span>
            </label>
          </div>
        </div>

        {/* Lựa chọn phương thức xác thực */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAuthType('oauth')}
            className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              authType === 'oauth'
                ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>OAuth 2.0 (Khuyên Dùng - Tài Khoản Cá Nhân / Google Workspace)</span>
          </button>

          <button
            type="button"
            onClick={() => setAuthType('service_account')}
            className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              authType === 'service_account'
                ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Service Account (JSON Key Dịch Vụ)</span>
          </button>
        </div>

        {/* Các trường nhập liệu OAuth 2.0 */}
        {authType === 'oauth' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Google Client ID *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Ví dụ: 123456789-abcdefgh.apps.googleusercontent.com"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required={isActive}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Client ID được tạo trong mục Credentials của Google Cloud Console.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                  <span>Google Client Secret {config?.has_client_secret ? '(Đã lưu)' : '*'}</span>
                  {config?.has_client_secret && !clientSecret && (
                    <span className="text-[10px] text-emerald-600 lowercase font-medium">giữ nguyên nếu không đổi</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={config?.has_client_secret ? '•••••••••••••••• (Đã cấu hình)' : 'Nhập Client Secret...'}
                    className="w-full h-10 pl-3.5 pr-10 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                    required={isActive && !config?.has_client_secret}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                  <span>Refresh Token {config?.has_refresh_token ? '(Đã lưu)' : '*'}</span>
                  {config?.has_refresh_token && !refreshToken && (
                    <span className="text-[10px] text-emerald-600 lowercase font-medium">giữ nguyên nếu không đổi</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showRefresh ? 'text' : 'password'}
                    value={refreshToken}
                    onChange={(e) => setRefreshToken(e.target.value)}
                    placeholder={config?.has_refresh_token ? '•••••••••••••••• (Đã cấu hình)' : 'Nhập Refresh Token 1//...'}
                    className="w-full h-10 pl-3.5 pr-10 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                    required={isActive && !config?.has_refresh_token}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRefresh(!showRefresh)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showRefresh ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Các trường nhập liệu Service Account */}
        {authType === 'service_account' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Service Account Email *
              </label>
              <input
                type="email"
                value={serviceEmail}
                onChange={(e) => setServiceEmail(e.target.value)}
                placeholder="Ví dụ: drive-storage@ad-luxury-tour.iam.gserviceaccount.com"
                className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required={isActive && authType === 'service_account'}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                <span>Private Key (PEM) {config?.has_service_key ? '(Đã lưu)' : '*'}</span>
                {config?.has_service_key && !serviceKey && (
                  <span className="text-[10px] text-emerald-600 lowercase font-medium">giữ nguyên nếu không đổi</span>
                )}
              </label>
              <textarea
                value={serviceKey}
                onChange={(e) => setServiceKey(e.target.value)}
                placeholder={config?.has_service_key ? '-----BEGIN PRIVATE KEY-----\n••••••••••••••••\n-----END PRIVATE KEY-----' : '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs font-mono text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required={isActive && authType === 'service_account' && !config?.has_service_key}
              />
            </div>
          </div>
        )}

        {/* Thư mục cha (Parent Folder ID) */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-amber-600" />
              <span>ID Thư Mục Gốc Lưu Trữ (Google Drive Parent Folder ID)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium lowercase">tùy chọn (để trống sẽ tạo thư mục mặc định)</span>
          </label>
          <input
            type="text"
            value={parentFolderId}
            onChange={(e) => setParentFolderId(e.target.value)}
            placeholder="Ví dụ: 1a2B3c4D5e6F7g8H9i0JkLmNoPqRsTuVw"
            className="w-full h-10 px-3.5 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
          />
          <p className="text-[11px] text-slate-500 font-medium">
            💡 Mở thư mục trên Google Drive bằng trình duyệt, copy chuỗi ký tự ở cuối đường link sau <code>/folders/<strong>[ID-THƯ-MỤC]</strong></code>.
          </p>
        </div>

        {/* Nút hành động */}
        <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            {config?.source === 'database' && (
              <button
                type="button"
                onClick={handleResetToEnv}
                disabled={resetting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
                <span>Khôi phục về cấu hình .env</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Đang lưu...' : 'Lưu và Áp Dụng Cấu Hình'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
