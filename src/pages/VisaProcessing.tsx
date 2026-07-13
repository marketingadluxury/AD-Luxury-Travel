import { useState, useEffect } from 'react';
import { useCRM } from '@/context/CRMContext';
import { Passenger } from '@/types';
import { FileText, Download, Check, X, Clock, HelpCircle, AlertCircle, RefreshCw, ExternalLink, Search } from 'lucide-react';
import { format } from 'date-fns';

interface DisqualifiedReasonInputProps {
  passengerId: string;
  initialReason: string;
  onSave: (passengerId: string, status: 'disqualified', reason: string) => void;
}

function DisqualifiedReasonInput({ passengerId, initialReason, onSave }: DisqualifiedReasonInputProps) {
  const [val, setVal] = useState(initialReason);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setVal(initialReason);
  }, [initialReason]);

  const handleSave = () => {
    onSave(passengerId, 'disqualified', val);
    setShowSuccess(true);
    const timer = setTimeout(() => {
      setShowSuccess(false);
    }, 3000);
    return () => clearTimeout(timer);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col">
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">
          NỘI DUNG GIẢI TRÌNH (PHẢI)
        </label>
        <textarea
          rows={3}
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="Nhập nội dung giải trình chi tiết về lý do hồ sơ của khách hàng chưa đạt yêu cầu..."
          className="w-full px-3 py-2 text-xs border-2 border-gray-900 rounded-lg bg-white focus:outline-none focus:border-gray-950 font-medium text-gray-800 shadow-sm resize-y leading-relaxed"
        />
      </div>
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="min-h-[20px] flex items-center">
          {showSuccess && (
            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 animate-pulse">
              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
              Đã lưu lý do thành công!
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm hover:shadow active:scale-95 transition-all shrink-0 cursor-pointer"
        >
          Lưu
        </button>
      </div>
    </div>
  );
}

export default function VisaProcessing() {
  const { passengers, orders, tours, updateVisaStatus } = useCRM();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [disqualifiedReasonModal, setDisqualifiedReasonModal] = useState<{ name: string; reason: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTimeRange, setFilterTimeRange] = useState('all');
  const [sortBy, setSortBy] = useState('newest_created');

  // Filter passengers who have uploaded documents (passport or labor contract)
  const visaPassengers = passengers
    .filter(p => {
      const hasDocs = p.passport_url || p.labor_contract_url;
      if (!hasDocs) return false;
      
      // 1. Status Filter
      if (filterStatus !== 'all' && p.visa_status !== filterStatus) return false;

      // 2. Search Term Filter
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim();
        const order = orders.find(o => o.id === p.order_id);
        const tour = tours.find(t => t.id === order?.tour_id);

        const nameMatch = p.full_name && p.full_name.toLowerCase().includes(q);
        const passportMatch = p.passport_number && p.passport_number.toLowerCase().includes(q);
        const phoneMatch = p.phone && p.phone.includes(q);
        const orderMatch = p.order_id && p.order_id.toLowerCase().includes(q);
        const tourCodeMatch = tour && tour.code && tour.code.toLowerCase().includes(q);
        const tourNameMatch = tour && tour.name && tour.name.toLowerCase().includes(q);
        const countryMatch = tour && tour.visa_country && tour.visa_country.toLowerCase().includes(q);

        if (!nameMatch && !passportMatch && !phoneMatch && !orderMatch && !tourCodeMatch && !tourNameMatch && !countryMatch) {
          return false;
        }
      }

      // 3. Time Range Filter (based on visa_submitted_at or created_at)
      if (filterTimeRange !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateToCheckStr = p.visa_submitted_at || p.created_at;
        if (!dateToCheckStr) return false;
        
        const dateToCheck = new Date(dateToCheckStr);
        dateToCheck.setHours(0, 0, 0, 0);

        if (filterTimeRange === 'today') {
          return dateToCheck.getTime() === today.getTime();
        } else if (filterTimeRange === 'this_week') {
          const firstDay = new Date(today);
          firstDay.setDate(today.getDate() - today.getDay() + 1);
          const lastDay = new Date(firstDay);
          lastDay.setDate(firstDay.getDate() + 6);
          return dateToCheck >= firstDay && dateToCheck <= lastDay;
        } else if (filterTimeRange === 'this_month') {
          return dateToCheck.getMonth() === today.getMonth() && dateToCheck.getFullYear() === today.getFullYear();
        }
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest_created') {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      } else if (sortBy === 'oldest_created') {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateA - dateB;
      } else if (sortBy === 'newest_submitted') {
        const dateA = a.visa_submitted_at ? new Date(a.visa_submitted_at).getTime() : 0;
        const dateB = b.visa_submitted_at ? new Date(b.visa_submitted_at).getTime() : 0;
        return dateB - dateA;
      } else if (sortBy === 'deadline_asc') {
        const orderA = orders.find(o => o.id === a.order_id);
        const tourA = tours.find(t => t.id === orderA?.tour_id);
        const orderB = orders.find(o => o.id === b.order_id);
        const tourB = tours.find(t => t.id === orderB?.tour_id);

        const dlA = tourA?.visa_deadline ? new Date(tourA.visa_deadline).getTime() : Infinity;
        const dlB = tourB?.visa_deadline ? new Date(tourB.visa_deadline).getTime() : Infinity;
        return dlA - dlB;
      }
      return 0;
    });

  const getStatusBadge = (status: Passenger['visa_status'], reason?: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Chờ tiếp nhận</span>;
      case 'processing':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Đang xử lý hồ sơ</span>;
      case 'approved':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Đã duyệt Visa</span>;
      case 'rejected':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Bị từ chối</span>;
      case 'disqualified':
        return (
          <button
            type="button"
            onClick={() => {
              setDisqualifiedReasonModal({
                name: 'Hành khách',
                reason: reason || 'Chưa cập nhật lý do chi tiết.'
              });
            }}
            title="Bấm để xem lý do hồ sơ chưa đạt"
            className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200 transition-colors cursor-pointer inline-flex items-center gap-1"
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            Hồ sơ chưa đạt
          </button>
        );
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Không yêu cầu</span>;
    }
  };

  const handleDownloadSimulatedFile = (fileName: string) => {
    if (fileName.startsWith('http://') || fileName.startsWith('https://')) {
      window.open(fileName, '_blank');
    } else {
      alert(`Đang tải xuống tài liệu giả lập: ${fileName}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header card */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Xử lý & Cấp duyệt Visa</h2>
        <p className="text-sm text-gray-500 mt-1">
          Xem thông tin giấy tờ, hồ sơ làm visa do sale upload lên và cập nhật trạng thái làm visa cho từng hành khách.
        </p>
      </div>

      {/* Filter and Overview tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden space-y-0">
        {/* Hàng 1: Bộ lọc trạng thái */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-b border-gray-100 bg-white">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Trạng thái Visa:</span>
            <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
              {['all', 'pending', 'processing', 'approved', 'rejected', 'disqualified'].map(status => {
                const label = status === 'all' ? 'Tất cả' :
                              status === 'pending' ? 'Chờ duyệt' :
                              status === 'processing' ? 'Đang làm' :
                              status === 'approved' ? 'Đã có Visa' : 
                              status === 'disqualified' ? 'Chưa đạt' : 'Từ chối';
                return (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      filterStatus === status ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-gray-500 font-medium shrink-0">
            Hiển thị <span className="font-semibold text-gray-900">{visaPassengers.length}</span> hồ sơ khách hàng.
          </div>
        </div>

        {/* Hàng 2: Tìm kiếm, lọc thời gian và sắp xếp */}
        <div className="p-4 bg-slate-50 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </span>
            <input
              type="text"
              placeholder="Tìm tên khách, hộ chiếu, tour..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Lọc thời gian nộp */}
          <select
            value={filterTimeRange}
            onChange={e => setFilterTimeRange(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Mọi thời gian nộp/tạo</option>
            <option value="today">Nộp/Tạo hôm nay</option>
            <option value="this_week">Nộp/Tạo tuần này</option>
            <option value="this_month">Nộp/Tạo tháng này</option>
          </select>

          {/* Sắp xếp */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 font-semibold"
          >
            <option value="newest_created">Sắp xếp: Khách mới nhất</option>
            <option value="oldest_created">Sắp xếp: Khách cũ nhất</option>
            <option value="newest_submitted">Sắp xếp: Ngày nộp mới nhất</option>
            <option value="deadline_asc">Sắp xếp: Hạn nộp Visa gần nhất</option>
          </select>
        </div>
      </div>

      {/* Passengers list for Visa review */}
      <div className="grid grid-cols-1 gap-6">
        {visaPassengers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center shadow-sm">
            <FileText className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">Không tìm thấy hồ sơ visa nào cần xử lý.</p>
          </div>
        ) : (
          visaPassengers.map(passenger => {
            const order = orders.find(o => o.id === passenger.order_id);
            const tour = tours.find(t => t.id === order?.tour_id);

            return (
              <div key={passenger.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  {/* Left block: Passenger info & Tour */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-gray-900">{passenger.full_name}</h3>
                      {passenger.is_payer && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700 uppercase">Trưởng đoàn</span>
                      )}
                      {getStatusBadge(passenger.visa_status, passenger.visa_disqualified_reason)}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-gray-600">
                      <div>
                        <span className="text-gray-400">Mã đơn:</span> <span className="font-semibold text-gray-800">#{passenger.order_id.substring(0, 8)}</span>
                      </div>
                      <div>
                        {tour?.tour_type === 'visa' ? (
                          <>
                            <span className="text-gray-400">Dịch vụ:</span>{' '}
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100">
                              🛂 Visa lẻ {tour.visa_country}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-400">Tour đặt:</span>{' '}
                            <span className="font-semibold text-blue-600">{tour?.code}</span>
                          </>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-400">Ngày sinh:</span>{' '}
                        <span className="font-medium text-gray-800">
                          {passenger.dob ? format(new Date(passenger.dob), 'dd/MM/yyyy') : 'Chưa nhập'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Phân loại/Cấp độ:</span>{' '}
                        <span className="font-semibold text-gray-800">
                          {tour?.tour_type === 'visa' ? (
                            <span className="text-xs">
                              {tour.visa_service_type} ({tour.visa_speed === 'urgent' ? '⚡ Khẩn' : '⏳ Thường'})
                            </span>
                          ) : (
                            'Visa đi Tour'
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Thời gian nộp:</span>{' '}
                        <span className="font-semibold text-emerald-600">
                          {passenger.visa_submitted_at ? format(new Date(passenger.visa_submitted_at), 'dd/MM/yyyy HH:mm') : 'Chưa cập nhật'}
                        </span>
                      </div>
                      {tour?.visa_deadline && (
                        <div className="text-red-600 font-medium">
                          <span>Hạn nộp Visa:</span> {format(new Date(tour.visa_deadline), 'dd/MM/yyyy')}
                        </div>
                      )}
                    </div>
                  </div>

                   {/* Middle block: Documents list */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2 w-full md:w-auto md:min-w-[280px]">
                    <span className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Giấy tờ Sale đã upload</span>
                    
                    {passenger.passport_url ? (
                      <div className="space-y-1.5">
                        {passenger.passport_url.split(',').filter(Boolean).map((url, uIdx) => {
                          const isSupabaseFolder = url.includes('supabase.com/dashboard/project') || url.includes('supabase.co');
                          const isGoogleDriveFolder = url.includes('drive.google.com');
                          
                          let displayFileName = '';
                          let linkClass = "text-blue-600 hover:text-blue-800 flex items-center shrink-0 cursor-pointer bg-blue-50/50 p-1.5 rounded";
                          let itemClass = "flex items-center justify-between text-sm bg-white px-3 py-1.5 rounded border border-gray-100 gap-3";
                          
                          if (isGoogleDriveFolder) {
                            displayFileName = 'Tài liệu';
                            itemClass = "flex items-center justify-between text-sm bg-emerald-50/70 px-3 py-1.5 rounded border border-emerald-100 gap-3";
                            linkClass = "text-emerald-700 hover:text-emerald-900 flex items-center shrink-0 cursor-pointer bg-emerald-100/50 p-1.5 rounded transition-colors";
                          } else if (isSupabaseFolder) {
                            displayFileName = 'Thư mục hồ sơ (Hệ thống)';
                            itemClass = "flex items-center justify-between text-sm bg-blue-50/70 px-3 py-1.5 rounded border border-blue-100 gap-3";
                            linkClass = "text-blue-700 hover:text-blue-900 flex items-center shrink-0 cursor-pointer bg-blue-100/50 p-1.5 rounded transition-colors";
                          } else {
                            const fileName = url.substring(url.lastIndexOf('/') + 1);
                            const decodedFileName = decodeURIComponent(fileName);
                            displayFileName = decodedFileName.includes('-') ? decodedFileName.split('-').slice(2).join('-') : decodedFileName;
                          }
                          return (
                            <div key={uIdx} className={itemClass}>
                              <span className="text-gray-700 truncate font-semibold max-w-[200px]" title={displayFileName}>
                                {displayFileName}
                              </span>
                              <a 
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={linkClass}
                                title={isGoogleDriveFolder ? 'Mở thư mục tài liệu' : isSupabaseFolder ? 'Mở thư mục' : 'Xem tài liệu'}
                              >
                                {isGoogleDriveFolder || isSupabaseFolder ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic">Không có file Hộ chiếu</div>
                    )}

                    {passenger.labor_contract_url ? (
                      <div className="flex items-center justify-between text-sm bg-white px-3 py-1.5 rounded border border-gray-100">
                        <span className="text-gray-700 truncate font-medium max-w-[150px]">{passenger.labor_contract_url}</span>
                        <button 
                          onClick={() => handleDownloadSimulatedFile(passenger.labor_contract_url!)}
                          className="text-blue-600 hover:text-blue-800 flex items-center"
                        >
                          <Download className="w-4 h-4 ml-2" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic">Không có file Hợp đồng lao động</div>
                    )}
                  </div>

                  {/* Right block: Actions to update state */}
                  <div className="flex flex-col gap-2 w-full md:w-auto md:min-w-[180px]">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Cập nhật trạng thái</span>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-gray-700"
                      value={passenger.visa_status}
                      onChange={e => {
                        const newStatus = e.target.value as Passenger['visa_status'];
                        if (newStatus === 'disqualified') {
                          updateVisaStatus(passenger.id, newStatus, passenger.visa_disqualified_reason || '');
                        } else {
                          updateVisaStatus(passenger.id, newStatus);
                        }
                      }}
                    >
                      <option value="pending">Chờ tiếp nhận</option>
                      <option value="processing">Đang nộp hồ sơ</option>
                      <option value="approved">Đã duyệt (Có Visa)</option>
                      <option value="rejected">Bị từ chối</option>
                      <option value="disqualified">Hồ sơ chưa đạt</option>
                    </select>

                    {passenger.visa_status === 'disqualified' && (
                      <div className="mt-2.5 p-3.5 bg-rose-50/40 border border-rose-100 rounded-lg">
                        <DisqualifiedReasonInput 
                          passengerId={passenger.id} 
                          initialReason={passenger.visa_disqualified_reason || ''} 
                          onSave={updateVisaStatus} 
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Disqualified Reason Modal */}
      {disqualifiedReasonModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="disqualified_reason_modal">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-rose-100 transform transition-all duration-300 scale-100">
            <div className="bg-rose-50 px-6 py-4 flex items-center justify-between border-b border-rose-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-black text-rose-950 uppercase tracking-wide">Chi tiết hồ sơ chưa đạt</h3>
              </div>
              <button
                type="button"
                onClick={() => setDisqualifiedReasonModal(null)}
                className="text-rose-400 hover:text-rose-600 transition-colors text-lg font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Khách hàng</span>
                <span className="text-sm font-extrabold text-gray-950 uppercase mt-0.5 block">{disqualifiedReasonModal.name}</span>
              </div>
              <div className="p-4 bg-rose-50/50 rounded-lg border border-rose-100">
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block mb-1">Lý do cụ thể</span>
                <p className="text-xs font-semibold text-rose-950 whitespace-pre-wrap leading-relaxed">{disqualifiedReasonModal.reason}</p>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end">
              <button
                type="button"
                onClick={() => setDisqualifiedReasonModal(null)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all text-white font-extrabold text-xs rounded-lg uppercase shadow-md shadow-rose-600/10 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
