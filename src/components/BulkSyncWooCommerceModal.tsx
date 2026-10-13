import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Globe,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  X,
  Check,
  Calendar,
  Layers,
  ArrowRight,
  Filter,
  ArrowUpDown,
  Plus,
  Play,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Link2,
  FileSpreadsheet,
  CheckSquare,
  Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Tour } from '../types';

export interface WordPressProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  price: string;
  regular_price: string;
  sku: string;
  status: string;
  stock_quantity: number | null;
  stock_status: string;
  departures_count: number;
  departures: string[];
}

export interface BulkTourSyncRow {
  tour: Tour;
  selected: boolean;
  matchType: 'linked' | 'auto_matched' | 'new';
  targetProductId: number | null;
  targetProductName: string;
  targetProductUrl: string;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  syncMessage?: string;
  syncedProductId?: number;
  syncedProductUrl?: string;
}

interface BulkSyncWooCommerceModalProps {
  isOpen: boolean;
  onClose: () => void;
  tours: Tour[];
  onSyncComplete?: () => void;
}

// Hàm chuẩn hóa chuỗi tiếng Việt để so sánh tìm kiếm
function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Tính độ tương đồng đơn giản giữa 2 tên tour
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.85;

  const words1 = new Set(norm1.split(' ').filter(w => w.length > 1));
  const words2 = new Set(norm2.split(' ').filter(w => w.length > 1));
  if (words1.size === 0 || words2.size === 0) return 0;

  let common = 0;
  words1.forEach(w => {
    if (words2.has(w)) common++;
  });

  return (2 * common) / (words1.size + words2.size);
}

