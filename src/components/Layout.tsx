import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Map, 
  ShoppingCart, 
  FileText, 
  Receipt,
  Users,
  Settings,
  Bell,
  UserCheck,
  User,
  LayoutDashboard,
  TrendingUp,
  History,
  MessageSquarePlus,
  Menu,
  X,
  Smartphone,
  MoreHorizontal,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCRM } from '@/context/CRMContext';
import { useAuth } from '@/context/AuthContext';
import { Role } from '@/types';
import { FeedbackModal } from './FeedbackModal';


const navigation = [
  { name: 'Bảng điều khiển', href: '/dashboard', icon: LayoutDashboard, roleAccess: ['admin'] },
  { name: 'Điều hành chiến lược', href: '/dashboard/executive', icon: TrendingUp, roleAccess: ['admin'] },
  { name: 'Lịch khởi hành', href: '/', icon: Calendar, roleAccess: ['CTV', 'Đại lý', 'operator', 'sale', 'sale_leader', 'visa', 'accounting', 'admin'] },
  { name: 'Quản lý Tour', href: '/tours', icon: Map, roleAccess: ['operator', 'admin', 'sale_leader'] },
  { name: 'Dịch vụ Visa', href: '/visa-services', icon: FileText, roleAccess: ['operator', 'admin', 'sale', 'sale_leader', 'visa'] },
  { name: 'Booking Visa', href: '/visa-orders', icon: ShoppingCart, roleAccess: ['CTV', 'Đại lý', 'sale', 'sale_leader', 'visa', 'admin'] },
  { name: 'Quản lý Booking', href: '/orders', icon: ShoppingCart, roleAccess: ['CTV', 'Đại lý', 'sale', 'sale_leader', 'operator', 'admin'] },
  { name: 'Xử lý Visa', href: '/visa', icon: FileText, roleAccess: ['visa', 'admin'] },
  { name: 'Kế toán & Hóa đơn', href: '/accounting', icon: Receipt, roleAccess: ['accounting', 'admin'] },
  { name: 'Đại lý & CTV', href: '/customers', icon: Users, roleAccess: ['admin'] },
  { name: 'Khách hàng', href: '/passengers', icon: Users, roleAccess: ['operator', 'sale', 'sale_leader', 'visa', 'admin'] },
  { name: 'Nhật ký hệ thống', href: '/activity-logs', icon: History, roleAccess: ['admin'] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentRole, setCurrentRole, notifications: allNotifications, markNotificationAsRead, markAllNotificationsAsRead, orders, passengers } = useCRM();
  const { signOut, user, profile } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // PWA Install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPwaBanner, setShowPwaBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    setIsStandalone(standalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPwaBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setShowPwaBanner(false);
        }
        setDeferredPrompt(null);
      });
    }
  };

  // Close mobile menu when navigating
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleNotificationClick = (notif: any) => {
    setShowNotifications(false);
    if (notif.id) {
      markNotificationAsRead(notif.id);
    }

    let searchTarget = '';
    const hashMatch = (notif.message || '').match(/#([a-zA-Z0-9-]+)/) || (notif.title || '').match(/#([a-zA-Z0-9-]+)/);
    if (hashMatch && hashMatch[1]) {
      searchTarget = hashMatch[1];
    } else {
      const codeMatch = (notif.message || '').match(/(?:booking|đơn hàng|đơn giữ chỗ|mã)\s+([a-zA-Z0-9-]+)/i);
      if (codeMatch && codeMatch[1]) {
        searchTarget = codeMatch[1];
      } else if (notif.targetId) {
        if (notif.targetId.length > 8 && notif.targetId.includes('-')) {
          searchTarget = notif.targetId.substring(0, 8);
        } else {
          searchTarget = notif.targetId;
        }
      }
    }

    const isAccountingUser = ['accounting', 'admin'].includes(currentRole);
    const isVisaUser = ['visa', 'admin'].includes(currentRole);

    if (notif.type === 'accounting') {
      if (isAccountingUser) {
        let tab: 'receipts' | 'payments' | 'vat' = 'receipts';
        const msg = ((notif.title || '') + ' ' + (notif.message || '')).toLowerCase();
        if (msg.includes('chi') || msg.includes('hoàn tiền') || msg.includes('phiếu chi')) {
          tab = 'payments';
        } else if (msg.includes('vat') || msg.includes('xuất hóa đơn')) {
          tab = 'vat';
        }
        navigate('/accounting', { state: { searchTarget, tab } });
      } else {
        navigate('/orders', { state: { searchTarget } });
      }
    } else if (notif.type === 'visa') {
      if (isVisaUser) {
        navigate('/visa', { state: { searchTarget } });
      } else {
        navigate('/orders', { state: { searchTarget } });
      }
    } else {
      navigate('/orders', { state: { searchTarget } });
    }
  };

  const notifications = React.useMemo(() => {
    if (['admin', 'sale_leader'].includes(currentRole)) {
      return allNotifications;
    }
    
    if (currentRole === 'visa') {
      return allNotifications.filter(n => n.type === 'visa');
    }
    if (currentRole === 'accounting') {
      return allNotifications.filter(n => n.type === 'accounting');
    }
    if (currentRole === 'operator') {
      return allNotifications.filter(n => n.type === 'extension');
    }
    
    if (['sale', 'CTV', 'Đại lý'].includes(currentRole)) {
      const myOrderIds = orders
        .filter(o => o.user_id === profile?.id || o.created_by === profile?.full_name)
        .map(o => o.id);
        
      const myPassengerIds = passengers
        .filter(p => myOrderIds.includes(p.order_id))
        .map(p => p.id);
        
      return allNotifications.filter(n => {
        return myOrderIds.includes(n.targetId) || myPassengerIds.includes(n.targetId);
      });
    }
    
    return [];
  }, [allNotifications, currentRole, orders, passengers, profile]);

  const unreadNotifications = React.useMemo(() => {
    return notifications.filter(n => !n.read);
  }, [notifications]);

  const getRoleLabel = (role: Role) => {
    switch (role) {
      case 'CTV': return 'Cộng tác viên (CTV)';
      case 'Đại lý': return 'Đại lý';
      case 'operator': return 'Điều hành Tour';
      case 'sale_leader': return 'Sale Leader';
      case 'sale': return 'Sale';
      case 'visa': return 'Bộ phận Visa';
      case 'accounting': return 'Kế toán';
      case 'admin': return 'Quản trị viên';
      default: return role;
    }
  };

  // Check access control for current page and role
  const isSettingsPath = location.pathname === '/settings';
  const currentNavItem = navigation.find(n => n.href === location.pathname);
  
  let hasAccess = false;
  if (currentRole === 'admin') {
    hasAccess = true;
  } else if (isSettingsPath) {
    hasAccess = false;
  } else if (currentNavItem) {
    hasAccess = currentNavItem.roleAccess.includes(currentRole as any);
  } else {
    hasAccess = true;
  }

  const allowedNav = navigation.filter(item => item.roleAccess.includes(currentRole));

  const AccessDeniedView = () => (
    <div className="flex flex-col items-center justify-center py-16 px-6 bg-white rounded-2xl border border-gray-200 shadow-xs max-w-md mx-auto my-8 text-center">
      <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0-6v2m0-5a7 7 0 110 14 7 7 0 010-14z" />
        </svg>
      </div>
      <h2 className="text-lg font-black text-gray-900 mb-2">Không có quyền truy cập</h2>
      <p className="text-xs text-gray-500 mb-6 max-w-sm leading-relaxed font-semibold">
        Vai trò hiện tại của bạn là <strong className="text-blue-600">{getRoleLabel(currentRole)}</strong> không được phân quyền truy cập chức năng này.
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
      >
        Quay lại Lịch khởi hành
      </Link>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col shrink-0 h-full">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 shrink-0">
          <Map className="h-6 w-6 text-blue-600 mr-2" />
          <span className="text-xl font-bold text-gray-900">Tour CRM</span>
        </div>
        
        {/* Active Role Card */}
        <div className="p-4 border-b border-gray-150 bg-slate-50/50 shrink-0">
          <div className="flex items-center space-x-2 mb-2">
            <UserCheck className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Vai trò đang xem</span>
          </div>
          <select
            value={currentRole}
            onChange={(e) => setCurrentRole(e.target.value as Role)}
            disabled={profile?.role !== 'admin' && user?.email !== 'marketing.adluxury@gmail.com' && user?.email !== 'marketing@adluxury.net'}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed cursor-pointer"
          >
            <option value="CTV">🤝 Cộng tác viên (CTV)</option>
            <option value="Đại lý">🏢 Đại lý</option>
            <option value="operator">👷 Điều hành Tour</option>
            <option value="sale_leader">⭐ Sale Leader (Trưởng nhóm)</option>
            <option value="sale">💼 Sale</option>
            <option value="visa">🛂 Bộ phận Visa</option>
            <option value="accounting">💰 Kế toán</option>
            <option value="admin">🔑 Quản trị viên (Full)</option>
          </select>

          {/* Button Góp Ý & Báo Lỗi */}
          {currentRole !== 'admin' && (
            <button
              type="button"
              onClick={() => setIsFeedbackModalOpen(true)}
              className="mt-3 w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <MessageSquarePlus className="w-4 h-4 text-emerald-100" />
              <span>Góp ý & Báo lỗi</span>
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {allowedNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                    : 'text-gray-700 hover:bg-gray-100',
                  'group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-xl transition-colors relative'
                )}
              >
                <div className="flex items-center">
                  <item.icon
                    className={cn(
                      isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500',
                      'mr-3 flex-shrink-0 h-5 w-5'
                    )}
                    aria-hidden="true"
                  />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>
        
        {currentRole === 'admin' && (
          <div className="p-4 border-t border-gray-200 shrink-0">
            <Link
              to="/settings"
              className={cn(
                location.pathname === '/settings'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100',
                'group flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-colors'
              )}
            >
              <Settings className="text-gray-400 group-hover:text-gray-500 mr-3 flex-shrink-0 h-5 w-5" />
              Cài đặt hệ thống
            </Link>
          </div>
        )}
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile / App Top Header */}
        <header className="h-14 md:h-16 bg-white border-b border-gray-200 flex items-center justify-between px-3.5 sm:px-6 z-20 shadow-xs shrink-0 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg active:scale-95 transition-all"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-[28px] font-bold text-gray-900 truncate" style={{ fontSize: '28px' }}>
                {navigation.find(n => n.href === location.pathname)?.name || 'Tour CRM'}
              </h1>
              <span className="hidden sm:inline-block text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700 whitespace-nowrap">
                {getRoleLabel(currentRole)}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* PWA Install Button Header shortcut if available */}
            {showPwaBanner && !isStandalone && (
              <button
                type="button"
                onClick={handleInstallPWA}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs active:scale-95 transition-all"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Cài App</span>
              </button>
            )}

            {/* Notification Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-gray-500 hover:text-gray-700 relative p-2 rounded-full hover:bg-gray-100 transition-colors active:scale-95"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-84 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <span className="font-bold text-sm text-gray-900">Thông báo hệ thống</span>
                    <div className="flex items-center gap-2">
                      {unreadNotifications.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAllNotificationsAsRead();
                          }}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer hover:underline"
                        >
                          Đã đọc tất cả
                        </button>
                      )}
                      <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                        {unreadNotifications.length} mới
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-500">Chưa có thông báo nào</div>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          onClick={() => handleNotificationClick(notif)}
                          className="p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            notif.type === 'visa' ? 'bg-purple-50 text-purple-600' :
                            notif.type === 'accounting' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                          }`}>
                            {notif.type === 'visa' ? 'VISA' :
                             notif.type === 'accounting' ? 'KẾ TOÁN' : 'ĐIỀU HÀNH'}
                          </span>
                          <p className="text-xs font-semibold text-gray-800 mt-1">{notif.title}</p>
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Menu */}
            <div className="relative group">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs uppercase shadow-xs cursor-pointer ring-2 ring-blue-100">
                {user?.email ? user.email.charAt(0).toUpperCase() : 'AD'}
              </div>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden z-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                 <div className="px-4 py-3 border-b border-gray-100 overflow-hidden bg-slate-50">
                    <p className="text-xs font-bold text-gray-900 truncate">{user?.email || 'Tài khoản'}</p>
                    <p className="text-[10px] text-blue-600 font-semibold">{getRoleLabel(currentRole)}</p>
                 </div>
                 <Link 
                   to="/profile"
                   className="w-full flex items-center px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                 >
                   <User className="h-4 w-4 mr-2 text-slate-400" />
                   Thông tin cá nhân
                 </Link>
                 <button 
                   onClick={() => signOut()}
                   className="w-full flex items-center text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                 >
                   <LogOut className="h-4 w-4 mr-2" />
                   Đăng xuất
                 </button>
              </div>
            </div>
          </div>
        </header>

        {/* Banner PWA Onboarding trên Mobile / Web */}
        {showPwaBanner && !isStandalone && (
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white px-3.5 py-2.5 flex items-center justify-between text-xs font-medium shadow-sm shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white leading-tight truncate">Cài đặt App Tour CRM</p>
                <p className="text-[11px] text-blue-100 leading-tight truncate">Trải nghiệm như ứng dụng Mobile App mượt mà</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isIOS ? (
                <span className="text-[11px] bg-white/20 px-2 py-1 rounded-lg text-white font-bold">
                  Thêm vào Màn hình chính
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleInstallPWA}
                  className="px-3 py-1 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-lg shadow-xs active:scale-95 transition-all text-xs"
                >
                  Cài ngay
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPwaBanner(false)}
                className="p-1 hover:bg-white/20 rounded-lg text-blue-100 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        
        {/* Main scrollable view */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-3 sm:p-6 md:p-8 pb-20 md:pb-8">
          {hasAccess ? children : <AccessDeniedView />}
        </main>

        {/* Mobile Bottom Navigation Bar (App Experience) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40 flex items-center justify-around px-1 py-1 shadow-lg pb-[calc(0.4rem+env(safe-area-inset-bottom))]">
          <Link
            to="/"
            className={cn(
              'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px]',
              location.pathname === '/' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight">Lịch Tour</span>
          </Link>

          {(['operator', 'admin', 'sale_leader'].includes(currentRole)) ? (
            <Link
              to="/tours"
              className={cn(
                'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px]',
                location.pathname === '/tours' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              <Map className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] leading-tight">Tour</span>
            </Link>
          ) : (
            <Link
              to="/visa-services"
              className={cn(
                'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px]',
                location.pathname === '/visa-services' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              <FileText className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] leading-tight">DV Visa</span>
            </Link>
          )}

          <Link
            to="/orders"
            className={cn(
              'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] relative',
              location.pathname === '/orders' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <ShoppingCart className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight">Booking</span>
          </Link>

          {(['visa', 'admin'].includes(currentRole)) ? (
            <Link
              to="/visa"
              className={cn(
                'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px]',
                location.pathname === '/visa' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              <FileText className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] leading-tight">Xử lý Visa</span>
            </Link>
          ) : (['accounting'].includes(currentRole)) ? (
            <Link
              to="/accounting"
              className={cn(
                'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px]',
                location.pathname === '/accounting' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              <Receipt className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] leading-tight">Kế toán</span>
            </Link>
          ) : (
            <Link
              to="/passengers"
              className={cn(
                'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px]',
                location.pathname === '/passengers' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              <Users className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] leading-tight">Khách hàng</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-500 hover:text-slate-800 min-w-[56px]"
          >
            <MoreHorizontal className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight">Menu</span>
          </button>
        </nav>
      </div>

      {/* Mobile Menu Drawer / Slide-over */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative flex-1 max-w-xs w-full bg-white h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Map className="h-5 w-5 text-blue-400" />
                <span className="text-base font-bold">Tour CRM Mobile</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Active Role Card Mobile */}
            <div className="p-4 border-b border-gray-150 bg-slate-50">
              <div className="flex items-center space-x-2 mb-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Vai trò đang xem</span>
              </div>
              <select
                value={currentRole}
                onChange={(e) => {
                  setCurrentRole(e.target.value as Role);
                  setIsMobileMenuOpen(false);
                }}
                disabled={profile?.role !== 'admin' && user?.email !== 'marketing.adluxury@gmail.com' && user?.email !== 'marketing@adluxury.net'}
                className="w-full px-2.5 py-2 border border-gray-300 rounded-xl text-xs font-bold bg-white text-gray-800 shadow-xs focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="CTV">🤝 Cộng tác viên (CTV)</option>
                <option value="Đại lý">🏢 Đại lý</option>
                <option value="operator">👷 Điều hành Tour</option>
                <option value="sale_leader">⭐ Sale Leader (Trưởng nhóm)</option>
                <option value="sale">💼 Sale</option>
                <option value="visa">🛂 Bộ phận Visa</option>
                <option value="accounting">💰 Kế toán</option>
                <option value="admin">🔑 Quản trị viên (Full)</option>
              </select>

              {currentRole !== 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsFeedbackModalOpen(true);
                  }}
                  className="mt-3 w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  <span>Góp ý & Báo lỗi</span>
                </button>
              )}
            </div>

            {/* Nav list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <div className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider px-3 py-1">Menu Chức Năng</div>
              {allowedNav.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-bold shadow-xs'
                        : 'text-gray-700 hover:bg-gray-100 font-medium',
                      'flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition-colors'
                    )}
                  >
                    <div className="flex items-center">
                      <item.icon
                        className={cn(
                          isActive ? 'text-blue-700' : 'text-gray-400',
                          'mr-3 flex-shrink-0 h-4 w-4'
                        )}
                      />
                      <span>{item.name}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </Link>
                );
              })}

              {currentRole === 'admin' && (
                <Link
                  to="/settings"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    location.pathname === '/settings'
                      ? 'bg-blue-50 text-blue-700 font-bold shadow-xs'
                      : 'text-gray-700 hover:bg-gray-100 font-medium',
                    'flex items-center justify-between px-3 py-2.5 text-xs rounded-xl transition-colors mt-2 border-t border-gray-100 pt-3'
                  )}
                >
                  <div className="flex items-center">
                    <Settings className="mr-3 h-4 w-4 text-gray-400" />
                    <span>Cài đặt hệ thống</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </Link>
              )}
            </div>

            {/* Footer Profile & Logout */}
            <div className="p-4 border-t border-gray-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{user?.email || 'Tài khoản'}</p>
                  <p className="text-[10px] text-gray-500 font-medium">{getRoleLabel(currentRole)}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => signOut()}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Góp ý & Báo lỗi */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />
    </div>
  );
}


