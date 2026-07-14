import toast from 'react-hot-toast';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Tour, Order, Passenger, Role, User, TourStatus, MembershipSettings } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const idMap: { [key: string]: string } = {
  '1': 'a809b4db-9ee7-4c07-b352-09419106093d',
  '2': '1a3df3bf-7cf9-42b7-a8a2-f90b9b3df985',
  '3': 'f920875c-75b2-4d22-841c-b71524317181',
  'O-1001': 'b7c15234-a12f-48d6-9cb3-b26a64235fb6',
  'O-1002': 'd6b88019-354a-4e2b-bbbf-f3a38612140c',
  'P-101': 'c2b81234-8c8d-4cb5-8025-a1c23df7a6b1',
  'P-102': 'd4e32152-7cb1-432d-96fb-c3214da8fb2c',
  'P-103': 'f3c834a3-7cfd-4a1b-9aef-cf23bd72a6b2',
  'N-1': 'e1234567-89ab-cdef-0123-456789abcdef',
  'N-2': 'f1234567-89ab-cdef-0123-456789abcdef'
};

const generateSafeUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // fallback
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

function toUuid(id: string): string {
  if (!id) return generateSafeUUID();
  if (idMap[id]) return idMap[id];
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;
  const newUuid = generateSafeUUID();
  idMap[id] = newUuid;
  return newUuid;
}

function isSupabaseConfigured(): boolean {
  const url = (import.meta as any).env.VITE_SUPABASE_URL;
  const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
  return !!(url && !url.includes('placeholder') && key && !key.includes('placeholder'));
}

export interface Notification {
  id: string;
  type: 'visa' | 'accounting' | 'extension';
  title: string;
  message: string;
  targetId: string; // ID of order or passenger
  createdAt: string;
  read: boolean;
}

interface CRMContextType {
  tours: Tour[];
  orders: Order[];
  passengers: Passenger[];
  notifications: Notification[];
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  categories: string[];
  addCategory: (category: string) => void;
  deleteCategory: (category: string) => void;
  updateCategory: (oldCategory: string, newCategory: string) => void;
  addTour: (tour: Omit<Tour, 'id' | 'sold_seats' | 'hold_seats' | 'available_seats' | 'seat_status'>) => void;
  updateTour: (tour: Tour) => void;
  deleteTour: (tourId: string) => void;
  createOrder: (orderData: {
    tour_id: string;
    status: 'hold' | 'sure';
    total_price?: number;
    adult_price: number;
    passengers?: Omit<Passenger, 'id' | 'order_id' | 'visa_status'>[];
    booker_name?: string;
    booker_phone?: string;
    created_by?: string;
    user_id?: string;
    adult_count?: number;
    child_count?: number;
    infant_count?: number;
    single_room_count?: number;
    room_share_info?: string;
    vat_option?: string;
    special_requests?: string;
  }) => void;
  confirmOrder: (orderId: string, passengersData: Omit<Passenger, 'id' | 'order_id' | 'visa_status'>[]) => void;
  cancelOrder: (orderId: string) => void;
  requestExtension: (orderId: string, hours: number) => void;
  handleExtensionRequest: (orderId: string, approve: boolean) => void;
  updateVisaStatus: (passengerId: string, status: Passenger['visa_status'], reason?: string) => void;
  updatePassenger: (passengerId: string, updatedData: Partial<Passenger>) => void;
  deletePassenger: (passengerId: string) => void;
  addPassengersToOrder: (orderId: string, passengersData: Omit<Passenger, 'id' | 'order_id' | 'visa_status'>[]) => void;
  updateOrder: (orderId: string, updatedData: Partial<Order>) => void;
  updateInvoiceStatus: (orderId: string, status: Order['invoice_status']) => void;
  releaseExpiredHolds: () => void;
  membershipSettings: MembershipSettings;
  updateMembershipSettings: (settings: MembershipSettings) => void;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

const INITIAL_TOURS: Tour[] = [
  {
    id: '1',
    code: 'THAILAN-VN-5D-ART-VN-260701',
    name: '[SÀI GÒN] THÁI LAN: BANGKOK - PATTAYA - NONG NOOCH - ART',
    duration: '5 ngày 4 đêm',
    departure_time: '2026-07-15T08:00:00Z',
    return_time: '2026-07-19T20:00:00Z',
    airline: 'Vietnam Airlines',
    hotel: 'Khách sạn 4*',
    price: 8490000,
    destination: 'Thái Lan',
    start_date: '2026-07-15',
    end_date: '2026-07-19',
    commission: 600000,
    total_seats: 30,
    sold_seats: 25,
    hold_seats: 2,
    available_seats: 3,
    seat_status: 'Còn chỗ',
    flight_out: 'VN607 SGN BKK 16:50 - 18:30',
    flight_out_transit: '',
    flight_in: 'VN606 BKK SGN 19:30 - 21:15',
    flight_in_transit: '',
    transit_info: '',
    guide_name: 'PHẠM VĂN THÁI',
    guide_phone: '0903.391.831',
    ticket_status: 'ĐÃ CHỐT XUẤT VÉ',
    visa_deadline: '2026-07-05T00:00:00Z',
    description: 'Chương trình du lịch chất lượng cao, bao gồm buffet nhà hàng xoay 86 tầng Baiyoke Sky.',
    tour_status: 'on_sale',
    category: 'Du lịch Đông Nam Á',
    hold_duration_hours: 48,
  },
  {
    id: '2',
    code: 'LAO-MF-5N4D-VJ-260701',
    name: '[SÀI GÒN] LÀO: VIENTIANE - LUANG PRABANG - MEUNG FEUANG',
    duration: '5 ngày 4 đêm',
    departure_time: '2026-07-20T08:00:00Z',
    return_time: '2026-07-24T20:00:00Z',
    airline: 'Vietjet Air',
    hotel: 'Khách sạn 4*-5*',
    price: 13990000,
    destination: 'Lào',
    start_date: '2026-07-20',
    end_date: '2026-07-24',
    commission: 700000,
    total_seats: 20,
    sold_seats: 8,
    hold_seats: 4,
    available_seats: 8,
    seat_status: 'Còn chỗ',
    flight_out: 'VJ1831 SGN - VTE 16:25 - 17:45',
    flight_out_transit: '',
    flight_in: 'VJ1832 VTE - SGN 19:10 - 20:45',
    flight_in_transit: '',
    transit_info: '',
    guide_name: 'NGÔ GIA TỊNH',
    guide_phone: '039.830.9461',
    ticket_status: 'ĐÃ XUẤT VÉ',
    visa_deadline: '2026-07-10T00:00:00Z',
    description: 'Trải nghiệm văn hóa tâm linh độc đáo, lễ khất thực tại Luang Prabang.',
    tour_status: 'available',
    category: 'Du lịch Đông Nam Á',
    hold_duration_hours: 24,
  },
  {
    id: '3',
    code: 'EU-QR-11D10N-260701',
    name: '[SÀI GÒN] CHÂU ÂU: PHÁP - THỤY SĨ - Ý - VATICAN',
    duration: '11 ngày 10 đêm',
    departure_time: '2026-08-10T19:55:00Z',
    return_time: '2026-08-21T14:25:00Z',
    airline: 'Qatar Airways',
    hotel: 'Khách sạn 4*',
    price: 65900000,
    destination: 'Châu Âu',
    start_date: '2026-08-10',
    end_date: '2026-08-21',
    commission: 3000000,
    total_seats: 25,
    sold_seats: 24,
    hold_seats: 1,
    available_seats: 0,
    seat_status: 'Hết chỗ',
    flight_out: 'QR971 SGN - DOH 19:55 - 23:25',
    flight_out_transit: 'QR039 DOH - CDG 01:25 - 07:25',
    flight_in: 'QR116 FCO - DOH 16:35 - 23:10',
    flight_in_transit: 'QR970 DOH - SGN 02:35 - 14:25',
    transit_info: 'Quá cảnh tại Doha (DOH)',
    guide_name: 'TRẦN VĂN A',
    guide_phone: '0901.234.567',
    ticket_status: 'CHỜ XUẤT VÉ',
    visa_deadline: '2026-07-10T00:00:00Z',
    description: 'Hành trình khám phá Tây-Nam Âu cổ kính. Yêu cầu visa Schengen.',
    tour_status: 'last_minute',
    category: 'Du lịch Châu Âu',
    hold_duration_hours: 12,
  }
];

function sanitizePassengers(rawPassengers: Passenger[], rawOrders: Order[]): Passenger[] {
  if (!rawPassengers || rawPassengers.length === 0) return [];
  
  // Group passengers by order_id
  const passengersByOrder: { [orderId: string]: Passenger[] } = {};
  rawPassengers.forEach(p => {
    if (!p.order_id) return;
    if (!passengersByOrder[p.order_id]) {
      passengersByOrder[p.order_id] = [];
    }
    passengersByOrder[p.order_id].push(p);
  });

  const sanitized: Passenger[] = [];

  // For passengers without an order_id (if any)
  rawPassengers.forEach(p => {
    if (!p.order_id) {
      sanitized.push(p);
    }
  });

  // For each order's passengers
  Object.keys(passengersByOrder).forEach(orderId => {
    const list = passengersByOrder[orderId];
    const order = rawOrders.find(o => o.id === orderId);

    if (order && order.status === 'sure') {
      // 1. Identify which passengers are placeholders
      const isPlaceholder = (p: Passenger) => {
        const name = (p.full_name || p.name || '').trim();
        return (
          name === 'Chưa cung cấp (Giữ chỗ tạm)' ||
          name === 'Chưa cung cấp' ||
          name.startsWith('Người lớn #') ||
          name.startsWith('Trẻ em #') ||
          name.startsWith('Trẻ nhỏ #')
        );
      };

      const realPassengers = list.filter(p => !isPlaceholder(p));

      // If we have real passengers, we should completely discard placeholders
      let filteredList = list;
      if (realPassengers.length > 0) {
        filteredList = realPassengers;
      }

      // 2. Deduplicate identical passengers
      // We will keep unique ones based on a key: full_name + dob + passport_number
      const uniqueMap = new Map<string, Passenger>();
      filteredList.forEach(p => {
        const name = (p.full_name || p.name || '').trim().toUpperCase();
        const dob = (p.dob || '').trim();
        const passport = (p.passport_number || '').trim().toUpperCase();
        // Create a unique key
        const key = `${name}|${dob}|${passport}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, p);
        }
      });

      sanitized.push(...Array.from(uniqueMap.values()));
    } else {
      // For non-sure orders, just keep them but avoid exact key/ID duplicates if any
      const uniqueMap = new Map<string, Passenger>();
      list.forEach(p => {
        const name = (p.full_name || p.name || '').trim().toUpperCase();
        const dob = (p.dob || '').trim();
        const passport = (p.passport_number || '').trim().toUpperCase();
        const key = `${p.id || ''}|${name}|${dob}|${passport}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, p);
        }
      });
      sanitized.push(...Array.from(uniqueMap.values()));
    }
  });

  return sanitized;
}