export const BulkSyncWooCommerceModal: React.FC<BulkSyncWooCommerceModalProps> = ({
  isOpen,
  onClose,
  tours,
  onSyncComplete
}) => {
  const [products, setProducts] = useState<WordPressProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isConfigChecked, setIsConfigChecked] = useState(false);
  const [siteUrl, setSiteUrl] = useState('');

  // Danh sách dòng tour đang xử lý trong modal
  const [syncRows, setSyncRows] = useState<BulkTourSyncRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'matched' | 'new'>('all');

  // Popup đổi sản phẩm liên kết cho từng tour
  const [editingTourId, setEditingTourId] = useState<string | null>(null);
  const [productSearchInModal, setProductSearchInModal] = useState('');

  // Tiến trình đồng bộ
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, successCount: 0, errorCount: 0 });
  const [currentSyncingName, setCurrentSyncingName] = useState('');
  const [viewStep, setViewStep] = useState<'selection' | 'progress'>('selection');

  // Tùy chọn nâng cao
  const [showOptions, setShowOptions] = useState(false);
  const [updatePrices, setUpdatePrices] = useState(true);
  const [updateDepartures, setUpdateDepartures] = useState(true);

  // 1. Tải cấu hình và sản phẩm từ website WooCommerce khi mở Modal
  useEffect(() => {
    if (!isOpen) {
      setViewStep('selection');
      setIsSyncing(false);
      setEditingTourId(null);
      return;
    }

    const initData = async () => {
      try {
        setIsLoadingProducts(true);
        // Kiểm tra cấu hình kết nối
        const configRes = await fetch('/api/woocommerce/config');
        const configJson = await configRes.json();
        if (configJson.success && configJson.data) {
          setSiteUrl(configJson.data.site_url || '');
          setIsConfigChecked(true);
        }

        // Tải danh sách sản phẩm WP (tối đa 100 sản phẩm để khớp)
        const productsRes = await fetch('/api/woocommerce/products?per_page=100');
        const productsJson = await productsRes.json();
        const wpProducts: WordPressProduct[] = (productsJson.success && Array.isArray(productsJson.products))
          ? productsJson.products
          : [];
        setProducts(wpProducts);

        // Khởi tạo bảng ghép nối cho các tour
        initializeSyncRows(tours, wpProducts);
      } catch (err: any) {
        console.error('Lỗi khi tải dữ liệu WooCommerce:', err);
        toast.error('Không thể kết nối đến website WordPress. Vui lòng kiểm tra lại cấu hình.');
      } finally {
        setIsLoadingProducts(false);
      }
    };

    initData();
  }, [isOpen, tours]);

  // Khởi tạo danh sách các tour và tự động khớp sản phẩm
  const initializeSyncRows = (sourceTours: Tour[], wpProducts: WordPressProduct[]) => {
    // Chỉ lấy các tour hợp lệ (bỏ qua tour visa nếu có)
    const validTours = sourceTours.filter(t => t.tour_type !== 'visa');

    const rows: BulkTourSyncRow[] = validTours.map(t => {
      let matchType: 'linked' | 'auto_matched' | 'new' = 'new';
      let targetProductId: number | null = null;
      let targetProductName = 'Tạo sản phẩm mới trên Website';
      let targetProductUrl = '';

      // Trường hợp 1: Tour đã có wp_product_id sẵn trong CRM
      if (t.wp_product_id) {
        const found = wpProducts.find(p => p.id === Number(t.wp_product_id));
        if (found) {
          matchType = 'linked';
          targetProductId = found.id;
          targetProductName = found.name;
          targetProductUrl = found.permalink;
        }
      }

      // Trường hợp 2: Chưa có ID, tự động quét theo tên tour
      if (matchType === 'new' && wpProducts.length > 0) {
        let bestProduct: WordPressProduct | null = null;
        let bestScore = 0;

        for (const p of wpProducts) {
          const score = calculateSimilarity(t.name, p.name);
          if (score > bestScore) {
            bestScore = score;
            bestProduct = p;
          }
        }

        // Nếu độ tương đồng >= 0.65 -> Tự động gợi ý khớp
        if (bestProduct && bestScore >= 0.65) {
          matchType = 'auto_matched';
          targetProductId = bestProduct.id;
          targetProductName = bestProduct.name;
          targetProductUrl = bestProduct.permalink;
        }
      }

      return {
        tour: t,
        selected: true, // Mặc định tích chọn tất cả
        matchType,
        targetProductId,
        targetProductName,
        targetProductUrl,
        syncStatus: 'idle'
      };
    });

    setSyncRows(rows);
  };

  // Lọc danh sách hiển thị
  const filteredRows = useMemo(() => {
    return syncRows.filter(row => {
      // Lọc theo từ khóa
      if (searchQuery.trim()) {
        const q = normalizeString(searchQuery);
        const nameMatch = normalizeString(row.tour.name).includes(q);
        const codeMatch = normalizeString(row.tour.code || '').includes(q);
        const targetMatch = normalizeString(row.targetProductName).includes(q);
        if (!nameMatch && !codeMatch && !targetMatch) return false;
      }

      // Lọc theo chế độ ghép nối
      if (filterMode === 'matched' && row.matchType === 'new') return false;
      if (filterMode === 'new' && row.matchType !== 'new') return false;

      return true;
    });
  }, [syncRows, searchQuery, filterMode]);

  // Thống kê số lượng
  const stats = useMemo(() => {
    const total = syncRows.length;
    const selected = syncRows.filter(r => r.selected);
    const selectedCount = selected.length;
    const matchedCount = selected.filter(r => r.matchType === 'linked' || r.matchType === 'auto_matched').length;
    const newCount = selected.filter(r => r.matchType === 'new').length;
    return { total, selectedCount, matchedCount, newCount };
  }, [syncRows]);

  // Chọn / bỏ chọn tất cả
  const handleToggleSelectAll = (checked: boolean) => {
    setSyncRows(prev => prev.map(row => {
      // Nếu đang có bộ lọc hiển thị, chỉ đổi các dòng thỏa mãn
      const isVisible = filteredRows.some(fr => fr.tour.id === row.tour.id);
      return isVisible ? { ...row, selected: checked } : row;
    }));
  };

  // Toggle chọn 1 dòng
  const handleToggleRow = (tourId: string) => {
    setSyncRows(prev => prev.map(r => r.tour.id === tourId ? { ...r, selected: !r.selected } : r));
  };

  // Thay đổi sản phẩm ghép nối cho 1 tour
  const handleSelectTargetProduct = (tourId: string, product: WordPressProduct | null) => {
    setSyncRows(prev => prev.map(r => {
      if (r.tour.id !== tourId) return r;
      if (!product) {
        return {
          ...r,
          matchType: 'new',
          targetProductId: null,
          targetProductName: 'Tạo sản phẩm mới trên Website',
          targetProductUrl: ''
        };
      }
      return {
        ...r,
        matchType: 'linked',
        targetProductId: product.id,
        targetProductName: product.name,
        targetProductUrl: product.permalink
      };
    }));
    setEditingTourId(null);
    setProductSearchInModal('');
    toast.success('Đã cập nhật sản phẩm liên kết!');
  };

  // Lọc danh sách sản phẩm WP khi tìm kiếm đổi sản phẩm
  const filteredWpProducts = useMemo(() => {
    if (!productSearchInModal.trim()) return products.slice(0, 15);
    const q = normalizeString(productSearchInModal);
    return products.filter(p => normalizeString(p.name).includes(q) || String(p.id).includes(q)).slice(0, 20);
  }, [products, productSearchInModal]);

  // 2. Bắt đầu quá trình đồng bộ hàng loạt
  const handleStartBulkSync = async () => {
    const targetRows = syncRows.filter(r => r.selected);
    if (targetRows.length === 0) {
      toast.error('Vui lòng tích chọn ít nhất 1 Tour để đồng bộ.');
      return;
    }

    setViewStep('progress');
    setIsSyncing(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setSyncProgress({
      current: 0,
      total: targetRows.length,
      successCount: 0,
      errorCount: 0
    });

    // Reset trạng thái các dòng được chọn
    setSyncRows(prev => prev.map(r => r.selected ? { ...r, syncStatus: 'idle', syncMessage: undefined } : r));

    let success = 0;
    let error = 0;

    for (let i = 0; i < targetRows.length; i++) {
      if (isPausedRef.current) {
        toast('Quá trình đồng bộ đã được tạm dừng.');
        break;
      }

      const row = targetRows[i];
      setCurrentSyncingName(row.tour.name);

      // Cập nhật trạng thái đang sync cho dòng này
      setSyncRows(prev => prev.map(r => r.tour.id === row.tour.id ? { ...r, syncStatus: 'syncing' } : r));

      try {
        const bodyPayload: any = {
          force_new: row.matchType === 'new',
          update_prices: updatePrices,
          update_departures: updateDepartures
        };
        if (row.matchType !== 'new' && row.targetProductId) {
          bodyPayload.target_product_id = row.targetProductId;
        }

        const res = await fetch(`/api/woocommerce/sync-tour/${row.tour.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload)
        });

        const resJson = await res.json();

        if (resJson.success) {
          success++;
          setSyncRows(prev => prev.map(r => r.tour.id === row.tour.id ? {
            ...r,
            syncStatus: 'success',
            syncedProductId: resJson.product_id,
            syncedProductUrl: resJson.product_url,
            syncMessage: resJson.message || 'Đồng bộ thành công'
          } : r));
        } else {
          error++;
          setSyncRows(prev => prev.map(r => r.tour.id === row.tour.id ? {
            ...r,
            syncStatus: 'error',
            syncMessage: resJson.message || 'Đồng bộ thất bại'
          } : r));
        }
      } catch (err: any) {
        error++;
        setSyncRows(prev => prev.map(r => r.tour.id === row.tour.id ? {
          ...r,
          syncStatus: 'error',
          syncMessage: err.message || 'Lỗi mạng hoặc server không phản hồi'
        } : r));
      }

      setSyncProgress({
        current: i + 1,
        total: targetRows.length,
        successCount: success,
        errorCount: error
      });

      // Khoảng nghỉ nhỏ để tránh quá tải WordPress REST API
      await new Promise(r => setTimeout(r, 400));
    }

    setIsSyncing(false);
    setCurrentSyncingName('');

    if (success > 0) {
      toast.success(`Đã đồng bộ thành công ${success}/${targetRows.length} tour lên Website!`);
      if (onSyncComplete) {
        onSyncComplete();
      }
    } else {
      toast.error('Đồng bộ không thành công, vui lòng kiểm tra lại log chi tiết.');
    }
  };

  const handlePauseOrResume = () => {
    if (isPaused) {
      isPausedRef.current = false;
      setIsPaused(false);
      // Tiếp tục vòng lặp
      handleStartBulkSync();
    } else {
      isPausedRef.current = true;
      setIsPaused(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 via-white to-emerald-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>Đồng bộ hàng loạt Tour lên Website WooCommerce</span>
                {siteUrl && (
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 hidden sm:inline-block">
                    {siteUrl.replace(/^https?:\/\//, '')}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Xem lại danh sách, kiểm tra sản phẩm ghép nối trên website trước khi tiến hành đồng bộ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSyncing}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            title="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung chính Modal */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoadingProducts ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-sm font-semibold text-slate-700">Đang nạp danh sách Tour & sản phẩm từ Website WordPress...</p>
              <p className="text-xs text-slate-400">Hệ thống đang chuẩn bị cơ chế tự động khớp sản phẩm thông minh</p>
            </div>
          ) : viewStep === 'selection' ? (
            <>
              {/* Thanh tóm tắt & Bộ lọc */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">Đã chọn:</span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                    {stats.selectedCount} / {stats.total} tour
                  </span>
                  <span className="text-xs text-slate-400">|</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {stats.matchedCount} tour khớp sản phẩm Web
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    {stats.newCount} tour sẽ tạo mới
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOptions(!showOptions)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                    <span>Tùy chọn cập nhật</span>
                    {showOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Hộp tùy chọn cập nhật mở rộng */}
              <AnimatePresence>
                {showOptions && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs text-slate-700 space-y-2 overflow-hidden"
                  >
                    <div className="font-semibold text-indigo-900 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Cấu hình dữ liệu đồng bộ sang WordPress:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200">
                        <input
                          type="checkbox"
                          checked={updatePrices}
                          onChange={e => setUpdatePrices(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span>Cập nhật bảng giá (Người lớn, Trẻ em, Phòng đơn)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200">
                        <input
                          type="checkbox"
                          checked={updateDepartures}
                          onChange={e => setUpdateDepartures(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span>Cập nhật lịch khởi hành & chỗ trống vào ACF Repeater</span>
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Thanh tìm kiếm & chuyển bộ lọc */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên tour, mã tour CRM hoặc tên sản phẩm Web..."
                    className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      filterMode === 'all'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả ({syncRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('matched')}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      filterMode === 'matched'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    Đã ghép ({stats.matchedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('new')}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      filterMode === 'new'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                  >
                    Tạo mới ({stats.newCount})
                  </button>
                </div>
              </div>

              {/* Bảng danh sách tour */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="py-3 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={filteredRows.length > 0 && filteredRows.every(r => r.selected)}
                            onChange={e => handleToggleSelectAll(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                            title="Chọn / Bỏ chọn tất cả"
                          />
                        </th>
                        <th className="py-3 px-3 font-semibold text-slate-700 w-64">Tour trong CRM</th>
                        <th className="py-3 px-3 font-semibold text-slate-700">Sản phẩm Website WooCommerce ghép nối</th>
                        <th className="py-3 px-3 font-semibold text-slate-700 w-32 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-slate-400">
                            <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                            Không tìm thấy tour nào phù hợp với bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map(row => {
                          const isEditing = editingTourId === row.tour.id;

                          return (
                            <tr
                              key={row.tour.id}
                              className={`transition-colors hover:bg-slate-50/80 ${
                                row.selected ? 'bg-indigo-50/20' : 'opacity-70 bg-white'
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="py-3 px-3 text-center align-top pt-3.5">
                                <input
                                  type="checkbox"
                                  checked={row.selected}
                                  onChange={() => handleToggleRow(row.tour.id)}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                />
                              </td>

                              {/* Thông tin Tour CRM */}
                              <td className="py-3 px-3 align-top">
                                <div className="space-y-1">
                                  <div className="font-semibold text-slate-800 line-clamp-2">
                                    {row.tour.name}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                    <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                                      {row.tour.code}
                                    </span>
                                    {row.tour.price_adult ? (
                                      <span className="font-semibold text-emerald-600">
                                        {Number(row.tour.price_adult).toLocaleString('vi-VN')} đ
                                      </span>
                                    ) : null}
                                    {row.tour.departure_time && (
                                      <span className="text-slate-400">
                                        • {new Date(row.tour.departure_time).toLocaleDateString('vi-VN')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Sản phẩm Website ghép nối */}
                              <td className="py-3 px-3 align-top">
                                {isEditing ? (
                                  <div className="bg-white p-3 rounded-xl border border-indigo-200 shadow-md space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-xs text-indigo-900">Chọn sản phẩm trên WordPress:</span>
                                      <button
                                        type="button"
                                        onClick={() => setEditingTourId(null)}
                                        className="text-slate-400 hover:text-slate-600 p-1"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <div className="relative">
                                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                      <input
                                        type="text"
                                        value={productSearchInModal}
                                        onChange={e => setProductSearchInModal(e.target.value)}
                                        placeholder="Tìm tên sản phẩm trên website..."
                                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        autoFocus
                                      />
                                    </div>
                                    <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 text-xs border border-slate-100 rounded-lg">
                                      <button
                                        type="button"
                                        onClick={() => handleSelectTargetProduct(row.tour.id, null)}
                                        className="w-full p-2 text-left hover:bg-blue-50 flex items-center justify-between text-blue-700 font-medium transition-colors"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <Plus className="w-3.5 h-3.5 text-blue-600" />
                                          <span>Tạo sản phẩm mới hoàn toàn trên Website</span>
                                        </div>
                                        {row.matchType === 'new' && <Check className="w-3.5 h-3.5" />}
                                      </button>
                                      {filteredWpProducts.map(wp => (
                                        <button
                                          key={wp.id}
                                          type="button"
                                          onClick={() => handleSelectTargetProduct(row.tour.id, wp)}
                                          className={`w-full p-2 text-left hover:bg-slate-50 flex items-center justify-between transition-colors ${
                                            row.targetProductId === wp.id ? 'bg-indigo-50/70 font-semibold text-indigo-900' : 'text-slate-700'
                                          }`}
                                        >
                                          <div>
                                            <div className="line-clamp-1">{wp.name}</div>
                                            <div className="text-[11px] text-slate-400">ID: #{wp.id} • SKU: {wp.sku || 'N/A'}</div>
                                          </div>
                                          {row.targetProductId === wp.id && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      {row.matchType === 'linked' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                          Đã liên kết
                                        </span>
                                      ) : row.matchType === 'auto_matched' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                          <SparklesIcon className="w-3 h-3 text-amber-600" />
                                          Tự động khớp tên
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                          <Plus className="w-3 h-3 text-blue-600" />
                                          Tạo sản phẩm mới
                                        </span>
                                      )}

                                      {row.targetProductId && (
                                        <span className="text-[11px] font-mono text-slate-400">
                                          #{row.targetProductId}
                                        </span>
                                      )}
                                    </div>

                                    <div className="text-slate-800 font-medium line-clamp-1">
                                      {row.targetProductName}
                                    </div>

                                    {row.targetProductUrl && (
                                      <a
                                        href={row.targetProductUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline"
                                      >
                                        <span>Xem trên Web</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Nút thao tác đổi liên kết */}
                              <td className="py-3 px-3 align-top text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTourId(isEditing ? null : row.tour.id);
                                    setProductSearchInModal(row.tour.name || '');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg transition-colors shadow-sm"
                                  title="Đổi sản phẩm Website ghép nối"
                                >
                                  <Link2 className="w-3.5 h-3.5 text-slate-500" />
                                  <span>{isEditing ? 'Đóng' : 'Đổi liên kết'}</span>
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
            </>
          ) : (
            /* Màn hình tiến trình đồng bộ (Live Progress) */
            <div className="space-y-5 py-2">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      {isSyncing ? (
                        <>
                          <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                          <span>Đang tiến hành đồng bộ sang Website WooCommerce...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span>Đã hoàn tất tiến trình đồng bộ!</span>
                        </>
                      )}
                    </h4>
                    {currentSyncingName && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        Đang xử lý: <strong className="text-slate-700">{currentSyncingName}</strong>
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-2xl font-black text-indigo-600">
                      {syncProgress.total > 0
                        ? Math.round((syncProgress.current / syncProgress.total) * 100)
                        : 0}%
                    </span>
                    <p className="text-xs text-slate-500 font-medium">
                      {syncProgress.current} / {syncProgress.total} tour
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-emerald-500 transition-all duration-300"
                    style={{
                      width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%`
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Thành công: {syncProgress.successCount}
                    </span>
                    {syncProgress.errorCount > 0 && (
                      <span className="text-rose-700 font-semibold flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        Lỗi: {syncProgress.errorCount}
                      </span>
                    )}
                  </div>

                  {isSyncing && (
                    <button
                      type="button"
                      onClick={handlePauseOrResume}
                      className="text-xs text-slate-600 hover:text-slate-900 underline font-medium"
                    >
                      {isPaused ? 'Tiếp tục chạy' : 'Tạm dừng'}
                    </button>
                  )}
                </div>
              </div>

              {/* Danh sách log chi tiết từng tour */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-semibold text-xs text-slate-700">
                  Chi tiết kết quả từng Tour:
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                  {syncRows.filter(r => r.selected).map(row => (
                    <div
                      key={row.tour.id}
                      className="p-2.5 rounded-lg text-xs flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-3">
                        {row.syncStatus === 'syncing' ? (
                          <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                        ) : row.syncStatus === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : row.syncStatus === 'error' ? (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0" />
                        )}

                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate">
                            {row.tour.name}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 truncate">
                            <span>Mã: {row.tour.code}</span>
                            {row.syncMessage && (
                              <span className={row.syncStatus === 'error' ? 'text-rose-600' : 'text-emerald-600'}>
                                • {row.syncMessage}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {row.syncedProductUrl && (
                        <a
                          href={row.syncedProductUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline shrink-0 bg-indigo-50 px-2 py-1 rounded"
                        >
                          <span>Xem Web</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer hành động Modal */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            {viewStep === 'progress' && !isSyncing && (
              <button
                type="button"
                onClick={() => setViewStep('selection')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Quay lại danh sách chọn</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSyncing}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              {viewStep === 'progress' && !isSyncing ? 'Đóng' : 'Hủy bỏ'}
            </button>

            {viewStep === 'selection' && (
              <button
                type="button"
                onClick={handleStartBulkSync}
                disabled={isLoadingProducts || stats.selectedCount === 0 || isSyncing}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Globe className="w-4 h-4" />
                <span>Tiến hành đồng bộ ({stats.selectedCount} tour)</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Component icon nhỏ
function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
export default BulkSyncWooCommerceModal;
