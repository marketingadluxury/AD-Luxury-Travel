import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { User, Save, Building, Phone, Mail, Loader2, Key, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Profile() {
  const { profile, updateProfile, updatePassword, user } = useAuth();
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    company_name: profile?.company_name || '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Password change states
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await updateProfile(formData);
      setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
      toast.success('Đã cập nhật thông tin thành công!');
    } catch (err) {
      setMessage({ type: 'error', text: 'Đã có lỗi xảy ra khi cập nhật.' });
      toast.error('Có lỗi xảy ra khi cập nhật thông tin.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword.length < 6) {
      toast.error('Mật khẩu mới phải dài ít nhất 6 ký tự!');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Mật khẩu xác nhận không trùng khớp!');
      return;
    }

    setPasswordLoading(true);
    try {
      await updatePassword(passwordData.newPassword);
      toast.success('Đổi mật khẩu thành công!');
      setPasswordData({ newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Có lỗi xảy ra khi đổi mật khẩu.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
        <User className="w-7 h-7 text-blue-600" />
        Thông tin cá nhân
      </h1>
      
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Email tài khoản</label>
            <div className="mt-1 flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-500 text-sm font-semibold">
              <Mail className="w-5 h-5 mr-3 text-gray-400" />
              {user?.email}
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Họ và tên</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={e => setFormData({...formData, full_name: e.target.value})}
              placeholder="Nhập họ và tên..."
              className="mt-1 block w-full p-3 text-sm font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Số điện thoại</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              placeholder="Nhập số điện thoại..."
              className="mt-1 block w-full p-3 text-sm font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
 
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Tên công ty / Đơn vị</label>
            <input
              type="text"
              value={formData.company_name}
              onChange={e => setFormData({...formData, company_name: e.target.value})}
              placeholder="Nhập tên công ty lữ hành..."
              className="mt-1 block w-full p-3 text-sm font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
        </div>
 
        {message && (
          <div className={`mt-4 p-3 rounded-lg text-xs font-bold ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-150' : 'bg-red-50 text-red-700 border border-red-150'}`}>
            {message.text}
          </div>
        )}
 
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full flex justify-center items-center p-3 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          Lưu thông tin cá nhân
        </button>
      </form>

      {/* Accordion / Section for Password Change */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div 
          onClick={() => setShowPasswordForm(!showPasswordForm)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 rounded-lg border border-amber-100 text-amber-600">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Bảo mật & Đổi mật khẩu</h3>
              <p className="text-[11px] text-gray-500">Cập nhật mật khẩu bảo vệ tài khoản CRM của bạn</p>
            </div>
          </div>
          <button 
            type="button"
            className="text-xs font-bold text-blue-600 hover:text-blue-800"
          >
            {showPasswordForm ? 'Thu gọn' : 'Yêu cầu đổi'}
          </button>
        </div>

        {showPasswordForm && (
          <form onSubmit={handlePasswordSubmit} className="mt-6 border-t border-gray-100 pt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Mật khẩu mới</label>
              <div className="relative mt-1">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                  required
                  className="block w-full p-3 pr-10 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Xác nhận mật khẩu mới</label>
              <div className="relative mt-1">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  placeholder="Xác thực lại mật khẩu mới..."
                  required
                  className="block w-full p-3 pr-10 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={passwordLoading}
                className="flex-1 flex justify-center items-center p-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {passwordLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                Xác nhận đổi mật khẩu
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false);
                  setPasswordData({ newPassword: '', confirmPassword: '' });
                }}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-sm transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
