import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Globe, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  X, 
  Check, 
  Calendar, 
  DollarSign, 
  AlertCircle,
  Sparkles,
  Link2,
  ArrowRightLeft,
  Plus,
  Play,
  RotateCcw,
  Sliders,
  Filter,
  Layers,
  StopCircle,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Tour } from '../types';
import { findMatchedProductForTour, extractSkuFromTourCode, normalizeText } from '../utils/skuHelper';

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

export interface TourSyncSetting {
  mode: 'existing' | 'new';
  targetProductId: number | null;
  matchedType: 'linked' | 'sku_matched' | 'name_matched' | 'auto_matched' | 'manual' | 'new';
  matchedSku?: string;
  matchedProductName?: string;
  productUrl?: string;
}

export interface SyncProgressItem {
  tourId: string;
  tourCode: string;
  tourName: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  action?: 'created' | 'updated';
  productId?: number;
  productName?: string;
  productUrl?: string;
  message?: string;
}

interface BulkSyncWooCommerceModalProps {
  isOpen: boolean;
  onClose: () => void;
  tours: Tour[];
  onSyncComplete?: () => void;
}

export const BulkSyncWooCommerceModal: React.FC<BulkSyncWooCommerceModalProps> = ({
  isOpen,
  onClose,
  tours,
  onSyncComplete
}) => {
  // Trạng thái màn hình: 'selection' (chọn & ghép nối) | 'progress' (đang chạy & xem kết quả)
  const [currentView, setCurrentView] = useState<'selection' | 'progress'>('selection');

  // Danh sách sản phẩm WooCommerce từ server
  const [wpProducts, setWpProducts] = useState<WordPressProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Bộ lọc & Tìm kiếm Tour
  const [searchTourQuery, setSearchTourQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sku_matched' | 'linked' | 'name_matched' | 'new'>('all');

  // Danh sách tour được tích chọn (tourId Set)
  const [selectedTourIds, setSelectedTourIds] = useState<Set<string>>(new Set());

  // Cấu hình ghép nối cho từng tour (tourId -> TourSyncSetting)
  const [syncSettings, setSyncSettings] = useState<Record<string, TourSyncSetting>>({});

  // Tùy chọn đồng bộ nâng cao
  const [updatePrices, setUpdatePrices] = useState(true);
  const [updateDepartures, setUpdateDepartures] = useState(true);

  // State mở popover đổi sản phẩm cho 1 tour cụ thể
  const [editingTourId, setEditingTourId] = useState<string | null>(null);
  const [productSearchKeyword, setProductSearchKeyword] = useState('');

  // Tiến trình đồng bộ
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgressList, setSyncProgressList] = useState<SyncProgressItem[]>([]);
  const [currentSyncIndex, setCurrentSyncIndex] = useState(0);
  const abortSyncRef = useRef(false);

  // Nạp danh sách sản phẩm WooCommerce khi mở Modal
  const loadWooCommerceProducts = async () => {
    try {
      setIsLoadingProducts(true);
      const res = await fetch('/api/woocommerce/products?per_page=100');
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        setWpProducts(data.products);
        autoMatchProducts(tours, data.products);
      } else {
        toast.error('Không thể tải danh sách sản phẩm từ Website WordPress.');
      }
    } catch (err) {
      console.error('Lỗi nạp sản phẩm WooCommerce:', err);
      toast.error('Lỗi kết nối máy chủ WooCommerce.');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Thuật toán tự động ghép nối sản phẩm theo quy tắc tiền tố SKU & tên tour
  const autoMatchProducts = (currentTours: Tour[], productsList: WordPressProduct[]) => {
    const newSettings: Record<string, TourSyncSetting> = {};
    const defaultSelected = new Set<string>();

    currentTours.forEach(tour => {
      // Mặc định chọn các tour đang hoạt động hoặc sắp diễn ra
      if (tour.status !== 'cancelled') {
        defaultSelected.add(tour.id);
      }

      // Tự động tìm sản phẩm khớp: ưu tiên liên kết cũ -> khớp tiền tố SKU -> khớp tên -> tạo mới
      const matchRes = findMatchedProductForTour(tour, productsList);
      newSettings[tour.id] = {
        mode: matchRes.targetProductId ? 'existing' : 'new',
        targetProductId: matchRes.targetProductId,
        matchedType: matchRes.matchedType,
        matchedSku: matchRes.matchedSku,
        matchedProductName: matchRes.matchedProductName,
        productUrl: matchRes.productUrl
      };
    });

    setSyncSettings(newSettings);
    setSelectedTourIds(defaultSelected);
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentView('selection');
      setIsSyncing(false);
      setEditingTourId(null);
      setProductSearchKeyword('');
      loadWooCommerceProducts();
    }
  }, [isOpen, tours]);

  // Lọc danh sách tour hiển thị theo tìm kiếm & trạng thái
  const filteredTours = useMemo(() => {
    return tours.filter(tour => {
      // Tìm kiếm theo tên hoặc mã tour
      if (searchTourQuery.trim()) {
        const query = normalizeText(searchTourQuery);
        const nameMatch = normalizeText(tour.name).includes(query);
        const codeMatch = normalizeText(tour.code).includes(query);
        const destMatch = normalizeText(tour.destination || '').includes(query);
        if (!nameMatch && !codeMatch && !destMatch) return false;
      }

      // Lọc theo trạng thái ghép nối
      const setting = syncSettings[tour.id];
      if (statusFilter === 'sku_matched') {
        return setting?.matchedType === 'sku_matched';
      }
      if (statusFilter === 'linked') {
        return setting?.matchedType === 'linked';
      }
      if (statusFilter === 'name_matched') {
        return setting?.matchedType === 'name_matched' || setting?.matchedType === 'auto_matched';
      }
      if (statusFilter === 'new') {
        return setting?.matchedType === 'new';
      }

      return true;
    });
  }, [tours, searchTourQuery, statusFilter, syncSettings]);

  // Thống kê số lượng
  const stats = useMemo(() => {
    const selectedCount = selectedTourIds.size;
    let linkedCount = 0;
    let skuMatchedCount = 0;
    let nameMatchedCount = 0;
    let newCount = 0;

    selectedTourIds.forEach(id => {
      const s = syncSettings[id];
      if (!s || s.matchedType === 'new') {
        newCount++;
      } else if (s.matchedType === 'linked') {
        linkedCount++;
      } else if (s.matchedType === 'sku_matched') {
        skuMatchedCount++;
      } else {
        nameMatchedCount++;
      }
    });

    return { selectedCount, linkedCount, skuMatchedCount, nameMatchedCount, newCount };
  }, [selectedTourIds, syncSettings]);

  // Chọn / Bỏ chọn 1 tour
  const toggleSelectTour = (tourId: string) => {
    setSelectedTourIds(prev => {
      const next = new Set(prev);
      if (next.has(tourId)) {
        next.delete(tourId);
      } else {
        next.add(tourId);
      }
      return next;
    });
  };

  // Chọn tất cả các tour đang hiển thị
  const handleSelectAllFiltered = () => {
    setSelectedTourIds(prev => {
      const next = new Set(prev);
      filteredTours.forEach(t => next.add(t.id));
      return next;
    });
  };

  // Bỏ chọn tất cả các tour đang hiển thị
  const handleDeselectAllFiltered = () => {
    setSelectedTourIds(prev => {
      const next = new Set(prev);
      filteredTours.forEach(t => next.delete(t.id));
      return next;
    });
  };

  // Cập nhật ghép nối sản phẩm cho 1 tour
  const handleSelectProductForTour = (tourId: string, product: WordPressProduct | 'new') => {
    setSyncSettings(prev => {
      if (product === 'new') {
        return {
          ...prev,
          [tourId]: {
            mode: 'new',
            targetProductId: null,
            matchedType: 'new'
          }
        };
      }
      return {
        ...prev,
        [tourId]: {
          mode: 'existing',
          targetProductId: product.id,
          matchedType: 'manual',
          matchedProductName: product.name,
          productUrl: product.permalink
        }
      };
    });
    setEditingTourId(null);
  };

  // Danh sách sản phẩm WordPress được lọc trong popover đổi liên kết
  const filteredWpProductsForSelector = useMemo(() => {
    if (!productSearchKeyword.trim()) return wpProducts.slice(0, 30);
    const kw = normalizeText(productSearchKeyword);
    return wpProducts.filter(p => 
      normalizeText(p.name).includes(kw) || 
      String(p.id).includes(kw) ||
      normalizeText(p.sku || '').includes(kw)
    ).slice(0, 30);
  }, [wpProducts, productSearchKeyword]);

  // Thực hiện đồng bộ hàng loạt
  const handleStartBulkSync = async () => {
    const toursToSync = tours.filter(t => selectedTourIds.has(t.id));
    if (toursToSync.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 tour để đồng bộ.');
      return;
    }

    // Chuẩn bị danh sách tiến trình
    const initialProgress: SyncProgressItem[] = toursToSync.map(t => {
      const s = syncSettings[t.id];
      return {
        tourId: t.id,
        tourCode: t.code,
        tourName: t.name,
        status: 'pending',
        productId: s?.targetProductId || undefined,
        productName: s?.matchedProductName,
        productUrl: s?.productUrl
      };
    });

    setSyncProgressList(initialProgress);
    setCurrentView('progress');
    setIsSyncing(true);
    setCurrentSyncIndex(0);
    abortSyncRef.current = false;

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < toursToSync.length; i++) {
      if (abortSyncRef.current) {
        toast('Đã dừng tiến trình đồng bộ theo yêu cầu.', { icon: '⚠️' });
        break;
      }

      const currentTour = toursToSync[i];
      const setting = syncSettings[currentTour.id] || { mode: 'new', targetProductId: null, matchedType: 'new' };

      setCurrentSyncIndex(i);

      // Cập nhật trạng thái đang chạy
      setSyncProgressList(prev => prev.map((item, idx) => 
        idx === i ? { ...item, status: 'running' } : item
      ));

      try {
        const payload: any = {
          target_product_id: setting.mode === 'existing' && setting.targetProductId ? setting.targetProductId : 'new',
          force_new: setting.mode === 'new',
          update_prices: updatePrices,
          update_departures: updateDepartures
        };

        const res = await fetch(`/api/woocommerce/sync-tour/${currentTour.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && data.success) {
          successCount++;
          setSyncProgressList(prev => prev.map((item, idx) => 
            idx === i ? {
              ...item,
              status: 'success',
              action: data.action,
              productId: data.product_id,
              productName: data.product_name,
              productUrl: data.product_url,
              message: data.message || 'Đồng bộ thành công'
            } : item
          ));
        } else {
          failedCount++;
          setSyncProgressList(prev => prev.map((item, idx) => 
            idx === i ? {
              ...item,
              status: 'failed',
              message: data.message || 'Lỗi không xác định khi đồng bộ'
            } : item
          ));
        }
      } catch (err: any) {
        failedCount++;
        setSyncProgressList(prev => prev.map((item, idx) => 
          idx === i ? {
            ...item,
            status: 'failed',
            message: err.message || 'Lỗi kết nối khi gửi dữ liệu'
          } : item
        ));
      }

      // Giãn cách nhẹ 200ms giữa các request để giảm tải máy chủ WordPress
      await new Promise(r => setTimeout(r, 200));
    }

    setIsSyncing(false);

    if (!abortSyncRef.current) {
      if (failedCount === 0) {
        toast.success(`Đồng bộ thành công toàn bộ ${successCount} tour lên Website!`);
      } else {
        toast(`Đã xử lý xong: ${successCount} thành công, ${failedCount} thất bại.`, { icon: 'ℹ️' });
      }
    }

    if (onSyncComplete) {
      onSyncComplete();
    }
  };

  // Dừng đồng bộ
  const handleAbortSync = () => {
    abortSyncRef.current = true;
    setIsSyncing(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-lg">Đồng Bộ Tour Lên Website WooCommerce</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                  {currentView === 'selection' ? 'Chọn & Ghép Nối' : 'Tiến Trình Chạy'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {currentView === 'selection' 
                  ? 'Kiểm tra danh sách tour, cơ chế ghép nối sản phẩm và bảng giá trước khi đồng bộ' 
                  : 'Theo dõi tiến độ cập nhật thực tế từng sản phẩm lên website theo thời gian thực'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentView === 'selection' && (
              <button
                type="button"
                onClick={loadWooCommerceProducts}
                disabled={isLoadingProducts}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm disabled:opacity-50"
                title="Tải lại danh sách sản phẩm từ Website"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingProducts ? 'animate-spin text-indigo-600' : ''}`} />
                <span>Tải lại dữ liệu Web</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={isSyncing}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors disabled:opacity-30"
              title="Đóng modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {currentView === 'selection' ? (
            <>
              {/* THANH THỐNG KÊ & TÙY CHỌN NÂNG CAO */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                {/* 5 Thẻ thống kê */}
                <div className="md:col-span-7 flex flex-wrap items-center gap-2">
                  <div className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs shadow-sm flex items-center gap-2">
                    <span className="text-slate-500">Đã chọn:</span>
                    <span className="font-bold text-slate-800 text-sm">{stats.selectedCount}</span>
                    <span className="text-slate-400">/ {tours.length}</span>
                  </div>

                  <div className="px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-800 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Khớp SKU:</span>
                    <span className="font-bold">{stats.skuMatchedCount}</span>
                  </div>

                  <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Đã liên kết:</span>
                    <span className="font-bold">{stats.linkedCount}</span>
                  </div>

                  <div className="px-2.5 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-xs font-medium text-purple-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Khớp tên:</span>
                    <span className="font-bold">{stats.nameMatchedCount}</span>
                  </div>

                  <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-amber-600" />
                    <span>Tạo mới:</span>
                    <span className="font-bold">{stats.newCount}</span>
                  </div>
                </div>

                {/* 2 Tùy chọn checkbox đồng bộ */}
                <div className="md:col-span-5 flex flex-wrap items-center justify-end gap-3 text-xs text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300">
                    <input 
                      type="checkbox" 
                      checked={updatePrices} 
                      onChange={(e) => setUpdatePrices(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                    <span>Cập nhật bảng giá</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300">
                    <input 
                      type="checkbox" 
                      checked={updateDepartures} 
                      onChange={(e) => setUpdateDepartures(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Cập nhật ACF Lịch trình</span>
                  </label>
                </div>
              </div>

              {/* BỘ LỌC VÀ TÌM KIẾM TOUR */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTourQuery}
                    onChange={(e) => setSearchTourQuery(e.target.value)}
                    placeholder="Tìm theo tên tour, mã lịch trình, điểm đến..."
                    className="w-full pl-9 pr-8 h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  {searchTourQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchTourQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-xl border transition-all ${
                      statusFilter === 'all'
                        ? 'bg-slate-800 text-white border-slate-800 shadow-sm font-medium'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Tất cả ({tours.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('sku_matched')}
                    className={`px-3 py-1.5 rounded-xl border transition-all ${
                      statusFilter === 'sku_matched'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-medium'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Khớp SKU
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('linked')}
                    className={`px-3 py-1.5 rounded-xl border transition-all ${
                      statusFilter === 'linked'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-medium'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Đã liên kết
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('name_matched')}
                    className={`px-3 py-1.5 rounded-xl border transition-all ${
                      statusFilter === 'name_matched'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm font-medium'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Khớp tên
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('new')}
                    className={`px-3 py-1.5 rounded-xl border transition-all ${
                      statusFilter === 'new'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm font-medium'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Tạo mới
                  </button>

                  <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

                  {/* Nút chọn nhanh */}
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="px-2.5 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium transition-colors"
                  >
                    Chọn trang này
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllFiltered}
                    className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              {/* BẢNG DANH SÁCH TOUR VÀ GHÉP NỐI */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-slate-700 font-semibold">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input 
                            type="checkbox"
                            checked={filteredTours.length > 0 && filteredTours.every(t => selectedTourIds.has(t.id))}
                            onChange={(e) => {
                              if (e.target.checked) handleSelectAllFiltered();
                              else handleDeselectAllFiltered();
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                        </th>
                        <th className="p-3 min-w-[200px]">Tour CRM (Tên & Mã Lịch)</th>
                        <th className="p-3 w-32">Giá Tour</th>
                        <th className="p-3 w-36">Khởi Hành</th>
                        <th className="p-3 min-w-[260px]">Sản Phẩm Website Khớp Nối</th>
                        <th className="p-3 w-28 text-center">Hành Động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTours.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-slate-400">
                            Không tìm thấy tour nào phù hợp với bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        filteredTours.map(tour => {
                          const isSelected = selectedTourIds.has(tour.id);
                          const setting = syncSettings[tour.id] || { mode: 'new', targetProductId: null, matchedType: 'new' };
                          const isEditing = editingTourId === tour.id;

                          return (
                            <tr 
                              key={tour.id} 
                              className={`transition-colors hover:bg-slate-50/80 ${isSelected ? 'bg-indigo-50/30' : ''}`}
                            >
                              {/* Checkbox chọn */}
                              <td className="p-3 text-center">
                                <input 
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectTour(tour.id)}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                />
                              </td>

                              {/* Thông tin Tour CRM */}
                              <td className="p-3">
                                <div className="font-semibold text-slate-800 line-clamp-1" title={tour.name}>
                                  {tour.name}
                                </div>
                                <div className="flex items-center flex-wrap gap-1.5 mt-1 text-[11px] text-slate-500">
                                  <span className="font-mono font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                    {tour.code}
                                  </span>
                                  {extractSkuFromTourCode(tour.code) && extractSkuFromTourCode(tour.code) !== tour.code && (
                                    <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                                      <Tag className="w-2.5 h-2.5 text-indigo-500" />
                                      <span>SKU: {extractSkuFromTourCode(tour.code)}</span>
                                    </span>
                                  )}
                                  {tour.duration && <span>• {tour.duration}</span>}
                                  {tour.destination && <span>• {tour.destination}</span>}
                                </div>
                              </td>

                              {/* Giá tour */}
                              <td className="p-3 font-medium text-slate-700">
                                {Number(tour.price_adult || tour.price || 0) > 0 ? (
                                  <span className="text-amber-700 font-semibold">
                                    {Number(tour.price_adult || tour.price || 0).toLocaleString('vi-VN')} đ
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Chưa có giá</span>
                                )}
                              </td>

                              {/* Ngày khởi hành & Chỗ trống */}
                              <td className="p-3 text-slate-600">
                                <div className="flex items-center gap-1 font-medium">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{tour.start_date || 'N/A'}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Còn {tour.available_seats ?? tour.total_seats ?? 0} chỗ
                                </div>
                              </td>

                              {/* Trạng thái ghép nối sản phẩm Website */}
                              <td className="p-3 relative">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {setting.matchedType === 'sku_matched' && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200 shadow-xs">
                                        <Tag className="w-3 h-3 text-indigo-600" />
                                        <span>Khớp SKU {setting.matchedSku ? `[${setting.matchedSku}]` : ''} #{setting.targetProductId}</span>
                                      </span>
                                    )}

                                    {setting.matchedType === 'linked' && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs">
                                        <Link2 className="w-3 h-3 text-emerald-600" />
                                        <span>Đã liên kết #{setting.targetProductId}</span>
                                      </span>
                                    )}

                                    {(setting.matchedType === 'auto_matched' || setting.matchedType === 'name_matched') && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200 shadow-xs">
                                        <Sparkles className="w-3 h-3 text-purple-600" />
                                        <span>Khớp tên #{setting.targetProductId}</span>
                                      </span>
                                    )}

                                    {setting.matchedType === 'manual' && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200 shadow-xs">
                                        <Check className="w-3 h-3 text-blue-600" />
                                        <span>Đã chọn #{setting.targetProductId}</span>
                                      </span>
                                    )}

                                    {setting.matchedType === 'new' && (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
                                          <AlertCircle className="w-3 h-3 text-amber-600" />
                                          <span>Chưa có SKU Web</span>
                                        </span>
                                        <span className="text-[11px] text-slate-500 font-mono">
                                          (Sẽ tạo SKU: {extractSkuFromTourCode(tour.code) || tour.code})
                                        </span>
                                      </div>
                                    )}

                                    {setting.matchedProductName && (
                                      <span className="text-slate-700 font-medium text-xs truncate max-w-[220px]" title={setting.matchedProductName}>
                                        {setting.matchedProductName}
                                      </span>
                                    )}
                                  </div>

                                  {/* Chú thích hành động cụ thể */}
                                  {setting.mode === 'existing' && setting.targetProductId && (
                                    <div className="text-[10px] text-indigo-600 font-medium flex items-center gap-1">
                                      <span>↳ Cập nhật đợt [{tour.code}] vào ACF & cộng dồn chỗ</span>
                                    </div>
                                  )}
                                </div>

                                {/* POPOVER ĐỔI SẢN PHẨM LIÊN KẾT */}
                                {isEditing && (
                                  <div 
                                    className="absolute left-0 top-full mt-1 z-[90] w-84 bg-white rounded-xl shadow-xl border border-slate-200 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-150"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                      <span className="font-semibold text-slate-800 text-xs">Chọn Sản Phẩm Tour Trên Website</span>
                                      <button 
                                        type="button" 
                                        onClick={() => setEditingTourId(null)}
                                        className="text-slate-400 hover:text-slate-600 p-0.5"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {/* Ô tìm kiếm sản phẩm WP */}
                                    <div className="relative">
                                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                      <input 
                                        type="text"
                                        value={productSearchKeyword}
                                        onChange={(e) => setProductSearchKeyword(e.target.value)}
                                        placeholder="Tìm tên sản phẩm, ID, SKU..."
                                        className="w-full pl-7 pr-2.5 h-8 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                      />
                                    </div>

                                    {/* Danh sách lựa chọn */}
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                      {/* Tùy chọn 1: Tạo mới */}
                                      <button
                                        type="button"
                                        onClick={() => handleSelectProductForTour(tour.id, 'new')}
                                        className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                          setting.mode === 'new' 
                                            ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                                            : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <Plus className="w-3.5 h-3.5 text-indigo-600" />
                                          <span>✨ Tạo sản phẩm mới với SKU: <strong className="font-mono">{extractSkuFromTourCode(tour.code) || tour.code}</strong></span>
                                        </div>
                                        {setting.mode === 'new' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                                      </button>

                                      <div className="h-px bg-slate-100 my-1" />

                                      {/* Danh sách các sản phẩm từ WordPress */}
                                      {filteredWpProductsForSelector.map(p => {
                                        const isCurrent = setting.targetProductId === p.id;
                                        return (
                                          <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => handleSelectProductForTour(tour.id, p)}
                                            className={`w-full text-left p-2 rounded-lg text-xs flex items-start justify-between gap-2 transition-colors ${
                                              isCurrent 
                                                ? 'bg-emerald-50 text-emerald-800 font-semibold' 
                                                : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                          >
                                            <div className="min-w-0">
                                              <div className="line-clamp-1 font-medium">{p.name}</div>
                                              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                {p.sku && (
                                                  <span className="font-mono text-indigo-600 bg-indigo-50 px-1 rounded">
                                                    SKU: {p.sku}
                                                  </span>
                                                )}
                                                <span>ID: #{p.id}</span>
                                                <span>•</span>
                                                <span>{p.departures_count || 0} đợt lịch</span>
                                                <span>•</span>
                                                <span>{Number(p.regular_price || p.price || 0).toLocaleString('vi-VN')} đ</span>
                                              </div>
                                            </div>
                                            {isCurrent && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />}
                                          </button>
                                        );
                                      })}

                                      {filteredWpProductsForSelector.length === 0 && (
                                        <div className="text-center py-3 text-slate-400 text-xs">
                                          Không tìm thấy sản phẩm WordPress nào.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* Cột Hành động: Nút đổi liên kết */}
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isEditing) {
                                      setEditingTourId(null);
                                    } else {
                                      setEditingTourId(tour.id);
                                      setProductSearchKeyword(tour.name || '');
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-xs"
                                  title="Đổi sản phẩm Website ghép nối"
                                >
                                  <ArrowRightLeft className="w-3 h-3" />
                                  <span>Đổi</span>
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
            /* MÀN HÌNH TIẾN TRÌNH ĐỒNG BỘ (LIVE PROGRESS) */
            <div className="space-y-4">
              {/* THANH TIẾN ĐỘ TỔNG QUAN */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {isSyncing ? (
                      <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                    <span className="font-semibold text-slate-800 text-sm">
                      {isSyncing ? `Đang đồng bộ (${currentSyncIndex + 1}/${syncProgressList.length})...` : 'Tiến trình đồng bộ hoàn tất'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-slate-600 font-semibold">
                    <span>
                      {syncProgressList.length > 0 
                        ? Math.round(((syncProgressList.filter(i => i.status === 'success' || i.status === 'failed').length) / syncProgressList.length) * 100) 
                        : 0}%
                    </span>
                  </div>
                </div>

                {/* Thanh Progress Bar */}
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 rounded-full ${isSyncing ? 'bg-indigo-600' : 'bg-emerald-600'}`}
                    style={{
                      width: `${syncProgressList.length > 0 
                        ? Math.round(((syncProgressList.filter(i => i.status === 'success' || i.status === 'failed').length) / syncProgressList.length) * 100) 
                        : 0}%`
                    }}
                  />
                </div>

                {/* Thống kê kết quả */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Thành công: {syncProgressList.filter(i => i.status === 'success').length}
                    </span>
                    <span className="text-rose-700 font-medium flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      Lỗi: {syncProgressList.filter(i => i.status === 'failed').length}
                    </span>
                    <span className="text-slate-500">
                      Chờ xử lý: {syncProgressList.filter(i => i.status === 'pending').length}
                    </span>
                  </div>

                  {isSyncing && (
                    <button
                      type="button"
                      onClick={handleAbortSync}
                      className="flex items-center gap-1 text-rose-600 hover:text-rose-700 font-medium transition-colors"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      <span>Dừng lại</span>
                    </button>
                  )}
                </div>
              </div>

              {/* BẢNG LOG CHI TIẾT TỪNG TOUR */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm max-h-[50vh] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-slate-700 font-semibold">
                    <tr>
                      <th className="p-3 w-12 text-center">STT</th>
                      <th className="p-3 min-w-[220px]">Tour CRM</th>
                      <th className="p-3 w-32 text-center">Trạng Thái</th>
                      <th className="p-3 min-w-[280px]">Kết Quả Đồng Bộ</th>
                      <th className="p-3 w-32 text-center">Liên Kết Web</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {syncProgressList.map((item, index) => (
                      <tr key={item.tourId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-center font-mono text-slate-400">
                          {index + 1}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800 line-clamp-1">{item.tourName}</div>
                          <div className="font-mono text-[11px] text-slate-500 mt-0.5">{item.tourCode}</div>
                        </td>
                        <td className="p-3 text-center">
                          {item.status === 'pending' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                              Chờ lượt...
                            </span>
                          )}
                          {item.status === 'running' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-100 text-indigo-700 animate-pulse">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Đang gửi...
                            </span>
                          )}
                          {item.status === 'success' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Thành công
                            </span>
                          )}
                          {item.status === 'failed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-100 text-rose-800">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Thất bại
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600">
                          {item.message ? (
                            <div className="text-xs">{item.message}</div>
                          ) : (
                            <span className="text-slate-400 italic">Đang chờ xử lý...</span>
                          )}
                          {item.productId && (
                            <div className="text-[11px] text-indigo-600 font-mono mt-0.5">
                              Sản phẩm #{item.productId}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {item.productUrl ? (
                            <a
                              href={item.productUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg font-medium transition-colors"
                            >
                              <span>Xem Web</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
          {currentView === 'selection' ? (
            <>
              <div className="text-xs text-slate-500">
                <span>Đã chọn </span>
                <strong className="text-slate-800 font-semibold">{stats.selectedCount}</strong>
                <span> tour để đồng bộ</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
                >
                  Hủy bỏ
                </button>

                <button
                  type="button"
                  onClick={handleStartBulkSync}
                  disabled={stats.selectedCount === 0 || isLoadingProducts}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all shadow-sm hover:shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Tiến hành đồng bộ ({stats.selectedCount})</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-xs text-slate-500">
                {isSyncing ? (
                  <span>Đang thực hiện đồng bộ... Vui lòng không đóng trang.</span>
                ) : (
                  <span>Quá trình đồng bộ hàng loạt đã hoàn thành.</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!isSyncing && (
                  <button
                    type="button"
                    onClick={() => setCurrentView('selection')}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Quay lại cấu hình</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSyncing}
                  className="px-5 py-2 text-xs font-semibold text-white bg-slate-800 rounded-xl hover:bg-slate-900 transition-colors shadow-sm disabled:opacity-50"
                >
                  Hoàn tất & Đóng
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
export default BulkSyncWooCommerceModal;
