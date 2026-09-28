import React from 'react';
import { Printer, X, FileText } from 'lucide-react';
import { LeaveRequest } from '@/types';

interface LeaveRequestPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  leaveRequest: LeaveRequest | null;
  employeePhone?: string;
  departmentName?: string;
  hireDate?: string;
}

// Format dd/mm/yyyy
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function LeaveRequestPrintModal({
  isOpen,
  onClose,
  leaveRequest,
  employeePhone,
  departmentName,
  hireDate = '01/01/2025'
}: LeaveRequestPrintModalProps) {
  if (!isOpen || !leaveRequest) return null;

  const dateOfApplication = formatDate(leaveRequest.created_at);
  const startDateStr = formatDate(leaveRequest.start_date);
  const endDateStr = formatDate(leaveRequest.end_date);

  // Chuỗi diễn giải thời gian xin nghỉ
  let applyingLeaveFrom = '';
  if (leaveRequest.leave_session === 'morning') {
    applyingLeaveFrom = `nửa buổi sáng ngày ${startDateStr}`;
  } else if (leaveRequest.leave_session === 'afternoon') {
    applyingLeaveFrom = `nửa buổi chiều ngày ${startDateStr}`;
  } else if (leaveRequest.start_date === leaveRequest.end_date) {
    applyingLeaveFrom = `ngày ${startDateStr}`;
  } else {
    applyingLeaveFrom = `từ ngày ${startDateStr} đến ngày ${endDateStr}`;
  }

  const handlePrint = () => {
    window.print();
  };

  // Xác định checkbox tick
  const isAnnual = leaveRequest.type === 'annual';
  const isUnpaid = leaveRequest.type === 'unpaid';
  const isCompensatory = leaveRequest.type === 'compensatory';
  const isSpecial = leaveRequest.type === 'special';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #leave-request-print-area, #leave-request-print-area * {
            visibility: visible !important;
          }
          #leave-request-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            height: auto !important;
            margin: 0 !important;
            padding: 10mm 14mm 8mm 14mm !important;
            background: white !important;
            z-index: 999999 !important;
            box-shadow: none !important;
            border: none !important;
            color: #000 !important;
            font-family: 'Times New Roman', Times, serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>

      {/* Modal Container */}
      <div className="bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Toolbar (Screen only) */}
        <div className="bg-white px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Xuất Đơn Xin Nghỉ Phép (Application For Leave)
              </h2>
              <span className="text-[11px] text-slate-500 font-medium">Nhân viên: {leaveRequest.user_name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>In / Tải PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Sheet Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center bg-slate-200/70">
          <div
            id="leave-request-print-area"
            className="w-full max-w-[210mm] bg-white p-6 sm:p-10 shadow-lg text-slate-900 font-serif leading-snug text-[11.5px] sm:text-[12px] relative"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            {/* Top Company Header */}
            <div className="border-b border-black/40 pb-2 mb-2.5">
              <div className="flex flex-row items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-xs sm:text-[13px] uppercase tracking-wider text-black">
                    CTY TNHH THƯƠNG MẠI VÀ DỊCH VỤ AD LUXURY
                  </div>
                  <div className="text-[10.5px] sm:text-[11px] text-slate-700 mt-0.5">
                    463B/18 Cách Mạng Tháng 8, P. Hòa Hưng, Tp.HCM
                  </div>
                </div>

                <div className="text-right text-[10.5px] sm:text-[11px] text-slate-700 leading-tight">
                  <div>Website: <span className="text-black font-medium underline underline-offset-2">https://www.adluxury.net</span></div>
                  <div className="mt-0.5">Fanpage: <span className="text-black font-medium underline underline-offset-2">https://www.fb.com/adluxurytours</span></div>
                </div>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-2.5">
              <h1 className="text-[14px] sm:text-[15px] font-bold tracking-wide text-black italic uppercase">
                APPLICATION FOR LEAVE
              </h1>
              <h2 className="text-[14px] sm:text-[15px] font-bold tracking-wide text-black uppercase mt-0.5">
                ĐƠN XIN NGHỈ PHÉP
              </h2>
            </div>

            {/* Section A: APPLICANT DETAILS */}
            <div className="space-y-0.5 mb-2.5">
              <div className="font-bold text-[11.5px] sm:text-[12px] uppercase tracking-wide text-black border-b border-black/20 pb-0.5 mb-1.5">
                A. APPLICANT DETAILS <span className="font-normal italic normal-case">(THÔNG TIN CÁ NHÂN)</span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:text-[11.5px]">
                <div>
                  <span className="text-slate-600 italic">Name of Employee / Họ tên: </span>
                  <strong className="text-black">{leaveRequest.user_name}</strong>
                </div>

                <div>
                  <span className="text-slate-600 italic">Emp. No. / Mã số NV: </span>
                  <span className="font-semibold text-black">{leaveRequest.user_id ? leaveRequest.user_id.slice(0, 8).toUpperCase() : 'AD-EMP'}</span>
                </div>

                <div>
                  <span className="text-slate-600 italic">Division / Phòng ban: </span>
                  <span className="text-black">{departmentName || 'Kinh doanh & Vận hành'}</span>
                </div>

                <div>
                  <span className="text-slate-600 italic">Date of Hire / Ngày vào làm: </span>
                  <span className="text-black">{hireDate}</span>
                </div>

                <div className="col-span-2">
                  <span className="text-slate-600 italic">Date of Application / Ngày viết đơn: </span>
                  <span className="text-black font-medium">{dateOfApplication}</span>
                </div>
              </div>
            </div>

            {/* Section B: LEAVE DETAILS */}
            <div className="space-y-1 mb-2.5">
              <div className="font-bold text-[11.5px] sm:text-[12px] uppercase tracking-wide text-black border-b border-black/20 pb-0.5 mb-1.5">
                B. LEAVE DETAILS <span className="font-normal italic normal-case">(THÔNG TIN CHI TIẾT VỀ VIỆC NGHỈ PHÉP)</span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] sm:text-[11.5px]">
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-slate-600 italic">Applying leave from / Xin nghỉ: </span>
                  <strong className="text-black">{applyingLeaveFrom}</strong>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <span className="text-slate-600 italic">Total number of days / Số ngày: </span>
                  <strong className="text-black">{leaveRequest.total_days || 1} ngày</strong>
                </div>

                <div className="col-span-2 pt-0.5">
                  <span className="text-slate-600 italic">Reason for leave / Lí do xin nghỉ: </span>
                  <span className="text-black font-medium">{leaveRequest.reason}</span>
                </div>
              </div>

              {/* Leave Type Checkboxes Table */}
              <div className="pt-1.5">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <div className="font-bold text-black">
                    LEAVE TYPE <span className="font-normal italic">(Phân loại nghỉ phép)</span>
                  </div>
                  <div className="italic text-[10px] text-slate-600">
                    (Please tick accordingly / Đánh dấu [X] vào ô thích hợp)
                  </div>
                </div>

                <div className="border border-black text-[10.5px]">
                  <div className="grid grid-cols-2 divide-x divide-black">
                    {/* Left Column */}
                    <div className="divide-y divide-black">
                      <div className="px-2 py-1 flex items-center justify-between">
                        <div className="pr-1 leading-tight">
                          <div className="font-semibold text-black">Annual Leave / Advanced Annual Leave</div>
                          <div className="italic text-[9.5px] text-slate-700">Nghỉ phép thường niên</div>
                        </div>
                        <div className="w-4.5 h-4.5 min-w-[18px] min-h-[18px] border border-black flex items-center justify-center font-bold text-xs shrink-0 bg-white">
                          {isAnnual ? 'X' : ''}
                        </div>
                      </div>

                      <div className="px-2 py-1 flex items-center justify-between">
                        <div className="pr-1 leading-tight">
                          <div className="font-semibold text-black">Urgent Leave / Paternity</div>
                          <div className="italic text-[9.5px] text-slate-700">Việc khẩn cấp vì vợ mới sinh con</div>
                        </div>
                        <div className="w-4.5 h-4.5 min-w-[18px] min-h-[18px] border border-black flex items-center justify-center font-bold text-xs shrink-0 bg-white">
                          {isSpecial ? 'X' : ''}
                        </div>
                      </div>

                      <div className="px-2 py-1 flex items-center justify-between">
                        <div className="pr-1 leading-tight">
                          <div className="font-semibold text-black">Sick Leave / Hospitalization Leave</div>
                          <div className="italic text-[9.5px] text-slate-700">Nghỉ ốm / nằm viện, bác sĩ chỉ định</div>
                        </div>
                        <div className="w-4.5 h-4.5 min-w-[18px] min-h-[18px] border border-black flex items-center justify-center font-bold text-xs shrink-0 bg-white">
                          {isCompensatory ? 'X' : ''}
                        </div>
                      </div>

                      <div className="px-2 py-1 flex items-center justify-between">
                        <div className="pr-1 leading-tight">
                          <div className="font-semibold text-black">Compassionate Leave</div>
                          <div className="italic text-[9.5px] text-slate-700">Người nhà nhập viện, mất…</div>
                        </div>
                        <div className="w-4.5 h-4.5 min-w-[18px] min-h-[18px] border border-black flex items-center justify-center font-bold text-xs shrink-0 bg-white">
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="divide-y divide-black">
                      <div className="px-2 py-1 flex items-center justify-between">
                        <div className="pr-1 leading-tight">
                          <div className="font-semibold text-black">Unpaid Leave</div>
                          <div className="italic text-[9.5px] text-slate-700">Nghỉ không lương</div>
                        </div>
                        <div className="w-4.5 h-4.5 min-w-[18px] min-h-[18px] border border-black flex items-center justify-center font-bold text-xs shrink-0 bg-white">
                          {isUnpaid ? 'X' : ''}
                        </div>
                      </div>

                      <div className="px-2 py-1 flex items-center justify-between">
                        <div className="pr-1 leading-tight">
                          <div className="font-semibold text-black">Marriage Leave / Maternity Leave</div>
                          <div className="italic text-[9.5px] text-slate-700">Nghỉ để kết hôn / Nghỉ thai sản</div>
                        </div>
                        <div className="w-4.5 h-4.5 min-w-[18px] min-h-[18px] border border-black flex items-center justify-center font-bold text-xs shrink-0 bg-white">
                        </div>
                      </div>

                      <div className="px-2 py-1 flex items-center justify-between">
                        <div className="pr-1 leading-tight">
                          <div className="font-semibold text-black">Cancellation of Leave</div>
                          <div className="italic text-[9.5px] text-slate-700">Hủy ngày xin nghỉ phép chỉ định</div>
                        </div>
                        <div className="w-4.5 h-4.5 min-w-[18px] min-h-[18px] border border-black flex items-center justify-center font-bold text-xs shrink-0 bg-white">
                        </div>
                      </div>

                      <div className="px-2 py-1 flex items-center justify-between">
                        <div className="pr-1 leading-tight">
                          <div className="font-semibold text-black">Others (please specify)</div>
                          <div className="italic text-[9.5px] text-slate-700">Lí do khác (ghi cụ thể)</div>
                        </div>
                        <div className="w-4.5 h-4.5 min-w-[18px] min-h-[18px] border border-black flex items-center justify-center font-bold text-xs shrink-0 bg-white">
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section C: OTHER DETAILS */}
            <div className="space-y-1 mb-2.5">
              <div className="font-bold text-[11.5px] sm:text-[12px] uppercase tracking-wide text-black border-b border-black/20 pb-0.5 mb-1">
                C. OTHER DETAILS <span className="font-normal italic normal-case">(THÔNG TIN KHÁC)</span>
              </div>

              <div className="text-[10.5px] sm:text-[11px] text-slate-900 leading-tight">
                <span className="font-bold">C.1 Description of assignment now being performed by Applicant: </span>
                <span className="italic text-slate-700">(Nhân viên xin nghỉ phép nộp đơn trước ngày xin nghỉ và nghỉ phép sau khi được phê duyệt)</span>
                <div className="border-b border-dotted border-black/40 h-3.5 my-0.5"></div>
              </div>

              <div className="text-[10.5px] sm:text-[11px] pt-0.5 leading-tight">
                <span className="font-bold">C.2 Name of back-up person / Người hỗ trợ thay thế: </span>
                <span className="text-black font-semibold">{leaveRequest.handover_user_name || 'Đã bàn giao đầy đủ cho bộ phận'}</span>
              </div>

              <div className="text-[10.5px] sm:text-[11px] pt-0.5 leading-tight">
                <span className="font-bold">C.3 Telephone contact / SĐT khẩn cấp: </span>
                <span className="font-semibold text-black">{employeePhone || '0986.977.010'}</span>
                <span className="italic text-[10px] text-slate-600 ml-1.5">(Chỉ liên lạc với nhân viên khi có tình huống khẩn cấp)</span>
              </div>

              {/* Applicant Signature */}
              <div className="pt-1.5 flex justify-between items-end">
                <div className="text-[11px]">
                  <span className="font-bold">Signature of Applicant </span>
                  <span className="italic text-[10px] text-slate-700">(Chữ ký nhân viên xin nghỉ phép): </span>
                </div>
                <div className="text-right border-b border-black min-w-[180px] text-center font-bold uppercase text-[11px] pb-0.5">
                  {leaveRequest.user_name}
                </div>
              </div>
            </div>

            {/* Section D: APPROVALS */}
            <div className="pt-2 border-t border-black">
              <div className="font-bold text-[11.5px] sm:text-[12px] uppercase tracking-wide text-black mb-1.5">
                D. APPROVALS <span className="font-normal italic normal-case">(NGƯỜI PHÊ DUYỆT)</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[10.5px]">
                <div>
                  <div className="font-bold italic">Signature of Superior</div>
                  <div className="italic text-[9.5px] text-slate-600">Chữ ký của cấp trên</div>
                  <div className="h-10 sm:h-12 flex items-end justify-center font-bold uppercase text-[10.5px] pb-0.5">
                    {leaveRequest.approver_level_1_name || (leaveRequest.status !== 'pending' ? 'HÙNG TRUNG' : '')}
                  </div>
                </div>

                <div>
                  <div className="font-bold italic">Signature of Head of Division</div>
                  <div className="italic text-[9.5px] text-slate-600">Chữ ký của Trưởng phòng</div>
                  <div className="h-10 sm:h-12 flex items-end justify-center font-bold uppercase text-[10.5px] pb-0.5">
                    {leaveRequest.approver_level_1_name || (leaveRequest.status !== 'pending' ? 'HÙNG TRUNG' : '')}
                  </div>
                </div>

                <div>
                  <div className="font-bold italic">Signature of Senior Manager, HR</div>
                  <div className="italic text-[9.5px] text-slate-600">Chữ ký Trưởng phòng nhân sự</div>
                  <div className="h-10 sm:h-12 flex items-end justify-center font-bold uppercase text-[10.5px] pb-0.5">
                    {leaveRequest.approver_final_name || (leaveRequest.status === 'approved_final' ? 'BOD / NHÂN SỰ' : '')}
                  </div>
                </div>
              </div>
            </div>

            {/* Document footer */}
            <div className="mt-2 text-[9.5px] text-slate-400 text-right font-sans">
              Hệ thống Tour CRM AD Luxury Travel · Trang 1/1
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
