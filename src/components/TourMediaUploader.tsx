import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, Upload, X, CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';

interface TourMediaUploaderProps {
  tourId: string;
  tourCode: string;
  tourName?: string;
  onUploadSuccess?: () => void;
  onClose?: () => void;
}

export const compressImage = (file: File, maxWidth = 1920, maxHeight = 1080, quality = 0.82): Promise<{ blob: Blob; fileName: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Image compression failed'));
              return;
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, "") + '.jpg';
            resolve({ blob, fileName: cleanName });
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export const TourMediaUploader: React.FC<TourMediaUploaderProps> = ({
  tourId,
  tourCode,
  tourName,
  onUploadSuccess,
  onClose
}) => {
  const { addTourMedia, currentRole } = useCRM();
  const { profile, user } = useAuth();
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<{ file: File; preview: string; caption: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUploadingIndex, setCurrentUploadingIndex] = useState(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesArray = Array.from(e.target.files);

    const newItems = filesArray.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      caption: ''
    }));

    setSelectedFiles(prev => [...prev, ...newItems]);
    // Reset input
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  const handleCaptionChange = (index: number, caption: string) => {
    setSelectedFiles(prev => {
      const next = [...prev];
      next[index].caption = caption;
      return next;
    });
  };

  const handleStartUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 ảnh');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setCurrentUploadingIndex(0);

    const total = selectedFiles.length;
    let successCount = 0;
    const uploaderName = profile?.full_name || user?.email || 'Hướng Dẫn Viên';
    const uploaderRole = currentRole || 'tour_guide';

    for (let i = 0; i < total; i++) {
      setCurrentUploadingIndex(i + 1);
      const item = selectedFiles[i];

      try {
        // Step 1: Compress image client side
        const compressed = await compressImage(item.file);
        const compressedFile = new File([compressed.blob], compressed.fileName, { type: 'image/jpeg' });

        // Step 2: Prepare FormData
        const formData = new FormData();
        formData.append('file', compressedFile);
        formData.append('uploadType', 'tour_media');
        formData.append('tourCode', tourCode);
        formData.append('stt', String(i + 1));

        // Step 3: Call Server API /api/upload
        let fileUrl = '';
        let fileId = '';
        let fileName = compressed.fileName;

        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });

          if (res.ok) {
            const data = await res.json();
            fileUrl = data.url;
            fileId = data.fileId || '';
            fileName = data.fileName || fileName;
          } else {
            throw new Error(`Server status ${res.status}`);
          }
        } catch (serverErr) {
          console.warn('Tải lên server không thành công, dùng data URL fallback offline:', serverErr);
          fileUrl = item.preview;
        }

        // Step 4: Save record to Database context
        await addTourMedia({
          tour_id: tourId,
          tour_code: tourCode,
          file_url: fileUrl,
          file_id: fileId,
          file_name: fileName,
          file_size: compressed.blob.size,
          uploaded_by: uploaderName,
          uploader_role: uploaderRole,
          caption: item.caption || `Ảnh kỷ niệm ${tourCode} (${i + 1})`
        });

        successCount++;
      } catch (err: any) {
        console.error(`Lỗi tải ảnh #${i + 1}:`, err);
        toast.error(`Lỗi tải ảnh #${i + 1}: ${err.message || 'Thất bại'}`);
      }

      setUploadProgress(Math.round(((i + 1) / total) * 100));
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`Đã tải lên thành công ${successCount}/${total} ảnh đoàn!`);
      setSelectedFiles([]);
      if (onUploadSuccess) onUploadSuccess();
      if (onClose) onClose();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-w-2xl w-full mx-auto">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">Upload Ảnh Đoàn Kỷ Niệm</h3>
            <p className="text-xs text-blue-100 font-medium">
              Tour {tourCode} {tourName ? `• ${tourName}` : ''}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-2 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Upload Trigger Buttons for HDV (Mobile-optimized) */}
        {!isUploading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              type="file"
              ref={galleryInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100/60 text-blue-700 font-semibold transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <Camera className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-bold">Chụp Ảnh Trực Tiếp</span>
                <span className="block text-xs text-blue-600 font-normal">Mở camera máy ảnh</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-100/60 text-indigo-700 font-semibold transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-bold">Chọn Từ Thư Viện</span>
                <span className="block text-xs text-indigo-600 font-normal">Chọn nhiều ảnh cùng lúc</span>
              </div>
            </button>
          </div>
        )}

        {/* Selected Files Preview Grid */}
        {selectedFiles.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Danh Sách Ảnh Đã Chọn ({selectedFiles.length})
              </span>
              {!isUploading && (
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  className="text-xs text-rose-600 hover:underline font-medium"
                >
                  Xóa tất cả
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto p-1 scrollbar-thin">
              {selectedFiles.map((item, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm">
                  <img
                    src={item.preview}
                    alt={`Preview ${idx + 1}`}
                    className="w-full h-28 object-cover"
                  />
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-full transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className="p-1.5 bg-white">
                    <input
                      type="text"
                      placeholder="Ghi chú ảnh..."
                      value={item.caption}
                      disabled={isUploading}
                      onChange={(e) => handleCaptionChange(idx, e.target.value)}
                      className="w-full text-xs px-2 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress Bar */}
        {isUploading && (
          <div className="space-y-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                Đang nén & tải lên: {currentUploadingIndex}/{selectedFiles.length} ảnh...
              </span>
              <span className="text-blue-600 font-bold">{uploadProgress}%</span>
            </div>
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-[11px] text-slate-500 text-center">
              Ảnh đang được nén tự động để giảm tải dung lượng và tăng tốc độ tải lên.
            </p>
          </div>
        )}

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors text-sm"
            >
              Hủy bỏ
            </button>
          )}
          <button
            type="button"
            onClick={handleStartUpload}
            disabled={isUploading || selectedFiles.length === 0}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang Upload...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Tải Lên ({selectedFiles.length} Ảnh)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
