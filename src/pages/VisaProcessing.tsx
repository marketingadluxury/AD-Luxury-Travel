import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCRM } from '@/context/CRMContext';
import { Passenger } from '@/types';
import { FileText, Check, AlertCircle, Search, Copy, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { PassengerDocumentList } from '@/components/PassengerDocumentList';
import { TimeRangeFilter } from '@/components/TimeRangeFilter';
import { isDateInTimeRange } from '@/lib/dateUtils';

interface DisqualifiedReasonInputProps {
  passengerId: string;
  initialReason: string;
  onSave: (passengerId: string, status: 'disqualified', reason: string) => void;
}

function DisqualifiedReasonInput({ passengerId, initialReason, onSave }: DisqualifiedReasonInputProps) {
  const [val, setVal] = useState(initialReason);
  const [isEditing, setIsEditing] = useState(!initialReason || initialReason.trim() === '');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setVal(initialReason);
    if (!initialReason || initialReason.trim() === '') {
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
  }, [initialReason]);

  const handleSave = () => {
    if (!val.trim()) {
      toast.error('Vui lòng nhập nội dung giải trình!');
      return;
    }
    onSave(passengerId, 'disqualified', val.trim());
    setShowSuccess(true);
    setIsEditing(false);
    const timer = setTimeout(() => {
      setShowSuccess(false);
    }, 3000);
    return () => clearTimeout(timer);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block">
          NỘI DUNG GIẢI TRÌNH
        </label>
        {!isEditing && (
          <button
            type="button"
            onClick={handleEdit}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer border border-blue-200 shadow-2xs ml-[10px]"
            style={{ marginLeft: '10px' }}
            title="Chỉnh sửa nội dung giải trình"
          >
            <Pencil className="w-3 h-3 text-blue-600" />
            Sửa
          </button>
        )}
      </div>

      {!isEditing ? (
        <div className="bg-white border-2 border-rose-200 rounded-lg p-3 shadow-2xs relative group">
          <p className="text-xs font-semibold text-rose-950 whitespace-pre-wrap leading-relaxed break-words">
            {val || 'Chưa có nội dung giải trình.'}
          </p>
          {showSuccess && (
            <div className="mt-2 pt-2 border-t border-rose-100 flex items-center gap-1 text-[11px] text-emerald-600 font-bold">
              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
              Đã lưu nội dung giải trình thành công!
            </div>
          )}
        </div>
      ) : (
        <>
          <textarea
            rows={3}
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder="Nhập nội dung giải trình chi tiết về lý do hồ sơ của khách hàng chưa đạt yêu cầu..."
            className="w-full px-3 py-2 text-xs border-2 border-gray-900 rounded-lg bg-white focus:outline-none focus:border-gray-950 font-medium text-gray-800 shadow-2xs resize-y leading-relaxed"
          />
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="min-h-[20px] flex items-center">
              {showSuccess && (
                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 animate-pulse">
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                  Đã lưu thành công!
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {initialReason && initialReason.trim() !== '' && (
                <button
                  type="button"
                  onClick={() => {
                    setVal(initialReason);
                    setIsEditing(false);
                  }}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Hủy
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-2xs hover:shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                Lưu
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function VisaProcessing() {
  const location = useLocation();
  const { passengers, orders, tours, updateVisaStatus } = useCRM();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [disqualifiedReasonModal, setDisqualifiedReasonModal] = useState<{ name: string; reason: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTimeRange, setFilterTimeRange] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [sortBy, setSortBy] = useState('newest_created');

  // Xử lý click từ thông báo
  useEffect(() => {
    if (location.state?.searchTarget) {
      setSearchTerm(location.state.searchTarget);
      setFilterStatus('all');
      setFilterTimeRange('all');
      
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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
        const dateToCheckStr = p.visa_submitted_at || p.created_at;
        if (!isDateInTimeRange(dateToCheckStr, filterTimeRange, filterStartDate, filterEndDate)) {
          return false;
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm space-y-0 relative z-20">
        {/* Hàng 1: Bộ lọc trạng thái */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-b border-gray-100 bg-white rounded-t-xl">
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
        <div className="p-4 bg-slate-50 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-3 rounded-b-xl">
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
          <TimeRangeFilter
            value={filterTimeRange}
            onChange={setFilterTimeRange}
            startDate={filterStartDate}
            onChangeStartDate={setFilterStartDate}
            endDate={filterEndDate}
            onChangeEndDate={setFilterEndDate}
            prefixText="Nộp/Tạo"
            selectClassName="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 font-medium"
          />

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
                        <span className="text-gray-400">Mã đơn:</span>{' '}
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            const code = `#${passenger.order_id.substring(0, 8)}`;
                            navigator.clipboard.writeText(code);
                            toast.success(`Đã sao chép mã đơn hàng: ${code}`);
                          }}
                          className="font-semibold text-gray-800 hover:text-blue-600 cursor-pointer inline-flex items-center gap-1 group/copy"
                          title="Bấm để sao chép mã đơn hàng"
                        >
                          #{passenger.order_id.substring(0, 8)}
                          <Copy className="w-3.5 h-3.5 text-gray-400 group-hover/copy:text-blue-600 opacity-60 group-hover/copy:opacity-100 transition-opacity" />
                        </span>
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
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2 w-full md:w-auto md:min-w-[280px] md:max-w-[340px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Giấy tờ Sale đã upload</span>
                      {passenger.passport_url && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                          {passenger.passport_url.split(',').filter(Boolean).length} file
                        </span>
                      )}
                    </div>
                    
                    <PassengerDocumentList 
                      passportUrl={passenger.passport_url}
                      laborContractUrl={passenger.labor_contract_url}
                      maxInitialDisplay={3}
                      variant="card"
                    />
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
