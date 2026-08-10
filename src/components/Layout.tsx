import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Map, 
  ShoppingCart, 
  FileText, 
  Receipt,
  FileCheck,
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
  LogOut,
  Ticket,
  Camera,
  Share2,
  Handshake,
  Building,
  Sliders,
  Star,
  Briefcase,
  Globe,
  Calculator,
  Flag,
  Key,
  Megaphone,
  BarChart3
} from 'lucide-react';
import { cn, isOrderInLeaderTeam } from '@/lib/utils';
import { useCRM } from '@/context/CRMContext';
import { useAuth } from '@/context/AuthContext';
import { CustomSelect } from './CustomSelect';
import { Role } from '@/types';
import { HDVQuickUploadModal } from './HDVQuickUploadModal';
import { HDVQuickLinkModal } from './HDVQuickLinkModal';

const roleOptions = [
  { value: 'agent', label: 'Đại lý (Agent)', icon: <Handshake className="w-4 h-4 text-amber-600" /> },
  { value: 'bod', label: 'BOD (Ban Giám đốc)', icon: <Building className="w-4 h-4 text-violet-600" /> },
  { value: 'operator', label: 'Điều hành Tour', icon: <Sliders className="w-4 h-4 text-purple-600" /> },
  { value: 'sale_leader', label: 'Sale Leader (Trưởng nhóm)', icon: <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> },
  { value: 'sale', label: 'Sale', icon: <Briefcase className="w-4 h-4 text-blue-600" /> },
  { value: 'visa', label: 'Bộ phận Visa', icon: <Globe className="w-4 h-4 text-indigo-600" /> },
  { value: 'accounting', label: 'Kế toán', icon: <Calculator className="w-4 h-4 text-emerald-600" /> },
  { value: 'tour_guide', label: 'Hướng Dẫn Viên (HDV)', icon: <Flag className="w-4 h-4 text-teal-600" /> },
  { value: 'admin', label: 'Quản trị viên (Full)', icon: <Key className="w-4 h-4 text-rose-600" /> },
  { value: 'marketing_leader', label: 'Trưởng phòng Marketing', icon: <Megaphone className="w-4 h-4 text-fuchsia-600" /> },
  { value: 'marketing', label: 'Nhân viên Marketing', icon: <BarChart3 className="w-4 h-4 text-pink-500" /> },
];
import { FeedbackModal } from './FeedbackModal';