export const CRMProvider: React.FC<{ children: React.ReactNode; initialRole?: Role }> = ({ children, initialRole = 'admin' }) => {
  const { user, profile } = useAuth();
  const [tours, setTours] = useState<Tour[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [membershipSettings, setMembershipSettings] = useState<MembershipSettings>({
    silverMin: 20000000,
    goldMin: 50000000,
    platinumMin: 100000000
  });
  const [currentRole, setCurrentRole] = useState<Role>(initialRole);

  useEffect(() => {
    setCurrentRole(initialRole);
  }, [initialRole]);

  // Load Initial Data (either from Supabase or Fallback to LocalStorage)
  useEffect(() => {
    const loadCRMData = async () => {
      if (isSupabaseConfigured()) {
        console.log('Cấu hình Supabase hợp lệ, đang tải dữ liệu...');
        
        // 1. Tours
        let fetchedTours: Tour[] = [];
        try {
          const { data: toursData, error: toursErr } = await supabase.from('tours').select('*');
          if (toursErr) throw toursErr;
          
          if (toursData && toursData.length > 0) {
            fetchedTours = toursData.map(t => ({
              id: t.id,
              code: t.code,
              name: t.name,
              duration: t.duration,
              price: Number(t.price),
              total_seats: Number(t.total_seats),
              sold_seats: Number(t.sold_seats || 0),
              hold_seats: Number(t.hold_seats || 0),
              available_seats: Number(t.available_seats !== undefined ? t.available_seats : t.total_seats),
              seat_status: t.seat_status || 'Còn chỗ',
              departure_time: t.departure_time || t.departure_date,
              return_time: t.return_time,
              airline: t.airline,
              hotel: t.hotel,
              commission: Number(t.commission || 0),
              flight_out: t.flight_out,
              flight_out_transit: t.flight_out_transit,
              flight_in: t.flight_in,
              flight_in_transit: t.flight_in_transit,
              transit_info: t.transit_info,
              guide_name: t.guide_name,
              guide_phone: t.guide_phone,
              ticket_status: t.ticket_status,
              visa_deadline: t.visa_deadline,
              description: t.description,
              tour_status: t.tour_status,
              category: t.category,
              hold_duration_hours: Number(t.hold_duration_hours || 48),
              overbook_limit: Number(t.overbook_limit || 0),
              price_adult: Number(t.price_adult !== undefined ? t.price_adult : (t.price || 0)),
              price_child: Number(t.price_child || 0),
              price_infant: Number(t.price_infant || 0),
              single_room_surcharge: Number(t.single_room_surcharge || 0),
              itinerary_pdf_url: t.itinerary_pdf_url,
              notice_sections: t.notice_sections,
              tour_type: t.tour_type || 'internal',
              partner_name: t.partner_name,
              partner_contact: t.partner_contact,
              organization_name: t.organization_name,
              group_leader_contact: t.group_leader_contact,
              custom_requirements: t.custom_requirements,
              visa_country: t.visa_country,
              visa_service_type: t.visa_service_type,
              visa_speed: t.visa_speed,
              destination: t.destination || t.category || 'Chưa xác định',
              price_visa_tour: Number(t.price_visa_tour || 0),
              start_date: t.start_date || (t.departure_time ? t.departure_time.substring(0, 10) : ''),
              end_date: t.end_date || (t.return_time ? t.return_time.substring(0, 10) : ''),
              status: t.status
            }));
            setTours(fetchedTours);
            console.log('Đã nạp thành công Tours từ Supabase');
          } else {
            // Seed tours
            const seeded = INITIAL_TOURS.map(t => ({ ...t, id: toUuid(t.id) }));
            for (const t of seeded) {
              try {
                await supabase.from('tours').insert({
                  id: t.id,
                  code: t.code,
                  name: t.name,
                  duration: t.duration,
                  price: Number(t.price),
                  total_seats: Number(t.total_seats),
                  available_seats: Number(t.available_seats),
                  status: t.tour_status || 'available',
                  departure_date: t.departure_time ? t.departure_time.substring(0, 10) : new Date().toISOString().substring(0, 10),
                  departure_time: t.departure_time,
                  return_time: t.return_time,
                  airline: t.airline,
                  hotel: t.hotel,
                  commission: Number(t.commission || 0),
                  sold_seats: Number(t.sold_seats || 0),
                  hold_seats: Number(t.hold_seats || 0),
                  seat_status: t.seat_status || 'Còn chỗ',
                  flight_out: t.flight_out,
                  flight_out_transit: t.flight_out_transit,
                  flight_in: t.flight_in,
                  flight_in_transit: t.flight_in_transit,
                  transit_info: t.transit_info,
                  guide_name: t.guide_name,
                  guide_phone: t.guide_phone,
                  ticket_status: t.ticket_status,
                  visa_deadline: t.visa_deadline,
                  description: t.description,
                  category: t.category,
                  hold_duration_hours: Number(t.hold_duration_hours || 48),
                  overbook_limit: Number(t.overbook_limit || 0),
                  price_adult: Number(t.price_adult || t.price || 0),
                  price_child: Number(t.price_child || 0),
                  price_infant: Number(t.price_infant || 0),
                  single_room_surcharge: Number(t.single_room_surcharge || 0),
                  itinerary_pdf_url: t.itinerary_pdf_url,
                  notice_sections: t.notice_sections,
                  tour_status: t.tour_status || 'available',
                  destination: t.destination || t.category || 'Chưa xác định',
                  price_visa_tour: Number(t.price_visa_tour || 0),
                  start_date: t.start_date || (t.departure_time ? t.departure_time.substring(0, 10) : new Date().toISOString().substring(0, 10)),
                  end_date: t.end_date || (t.return_time ? t.return_time.substring(0, 10) : new Date().toISOString().substring(0, 10)),
                  tour_type: t.tour_type || 'internal',
                  visa_country: t.visa_country,
                  visa_service_type: t.visa_service_type,
                  visa_speed: t.visa_speed
                });
              } catch (seedErr) {
                console.warn('Lưu ý khi chèn dữ liệu mẫu Tours lên Supabase:', seedErr);
              }
            }
            setTours(seeded);
            fetchedTours = seeded;
            console.log('Đã nạp dữ liệu mẫu Tours (do bảng trống trên Supabase)');
          }
        } catch (err) {
          console.warn('Lỗi khi tải Tours từ Supabase (sử dụng fallback local):', err);
          const savedTours = localStorage.getItem('crm_tours');
          fetchedTours = savedTours ? JSON.parse(savedTours) : INITIAL_TOURS;
          setTours(fetchedTours);
        }

        // 2. Bookings
        let fetchedOrders: Order[] = [];
        try {
          const { data: bookingsData, error: bookingsErr } = await supabase.from('bookings').select('*');
          if (bookingsErr) throw bookingsErr;
 
          if (bookingsData && bookingsData.length > 0) {
            fetchedOrders = bookingsData.map(b => ({
              id: b.id,
              tour_id: b.tour_id,
              customer_id: b.customer_id,
              salesperson_id: b.salesperson_id,
              created_by: b.created_by,
              user_id: b.user_id,
              status: b.status,
              hold_expiry: b.hold_expiry,
              invoice_status: b.invoice_status || 'pending',
              total_price: Number(b.total_amount),
              created_at: b.created_at,
              extension_status: b.extension_status || 'none',
              extension_hours: Number(b.extension_hours || 0),
              is_extended: b.is_extended || false,
              booker_name: b.booker_name,
              booker_phone: b.booker_phone,
              adult_count: b.adult_count,
              child_count: b.child_count,
              infant_count: b.infant_count,
              single_room_count: b.single_room_count,
              room_share_info: b.room_share_info,
              vat_option: b.vat_option,
              special_requests: b.special_requests
            }));
            setOrders(fetchedOrders);
            console.log('Đã nạp thành công Bookings từ Supabase');
          } else {
            const seededOrders: Order[] = [
              {
                id: toUuid('O-1001'),
                tour_id: toUuid('1'),
                created_by: 'Sale Nguyễn',
                status: 'sure',
                invoice_status: 'pending',
                total_price: 16980000,
                created_at: new Date(Date.now() - 2 * 3600000).toISOString()
              },
              {
                id: toUuid('O-1002'),
                tour_id: toUuid('2'),
                created_by: 'Đại lý Việt Travel',
                status: 'hold',
                hold_expiry: new Date(Date.now() + 18 * 3600000).toISOString(),
                invoice_status: 'pending',
                total_price: 27980000,
                created_at: new Date().toISOString(),
                extension_status: 'none'
              }
            ] as any;

            for (const o of seededOrders) {
              try {
                await supabase.from('bookings').insert({
                  id: o.id,
                  tour_id: o.tour_id,
                  booking_date: o.created_at ? o.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10),
                  status: o.status,
                  total_amount: Number(o.total_price),
                  payment_status: o.status === 'paid' ? 'paid' : 'pending',
                  seats: Number((o.adult_count || 1) + (o.child_count || 0)),
                  created_by: o.created_by,
                  user_id: o.user_id,
                  hold_expiry: o.hold_expiry,
                  invoice_status: o.invoice_status || 'pending',
                  extension_status: o.extension_status || 'none',
                  extension_hours: Number(o.extension_hours || 0),
                  is_extended: o.is_extended || false,
                  booker_name: o.booker_name,
                  booker_phone: o.booker_phone,
                  adult_count: o.adult_count || 1,
                  child_count: o.child_count || 0,
                  infant_count: o.infant_count || 0,
                  single_room_count: o.single_room_count || 0,
                  room_share_info: o.room_share_info,
                  vat_option: o.vat_option || 'no_vat',
                  special_requests: o.special_requests
                });
              } catch (seedErr) {
                console.warn('Lưu ý khi chèn dữ liệu mẫu Bookings lên Supabase:', seedErr);
              }
            }
            setOrders(seededOrders);
            fetchedOrders = seededOrders;
            console.log('Đã nạp dữ liệu mẫu Bookings (do bảng trống trên Supabase)');
          }
        } catch (err) {
          console.warn('Lỗi khi tải Bookings từ Supabase (sử dụng fallback local):', err);
          const savedOrders = localStorage.getItem('crm_orders');
          fetchedOrders = savedOrders ? JSON.parse(savedOrders) : [
            {
              id: 'O-1001',
              tour_id: '1',
              created_by: 'Sale Nguyễn',
              status: 'sure',
              invoice_status: 'pending',
              total_price: 16980000,
              created_at: new Date(Date.now() - 2 * 3600000).toISOString()
            },
            {
              id: 'O-1002',
              tour_id: '2',
              created_by: 'Đại lý Việt Travel',
              status: 'hold',
              hold_expiry: new Date(Date.now() + 18 * 3600000).toISOString(),
              invoice_status: 'pending',
              total_price: 27980000,
              created_at: new Date().toISOString(),
              extension_status: 'none'
            }
          ];
          setOrders(fetchedOrders);
        }

        // 3. Passengers
        try {
          const { data: passengersData, error: passengersErr } = await supabase.from('passengers').select('*');
          if (passengersErr) throw passengersErr;

          if (passengersData && passengersData.length > 0) {
            const storedReasons = JSON.parse(localStorage.getItem('crm_disqualified_reasons') || '{}');
            const storedSubmittedAts = JSON.parse(localStorage.getItem('crm_visa_submitted_ats') || '{}');
            const mapped = passengersData.map(p => ({
              id: p.id,
              order_id: p.order_id,
              is_payer: p.is_payer,
              full_name: p.full_name,
              passport_number: p.passport_number,
              phone: p.phone,
              dob: p.dob,
              passport_url: p.passport_url,
              labor_contract_url: p.labor_contract_url,
              visa_status: p.visa_status || 'pending',
              needs_visa_service: (p.needs_visa_service !== undefined && p.needs_visa_service !== null)
                ? p.needs_visa_service
                : (p.visa_status && p.visa_status !== 'not_required'),
              visa_submitted_at: p.visa_submitted_at || storedSubmittedAts[p.id] || undefined,
              visa_disqualified_reason: p.visa_disqualified_reason || storedReasons[p.id] || undefined
            }));
            setPassengers(sanitizePassengers(mapped, fetchedOrders));
            console.log('Đã nạp thành công Passengers từ Supabase');
          } else {
            const seededPassengers: Passenger[] = [
              {
                id: toUuid('P-101'),
                order_id: toUuid('O-1001'),
                is_payer: true,
                full_name: 'Nguyễn Văn Nam',
                phone: '0912345678',
                dob: '1990-05-15',
                passport_url: 'passport_nam.pdf',
                labor_contract_url: 'labor_nam.pdf',
                visa_status: 'processing'
              },
              {
                id: toUuid('P-102'),
                order_id: toUuid('O-1001'),
                is_payer: false,
                full_name: 'Trần Thị Hoa',
                dob: '1992-08-20',
                passport_url: 'passport_hoa.pdf',
                visa_status: 'pending'
              },
              {
                id: toUuid('P-103'),
                order_id: toUuid('O-1002'),
                is_payer: true,
                full_name: 'Phạm Minh Đức',
                phone: '0987654321',
                dob: '1985-11-30',
                passport_url: 'passport_duc.pdf',
                labor_contract_url: 'labor_duc.pdf',
                visa_status: 'pending'
              }
            ];

            for (const p of seededPassengers) {
              try {
                await supabase.from('passengers').insert({
                  id: p.id,
                  order_id: p.order_id,
                  is_payer: p.is_payer,
                  full_name: p.full_name,
                  passport_number: p.passport_number,
                  phone: p.phone,
                  dob: p.dob,
                  passport_url: p.passport_url,
                  labor_contract_url: p.labor_contract_url,
                  visa_status: p.visa_status,
                  needs_visa_service: p.needs_visa_service || false
                });
              } catch (seedErr) {
                console.warn('Lưu ý khi chèn dữ liệu mẫu Passengers lên Supabase:', seedErr);
              }
            }
            setPassengers(sanitizePassengers(seededPassengers, fetchedOrders));
            console.log('Đã nạp dữ liệu mẫu Passengers (do bảng trống trên Supabase)');
          }
        } catch (err) {
          console.warn('Lỗi khi tải Passengers từ Supabase (sử dụng fallback local):', err);
          const savedPassengers = localStorage.getItem('crm_passengers');
          const parsedPassengers = savedPassengers ? JSON.parse(savedPassengers) : [
            {
              id: 'P-101',
              order_id: 'O-1001',
              is_payer: true,
              full_name: 'Nguyễn Văn Nam',
              phone: '0912345678',
              dob: '1990-05-15',
              passport_url: 'passport_nam.pdf',
              labor_contract_url: 'labor_nam.pdf',
              visa_status: 'processing'
            },
            {
              id: 'P-102',
              order_id: 'O-1001',
              is_payer: false,
              full_name: 'Trần Thị Hoa',
              dob: '1992-08-20',
              passport_url: 'passport_hoa.pdf',
              visa_status: 'pending'
            },
            {
              id: 'P-103',
              order_id: 'O-1002',
              is_payer: true,
              full_name: 'Phạm Minh Đức',
              phone: '0987654321',
              dob: '1985-11-30',
              passport_url: 'passport_duc.pdf',
              labor_contract_url: 'labor_duc.pdf',
              visa_status: 'pending'
            }
          ];
          setPassengers(sanitizePassengers(parsedPassengers, fetchedOrders));
        }

        // 4. Notifications
        try {
          const { data: notifsData, error: notifsErr } = await supabase
            .from('system_notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
          if (notifsErr) throw notifsErr;

          if (notifsData && notifsData.length > 0) {
            setNotifications(notifsData.map(n => ({
              id: n.id,
              type: n.type as any,
              title: n.title,
              message: n.message,
              targetId: n.target_id || '',
              createdAt: n.created_at,
              read: n.read
            })));
            console.log('Đã nạp thành công Notifications từ Supabase');
          } else {
            setNotifications([
              {
                id: 'N-1',
                type: 'visa',
                title: 'Yêu cầu visa mới',
                message: 'Khách hàng Nguyễn Văn Nam (Đơn hàng O-1001) đã tải lên đầy đủ giấy tờ cần xét duyệt visa.',
                targetId: 'P-101',
                createdAt: new Date(Date.now() - 3600000).toISOString(),
                read: false
              },
              {
                id: 'N-2',
                type: 'accounting',
                title: 'Yêu cầu xuất hóa đơn',
                message: 'Đơn hàng O-1001 đã sure chỗ. Cần xuất hóa đơn VAT.',
                targetId: 'O-1001',
                createdAt: new Date().toISOString(),
                read: false
              }
            ]);
          }
        } catch (err) {
          console.warn('Lỗi khi tải Notifications từ Supabase (sử dụng fallback local):', err);
          const savedNotifs = localStorage.getItem('crm_notifications');
          setNotifications(savedNotifs ? JSON.parse(savedNotifs) : [
            {
              id: 'N-1',
              type: 'visa',
              title: 'Yêu cầu visa mới',
              message: 'Khách hàng Nguyễn Văn Nam (Đơn hàng O-1001) đã tải lên đầy đủ giấy tờ cần xét duyệt visa.',
              targetId: 'P-101',
              createdAt: new Date(Date.now() - 3600000).toISOString(),
              read: false
            },
            {
              id: 'N-2',
              type: 'accounting',
              title: 'Yêu cầu xuất hóa đơn',
              message: 'Đơn hàng O-1001 đã sure chỗ. Cần xuất hóa đơn VAT.',
              targetId: 'O-1001',
              createdAt: new Date().toISOString(),
              read: false
            }
          ]);
        }

        // 5. Categories
        try {
          const { data: catsData, error: catsErr } = await supabase.from('tour_categories').select('name');
          if (catsErr) throw catsErr;

          if (catsData && catsData.length > 0) {
            setCategories(catsData.map(c => c.name));
            console.log('Đã nạp thành công Categories từ Supabase');
          } else {
            setCategories(['Du lịch Đông Nam Á', 'Du lịch Châu Âu', 'Du lịch Đông Bắc Á', 'Du lịch Trong Nước']);
          }
        } catch (err) {
          console.warn('Lỗi khi tải Categories từ Supabase (sử dụng fallback local):', err);
          const savedCats = localStorage.getItem('crm_categories');
          setCategories(savedCats ? JSON.parse(savedCats) : ['Du lịch Đông Nam Á', 'Du lịch Châu Âu', 'Du lịch Đông Bắc Á', 'Du lịch Trong Nước']);
        }

        // 6. Settings
        try {
          const { data: settingsData, error: settingsErr } = await supabase.from('app_settings').select('value').eq('key', 'membership_settings').maybeSingle();
          if (settingsErr) throw settingsErr;

          if (settingsData && settingsData.value) {
            setMembershipSettings(settingsData.value as MembershipSettings);
            console.log('Đã nạp thành công Settings từ Supabase');
          } else {
            setMembershipSettings({
              silverMin: 20000000,
              goldMin: 50000000,
              platinumMin: 100000000
            });
          }
        } catch (err) {
          console.warn('Lỗi khi tải Settings từ Supabase (sử dụng fallback local):', err);
          const savedSettings = localStorage.getItem('crm_membership_settings');
          setMembershipSettings(savedSettings ? JSON.parse(savedSettings) : {
            silverMin: 20000000,
            goldMin: 50000000,
            platinumMin: 100000000
          });
        }
      } else {
        console.log('Không phát hiện cấu hình Supabase thực tế, sử dụng LocalStorage.');
        loadLocalStorage();
      }
    };

    const loadLocalStorage = () => {
      const savedTours = localStorage.getItem('crm_tours');
      setTours(savedTours ? JSON.parse(savedTours) : INITIAL_TOURS);

      const savedOrders = localStorage.getItem('crm_orders');
      const parsedOrders = savedOrders ? JSON.parse(savedOrders) : [
        {
          id: 'O-1001',
          tour_id: '1',
          created_by: 'Sale Nguyễn',
          status: 'sure',
          invoice_status: 'pending',
          total_price: 16980000,
          created_at: new Date(Date.now() - 2 * 3600000).toISOString()
        },
        {
          id: 'O-1002',
          tour_id: '2',
          created_by: 'Đại lý Việt Travel',
          status: 'hold',
          hold_expiry: new Date(Date.now() + 18 * 3600000).toISOString(),
          invoice_status: 'pending',
          total_price: 27980000,
          created_at: new Date().toISOString(),
          extension_status: 'none'
        }
      ];
      setOrders(parsedOrders);

      const savedPassengers = localStorage.getItem('crm_passengers');
      const parsedPassengers = savedPassengers ? JSON.parse(savedPassengers) : [
        {
          id: 'P-101',
          order_id: 'O-1001',
          is_payer: true,
          full_name: 'Nguyễn Văn Nam',
          phone: '0912345678',
          dob: '1990-05-15',
          passport_url: 'passport_nam.pdf',
          labor_contract_url: 'labor_nam.pdf',
          visa_status: 'processing'
        },
        {
          id: 'P-102',
          order_id: 'O-1001',
          is_payer: false,
          full_name: 'Trần Thị Hoa',
          dob: '1992-08-20',
          passport_url: 'passport_hoa.pdf',
          visa_status: 'pending'
        },
        {
          id: 'P-103',
          order_id: 'O-1002',
          is_payer: true,
          full_name: 'Phạm Minh Đức',
          phone: '0987654321',
          dob: '1985-11-30',
          passport_url: 'passport_duc.pdf',
          labor_contract_url: 'labor_duc.pdf',
          visa_status: 'pending'
        }
      ];
      setPassengers(sanitizePassengers(parsedPassengers, parsedOrders));

      const savedNotifs = localStorage.getItem('crm_notifications');
      setNotifications(savedNotifs ? JSON.parse(savedNotifs) : [
        {
          id: 'N-1',
          type: 'visa',
          title: 'Yêu cầu visa mới',
          message: 'Khách hàng Nguyễn Văn Nam (Đơn hàng O-1001) đã tải lên đầy đủ giấy tờ cần xét duyệt visa.',
          targetId: 'P-101',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          read: false
        },
        {
          id: 'N-2',
          type: 'accounting',
          title: 'Yêu cầu xuất hóa đơn',
          message: 'Đơn hàng chắc chắn O-1001 đã được xác nhận. Vui lòng kiểm tra và xuất hóa đơn.',
          targetId: 'O-1001',
          createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
          read: false
        }
      ]);

      const savedCats = localStorage.getItem('crm_categories');
      setCategories(savedCats ? JSON.parse(savedCats) : [
        'Du lịch Đông Nam Á',
        'Du lịch Châu Âu',
        'Du lịch Đông Bắc Á',
        'Du lịch Trong Nước'
      ]);

      const savedSettings = localStorage.getItem('crm_membership_settings');
      setMembershipSettings(savedSettings ? JSON.parse(savedSettings) : {
        silverMin: 20000000,
        goldMin: 50000000,
        platinumMin: 100000000
      });
    };

    loadCRMData();
  }, [user?.id]);

  // Sync state changes to fallback LocalStorage only (Supabase is handled on action trigger)
  useEffect(() => {
    if (!isSupabaseConfigured() && tours.length > 0) {
      localStorage.setItem('crm_tours', JSON.stringify(tours));
    }
  }, [tours]);

  useEffect(() => {
    if (!isSupabaseConfigured() && categories.length > 0) {
      localStorage.setItem('crm_categories', JSON.stringify(categories));
    }
  }, [categories]);

  useEffect(() => {
    if (!isSupabaseConfigured() && orders.length > 0) {
      localStorage.setItem('crm_orders', JSON.stringify(orders));
    }
  }, [orders]);

  useEffect(() => {
    if (!isSupabaseConfigured() && passengers.length > 0) {
      localStorage.setItem('crm_passengers', JSON.stringify(passengers));
    }
  }, [passengers]);

  useEffect(() => {
    if (!isSupabaseConfigured() && notifications.length > 0) {
      localStorage.setItem('crm_notifications', JSON.stringify(notifications));
    }
  }, [notifications]);

  const updateMembershipSettings = async (settings: MembershipSettings) => {
    setMembershipSettings(settings);
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('app_settings').upsert({
          key: 'membership_settings',
          value: settings,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.error('Lỗi khi lưu cấu hình thành viên lên Supabase:', err);
      }
    } else {
      localStorage.setItem('crm_membership_settings', JSON.stringify(settings));
    }
  };

  const releaseExpiredHolds = () => {
    const now = new Date();
    let updatedTours = [...tours];
    let updatedOrders = [...orders];
    let toursChanged = false;
    let ordersChanged = false;

    updatedOrders = updatedOrders.map(order => {
      if (order.status === 'hold' && order.hold_expiry) {
        const expiry = new Date(order.hold_expiry);
        if (now > expiry) {
          ordersChanged = true;
          // Update associated tour seats
          updatedTours = updatedTours.map(t => {
            if (t.id === order.tour_id) {
              toursChanged = true;
              const seatsReleased = order.adult_count !== undefined 
                ? ((order.adult_count || 0) + (order.child_count || 0)) 
                : (passengers.filter(p => p.order_id === order.id).length || 1);
              const newHold = Math.max(0, t.hold_seats - seatsReleased);
              const newAvail = t.total_seats - t.sold_seats - newHold;
              const overbook = t.overbook_limit || 0;
              const totalUsed = t.sold_seats + newHold;
              let seatStatus: 'Còn chỗ' | 'Hết chỗ' | 'Overbooked' = 'Còn chỗ';
              if (totalUsed >= t.total_seats + overbook) {
                seatStatus = 'Hết chỗ';
              } else if (totalUsed >= t.total_seats) {
                seatStatus = 'Overbooked';
              }
              return {
                ...t,
                hold_seats: newHold,
                available_seats: newAvail,
                seat_status: seatStatus
              };
            }
            return t;
          });

          // Add notification
          setNotifications(prev => [
            {
              id: 'N-' + Date.now(),
              type: 'accounting',
              title: 'Huỷ giữ chỗ tự động',
              message: `Đơn giữ chỗ ${order.id} đã hết hạn ${order.hold_expiry} và tự động giải phóng chỗ.`,
              targetId: order.id,
              createdAt: new Date().toISOString(),
              read: false
            },
            ...prev
          ]);

          return { ...order, status: 'cancelled' };
        }
      }
      return order;
    });

    if (toursChanged) setTours(updatedTours);
    if (ordersChanged) setOrders(updatedOrders);
  };

  const releaseExpiredHoldsRef = useRef(releaseExpiredHolds);
  useEffect(() => {
    releaseExpiredHoldsRef.current = releaseExpiredHolds;
  });

  // Periodically check expired holds
  useEffect(() => {
    const interval = setInterval(() => {
      releaseExpiredHoldsRef.current();
    }, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, []);

  const addCategory = async (categoryName: string) => {
    const trimmed = categoryName.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      toast.error('Danh mục này đã tồn tại!');
      return;
    }

    // Thêm vào local state trước
    setCategories(prev => {
      const next = [...prev, trimmed];
      localStorage.setItem('crm_categories', JSON.stringify(next));
      return next;
    });

    if (isSupabaseConfigured()) {
      try {
        // Tạo ID an toàn với fallback nếu crypto.randomUUID không khả dụng
        const catId = generateSafeUUID();

        const { error } = await supabase.from('tour_categories').insert({ 
          id: catId,
          name: trimmed 
        });
        
        if (error) {
          console.error('Lỗi Supabase khi thêm danh mục:', error);
          
          if (error.code === '42P01') {
            toast.error(`Lỗi: Bảng 'tour_categories' không tồn tại trên Supabase. Vui lòng báo quản trị viên kiểm tra lại Database!`);
          } else if (error.code === '23505' || error.message?.toLowerCase().includes('unique') || error.message?.toLowerCase().includes('duplicate')) {
            console.log(`Danh mục "${trimmed}" đã có sẵn trên máy chủ.`);
          } else if (error.code === '42703') {
            toast.error(`Lỗi cấu trúc Database: Bảng 'tour_categories' thiếu cột hoặc sai tên cột. Vui lòng kiểm tra lại schema.`);
          } else {
            toast.error(`Lưu ý: Không thể lưu danh mục "${trimmed}" lên máy chủ: ${error.message}. Danh mục đã được lưu tạm ở trình duyệt.`);
          }
        } else {
          console.log(`Đã lưu danh mục "${trimmed}" lên Supabase thành công.`);
        }
      } catch (err: any) {
        console.error('Lỗi hệ thống khi thêm danh mục:', err);
      }
    }
  };

  const deleteCategory = async (categoryName: string) => {
    const previousCategories = [...categories];
    setCategories(prev => {
      const next = prev.filter(c => c !== categoryName);
      localStorage.setItem('crm_categories', JSON.stringify(next));
      return next;
    });

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('tour_categories').delete().eq('name', categoryName);
        if (error) {
          console.error('Lỗi Supabase khi xoá danh mục:', error);
          toast.error(`Lưu ý: Không thể xoá danh mục trên máy chủ: ${error.message}. Danh mục đã được xoá tạm ở trình duyệt của bạn.`);
          // Không rollback để tránh lỗi DB chặn UI làm phiền người dùng
        } else {
          toast.success(`Đã xoá danh mục "${categoryName}" thành công!`);
        }
      } catch (err: any) {
        console.error('Lỗi hệ thống khi xoá danh mục:', err);
        toast.error(`Lưu ý: Gặp lỗi hệ thống khi xoá danh mục trên máy chủ. Danh mục đã được xoá tạm ở trình duyệt.`);
      }
    } else {
      toast.success(`Đã xoá danh mục "${categoryName}" (Chế độ offline)!`);
    }
  };

  const updateCategory = async (oldCategory: string, newCategory: string) => {
    const trimmedNew = newCategory.trim();
    if (!trimmedNew || trimmedNew === oldCategory) return;

    if (categories.includes(trimmedNew)) {
      toast.error('Tên danh mục mới đã tồn tại!');
      return;
    }

    const previousCategories = [...categories];
    const previousTours = [...tours];

    setCategories(prev => {
      const next = prev.map(c => c === oldCategory ? trimmedNew : c);
      localStorage.setItem('crm_categories', JSON.stringify(next));
      return next;
    });
    setTours(prev => prev.map(t => t.category === oldCategory ? { ...t, category: trimmedNew } : t));

    if (isSupabaseConfigured()) {
      try {
        const { error: catError } = await supabase.from('tour_categories').update({ name: trimmedNew }).eq('name', oldCategory);
        if (catError) {
          console.error('Lỗi Supabase khi cập nhật danh mục:', catError);
          toast.error(`Lưu ý: Không thể cập nhật danh mục trên máy chủ: ${catError.message}. Thay đổi đã được cập nhật tạm thời ở trình duyệt.`);
          // Không rollback để tránh gián đoạn trải nghiệm
          return;
        }

        const { error: tourError } = await supabase.from('tours').update({ category: trimmedNew }).eq('category', oldCategory);
        if (tourError) {
          console.error('Lỗi Supabase khi cập nhật danh mục cho các tour liên quan:', tourError);
          toast.success(`Cập nhật danh mục thành công nhưng gặp lỗi khi chuyển đổi các Tour liên quan trên máy chủ.`);
        } else {
          toast.success(`Đã cập nhật danh mục thành "${trimmedNew}" thành công!`);
        }
      } catch (err: any) {
        console.error('Lỗi hệ thống khi cập nhật danh mục:', err);
        toast.error(`Lưu ý: Gặp lỗi hệ thống khi cập nhật danh mục trên máy chủ. Thay đổi đã được áp dụng tạm thời ở trình duyệt.`);
      }
    } else {
      toast.success(`Đã cập nhật danh mục thành "${trimmedNew}" (Chế độ offline)!`);
    }
  };

  const cleanValueForSupabase = (val: any, isNumeric: boolean = false) => {
    if (val === undefined || val === null) {
      return isNumeric ? 0 : null;
    }
    if (isNumeric) {
      if (val === '') return 0;
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    }
    return val;
  };

  const addTour = async (tourData: any) => {
    // Tạo ID an toàn với fallback nếu crypto.randomUUID không khả dụng
    const id = generateSafeUUID();
    
    // Đảm bảo các giá trị số là số
    const priceAdult = Number(tourData.price_adult || tourData.price || 0);
    const totalSeats = Number(tourData.total_seats || 0);
    const priceVisaTour = Number(tourData.price_visa_tour || 0);

    const newTour: Tour = {
      ...tourData,
      id,
      sold_seats: 0,
      hold_seats: 0,
      available_seats: totalSeats,
      seat_status: 'Còn chỗ',
    };
    
    // Thêm vào local state ngay lập tức
    setTours(prev => [...prev, newTour]);

    if (isSupabaseConfigured()) {
      try {
        // Chuẩn hóa ngày khởi hành (Chỉ lấy phần YYYY-MM-DD cho cột kiểu DATE)
        let departureDate = new Date().toISOString().substring(0, 10);
        if (tourData.departure_time && tourData.departure_time.length >= 10) {
          try {
            const d = new Date(tourData.departure_time);
            if (!isNaN(d.getTime())) {
              departureDate = d.toISOString().substring(0, 10);
            }
          } catch (e) {
            console.warn('Lỗi định dạng ngày khởi hành:', e);
          }
        }

        const initialPayload: any = {
          id: id,
          code: cleanValueForSupabase(tourData.code),
          name: cleanValueForSupabase(tourData.name),
          destination: cleanValueForSupabase(tourData.destination || tourData.category || 'Chưa xác định'),
          start_date: tourData.start_date || departureDate,
          end_date: tourData.end_date || departureDate,
          duration: cleanValueForSupabase(tourData.duration),
          price: priceAdult,
          cost: 0,
          total_seats: totalSeats,
          available_seats: totalSeats,
          status: cleanValueForSupabase(tourData.tour_status || 'available'),
          departure_date: departureDate,
          departure_time: cleanValueForSupabase(tourData.departure_time),
          return_time: cleanValueForSupabase(tourData.return_time),
          airline: cleanValueForSupabase(tourData.airline),
          hotel: cleanValueForSupabase(tourData.hotel),
          commission: cleanValueForSupabase(tourData.commission, true),
          sold_seats: 0,
          hold_seats: 0,
          seat_status: 'Còn chỗ',
          flight_out: cleanValueForSupabase(tourData.flight_out),
          flight_out_transit: cleanValueForSupabase(tourData.flight_out_transit),
          flight_in: cleanValueForSupabase(tourData.flight_in),
          flight_in_transit: cleanValueForSupabase(tourData.flight_in_transit),
          transit_info: cleanValueForSupabase(tourData.transit_info),
          guide_name: cleanValueForSupabase(tourData.guide_name),
          guide_phone: cleanValueForSupabase(tourData.guide_phone),
          ticket_status: cleanValueForSupabase(tourData.ticket_status || 'CHỜ XUẤT VÉ'),
          visa_deadline: cleanValueForSupabase(tourData.visa_deadline),
          description: cleanValueForSupabase(tourData.description),
          category: cleanValueForSupabase(tourData.category),
          hold_duration_hours: cleanValueForSupabase(tourData.hold_duration_hours || 48, true),
          overbook_limit: cleanValueForSupabase(tourData.overbook_limit, true),
          price_adult: priceAdult,
          price_child: cleanValueForSupabase(tourData.price_child, true),
          price_infant: cleanValueForSupabase(tourData.price_infant, true),
          single_room_surcharge: cleanValueForSupabase(tourData.single_room_surcharge, true),
          itinerary_pdf_url: cleanValueForSupabase(tourData.itinerary_pdf_url),
          notice_sections: cleanValueForSupabase(tourData.notice_sections),
          tour_status: cleanValueForSupabase(tourData.tour_status || 'available'),
          tour_type: cleanValueForSupabase(tourData.tour_type || 'internal'),
          partner_name: cleanValueForSupabase(tourData.partner_name),
          partner_contact: cleanValueForSupabase(tourData.partner_contact),
          organization_name: cleanValueForSupabase(tourData.organization_name),
          group_leader_contact: cleanValueForSupabase(tourData.group_leader_contact),
          custom_requirements: cleanValueForSupabase(tourData.custom_requirements),
          visa_country: cleanValueForSupabase(tourData.visa_country),
          visa_service_type: cleanValueForSupabase(tourData.visa_service_type),
          visa_speed: cleanValueForSupabase(tourData.visa_speed),
          price_visa_tour: cleanValueForSupabase(tourData.price_visa_tour, true)
        };

        let currentPayload = { ...initialPayload };
        let retryCount = 0;
        let success = false;
        let lastError: any = null;

        while (retryCount < 5 && !success) {
          const { error } = await supabase.from('tours').insert(currentPayload);
          if (!error) {
            success = true;
            break;
          }

          lastError = error;
          const errorMsg = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));

          if (error.code === '42703' || error.code === 'PGRST204' || (errorMsg && errorMsg.includes('Could not find the'))) {
            const match = errorMsg.match(/'([^']+)' column/) || errorMsg.match(/column "([^"]+)"/);
            if (match && match[1]) {
              const missingCol = match[1];
              console.warn(`[Self-Healing] Cột '${missingCol}' không tồn tại trong DB, loại bỏ và thử lại...`);
              delete currentPayload[missingCol];
              retryCount++;
              continue;
            }
          }
          break; // Lỗi khác thì dừng luôn
        }

        if (!success && lastError) {
          console.error('Lỗi khi thêm Tour vào Supabase:', lastError);
          let msg = `Lỗi Supabase (${lastError.code}): ${lastError.message}`;
          if (lastError.details) msg += `\nChi tiết: ${lastError.details}`;
          if (lastError.hint) msg += `\nGợi ý: ${lastError.hint}`;

          if (lastError.code === '42703' || lastError.code === 'PGRST204' || (msg && msg.includes('Could not find the'))) {
            toast.error(`Lỗi cấu trúc Database: Bảng 'tours' đang thiếu cột. \n\nVui lòng copy và chạy các câu lệnh ALTER TABLE ở cuối file supabase-schema.sql trong SQL Editor của Supabase để cập nhật database.\n\n${msg}`);
          } else if (lastError.code === '23505') {
            toast.error(`Lỗi trùng lặp: Mã tour/visa '${tourData.code}' đã tồn tại!\n\n${msg}`);
          } else if (lastError.code === '23502') {
             toast.error(`Lỗi dữ liệu: Có trường bắt buộc đang bị để trống.\n\n${msg}`);
          } else {
            toast.error(msg);
          }
          // Rollback local state nếu lỗi nghiêm trọng
          setTours(prev => prev.filter(t => t.id !== id));
        }
      } catch (err: any) {
        console.error('Lỗi hệ thống khi thêm Tour vào Supabase:', err);
        setTours(prev => prev.filter(t => t.id !== id));
      }
    }
  };

  const updateTour = async (updatedTour: Tour) => {
    // 1. Cập nhật local state trước để UI phản hồi nhanh
    const overbook = updatedTour.overbook_limit || 0;
    const totalUsed = updatedTour.sold_seats + updatedTour.hold_seats;
    let seatStatus: 'Còn chỗ' | 'Hết chỗ' | 'Overbooked' = 'Còn chỗ';
    if (totalUsed >= updatedTour.total_seats + overbook) {
      seatStatus = 'Hết chỗ';
    } else if (totalUsed >= updatedTour.total_seats) {
      seatStatus = 'Overbooked';
    }

    const nextTour = {
      ...updatedTour,
      available_seats: updatedTour.total_seats - updatedTour.sold_seats - updatedTour.hold_seats,
      seat_status: seatStatus
    };

    setTours(prev => prev.map(t => t.id === updatedTour.id ? nextTour : t));

    if (isSupabaseConfigured()) {
      try {
        // Đảm bảo các giá trị số là số
        const priceAdult = Number(updatedTour.price_adult || updatedTour.price || 0);
        const totalSeats = Number(updatedTour.total_seats || 0);

        // Chuẩn hóa ngày khởi hành
        let departureDate = updatedTour.departure_time ? updatedTour.departure_time.substring(0, 10) : new Date().toISOString().substring(0, 10);
        try {
          if (updatedTour.departure_time) {
            const d = new Date(updatedTour.departure_time);
            if (!isNaN(d.getTime())) {
              departureDate = d.toISOString().substring(0, 10);
            }
          }
        } catch (e) {
          console.warn('Lỗi định dạng ngày khi cập nhật:', e);
        }

        const startDate = updatedTour.start_date || departureDate || new Date().toISOString().substring(0, 10);
        const endDate = updatedTour.end_date || departureDate || startDate;

        const updatePayload = {
          code: cleanValueForSupabase(updatedTour.code),
          name: cleanValueForSupabase(updatedTour.name),
          destination: cleanValueForSupabase(updatedTour.destination || updatedTour.category || 'Chưa xác định'),
          start_date: startDate,
          end_date: endDate,
          duration: cleanValueForSupabase(updatedTour.duration),
          price: priceAdult,
          total_seats: totalSeats,
          available_seats: cleanValueForSupabase(nextTour.available_seats, true),
          sold_seats: cleanValueForSupabase(updatedTour.sold_seats, true),
          hold_seats: cleanValueForSupabase(updatedTour.hold_seats, true),
          seat_status: seatStatus,
          flight_out: cleanValueForSupabase(updatedTour.flight_out),
          flight_out_transit: cleanValueForSupabase(updatedTour.flight_out_transit),
          flight_in: cleanValueForSupabase(updatedTour.flight_in),
          flight_in_transit: cleanValueForSupabase(updatedTour.flight_in_transit),
          transit_info: cleanValueForSupabase(updatedTour.transit_info),
          guide_name: cleanValueForSupabase(updatedTour.guide_name),
          guide_phone: cleanValueForSupabase(updatedTour.guide_phone),
          ticket_status: cleanValueForSupabase(updatedTour.ticket_status || 'CHỜ XUẤT VÉ'),
          visa_deadline: cleanValueForSupabase(updatedTour.visa_deadline),
          description: cleanValueForSupabase(updatedTour.description),
          category: cleanValueForSupabase(updatedTour.category),
          hold_duration_hours: cleanValueForSupabase(updatedTour.hold_duration_hours || 48, true),
          overbook_limit: cleanValueForSupabase(updatedTour.overbook_limit, true),
          price_adult: priceAdult,
          price_child: cleanValueForSupabase(updatedTour.price_child, true),
          price_infant: cleanValueForSupabase(updatedTour.price_infant, true),
          single_room_surcharge: cleanValueForSupabase(updatedTour.single_room_surcharge, true),
          itinerary_pdf_url: cleanValueForSupabase(updatedTour.itinerary_pdf_url),
          notice_sections: cleanValueForSupabase(updatedTour.notice_sections),
          status: cleanValueForSupabase(updatedTour.tour_status || 'available'),
          tour_status: cleanValueForSupabase(updatedTour.tour_status || 'available'),
          tour_type: cleanValueForSupabase(updatedTour.tour_type || 'internal'),
          partner_name: cleanValueForSupabase(updatedTour.partner_name),
          partner_contact: cleanValueForSupabase(updatedTour.partner_contact),
          organization_name: cleanValueForSupabase(updatedTour.organization_name),
          group_leader_contact: cleanValueForSupabase(updatedTour.group_leader_contact),
          custom_requirements: cleanValueForSupabase(updatedTour.custom_requirements),
          visa_country: cleanValueForSupabase(updatedTour.visa_country),
          visa_service_type: cleanValueForSupabase(updatedTour.visa_service_type),
          visa_speed: cleanValueForSupabase(updatedTour.visa_speed),
          price_visa_tour: cleanValueForSupabase(updatedTour.price_visa_tour, true),
          commission: cleanValueForSupabase(updatedTour.commission, true),
          departure_date: departureDate,
          departure_time: cleanValueForSupabase(updatedTour.departure_time),
          return_time: cleanValueForSupabase(updatedTour.return_time),
          airline: cleanValueForSupabase(updatedTour.airline),
        };

        let currentPayload = { ...updatePayload };
        let retryCount = 0;
        let success = false;
        let lastError: any = null;

        while (retryCount < 5 && !success) {
          console.log(`Đang thử cập nhật Tour (lần thử ${retryCount + 1}):`, updatedTour.id, currentPayload);
          const { error } = await supabase.from('tours').update(currentPayload).eq('id', updatedTour.id);
          if (!error) {
            success = true;
            break;
          }

          lastError = error;
          const errorMsg = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));

          if (error.code === '42703' || error.code === 'PGRST204' || (errorMsg && errorMsg.includes('Could not find the'))) {
            const match = errorMsg.match(/'([^']+)' column/) || errorMsg.match(/column "([^"]+)"/);
            if (match && match[1]) {
              const missingCol = match[1];
              console.warn(`[Self-Healing] Cột '${missingCol}' không tồn tại trong DB, loại bỏ và thử lại...`);
              delete currentPayload[missingCol as keyof typeof currentPayload];
              retryCount++;
              continue;
            }
          }
          break; // Lỗi khác thì dừng luôn
        }

        if (!success && lastError) {
          console.error('Lỗi khi cập nhật Tour trên Supabase:', lastError);
          const errorMsg = lastError.message || (typeof lastError === 'object' ? JSON.stringify(lastError) : String(lastError));
          if (lastError.code === '42703' || lastError.code === 'PGRST204' || (errorMsg && errorMsg.includes('Could not find the'))) {
            toast.error(`Lỗi cấu trúc Database: Bảng 'tours' đang thiếu cột. \n\nVui lòng copy và chạy các câu lệnh ALTER TABLE ở cuối file supabase-schema.sql trong SQL Editor của Supabase để cập nhật database.\n\nChi tiết: ${errorMsg}`);
          } else {
            toast.error(`Lỗi cập nhật CSDL: ${errorMsg}`);
          }
          throw new Error(`Lỗi khi cập nhật Tour trên Supabase: ${errorMsg}`);
        }
      } catch (err: any) {
        console.error('Lỗi hệ thống khi cập nhật Tour:', err);
      }
    }
  };

  const deleteTour = async (tourId: string) => {
    setTours(prev => prev.filter(t => t.id !== tourId));
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('tours').delete().eq('id', tourId);
      } catch (err) {
        console.error('Lỗi khi xoá Tour trên Supabase:', err);
      }
    }
  };

  const createOrder = async (orderData: {
    tour_id: string;
    status: 'hold' | 'sure';
    total_price?: number;
    adult_price: number;
    passengers?: (Omit<Passenger, 'id' | 'order_id' | 'visa_status'> & { needs_visa_service?: boolean })[];
    booker_name?: string;
    booker_phone?: string;
    created_by?: string;
    user_id?: string;
    adult_count?: number;
    child_count?: number;
    infant_count?: number;
    single_room_count?: number;
    room_share_info?: string;
    vat_option?: string;
    special_requests?: string;
  }) => {
    const tour = tours.find(t => t.id === orderData.tour_id);
    if (!tour) return;

    const adultPrice = Number(orderData.adult_price || 0);
    const childPrice = Math.round(adultPrice * 0.9);
    const infantPrice = Math.round(adultPrice * 0.3);
    
    const totalPrice = orderData.total_price || (
      ((orderData.adult_count || 0) * adultPrice) + 
      ((orderData.child_count || 0) * childPrice) + 
      ((orderData.infant_count || 0) * infantPrice) +
      (orderData.passengers?.reduce((sum, p) => sum + (p.needs_visa_service ? (tour?.price_visa_tour || 0) : 0), 0) || 0)
    );

    const seatsToLock = orderData.adult_count !== undefined 
      ? ((orderData.adult_count || 0) + (orderData.child_count || 0)) 
      : (orderData.passengers?.length || 0);

    const allowedMaxSeats = tour.total_seats + (tour.overbook_limit || 0) - tour.sold_seats - tour.hold_seats;

    if (allowedMaxSeats < seatsToLock) {
      toast.error(`Không đủ chỗ trống để đặt tour! (Tối đa khả dụng bao gồm overbooking: ${allowedMaxSeats})`);
      return;
    }

    const holdHours = tour.hold_duration_hours || 48;
    const holdExpiry = orderData.status === 'hold' 
      ? new Date(Date.now() + holdHours * 3600000).toISOString() 
      : undefined;

    const creatorName = orderData.created_by || (
      currentRole === 'CTV' ? 'CTV' :
      currentRole === 'Đại lý' ? 'Đại lý' :
      currentRole === 'sale' ? 'Sale' :
      currentRole === 'operator' ? 'Điều hành' : 'Quản trị viên'
    );

    // Tìm hoặc tạo khách hàng (customer_id là NOT NULL)
    let finalCustomerId = null;
    if (isSupabaseConfigured()) {
      try {
        if (orderData.booker_phone) {
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('phone', orderData.booker_phone)
            .maybeSingle();
          
          if (existingCustomer) {
            finalCustomerId = existingCustomer.id;
          } else {
            const { data: newCustomer, error: custError } = await supabase
              .from('customers')
              .insert({
                name: orderData.booker_name || 'Khách lẻ',
                phone: orderData.booker_phone,
                type: 'individual'
              })
              .select('id')
              .single();
            
            if (!custError && newCustomer) {
              finalCustomerId = newCustomer.id;
            }
          }
        }

        if (!finalCustomerId) {
          const { data: anonCustomer } = await supabase
            .from('customers')
            .insert({ name: 'Khách vãng lai', phone: '0000000000', type: 'individual' })
            .select('id')
            .single();
          finalCustomerId = anonCustomer?.id;
        }
      } catch (err) {
        console.error('Lỗi khi xử lý thông tin khách hàng:', err);
      }
    }

    const orderId = generateSafeUUID();
    const newOrder: Order = {
      id: orderId,
      tour_id: orderData.tour_id,
      customer_id: finalCustomerId || undefined,
      salesperson_id: profile?.id || orderData.user_id,
      created_by: creatorName,
      user_id: orderData.user_id,
      status: orderData.status,
      hold_expiry: holdExpiry,
      invoice_status: 'pending',
      total_price: totalPrice,
      created_at: new Date().toISOString(),
      extension_status: 'none',
      booker_name: orderData.booker_name,
      booker_phone: orderData.booker_phone,
      adult_count: orderData.adult_count || 0,
      child_count: orderData.child_count || 0,
      infant_count: orderData.infant_count || 0,
      single_room_count: orderData.single_room_count || 0,
      room_share_info: orderData.room_share_info,
      vat_option: orderData.vat_option,
      special_requests: orderData.special_requests,
    } as any;

    const newPassengers: Passenger[] = (orderData.passengers || []).map((p, index) => ({
      ...p,
      id: generateSafeUUID(),
      order_id: orderId,
      visa_status: p.needs_visa_service ? 'pending' : 'not_required',
      needs_visa_service: p.needs_visa_service || false,
      visa_submitted_at: (p.passport_url || p.labor_contract_url) ? new Date().toISOString() : undefined
    }));

    // Update tour seats locally
    const updatedTours = tours.map(t => {
      if (t.id === orderData.tour_id) {
        const sold_seats = orderData.status === 'sure' ? t.sold_seats + seatsToLock : t.sold_seats;
        const hold_seats = orderData.status === 'hold' ? t.hold_seats + seatsToLock : t.hold_seats;
        const available_seats = t.total_seats - sold_seats - hold_seats;
        const overbook = t.overbook_limit || 0;
        const totalUsed = sold_seats + hold_seats;
        let seatStatus: 'Còn chỗ' | 'Hết chỗ' | 'Overbooked' = 'Còn chỗ';
        if (totalUsed >= t.total_seats + overbook) {
          seatStatus = 'Hết chỗ';
        } else if (totalUsed >= t.total_seats) {
          seatStatus = 'Overbooked';
        }
        return {
          ...t,
          sold_seats,
          hold_seats,
          available_seats,
          seat_status: seatStatus
        } as Tour;
      }
      return t;
    });

    setOrders(prev => [newOrder, ...prev]);
    setPassengers(prev => [...prev, ...newPassengers]);
    setTours(updatedTours);

    // Notifications
    const newNotifs: Notification[] = [];
    if (orderData.status === 'sure') {
      newNotifs.push({
        id: 'N-acc-' + Date.now(),
        type: 'accounting',
        title: 'Yêu cầu xuất hóa đơn',
        message: `Đơn hàng ${orderId} của khách ${orderData.booker_name || (orderData.passengers && orderData.passengers[0] && orderData.passengers[0].full_name) || 'Giữ Chỗ'} đã sure chỗ. Cần xuất hóa đơn.`,
        targetId: orderId,
        createdAt: new Date().toISOString(),
        read: false
      });
    }

    newPassengers.forEach(p => {
      if (p.passport_url || p.labor_contract_url) {
        newNotifs.push({
          id: 'N-visa-' + Date.now() + '-' + p.id,
          type: 'visa',
          title: 'Khách cần làm Visa',
          message: `Khách hàng ${p.full_name} (${orderId}) đã tải lên hồ sơ visa.`,
          targetId: p.id,
          createdAt: new Date().toISOString(),
          read: false
        });
      }
    });

    if (newNotifs.length > 0) {
      setNotifications(prev => [...newNotifs, ...prev]);
    }

    if (isSupabaseConfigured()) {
      try {
        const { error: bookingError } = await supabase.from('bookings').insert({
          id: orderId,
          customer_id: finalCustomerId,
          tour_id: orderData.tour_id,
          booking_date: new Date().toISOString().substring(0, 10),
          status: orderData.status,
          total_amount: Number(totalPrice),
          paid_amount: 0,
          payment_status: orderData.status === 'sure' ? 'pending' : 'hold',
          seats: Number(seatsToLock),
          passengers: Number(seatsToLock),
          salesperson_id: profile?.id || orderData.user_id,
          created_by: creatorName,
          user_id: orderData.user_id || null,
          hold_expiry: holdExpiry,
          invoice_status: 'pending',
          extension_status: 'none',
          extension_hours: 0,
          is_extended: false,
          booker_name: orderData.booker_name,
          booker_phone: orderData.booker_phone,
          adult_count: Number(orderData.adult_count || 0),
          child_count: Number(orderData.child_count || 0),
          infant_count: Number(orderData.infant_count || 0),
          single_room_count: Number(orderData.single_room_count || 0),
          room_share_info: orderData.room_share_info,
          vat_option: orderData.vat_option || 'no_vat',
          special_requests: orderData.special_requests
        });
        if (bookingError) throw bookingError;

        for (const p of newPassengers) {
          try {
            const { error: pError } = await supabase.from('passengers').insert({
              id: p.id,
              order_id: orderId,
              is_payer: p.is_payer,
              full_name: p.full_name,
              passport_number: p.passport_number,
              phone: p.phone,
              dob: p.dob,
              passport_url: p.passport_url,
              labor_contract_url: p.labor_contract_url,
              visa_status: p.visa_status,
              needs_visa_service: p.needs_visa_service,
              visa_submitted_at: p.visa_submitted_at,
              visa_disqualified_reason: p.visa_disqualified_reason
            });
            if (pError) throw pError;
          } catch (insertErr) {
            console.warn('Lưu ý: Không thể chèn đầy đủ cột cho passenger. Đang thử chèn fallback:', insertErr);
            const { error: fallbackInsertErr } = await supabase.from('passengers').insert({
              id: p.id,
              order_id: orderId,
              is_payer: p.is_payer,
              full_name: p.full_name,
              passport_number: p.passport_number,
              phone: p.phone,
              dob: p.dob,
              passport_url: p.passport_url,
              labor_contract_url: p.labor_contract_url,
              visa_status: p.visa_status
            });
            if (fallbackInsertErr) throw fallbackInsertErr;
          }
        }

        const matchingTour = updatedTours.find(t => t.id === orderData.tour_id);
        if (matchingTour) {
          const { error: tError } = await supabase.from('tours').update({
            sold_seats: Number(matchingTour.sold_seats),
            hold_seats: Number(matchingTour.hold_seats),
            available_seats: Number(matchingTour.available_seats),
            seat_status: matchingTour.seat_status
          }).eq('id', orderData.tour_id);
          if (tError) throw tError;
        }

        for (const n of newNotifs) {
          await supabase.from('system_notifications').insert({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            target_id: n.targetId,
            read: n.read
          });
        }
      } catch (err: any) {
        console.error('Lỗi khi lưu đơn hàng lên Supabase:', err);
        toast.error(`Lỗi lưu cơ sở dữ liệu: ${err.message || JSON.stringify(err)}\n(Đơn hàng vừa tạo sẽ bị huỷ để đảm bảo đồng bộ)`);
        
        // Rollback local state
        setOrders(prev => prev.filter(o => o.id !== orderId));
        setPassengers(prev => prev.filter(p => p.order_id !== orderId));
        
        // Restore tour seats
        setTours(prev => prev.map(t => {
          if (t.id === orderData.tour_id) {
            const sold_seats = orderData.status === 'sure' ? t.sold_seats - seatsToLock : t.sold_seats;
            const hold_seats = orderData.status === 'hold' ? t.hold_seats - seatsToLock : t.hold_seats;
            const available_seats = t.total_seats - sold_seats - hold_seats;
            const overbook = t.overbook_limit || 0;
            const totalUsed = sold_seats + hold_seats;
            let seatStatus: 'Còn chỗ' | 'Hết chỗ' | 'Overbooked' = 'Còn chỗ';
            if (totalUsed >= t.total_seats + overbook) {
              seatStatus = 'Hết chỗ';
            } else if (totalUsed >= t.total_seats) {
              seatStatus = 'Overbooked';
            }
            return {
              ...t,
              sold_seats,
              hold_seats,
              available_seats,
              seat_status: seatStatus
            };
          }
          return t;
        }));
      }
    }
  };

  const addPassengersToOrder = async (orderId: string, passengersData: (Omit<Passenger, 'id' | 'order_id' | 'visa_status'> & { needs_visa_service?: boolean })[]) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newPassengers: Passenger[] = passengersData.map((p, index) => ({
      ...p,
      full_name: p.full_name || (p as any).name || 'Hành khách',
      passport_number: p.passport_number,
      phone: p.phone,
      dob: p.dob,
      passport_url: p.passport_url,
      labor_contract_url: (p as any).labor_contract_url,
      id: generateSafeUUID(),
      order_id: orderId,
      visa_status: p.needs_visa_service ? 'pending' : 'not_required',
      needs_visa_service: p.needs_visa_service || false,
      visa_submitted_at: (p.passport_url || (p as any).labor_contract_url) ? new Date().toISOString() : undefined,
      is_payer: false
    }));

    // Calculate additional visa costs
    const tour = tours.find(t => t.id === order.tour_id);
    if (tour && tour.price_visa_tour) {
      const extraVisaCost = newPassengers.reduce((sum, p) => sum + (p.needs_visa_service ? (tour.price_visa_tour || 0) : 0), 0);
      if (extraVisaCost > 0) {
        const newTotal = order.total_price + extraVisaCost;
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, total_price: newTotal } : o));
        
        if (isSupabaseConfigured()) {
          supabase.from('bookings').update({ total_amount: newTotal }).eq('id', toUuid(orderId))
            .then(({ error }) => {
              if (error) console.error('Lỗi khi cập nhật tổng tiền đơn hàng sau khi thêm khách:', error);
            });
        }
      }
    }

    setPassengers(prev => [...prev, ...newPassengers]);

    if (isSupabaseConfigured()) {
      try {
        for (const p of newPassengers) {
          try {
            const { error: pError } = await supabase.from('passengers').insert({
              id: p.id,
              order_id: toUuid(orderId),
              is_payer: p.is_payer,
              full_name: p.full_name,
              passport_number: p.passport_number,
              phone: p.phone,
              dob: p.dob,
              passport_url: p.passport_url,
              labor_contract_url: p.labor_contract_url,
              visa_status: p.visa_status,
              needs_visa_service: p.needs_visa_service,
              visa_submitted_at: p.visa_submitted_at,
              visa_disqualified_reason: p.visa_disqualified_reason
            });
            if (pError) throw pError;
          } catch (insertErr) {
            console.warn('Lưu ý: Không thể thêm hành khách với đầy đủ cột mới. Đang thử fallback:', insertErr);
            const { error: fallbackInsertErr } = await supabase.from('passengers').insert({
              id: p.id,
              order_id: toUuid(orderId),
              is_payer: p.is_payer,
              full_name: p.full_name,
              passport_number: p.passport_number,
              phone: p.phone,
              dob: p.dob,
              passport_url: p.passport_url,
              labor_contract_url: p.labor_contract_url,
              visa_status: p.visa_status
            });
            if (fallbackInsertErr) throw fallbackInsertErr;
          }
        }
        toast.success('Đã thêm hành khách thành công!');
      } catch (err) {
        console.error('Lỗi khi thêm hành khách trên Supabase:', err);
        toast.error('Lỗi khi thêm hành khách trên máy chủ!');
      }
    } else {
      toast.success('Đã thêm hành khách (Offline)!');
    }
  };

  const cancelOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const tour = tours.find(t => t.id === order.tour_id);
    if (!tour) return;

    const seatsToRelease = order.adult_count !== undefined 
      ? ((order.adult_count || 0) + (order.child_count || 0)) 
      : passengers.filter(p => p.order_id === orderId).length;

    const updatedTours = tours.map(t => {
      if (t.id === order.tour_id) {
        const sold_seats = order.status === 'sure' ? t.sold_seats - seatsToRelease : t.sold_seats;
        const hold_seats = order.status === 'hold' ? t.hold_seats - seatsToRelease : t.hold_seats;
        const available_seats = t.total_seats - sold_seats - hold_seats;
        const overbook = t.overbook_limit || 0;
        const totalUsed = sold_seats + hold_seats;
        let seatStatus: 'Còn chỗ' | 'Hết chỗ' | 'Overbooked' = 'Còn chỗ';
        if (totalUsed >= t.total_seats + overbook) {
          seatStatus = 'Hết chỗ';
        } else if (totalUsed >= t.total_seats) {
          seatStatus = 'Overbooked';
        }
        return {
          ...t,
          sold_seats,
          hold_seats,
          available_seats,
          seat_status: seatStatus
        } as Tour;
      }
      return t;
    });

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o));
    setTours(updatedTours);

    const newNotif = {
      id: 'N-' + Date.now(),
      type: 'accounting' as const,
      title: 'Đơn hàng đã huỷ',
      message: `Đơn hàng ${orderId} đã được huỷ bỏ bởi Sale/Đại lý.`,
      targetId: orderId,
      createdAt: new Date().toISOString(),
      read: false
    };

    setNotifications(prev => [newNotif, ...prev]);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', toUuid(orderId));
        
        const matchingTour = updatedTours.find(t => t.id === order.tour_id);
        if (matchingTour) {
          await supabase.from('tours').update({
            sold_seats: Number(matchingTour.sold_seats),
            hold_seats: Number(matchingTour.hold_seats),
            available_seats: Number(matchingTour.available_seats),
            seat_status: matchingTour.seat_status
          }).eq('id', order.tour_id);
        }

        await supabase.from('system_notifications').insert({
          id: newNotif.id,
          type: newNotif.type,
          title: newNotif.title,
          message: newNotif.message,
          target_id: newNotif.targetId,
          read: newNotif.read
        });
      } catch (err) {
        console.error('Lỗi khi huỷ đơn hàng trên Supabase:', err);
      }
    }
  };

  const confirmOrder = async (orderId: string, passengersData: (Omit<Passenger, 'id' | 'order_id' | 'visa_status'> & { needs_visa_service?: boolean })[]) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== 'hold') return;

    const tour = tours.find(t => t.id === order.tour_id);
    if (!tour) return;

    const seatsToMove = order.adult_count !== undefined 
      ? ((order.adult_count || 0) + (order.child_count || 0)) 
      : passengers.filter(p => p.order_id === orderId).length;

    const updatedTours = tours.map(t => {
      if (t.id === order.tour_id) {
        return {
          ...t,
          hold_seats: Math.max(0, t.hold_seats - seatsToMove),
          sold_seats: t.sold_seats + seatsToMove,
          available_seats: t.total_seats - (t.sold_seats + seatsToMove) - Math.max(0, t.hold_seats - seatsToMove)
        };
      }
      return t;
    });
    setTours(updatedTours);

    const newPassengers: Passenger[] = passengersData.map((p, index) => ({
      ...p,
      full_name: p.full_name || (p as any).name || 'Hành khách',
      passport_number: p.passport_number,
      phone: p.phone,
      dob: p.dob,
      passport_url: p.passport_url,
      labor_contract_url: (p as any).labor_contract_url,
      id: generateSafeUUID(),
      order_id: orderId,
      visa_status: p.needs_visa_service ? 'pending' : 'not_required',
      needs_visa_service: p.needs_visa_service || false,
      visa_submitted_at: (p.passport_url || (p as any).labor_contract_url) ? new Date().toISOString() : undefined,
      is_payer: p.is_payer !== undefined ? p.is_payer : (index === 0)
    }));

    // Recalculate total price including visa services
    let extraVisaCost = 0;
    if (tour.price_visa_tour) {
      extraVisaCost = newPassengers.reduce((sum, p) => sum + (p.needs_visa_service ? (tour.price_visa_tour || 0) : 0), 0);
    }
    const newTotal = order.total_price + extraVisaCost;

    setPassengers(prev => {
      const filtered = prev.filter(p => p.order_id !== orderId);
      return [...filtered, ...newPassengers];
    });

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return { ...o, status: 'sure', hold_expiry: undefined, total_price: newTotal };
      }
      return o;
    }));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('bookings').update({ status: 'sure', hold_expiry: null, total_amount: newTotal }).eq('id', toUuid(orderId));
        await supabase.from('passengers').delete().eq('order_id', toUuid(orderId));

        for (const p of newPassengers) {
          try {
            const { error: pError } = await supabase.from('passengers').insert({
              id: p.id,
              order_id: toUuid(orderId),
              is_payer: p.is_payer,
              full_name: p.full_name,
              passport_number: p.passport_number,
              phone: p.phone,
              dob: p.dob,
              passport_url: p.passport_url,
              labor_contract_url: p.labor_contract_url,
              visa_status: p.visa_status,
              needs_visa_service: p.needs_visa_service,
              visa_submitted_at: p.visa_submitted_at,
              visa_disqualified_reason: p.visa_disqualified_reason
            });
            if (pError) throw pError;
          } catch (insertErr) {
            console.warn('Lưu ý: Không thể xác nhận hành khách với đầy đủ cột mới. Đang thử fallback:', insertErr);
            const { error: fallbackInsertErr } = await supabase.from('passengers').insert({
              id: p.id,
              order_id: toUuid(orderId),
              is_payer: p.is_payer,
              full_name: p.full_name,
              passport_number: p.passport_number,
              phone: p.phone,
              dob: p.dob,
              passport_url: p.passport_url,
              labor_contract_url: p.labor_contract_url,
              visa_status: p.visa_status
            });
            if (fallbackInsertErr) throw fallbackInsertErr;
          }
        }

        const matchingTour = updatedTours.find(t => t.id === order.tour_id);
        if (matchingTour) {
          await supabase.from('tours').update({
            hold_seats: Number(matchingTour.hold_seats),
            sold_seats: Number(matchingTour.sold_seats),
            available_seats: Number(matchingTour.available_seats)
          }).eq('id', order.tour_id);
        }
      } catch (err) {
        console.error('Lỗi khi xác nhận đơn giữ chỗ trên Supabase:', err);
      }
    }
  };

  const requestExtension = async (orderId: string, hours: number) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          extension_status: 'requested',
          extension_hours: hours
        };
      }
      return o;
    }));

    const newNotif = {
      id: 'N-ext-' + Date.now(),
      type: 'extension' as const,
      title: 'Yêu cầu gia hạn giữ chỗ',
      message: `Sale yêu cầu gia hạn giữ chỗ thêm ${hours} tiếng cho đơn hàng ${orderId}.`,
      targetId: orderId,
      createdAt: new Date().toISOString(),
      read: false
    };

    setNotifications(notifPrev => [newNotif, ...notifPrev]);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('bookings').update({
          extension_status: 'requested',
          extension_hours: hours
        }).eq('id', toUuid(orderId));

        await supabase.from('system_notifications').insert({
          id: newNotif.id,
          type: newNotif.type,
          title: newNotif.title,
          message: newNotif.message,
          target_id: newNotif.targetId,
          read: newNotif.read
        });
      } catch (err) {
        console.error('Lỗi khi gửi yêu cầu gia hạn giữ chỗ trên Supabase:', err);
      }
    }
  };

  const handleExtensionRequest = async (orderId: string, approve: boolean) => {
    let newExpiry: string | undefined;
    const extensionStatus = approve ? 'approved' : 'rejected';

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        newExpiry = o.hold_expiry;
        if (approve && o.hold_expiry && o.extension_hours) {
          const currentExpiryTime = new Date(o.hold_expiry).getTime();
          newExpiry = new Date(currentExpiryTime + o.extension_hours * 3600000).toISOString();
        }

        return {
          ...o,
          status: approve ? 'hold' : o.status,
          hold_expiry: newExpiry,
          extension_status: extensionStatus,
          is_extended: approve ? true : o.is_extended
        };
      }
      return o;
    }));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('bookings').update({
          status: approve ? 'hold' : undefined,
          hold_expiry: newExpiry || null,
          extension_status: extensionStatus,
          is_extended: approve ? true : undefined
        }).eq('id', toUuid(orderId));
      } catch (err) {
        console.error('Lỗi khi gia hạn đơn hàng trên Supabase:', err);
      }
    }
  };

  const updateVisaStatus = async (passengerId: string, status: Passenger['visa_status'], reason?: string) => {
    const isDisqualified = status === 'disqualified';
    const now = new Date().toISOString();

    setPassengers(prev => prev.map(p => {
      if (p.id === passengerId) {
        return {
          ...p,
          visa_status: status,
          visa_disqualified_reason: isDisqualified 
            ? (reason !== undefined ? reason : p.visa_disqualified_reason)
            : undefined,
          // Cập nhật thời gian nộp khi chuyển sang trạng thái processing và chưa có thời gian nộp
          visa_submitted_at: status === 'processing' && !p.visa_submitted_at ? now : p.visa_submitted_at
        };
      }
      return p;
    }));

    // Save/delete disqualified reason to localStorage for safety backup
    const disqualifiedReasons = JSON.parse(localStorage.getItem('crm_disqualified_reasons') || '{}');
    if (isDisqualified && reason !== undefined) {
      disqualifiedReasons[passengerId] = reason;
    } else if (!isDisqualified) {
      delete disqualifiedReasons[passengerId];
    }
    localStorage.setItem('crm_disqualified_reasons', JSON.stringify(disqualifiedReasons));
    
    if (isSupabaseConfigured()) {
      try {
        const finalReason = isDisqualified 
          ? (reason !== undefined ? reason : null)
          : null;

        const p = passengers.find(pass => pass.id === passengerId);
        const submittedAt = status === 'processing' && (!p || !p.visa_submitted_at) ? now : (p ? p.visa_submitted_at : null);

        const { error } = await supabase.from('passengers').update({ 
          visa_status: status,
          visa_disqualified_reason: finalReason,
          visa_submitted_at: submittedAt
        }).eq('id', toUuid(passengerId));
        
        if (error) throw error;
      } catch (err) {
        console.warn('Lưu ý: Bảng passengers trên Supabase có thể chưa được cập nhật cột visa_disqualified_reason hoặc visa_submitted_at. Hệ thống tự động chạy chế độ dự phòng.', err);
        try {
          const p = passengers.find(pass => pass.id === passengerId);
          const submittedAt = status === 'processing' && (!p || !p.visa_submitted_at) ? now : (p ? p.visa_submitted_at : null);
          
          await supabase.from('passengers').update({ 
            visa_status: status,
            visa_submitted_at: submittedAt
          }).eq('id', toUuid(passengerId));
        } catch (innerErr) {
          console.error('Lỗi khi cập nhật trạng thái Visa trên Supabase:', innerErr);
        }
      }
    }
  };

  const updatePassenger = async (passengerId: string, updatedData: Partial<Passenger>) => {
    const existing = passengers.find(p => p.id === passengerId);
    let visa_submitted_at = updatedData.visa_submitted_at || existing?.visa_submitted_at;
    let visa_status = updatedData.visa_status || existing?.visa_status;

    // Cập nhật trạng thái visa dựa trên lựa chọn dịch vụ làm visa qua tour
    if (updatedData.needs_visa_service !== undefined) {
      if (updatedData.needs_visa_service === false) {
        // Nếu khách "Đã có visa" -> không cần xử lý visa qua tour
        visa_status = 'not_required';
      } else if (updatedData.needs_visa_service === true && (visa_status === 'not_required' || !visa_status)) {
        // Nếu khách "Chưa có visa" -> chuyển về trạng thái chờ nộp hồ sơ (trừ khi đang xử lý/duyệt rồi)
        visa_status = 'pending';
      }
    }

    let visa_disqualified_reason = updatedData.visa_disqualified_reason !== undefined 
      ? updatedData.visa_disqualified_reason 
      : existing?.visa_disqualified_reason;
    
    // Nếu có passport_url mới hoặc thay đổi, gán ngày giờ nộp hồ sơ
    const hasNewPassport = updatedData.passport_url && (!existing?.passport_url || updatedData.passport_url !== existing?.passport_url);
    const hasNewLaborContract = updatedData.labor_contract_url && (!existing?.labor_contract_url || updatedData.labor_contract_url !== existing?.labor_contract_url);

    if (hasNewPassport || hasNewLaborContract) {
      visa_submitted_at = new Date().toISOString();
      
      // Nếu khách hàng bị hồ sơ chưa đạt, sau khi sửa, upload lại hồ sơ thì sẽ cập nhật lại trạng thái là chờ nộp hồ sơ (pending)
      if (existing?.visa_status === 'disqualified') {
        visa_status = 'pending';
        visa_disqualified_reason = undefined;

        // Xóa note khỏi local storage
        const disqualifiedReasons = JSON.parse(localStorage.getItem('crm_disqualified_reasons') || '{}');
        delete disqualifiedReasons[passengerId];
        localStorage.setItem('crm_disqualified_reasons', JSON.stringify(disqualifiedReasons));
      }
    }

    const finalData = { 
      ...existing, 
      ...updatedData, 
      visa_submitted_at, 
      visa_status, 
      visa_disqualified_reason,
      needs_visa_service: updatedData.needs_visa_service !== undefined ? updatedData.needs_visa_service : existing?.needs_visa_service
    };

    // Recalculate order total if needs_visa_service changed
    if (updatedData.needs_visa_service !== undefined && updatedData.needs_visa_service !== existing?.needs_visa_service && existing?.order_id) {
      const order = orders.find(o => o.id === existing.order_id);
      const tour = tours.find(t => t.id === order?.tour_id);
      if (order && tour && tour.price_visa_tour) {
        const diff = updatedData.needs_visa_service ? tour.price_visa_tour : -tour.price_visa_tour;
        const newTotal = order.total_price + diff;
        
        // Update order in state
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, total_price: newTotal } : o));
        
        // Update order in Supabase
        if (isSupabaseConfigured()) {
          supabase.from('bookings').update({ total_amount: newTotal }).eq('id', toUuid(order.id))
            .then(({ error }) => {
              if (error) console.error('Lỗi khi cập nhật tổng tiền đơn hàng:', error);
            });
        }
      }
    }

    // Luôn lưu trữ dự phòng lý do và thời gian nộp vào LocalStorage để tránh mất dữ liệu do bảng Supabase thiếu cột hoặc đồng bộ chậm
    const disqualifiedReasons = JSON.parse(localStorage.getItem('crm_disqualified_reasons') || '{}');
    if (visa_disqualified_reason) {
      disqualifiedReasons[passengerId] = visa_disqualified_reason;
    } else {
      delete disqualifiedReasons[passengerId];
    }
    localStorage.setItem('crm_disqualified_reasons', JSON.stringify(disqualifiedReasons));

    const submittedAts = JSON.parse(localStorage.getItem('crm_visa_submitted_ats') || '{}');
    if (visa_submitted_at) {
      submittedAts[passengerId] = visa_submitted_at;
    } else {
      delete submittedAts[passengerId];
    }
    localStorage.setItem('crm_visa_submitted_ats', JSON.stringify(submittedAts));

    setPassengers(prev => prev.map(p => p.id === passengerId ? { ...p, ...finalData } : p));
    
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('passengers').update({
          full_name: finalData.full_name,
          passport_number: finalData.passport_number,
          phone: finalData.phone,
          dob: finalData.dob,
          passport_url: finalData.passport_url,
          labor_contract_url: finalData.labor_contract_url,
          visa_status: finalData.visa_status,
          needs_visa_service: finalData.needs_visa_service,
          visa_submitted_at: finalData.visa_submitted_at,
          visa_disqualified_reason: finalData.visa_disqualified_reason
        }).eq('id', toUuid(passengerId));
        
        if (error) throw error;
      } catch (err: any) {
        console.warn('Lưu ý: Bảng passengers trên Supabase có thể chưa được cập nhật một số cột mới. Hệ thống sẽ tự động chạy chế độ dự phòng (fallback).', err);
        try {
          const { error: fallbackErr } = await supabase.from('passengers').update({
            full_name: finalData.full_name,
            passport_number: finalData.passport_number,
            phone: finalData.phone,
            dob: finalData.dob,
            passport_url: finalData.passport_url,
            labor_contract_url: finalData.labor_contract_url,
            visa_status: finalData.visa_status
          }).eq('id', toUuid(passengerId));
          
          if (fallbackErr) throw fallbackErr;
        } catch (innerErr) {
          console.warn('Lỗi dự phòng khi cập nhật hành khách:', innerErr);
        }
      }
    }
  };

  const deletePassenger = async (passengerId: string) => {
    // Optimistic update
    setPassengers(prev => prev.filter(p => p.id !== passengerId));

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('passengers').delete().eq('id', toUuid(passengerId));
        if (error) throw error;
        toast.success('Đã xóa hành khách thành công!');
      } catch (err) {
        console.error('Lỗi khi xóa hành khách trên Supabase:', err);
        toast.error('Lỗi khi xóa hành khách trên máy chủ!');
      }
    } else {
      toast.success('Đã xóa hành khách (Chế độ Offline)!');
    }
  };

  const updateOrder = async (orderId: string, updatedData: Partial<Order>) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updatedData } : o));
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('bookings').update({
          single_room_count: updatedData.single_room_count !== undefined ? Number(updatedData.single_room_count) : undefined,
          room_share_info: updatedData.room_share_info,
          vat_option: updatedData.vat_option,
          special_requests: updatedData.special_requests,
          total_amount: updatedData.total_price !== undefined ? Number(updatedData.total_price) : undefined
        }).eq('id', toUuid(orderId));
      } catch (err) {
        console.error('Lỗi khi cập nhật đơn hàng trên Supabase:', err);
      }
    }
  };

  const updateInvoiceStatus = async (orderId: string, status: Order['invoice_status']) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, invoice_status: status } : o));
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('bookings').update({ invoice_status: status }).eq('id', toUuid(orderId));
      } catch (err) {
        console.error('Lỗi khi cập nhật trạng thái xuất hóa đơn trên Supabase:', err);
      }
    }
  };

  return (
    <CRMContext.Provider value={{
      tours,
      orders,
      passengers,
      notifications,
      currentRole,
      setCurrentRole,
      categories,
      addCategory,
      deleteCategory,
      updateCategory,
      addTour,
      updateTour,
      deleteTour,
      createOrder,
      confirmOrder,
      cancelOrder,
      requestExtension,
      handleExtensionRequest,
      updateVisaStatus,
      updatePassenger,
      deletePassenger,
      addPassengersToOrder,
      updateOrder,
      updateInvoiceStatus,
      releaseExpiredHolds,
      membershipSettings,
      updateMembershipSettings
    }}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
};
