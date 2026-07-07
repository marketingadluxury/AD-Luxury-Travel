import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, User, Phone, ArrowRight, Building2, Map } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        // [Development fallback for preview] Check if supabase uses placeholder key
        if ((import.meta as any).env.VITE_SUPABASE_URL?.includes('placeholder') || !(import.meta as any).env.VITE_SUPABASE_URL) {
          setError('Hệ thống đang chạy chế độ không có kết nối cơ sở dữ liệu. Bỏ qua xác thực để vào hệ thống.');
          // Simulate auth context override if possible, or just dispatch an event
          // It's better to just show the error for now, but we can emit a fake session event
          supabase.auth.setSession({
            access_token: 'mock_token',
            refresh_token: 'mock_token',
          });
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const role = companyName.trim() ? 'Đại lý' : 'CTV';
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phone,
              company_name: companyName,
              role: role
            }
          }
        });
        if (error) throw error;
        setMessage('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.');
      }
    } catch (err: any) {
      const errMsg = err?.message || (typeof err === 'string' ? err : '') || 'Có lỗi xảy ra, vui lòng thử lại.';
      if (errMsg.includes('FetchError') || errMsg.includes('placeholder') || errMsg.includes('Failed to fetch')) {
        // Mock success for preview since keys might not be set
        if (isLogin) {
            // we will let the parent handle mock login if needed, or just show error.
            setError('Tính năng đăng nhập yêu cầu cấu hình Supabase. Vui lòng thiết lập biến môi trường.');
        } else {
            setError('Tính năng đăng ký yêu cầu cấu hình Supabase. Vui lòng thiết lập biến môi trường.');
        }
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-5xl w-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side - Branding/Image */}
        <div className="md:w-5/12 bg-blue-700 text-white p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full fill-current">
              <polygon points="0,100 100,0 100,100" />
            </svg>
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-12">
              <div className="bg-white p-2 rounded-lg">
                <Map className="w-6 h-6 text-blue-700" />
              </div>
              <span className="text-2xl font-bold tracking-tight">AD Luxury Travel</span>
            </div>
            
            <h1 className="text-4xl font-bold mb-4 leading-tight">
              Quản lý Tour <br/> & Dịch vụ chuyên nghiệp
            </h1>
            <p className="text-blue-100 mb-8 text-sm">
              Hệ thống CRM dành riêng cho công ty du lịch. Quản lý điều hành, quỹ chỗ, visa và khách hàng một cách liền mạch.
            </p>
          </div>

          <div className="relative z-10 text-sm text-blue-200">
            &copy; 2026 AD Luxury Travel CRM. All rights reserved.
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="md:w-7/12 p-8 sm:p-12">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isLogin ? 'Đăng nhập hệ thống' : 'Đăng ký tài khoản Đối tác/CTV'}
            </h2>
            <p className="text-gray-500 text-sm mb-8">
              {isLogin 
                ? 'Vui lòng điền thông tin đăng nhập để tiếp tục' 
                : 'Điền thông tin bên dưới để trở thành Đại lý/Cộng tác viên'}
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}
            
            {message && (
              <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-100">
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        required
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
                        placeholder="Nguyễn Văn A"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        required
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
                        placeholder="0901234567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên công ty <span className="text-gray-400 font-normal">(Tuỳ chọn)</span></label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building2 className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
                        placeholder="Ví dụ: AD Luxury Travel (Nếu trống sẽ mặc định là CTV)"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    required
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    required
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {isLogin && (
                <div className="flex items-center justify-end">
                  <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    Quên mật khẩu?
                  </a>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Đăng ký tài khoản'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center">
              <p className="text-sm text-gray-600">
                {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError(null);
                    setMessage(null);
                  }}
                  className="ml-1 font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
                >
                  {isLogin ? 'Đăng ký Đại lý/CTV' : 'Đăng nhập ngay'}
                </button>
              </p>
            </div>
            
            <div className="mt-4 text-center">
               <p className="text-xs text-gray-400 italic">
                 Nhân viên công ty (Sales, Điều hành...) vui lòng sử dụng tài khoản do Quản trị viên cấp.
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
