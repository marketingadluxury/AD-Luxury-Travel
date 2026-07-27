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
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCRM } from '@/context/CRMContext';
import { useAuth } from '@/context/AuthContext';
import { Role } from '@/types';

const navigation = [
  { name: 'Bảng điều khiển', href: '/dashboard', icon: LayoutDashboard, roleAccess: ['admin'] },
  { name: 'Điều hành chiến lược', href: '/dashboard/executive', icon: TrendingUp, roleAccess: ['admin', 'sale_leader'] },
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

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentRole(e.target.value as Role);
  };

  const getRoleLabel = (role: Role) => {
    switch (role) {
      case 'CTV': return 'Cộng tác viên (CTV)';
      case 'Đại lý': return 'Đại lý';
      case 'operator': return 'Điều hành Tour';
      case 'sale_leader': return 'Sale Leader (Trưởng nhóm)';
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

  const AccessDeniedView = () => (
    <div className="flex flex-col items-center justify-center py-20 px-6 bg-white rounded-2xl border border-gray-200 shadow-xs max-w-md mx-auto my-12 text-center">
      <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0-6v2m0-5a7 7 0 110 14 7 7 0 010-14z" />
        </svg>
      </div>
      <h2 className="text-xl font-black text-gray-900 mb-2">Không có quyền truy cập</h2>
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
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <Map className="h-6 w-6 text-blue-600 mr-2" />
          <span className="text-xl font-bold text-gray-900">Tour CRM</span>
        </div>
        
        {/* Active Role Card */}
        <div className="p-4 border-b border-gray-150 bg-slate-50/50">
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
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navigation
            .filter(item => item.roleAccess.includes(currentRole))
            .map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100',
                    'group flex items-center justify-between px-2.5 py-2 text-sm font-medium rounded-lg transition-colors relative'
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
          <div className="p-4 border-t border-gray-200">
            <Link
              to="/settings"
              className={cn(
                location.pathname === '/settings'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100',
                'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors'
              )}
            >
              <Settings className="text-gray-400 group-hover:text-gray-500 mr-3 flex-shrink-0 h-5 w-5" />
              Cài đặt hệ thống
            </Link>
          </div>
        )}

      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-20 shadow-xs relative">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">
              {navigation.find(n => n.href === location.pathname)?.name || 'Tour CRM'}
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">
              {getRoleLabel(currentRole)} Workspace
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Notification drop */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-gray-500 hover:text-gray-700 relative p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-30">
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
                  <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-500">Chưa có thông báo nào</div>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          onClick={() => handleNotificationClick(notif)}
                          className="p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <span className={`text-xs font-bold ${
                            notif.type === 'visa' ? 'text-purple-600' :
                            notif.type === 'accounting' ? 'text-red-600' : 'text-orange-600'
                          }`}>
                            {notif.type === 'visa' ? '[🛂 VISA]' :
                             notif.type === 'accounting' ? '[💰 KẾ TOÁN]' : '[👷 ĐIỀU HÀNH]'}
                          </span>
                          <p className="text-xs font-semibold text-gray-800 mt-0.5">{notif.title}</p>
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative group">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs uppercase shadow-sm cursor-pointer">
                {user?.email ? user.email.charAt(0).toUpperCase() : 'AD'}
              </div>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-30 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                 <div className="px-4 py-3 border-b border-gray-100 overflow-hidden">
                    <p className="text-sm font-medium text-gray-900 truncate">{user?.email || 'User Account'}</p>
                 </div>
                 <Link 
                   to="/profile"
                   className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                 >
                   <User className="h-4 w-4 mr-2" />
                   Thông tin cá nhân
                 </Link>
                 <button 
                   onClick={() => signOut()}
                   className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors"
                 >
                   Đăng xuất
                 </button>
              </div>
            </div>
          </div>
        </header>
        
        {/* Main scrollable area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
          {hasAccess ? children : <AccessDeniedView />}
        </main>
      </div>
    </div>
  );
}
