import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Role, Team } from '../types';
import { 
  Users, UserPlus, Edit2, Trash2, Shield, Key, Mail, Phone, 
  Building2, Search, X, Check, AlertCircle, RefreshCw, Eye, EyeOff,
  Target, Layers, Plus, Award, UserCheck, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ManagedUser {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  role: Role;
  leader_id?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  created_at?: string;
}

const ROLE_LABELS: Record<Role, { label: string; color: string; bg: string; border: string }> = {
  admin: { label: 'Quản trị viên (Full)', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  sale_leader: { label: 'Sale Leader (Trưởng nhóm)', color: 'text-amber-800', bg: 'bg-amber-100', border: 'border-amber-300' },
  sale: { label: 'Sale', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  operator: { label: 'Điều hành Tour', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  visa: { label: 'Bộ phận Visa', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  accounting: { label: 'Kế toán', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  tour_guide: { label: 'Hướng Dẫn Viên (HDV)', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  agent: { label: 'Đại lý (Agent)', color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
  bod: { label: 'BOD (Ban Giám đốc)', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  marketing_leader: { label: 'Trưởng phòng Marketing', color: 'text-fuchsia-800', bg: 'bg-fuchsia-100', border: 'border-fuchsia-300' },
  marketing: { label: 'Nhân viên Marketing', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200' },
  CTV: { label: 'Cộng Tác Viên (CTV)', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' }
};

export default function UserManagement() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'teams'>('users');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  
  // User Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Team Modal state
  const [isTeamFormOpen, setIsTeamFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    leader_id: '',
    leader_name: '',
    kpi_target: 800000000
  });

  // Delete confirm modal state
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [deleteTeamTarget, setDeleteTeamTarget] = useState<Team | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // User Form states
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    company_name: '',
    role: 'agent' as Role,
    leader_id: '',
    team_id: '',
    team_name: ''
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = session?.access_token;
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const response = await fetch('/api/admin/users', { headers });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) setUsers(data);
      }
    } catch (err: any) {
      console.warn('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const token = session?.access_token;
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/admin/teams', { headers });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) setTeams(data);
      }
    } catch (err) {
      console.warn('Error fetching teams:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTeams();
  }, [session]);

  // Handle User Modal
  const handleOpenAddUser = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      full_name: '',
      phone: '',
      company_name: 'AD Luxury Travel',
      role: 'agent',
      leader_id: '',
      team_id: '',
      team_name: ''
    });
    setShowPassword(false);
    setIsFormOpen(true);
  };

  const handleOpenEditUser = (user: ManagedUser) => {
    setEditingUser(user);
    setFormData({
      email: user.email || '',
      password: '',
      full_name: user.full_name || '',
      phone: user.phone || '',
      company_name: user.company_name || '',
      role: user.role,
      leader_id: user.leader_id || '',
      team_id: user.team_id || '',
      team_name: user.team_name || ''
    });
    setShowPassword(false);
    setIsFormOpen(true);
  };

  const handleUserFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
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
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const url = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
      const method = editingUser ? 'PUT' : 'POST';
      
      // Auto fill team_name if team_id selected
      const selectedTeam = teams.find(t => t.id === formData.team_id);
      const bodyData: any = {
        ...formData,
        team_name: selectedTeam ? selectedTeam.name : (formData.team_id ? formData.team_name : '')
      };

      if (editingUser && !bodyData.password) {
        delete bodyData.password;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(bodyData)
      });

      if (!response.ok) {
        let errorMsg = 'Gặp lỗi trong quá trình xử lý yêu cầu.';
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errJson = await response.json();
          errorMsg = errJson.error || errorMsg;
        }
        throw new Error(errorMsg);
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
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        let errorMsg = 'Lỗi khi xóa người dùng.';
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errJson = await response.json();
          errorMsg = errJson.error || errorMsg;
        }
        throw new Error(errorMsg);
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

  // Handle Team Modal
  const handleOpenAddTeam = () => {
    setEditingTeam(null);
    setTeamFormData({
      name: '',
      leader_id: '',
      leader_name: '',
      kpi_target: 800000000
    });
    setIsTeamFormOpen(true);
  };

  const handleOpenEditTeam = (team: Team) => {
    setEditingTeam(team);
    setTeamFormData({
      name: team.name,
      leader_id: team.leader_id || '',
      leader_name: team.leader_name || '',
      kpi_target: team.kpi_target || 800000000
    });
    setIsTeamFormOpen(true);
  };

  const handleTeamFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!teamFormData.name.trim()) {
      setError('Tên Team là bắt buộc.');
      return;
    }

    try {
      const token = session?.access_token;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const url = editingTeam ? `/api/admin/teams/${editingTeam.id}` : '/api/admin/teams';
      const method = editingTeam ? 'PUT' : 'POST';

      const selectedLeader = users.find(u => u.id === teamFormData.leader_id);
      const bodyData = {
        ...teamFormData,
        leader_name: selectedLeader ? `${selectedLeader.full_name} (${ROLE_LABELS[selectedLeader.role]?.label || selectedLeader.role})` : teamFormData.leader_name
      };

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(bodyData)
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Thao tác không thành công.');
      }

      setActionSuccess(editingTeam ? 'Cập nhật thông tin Team thành công!' : 'Tạo Team mới thành công!');
      setIsTeamFormOpen(false);
      fetchTeams();
      fetchUsers();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu thông tin Team.');
    }
  };

  const handleDeleteTeam = async () => {
    if (!deleteTeamTarget) return;
    try {
      setIsDeleting(true);
      setError(null);
      const token = session?.access_token;
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`/api/admin/teams/${deleteTeamTarget.id}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        throw new Error('Không thể xóa Team.');
      }

      setTeams(prev => prev.filter(t => t.id !== deleteTeamTarget.id));
      setDeleteTeamTarget(null);
      setActionSuccess('Xóa Team thành công!');
      fetchUsers();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi xóa Team.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter and search users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.team_name || '').toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesTeam = teamFilter === 'all' || user.team_id === teamFilter || (teamFilter === 'none' && !user.team_id);
    
    return matchesSearch && matchesRole && matchesTeam;
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

      {/* Main Tab Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'users' 
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200/80' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Quản lý Nhân sự & Tài khoản</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-extrabold">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('teams')}
            className={`px-4 py-2.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'teams' 
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200/80' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>Quản lý Team Kinh doanh</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-extrabold">
              {teams.length}
            </span>
          </button>
        </div>

        <div>
          {activeTab === 'users' ? (
            <button
              onClick={handleOpenAddUser}
              className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Thêm Tài khoản Mới</span>
            </button>
          ) : (
            <button
              onClick={handleOpenAddTeam}
              className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo Team Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: USER ACCOUNTS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm theo Tên, Email, SĐT, Công ty, Team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {/* Role filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <Shield className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-bold text-gray-500">Vai trò:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-transparent text-xs font-extrabold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="all">Tất cả ({users.length})</option>
                  {Object.entries(ROLE_LABELS).map(([roleKey, roleVal]) => (
                    <option key={roleKey} value={roleKey}>
                      {roleVal.label} ({users.filter(u => u.role === roleKey).length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Team filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-bold text-gray-500">Team:</span>
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="bg-transparent text-xs font-extrabold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="all">Tất cả Team</option>
                  <option value="none">Chưa gán Team</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={fetchUsers}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer"
                title="Làm mới danh sách"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Users table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-500 font-semibold text-xs flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span>Đang tải danh sách người dùng...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-semibold text-xs">
                Không tìm thấy tài khoản người dùng phù hợp.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                      <th className="py-3.5 px-4">Họ và Tên</th>
                      <th className="py-3.5 px-4">Email / Tài khoản</th>
                      <th className="py-3.5 px-4">SĐT</th>
                      <th className="py-3.5 px-4">Vai Trò (Role)</th>
                      <th className="py-3.5 px-4">Team Kinh Doanh</th>
                      <th className="py-3.5 px-4">Leader Phụ Trách</th>
                      <th className="py-3.5 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredUsers.map((u) => {
                      const roleConfig = ROLE_LABELS[u.role] || { 
                        label: u.role, 
                        color: 'text-gray-700', 
                        bg: 'bg-gray-100', 
                        border: 'border-gray-200' 
                      };

                      const leaderObj = users.find(l => l.id === u.leader_id);
                      const teamObj = teams.find(t => t.id === u.team_id) || (u.team_name ? { name: u.team_name } : null);

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-all group">
                          <td className="py-3.5 px-4 font-black text-slate-800">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-700 text-xs shadow-xs">
                                {u.full_name ? u.full_name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-900">{u.full_name || 'Chưa đặt tên'}</div>
                                {u.company_name && (
                                  <div className="text-[10px] text-gray-400 font-bold">{u.company_name}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-bold text-slate-700">
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-gray-400" />
                              <span>{u.email}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-bold text-slate-600">
                            {u.phone ? (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-gray-400" />
                                <span>{u.phone}</span>
                              </div>
                            ) : (
                              <span className="text-gray-300 italic">Chưa có</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border ${roleConfig.bg} ${roleConfig.color} ${roleConfig.border}`}>
                              <Shield className="w-3 h-3" />
                              <span>{roleConfig.label}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-bold">
                            {teamObj ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Building2 className="w-3 h-3 text-indigo-500" />
                                <span>{teamObj.name}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic font-semibold">Chưa gán Team</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-extrabold text-slate-700">
                            {leaderObj ? (
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                <span>{leaderObj.full_name}</span>
                              </div>
                            ) : (
                              <span className="text-gray-300 italic font-semibold">Tự do / Top Leader</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEditUser(u)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                                title="Chỉnh sửa tài khoản"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(u)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                title="Xóa tài khoản"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TEAMS MANAGEMENT */}
      {activeTab === 'teams' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {teams.map((t) => {
              const teamMembers = users.filter(u => u.team_id === t.id || u.team_name === t.name);
              const leaderUser = users.find(u => u.id === t.leader_id);

              return (
                <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-black">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-sm">{t.name}</h3>
                          <span className="text-[10px] font-bold text-slate-400">ID: {t.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditTeam(t)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                          title="Sửa thông tin Team"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTeamTarget(t)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="Xóa Team"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="py-4 space-y-3">
                      {/* Leader */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-500 flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          Trưởng nhóm (Leader):
                        </span>
                        <span className="font-black text-slate-800">
                          {leaderUser ? leaderUser.full_name : (t.leader_name || 'Chưa chỉ định')}
                        </span>
                      </div>

                      {/* KPI Target */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-500 flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-emerald-500" />
                          Mục tiêu KPI Tháng:
                        </span>
                        <span className="font-black text-emerald-600">
                          {(t.kpi_target || 0).toLocaleString('vi-VN')} đ
                        </span>
                      </div>

                      {/* Member count */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-500 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-blue-500" />
                          Số thành viên:
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-black text-[11px] border border-blue-200">
                          {teamMembers.length} Sale
                        </span>
                      </div>
                    </div>

                    {/* Member list preview */}
                    <div className="pt-3 border-t border-slate-100">
                      <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Thành viên trong Team:</div>
                      {teamMembers.length === 0 ? (
                        <div className="text-xs text-slate-400 italic">Chưa có thành viên nào gán vào Team này.</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {teamMembers.slice(0, 5).map(m => (
                            <span key={m.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px]">
                              <span>{m.full_name}</span>
                            </span>
                          ))}
                          {teamMembers.length > 5 && (
                            <span className="px-2 py-1 rounded-lg bg-slate-200 text-slate-600 font-black text-[10px]">
                              +{teamMembers.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* USER EDIT/ADD MODAL */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-lg overflow-hidden my-8"
            >
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-400" />
                  <h3 className="font-black text-sm">
                    {editingUser ? 'Chỉnh Sửa Tài Khoản Người Dùng' : 'Tạo Tài Khoản Người Dùng Mới'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUserFormSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span>Email đăng nhập *</span>
                  </label>
                  <input
                    type="email"
                    placeholder="user@adluxury.net"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-gray-400" />
                    <span>Mật khẩu {editingUser ? '(Để trống nếu không đổi)' : '*'}</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={editingUser ? '••••••••' : 'Nhập mật khẩu khởi tạo'}
                      required={!editingUser}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full pl-4 pr-10 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Full name */}
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
                    placeholder="AD Luxury Travel"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                {/* Role SELECT */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-gray-400" />
                    <span>Phân vai trò (Role CRM)</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full h-9 px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs font-semibold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all cursor-pointer"
                  >
                    {Object.entries(ROLE_LABELS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>

                {/* Team SELECT (Thuộc Team Kinh Doanh) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Thuộc Team / Nhóm kinh doanh</span>
                  </label>
                  <select
                    value={formData.team_id || ''}
                    onChange={(e) => {
                      const tId = e.target.value;
                      const selectedT = teams.find(t => t.id === tId);
                      setFormData({ 
                        ...formData, 
                        team_id: tId,
                        team_name: selectedT ? selectedT.name : ''
                      });
                    }}
                    className="w-full h-9 px-3 py-1.5 border border-indigo-200 bg-indigo-50/50 rounded-lg text-xs font-semibold text-indigo-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- Chưa gán Team nào --</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Leader: {t.leader_name || 'Chưa chỉ định'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Leader SELECT */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    <span>Leader phụ trách (Trưởng nhóm trực tiếp)</span>
                  </label>
                  <select
                    value={formData.leader_id || ''}
                    onChange={(e) => setFormData({ ...formData, leader_id: e.target.value })}
                    className="w-full h-9 px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs font-semibold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- Không chọn (Tự do / Top Leader) --</option>
                    {users
                      .filter(u => u.id !== editingUser?.id && (u.role === 'sale_leader' || u.role === 'marketing_leader' || u.role === 'admin' || u.role === 'bod'))
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({ROLE_LABELS[u.role]?.label || u.role})
                        </option>
                      ))}
                  </select>
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

      {/* TEAM EDIT/ADD MODAL */}
      <AnimatePresence>
        {isTeamFormOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-5 bg-indigo-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-300" />
                  <h3 className="font-black text-sm">
                    {editingTeam ? 'Chỉnh Sửa Team Kinh Doanh' : 'Tạo Team Kinh Doanh Mới'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsTeamFormOpen(false)}
                  className="p-1 text-indigo-300 hover:text-white rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTeamFormSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Team Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Tên Team / Nhóm *</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Team Đông Nam Á, Team Châu Âu & Mỹ..."
                    required
                    value={teamFormData.name}
                    onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                {/* Team Leader Select */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    <span>Trưởng Nhóm (Leader)</span>
                  </label>
                  <select
                    value={teamFormData.leader_id}
                    onChange={(e) => {
                      const lId = e.target.value;
                      const u = users.find(x => x.id === lId);
                      setTeamFormData({
                        ...teamFormData,
                        leader_id: lId,
                        leader_name: u ? u.full_name : ''
                      });
                    }}
                    className="w-full px-3.5 py-2 border border-slate-300 bg-white rounded-xl text-xs font-extrabold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- Chưa chọn Leader --</option>
                    {users
                      .filter(u => u.role === 'sale_leader' || u.role === 'admin' || u.role === 'bod' || u.role === 'marketing_leader')
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({ROLE_LABELS[u.role]?.label || u.role}) - {u.email}
                        </option>
                      ))}
                  </select>
                </div>

                {/* KPI Target */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Mục tiêu Doanh số KPI Tháng (VNĐ)</span>
                  </label>
                  <input
                    type="number"
                    step="10000000"
                    placeholder="800000000"
                    value={teamFormData.kpi_target}
                    onChange={(e) => setTeamFormData({ ...teamFormData, kpi_target: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                {/* Modal Footer */}
                <div className="pt-4 border-t border-slate-150 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsTeamFormOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/10 transition-all cursor-pointer"
                  >
                    {editingTeam ? 'Cập nhật Team' : 'Tạo Team Mới'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE USER CONFIRM MODAL */}
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
                  <AlertCircle className="w-6 h-6" />
                </div>
                
                <div>
                  <h3 className="text-base font-black text-slate-900">Xác nhận xóa người dùng?</h3>
                  <p className="text-xs text-gray-500 font-semibold mt-1.5 leading-relaxed">
                    Hành động này sẽ xóa hoàn toàn thông tin profile của <strong className="text-rose-600">{deleteTarget.full_name}</strong> ({deleteTarget.email}) khỏi cơ sở dữ liệu.
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl text-left">
                    {error}
                  </div>
                )}

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

      {/* DELETE TEAM CONFIRM MODAL */}
      <AnimatePresence>
        {deleteTeamTarget && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-200">
                  <AlertCircle className="w-6 h-6" />
                </div>
                
                <div>
                  <h3 className="text-base font-black text-slate-900">Xác nhận xóa Team?</h3>
                  <p className="text-xs text-gray-500 font-semibold mt-1.5 leading-relaxed">
                    Xóa <strong className="text-rose-600">{deleteTeamTarget.name}</strong>. Các nhân viên thuộc Team này sẽ trở về trạng thái "Chưa gán Team".
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl text-left">
                    {error}
                  </div>
                )}

                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    disabled={isDeleting}
                    onClick={() => setDeleteTeamTarget(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-55"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    disabled={isDeleting}
                    onClick={handleDeleteTeam}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/15 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-55"
                  >
                    {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Xác nhận Xóa Team</span>
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
