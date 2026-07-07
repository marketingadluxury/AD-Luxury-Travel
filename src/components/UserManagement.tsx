import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';
import { 
  Users, UserPlus, Edit2, Trash2, Shield, Key, Mail, Phone, 
  Building2, Search, X, Check, AlertCircle, RefreshCw, Eye, EyeOff 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ManagedUser {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  role: Role;
  created_at?: string;
}

const ROLE_LABELS: Record<Role, { label: string; color: string; bg: string; border: string }> = {
  admin: { label: 'Quản trị viên', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  sale: { label: 'Kinh doanh', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  operator: { label: 'Điều hành Tour', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  visa: { label: 'Phòng Visa', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  accounting: { label: 'Kế toán', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  CTV: { label: 'Cộng tác viên', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
  'Đại lý': { label: 'Đại lý du lịch', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' }
};

export default function UserManagement() {
  const { session } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Delete confirm modal state
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    company_name: '',
    role: 'CTV' as Role
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = session?.access_token;
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/admin/users', { headers });
      if (!response.ok) {
        throw new Error('Không thể tải danh sách người dùng từ hệ thống.');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Đã xảy ra lỗi khi tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [session]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      full_name: '',
      phone: '',
      company_name: 'AD Luxury Travel',
      role: 'CTV'
    });
    setShowPassword(false);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (user: ManagedUser) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '', // Password rỗng khi sửa, nếu điền mới cập nhật
      full_name: user.full_name,
      phone: user.phone || '',
      company_name: user.company_name || '',
      role: user.role
    });
    setShowPassword(false);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate
    if (!formData.email || !formData.full_name) {
      setError('Vui lòng nhập đầy đủ Email và Họ tên.');
      return;
    }

    if (!editingUser && !formData.password) {
      setError('Mật khẩu là bắt buộc khi thêm tài khoản mới.');
      return;
    }

    try {
      const token = session?.access_token;
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = editingUser 
        ? `/api/admin/users/${editingUser.id}` 
        : '/api/admin/users';
      
      const method = editingUser ? 'PUT' : 'POST';
      const bodyData: any = { ...formData };
      
      // Nếu là edit và password trống, xóa khỏi body để không cập nhật
      if (editingUser && !bodyData.password) {
        delete bodyData.password;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(bodyData)
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Gặp lỗi trong quá trình xử lý yêu cầu.');
      }

      setActionSuccess(editingUser ? 'Cập nhật thông tin tài khoản thành công!' : 'Thêm tài khoản người dùng mới thành công!');
      setIsFormOpen(false);
      fetchUsers();
      
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi không xác định.');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      setError(null);
      const token = session?.access_token;
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Lỗi khi xóa người dùng.');
      }

      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setDeleteTarget(null);
      setActionSuccess('Xóa tài khoản người dùng thành công!');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Không thể xóa tài khoản này.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter and search
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.company_name || '').toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Alert toast messages */}
      <AnimatePresence>
        {actionSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl shadow-xl flex items-center gap-3 font-semibold text-xs"
          >
            <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
              <Check className="w-4 h-4" />
            </div>
            <span>{actionSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control panel and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search bar */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, email, sđt hoặc công ty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-2.5 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters and Add Button */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-stretch sm:items-center">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3.5 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all cursor-pointer"
          >
            <option value="all">Tất cả vai trò</option>
            {Object.entries(ROLE_LABELS).map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
          </select>

          <button
            onClick={fetchUsers}
            title="Tải lại danh sách"
            className="p-2 border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 rounded-xl bg-white cursor-pointer flex items-center justify-center transition-all shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md shadow-blue-600/10 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Thêm tài khoản</span>
          </button>
        </div>
      </div>

      {/* Main List display */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-xs text-gray-500 font-bold">Đang tải danh sách tài khoản...</p>
          </div>
        ) : error && users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
            <h4 className="text-sm font-black text-gray-800">Không thể kết nối máy chủ</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-sm font-semibold">{error}</p>
            <button 
              onClick={fetchUsers}
              className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer"
            >
              Thử lại ngay
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="w-12 h-12 text-gray-300 mb-3" />
            <h4 className="text-sm font-black text-gray-800">Không tìm thấy tài khoản nào</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-sm font-semibold">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm để ra kết quả.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-gray-150 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-6">Họ và tên</th>
                    <th className="py-3 px-6">Thông tin liên hệ</th>
                    <th className="py-3 px-6">Công ty / Tổ chức</th>
                    <th className="py-3 px-6">Vai trò (Role)</th>
                    <th className="py-3 px-6">Ngày tham gia</th>
                    <th className="py-3 px-6 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 text-xs font-semibold text-gray-700">
                  {filteredUsers.map((user) => {
                    const roleCfg = ROLE_LABELS[user.role] || { label: user.role, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
                    return (
                      <tr key={user.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-extrabold text-gray-900 text-sm">{user.full_name}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                            <Mail className="w-3. h-3 text-gray-400 shrink-0" />
                            <span>{user.email}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 space-y-1">
                          {user.phone ? (
                            <div className="flex items-center gap-1 text-slate-700">
                              <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span>{user.phone}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic font-medium">Chưa có SĐT</span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span>{user.company_name || 'AD Luxury Travel'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${roleCfg.bg} ${roleCfg.color} ${roleCfg.border}`}>
                            <Shield className="w-3 h-3 shrink-0" />
                            <span>{roleCfg.label}</span>
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-400 font-medium">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : 'Không rõ'}
                        </td>
                        <td className="py-4 px-6 text-right space-x-1.5">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-150 rounded-lg cursor-pointer transition-all inline-flex items-center"
                            title="Sửa tài khoản"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          
                          {/* Không cho tự xóa tài khoản của chính mình */}
                          <button
                            onClick={() => setDeleteTarget(user)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-150 rounded-lg cursor-pointer transition-all inline-flex items-center"
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card-Based List View */}
            <div className="md:hidden divide-y divide-gray-150">
              {filteredUsers.map((user) => {
                const roleCfg = ROLE_LABELS[user.role] || { label: user.role, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
                return (
                  <div key={user.id} className="p-4 space-y-3.5 hover:bg-slate-50/40 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-sm text-gray-900">{user.full_name}</h4>
                        <p className="text-[11px] text-gray-400 font-semibold flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                          <span>{user.email}</span>
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${roleCfg.bg} ${roleCfg.color} ${roleCfg.border}`}>
                        <span>{roleCfg.label}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="block text-gray-400 font-bold uppercase text-[9px] tracking-wide">Điện thoại</span>
                        <span className="font-bold text-slate-800">{user.phone || 'Chưa cung cấp'}</span>
                      </div>
                      <div>
                        <span className="block text-gray-400 font-bold uppercase text-[9px] tracking-wide">Công ty</span>
                        <span className="font-bold text-slate-800 truncate block">{user.company_name || 'AD Luxury'}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                      <span className="text-[10px] text-gray-400 font-bold">
                        Tham gia: {user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : 'Không rõ'}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 border border-blue-150 rounded-lg text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Edit2 className="w-3 h-3" />
                          Sửa
                        </button>
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 border border-rose-150 rounded-lg text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* CREATE & EDIT FORM MODAL */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-150 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center border border-blue-200">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900">
                      {editingUser ? 'Cập nhật tài khoản' : 'Thêm tài khoản mới'}
                    </h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                      {editingUser ? 'Chỉnh sửa thông tin thành viên' : 'Khai báo thành viên hệ thống CRM'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form body */}
              <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Email (Bắt buộc) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span>Địa chỉ Email *</span>
                  </label>
                  <input
                    type="email"
                    placeholder="email@adluxury.net"
                    required
                    disabled={!!editingUser} // Email không thay đổi khi edit để đảm bảo tính đồng bộ auth
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all disabled:bg-slate-50 disabled:text-gray-400 disabled:border-slate-200"
                  />
                </div>

                {/* Password (Bắt buộc khi thêm mới, Tùy chọn khi sửa) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-gray-400" />
                    <span>Mật khẩu {editingUser ? '(Để trống nếu không đổi)' : '*'}</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={editingUser ? 'Nhập mật khẩu mới' : 'Tối thiểu 6 ký tự'}
                      required={!editingUser}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full pl-4 pr-10 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Full name (Bắt buộc) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    <span>Họ và Tên *</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nguyễn Văn A"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>Số điện thoại</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="09xxxxxxxx"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                {/* Company Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    <span>Công ty / Chi nhánh</span>
                  </label>
                  <input
                    type="text"
                    placeholder="AD Luxury Travel - Sài Gòn"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                {/* Role SELECT (Phân vai trò) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-gray-400" />
                    <span>Phân vai trò (Role CRM)</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full px-3.5 py-2 border border-slate-300 bg-white rounded-xl text-xs font-extrabold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all cursor-pointer"
                  >
                    {Object.entries(ROLE_LABELS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400 font-bold leading-relaxed mt-1">
                    Lưu ý: Quyền truy cập các tab (Kế toán, Visa, Quản trị) sẽ tự động kích hoạt dựa theo vai trò được gán này.
                  </p>
                </div>

                {/* Modal Footer */}
                <div className="pt-4 border-t border-slate-150 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/10 transition-all cursor-pointer"
                  >
                    {editingUser ? 'Cập nhật' : 'Tạo tài khoản'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRM MODAL (As per instructions, alert confirmations with Vietnamese and strict prompt) */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-200">
                  <AlertCircle className="w-6 h-6 animate-bounce" />
                </div>
                
                <div>
                  <h3 className="text-base font-black text-slate-900">Xác nhận xóa người dùng?</h3>
                  <p className="text-xs text-gray-500 font-semibold mt-1.5 leading-relaxed">
                    Hành động này sẽ xóa hoàn toàn thông tin profile của <strong className="text-rose-600">{deleteTarget.full_name}</strong> ({deleteTarget.email}) khỏi cơ sở dữ liệu. Bạn có chắc chắn muốn tiếp tục không?
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    disabled={isDeleting}
                    onClick={() => setDeleteTarget(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-55"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    disabled={isDeleting}
                    onClick={handleDeleteUser}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/15 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-55"
                  >
                    {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Xác nhận Xóa</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
