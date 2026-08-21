import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  Save,
  X,
  History,
  ShieldCheck,
  Shield
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { LeaveBalance, Profile, getRoleConfig } from '../types';
import { getEffectiveLeaveBalance } from '../lib/payrollUtils';
import { CustomSelect } from './CustomSelect';

export const LeaveBalanceManagement: React.FC = () => {
  const { profile } = useAuth();
  const { profilesList, leaveBalances, updateLeaveBalance, leaveRequests, holidays } = useCRM();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modal điều chỉnh quỹ phép
  const [editingStaff, setEditingStaff] = useState<Profile | null>(null);
  const [modalTotalDays, setModalTotalDays] = useState<number>(12);
  const [modalUsedDays, setModalUsedDays] = useState<number>(0);
  const [modalNote, setModalNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Danh sách nhân sự nội bộ (loại trừ Admin, đại lý và CTV)
  const staffList = useMemo(() => {
    return profilesList.filter((p) => {
      // Loại trừ Admin, Đại lý và CTV
      if (p.role === 'admin' || p.role === 'agent' || p.role === 'CTV') return false;

      const isInternal = ['hr', 'sale', 'sale_leader', 'operator', 'accounting', 'visa', 'bod', 'tour_guide', 'marketing', 'marketing_leader'].includes(p.role || '');
      if (!isInternal) return false;

      if (roleFilter !== 'all' && p.role !== roleFilter) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = (p.full_name || '').toLowerCase().includes(term);
        const matchEmail = (p.email || '').toLowerCase().includes(term);
        const matchPhone = (p.phone || '').toLowerCase().includes(term);
        if (!matchName && !matchEmail && !matchPhone) return false;
      }

      return true;
    });
  }, [profilesList, roleFilter, searchTerm]);

  // Mở modal điều chỉnh
  const handleOpenEdit = (staff: Profile) => {
    const eff = getEffectiveLeaveBalance(staff.id, selectedYear, leaveBalances, staff, undefined, leaveRequests, holidays);
    setEditingStaff(staff);
    setModalTotalDays(eff.total);
    setModalUsedDays(eff.used);
    setModalNote(eff.note || '');
  };

  // Lưu điều chỉnh quỹ phép
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    if (modalTotalDays < 0 || modalUsedDays < 0) {
      alert('Số ngày phép không thể là số âm.');
      return;
    }

    setIsSaving(true);
    try {
      await updateLeaveBalance(editingStaff.id, selectedYear, {
        total_days: Number(modalTotalDays),
        used_days: Number(modalUsedDays),
        remaining_days: Math.max(0, Number(modalTotalDays) - Number(modalUsedDays)),
        note: modalNote.trim() || undefined,
        updated_by: profile?.full_name || 'Nhân sự (HR)',
      });
      setEditingStaff(null);
    } catch (err) {
      console.error('Lỗi khi cập nhật quỹ phép:', err);
      alert('Không thể cập nhật quỹ phép. Vui lòng thử lại!');
    } finally {
      setIsSaving(false);
    }
  };

  // Tính toán thống kê tổng quan
  const stats = useMemo(() => {
    let totalEmployees = staffList.length;
    let totalAllottedDays = 0;
    let totalUsedDays = 0;

    staffList.forEach((s) => {
      const eff = getEffectiveLeaveBalance(s.id, selectedYear, leaveBalances, s, undefined, leaveRequests, holidays);
      totalAllottedDays += eff.total;
      totalUsedDays += eff.used;
    });

    const totalRemainingDays = Math.max(0, totalAllottedDays - totalUsedDays);

    return {
      totalEmployees,
      totalAllottedDays,
      totalUsedDays,
      totalRemainingDays,
    };
  }, [staffList, leaveBalances, selectedYear]);

  return (
    <div className="space-y-6">
      {/* Tiêu đề & Giới thiệu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-cyan-600" />
            Quản Lý & Điều Chỉnh Quỹ Phép Năm Thủ Công
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Quyền dành cho Nhân sự (HR), BOD và Quản trị viên điều chỉnh ngày phép, thâm niên và phép thưởng cho nhân viên.
          </p>
        </div>

        {/* Chọn Năm */}
        <CustomSelect
          value={String(selectedYear)}
          onChange={(val) => setSelectedYear(Number(val))}
          options={[2024, 2025, 2026, 2027, 2028].map((y) => ({
            value: String(y),
            label: `Năm ${y}`,
          }))}
          icon={<Calendar className="w-3.5 h-3.5 text-cyan-600" />}
          label="Năm hạch toán"
          className="w-36 sm:w-40"
        />
      </div>

      {/* Thẻ Thống Kê Tổng Quan */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase">Tổng Nhân Sự Quản Lý</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{stats.totalEmployees} người</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Khối nhân sự nội bộ</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-blue-600 uppercase">Tổng Quỹ Phép Được Cấp</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{stats.totalAllottedDays} ngày</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Năm {selectedYear}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-amber-600 uppercase">Tổng Phép Đã Dùng</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{stats.totalUsedDays} ngày</div>
          <div className="text-[11px] text-amber-600/80 mt-0.5">Nghỉ phép hưởng lương</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-emerald-600 uppercase">Tổng Quỹ Phép Còn Lại</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{stats.totalRemainingDays} ngày</div>
          <div className="text-[11px] text-emerald-600/80 mt-0.5">Chưa sử dụng</div>
        </div>
      </div>

      {/* Bộ Lọc & Tìm Kiếm */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2.5 w-full md:w-auto">
          {/* Lọc Vai Trò */}
          <CustomSelect
            value={roleFilter}
            onChange={(val) => setRoleFilter(val)}
            options={[
              { value: 'all', label: 'Tất cả bộ phận' },
              { value: 'sale', label: 'Nhân viên Kinh doanh (Sale)' },
              { value: 'sale_leader', label: 'Sale Leader (Trưởng nhóm)' },
              { value: 'marketing', label: 'Nhân viên Marketing' },
              { value: 'marketing_leader', label: 'Trưởng phòng Marketing' },
              { value: 'operator', label: 'Điều hành Tour' },
              { value: 'accounting', label: 'Kế toán' },
              { value: 'visa', label: 'Bộ phận Visa' },
              { value: 'tour_guide', label: 'Hướng Dẫn Viên (HDV)' },
              { value: 'hr', label: 'Nhân sự (HR)' },
              { value: 'bod', label: 'Ban Giám Đốc (BOD)' },
              { value: 'admin', label: 'Quản trị viên (Admin)' },
            ]}
            icon={<Users className="w-3.5 h-3.5 text-slate-500" />}
            label="Bộ phận"
            className="w-60"
          />
        </div>

        {/* Ô Tìm Kiếm */}
        <div className="flex flex-col gap-1 w-full md:w-80">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Tìm kiếm
          </label>
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên nhân viên, email, SĐT..."
              className="w-full h-[38px] pl-9 pr-3 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Bảng Danh Sách & Điều Chỉnh Quỹ Phép */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4 text-center w-12">STT</th>
                <th className="py-3.5 px-4">Nhân sự</th>
                <th className="py-3.5 px-4">Bộ phận</th>
                <th className="py-3.5 px-4 text-center bg-blue-50/60 text-blue-900 border-x border-blue-100">
                  Tổng Phép ({selectedYear})
                </th>
                <th className="py-3.5 px-4 text-center text-amber-700 bg-amber-50/30">
                  Đã Sử Dụng
                </th>
                <th className="py-3.5 px-4 text-center bg-emerald-50 text-emerald-900 font-black border-x border-emerald-200">
                  Còn Lại
                </th>
                <th className="py-3.5 px-4">Ghi Chú / Lý Do Điều Chỉnh</th>
                <th className="py-3.5 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">Không tìm thấy nhân sự nào</p>
                  </td>
                </tr>
              ) : (
                staffList.map((staff, idx) => {
                  const eff = getEffectiveLeaveBalance(staff.id, selectedYear, leaveBalances, staff, undefined, leaveRequests, holidays);
                  const total = eff.total;
                  const used = eff.used;
                  const remaining = eff.remaining;
                  const note = eff.note;
                  const updatedBy = eff.updatedBy;
                  const isManual = eff.isManualOverride;

                  return (
                    <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 text-center font-medium text-slate-400">{idx + 1}</td>

                      {/* Tên & Email */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{staff.full_name || 'Chưa cập nhật'}</div>
                        <div className="text-[11px] text-slate-400">{staff.email || staff.phone || '-'}</div>
                      </td>

                      {/* Role / Bộ phận */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {(() => {
                          const roleConfig = getRoleConfig(staff.role);
                          return (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border ${roleConfig.bg} ${roleConfig.color} ${roleConfig.border}`}>
                              <Shield className="w-3 h-3" />
                              <span>{roleConfig.label}</span>
                            </span>
                          );
                        })()}
                      </td>

                      {/* Tổng ngày phép */}
                      <td className="py-3.5 px-4 text-center font-extrabold text-blue-900 bg-blue-50/30 border-x border-blue-50">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 font-black">
                          {total} ngày
                        </span>
                      </td>

                      {/* Đã dùng */}
                      <td className="py-3.5 px-4 text-center font-bold text-amber-700 bg-amber-50/20">
                        {used > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                            {used} ngày
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>

                      {/* Còn lại */}
                      <td className="py-3.5 px-4 text-center font-black text-sm text-emerald-700 bg-emerald-50/70 border-x border-emerald-100">
                        <span className="inline-block px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-black">
                          {remaining} ngày
                        </span>
                      </td>

                      {/* Ghi chú */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {note ? (
                          <div>
                            <div className="text-slate-800 font-medium truncate" title={note}>
                              {note}
                            </div>
                            {updatedBy && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Cập nhật bởi: <strong>{updatedBy}</strong>
                              </div>
                            )}
                          </div>
                        ) : isManual ? (
                          <span className="text-slate-400 italic">Đã điều chỉnh thủ công</span>
                        ) : (
                          <span className="text-slate-400 italic">Tích lũy 1 ngày/tháng ({total} ngày)</span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(staff)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 font-bold text-xs shadow-2xs transition-all cursor-pointer active:scale-95"
                          title="Điều chỉnh số ngày phép thủ công"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Điều chỉnh</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Điều Chỉnh Quỹ Phép */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600/10 text-cyan-600 flex items-center justify-center font-bold">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Điều Chỉnh Quỹ Phép Năm {selectedYear}</h3>
                  <p className="text-xs text-slate-500">
                    Nhân viên: <strong className="text-slate-700">{editingStaff.full_name || editingStaff.email}</strong> ({editingStaff.role})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="p-6 space-y-4 overflow-y-auto">
              {/* Preview Thẻ Tính Toán */}
              <div className="p-4 rounded-xl bg-cyan-50/70 border border-cyan-200 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[11px] font-bold text-cyan-800 uppercase">Tổng Cấp</div>
                  <div className="text-xl font-black text-cyan-900 mt-1">{modalTotalDays}</div>
                  <div className="text-[10px] text-cyan-600">ngày</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-amber-800 uppercase">Đã Dùng</div>
                  <div className="text-xl font-black text-amber-900 mt-1">{modalUsedDays}</div>
                  <div className="text-[10px] text-amber-600">ngày</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-emerald-800 uppercase">Còn Lại</div>
                  <div className="text-xl font-black text-emerald-700 mt-1">
                    {Math.max(0, Number(modalTotalDays) - Number(modalUsedDays))}
                  </div>
                  <div className="text-[10px] text-emerald-600">ngày</div>
                </div>
              </div>

              {/* Ô Nhập Tổng Ngày Phép Được Cấp */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tổng số ngày phép được cấp trong năm ({selectedYear}) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="60"
                  value={modalTotalDays}
                  onChange={(e) => setModalTotalDays(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Mặc định theo Luật lao động là 12 ngày. Có thể cộng thêm thâm niên (+1 ngày/5 năm) hoặc phép thưởng dự án.
                </p>
              </div>

              {/* Ô Nhập Số Ngày Đã Sử Dụng */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số ngày phép đã sử dụng *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="60"
                  value={modalUsedDays}
                  onChange={(e) => setModalUsedDays(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Hệ thống tự động cộng dồn khi duyệt đơn nghỉ phép năm hoặc bạn có thể điều chỉnh trực tiếp ở đây.
                </p>
              </div>

              {/* Ghi chú / Lý do điều chỉnh */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lý do / Ghi chú điều chỉnh (Tùy chọn)
                </label>
                <textarea
                  rows={3}
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder="VD: Cộng 2 ngày phép thâm niên theo quyết định BOD, chuyển 1 ngày phép tồn từ 2025..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Đang lưu...' : 'Lưu Điều Chỉnh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
