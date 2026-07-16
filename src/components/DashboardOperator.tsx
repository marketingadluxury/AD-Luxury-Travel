import React, { useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { format, differenceInDays } from 'date-fns';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  PlaneTakeoff, 
  Ticket, 
  FileCheck,
  Filter,
  X,
  Download,
  Users,
  Search,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const removeDiacritics = (str: string): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

export default function DashboardOperator() {
  const { tours, orders, passengers } = useCRM();
  const navigate = useNavigate();

  const [daysFilter, setDaysFilter] = useState<number>(30);
  const [selectedDestination, setSelectedDestination] = useState<string>('all');
  const [selectedTour, setSelectedTour] = useState<any | null>(null);
  const [showPassengersModal, setShowPassengersModal] = useState<boolean>(false);
  const [modalSearchTerm, setModalSearchTerm] = useState<string>('');

  const destinationsList = useMemo(() => {
    const list = new Set<string>();
    tours.forEach(t => {
      if (t.destination && t.tour_type !== 'visa') list.add(t.destination);
    });
    return Array.from(list);
  }, [tours]);

  // Logic lấy danh sách hành khách của Tour được chọn
  const tourData = useMemo(() => {
    if (!selectedTour) return { ordersList: [], passengersList: [] };

    const ordersList = orders.filter(o => o.tour_id === selectedTour.id && o.status !== 'cancelled');

    const passengersList: { 
      passenger: any | null; 
      order: any; 
      indexInOrder: number;
      totalInOrder: number;
    }[] = [];

    ordersList.forEach(order => {
      const orderPassengers = passengers.filter(p => p.order_id === order.id);
      if (orderPassengers.length === 0) {
        passengersList.push({
          passenger: null,
          order,
          indexInOrder: 0,
          totalInOrder: 1
        });
      } else {
        orderPassengers.forEach((p, idx) => {
          passengersList.push({
            passenger: p,
            order,
            indexInOrder: idx,
            totalInOrder: orderPassengers.length
          });
        });
      }
    });

    return { ordersList, passengersList };
  }, [selectedTour, orders, passengers]);

  const filteredModalPassengers = useMemo(() => {
    const { passengersList } = tourData;
    if (!modalSearchTerm.trim()) return passengersList;

    const q = modalSearchTerm.toLowerCase().trim();
    return passengersList.filter(item => {
      const nameMatch = item.passenger?.full_name?.toLowerCase().includes(q) || 
                        item.order?.booker_name?.toLowerCase().includes(q);
      const passportMatch = item.passenger?.passport_number?.toLowerCase().includes(q);
      const phoneMatch = item.passenger?.phone?.includes(q) || item.order?.booker_phone?.includes(q);
      const orderMatch = item.order?.id?.toLowerCase().includes(q);
      const saleMatch = item.order?.created_by?.toLowerCase().includes(q);
      return nameMatch || passportMatch || phoneMatch || orderMatch || saleMatch;
    });
  }, [tourData, modalSearchTerm]);

  const handleExportExcel = () => {
    if (!selectedTour) return;
    const { ordersList } = tourData;
    
    // Tính toán tổng số lượng khách động
    let totalAdults = 0;
    let totalChildren = 0;
    let totalInfants = 0;
    let totalSingleRooms = 0;

    ordersList.forEach(order => {
      totalAdults += order.adult_count || 0;
      totalChildren += order.child_count || 0;
      totalInfants += order.infant_count || 0;
      totalSingleRooms += order.single_room_count || 0;
    });

    let rowHtml = '';
    let no = 1;

    ordersList.forEach((order, orderIdx) => {
      const orderPassengers = passengers.filter(p => p.order_id === order.id);
      const orderBgColor = orderIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
      
      const singleRoomSurchargeText = order.single_room_count && order.single_room_count > 0 ? 'O PHONG DON' : '';

      if (orderPassengers.length === 0) {
        // Ghi chú của đơn hàng (Note)
        const noteText = removeDiacritics(order.special_requests || '').toUpperCase();

        rowHtml += `
          <tr style="background-color: ${orderBgColor};">
            <td style="text-align:center; border: 1px solid #000000; padding: 6px;">${no++}</td>
            <td style="text-align:center; border: 1px solid #000000; padding: 6px;">Mr/Mrs</td>
            <td style="font-weight:bold; border: 1px solid #000000; padding: 6px; text-transform:uppercase;">${removeDiacritics(order.booker_name || 'Khach dai dien').toUpperCase()}</td>
            <td style="text-align:center; border: 1px solid #000000; padding: 6px;"></td>
            <td style="text-align:center; border: 1px solid #000000; padding: 6px;">${order.booker_phone || ''}</td>
            <td style="text-align:center; border: 1px solid #000000; padding: 6px; font-family: monospace;">CHUA CO HO CHIEU</td>
            <td style="text-align:center; border: 1px solid #000000; padding: 6px;"></td>
            <td style="text-align:center; border: 1px solid #000000; padding: 6px;"></td>
            <td style="text-align:center; border: 1px solid #000000; padding: 6px;">VN</td>
            <td style="border: 1px solid #000000; padding: 6px; text-align:center; font-weight:bold;">${singleRoomSurchargeText}</td>
            <td style="border: 1px solid #000000; padding: 6px; text-align:center; font-weight:bold; color:#f59e0b;"></td>
            <td style="border: 1px solid #000000; padding: 6px; font-size: 9pt; color:#475569;">
              ${noteText}
            </td>
          </tr>
        `;
      } else {
        orderPassengers.forEach((p, idx) => {
          const isLeader = p.full_name?.toLowerCase().includes('tour leader') || 
                           p.full_name?.toLowerCase().includes('leader');
          
          const isChild = p.full_name?.toLowerCase().includes('chd') || 
                          p.full_name?.toLowerCase().includes('child') ||
                          p.full_name?.toLowerCase().includes('trẻ em') ||
                          p.full_name?.toLowerCase().includes('tre em');
          
          let rowBg = '#ffffff';
          
          const dobStr = p.dob ? format(new Date(p.dob), 'dd/MM/yyyy') : '';
          const issueStr = p.passport_issue_date || '';
          const expiryStr = p.passport_expiry_date ? (p.passport_expiry_date.includes('-') ? format(new Date(p.passport_expiry_date), 'dd/MM/yyyy') : p.passport_expiry_date) : '';
          
          let visaLabel = '';
          if (p.visa_status === 'approved') visaLabel = 'Visa Available';
          else if (p.visa_status === 'processing') visaLabel = 'Processing';
          else if (p.visa_status === 'rejected') visaLabel = 'Rejected';
          else if (p.visa_status === 'not_required') visaLabel = 'No Visa Required';
          
          // Note column
          let noteParts: string[] = [];
          if (isLeader) noteParts.push('TOUR LEADER');
          if (isChild) noteParts.push('CHD');
          if (order.special_requests) noteParts.push(order.special_requests);
          const noteText = removeDiacritics(noteParts.join(' | ')).toUpperCase();

          rowHtml += `
            <tr style="background-color: ${rowBg};">
              <td style="text-align:center; border: 1px solid #000000; padding: 6px;">${no++}</td>
              <td style="text-align:center; border: 1px solid #000000; padding: 6px;">${p.gender || 'Mr'}</td>
              <td style="font-weight:bold; border: 1px solid #000000; padding: 6px; text-transform:uppercase;">${removeDiacritics(p.full_name || '').toUpperCase()}</td>
              <td style="text-align:center; border: 1px solid #000000; padding: 6px;">${dobStr}</td>
              <td style="text-align:center; border: 1px solid #000000; padding: 6px;">${p.phone || order.booker_phone || ''}</td>
              <td style="text-align:center; border: 1px solid #000000; padding: 6px; font-family: monospace;">${p.passport_number || ''}</td>
              <td style="text-align:center; border: 1px solid #000000; padding: 6px;">${issueStr}</td>
              <td style="text-align:center; border: 1px solid #000000; padding: 6px;">${expiryStr}</td>
              <td style="text-align:center; border: 1px solid #000000; padding: 6px;">${p.nationality || 'VN'}</td>
              <td style="border: 1px solid #000000; padding: 6px; text-align:center; font-weight:bold;">${singleRoomSurchargeText}</td>
              <td style="border: 1px solid #000000; padding: 6px; text-align:center; font-weight:bold;">${visaLabel}</td>
              <td style="border: 1px solid #000000; padding: 6px; font-size: 9pt; color:#475569;">
                ${noteText}
              </td>
            </tr>
          `;
        });
      }
    });

    const template = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <!--[if gte mso 9]>
      <xml>
      <x:ExcelWorkbook>
        <x:ExcelWorksheets>
          <x:ExcelWorksheet>
            <x:Name>DS_Hanh_Khach_Tour</x:Name>
            <x:WorksheetOptions>
              <x:DisplayGridlines/>
            </x:WorksheetOptions>
          </x:ExcelWorksheet>
        </x:ExcelWorksheets>
      </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
      <style>
        body, table, tr, td, th, div, span, h2 {
          font-family: 'Times New Roman', Times, serif !important;
        }
        table { border-collapse: collapse; }
        th { border: 1px solid #000000; font-weight: bold; text-align: center; font-size: 11pt; padding: 6px; }
        td { border: 1px solid #000000; padding: 5px; font-size: 10pt; }
        .header-main { background-color: #FEF08A; }
      </style>
      </head>
      <body>
        <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; font-weight: bold; margin-bottom: 5px; background-color: #FEF08A; padding: 5px; border: 1px solid #000000; display: inline-block;">
          FLIGHT OUT: ${selectedTour.flight_out || 'N/A'} &nbsp;|&nbsp; FLIGHT IN: ${selectedTour.flight_in || 'N/A'}
        </div>
        
        <h2 style="text-align:center; font-family: 'Times New Roman', Times, serif;">DANH SÁCH KHÁCH HÀNG - TOUR ${selectedTour.code}</h2>
        
        <table style="font-family: 'Times New Roman', Times, serif; margin-bottom: 10px; border: none;">
          <tr>
            <td style="border: none; padding: 2px;"><b>Tên tour:</b></td>
            <td style="border: none; padding: 2px;">${removeDiacritics(selectedTour.name).toUpperCase()}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 2px;"><b>Ngày khởi hành:</b></td>
            <td style="border: none; padding: 2px;">${selectedTour.start_date ? format(new Date(selectedTour.start_date), 'dd/MM/yyyy') : 'N/A'}</td>
            <td style="border: none; padding: 2px; padding-left: 20px;"><b>Ngày về:</b></td>
            <td style="border: none; padding: 2px;">${selectedTour.end_date ? format(new Date(selectedTour.end_date), 'dd/MM/yyyy') : 'N/A'}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 2px;"><b>Hãng hàng không:</b></td>
            <td style="border: none; padding: 2px;">${selectedTour.airline || 'N/A'}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 2px;"><b>GUEST:</b></td>
            <td style="border: none; padding: 2px;">${totalAdults} ADT ${totalChildren > 0 ? `; ${totalChildren} CHD` : ''} ${totalInfants > 0 ? `; ${totalInfants} INF` : ''}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 2px;"><b>TOTAL OF ROOMS:</b></td>
            <td style="border: none; padding: 2px;">${totalSingleRooms > 0 ? `${totalSingleRooms} SGL (Phu thu phong don)` : 'N/A'}</td>
          </tr>
        </table>
        <br/>
        <table style="font-family: 'Times New Roman', Times, serif;">
          <thead>
            <tr class="header-main" style="background-color: #FEF08A;">
              <th rowspan="2" style="background-color: #FEF08A; border: 1px solid #000000; padding: 8px;">NO</th>
              <th rowspan="2" style="background-color: #FEF08A; border: 1px solid #000000; padding: 8px;">SEX</th>
              <th rowspan="2" style="background-color: #FEF08A; border: 1px solid #000000; padding: 8px; width: 250px;">FULLNAME</th>
              <th rowspan="2" style="background-color: #FEF08A; border: 1px solid #000000; padding: 8px; width: 100px;">DOB</th>
              <th rowspan="2" style="background-color: #FEF08A; border: 1px solid #000000; padding: 8px; width: 120px;">PHONE</th>
              <th colspan="4" style="background-color: #FEF08A; border: 1px solid #000000; padding: 8px; text-align:center;">PASSPORT INFORMATION</th>
              <th rowspan="2" style="background-color: #FEF08A; border: 1px solid #000000; padding: 8px; width: 150px;">ROOM</th>
              <th rowspan="2" style="background-color: #FEF08A; border: 1px solid #000000; padding: 8px; width: 120px;">VISA STATUS</th>
              <th rowspan="2" style="background-color: #FEF08A; border: 1px solid #000000; padding: 8px; width: 300px;">NOTE</th>
            </tr>
            <tr class="header-main" style="background-color: #FEF08A;">
              <th style="background-color: #FEF08A; border: 1px solid #000000; padding: 8px; width: 120px;">NO.PP</th>
              <th style="background-color: #FEF08A; border: 1px solid #000000; padding: 8px; width: 100px;">DOI</th>
              <th style="background-color: #FEF08A; border: 1px solid #000000; padding: 8px; width: 100px;">DOE</th>
              <th style="background-color: #FEF08A; border: 1px solid #000000; padding: 8px; width: 80px;">NA</th>
            </tr>
          </thead>
          <tbody>
            ${rowHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + template], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DANH_SACH_KHACH_${selectedTour.code}_${format(new Date(), 'ddMMyyyy_HHmm')}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Metrics
  const { holdSeats, sureSeats, upcomingTours, upcomingTicketTours, upcomingVisaTours } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let hold = 0;
    let sure = 0;

    orders.forEach(o => {
      const tour = tours.find(t => t.id === o.tour_id);
      if (tour?.tour_type === 'visa') return; // Exclude visa services
      if (selectedDestination !== 'all' && tour?.destination !== selectedDestination) return;

      const seats = (o.adult_count || 0) + (o.child_count || 0);

      if (o.status === 'hold') hold += seats;
      if (o.status === 'sure' || o.status === 'paid') sure += seats;
    });

    const upcoming = tours.filter(t => {
      if (t.tour_type === 'visa') return false; // Exclude visa services
      if (selectedDestination !== 'all' && t.destination !== selectedDestination) return false;
      if (!t.start_date) return false;
      const start = new Date(t.start_date);
      const diff = differenceInDays(start, today);
      return diff >= 0 && diff <= daysFilter;
    }).sort((a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime());

    const upcomingTickets = tours.filter(t => {
      if (t.tour_type === 'visa') return false; // Exclude visa services
      if (selectedDestination !== 'all' && t.destination !== selectedDestination) return false;
      if (!t.start_date) return false;
      const start = new Date(t.start_date);
      const tourStartDiff = differenceInDays(start, today);
      if (tourStartDiff < 0) return false; // Exclude already departed tours

      const deadline = t.ticket_deadline ? new Date(t.ticket_deadline) : start;
      const diff = differenceInDays(deadline, today);

      return (t.ticket_status === 'CHỜ XUẤT VÉ' || !t.ticket_status) && diff <= daysFilter;
    }).sort((a, b) => {
      const deadlineA = a.ticket_deadline ? new Date(a.ticket_deadline) : new Date(a.start_date!);
      const deadlineB = b.ticket_deadline ? new Date(b.ticket_deadline) : new Date(b.start_date!);
      return deadlineA.getTime() - deadlineB.getTime();
    });

    const upcomingVisas = tours.filter(t => {
      if (t.tour_type === 'visa') return false; // Exclude visa services
      if (selectedDestination !== 'all' && t.destination !== selectedDestination) return false;
      if (!t.visa_deadline) return false;
      const deadline = new Date(t.visa_deadline);
      const diff = differenceInDays(deadline, today);
      // Ensure the tour hasn't departed yet
      const start = t.start_date ? new Date(t.start_date) : new Date();
      const tourStartDiff = differenceInDays(start, today);
      return tourStartDiff >= 0 && diff <= daysFilter; 
    }).sort((a, b) => new Date(a.visa_deadline!).getTime() - new Date(b.visa_deadline!).getTime());

    return {
      holdSeats: hold,
      sureSeats: sure,
      upcomingTours: upcoming,
      upcomingTicketTours: upcomingTickets,
      upcomingVisaTours: upcomingVisas
    };
  }, [tours, orders, daysFilter, selectedDestination]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Detailed Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Bộ lọc chi tiết:</span>
        </div>
        
        <select
          value={daysFilter}
          onChange={(e) => setDaysFilter(Number(e.target.value))}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={7}>Trong vòng 7 ngày tới</option>
          <option value={15}>Trong vòng 15 ngày tới</option>
          <option value={30}>Trong vòng 30 ngày tới</option>
          <option value={60}>Trong vòng 60 ngày tới</option>
        </select>

        <select
          value={selectedDestination}
          onChange={(e) => setSelectedDestination(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Tất cả điểm đến</option>
          {destinationsList.map(dest => (
            <option key={dest} value={dest}>{dest}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sắp khởi hành */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="bg-blue-50 p-4 border-b border-blue-100 flex items-center justify-between">
            <h3 className="font-bold text-blue-800 flex items-center gap-2">
              <PlaneTakeoff className="w-5 h-5" />
              Sắp khởi hành
            </h3>
            <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">{upcomingTours.length} tour</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[400px]">
            {upcomingTours.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Không có tour nào sắp khởi hành</p>
            ) : (
              <div className="space-y-4">
                {upcomingTours.map(t => (
                  <div key={t.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0 hover:bg-slate-50/50 p-1.5 rounded-lg transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-bold text-sm text-gray-900 cursor-pointer hover:text-blue-600 font-mono bg-blue-50/50 px-1.5 py-0.5 rounded border border-blue-100" onClick={() => { setSelectedTour(t); setShowPassengersModal(true); }}>{t.code}</p>
                      <p className="text-xs font-bold text-gray-500">{format(new Date(t.start_date!), 'dd/MM/yyyy')}</p>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-1 cursor-pointer hover:text-blue-600" onClick={() => { setSelectedTour(t); setShowPassengersModal(true); }}>{t.name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 cursor-pointer" onClick={() => { setSelectedTour(t); setShowPassengersModal(true); }}>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Bán: {t.sold_seats}/{t.total_seats}</span>
                      <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">Hold: {t.hold_seats}</span>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">Trống: {Math.max(0, t.total_seats - t.sold_seats - t.hold_seats)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chờ xuất vé */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="bg-purple-50 p-4 border-b border-purple-100 flex items-center justify-between">
            <h3 className="font-bold text-purple-800 flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              Sắp tới ngày xuất vé
            </h3>
            <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-1 rounded-full">{upcomingTicketTours.length} tour</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[400px]">
            {upcomingTicketTours.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Không có tour nào chờ xuất vé</p>
            ) : (
              <div className="space-y-4">
                {upcomingTicketTours.map(t => {
                  const deadline = t.ticket_deadline ? new Date(t.ticket_deadline) : null;
                  const daysLeft = deadline ? differenceInDays(deadline, new Date()) : null;
                  const isUrgent = daysLeft !== null && daysLeft <= 3;
                  
                  return (
                  <div key={t.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0 hover:bg-slate-50/50 p-1.5 rounded-lg transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-bold text-sm text-gray-900 cursor-pointer hover:text-purple-600 font-mono bg-purple-50/50 px-1.5 py-0.5 rounded border border-purple-100" onClick={() => { setSelectedTour(t); setShowPassengersModal(true); }}>{t.code}</p>
                      <p className="text-xs font-bold text-gray-500">KH: {format(new Date(t.start_date!), 'dd/MM/yyyy')}</p>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-1 cursor-pointer hover:text-purple-600" onClick={() => { setSelectedTour(t); setShowPassengersModal(true); }}>{t.name}</p>
                    <div className="mt-2 space-y-1.5 cursor-pointer" onClick={() => { setSelectedTour(t); setShowPassengersModal(true); }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md font-bold uppercase">{t.ticket_status || 'Chờ xuất vé'}</span>
                        {t.airline && <span className="text-[10px] text-gray-500 font-medium">Hãng bay: {t.airline}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {t.ticket_deadline && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isUrgent ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-gray-100 text-gray-700'}`}>
                            Hạn vé: {format(new Date(t.ticket_deadline), 'dd/MM/yyyy')}
                          </span>
                        )}
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Bán: {t.sold_seats}/{t.total_seats}</span>
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">Trống: {Math.max(0, t.total_seats - t.sold_seats - t.hold_seats)}</span>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>
        </div>

        {/* Deadline Visa */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="bg-rose-50 p-4 border-b border-rose-100 flex items-center justify-between">
            <h3 className="font-bold text-rose-800 flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Sắp tới hạn Visa
            </h3>
            <span className="text-xs font-semibold text-rose-600 bg-rose-100 px-2 py-1 rounded-full">{upcomingVisaTours.length} tour</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[400px]">
            {upcomingVisaTours.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Không có deadline visa nào sắp tới</p>
            ) : (
              <div className="space-y-4">
                {upcomingVisaTours.map(t => {
                  const deadline = new Date(t.visa_deadline!);
                  const daysLeft = differenceInDays(deadline, new Date());
                  const isUrgent = daysLeft <= 3;
                  
                  return (
                    <div key={t.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0 hover:bg-slate-50/50 p-1.5 rounded-lg transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-bold text-sm text-gray-900 cursor-pointer hover:text-rose-600 font-mono bg-rose-50/50 px-1.5 py-0.5 rounded border border-rose-100" onClick={() => { setSelectedTour(t); setShowPassengersModal(true); }}>{t.code}</p>
                        <p className={`text-xs font-bold ${isUrgent ? 'text-red-600 animate-pulse' : 'text-gray-500'}`}>
                          Hạn: {format(deadline, 'dd/MM/yyyy')}
                        </p>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-1 cursor-pointer hover:text-rose-600" onClick={() => { setSelectedTour(t); setShowPassengersModal(true); }}>{t.name}</p>
                      <div className="mt-2 flex items-center gap-2 cursor-pointer" onClick={() => { setSelectedTour(t); setShowPassengersModal(true); }}>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${isUrgent ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                          {daysLeft === 0 ? 'Hôm nay' : daysLeft < 0 ? 'Quá hạn' : `Còn ${daysLeft} ngày`}
                        </span>
                        {t.visa_country && <span className="text-[10px] text-gray-500">Visa: {t.visa_country}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL DANH SÁCH HÀNH KHÁCH ĐÃ BÁN */}
      {showPassengersModal && selectedTour && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-blue-900">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="bg-blue-900/60 text-yellow-300 font-mono font-black text-xs px-2.5 py-1 rounded-full border border-blue-500/30">
                    {selectedTour.code}
                  </span>
                  <span className="text-sm text-blue-100 font-medium">| Lịch khởi hành: {selectedTour.start_date ? format(new Date(selectedTour.start_date), 'dd/MM/yyyy') : 'N/A'}</span>
                </div>
                <h3 className="text-lg md:text-xl font-bold tracking-tight text-white line-clamp-1">{selectedTour.name}</h3>
                <p className="text-xs text-blue-100 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {selectedTour.airline && <span>✈️ Hãng bay: <strong className="text-white">{selectedTour.airline}</strong></span>}
                  <span>👥 Chỗ bán: <strong className="text-white">{selectedTour.sold_seats}/{selectedTour.total_seats}</strong></span>
                  <span>⏳ Đang giữ (Hold): <strong className="text-white">{selectedTour.hold_seats || 0}</strong></span>
                  <span>🟢 Chỗ còn lại: <strong className="text-white">{Math.max(0, (selectedTour.total_seats || 0) - (selectedTour.sold_seats || 0) - (selectedTour.hold_seats || 0))}</strong></span>
                </p>
              </div>

              <div className="flex items-center gap-2.5 self-stretch md:self-auto shrink-0">
                <button
                  onClick={handleExportExcel}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm px-4.5 py-2.5 rounded-xl shadow-lg shadow-emerald-900/20 transition-all cursor-pointer border border-emerald-500/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Xuất Excel chuẩn</span>
                </button>
                <button
                  onClick={() => {
                    setShowPassengersModal(false);
                    setSelectedTour(null);
                    setModalSearchTerm('');
                  }}
                  className="p-2.5 bg-blue-900/40 hover:bg-blue-900/60 text-blue-100 hover:text-white rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-bar / Search */}
            <div className="p-4 bg-slate-50 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm hành khách, SĐT, hộ chiếu, mã ĐH..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                {modalSearchTerm && (
                  <button onClick={() => setModalSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="text-xs text-gray-500 font-medium">
                Tìm thấy <span className="text-blue-600 font-bold">{filteredModalPassengers.length}</span> hành khách phù hợp
              </div>
            </div>

            {/* Table Area */}
            <div className="p-5 overflow-y-auto flex-1 bg-white">
              {filteredModalPassengers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm font-medium">Chưa có hành khách nào được bán hoặc không tìm thấy hành khách khớp bộ lọc</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-gray-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-3 text-center w-12 border-r border-gray-200">NO</th>
                        <th className="py-3 px-3 w-16 text-center border-r border-gray-200">SEX</th>
                        <th className="py-3 px-4 w-56 border-r border-gray-200">FULLNAME</th>
                        <th className="py-3 px-4 w-32 border-r border-gray-200">Mã đơn hàng</th>
                        <th className="py-3 px-4 w-40 border-r border-gray-200">Sale/CTV</th>
                        <th className="py-3 px-3 w-28 text-center border-r border-gray-200">Phòng đơn</th>
                        <th className="py-3 px-4 w-52 border-r border-gray-200">Ghi chú</th>
                        <th className="py-3 px-3 w-36 text-center">Tình trạng Visa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150">
                      {filteredModalPassengers.map((item, idx) => {
                        const { passenger, order } = item;
                        
                        const orderIdx = tourData.ordersList.findIndex(o => o.id === order.id);
                        const isEvenOrder = orderIdx % 2 === 0;
                        
                        const isLeader = passenger?.full_name?.toLowerCase().includes('tour leader') || 
                                         passenger?.full_name?.toLowerCase().includes('leader') ||
                                         order?.special_requests?.toLowerCase().includes('tour leader') ||
                                         order?.special_requests?.toLowerCase().includes('leader');
                        
                        const isChild = passenger?.full_name?.toLowerCase().includes('chd') || 
                                        passenger?.full_name?.toLowerCase().includes('child') ||
                                        passenger?.full_name?.toLowerCase().includes('trẻ em') ||
                                        order?.special_requests?.toLowerCase().includes('chd');
                        
                        let bgClass = isEvenOrder ? 'bg-white' : 'bg-slate-50/60';
                        if (isLeader) bgClass = 'bg-yellow-100/70 text-amber-900 border-l-4 border-l-amber-500';
                        else if (isChild) bgClass = 'bg-emerald-50/80 text-emerald-900 border-l-4 border-l-emerald-500';

                        let visaBadge = (
                          <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-200">
                            Chưa có
                          </span>
                        );
                        if (passenger?.visa_status === 'approved') {
                          visaBadge = (
                            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                              Đã duyệt
                            </span>
                          );
                        } else if (passenger?.visa_status === 'processing') {
                          visaBadge = (
                            <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                              Đang xử lý
                            </span>
                          );
                        } else if (passenger?.visa_status === 'rejected') {
                          visaBadge = (
                            <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200">
                              Từ chối
                            </span>
                          );
                        } else if (passenger?.visa_status === 'not_required') {
                          visaBadge = (
                            <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                              Miễn visa
                            </span>
                          );
                        }

                        return (
                          <tr key={`${order.id}-${passenger?.id || idx}`} className={`${bgClass} hover:brightness-95 transition-all`}>
                            <td className="py-3 px-3 text-center border-r border-gray-200/50 font-medium text-gray-500">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3 text-center border-r border-gray-200/50 font-bold text-gray-600 uppercase">
                              {passenger?.gender || 'Mr'}
                            </td>
                            <td className="py-3 px-4 border-r border-gray-200/50">
                              <div className="font-bold text-gray-950 uppercase tracking-tight">
                                {passenger?.full_name || order.booker_name || 'Khách đại diện'}
                              </div>
                              {passenger?.phone && (
                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">📞 {passenger.phone}</div>
                              )}
                              {passenger?.dob && (
                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">🎂 {format(new Date(passenger.dob), 'dd/MM/yyyy')}</div>
                              )}
                            </td>
                            <td className="py-3 px-4 border-r border-gray-200/50">
                              <span className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[11px] border border-blue-100 font-bold">
                                {order.id ? order.id.substring(0, 8).toUpperCase() : ''}
                              </span>
                              <div className="text-[10px] text-gray-400 mt-1 font-mono">{format(new Date(order.created_at), 'dd/MM/yyyy')}</div>
                            </td>
                            <td className="py-3 px-4 border-r border-gray-200/50 font-semibold text-gray-800">
                              {order.created_by || 'Chưa rõ'}
                            </td>
                            <td className="py-3 px-3 text-center border-r border-gray-200/50 font-medium text-gray-700">
                              {order.single_room_count > 0 ? (
                                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 font-bold text-[11px]">
                                  Có ({order.single_room_count} phòng)
                                </span>
                              ) : (
                                <span className="text-gray-400">Không</span>
                              )}
                            </td>
                            <td className="py-3 px-4 border-r border-gray-200/50 text-xs text-gray-600 italic">
                              {order.special_requests || order.room_share_info || 'Không có ghi chú'}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {visaBadge}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer removed per user request */}
          </div>
        </div>
      )}
    </div>
  );
}
