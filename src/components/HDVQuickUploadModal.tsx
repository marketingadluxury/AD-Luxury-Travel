import React, { useState, useEffect } from 'react';
import { Camera, UploadCloud, X, Check, Image as ImageIcon, Sparkles, FolderCheck, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Tour } from '../types';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';

interface HDVQuickUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTourId?: string;
}

export const HDVQuickUploadModal: React.FC<HDVQuickUploadModalProps> = ({
  isOpen,
  onClose,
  defaultTourId
}) => {
  const { tours, addTourMedia, currentRole } = useCRM();
  const { user } = useAuth();

  // Filter valid tours (exclude visa)
  const availableTours = tours.filter(t => t.tour_type !== 'visa');
  const [selectedTourId, setSelectedTourId] = useState<string>(
    defaultTourId || (availableTours.length > 0 ? availableTours[0].id : '')
  );
  const [caption, setCaption] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  useEffect(() => {
    if (defaultTourId) {
      setSelectedTourId(defaultTourId);
    } else if (availableTours.length > 0) {
      setSelectedTourId(availableTours[0].id);
    }
  }, [defaultTourId, isOpen]);

  if (!isOpen) return null;

  const currentTour = availableTours.find(t => t.id === selectedTourId) || availableTours[0];

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
    const uploaderName = user?.email || (currentRole === 'tour_guide' ? 'Hướng Dẫn Viên' : 'Điều Hành Tour');

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

        // Upload to server endpoint
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
            uploaded_by: uploaderName,
            uploader_role: currentRole,
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
      toast.success(`Tải lên thành công ${successCount}/${selectedFiles.length} ảnh đoàn!`);
      setSelectedFiles([]);
      setCaption('');
      onClose();
    } else {
      toast.error('Tải ảnh thất bại. Vui lòng kiểm tra lại kết nối!');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-900/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-blue-600 p-4 sm:p-5 text-white flex items-center justify-between relative overflow-hidden">
            <div className="flex items-center gap-3 z-10">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-inner">
                <Camera className="w-6 h-6 animate-pulse text-amber-300" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg leading-snug">Upload Ảnh Đoàn Nhanh</h3>
                <p className="text-xs text-teal-100">Dành riêng cho Hướng Dẫn Viên (HDV) & Điều Hành Tour</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Tour selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Tour Cần Tải Ảnh: <span className="text-red-500">*</span>
              </label>
              {defaultTourId && currentTour ? (
                <div className="p-3 bg-teal-50 border border-teal-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-teal-700 text-white font-mono font-black text-xs tracking-wide shadow-xs shrink-0">
                      {currentTour.code}
                    </span>
                    <span className="font-bold text-xs text-teal-950">{currentTour.name}</span>
                  </div>
                  {currentTour.guide_name && (
                    <span className="text-[11px] font-bold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-md self-start sm:self-auto shrink-0">
                      HDV: {currentTour.guide_name}
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <select
                    value={selectedTourId}
                    onChange={(e) => setSelectedTourId(e.target.value)}
                    className="w-full max-w-full overflow-hidden text-ellipsis px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs sm:text-sm font-semibold text-gray-800 bg-white focus:ring-2 focus:ring-teal-500 shadow-xs"
                  >
                    {availableTours.length === 0 ? (
                      <option value="">(Chưa có danh sách Tour nào)</option>
                    ) : (
                      availableTours.map(t => {
                        const shortName = t.name.length > 28 ? `${t.name.slice(0, 28)}...` : t.name;
                        return (
                          <option key={t.id} value={t.id} title={`[${t.code}] ${t.name}`}>
                            [{t.code}] {shortName}
                          </option>
                        );
                      })
                    )}
                  </select>
                  {currentTour && (
                    <div className="mt-1.5 px-3 py-1.5 bg-teal-50 border border-teal-200/80 rounded-lg text-xs text-teal-800 flex items-center justify-between">
                      <span className="font-bold">Mã tour: {currentTour.code}</span>
                      <span className="text-[11px] text-teal-600">HDV: {currentTour.guide_name || 'Chưa gán'}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Quick Camera & File Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Chụp Ảnh Hoặc Chọn Từ Máy: <span className="text-red-500">*</span>
              </label>

              <label className="flex flex-col items-center justify-center p-5 bg-teal-50/80 hover:bg-teal-100 border-2 border-dashed border-teal-400 rounded-2xl cursor-pointer transition-all active:scale-98 text-center group">
                <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center mb-2 shadow-md group-hover:scale-105 transition-transform">
                  <Camera className="w-6 h-6 text-amber-300" />
                </div>
                <span className="text-xs font-extrabold text-teal-900">Chụp Ảnh Hoặc Chọn Từ Thư Viện</span>
                <span className="text-[11px] text-teal-600 mt-0.5">Nhấn vào đây để mở máy ảnh hoặc chọn nhiều ảnh cùng lúc</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Selected files preview */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                  <span>Đã chọn ({selectedFiles.length} ảnh):</span>
                  <button
                    onClick={() => setSelectedFiles([])}
                    className="text-red-600 hover:underline text-[11px]"
                  >
                    Xóa tất cả
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1.5 bg-gray-50 border border-gray-200 rounded-xl">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-200 border border-gray-300">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${idx}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 shadow-md opacity-80 hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optional caption */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Ghi Chú / Chú Thích Ảnh (Tùy chọn):
              </label>
              <input
                type="text"
                placeholder="VD: Đoàn check-in sân bay, bữa tối giao lưu..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Progress indicator */}
            {isUploading && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-teal-800">
                  <span>Đang tải ảnh lên hệ thống...</span>
                  <span>{uploadProgress.current} / {uploadProgress.total}</span>
                </div>
                <div className="w-full bg-teal-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer controls */}
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || selectedFiles.length === 0}
              className="px-5 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
            >
              <UploadCloud className="w-4 h-4" />
              <span>{isUploading ? 'Đang Tải Lên...' : `Tải Lên ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
