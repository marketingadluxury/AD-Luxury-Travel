import React, { useState } from 'react';
import { Camera, Share2, Folder, ExternalLink, Search, Calendar, User, UploadCloud, Trash2, ShieldCheck, Image as ImageIcon, Sparkles, FolderOpen, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useCRM } from '../context/CRMContext';
import { HDVQuickUploadModal } from '../components/HDVQuickUploadModal';
import { HDVQuickLinkModal } from '../components/HDVQuickLinkModal';

export default function TourMediaManagement() {
  const { tours, tourMedia, deleteTourMedia, currentRole } = useCRM();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTourId, setSelectedTourId] = useState<string>('all');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [uploadModalTourId, setUploadModalTourId] = useState<string | undefined>(undefined);
  const [loadingFolderCode, setLoadingFolderCode] = useState<string | null>(null);

  const canManageMedia = ['admin', 'operator', 'tour_guide'].includes(currentRole);

  // Hide from CTV
  if (currentRole === 'CTV') {
    return (
      <div className="bg-white p-12 text-center rounded-2xl border border-gray-200 space-y-3">
        <ShieldCheck className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-gray-900">Không có quyền truy cập</h2>
        <p className="text-xs text-gray-500">Tài khoản Cộng Tác Viên (CTV) không có quyền truy cập mục Kho Ảnh Khách Đoàn.</p>
      </div>
    );
  }

  // Filter valid tours (Exclude visa services)
  const validTours = tours.filter(t => t.tour_type !== 'visa');

  // Filtered tours based on search
  const filteredTours = validTours.filter(t => {
    const matchesSearch =
      (t.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.guide_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedTourId === 'all') return matchesSearch;
    return t.id === selectedTourId && matchesSearch;
  });

  const handleOpenDriveFolder = async (tourCode: string) => {
    setLoadingFolderCode(tourCode);
    const toastId = toast.loading(`Đang kết nối thư mục Drive cho tour ${tourCode}...`);

    try {
      const response = await fetch('/api/get-tour-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourCode, subFolder: 'Ảnh đoàn' }),
      });

      const data = await response.json();
      toast.dismiss(toastId);

      if (data.success && data.folderUrl) {
        toast.success(`Đã mở thư mục Ảnh đoàn của Tour ${tourCode}`);
        window.open(data.folderUrl, '_blank');
      } else {
        // Fallback: search on drive or inform user
        const fallbackSearchUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(tourCode)}`;
        toast.success(`Đang mở Google Drive tìm kiếm cho tour ${tourCode}...`);
        window.open(fallbackSearchUrl, '_blank');
      }
    } catch (err) {
      toast.dismiss(toastId);
      console.error('Lỗi kết nối thư mục Drive:', err);
      window.open(`https://drive.google.com/drive/search?q=${encodeURIComponent(tourCode)}`, '_blank');
    } finally {
      setLoadingFolderCode(null);
    }
  };

  const handleDeleteMedia = async (id: string, fileUrl: string, fileName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa file "${fileName}" khỏi danh sách?`)) return;

    try {
      // Attempt backend delete if URL exists
      if (fileUrl) {
        await fetch('/api/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: fileUrl }),
        });
      }

      await deleteTourMedia(id);
      toast.success('Đã xóa thành công!');
    } catch (err) {
      console.error('Lỗi xóa media:', err);
      toast.error('Có lỗi xảy ra khi xóa file!');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 rounded-2xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold mb-1">
              <Camera className="w-3.5 h-3.5 text-amber-300" />
              <span>Dành Cho Tất Cả Thành Viên Công Ty & HDV</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Kho Ảnh Khách Đoàn (Google Drive)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Truy cập trực tiếp thư mục Google Drive lưu trữ toàn bộ hình ảnh kỷ niệm chuyến đi của từng đoàn tour. HDV Freelance có thể dùng Link & QR Code để tải ảnh nhanh từ điện thoại.
            </p>
          </div>

          {canManageMedia && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={() => {
                  setUploadModalTourId(undefined);
                  setIsUploadModalOpen(true);
                }}
                className="flex-1 md:flex-none px-4 py-2.5 ml-px rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-extrabold text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>Upload Ảnh Đoàn</span>
              </button>

              <button
                type="button"
                onClick={() => setIsLinkModalOpen(true)}
                className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs backdrop-blur-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4 text-blue-300" />
                <span>Link HDV Freelance</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo Mã Tour, Tên Tour, HDV..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-gray-50"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="text-xs font-bold text-gray-600 whitespace-nowrap">Lọc theo Tour:</label>
          <select
            value={selectedTourId}
            onChange={(e) => setSelectedTourId(e.target.value)}
            className="w-full md:w-64 max-w-full overflow-hidden text-ellipsis px-3 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-800 bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">-- Tất cả các đoàn tour ({validTours.length}) --</option>
            {validTours.map(t => {
              const shortName = t.name.length > 28 ? `${t.name.slice(0, 28)}...` : t.name;
              return (
                <option key={t.id} value={t.id} title={`[${t.code}] ${t.name}`}>
                  [{t.code}] {shortName}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Tour List & Drive Folder Links */}
      <div className="space-y-4">
        {filteredTours.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-gray-200">
            <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-semibold">Không tìm thấy đoàn tour nào phù hợp.</p>
          </div>
        ) : (
          filteredTours.map((tour) => {
            return (
              <div
                key={tour.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Tour Card Header */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-gray-50 via-slate-50 to-white border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-3 py-1 rounded-lg bg-blue-600 text-white font-mono font-black text-xs tracking-wide shadow-xs">
                        {tour.code}
                      </span>
                      {tour.departure_time && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          Khởi hành: {format(new Date(tour.departure_time), 'dd/MM/yyyy')}
                        </span>
                      )}
                      {tour.guide_name && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                          <User className="w-3.5 h-3.5 text-amber-600" />
                          HDV: {tour.guide_name}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-base text-gray-900 mt-1">
                      {tour.name}
                    </h3>
                  </div>

                  {/* Actions Bar (Only for Operator, Admin, Tour Guide) */}
                  {canManageMedia && (
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Quick Upload for this Tour */}
                      <button
                        type="button"
                        onClick={() => {
                          setUploadModalTourId(tour.id);
                          setIsUploadModalOpen(true);
                        }}
                        className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Camera className="w-4 h-4 text-teal-600" />
                        <span>Upload Ảnh</span>
                      </button>

                      {/* Quick Link Freelance for this Tour */}
                      <button
                        type="button"
                        onClick={() => setIsLinkModalOpen(true)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                        title="Lấy link & QR code cho HDV Freelance"
                      >
                        <Share2 className="w-3.5 h-3.5 text-slate-600" />
                        <span>Link HDV</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Folder Info Banner */}
                <div className="p-4 sm:p-5 bg-blue-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 text-slate-700">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <FolderOpen className="w-5 h-5 text-amber-300" />
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-900 text-xs">Vị trí lưu trữ: AD Luxury Travel &gt; Tour &gt; {tour.code} &gt; Ảnh đoàn</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">Tất cả hình ảnh &amp; video kỷ niệm chuyến đi của đoàn được tải lên và lưu trực tiếp trên Google Drive của công ty.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenDriveFolder(tour.code)}
                    disabled={loadingFolderCode === tour.code}
                    className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-extrabold text-xs shadow-xs flex items-center justify-center gap-2 shrink-0 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loadingFolderCode === tour.code ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Folder className="w-4 h-4 text-amber-300" />
                    )}
                    <span>Mở Thư Mục Google Drive</span>
                    <ExternalLink className="w-3.5 h-3.5 text-blue-200" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Upload Modal */}
      {canManageMedia && (
        <HDVQuickUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          defaultTourId={uploadModalTourId}
        />
      )}

      {/* Link Freelance Modal */}
      {canManageMedia && (
        <HDVQuickLinkModal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          tours={validTours}
        />
      )}
    </div>
  );
}
