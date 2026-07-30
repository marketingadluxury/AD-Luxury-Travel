import React, { useState, useEffect } from 'react';
import { Camera, UploadCloud, X, Check, Image as ImageIcon, Sparkles, FolderCheck, AlertCircle, ArrowLeft, RefreshCw, ZoomIn, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useCRM } from '../context/CRMContext';
import { TourMedia, Tour } from '../types';
import { format } from 'date-fns';

interface GuestPhotoUploadPageProps {
  defaultTourId?: string;
}

export const GuestPhotoUploadPage: React.FC<GuestPhotoUploadPageProps> = ({ defaultTourId }) => {
  const { tours, addTourMedia, tourMedia, fetchTourMedia } = useCRM();

  // Filter valid tours
  const availableTours = tours.filter(t => t.tour_type !== 'visa');

  const [selectedTourId, setSelectedTourId] = useState<string>(defaultTourId || '');
  const [caption, setCaption] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Synchronize tour ID
  useEffect(() => {
    if (defaultTourId) {
      const match = availableTours.find(t => t.id === defaultTourId || t.code === defaultTourId);
      if (match) {
        setSelectedTourId(match.id);
      } else {
        setSelectedTourId(defaultTourId);
      }
    } else if (availableTours.length > 0 && !selectedTourId) {
      setSelectedTourId(availableTours[0].id);
    }
  }, [defaultTourId, availableTours]);

  const currentTour = availableTours.find(t => t.id === selectedTourId || t.code === selectedTourId) || availableTours[0];

  // Fetch photos for current tour
  useEffect(() => {
    if (currentTour?.id) {
      fetchTourMedia(currentTour.id);
    }
  }, [currentTour?.id]);

  const currentTourPhotos = tourMedia.filter(m => m.tour_id === currentTour?.id || m.tour_code === currentTour?.code);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!currentTour) {
      toast.error('Vui lòng chọn Tour để tải ảnh lên');
      return;
    }
    if (selectedFiles.length === 0) {
      toast.error('Vui lòng chọn hoặc chụp ít nhất 1 hình ảnh');
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: selectedFiles.length });

    let successCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadProgress({ current: i + 1, total: selectedFiles.length });

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploadType', 'tour_media');
        formData.append('tourCode', currentTour.code);
        formData.append('category', 'tour_media');
        formData.append('stt', String(i + 1));

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (response.ok && data.url) {
          await addTourMedia({
            tour_id: currentTour.id,
            tour_code: currentTour.code,
            file_url: data.url,
            file_id: data.fileId || '',
            file_name: file.name,
            file_size: file.size,
            uploaded_by: 'HDV Freelance',
            uploader_role: 'tour_guide',
            caption: caption.trim() || undefined
          });
          successCount++;
        } else {
          console.error('Lỗi upload file:', data.error);
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`Đã tải lên thành công ${successCount}/${selectedFiles.length} ảnh đoàn!`);
      setSelectedFiles([]);
      setCaption('');
      fetchTourMedia(currentTour.id);
    } else {
      toast.error('Không thể tải lên ảnh. Vui lòng thử lại!');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-12">
      {/* Top Header */}
      <header className="bg-gradient-to-r from-teal-700 via-emerald-700 to-teal-800 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <Camera className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h1 className="font-black text-sm sm:text-base tracking-tight leading-snug">
                UPLOAD ÁNH ĐOÀN NHANH
              </h1>
              <p className="text-[11px] text-teal-100 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                AD Luxury Travel • Dành cho HDV Freelance
              </p>
            </div>
          </div>
          <a
            href="/"
            className="text-xs text-white/80 hover:text-white font-bold underline px-2.5 py-1 rounded-lg bg-white/10"
          >
            Đăng nhập
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Info Banner */}
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 shadow-xs">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-950 leading-relaxed">
            <strong className="font-extrabold">Trải nghiệm tự động cho HDV:</strong> Bạn đang ở giao diện upload trực tiếp ảnh kỷ niệm đoàn. Ảnh tải lên sẽ tự động đồng bộ vào album Drive của công ty.
          </div>
        </div>

        {/* Upload Card - Same UI style as Modal */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-4 sm:p-5 text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <UploadCloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-black text-base">Upload Ảnh Đoàn</h2>
              <p className="text-xs text-teal-100">Chọn hoặc chụp ảnh kỷ niệm đoàn từ điện thoại</p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Tour Badge or Tour Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Tour Cần Tải Ảnh: <span className="text-red-500">*</span>
              </label>

              {defaultTourId && currentTour ? (
                <div className="p-3.5 bg-teal-50 border border-teal-300/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2.5 py-1 rounded-xl bg-teal-700 text-white font-mono font-black text-xs tracking-wide shadow-xs shrink-0">
                      {currentTour.code}
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-teal-950 line-clamp-2">{currentTour.name}</span>
                  </div>
                  {currentTour.guide_name && (
                    <span className="text-[11px] font-extrabold text-teal-800 bg-teal-100 px-2.5 py-1 rounded-lg self-start sm:self-auto shrink-0">
                      HDV: {currentTour.guide_name}
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedTourId}
                    onChange={(e) => setSelectedTourId(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-teal-500 shadow-xs"
                  >
                    {availableTours.length === 0 ? (
                      <option value="">(Chưa có danh sách Tour nào)</option>
                    ) : (
                      availableTours.map(t => (
                        <option key={t.id} value={t.id}>
                          [{t.code}] {t.name}
                        </option>
                      ))
                    )}
                  </select>
                  {currentTour && (
                    <div className="px-3.5 py-2 bg-teal-50 border border-teal-200/80 rounded-xl text-xs text-teal-800 flex items-center justify-between font-bold">
                      <span>Mã tour: {currentTour.code}</span>
                      <span className="text-teal-600 font-medium">HDV: {currentTour.guide_name || 'Chưa gán'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dotted Capture / Select Zone */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Chụp Ảnh Hoặc Chọn Từ Máy: <span className="text-red-500">*</span>
              </label>

              <label className="relative flex flex-col items-center justify-center p-6 sm:p-8 border-2 border-dashed border-teal-400/80 hover:border-teal-600 bg-teal-50/40 hover:bg-teal-50 rounded-2xl cursor-pointer transition-all group">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-full bg-teal-500 group-hover:scale-105 text-white flex items-center justify-center shadow-lg transition-transform mb-3">
                  <Camera className="w-7 h-7" />
                </div>
                <p className="font-extrabold text-sm text-teal-950 text-center">
                  Chụp Ảnh Hoặc Chọn Từ Thư Viện
                </p>
                <p className="text-xs text-slate-500 text-center mt-1">
                  Nhấn vào đây để mở máy ảnh hoặc chọn nhiều ảnh cùng lúc
                </p>
              </label>
            </div>

            {/* Preview Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Đã chọn ({selectedFiles.length} ảnh):
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFiles([])}
                    className="text-xs text-red-600 hover:underline font-semibold"
                  >
                    Xóa tất cả
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${idx}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Caption Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Ghi Chú / Chú Thích Ảnh (Tùy chọn):
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="VD: Đoàn check-in sân bay, bữa tối giao lưu..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-teal-500 bg-white"
              />
            </div>

            {/* Uploading Progress Indicator */}
            {isUploading && (
              <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl space-y-2">
                <div className="flex justify-between text-xs font-bold text-teal-900">
                  <span>Đang tải lên máy chủ...</span>
                  <span>{uploadProgress.current}/{uploadProgress.total}</span>
                </div>
                <div className="w-full bg-teal-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-teal-600 h-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading || selectedFiles.length === 0}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Đang Tải Lên...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-5 h-5" />
                    <span>Tải Lên ({selectedFiles.length} Ảnh)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Existing Uploaded Photos Album for this Tour */}
        {currentTour && (
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-teal-600" />
                  Ảnh Đoàn Đã Tải Lên ({currentTourPhotos.length})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Mã tour: {currentTour.code}</p>
              </div>
              <button
                type="button"
                onClick={() => fetchTourMedia(currentTour.id)}
                className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                title="Làm mới"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {currentTourPhotos.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Chưa có ảnh nào được tải lên cho đoàn này.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {currentTourPhotos.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setPreviewImage(item.file_url)}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer shadow-2xs hover:shadow-md transition-all"
                  >
                    <img
                      src={item.file_url}
                      alt={item.file_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ZoomIn className="w-6 h-6 text-white" />
                    </div>
                    {item.caption && (
                      <div className="absolute bottom-0 inset-x-0 bg-black/70 p-1.5 text-[10px] text-white truncate font-medium">
                        {item.caption}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Fullscreen Image Preview Lightbox */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 text-white hover:text-red-400 p-2 rounded-full bg-white/10 backdrop-blur-md"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