const navigation = [
  { name: 'Bảng điều khiển', href: '/dashboard', icon: LayoutDashboard, roleAccess: ['admin', 'bod'] },
  { name: 'Lịch khởi hành', href: '/', icon: Calendar, roleAccess: ['agent', 'bod', 'operator', 'sale', 'sale_leader', 'visa', 'accounting', 'tour_guide', 'admin'] },
  { name: 'Quản lý Tour', href: '/tours', icon: Map, roleAccess: ['operator', 'admin', 'sale_leader', 'bod', 'tour_guide'] },
  { name: 'Ảnh khách đoàn', href: '/tour-media', icon: Camera, roleAccess: ['bod', 'operator', 'sale', 'sale_leader', 'visa', 'accounting', 'tour_guide', 'admin'] },
  { name: 'Dịch vụ Visa', href: '/visa-services', icon: FileText, roleAccess: ['operator', 'admin', 'sale', 'sale_leader', 'visa', 'bod'] },
  { name: 'Booking Visa', href: '/visa-orders', icon: ShoppingCart, roleAccess: ['agent', 'bod', 'sale', 'sale_leader', 'visa', 'admin'] },
  { name: 'Quản lý Booking', href: '/orders', icon: ShoppingCart, roleAccess: ['agent', 'bod', 'sale', 'sale_leader', 'admin'] },
  { name: 'Xử lý Visa', href: '/visa', icon: FileText, roleAccess: ['visa', 'admin', 'bod'] },
  { name: 'Kế toán & Hóa đơn', href: '/accounting', icon: Receipt, roleAccess: ['accounting', 'admin', 'bod'] },
  { name: 'Đề nghị thanh toán', href: '/payment-proposals', icon: FileCheck, roleAccess: ['operator', 'sale', 'sale_leader', 'accounting', 'visa', 'tour_guide', 'admin', 'bod'] },
  { name: 'Đại lý & CTV', href: '/customers', icon: Users, roleAccess: ['admin', 'bod', 'sale', 'sale_leader', 'operator', 'accounting'] },
  { name: 'Khách hàng', href: '/passengers', icon: Users, roleAccess: ['operator', 'sale', 'sale_leader', 'visa', 'tour_guide', 'admin', 'bod'] },
  { name: 'Nhật ký hệ thống', href: '/activity-logs', icon: History, roleAccess: ['admin', 'bod'] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentRole, setCurrentRole, displayRole, notifications: allNotifications, markNotificationAsRead, markAllNotificationsAsRead, orders, passengers, paymentProposals = [], profilesList = [] } = useCRM();
  const { signOut, user, profile } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHdvQuickUploadOpen, setIsHdvQuickUploadOpen] = useState(false);
  const [isHdvQuickLinkOpen, setIsHdvQuickLinkOpen] = useState(false);

  // Auto detect HDV role or quick upload tab from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('role') === 'tour_guide' && currentRole !== 'tour_guide') {
      setCurrentRole('tour_guide');
    }
  }, [location.search]);

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

    const titleLower = (notif.title || '').toLowerCase();
    const msgLower = (notif.message || '').toLowerCase();
    const isPaymentProposalNotif = 
      titleLower.includes('đề nghị thanh toán') || 
      msgLower.includes('đề nghị thanh toán') || 
      msgLower.includes('dntt-') ||
      (notif.targetId && String(notif.targetId).startsWith('DNTT-'));

    if (isPaymentProposalNotif) {
      let proposalSearch = '';
      const dnttMatch = (notif.message || '').match(/DNTT-\d+-\d+/i) || (notif.title || '').match(/DNTT-\d+-\d+/i);
      if (dnttMatch) {
        proposalSearch = dnttMatch[0];
      } else if (notif.targetId) {
        proposalSearch = notif.targetId;
      }
      navigate('/payment-proposals', { state: { searchTarget: proposalSearch } });
      return;
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
    const currentUserId = profile?.id || user?.id || '';
    const userFullName = (profile?.full_name || '').trim().toLowerCase();
    const userEmail = (user?.email || profile?.email || '').trim().toLowerCase();

    // Map order IDs relevant to the logged-in user or sale leader's team
    const myOrderIds = new Set(
      orders.filter(o => {
        if (currentRole === 'sale_leader') {
          return isOrderInLeaderTeam(o, profile, profilesList);
        }
        const cb = (o.created_by || '').toLowerCase();
        const uid = o.user_id || '';
        return (
          uid === currentUserId ||
          (userFullName && cb.includes(userFullName)) ||
          (userEmail && cb.includes(userEmail))
        );
      }).map(o => o.id)
    );

    const myPassengerIds = new Set(
      passengers.filter(p => myOrderIds.has(p.order_id)).map(p => p.id)
    );

    const myProposalIds = new Set(
      (paymentProposals || [])
        .filter(p => {
          if (currentRole === 'sale_leader') {
            const isMyProposal = p.created_by_id === currentUserId || (userFullName && (p.created_by_name || '').toLowerCase().includes(userFullName));
            if (isMyProposal) return true;
            const creator = profilesList.find(prof => prof.id === p.created_by_id || (prof.full_name && (p.created_by_name || '').toLowerCase().includes(prof.full_name.toLowerCase())));
            if (creator && (creator.leader_id === currentUserId || (!creator.leader_id && (creator.role === 'sale' || creator.role === 'agent')))) {
              return true;
            }
            return false;
          }
          return p.created_by_id === currentUserId || (userFullName && (p.created_by_name || '').toLowerCase().includes(userFullName));
        })
        .map(p => p.id)
    );

    return allNotifications.filter(n => {
      // Filter out legacy mock sample notifications or unlinked invalid notifications
      if (n.id === 'N-1' || n.id === 'N-2' || n.targetId === 'P-101' || n.targetId === 'O-1001') {
        return false;
      }
      if ((n.message || '').includes('#Chưa rõ') || (n.title || '').includes('#Chưa rõ')) {
        return false;
      }

      // 1. Executive Management (Admin, BOD): Full visibility over valid notifications
      if (['admin', 'bod'].includes(currentRole)) {
        return true;
      }

      const msg = (n.message || '').toLowerCase();
      const title = (n.title || '').toLowerCase();

      // Check if notification targets an order/passenger/proposal in user's scope
      const targetOrder = n.targetId ? orders.find(o => o.id === n.targetId || (n.targetId && (o.id.toLowerCase().startsWith(n.targetId.toLowerCase()) || n.targetId.toLowerCase().startsWith(o.id.toLowerCase())))) : undefined;
      const isTargetOrderInScope = targetOrder ? myOrderIds.has(targetOrder.id) : false;

      const matchesUserOrder = isTargetOrderInScope || Array.from(myOrderIds).some(id => {
        if (!id) return false;
        const shortId = id.includes('-') ? id.split('-')[0] : id;
        const targetId = (n.targetId || '').toLowerCase();
        const fullId = id.toLowerCase();
        const sId = shortId.toLowerCase();
        
        return (
          targetId === fullId ||
          targetId === sId ||
          (targetId && fullId.includes(targetId)) ||
          (targetId && targetId.includes(sId)) ||
          msg.includes(sId) ||
          msg.includes(fullId) ||
          title.includes(sId)
        );
      });

      const matchesUserPassenger = n.targetId ? myPassengerIds.has(n.targetId) : false;
      const matchesUserProposal = n.targetId ? myProposalIds.has(n.targetId) : false;
      const isDirectlyRelevant = matchesUserOrder || matchesUserPassenger || matchesUserProposal;

      // 2. Sale Leader: Notifications for their own + team members' orders, passengers, proposals, plus system alerts
      if (currentRole === 'sale_leader') {
        if (n.type === 'system' && !n.targetId) return true;
        return isDirectlyRelevant;
      }

      // 3. Regular Sale & Agent: Notifications strictly for their own orders, passengers, proposals
      if (['sale', 'agent'].includes(currentRole)) {
        if (n.type === 'system' && !n.targetId) return true;
        return isDirectlyRelevant;
      }

      // 4. Visa department: Visa related or directly relevant
      if (currentRole === 'visa') {
        if (n.type === 'visa' || title.includes('visa') || msg.includes('visa')) return true;
        return isDirectlyRelevant;
      }

      // 5. Accounting department: Accounting, proposals, invoices, receipts
      if (currentRole === 'accounting') {
        if (n.type === 'system') return true;
        if (
          n.type === 'accounting' || 
          title.includes('đề nghị thanh toán') || 
          msg.includes('đề nghị thanh toán') ||
          title.includes('hóa đơn') ||
          title.includes('phiếu thu') ||
          title.includes('phiếu chi')
        ) {
          return true;
        }
        return isDirectlyRelevant;
      }

      // 6. Operator department: Extension requests, hold status, tour operations, cancellations
      if (currentRole === 'operator') {
        if (n.type === 'system') return true;
        if (
          n.type === 'extension' || 
          title.includes('gia hạn') || 
          title.includes('chốt sure') || 
          title.includes('huỷ')
        ) {
          return true;
        }
        return isDirectlyRelevant;
      }

      return isDirectlyRelevant;
    });
  }, [allNotifications, currentRole, orders, passengers, paymentProposals, profile, user]);

  const unreadNotifications = React.useMemo(() => {
    return notifications.filter(n => !n.read);
  }, [notifications]);

  const getRoleLabel = (role: Role) => {
    switch (role) {
      case 'agent': return 'Đại lý (Agent)';
      case 'bod': return 'BOD (Ban Giám đốc)';
      case 'operator': return 'Điều hành Tour';
      case 'sale_leader': return 'Sale Leader';
      case 'sale': return 'Sale';
      case 'visa': return 'Bộ phận Visa';
      case 'accounting': return 'Kế toán';
      case 'admin': return 'Quản trị viên';
      case 'marketing_leader': return 'Trưởng phòng Marketing';
      case 'marketing': return 'Nhân viên Marketing';
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
        Vai trò hiện tại của bạn là <strong className="text-blue-600">{getRoleLabel(displayRole)}</strong> không được phân quyền truy cập chức năng này.
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
        <div className="h-16 flex items-center px-5 border-b border-gray-200 shrink-0 gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center p-1.5 text-white shadow-sm shrink-0">
            <img src="/favicon.svg" alt="Vé máy bay logo" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <span className="text-base font-black text-gray-900 tracking-tight block leading-none truncate">Tour CRM</span>
            <span className="text-[10px] text-blue-600 font-extrabold uppercase tracking-wider block mt-0.5 truncate">AD Luxury Travel</span>
          </div>
        </div>
        
        {/* Active Role Card */}
        <div className="p-4 border-b border-gray-150 bg-slate-50/50 shrink-0">
          <div className="flex items-center space-x-2 mb-2">
            <UserCheck className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Vai trò đang xem</span>
          </div>
          <CustomSelect
            options={roleOptions}
            value={displayRole}
            onChange={(val) => setCurrentRole(val as Role)}
            disabled={profile?.role !== 'admin' && user?.email !== 'marketing.adluxury@gmail.com' && user?.email !== 'marketing@adluxury.net'}
            className="w-full"
            buttonClassName="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          />

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
                {getRoleLabel(displayRole)}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
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
                      notifications.map(notif => {
                        const isProposalNotif = (notif.title || '').toLowerCase().includes('đề nghị thanh toán') || 
                                                (notif.message || '').toLowerCase().includes('đề nghị thanh toán') || 
                                                (notif.message || '').includes('DNTT-');
                        return (
                          <div 
                            key={notif.id} 
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-3 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.read ? 'bg-blue-50/40' : ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isProposalNotif ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                notif.type === 'visa' ? 'bg-purple-50 text-purple-600' :
                                notif.type === 'accounting' ? 'bg-red-50 text-red-600' :
                                notif.type === 'extension' ? 'bg-orange-50 text-orange-600' :
                                'bg-blue-50 text-blue-600 border border-blue-200'
                              }`}>
                                {isProposalNotif ? 'ĐỀ NGHỊ TT' :
                                 notif.type === 'visa' ? 'VISA' :
                                 notif.type === 'accounting' ? 'KẾ TOÁN' :
                                 notif.type === 'extension' ? 'ĐIỀU HÀNH' : 'ĐƠN HÀNG'}
                              </span>
                              {!notif.read && (
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-gray-800 mt-1">{notif.title}</p>
                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2 leading-relaxed">
                              {(notif.message || '').replace(/\b([0-9a-fA-F]{8})-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, '$1')}
                            </p>
                          </div>
                        );
                      })
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
                    <p className="text-[10px] text-blue-600 font-semibold">{getRoleLabel(displayRole)}</p>
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
        
        {/* Main scrollable view */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-3 sm:p-6 md:p-8 pb-20 md:pb-8">
          {hasAccess ? children : <AccessDeniedView />}
        </main>

        {/* Mobile Bottom Navigation Bar (App Experience) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40 flex items-center justify-around px-1 py-1 shadow-lg pb-[calc(0.4rem+env(safe-area-inset-bottom))]">
          <Link
            to="/"
            className={cn(
              'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[52px]',
              location.pathname === '/' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight">Lịch Tour</span>
          </Link>

          <Link
            to="/tours"
            className={cn(
              'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[52px]',
              location.pathname === '/tours' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <Map className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight">Quản Lý Tour</span>
          </Link>

          {/* Big Center Action Camera Button for HDV Quick Upload */}
          <button
            type="button"
            onClick={() => setIsHdvQuickUploadOpen(true)}
            className="flex flex-col items-center justify-center -mt-5 relative z-10 focus:outline-none"
            title="Upload Ảnh Đoàn Nhanh"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 p-0.5 shadow-lg shadow-blue-500/25 ring-4 ring-white active:scale-95 transition-transform flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-blue-600 flex items-center justify-center text-white">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>
            <span className="text-[10px] font-bold text-blue-600 tracking-tight mt-0.5">Chụp Ảnh</span>
          </button>

          <Link
            to="/payment-proposals"
            className={cn(
              'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[52px]',
              location.pathname === '/payment-proposals' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <FileCheck className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight">Đề Nghị TT</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-500 hover:text-slate-800 min-w-[52px]"
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
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center p-1 text-white shadow-xs shrink-0">
                  <img src="/favicon.svg" alt="Vé máy bay logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <span className="text-sm font-black tracking-tight block leading-none">Tour CRM</span>
                  <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider block mt-0.5">AD Luxury Travel</span>
                </div>
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
              <CustomSelect
                options={roleOptions}
                value={currentRole}
                onChange={(val) => {
                  setCurrentRole(val as Role);
                  setIsMobileMenuOpen(false);
                }}
                disabled={profile?.role !== 'admin' && user?.email !== 'marketing.adluxury@gmail.com' && user?.email !== 'marketing@adluxury.net'}
                className="w-full"
                buttonClassName="w-full px-2.5 py-2 border border-gray-300 rounded-xl text-xs font-bold bg-white text-gray-800 shadow-xs focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />

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
                  <p className="text-[10px] text-gray-500 font-medium">{getRoleLabel(displayRole)}</p>
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

      {/* Modal Upload Ảnh Nhanh cho HDV */}
      <HDVQuickUploadModal
        isOpen={isHdvQuickUploadOpen}
        onClose={() => setIsHdvQuickUploadOpen(false)}
      />

      {/* Modal Link & QR cho HDV Freelance */}
      <HDVQuickLinkModal
        isOpen={isHdvQuickLinkOpen}
        onClose={() => setIsHdvQuickLinkOpen(false)}
        tours={useCRM().tours}
      />
    </div>
  );
}


