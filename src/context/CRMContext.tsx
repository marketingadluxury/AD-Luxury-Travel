import toast from 'react-hot-toast';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Tour, Order, Passenger, Role, MembershipSettings, Invoice, TourCost, PartnerPayment, ActivityLog, PaymentProposal } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth, UserProfile } from './AuthContext';

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
  type: 'visa' | 'accounting' | 'extension' | 'order' | 'system';
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
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  profilesList: UserProfile[];
  refreshProfiles: () => Promise<void>;
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
    vat_company_name?: string;
    vat_tax_code?: string;
    vat_address?: string;
    vat_email?: string;
    special_requests?: string;
    discount_type?: 'percent' | 'amount';
    discount_value?: number;
    surcharge_name?: string;
    surcharge_amount?: number;
    is_locked?: boolean;
  }) => void;
  confirmOrder: (orderId: string, passengersData: Omit<Passenger, 'id' | 'order_id' | 'visa_status'>[]) => void;
  cancelOrder: (orderId: string, reason?: string) => void;
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
  visaCommonFiles: { name: string; url: string }[];
  updateVisaCommonFiles: (files: { name: string; url: string }[]) => Promise<void>;
  invoices: Invoice[];
  createInvoiceReceipt: (invoiceData: Omit<Invoice, 'id' | 'status' | 'created_at'>) => Promise<Invoice>;
  approveInvoiceReceipt: (invoiceId: string, verifierName: string, fileUrl?: string) => Promise<void>;
  rejectInvoiceReceipt: (invoiceId: string, verifierName: string) => Promise<void>;
  uploadInvoiceProof: (invoiceId: string, fileUrl: string) => Promise<void>;
  deleteInvoiceReceipt: (invoiceId: string) => Promise<void>;
  tourCosts: TourCost[];
  updateTourCost: (tourId: string, costData: Partial<TourCost>) => Promise<void>;
  activityLogs: ActivityLog[];
  logActivity: (logData: { action: string; module: ActivityLog['module']; details?: string }) => Promise<void>;
  clearActivityLogs: () => Promise<void>;
  paymentProposals: PaymentProposal[];
  createPaymentProposal: (proposalData: Omit<PaymentProposal, 'id' | 'code' | 'created_at' | 'leader_status' | 'accounting_status' | 'status'>) => Promise<PaymentProposal>;
  approvePaymentProposalLeader: (id: string, leaderName: string, leaderNote?: string) => Promise<void>;
  rejectPaymentProposalLeader: (id: string, leaderName: string, leaderNote?: string) => Promise<void>;
  approvePaymentProposalAccounting: (id: string, accountingName: string, accountingNote?: string, proofUrl?: string) => Promise<void>;
  rejectPaymentProposalAccounting: (id: string, accountingName: string, accountingNote?: string) => Promise<void>;
  deletePaymentProposal: (id: string) => Promise<void>;
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

export const canUnlockOrder = (
  order: Order | null,
  currentRole: Role,
  currentProfile: UserProfile | null,
  profilesList: UserProfile[]
): boolean => {
  if (!order || !currentProfile) return false;
  // 1. Admin can unlock any booking
  if (currentRole === 'admin') return true;

  // 2. Only Sale Leader can unlock bookings
  if (currentRole !== 'sale_leader') return false;

  // 3. Sale Leader can unlock if they created the booking themselves
  if (
    (order.user_id && order.user_id === currentProfile.id) ||
    (order.salesperson_id && order.salesperson_id === currentProfile.id) ||
    (order.created_by && currentProfile.full_name && order.created_by.toLowerCase().trim() === currentProfile.full_name.toLowerCase().trim()) ||
    (order.created_by && currentProfile.email && order.created_by.toLowerCase().trim() === currentProfile.email.toLowerCase().trim())
  ) {
    return true;
  }

  // 4. Sale Leader can unlock if the creator of the booking belongs to their team (creator's leader_id === currentProfile.id)
  const creatorProfile = profilesList.find(p => 
    (p.id && order.user_id && p.id === order.user_id) || 
    (p.id && order.salesperson_id && p.id === order.salesperson_id) || 
    (p.full_name && order.created_by && p.full_name.toLowerCase().trim() === order.created_by.toLowerCase().trim()) ||
    (p.email && order.created_by && p.email.toLowerCase().trim() === order.created_by.toLowerCase().trim())
  );

  if (creatorProfile && creatorProfile.leader_id === currentProfile.id) {
    return true;
  }

  return false;
};

export const CRMProvider: React.FC<{ children: React.ReactNode; initialRole?: Role }> = ({ children, initialRole = 'admin' }) => {
  const { user, profile } = useAuth();
  const [tours, setTours] = useState<Tour[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [profilesList, setProfilesList] = useState<UserProfile[]>([]);

  const refreshProfiles = async () => {
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.from('profiles').select('*');
        if (!error && data) {
          setProfilesList(data as UserProfile[]);
          return;
        }
      }
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setProfilesList(data);
      }
    } catch (err) {
      console.warn('Lỗi khi tải danh sách profiles:', err);
    }
  };

  const markNotificationAsRead = async (notifId: string) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('system_notifications').update({ read: true }).eq('id', notifId);
      } catch (err) {
        console.error('Lỗi khi đánh dấu đã đọc thông báo:', err);
      }
    }
  };

  const markAllNotificationsAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('system_notifications').update({ read: true }).eq('read', false);
      } catch (err) {
        console.error('Lỗi khi đánh dấu tất cả đã đọc thông báo:', err);
      }
    }
  };

  const addSystemNotification = async (notif: Notification) => {
    setNotifications(prev => {
      const updated = [notif, ...prev];
      try {
        localStorage.setItem('crm_notifications', JSON.stringify(updated.slice(0, 100)));
      } catch (e) {
        console.error('Lỗi khi lưu notification vào LocalStorage:', e);
      }
      return updated;
    });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('system_notifications').insert({
          id: notif.id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          target_id: notif.targetId || null,
          created_at: notif.createdAt,
          read: notif.read
        });
      } catch (e) {
        console.warn('Lưu notification vào DB thất bại:', e);
      }
    }
  };
  const [categories, setCategories] = useState<string[]>([]);
  const [membershipSettings, setMembershipSettings] = useState<MembershipSettings>({
    silverMin: 20000000,
    goldMin: 50000000,
    platinumMin: 100000000
  });
  const [currentRole, setCurrentRole] = useState<Role>(initialRole);
  const [visaCommonFiles, setVisaCommonFiles] = useState<{ name: string; url: string }[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tourCosts, setTourCosts] = useState<TourCost[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [paymentProposals, setPaymentProposals] = useState<PaymentProposal[]>([]);

  const logActivity = async (logData: {
    action: string;
    module: ActivityLog['module'];
    details?: string;
  }) => {
    const userName = profile?.full_name || user?.email || 'Người dùng hệ thống';
    const userEmail = user?.email || '';
    const userRole = currentRole;
    const userId = user?.id || profile?.id;

    const newLog: ActivityLog = {
      id: generateSafeUUID(),
      user_id: userId,
      user_name: userName,
      user_email: userEmail,
      user_role: userRole,
      action: logData.action,
      module: logData.module,
      details: logData.details || '',
      created_at: new Date().toISOString()
    };

    setActivityLogs(prev => [newLog, ...prev]);

    try {
      const existing = localStorage.getItem('crm_activity_logs');
      const parsed = existing ? JSON.parse(existing) : [];
      const updated = [newLog, ...parsed].slice(0, 500);
      localStorage.setItem('crm_activity_logs', JSON.stringify(updated));
    } catch (e) {
      console.error('Lỗi khi lưu activity log vào LocalStorage:', e);
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('activity_logs').insert({
          id: newLog.id,
          user_id: newLog.user_id || null,
          user_name: newLog.user_name,
          user_email: newLog.user_email,
          user_role: newLog.user_role,
          action: newLog.action,
          module: newLog.module,
          details: newLog.details,
          created_at: newLog.created_at
        });
      } catch (err) {
        console.warn('Ghi log thao tác lên Supabase thất bại:', err);
      }
    }
  };

  const clearActivityLogs = async () => {
    setActivityLogs([]);
    localStorage.removeItem('crm_activity_logs');
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.error(e);
      }
    }
    toast.success('Đã xóa toàn bộ lịch sử nhật ký thao tác');
  };

  useEffect(() => {
    setCurrentRole(initialRole);
  }, [initialRole]);

  // Load Initial Data (either from Supabase or Fallback to LocalStorage)
  useEffect(() => {
    const loadCRMData = async () => {
      refreshProfiles();
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
              sold_seats: Math.max(0, Number(t.sold_seats || 0)),
              hold_seats: Math.max(0, Number(t.hold_seats || 0)),
              available_seats: Number(t.total_seats) - Math.max(0, Number(t.sold_seats || 0)) - Math.max(0, Number(t.hold_seats || 0)),
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
              ticket_deadline: t.ticket_deadline,
              description: t.description,
              tour_status: t.tour_status,
              category: t.category,
              hold_duration_hours: Number(t.hold_duration_hours || 48),
              overbook_limit: Number(t.overbook_limit || 0),
              price_adult: Number(t.price_adult !== undefined ? t.price_adult : (t.price || 0)),
              price_child: Number(t.price_child || 0),
              price_infant: Number(t.price_infant || 0),
              single_room_surcharge: Number(t.single_room_surcharge || 0),
                   discount: Number(t.discount || 0),
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
                  ticket_deadline: t.ticket_deadline,
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
              vat_company_name: b.vat_company_name,
              vat_tax_code: b.vat_tax_code,
              vat_address: b.vat_address,
              vat_email: b.vat_email,
              special_requests: b.special_requests,
              discount_type: b.discount_type,
              discount_value: Number(b.discount_value || 0),
              surcharge_name: b.surcharge_name,
              surcharge_amount: Number(b.surcharge_amount || 0),
              contract_url: b.contract_url,
              is_locked: b.is_locked || false
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
              visa_disqualified_reason: p.visa_disqualified_reason || storedReasons[p.id] || undefined,
              gender: p.gender,
              nationality: p.nationality,
              passport_issue_date: p.passport_issue_date,
              passport_expiry_date: p.passport_expiry_date
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

        // 3.5. Invoices
        let fetchedInvoices: Invoice[] = [];
        try {
          const { data: invoicesData, error: invoicesErr } = await supabase.from('invoices').select('*');
          if (invoicesErr) throw invoicesErr;
          if (invoicesData && invoicesData.length > 0) {
            fetchedInvoices = invoicesData.map(inv => ({
              id: inv.id,
              order_id: inv.order_id,
              amount: Number(inv.amount),
              status: inv.status as any,
              type: inv.type as any,
              payment_method: inv.payment_method,
              description: inv.description,
              invoice_code: inv.invoice_code,
              file_url: inv.file_url,
              created_by: inv.created_by,
              verified_by: inv.verified_by,
              verified_at: inv.verified_at,
              created_at: inv.created_at,
              refund_method: inv.refund_method,
              refund_bank_name: inv.refund_bank_name,
              refund_account_number: inv.refund_account_number,
              refund_account_name: inv.refund_account_name ? String(inv.refund_account_name).toUpperCase() : undefined
            }));
            setInvoices(fetchedInvoices);
            console.log('Đã nạp thành công Invoices từ Supabase');

            // AUTO-FIX & SYNC: Ensure orders with approved invoices have correct status ('sure'/'paid'), paid_amount, payment_status, and clean booker_name
            if (fetchedInvoices.length > 0 && fetchedOrders.length > 0) {
               const refundOrderIds = new Set(fetchedInvoices.filter(i => i.type === 'payment' && i.order_id).map(i => i.order_id));
               
               // Approved receipt amounts per order
               const approvedReceiptSums: Record<string, number> = {};
               fetchedInvoices.forEach(inv => {
                 if (inv.order_id && inv.type === 'receipt' && inv.status === 'approved') {
                   approvedReceiptSums[inv.order_id] = (approvedReceiptSums[inv.order_id] || 0) + (inv.amount || 0);
                 }
               });

               const newFetchedOrders = fetchedOrders.map(o => {
                 let status = o.status;
                 let paymentStatus = o.payment_status;
                 let bookerName = o.booker_name;
                 const approvedSum = approvedReceiptSums[o.id] !== undefined ? approvedReceiptSums[o.id] : (o.paid_amount || 0);

                 // If refund exists and not cancelled, fix status to cancelled
                 if (refundOrderIds.has(o.id) && status !== 'cancelled') {
                   status = 'cancelled';
                   if (isSupabaseConfigured()) {
                     supabase.from('bookings').update({ status: 'cancelled' }).eq('id', o.id).then(({error}) => {
                       if (error) console.warn('Auto-fix DB update failed:', error);
                     });
                   }
                 }

                 // If has approved payments
                 if (approvedSum > 0 && status !== 'cancelled') {
                   if (status === 'hold') {
                     status = 'sure';
                   }
                   if (approvedSum >= o.total_price) {
                     paymentStatus = 'paid';
                     status = 'paid';
                   } else {
                     paymentStatus = 'partially_paid';
                   }
                 }

                 // Clean booker_name if order is sure/paid/has payment but still contains "Giữ chỗ tạm"
                 if ((status === 'sure' || status === 'paid' || approvedSum > 0) && bookerName && bookerName.includes('Giữ chỗ tạm')) {
                   const orderPassengers = (passengers || []).filter(p => p.order_id === o.id);
                   const leadPassenger = orderPassengers.find(p => p.is_payer) || orderPassengers[0];
                   bookerName = (leadPassenger && leadPassenger.full_name && !leadPassenger.full_name.includes('Giữ chỗ tạm'))
                     ? leadPassenger.full_name
                     : 'Chưa cung cấp';
                 }

                 const changed = o.status !== status || o.payment_status !== paymentStatus || o.paid_amount !== approvedSum || o.booker_name !== bookerName;
                 if (changed) {
                   if (isSupabaseConfigured()) {
                     supabase.from('bookings').update({
                       status,
                       payment_status: paymentStatus,
                       paid_amount: approvedSum,
                       booker_name: bookerName,
                       hold_expiry: (status === 'sure' || status === 'paid') ? null : o.hold_expiry
                     }).eq('id', o.id).then(({ error }) => {
                       if (error) console.warn('Auto-sync booking update failed:', error);
                     });
                   }
                   return {
                     ...o,
                     status,
                     payment_status: paymentStatus,
                     paid_amount: approvedSum,
                     booker_name: bookerName
                   } as Order;
                 }
                 return o;
               });

               setOrders(newFetchedOrders);
               fetchedOrders = newFetchedOrders;
            }

          } else {
            setInvoices([]);
          }
        } catch (err) {
          console.warn('Lỗi khi tải Invoices từ Supabase (sử dụng fallback local):', err);
          const savedInvoices = localStorage.getItem('crm_invoices');
          fetchedInvoices = savedInvoices ? JSON.parse(savedInvoices) : [];
          setInvoices(fetchedInvoices);
        }

        // 3.6. Payment Proposals
        try {
          const { data: proposalsData, error: proposalsErr } = await supabase
            .from('payment_proposals')
            .select('*')
            .order('created_at', { ascending: false });
          if (proposalsErr) throw proposalsErr;

          if (proposalsData && proposalsData.length > 0) {
            setPaymentProposals(proposalsData.map(p => ({
              ...p,
              amount: Number(p.amount)
            })));
            console.log('Đã nạp thành công Payment Proposals từ Supabase');
          } else {
            const savedProps = localStorage.getItem('crm_payment_proposals');
            if (savedProps) setPaymentProposals(JSON.parse(savedProps));
          }
        } catch (err) {
          console.warn('Lỗi khi tải Payment Proposals từ Supabase (sử dụng fallback local):', err);
          const savedProps = localStorage.getItem('crm_payment_proposals');
          if (savedProps) setPaymentProposals(JSON.parse(savedProps));
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
                message: 'Khách hàng Nguyễn Văn Nam (Booking O-1001) đã tải lên đầy đủ giấy tờ cần xét duyệt visa.',
                targetId: 'P-101',
                createdAt: new Date(Date.now() - 3600000).toISOString(),
                read: false
              },
              {
                id: 'N-2',
                type: 'accounting',
                title: 'Yêu cầu xuất hóa đơn',
                message: 'Booking O-1001 đã sure chỗ. Cần xuất hóa đơn VAT.',
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

        // 7. Visa Common Files
        try {
          const { data: visaFilesData, error: visaFilesErr } = await supabase.from('app_settings').select('value').eq('key', 'visa_common_files').maybeSingle();
          if (visaFilesErr) throw visaFilesErr;

          if (visaFilesData && visaFilesData.value) {
            setVisaCommonFiles(visaFilesData.value as { name: string; url: string }[]);
            console.log('Đã nạp thành công Visa Common Files từ Supabase');
          } else {
            setVisaCommonFiles([]);
          }
        } catch (err) {
          console.warn('Lỗi khi tải Visa Common Files từ Supabase (sử dụng fallback local):', err);
          const savedVisaFiles = localStorage.getItem('crm_visa_common_files');
          setVisaCommonFiles(savedVisaFiles ? JSON.parse(savedVisaFiles) : []);
        }

        // 8. Tour Costs
        try {
          // Thử tải từ bảng tour_costs chuyên biệt trước
          const { data: tcTableData, error: tcTableErr } = await supabase.from('tour_costs').select('*');
          
          const savedCosts = localStorage.getItem('crm_tour_costs');
          const localParsed: TourCost[] = savedCosts ? JSON.parse(savedCosts) : [];

          // Nếu bảng tour_costs tồn tại và không bị lỗi schema/RLS (code 42P01 là bảng chưa tồn tại)
          const isTableMissing = tcTableErr && (tcTableErr.code === '42P01' || (tcTableErr.message && tcTableErr.message.includes('relation "tour_costs" does not exist')));

          if (!isTableMissing && tcTableData) {
            console.log('Phát hiện bảng tour_costs chuyên biệt, đang nạp dữ liệu...');
            const remoteCosts: TourCost[] = tcTableData.map(row => ({
              tourId: row.tour_id,
              flightAmount: Number(row.flight_amount || 0),
              insuranceAmount: Number(row.insurance_amount || 0),
              tourGuideAmount: Number(row.tour_guide_amount || 0),
              giftAmount: Number(row.gift_amount || 0),
              commissionAmount: Number(row.commission_amount || 0),
              advertisingAmount: Number(row.advertising_amount || 0),
              otherAmount: Number(row.other_amount || 0),
              visaAmount: Number(row.visa_amount || 0),
              landtours: Array.isArray(row.landtours) ? row.landtours : (typeof row.landtours === 'string' ? JSON.parse(row.landtours || '[]') : []),
              partnerPayments: Array.isArray(row.partner_payments) ? row.partner_payments : (typeof row.partner_payments === 'string' ? JSON.parse(row.partner_payments || '[]') : []),
              updatedAt: row.updated_at || new Date().toISOString()
            }));

            // Merge với local storage dựa trên updatedAt
            const costsMap = new Map<string, TourCost>();
            localParsed.forEach(c => costsMap.set(c.tourId, c));
            remoteCosts.forEach(rc => {
              const lc = costsMap.get(rc.tourId);
              if (!lc) {
                costsMap.set(rc.tourId, rc);
              } else {
                const remoteTime = rc.updatedAt ? new Date(rc.updatedAt).getTime() : 0;
                const localTime = lc.updatedAt ? new Date(lc.updatedAt).getTime() : 0;
                if (remoteTime >= localTime) {
                  costsMap.set(rc.tourId, rc);
                }
              }
            });

            const finalCosts = Array.from(costsMap.values());
            setTourCosts(finalCosts);
            console.log('Đã nạp và hợp nhất Tour Costs từ bảng chuyên biệt & LocalStorage');

            // Đồng bộ ngược các dữ liệu local mới hơn lên bảng tour_costs
            finalCosts.forEach(async (c) => {
              const remoteMatch = remoteCosts.find(rc => rc.tourId === c.tourId);
              if (!remoteMatch || new Date(c.updatedAt).getTime() > new Date(remoteMatch.updatedAt).getTime()) {
                await supabase.from('tour_costs').upsert({
                  tour_id: c.tourId,
                  flight_amount: c.flightAmount,
                  insurance_amount: c.insuranceAmount,
                  tour_guide_amount: c.tourGuideAmount,
                  gift_amount: c.giftAmount,
                  commission_amount: c.commissionAmount,
                  advertising_amount: c.advertisingAmount,
                  other_amount: c.otherAmount || 0,
                  visa_amount: c.visaAmount || 0,
                  landtours: c.landtours,
                  partner_payments: c.partnerPayments,
                  updated_at: c.updatedAt
                });
              }
            });
          } else {
            // Fallback về bảng app_settings cũ
            console.log('Bảng tour_costs chưa có hoặc lỗi, sử dụng fallback app_settings...');
            const { data: costData, error: costErr } = await supabase.from('app_settings').select('value').eq('key', 'tour_costs').maybeSingle();
            if (costErr) throw costErr;

            let finalCosts: TourCost[] = [];

            if (costData && costData.value) {
              let rawRemote = costData.value;
              if (typeof rawRemote === 'string') {
                try { rawRemote = JSON.parse(rawRemote); } catch(e) {}
              }
              const remoteCosts = Array.isArray(rawRemote) ? rawRemote as TourCost[] : [];
              
              const costsMap = new Map<string, TourCost>();
              localParsed.forEach(c => costsMap.set(c.tourId, c));
              remoteCosts.forEach(rc => {
                const lc = costsMap.get(rc.tourId);
                if (!lc) {
                  costsMap.set(rc.tourId, rc);
                } else {
                  const remoteTime = rc.updatedAt ? new Date(rc.updatedAt).getTime() : 0;
                  const localTime = lc.updatedAt ? new Date(lc.updatedAt).getTime() : 0;
                  if (remoteTime >= localTime) {
                    costsMap.set(rc.tourId, rc);
                  }
                }
              });

              finalCosts = Array.from(costsMap.values());
              setTourCosts(finalCosts);
              console.log('Đã nạp và hợp nhất Tour Costs từ app_settings & LocalStorage');

              if (JSON.stringify(finalCosts) !== JSON.stringify(remoteCosts)) {
                supabase.from('app_settings').upsert({
                  key: 'tour_costs',
                  value: finalCosts,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'key' }).then();
              }
            } else if (localParsed.length > 0) {
              setTourCosts(localParsed);
              console.log('Khôi phục Tour Costs từ LocalStorage (Supabase app_settings trống)');
              supabase.from('app_settings').upsert({
                key: 'tour_costs',
                value: localParsed,
                updated_at: new Date().toISOString()
              }, { onConflict: 'key' }).then();
            } else {
              setTourCosts([]);
            }
          }
          // Tải Activity Logs
          try {
            const { data: logsData } = await supabase
              .from('activity_logs')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(300);
            if (logsData && logsData.length > 0) {
              const mappedLogs: ActivityLog[] = logsData.map(l => ({
                id: l.id,
                user_id: l.user_id,
                user_name: l.user_name || 'Người dùng',
                user_email: l.user_email || '',
                user_role: (l.user_role as Role) || 'CTV',
                action: l.action,
                module: l.module as ActivityLog['module'],
                details: l.details || '',
                created_at: l.created_at || new Date().toISOString()
              }));
              setActivityLogs(mappedLogs);
            } else {
              const savedLogs = localStorage.getItem('crm_activity_logs');
              setActivityLogs(savedLogs ? JSON.parse(savedLogs) : []);
            }
          } catch (err) {
            const savedLogs = localStorage.getItem('crm_activity_logs');
            setActivityLogs(savedLogs ? JSON.parse(savedLogs) : []);
          }
        } catch (err) {
          console.warn('Lỗi khi tải Tour Costs từ Supabase (sử dụng fallback local):', err);
          const savedCosts = localStorage.getItem('crm_tour_costs');
          setTourCosts(savedCosts ? JSON.parse(savedCosts) : []);
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
          message: 'Booking chắc chắn O-1001 đã được xác nhận. Vui lòng kiểm tra và xuất hóa đơn.',
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

      const savedVisaFiles = localStorage.getItem('crm_visa_common_files');
      setVisaCommonFiles(savedVisaFiles ? JSON.parse(savedVisaFiles) : []);

      const savedInvoices = localStorage.getItem('crm_invoices');
      setInvoices(savedInvoices ? JSON.parse(savedInvoices) : []);

      const savedCosts = localStorage.getItem('crm_tour_costs');
      setTourCosts(savedCosts ? JSON.parse(savedCosts) : []);

      const savedLogs = localStorage.getItem('crm_activity_logs');
      setActivityLogs(savedLogs ? JSON.parse(savedLogs) : []);
    };

    loadCRMData();
  }, [user?.id]);

  // Sync state changes to fallback LocalStorage only (Supabase is handled on action trigger)
  useEffect(() => {
    if (!isSupabaseConfigured() && invoices.length > 0) {
      localStorage.setItem('crm_invoices', JSON.stringify(invoices));
    }
  }, [invoices]);

  useEffect(() => {
    if (paymentProposals.length > 0) {
      localStorage.setItem('crm_payment_proposals', JSON.stringify(paymentProposals));
    }
  }, [paymentProposals]);

  useEffect(() => {
    if (tourCosts.length > 0) {
      localStorage.setItem('crm_tour_costs', JSON.stringify(tourCosts));
    }
  }, [tourCosts]);

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

  useEffect(() => {
    if (!isSupabaseConfigured() && visaCommonFiles.length > 0) {
      localStorage.setItem('crm_visa_common_files', JSON.stringify(visaCommonFiles));
    }
  }, [visaCommonFiles]);

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

  const updateVisaCommonFiles = async (files: { name: string; url: string }[]) => {
    setVisaCommonFiles(files);
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('app_settings').upsert({
          key: 'visa_common_files',
          value: files,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.error('Lỗi khi lưu danh sách file mẫu visa chung lên Supabase:', err);
      }
    } else {
      localStorage.setItem('crm_visa_common_files', JSON.stringify(files));
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
    logActivity({ action: 'Tạo Danh mục sản phẩm mới', module: 'Hệ thống', details: `Tên danh mục: ${trimmed}` });

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
    logActivity({ action: 'Xóa Danh mục sản phẩm', module: 'Hệ thống', details: `Tên danh mục: ${categoryName}` });

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
    
    const initialChanges = [
      { field: 'Mã Tour', old: 'Tạo mới', new: newTour.code || id },
      { field: 'Tên Tour', old: 'Tạo mới', new: newTour.name || 'Tour mới' },
      { field: 'Giá vé người lớn', old: '0 đ', new: `${priceAdult.toLocaleString('vi-VN')} đ` },
      { field: 'Tổng số chỗ mở bán', old: '0 chỗ', new: `${totalSeats} chỗ` }
    ];
    if (newTour.ticket_deadline) {
      initialChanges.push({ field: 'Hạn xuất vé', old: 'Chưa có', new: newTour.ticket_deadline });
    }
    if (newTour.visa_deadline) {
      initialChanges.push({ field: 'Hạn nộp Visa', old: 'Chưa có', new: newTour.visa_deadline });
    }
    if (newTour.category) {
      initialChanges.push({ field: 'Danh mục', old: 'Chưa chọn', new: newTour.category });
    }

    const createTourLogDetails = JSON.stringify({
      info: `Mã tour: ${newTour.code || id} - ${newTour.name || 'Tour mới'}`,
      changes: initialChanges
    });

    // Thêm vào local state ngay lập tức
    setTours(prev => [...prev, newTour]);
    logActivity({ action: 'Tạo Tour mới', module: 'Tour', details: createTourLogDetails });

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
          ticket_deadline: cleanValueForSupabase(tourData.ticket_deadline),
          description: cleanValueForSupabase(tourData.description),
          category: cleanValueForSupabase(tourData.category),
          hold_duration_hours: cleanValueForSupabase(tourData.hold_duration_hours || 48, true),
          overbook_limit: cleanValueForSupabase(tourData.overbook_limit, true),
          price_adult: priceAdult,
          price_child: cleanValueForSupabase(tourData.price_child, true),
          price_infant: cleanValueForSupabase(tourData.price_infant, true),
          single_room_surcharge: cleanValueForSupabase(tourData.single_room_surcharge, true),
          discount: cleanValueForSupabase(tourData.discount, true),
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

    const existingTour = tours.find(t => t.id === updatedTour.id);
    const tourChanges: { field: string; old: string; new: string }[] = [];

    const formatLogDate = (val?: string) => {
      if (!val || !val.trim()) return 'Chưa thiết lập';
      const str = val.trim();
      try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          if (str.includes('T') || str.includes(':')) {
            const hours = String(d.getHours()).padStart(2, '0');
            const mins = String(d.getMinutes()).padStart(2, '0');
            return `${hours}:${mins} ${day}/${month}/${year}`;
          }
          return `${day}/${month}/${year}`;
        }
      } catch (e) {
        // ignore
      }
      return str;
    };

    const formatMoney = (val?: number) => `${Number(val || 0).toLocaleString('vi-VN')} đ`;

    if (existingTour) {
      if ((existingTour.name || '') !== (updatedTour.name || '')) {
        tourChanges.push({ field: 'Tên Tour', old: existingTour.name || 'Trống', new: updatedTour.name || 'Trống' });
      }
      if ((existingTour.code || '') !== (updatedTour.code || '')) {
        tourChanges.push({ field: 'Mã Tour', old: existingTour.code || 'Trống', new: updatedTour.code || 'Trống' });
      }
      if ((existingTour.category || '') !== (updatedTour.category || '')) {
        tourChanges.push({ field: 'Danh mục sản phẩm', old: existingTour.category || 'Trống', new: updatedTour.category || 'Trống' });
      }
      
      const oldPrice = Number(existingTour.price_adult || existingTour.price || 0);
      const newPrice = Number(updatedTour.price_adult || updatedTour.price || 0);
      if (oldPrice !== newPrice) {
        tourChanges.push({ field: 'Giá vé người lớn', old: formatMoney(oldPrice), new: formatMoney(newPrice) });
      }

      const oldChild = Number(existingTour.price_child || 0);
      const newChild = Number(updatedTour.price_child || 0);
      if (oldChild !== newChild) {
        tourChanges.push({ field: 'Giá vé trẻ em', old: formatMoney(oldChild), new: formatMoney(newChild) });
      }

      const oldInfant = Number(existingTour.price_infant || 0);
      const newInfant = Number(updatedTour.price_infant || 0);
      if (oldInfant !== newInfant) {
        tourChanges.push({ field: 'Giá vé em bé', old: formatMoney(oldInfant), new: formatMoney(newInfant) });
      }

      const oldSingleRoom = Number(existingTour.single_room_surcharge || 0);
      const newSingleRoom = Number(updatedTour.single_room_surcharge || 0);
      if (oldSingleRoom !== newSingleRoom) {
        tourChanges.push({ field: 'Phụ thu phòng đơn', old: formatMoney(oldSingleRoom), new: formatMoney(newSingleRoom) });
      }

      const oldDiscount = Number(existingTour.discount || 0);
      const newDiscount = Number(updatedTour.discount || 0);
      if (oldDiscount !== newDiscount) {
        tourChanges.push({ field: 'Giảm giá / Ưu đãi', old: formatMoney(oldDiscount), new: formatMoney(newDiscount) });
      }

      const oldComm = Number(existingTour.commission || 0);
      const newComm = Number(updatedTour.commission || 0);
      if (oldComm !== newComm) {
        tourChanges.push({ field: 'Hoa hồng Đại lý / Sale', old: formatMoney(oldComm), new: formatMoney(newComm) });
      }

      if (Number(existingTour.total_seats || 0) !== Number(updatedTour.total_seats || 0)) {
        tourChanges.push({ field: 'Tổng số chỗ mở bán', old: `${existingTour.total_seats || 0} chỗ`, new: `${updatedTour.total_seats || 0} chỗ` });
      }

      if (Number(existingTour.overbook_limit || 0) !== Number(updatedTour.overbook_limit || 0)) {
        tourChanges.push({ field: 'Overbooking cho phép', old: `${existingTour.overbook_limit || 0} chỗ`, new: `${updatedTour.overbook_limit || 0} chỗ` });
      }

      if (Number(existingTour.hold_duration_hours || 48) !== Number(updatedTour.hold_duration_hours || 48)) {
        tourChanges.push({ field: 'Mặc định Hold (Giờ)', old: `${existingTour.hold_duration_hours || 48} giờ`, new: `${updatedTour.hold_duration_hours || 48} giờ` });
      }

      if ((existingTour.ticket_deadline || '') !== (updatedTour.ticket_deadline || '')) {
        tourChanges.push({ field: 'Hạn xuất vé', old: formatLogDate(existingTour.ticket_deadline), new: formatLogDate(updatedTour.ticket_deadline) });
      }

      if ((existingTour.visa_deadline || '') !== (updatedTour.visa_deadline || '')) {
        tourChanges.push({ field: 'Hạn nộp Visa', old: formatLogDate(existingTour.visa_deadline), new: formatLogDate(updatedTour.visa_deadline) });
      }

      if ((existingTour.ticket_status || '') !== (updatedTour.ticket_status || '')) {
        tourChanges.push({ field: 'Tình trạng vé', old: existingTour.ticket_status || 'CHỜ XUẤT VÉ', new: updatedTour.ticket_status || 'CHỜ XUẤT VÉ' });
      }

      if ((existingTour.tour_status || 'available') !== (updatedTour.tour_status || 'available')) {
        tourChanges.push({ field: 'Nhãn trạng thái bán', old: existingTour.tour_status || 'available', new: updatedTour.tour_status || 'available' });
      }

      if ((existingTour.status || '') !== (updatedTour.status || '')) {
        tourChanges.push({ field: 'Trạng thái Tour', old: existingTour.status || '--', new: updatedTour.status || '--' });
      }

      if ((existingTour.departure_time || '') !== (updatedTour.departure_time || '')) {
        tourChanges.push({ field: 'Ngày giờ khởi hành (Đi)', old: formatLogDate(existingTour.departure_time), new: formatLogDate(updatedTour.departure_time) });
      }

      if ((existingTour.return_time || '') !== (updatedTour.return_time || '')) {
        tourChanges.push({ field: 'Ngày giờ về', old: formatLogDate(existingTour.return_time), new: formatLogDate(updatedTour.return_time) });
      }

      if ((existingTour.airline || '') !== (updatedTour.airline || '')) {
        tourChanges.push({ field: 'Hãng hàng không', old: existingTour.airline || 'Chưa có', new: updatedTour.airline || 'Chưa có' });
      }

      if ((existingTour.hotel || '') !== (updatedTour.hotel || '')) {
        tourChanges.push({ field: 'Khách sạn', old: existingTour.hotel || 'Chưa có', new: updatedTour.hotel || 'Chưa có' });
      }

      if ((existingTour.guide_name || '') !== (updatedTour.guide_name || '')) {
        tourChanges.push({ field: 'Tên Hướng dẫn viên', old: existingTour.guide_name || 'Chưa có', new: updatedTour.guide_name || 'Chưa có' });
      }

      if ((existingTour.guide_phone || '') !== (updatedTour.guide_phone || '')) {
        tourChanges.push({ field: 'SĐT Hướng dẫn viên', old: existingTour.guide_phone || 'Chưa có', new: updatedTour.guide_phone || 'Chưa có' });
      }

      if ((existingTour.flight_out || '') !== (updatedTour.flight_out || '')) {
        tourChanges.push({ field: 'Chuyến bay đi (Chặng 1)', old: existingTour.flight_out || 'Trống', new: updatedTour.flight_out || 'Trống' });
      }

      if ((existingTour.flight_out_transit || '') !== (updatedTour.flight_out_transit || '')) {
        tourChanges.push({ field: 'Chuyến bay đi (Chặng 2 - Quá cảnh)', old: existingTour.flight_out_transit || 'Trống', new: updatedTour.flight_out_transit || 'Trống' });
      }

      if ((existingTour.flight_in || '') !== (updatedTour.flight_in || '')) {
        tourChanges.push({ field: 'Chuyến bay về (Chặng 1)', old: existingTour.flight_in || 'Trống', new: updatedTour.flight_in || 'Trống' });
      }

      if ((existingTour.flight_in_transit || '') !== (updatedTour.flight_in_transit || '')) {
        tourChanges.push({ field: 'Chuyến bay về (Chặng 2 - Quá cảnh)', old: existingTour.flight_in_transit || 'Trống', new: updatedTour.flight_in_transit || 'Trống' });
      }

      if ((existingTour.transit_info || '') !== (updatedTour.transit_info || '')) {
        tourChanges.push({ field: 'Ghi chú quá cảnh', old: existingTour.transit_info || 'Trống', new: updatedTour.transit_info || 'Trống' });
      }

      if ((existingTour.description || '') !== (updatedTour.description || '')) {
        tourChanges.push({ field: 'Mô tả / Chi tiết Tour', old: existingTour.description || 'Trống', new: updatedTour.description || 'Trống' });
      }

      if ((existingTour.partner_name || '') !== (updatedTour.partner_name || '')) {
        tourChanges.push({ field: 'Tên đối tác nhận khách', old: existingTour.partner_name || 'Trống', new: updatedTour.partner_name || 'Trống' });
      }

      if ((existingTour.partner_contact || '') !== (updatedTour.partner_contact || '')) {
        tourChanges.push({ field: 'Liên hệ đối tác', old: existingTour.partner_contact || 'Trống', new: updatedTour.partner_contact || 'Trống' });
      }

      if ((existingTour.organization_name || '') !== (updatedTour.organization_name || '')) {
        tourChanges.push({ field: 'Tên đoàn / cơ quan', old: existingTour.organization_name || 'Trống', new: updatedTour.organization_name || 'Trống' });
      }

      if ((existingTour.group_leader_contact || '') !== (updatedTour.group_leader_contact || '')) {
        tourChanges.push({ field: 'Trưởng đoàn liên hệ', old: existingTour.group_leader_contact || 'Trống', new: updatedTour.group_leader_contact || 'Trống' });
      }

      if ((existingTour.custom_requirements || '') !== (updatedTour.custom_requirements || '')) {
        tourChanges.push({ field: 'Yêu cầu đặc biệt', old: existingTour.custom_requirements || 'Trống', new: updatedTour.custom_requirements || 'Trống' });
      }
    }

    if (tourChanges.length === 0) {
      tourChanges.push({
        field: 'Thao tác lưu thông tin',
        old: 'Thông tin cũ',
        new: 'Đã lưu lại dữ liệu Tour (Không phát hiện sự thay đổi ở các trường chính)'
      });
    }

    const logDetails = JSON.stringify({
      info: `Mã tour: ${updatedTour.code || updatedTour.id} - ${updatedTour.name}`,
      changes: tourChanges
    });

    setTours(prev => prev.map(t => t.id === updatedTour.id ? nextTour : t));
    logActivity({ action: 'Cập nhật Tour', module: 'Tour', details: logDetails });

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
          ticket_deadline: cleanValueForSupabase(updatedTour.ticket_deadline),
          description: cleanValueForSupabase(updatedTour.description),
          category: cleanValueForSupabase(updatedTour.category),
          hold_duration_hours: cleanValueForSupabase(updatedTour.hold_duration_hours || 48, true),
          overbook_limit: cleanValueForSupabase(updatedTour.overbook_limit, true),
          price_adult: priceAdult,
          price_child: cleanValueForSupabase(updatedTour.price_child, true),
          price_infant: cleanValueForSupabase(updatedTour.price_infant, true),
          single_room_surcharge: cleanValueForSupabase(updatedTour.single_room_surcharge, true),
          discount: cleanValueForSupabase(updatedTour.discount, true),
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
    logActivity({ action: 'Xóa Tour', module: 'Tour', details: `Tour ID: ${tourId}` });
    if (isSupabaseConfigured()) {
      try {
        // Xóa các booking liên quan trước để tránh lỗi khóa ngoại
        await supabase.from('bookings').delete().eq('tour_id', tourId);
        
        const { error } = await supabase.from('tours').delete().eq('id', tourId);
        if (error) {
          console.error('Lỗi khi xoá Tour trên Supabase:', error);
          toast.error('Lỗi khi xoá trên server: ' + error.message);
        } else {
          toast.success('Đã xóa thành công trên server!');
        }
      } catch (err) {
        console.error('Lỗi khi xoá Tour trên Supabase:', err);
        toast.error('Lỗi không xác định khi xoá trên server');
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
    vat_company_name?: string;
    vat_tax_code?: string;
    vat_address?: string;
    vat_email?: string;
    special_requests?: string;
    discount_type?: 'percent' | 'amount';
    discount_value?: number;
    surcharge_name?: string;
    surcharge_amount?: number;
    is_locked?: boolean;
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
      currentRole === 'bod' ? 'BOD' :
      currentRole === 'sale' ? 'Sale' :
      currentRole === 'sale_leader' ? 'Sale Leader' :
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
      vat_company_name: orderData.vat_company_name,
      vat_tax_code: orderData.vat_tax_code,
      vat_address: orderData.vat_address,
      vat_email: orderData.vat_email,
      special_requests: orderData.special_requests,
      discount_type: orderData.discount_type || 'amount',
      discount_value: orderData.discount_value || 0,
      surcharge_name: orderData.surcharge_name || '',
      surcharge_amount: orderData.surcharge_amount || 0,
      is_locked: orderData.is_locked !== undefined ? orderData.is_locked : true,
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

    logActivity({
      action: orderData.status === 'sure' ? 'Tạo Booking chắc chắn (Sure)' : 'Tạo Booking giữ chỗ (Hold)',
      module: 'Đơn hàng',
      details: `Tour: ${tour.code || tour.id} - Khách đặt: ${orderData.booker_name || 'Khách lẻ'} (${orderData.booker_phone || 'Không SĐT'}) - Tổng tiền: ${totalPrice.toLocaleString('vi-VN')} đ`
    });

    // Notifications
    const newNotifs: Notification[] = [];
    if (orderData.status === 'sure') {
      newNotifs.push({
        id: 'N-acc-' + Date.now(),
        type: 'accounting',
        title: 'Yêu cầu xuất hóa đơn',
        message: `Booking ${orderId} của khách ${orderData.booker_name || (orderData.passengers && orderData.passengers[0] && orderData.passengers[0].full_name) || 'Giữ Chỗ'} đã sure chỗ. Cần xuất hóa đơn.`,
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
          vat_company_name: orderData.vat_company_name,
          vat_tax_code: orderData.vat_tax_code,
          vat_address: orderData.vat_address,
          vat_email: orderData.vat_email,
          special_requests: orderData.special_requests,
          discount_type: orderData.discount_type || 'amount',
          discount_value: Number(orderData.discount_value || 0),
          surcharge_name: orderData.surcharge_name || '',
          surcharge_amount: Number(orderData.surcharge_amount || 0)
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
              visa_disqualified_reason: p.visa_disqualified_reason,
              gender: p.gender,
              nationality: p.nationality,
              passport_issue_date: p.passport_issue_date,
              passport_expiry_date: p.passport_expiry_date
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
        toast.error(`Lỗi lưu cơ sở dữ liệu: ${err.message || JSON.stringify(err)}\n(Booking vừa tạo sẽ bị huỷ để đảm bảo đồng bộ)`);
        
        // Rollback local state
        setOrders(prev => prev.filter(o => o.id !== orderId));
        setPassengers(prev => prev.filter(p => p.order_id !== orderId));
        
        // Restore tour seats
        setTours(prev => prev.map(t => {
          if (t.id === orderData.tour_id) {
            const sold_seats = orderData.status === 'sure' ? Math.max(0, t.sold_seats - seatsToLock) : t.sold_seats;
            const hold_seats = orderData.status === 'hold' ? Math.max(0, t.hold_seats - seatsToLock) : t.hold_seats;
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
              visa_disqualified_reason: p.visa_disqualified_reason,
              gender: p.gender,
              nationality: p.nationality,
              passport_issue_date: p.passport_issue_date,
              passport_expiry_date: p.passport_expiry_date
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

  const cancelOrder = async (orderId: string, reason?: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const tour = tours.find(t => t.id === order.tour_id);
    let updatedTours = tours;

    if (tour) {
      const seatsToRelease = order.adult_count !== undefined 
        ? ((order.adult_count || 0) + (order.child_count || 0)) 
        : passengers.filter(p => p.order_id === orderId).length;

      updatedTours = tours.map(t => {
        if (t.id === order.tour_id) {
          const sold_seats = order.status === 'sure' ? Math.max(0, t.sold_seats - seatsToRelease) : t.sold_seats;
          const hold_seats = order.status === 'hold' ? Math.max(0, t.hold_seats - seatsToRelease) : t.hold_seats;
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
      setTours(updatedTours);
    }

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled', cancel_reason: reason } : o));
    logActivity({ action: 'Hủy Booking', module: 'Đơn hàng', details: `Mã booking: ${orderId.substring(0, 8)} - Lý do: ${reason || 'Không ghi'}` });

    const newNotif = {
      id: 'N-' + Date.now(),
      type: 'accounting' as const,
      title: 'Booking đã huỷ',
      message: `Booking ${orderId.substring(0, 8)} đã được huỷ bỏ bởi Sale/CTV/BOD.${reason ? ` Lý do: ${reason}` : ''}`,
      targetId: orderId,
      createdAt: new Date().toISOString(),
      read: false
    };

    setNotifications(prev => [newNotif, ...prev]);

    if (isSupabaseConfigured()) {
      try {
        let updateData: any = { 
          status: 'cancelled',
          cancel_reason: reason || null
        };
        
        let { error } = await supabase.from('bookings').update(updateData).eq('id', toUuid(orderId));
        
        if (error && error.message?.includes('cancel_reason')) {
          console.warn("Column 'cancel_reason' not found, retrying without it...");
          delete updateData.cancel_reason;
          const retryRes = await supabase.from('bookings').update(updateData).eq('id', toUuid(orderId));
          error = retryRes.error;
        }

        if (error) throw error;
        
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
        return { ...o, status: 'sure', is_locked: true, hold_expiry: undefined, total_price: newTotal };
      }
      return o;
    }));
    logActivity({ action: 'Chuyển Hold sang Sure (Chắc chắn)', module: 'Đơn hàng', details: `Mã booking: ${orderId.substring(0, 8)} - Tổng tiền: ${newTotal.toLocaleString('vi-VN')} đ` });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('bookings').update({ status: 'sure', is_locked: true, hold_expiry: null, total_amount: newTotal }).eq('id', toUuid(orderId));
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
              visa_disqualified_reason: p.visa_disqualified_reason,
              gender: p.gender,
              nationality: p.nationality,
              passport_issue_date: p.passport_issue_date,
              passport_expiry_date: p.passport_expiry_date
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
    logActivity({ action: 'Yêu cầu gia hạn giữ chỗ', module: 'Đơn hàng', details: `Mã booking: ${orderId.substring(0, 8)} - Thêm ${hours} giờ` });

    const newNotif = {
      id: 'N-ext-' + Date.now(),
      type: 'extension' as const,
      title: 'Yêu cầu gia hạn giữ chỗ',
      message: `Sale yêu cầu gia hạn giữ chỗ thêm ${hours} tiếng cho booking ${orderId.substring(0, 8)}.`,
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
    logActivity({ action: approve ? 'Duyệt gia hạn giữ chỗ' : 'Từ chối gia hạn giữ chỗ', module: 'Đơn hàng', details: `Mã booking: ${orderId.substring(0, 8)}` });

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

    const targetPassenger = passengers.find(p => p.id === passengerId);
    logActivity({
      action: 'Cập nhật trạng thái Visa',
      module: 'Visa',
      details: `Hành khách: ${targetPassenger?.full_name || targetPassenger?.name || passengerId} - Trạng thái mới: ${status}${reason ? ` (Lý do: ${reason})` : ''}`
    });

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

    const passChanges: { field: string; old: string; new: string }[] = [];
    if (existing) {
      if (finalData.full_name && finalData.full_name !== existing.full_name) {
        passChanges.push({ field: 'Họ tên', old: existing.full_name || 'Trống', new: finalData.full_name });
      }
      if (finalData.passport_number && finalData.passport_number !== existing.passport_number) {
        passChanges.push({ field: 'Số hộ chiếu', old: existing.passport_number || 'Trống', new: finalData.passport_number });
      }
      if (finalData.passport_expiry_date && finalData.passport_expiry_date !== existing.passport_expiry_date) {
        passChanges.push({ field: 'Hạn hộ chiếu', old: existing.passport_expiry_date || 'Trống', new: finalData.passport_expiry_date });
      }
      if (finalData.visa_status && finalData.visa_status !== existing.visa_status) {
        passChanges.push({ field: 'Trạng thái Visa', old: existing.visa_status || 'Trống', new: finalData.visa_status });
      }
    }

    const passDetails = passChanges.length > 0 ? JSON.stringify({
      info: `Khách: ${finalData.full_name || existing?.full_name || passengerId}`,
      changes: passChanges
    }) : `Khách: ${finalData.full_name || finalData.name || passengerId}`;

    setPassengers(prev => prev.map(p => p.id === passengerId ? { ...p, ...finalData } : p));
    logActivity({ action: 'Cập nhật thông tin hành khách', module: 'Hành khách', details: passDetails });
    
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
          visa_disqualified_reason: finalData.visa_disqualified_reason,
          gender: finalData.gender,
          nationality: finalData.nationality,
          passport_issue_date: finalData.passport_issue_date,
          passport_expiry_date: finalData.passport_expiry_date
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
    const target = passengers.find(p => p.id === passengerId);
    // Optimistic update
    setPassengers(prev => prev.filter(p => p.id !== passengerId));
    logActivity({ action: 'Xóa hành khách khỏi đoàn', module: 'Hành khách', details: `Tên khách: ${target?.full_name || target?.name || passengerId}` });

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
    const existingOrder = orders.find(o => o.id === orderId);
    const orderChanges: { field: string; old: string; new: string }[] = [];
    if (existingOrder) {
      if (updatedData.total_price !== undefined && Number(updatedData.total_price) !== Number(existingOrder.total_price)) {
        orderChanges.push({
          field: 'Tổng giá trị đơn',
          old: `${Number(existingOrder.total_price || 0).toLocaleString('vi-VN')} đ`,
          new: `${Number(updatedData.total_price || 0).toLocaleString('vi-VN')} đ`
        });
      }
      if (updatedData.vat_option !== undefined && updatedData.vat_option !== existingOrder.vat_option) {
        orderChanges.push({
          field: 'Cấu hình VAT',
          old: existingOrder.vat_option || 'Không VAT',
          new: updatedData.vat_option || 'Không VAT'
        });
      }
      if (updatedData.discount_value !== undefined && Number(updatedData.discount_value) !== Number(existingOrder.discount_value)) {
        orderChanges.push({
          field: 'Chiết khấu / Giảm giá',
          old: `${Number(existingOrder.discount_value || 0).toLocaleString('vi-VN')} ${existingOrder.discount_type === 'percent' ? '%' : 'đ'}`,
          new: `${Number(updatedData.discount_value || 0).toLocaleString('vi-VN')} ${updatedData.discount_type === 'percent' ? '%' : 'đ'}`
        });
      }
      if (updatedData.surcharge_amount !== undefined && Number(updatedData.surcharge_amount) !== Number(existingOrder.surcharge_amount)) {
        orderChanges.push({
          field: `Phụ thu (${updatedData.surcharge_name || 'Khác'})`,
          old: `${Number(existingOrder.surcharge_amount || 0).toLocaleString('vi-VN')} đ`,
          new: `${Number(updatedData.surcharge_amount || 0).toLocaleString('vi-VN')} đ`
        });
      }
      if (updatedData.single_room_count !== undefined && Number(updatedData.single_room_count) !== Number(existingOrder.single_room_count)) {
        orderChanges.push({
          field: 'Số phòng đơn phụ thu',
          old: `${existingOrder.single_room_count || 0} phòng`,
          new: `${updatedData.single_room_count || 0} phòng`
        });
      }
      if (updatedData.contract_url !== undefined && updatedData.contract_url !== existingOrder.contract_url) {
        orderChanges.push({
          field: 'Hợp đồng dịch vụ',
          old: existingOrder.contract_url ? 'Đã có hợp đồng' : 'Chưa có hợp đồng',
          new: updatedData.contract_url ? 'Đã tải lên hợp đồng mới' : 'Đã xóa hợp đồng'
        });
      }
      if (updatedData.is_locked !== undefined && updatedData.is_locked !== existingOrder.is_locked) {
        orderChanges.push({
          field: 'Trạng thái khóa đơn',
          old: existingOrder.is_locked ? 'Đã khóa' : 'Đang mở',
          new: updatedData.is_locked ? 'Đã khóa' : 'Đang mở'
        });
      }
      if (updatedData.booker_name !== undefined && updatedData.booker_name !== existingOrder.booker_name) {
        orderChanges.push({
          field: 'Tên người đặt chỗ',
          old: existingOrder.booker_name || 'Chưa cung cấp',
          new: updatedData.booker_name || 'Chưa cung cấp'
        });
      }
      if (updatedData.booker_phone !== undefined && updatedData.booker_phone !== existingOrder.booker_phone) {
        orderChanges.push({
          field: 'Số điện thoại người đặt',
          old: existingOrder.booker_phone || 'Chưa cung cấp',
          new: updatedData.booker_phone || 'Chưa cung cấp'
        });
      }
      if (updatedData.special_requests !== undefined && updatedData.special_requests !== existingOrder.special_requests) {
        orderChanges.push({
          field: 'Yêu cầu đặc biệt',
          old: existingOrder.special_requests || 'Không có',
          new: updatedData.special_requests || 'Không có'
        });
      }
      if (updatedData.room_share_info !== undefined && updatedData.room_share_info !== existingOrder.room_share_info) {
        orderChanges.push({
          field: 'Thông tin ghép phòng',
          old: existingOrder.room_share_info || 'Không có',
          new: updatedData.room_share_info || 'Không có'
        });
      }
      if (updatedData.vat_company_name !== undefined && updatedData.vat_company_name !== existingOrder.vat_company_name) {
        orderChanges.push({
          field: 'Tên công ty xuất VAT',
          old: existingOrder.vat_company_name || 'Chưa có',
          new: updatedData.vat_company_name || 'Chưa có'
        });
      }
      if (updatedData.vat_tax_code !== undefined && updatedData.vat_tax_code !== existingOrder.vat_tax_code) {
        orderChanges.push({
          field: 'Mã số thuế VAT',
          old: existingOrder.vat_tax_code || 'Chưa có',
          new: updatedData.vat_tax_code || 'Chưa có'
        });
      }
      if (updatedData.payment_status !== undefined && updatedData.payment_status !== existingOrder.payment_status) {
        orderChanges.push({
          field: 'Trạng thái thanh toán',
          old: existingOrder.payment_status === 'paid' ? 'Đã thanh toán đủ' : existingOrder.payment_status === 'partially_paid' ? 'Thanh toán 1 phần' : 'Chưa thanh toán',
          new: updatedData.payment_status === 'paid' ? 'Đã thanh toán đủ' : updatedData.payment_status === 'partially_paid' ? 'Thanh toán 1 phần' : 'Chưa thanh toán'
        });
      }
      if (updatedData.hold_expiry !== undefined && updatedData.hold_expiry !== existingOrder.hold_expiry) {
        orderChanges.push({
          field: 'Thời gian hết hạn giữ chỗ',
          old: existingOrder.hold_expiry || 'Chưa thiết lập',
          new: updatedData.hold_expiry || 'Đã giải phóng'
        });
      }
    }

    // Fallback in case orderChanges is empty but updatedData has fields
    if (orderChanges.length === 0) {
      const keys = Object.keys(updatedData).filter(k => k !== 'id');
      if (keys.length > 0) {
        orderChanges.push({
          field: 'Cập nhật dữ liệu booking',
          old: 'Thông tin cũ',
          new: `Đã cập nhật các trường: ${keys.join(', ')}`
        });
      }
    }

    const displayOrderCode = (existingOrder?.id || orderId).substring(0, 8);
    const logDetails = JSON.stringify({
      info: `Mã đơn: ${displayOrderCode} - Khách đặt: ${updatedData.booker_name || existingOrder?.booker_name || 'Khách lẻ'}`,
      changes: orderChanges.length > 0 ? orderChanges : [{ field: 'Thao tác', old: 'Khởi tạo', new: 'Cập nhật booking' }]
    });

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updatedData } : o));
    logActivity({ action: 'Cập nhật booking', module: 'Đơn hàng', details: logDetails });
    if (isSupabaseConfigured()) {
      try {
        const updatePayload: Record<string, any> = {};
        if (updatedData.single_room_count !== undefined) updatePayload.single_room_count = Number(updatedData.single_room_count);
        if (updatedData.room_share_info !== undefined) updatePayload.room_share_info = updatedData.room_share_info;
        if (updatedData.vat_option !== undefined) updatePayload.vat_option = updatedData.vat_option;
        if (updatedData.vat_company_name !== undefined) updatePayload.vat_company_name = updatedData.vat_company_name;
        if (updatedData.vat_tax_code !== undefined) updatePayload.vat_tax_code = updatedData.vat_tax_code;
        if (updatedData.vat_address !== undefined) updatePayload.vat_address = updatedData.vat_address;
        if (updatedData.vat_email !== undefined) updatePayload.vat_email = updatedData.vat_email;
        if (updatedData.special_requests !== undefined) updatePayload.special_requests = updatedData.special_requests;
        if (updatedData.discount_type !== undefined) updatePayload.discount_type = updatedData.discount_type;
        if (updatedData.discount_value !== undefined) updatePayload.discount_value = Number(updatedData.discount_value);
        if (updatedData.surcharge_name !== undefined) updatePayload.surcharge_name = updatedData.surcharge_name;
        if (updatedData.surcharge_amount !== undefined) updatePayload.surcharge_amount = Number(updatedData.surcharge_amount);
        if (updatedData.total_price !== undefined) updatePayload.total_amount = Number(updatedData.total_price);
        if (updatedData.contract_url !== undefined) updatePayload.contract_url = updatedData.contract_url;
        if (updatedData.is_locked !== undefined) updatePayload.is_locked = updatedData.is_locked;
        if (updatedData.status !== undefined) updatePayload.status = updatedData.status;
        console.log('CRMContext: Updating booking with payload:', updatePayload);
        const { error } = await supabase.from('bookings').update(updatePayload).eq('id', toUuid(orderId));
        if (error) throw error;
        console.log('CRMContext: Successfully updated booking');
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

  const createInvoiceReceipt = async (invoiceData: Omit<Invoice, 'id' | 'status' | 'created_at'>) => {
    const newId = generateSafeUUID();
    const nowStr = new Date().toISOString();
    
    let code = invoiceData.invoice_code;
    if (!code) {
      const datePrefix = new Date().getFullYear().toString().substring(2) + 
                         String(new Date().getMonth() + 1).padStart(2, '0') + 
                         String(new Date().getDate()).padStart(2, '0');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      if (invoiceData.type === 'payment') {
        code = `PC-${datePrefix}-${randomSuffix}`;
      } else {
        code = `PT-${datePrefix}-${randomSuffix}`;
      }
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const humanCreatorName = (invoiceData.created_by && !uuidRegex.test(invoiceData.created_by))
      ? invoiceData.created_by
      : (profile?.full_name || profile?.phone || user?.email || 'Admin');

    const formattedAccountName = invoiceData.refund_account_name ? invoiceData.refund_account_name.trim().toUpperCase() : undefined;
    const formattedBankName = invoiceData.refund_bank_name ? invoiceData.refund_bank_name.trim() : undefined;
    const formattedAccountNumber = invoiceData.refund_account_number ? invoiceData.refund_account_number.trim() : undefined;

    let finalDescription = (invoiceData.description || '').trim();
    if (
      (formattedBankName || formattedAccountNumber || formattedAccountName) &&
      !/\[(?:Thông tin chuyển khoản|Chuyển khoản Ngân hàng|Hoàn trả qua Ngân hàng)\]/i.test(finalDescription)
    ) {
      finalDescription += `\n[Thông tin chuyển khoản]: ${formattedBankName || '---'} - STK: ${formattedAccountNumber || '---'} - Chủ TK: ${formattedAccountName || '---'}`;
    }

    const newInvoice: Invoice = {
      ...invoiceData,
      description: finalDescription,
      refund_bank_name: formattedBankName,
      refund_account_number: formattedAccountNumber,
      refund_account_name: formattedAccountName,
      created_by: humanCreatorName,
      id: newId,
      status: 'pending',
      invoice_code: code,
      created_at: nowStr
    };

    setInvoices(prev => [newInvoice, ...prev]);
    logActivity({
      action: invoiceData.type === 'payment' ? 'Tạo Phiếu Chi' : 'Tạo Phiếu Thu',
      module: 'Kế toán',
      details: `Mã phiếu: ${code} - Số tiền: ${Number(invoiceData.amount).toLocaleString('vi-VN')} đ`
    });

    if (isSupabaseConfigured()) {
      try {
        let dbCreatedBy: string | null = null;
        if (invoiceData.created_by && uuidRegex.test(invoiceData.created_by)) {
          dbCreatedBy = invoiceData.created_by;
        } else if (profile?.id && uuidRegex.test(profile.id)) {
          dbCreatedBy = profile.id;
        } else if (user?.id && uuidRegex.test(user.id)) {
          dbCreatedBy = user.id;
        }

        const insertData: any = {
          id: newId,
          order_id: invoiceData.order_id ? toUuid(invoiceData.order_id) : null,
          amount: Number(invoiceData.amount),
          status: 'pending',
          type: invoiceData.type,
          payment_method: invoiceData.payment_method || 'Chuyển khoản',
          description: finalDescription,
          invoice_code: code,
          file_url: invoiceData.file_url || ''
        };

        if (dbCreatedBy) {
          insertData.created_by = dbCreatedBy;
        }

        if (invoiceData.refund_method) insertData.refund_method = invoiceData.refund_method;
        if (formattedBankName) insertData.refund_bank_name = formattedBankName;
        if (formattedAccountNumber) insertData.refund_account_number = formattedAccountNumber;
        if (formattedAccountName) insertData.refund_account_name = formattedAccountName;

        let currentInsertData = { ...insertData };
        let { error } = await supabase.from('invoices').insert(currentInsertData);
        
        if (error) {
          let attempts = 0;
          while (error && attempts < 4) {
            const errMsg = error.message || '';
            const errCode = (error as any).code || '';
            
            const missingColMatch = errMsg.match(/Could not find the '([^']+)' column/i);
            const isUuidErr = errMsg.includes('invalid input syntax for type uuid') || errCode === '22P02' || errMsg.includes('uuid');

            if (missingColMatch && missingColMatch[1]) {
              const col = missingColMatch[1];
              console.warn(`Column '${col}' not found in Supabase, removing and retrying...`);
              delete currentInsertData[col];
            } else if (isUuidErr) {
              console.warn(`Invalid UUID syntax error detected (${errMsg}), removing created_by field and retrying...`);
              delete currentInsertData.created_by;
            } else if (errMsg.includes('created_by') || errMsg.includes('customer_id') || errMsg.includes('foreign key constraint')) {
              console.warn('Foreign key or created_by failed, removing created_by/customer_id and retrying...');
              if (errMsg.includes('created_by')) delete currentInsertData.created_by;
              if (errMsg.includes('customer_id')) delete currentInsertData.customer_id;
              if (errMsg.includes('order_id')) delete currentInsertData.order_id;
            } else if (errCode === '23505' || errMsg.includes('duplicate key') || errMsg.includes('unique constraint') || errMsg.includes('invoices_invoice_code_key')) {
              const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
              const originalCode = currentInsertData.invoice_code || 'INV';
              const newCode = `${originalCode}-${randomSuffix}`;
              console.warn(`Duplicate invoice_code detected. Changing '${originalCode}' to '${newCode}' and retrying...`);
              currentInsertData.invoice_code = newCode;
              
              // Cập nhật lại state danh sách hóa đơn với mã mới để tránh sai lệch
              setInvoices(prev => prev.map(inv => inv.id === newId ? { ...inv, invoice_code: newCode } : inv));
            } else {
              throw error;
            }
            
            const retryRes = await supabase.from('invoices').insert(currentInsertData);
            error = retryRes.error;
            attempts++;
          }
          
          if (error) throw error;
        }
        toast.success('Đã tải hóa đơn lên hệ thống thành công và đang chờ kế toán duyệt!');
      } catch (err: any) {
        console.error('Lỗi khi chèn invoice vào Supabase:', err.message || err);
        toast.error(`Lỗi DB: ${err.message || 'Lỗi không xác định'}`);
      }
    } else {
      toast.success('Đã nộp hóa đơn (Chế độ ngoại tuyến, chờ duyệt)!');
    }

    // Trigger notification to accounting team (Kế toán)
    const order = orders.find(o => o.id === (invoiceData as any).order_id);
    const bookingCode = order ? order.id.substring(0, 8) : 'Chưa rõ';
    const amountStr = new Intl.NumberFormat('vi-VN').format(invoiceData.amount);
    
    const newNotif: Notification = {
      id: generateSafeUUID(),
      type: 'accounting',
      title: 'Hóa đơn thanh toán mới',
      message: `Nhân viên ${invoiceData.created_by || 'Sale'} đã tải hóa đơn chuyển khoản ${amountStr}đ cho booking #${bookingCode}. Vui lòng kiểm tra và duyệt.`,
      targetId: (invoiceData as any).order_id || '',
      createdAt: nowStr,
      read: false
    };

    setNotifications(prev => [newNotif, ...prev]);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('system_notifications').insert({
          id: newNotif.id,
          type: 'accounting',
          title: newNotif.title,
          message: newNotif.message,
          target_id: newNotif.targetId,
          created_at: newNotif.createdAt,
          read: false
        });
      } catch (err) {
        console.warn('Lỗi lưu thông báo kế toán vào Supabase:', err);
      }
    }

    return newInvoice;
  };

  const approveInvoiceReceipt = async (invoiceId: string, verifierName: string, fileUrl?: string) => {
    const nowStr = new Date().toISOString();
    
    // Update local invoices state
    setInvoices(prev => prev.map(inv => 
      inv.id === invoiceId 
        ? { ...inv, status: 'approved', verified_by: verifierName, verified_at: nowStr, file_url: fileUrl || inv.file_url } 
        : inv
    ));

    const targetInvoice = invoices.find(inv => inv.id === invoiceId);
    if (!targetInvoice) return;

    logActivity({
      action: 'Duyệt Phiếu Thu/Chi',
      module: 'Kế toán',
      details: `Mã phiếu: ${targetInvoice.invoice_code || invoiceId} - Số tiền: ${targetInvoice.amount?.toLocaleString('vi-VN')} đ - Duyệt bởi: ${verifierName}`
    });

    const bookingId = targetInvoice.order_id;
    if (bookingId) {
      const order = orders.find(o => o.id === bookingId);
      if (order) {
        const change = targetInvoice.type === 'payment' ? -targetInvoice.amount : targetInvoice.amount;
        const approvedSum = Math.max(0, (order.paid_amount || 0) + change);
        let newPaymentStatus: Order['payment_status'] = 'partially_paid';
        if (approvedSum >= order.total_price) {
          newPaymentStatus = 'paid';
        } else if (approvedSum === 0) {
          newPaymentStatus = 'unpaid';
        }

        let newOrderStatus = order.status;
        if (order.status !== 'cancelled') {
          if (newPaymentStatus === 'paid') {
            newOrderStatus = 'paid';
          } else if (approvedSum === 0 && order.status === 'paid') {
            newOrderStatus = 'sure';
          } else if (order.status === 'hold') {
            newOrderStatus = 'sure';
          }
        }

        let newBookerName = order.booker_name;
        if ((newOrderStatus === 'sure' || newOrderStatus === 'paid' || approvedSum > 0) && newBookerName && newBookerName.includes('Giữ chỗ tạm')) {
          const orderPassengers = passengers.filter(p => p.order_id === bookingId);
          const leadPassenger = orderPassengers.find(p => p.is_payer) || orderPassengers[0];
          newBookerName = (leadPassenger && leadPassenger.full_name && !leadPassenger.full_name.includes('Giữ chỗ tạm'))
            ? leadPassenger.full_name
            : 'Chưa cung cấp';
        }

        const needsSeatUpdate = order.status === 'hold' && (newOrderStatus === 'sure' || newOrderStatus === 'paid');

        setOrders(prev => prev.map(o => 
          o.id === bookingId 
            ? { ...o, paid_amount: approvedSum, payment_status: newPaymentStatus, status: newOrderStatus, booker_name: newBookerName } 
            : o
        ));

        if (needsSeatUpdate) {
          const seatsToMove = order.adult_count !== undefined 
            ? ((order.adult_count || 0) + (order.child_count || 0)) 
            : passengers.filter(p => p.order_id === bookingId).length;

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

          if (isSupabaseConfigured()) {
            const matchingTour = updatedTours.find(t => t.id === order.tour_id);
            if (matchingTour) {
              supabase.from('tours').update({
                hold_seats: Number(matchingTour.hold_seats),
                sold_seats: Number(matchingTour.sold_seats),
                available_seats: Number(matchingTour.available_seats)
              }).eq('id', order.tour_id).then(({error}) => {
                if (error) console.error('Lỗi khi cập nhật chỗ trên tour:', error);
              });
            }
          }
        }

        if (isSupabaseConfigured()) {
          try {
            await supabase.from('bookings').update({
              paid_amount: approvedSum,
              payment_status: newPaymentStatus,
              status: newOrderStatus,
              booker_name: newBookerName,
              hold_expiry: newOrderStatus === 'sure' || newOrderStatus === 'paid' ? null : order.hold_expiry
            }).eq('id', toUuid(bookingId));
          } catch (err) {
            console.error('Lỗi khi cập nhật trạng thái thanh toán đơn hàng:', err);
          }
        }
      }
    }

    // Sync status & proofUrl back to tourCosts
    const effectiveProofUrl = fileUrl || targetInvoice.file_url;
    setTourCosts(prev => {
      let changed = false;
      const nextCosts = prev.map(tc => {
        if (!tc.partnerPayments || tc.partnerPayments.length === 0) return tc;
        let tcChanged = false;

        const nextPartnerPayments = tc.partnerPayments.map(p => {
          let pChanged = false;
          let pProof = p.proofUrl;

          if (p.invoiceId === invoiceId) {
            pChanged = true;
            if (effectiveProofUrl) pProof = effectiveProofUrl;
          }

          const nextInsts = (p.installments || []).map(inst => {
            if (inst.invoice_id === invoiceId || p.invoiceId === invoiceId) {
              pChanged = true;
              return {
                ...inst,
                status: 'approved' as const,
                proof_url: effectiveProofUrl || inst.proof_url || pProof
              };
            }
            return inst;
          });

          if (!pChanged) return p;
          tcChanged = true;

          const totalApproved = nextInsts.reduce((sum, inst) => inst.status === 'approved' ? sum + (inst.amount || 0) : sum, 0);
          let newStatus: PartnerPayment['status'] = 'unpaid';
          if (totalApproved >= p.amountToPay) {
            newStatus = 'paid';
          } else if (totalApproved > 0) {
            newStatus = 'partially_paid';
          }

          return {
            ...p,
            proofUrl: pProof,
            installments: nextInsts,
            status: newStatus
          };
        });

        if (!tcChanged) return tc;
        changed = true;
        return { ...tc, partnerPayments: nextPartnerPayments };
      });

      if (changed) {
        localStorage.setItem('crm_tour_costs', JSON.stringify(nextCosts));
      }
      return nextCosts;
    });

    if (isSupabaseConfigured()) {
      try {
        const updatePayload: any = {
          status: 'approved',
          verified_by: verifierName,
          verified_at: nowStr
        };
        if (fileUrl) {
          updatePayload.file_url = fileUrl;
        }
        await supabase.from('invoices').update(updatePayload).eq('id', toUuid(invoiceId));
        toast.success('Duyệt phiếu chi/thu thành công! Đã lưu trữ trong mục "Công ty đã nhận".');
      } catch (err) {
        console.error('Lỗi khi duyệt invoice trên Supabase:', err);
        toast.error('Gặp sự cố khi duyệt trên máy chủ!');
      }
    } else {
      toast.success('Duyệt phiếu chi/thu thành công (Chế độ ngoại tuyến)! Đã lưu trữ trong mục "Công ty đã nhận".');
    }

    const orderObj = bookingId ? orders.find(o => o.id === bookingId) : null;
    const bookingCode = orderObj ? orderObj.id.substring(0, 8) : 'Chưa rõ';
    const amountStr = new Intl.NumberFormat('vi-VN').format(targetInvoice.amount);

    const salesNotif: Notification = {
      id: generateSafeUUID(),
      type: 'extension',
      title: 'Hóa đơn thanh toán được duyệt',
      message: `Kế toán ${verifierName} đã duyệt phiếu thu ${amountStr}đ cho booking #${bookingCode}.`,
      targetId: bookingId || '',
      createdAt: nowStr,
      read: false
    };

    setNotifications(prev => [salesNotif, ...prev]);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('system_notifications').insert({
          id: salesNotif.id,
          type: 'extension',
          title: salesNotif.title,
          message: salesNotif.message,
          target_id: salesNotif.targetId,
          created_at: salesNotif.createdAt,
          read: false
        });
      } catch (err) {
        console.warn('Lỗi lưu thông báo duyệt thanh toán vào Supabase:', err);
      }
    }
  };

  const rejectInvoiceReceipt = async (invoiceId: string, verifierName: string) => {
    const nowStr = new Date().toISOString();

    const targetInvoice = invoices.find(inv => inv.id === invoiceId);

    setInvoices(prev => prev.map(inv => 
      inv.id === invoiceId 
        ? { ...inv, status: 'rejected', verified_by: verifierName, verified_at: nowStr } 
        : inv
    ));

    logActivity({
      action: 'Từ chối Phiếu Thu/Chi',
      module: 'Kế toán',
      details: `Mã phiếu: ${targetInvoice?.invoice_code || invoiceId} - Người từ chối: ${verifierName}`
    });

    // Sync rejection to tourCosts
    setTourCosts(prev => {
      let changed = false;
      const nextCosts = prev.map(tc => {
        if (!tc.partnerPayments || tc.partnerPayments.length === 0) return tc;
        let tcChanged = false;

        const nextPartnerPayments = tc.partnerPayments.map(p => {
          let pChanged = false;

          const nextInsts = (p.installments || []).map(inst => {
            if (inst.invoice_id === invoiceId || p.invoiceId === invoiceId) {
              pChanged = true;
              return {
                ...inst,
                status: 'rejected' as const
              };
            }
            return inst;
          });

          if (!pChanged) return p;
          tcChanged = true;

          const totalApproved = nextInsts.reduce((sum, inst) => inst.status === 'approved' ? sum + (inst.amount || 0) : sum, 0);
          let newStatus: PartnerPayment['status'] = 'unpaid';
          if (totalApproved >= p.amountToPay) {
            newStatus = 'paid';
          } else if (totalApproved > 0) {
            newStatus = 'partially_paid';
          }

          return {
            ...p,
            installments: nextInsts,
            status: newStatus
          };
        });

        if (!tcChanged) return tc;
        changed = true;
        return { ...tc, partnerPayments: nextPartnerPayments };
      });

      if (changed) {
        localStorage.setItem('crm_tour_costs', JSON.stringify(nextCosts));
      }
      return nextCosts;
    });

    if (!targetInvoice) return;

    const bookingId = targetInvoice.order_id;

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('invoices').update({
          status: 'rejected',
          verified_by: verifierName,
          verified_at: nowStr
        }).eq('id', toUuid(invoiceId));
        toast.success('Từ chối phiếu thu thành công! Bản ghi được lưu trong mục "Bị từ chối".');
      } catch (err) {
        console.error('Lỗi khi từ chối invoice trên Supabase:', err);
        toast.error('Gặp sự cố khi từ chối hóa đơn trên máy chủ!');
      }
    } else {
      toast.success('Từ chối phiếu thu thành công (Chế độ ngoại tuyến)! Bản ghi được lưu trong mục "Bị từ chối".');
    }

    const orderObj = bookingId ? orders.find(o => o.id === bookingId) : null;
    const bookingCode = orderObj ? orderObj.id.substring(0, 8) : 'Chưa rõ';
    const amountStr = new Intl.NumberFormat('vi-VN').format(targetInvoice.amount);

    const salesNotif: Notification = {
      id: generateSafeUUID(),
      type: 'extension',
      title: 'Hóa đơn thanh toán bị từ chối',
      message: `Phiếu thu ${amountStr}đ cho booking #${bookingCode} đã bị kế toán từ chối. Vui lòng kiểm tra lại.`,
      targetId: bookingId || '',
      createdAt: nowStr,
      read: false
    };

    setNotifications(prev => [salesNotif, ...prev]);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('system_notifications').insert({
          id: salesNotif.id,
          type: 'extension',
          title: salesNotif.title,
          message: salesNotif.message,
          target_id: salesNotif.targetId,
          created_at: salesNotif.createdAt,
          read: false
        });
      } catch (err) {
        console.warn('Lỗi lưu thông báo từ chối thanh toán vào Supabase:', err);
      }
    }
  };

  const uploadInvoiceProof = async (invoiceId: string, fileUrl: string) => {
    setInvoices(prev => prev.map(inv => 
      inv.id === invoiceId 
        ? { ...inv, file_url: fileUrl } 
        : inv
    ));

    // Sync file_url to tourCosts
    setTourCosts(prev => {
      let changed = false;
      const nextCosts = prev.map(tc => {
        if (!tc.partnerPayments || tc.partnerPayments.length === 0) return tc;
        let tcChanged = false;

        const nextPartnerPayments = tc.partnerPayments.map(p => {
          let pChanged = false;
          let pProof = p.proofUrl;

          if (p.invoiceId === invoiceId) {
            pChanged = true;
            pProof = fileUrl;
          }

          const nextInsts = (p.installments || []).map(inst => {
            if (inst.invoice_id === invoiceId || p.invoiceId === invoiceId) {
              pChanged = true;
              return {
                ...inst,
                proof_url: fileUrl
              };
            }
            return inst;
          });

          if (!pChanged) return p;
          tcChanged = true;

          return {
            ...p,
            proofUrl: pProof,
            installments: nextInsts
          };
        });

        if (!tcChanged) return tc;
        changed = true;
        return { ...tc, partnerPayments: nextPartnerPayments };
      });

      if (changed) {
        localStorage.setItem('crm_tour_costs', JSON.stringify(nextCosts));
      }
      return nextCosts;
    });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('invoices').update({
          file_url: fileUrl
        }).eq('id', toUuid(invoiceId));
        toast.success('Đã lưu minh chứng chuyển khoản lên hệ thống!');
      } catch (err) {
        console.error('Lỗi khi cập nhật file_url của invoice trên Supabase:', err);
        toast.error('Không thể lưu minh chứng lên máy chủ!');
      }
    } else {
      toast.success('Đã lưu minh chứng chuyển khoản (Chế độ ngoại tuyến)!');
    }
  };

  const deleteInvoiceReceipt = async (invoiceId: string) => {
    const targetInvoice = invoices.find(inv => inv.id === invoiceId);
    setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
    logActivity({
      action: 'Xóa Phiếu Thu/Chi',
      module: 'Kế toán',
      details: `Mã phiếu: ${targetInvoice?.invoice_code || invoiceId}`
    });

    // Also remove/update from tourCosts if linked
    setTourCosts(prev => {
      let changed = false;
      const nextCosts = prev.map(tc => {
        if (!tc.partnerPayments || tc.partnerPayments.length === 0) return tc;
        let tcChanged = false;

        const nextPartnerPayments = tc.partnerPayments.map(p => {
          let pChanged = false;
          const nextInsts = (p.installments || []).filter(inst => {
            if (inst.invoice_id === invoiceId) {
              pChanged = true;
              return false;
            }
            return true;
          });

          if (!pChanged) return p;
          tcChanged = true;

          const totalApproved = nextInsts.reduce((sum, inst) => {
            if (inst.invoice_id) {
              const inv = invoices.find(i => i.id === inst.invoice_id && i.id !== invoiceId);
              if (inv) return inv.status === 'approved' ? sum + (inst.amount || 0) : sum;
            }
            return inst.status === 'approved' ? sum + (inst.amount || 0) : sum;
          }, 0);

          let newStatus: PartnerPayment['status'] = 'unpaid';
          if (totalApproved >= p.amountToPay) {
            newStatus = 'paid';
          } else if (totalApproved > 0) {
            newStatus = 'partially_paid';
          }

          return {
            ...p,
            installments: nextInsts,
            status: newStatus
          };
        });

        if (!tcChanged) return tc;
        changed = true;
        return { ...tc, partnerPayments: nextPartnerPayments };
      });

      if (changed) {
        localStorage.setItem('crm_tour_costs', JSON.stringify(nextCosts));
      }
      return nextCosts;
    });

    const savedInvoices = localStorage.getItem('crm_invoices');
    if (savedInvoices) {
      try {
        const parsed = JSON.parse(savedInvoices);
        const filtered = parsed.filter((inv: any) => inv.id !== invoiceId);
        localStorage.setItem('crm_invoices', JSON.stringify(filtered));
      } catch {}
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('invoices').delete().eq('id', toUuid(invoiceId));
      } catch (err) {
        console.error('Lỗi khi xóa invoice trên Supabase:', err);
      }
    }
  };

  const updateTourCost = async (tourId: string, costData: Partial<TourCost>) => {
    // 1. Chuẩn bị danh sách cập nhật cho state cục bộ
    const idx = tourCosts.findIndex(c => c.tourId === tourId);
    let updatedList = [...tourCosts];

    const newCostRecord: TourCost = {
      tourId,
      flightAmount: costData.flightAmount ?? 0,
      insuranceAmount: costData.insuranceAmount ?? 0,
      tourGuideAmount: costData.tourGuideAmount ?? 0,
      giftAmount: costData.giftAmount ?? 0,
      commissionAmount: costData.commissionAmount ?? 0,
      advertisingAmount: costData.advertisingAmount ?? 0,
      otherAmount: costData.otherAmount ?? 0,
      visaAmount: costData.visaAmount ?? 0,
      landtours: costData.landtours ?? [],
      partnerPayments: costData.partnerPayments ?? [],
      updatedAt: new Date().toISOString()
    };

    const currentCost = idx >= 0 ? updatedList[idx] : null;

    const mergedCost: TourCost = {
      tourId,
      flightAmount: costData.flightAmount !== undefined ? costData.flightAmount : (currentCost?.flightAmount ?? 0),
      insuranceAmount: costData.insuranceAmount !== undefined ? costData.insuranceAmount : (currentCost?.insuranceAmount ?? 0),
      tourGuideAmount: costData.tourGuideAmount !== undefined ? costData.tourGuideAmount : (currentCost?.tourGuideAmount ?? 0),
      giftAmount: costData.giftAmount !== undefined ? costData.giftAmount : (currentCost?.giftAmount ?? 0),
      commissionAmount: costData.commissionAmount !== undefined ? costData.commissionAmount : (currentCost?.commissionAmount ?? 0),
      advertisingAmount: costData.advertisingAmount !== undefined ? costData.advertisingAmount : (currentCost?.advertisingAmount ?? 0),
      otherAmount: costData.otherAmount !== undefined ? costData.otherAmount : (currentCost?.otherAmount ?? 0),
      visaAmount: costData.visaAmount !== undefined ? costData.visaAmount : (currentCost?.visaAmount ?? 0),
      landtours: costData.landtours !== undefined ? costData.landtours : (currentCost?.landtours ?? []),
      partnerPayments: costData.partnerPayments !== undefined ? costData.partnerPayments : (currentCost?.partnerPayments ?? []),
      updatedAt: new Date().toISOString()
    };

    if (idx >= 0) {
      updatedList[idx] = mergedCost;
    } else {
      updatedList.push(mergedCost);
    }

    // 2. Cập nhật state local ngay lập tức (Optimistic UI & Offline fallback)
    setTourCosts(updatedList);
    localStorage.setItem('crm_tour_costs', JSON.stringify(updatedList));

    const tourObj = tours.find(t => t.id === tourId);
    const costChanges: { field: string; old: string; new: string }[] = [];
    if (currentCost) {
      if (costData.flightAmount !== undefined && costData.flightAmount !== currentCost.flightAmount) {
        costChanges.push({ field: 'Chi phí Vé máy bay', old: `${(currentCost.flightAmount || 0).toLocaleString('vi-VN')} đ`, new: `${(costData.flightAmount || 0).toLocaleString('vi-VN')} đ` });
      }
      if (costData.tourGuideAmount !== undefined && costData.tourGuideAmount !== currentCost.tourGuideAmount) {
        costChanges.push({ field: 'Chi phí HDV', old: `${(currentCost.tourGuideAmount || 0).toLocaleString('vi-VN')} đ`, new: `${(costData.tourGuideAmount || 0).toLocaleString('vi-VN')} đ` });
      }
      if (costData.advertisingAmount !== undefined && costData.advertisingAmount !== currentCost.advertisingAmount) {
        costChanges.push({ field: 'Chi phí Quảng cáo / Ads', old: `${(currentCost.advertisingAmount || 0).toLocaleString('vi-VN')} đ`, new: `${(costData.advertisingAmount || 0).toLocaleString('vi-VN')} đ` });
      }
      if (costData.insuranceAmount !== undefined && costData.insuranceAmount !== currentCost.insuranceAmount) {
        costChanges.push({ field: 'Bảo hiểm du lịch', old: `${(currentCost.insuranceAmount || 0).toLocaleString('vi-VN')} đ`, new: `${(costData.insuranceAmount || 0).toLocaleString('vi-VN')} đ` });
      }
      if (costData.commissionAmount !== undefined && costData.commissionAmount !== currentCost.commissionAmount) {
        costChanges.push({ field: 'Hoa hồng / Chiết khấu', old: `${(currentCost.commissionAmount || 0).toLocaleString('vi-VN')} đ`, new: `${(costData.commissionAmount || 0).toLocaleString('vi-VN')} đ` });
      }
      if (costData.otherAmount !== undefined && costData.otherAmount !== currentCost.otherAmount) {
        costChanges.push({ field: 'Chi phí khác', old: `${(currentCost.otherAmount || 0).toLocaleString('vi-VN')} đ`, new: `${(costData.otherAmount || 0).toLocaleString('vi-VN')} đ` });
      }
      if (costData.visaAmount !== undefined && costData.visaAmount !== currentCost.visaAmount) {
        costChanges.push({ field: 'Chi phí Visa', old: `${(currentCost.visaAmount || 0).toLocaleString('vi-VN')} đ`, new: `${(costData.visaAmount || 0).toLocaleString('vi-VN')} đ` });
      }
    }

    const costDetails = costChanges.length > 0 ? JSON.stringify({
      info: `Tour: ${tourObj?.code || tourId} - ${tourObj?.name || ''}`,
      changes: costChanges
    }) : `Tour: ${tourObj?.code || tourId} - ${tourObj?.name || ''}`;

    logActivity({
      action: 'Cập nhật chi phí & đối tác',
      module: 'Chi phí',
      details: costDetails
    });

    // 3. Lưu vào Supabase
    if (isSupabaseConfigured()) {
      try {
        // Thử lưu vào bảng chuyên biệt tour_costs trước
        const { error: tcErr } = await supabase.from('tour_costs').upsert({
          tour_id: tourId,
          flight_amount: mergedCost.flightAmount,
          insurance_amount: mergedCost.insuranceAmount,
          tour_guide_amount: mergedCost.tourGuideAmount,
          gift_amount: mergedCost.giftAmount,
          commission_amount: mergedCost.commissionAmount,
          advertising_amount: mergedCost.advertisingAmount,
          other_amount: mergedCost.otherAmount,
          visa_amount: mergedCost.visaAmount || 0,
          landtours: mergedCost.landtours,
          partner_payments: mergedCost.partnerPayments,
          updated_at: new Date().toISOString()
        });

        if (tcErr) {
          const isTableMissing = tcErr.code === '42P01' || (tcErr.message && tcErr.message.includes('relation "tour_costs" does not exist'));
          if (isTableMissing) {
            console.log('Bảng tour_costs chưa được tạo, đang lưu dự phòng vào app_settings...');
            const { error: appSettingsErr } = await supabase.from('app_settings').upsert({
              key: 'tour_costs',
              value: updatedList,
              updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
            if (appSettingsErr) throw appSettingsErr;
          } else {
            throw tcErr;
          }
        } else {
          console.log('Đã lưu chi phí vào bảng tour_costs chuyên biệt thành công!');
        }
      } catch (err) {
        console.error('Lỗi khi lưu Tour Costs vào Supabase:', err);
        throw err;
      }
    }
  };

  const createPaymentProposal = async (proposalData: Omit<PaymentProposal, 'id' | 'code' | 'created_at' | 'leader_status' | 'accounting_status' | 'status'>): Promise<PaymentProposal> => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const countToday = paymentProposals.filter(p => p.code && p.code.includes(dateStr)).length + 1;
    const code = `DNTT-${dateStr}-${String(countToday).padStart(3, '0')}`;
    
    const newProposal: PaymentProposal = {
      ...proposalData,
      id: generateSafeUUID(),
      code,
      created_at: now.toISOString(),
      leader_status: 'pending',
      accounting_status: 'pending',
      status: 'pending_leader'
    };

    setPaymentProposals(prev => [newProposal, ...prev]);

    logActivity({
      action: 'Tạo Đề nghị thanh toán',
      module: 'Kế toán',
      details: `Mã đề nghị: ${code} - Nội dung: ${proposalData.title} - Số tiền: ${proposalData.amount.toLocaleString('vi-VN')} đ`
    });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('payment_proposals').insert({
          id: toUuid(newProposal.id),
          code: newProposal.code,
          proposal_type: newProposal.proposal_type,
          title: newProposal.title,
          amount: newProposal.amount,
          payment_method: newProposal.payment_method,
          bank_name: newProposal.bank_name || null,
          account_number: newProposal.account_number || null,
          account_name: newProposal.account_name || null,
          tour_id: newProposal.tour_id ? toUuid(newProposal.tour_id) : null,
          tour_code: newProposal.tour_code || null,
          tour_name: newProposal.tour_name || null,
          due_date: newProposal.due_date || null,
          file_url: newProposal.file_url || null,
          note: newProposal.note || null,
          created_by_id: newProposal.created_by_id ? toUuid(newProposal.created_by_id) : null,
          created_by_name: newProposal.created_by_name,
          created_by_role: newProposal.created_by_role,
          leader_status: 'pending',
          accounting_status: 'pending',
          status: 'pending_leader'
        });
      } catch (err) {
        console.warn('Lỗi khi lưu payment_proposal vào Supabase:', err);
      }
    }

    addSystemNotification({
      id: 'N-' + Date.now(),
      type: 'accounting',
      title: 'Đề nghị thanh toán mới',
      message: `${newProposal.created_by_name} (${newProposal.created_by_role}) vừa gửi đề nghị thanh toán ${newProposal.code}: ${newProposal.title} (${newProposal.amount.toLocaleString('vi-VN')} đ). Cần Leader duyệt.`,
      targetId: newProposal.id,
      createdAt: new Date().toISOString(),
      read: false
    });

    return newProposal;
  };

  const approvePaymentProposalLeader = async (id: string, leaderName: string, leaderNote?: string) => {
    const target = paymentProposals.find(p => p.id === id);
    if (!target) return;

    const now = new Date().toISOString();
    const updatedProps: Partial<PaymentProposal> = {
      leader_status: 'approved',
      leader_approved_by: leaderName,
      leader_approved_at: now,
      leader_note: leaderNote,
      status: 'approved_leader'
    };

    setPaymentProposals(prev => prev.map(p => p.id === id ? { ...p, ...updatedProps } : p));

    logActivity({
      action: 'Leader Duyệt Đề nghị thanh toán',
      module: 'Kế toán',
      details: `Mã đề nghị: ${target.code} - Duyệt bởi: ${leaderName}`
    });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('payment_proposals').update(updatedProps).eq('id', toUuid(id));
      } catch (e) {
        console.warn('DB update failed:', e);
      }
    }

    addSystemNotification({
      id: 'N-' + Date.now(),
      type: 'accounting',
      title: 'Đề nghị thanh toán đã qua vòng duyệt Leader',
      message: `Leader ${leaderName} đã duyệt đề nghị ${target.code} của ${target.created_by_name}. Đã chuyển thông tin tới Kế toán để chi tiền.`,
      targetId: target.id,
      createdAt: new Date().toISOString(),
      read: false
    });
  };

  const rejectPaymentProposalLeader = async (id: string, leaderName: string, leaderNote?: string) => {
    const target = paymentProposals.find(p => p.id === id);
    if (!target) return;

    const now = new Date().toISOString();
    const updatedProps: Partial<PaymentProposal> = {
      leader_status: 'rejected',
      leader_approved_by: leaderName,
      leader_approved_at: now,
      leader_note: leaderNote,
      status: 'rejected_leader'
    };

    setPaymentProposals(prev => prev.map(p => p.id === id ? { ...p, ...updatedProps } : p));

    logActivity({
      action: 'Leader Từ chối Đề nghị thanh toán',
      module: 'Kế toán',
      details: `Mã đề nghị: ${target.code} - Từ chối bởi: ${leaderName} - Lý do: ${leaderNote || 'Không có'}`
    });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('payment_proposals').update(updatedProps).eq('id', toUuid(id));
      } catch (e) {
        console.warn('DB update failed:', e);
      }
    }

    addSystemNotification({
      id: 'N-' + Date.now(),
      type: 'accounting',
      title: 'Đề nghị thanh toán bị từ chối bởi Leader',
      message: `Leader ${leaderName} đã từ chối đề nghị ${target.code}.${leaderNote ? ` Lý do: ${leaderNote}` : ''}`,
      targetId: target.id,
      createdAt: new Date().toISOString(),
      read: false
    });
  };

  const approvePaymentProposalAccounting = async (id: string, accountingName: string, accountingNote?: string, proofUrl?: string) => {
    const target = paymentProposals.find(p => p.id === id);
    if (!target) return;

    const now = new Date().toISOString();
    const updatedProps: Partial<PaymentProposal> = {
      accounting_status: 'approved',
      accounting_approved_by: accountingName,
      accounting_approved_at: now,
      accounting_note: accountingNote,
      accounting_proof_url: proofUrl,
      status: 'approved_accounting'
    };

    setPaymentProposals(prev => prev.map(p => p.id === id ? { ...p, ...updatedProps } : p));

    logActivity({
      action: 'Kế toán Duyệt & Chi tiền Đề nghị thanh toán',
      module: 'Kế toán',
      details: `Mã đề nghị: ${target.code} - Số tiền: ${target.amount.toLocaleString('vi-VN')} đ - Duyệt bởi Kế toán: ${accountingName}`
    });

    try {
      let transferDetails = '';
      if (target.payment_method === 'Chuyển khoản') {
        transferDetails = ` [CK: ${target.bank_name || ''} - STK: ${target.account_number || ''} - Chủ TK: ${target.account_name || ''}]`;
      }
      await createInvoiceReceipt({
        order_id: null,
        tour_id: target.tour_id,
        tour_code: target.tour_code,
        tour_name: target.tour_name,
        amount: target.amount,
        type: 'payment',
        payment_method: target.payment_method,
        description: `Chi theo Đề nghị thanh toán ${target.code}: ${target.title}${transferDetails}. Người đề nghị: ${target.created_by_name}. ${accountingNote ? `Ghi chú: ${accountingNote}` : ''}`,
        invoice_code: `PC-${target.code}`,
        file_url: proofUrl || target.file_url,
        created_by: accountingName,
        refund_method: target.payment_method,
        refund_bank_name: target.bank_name,
        refund_account_number: target.account_number,
        refund_account_name: target.account_name
      });
    } catch (err) {
      console.warn('Lỗi khi tự động tạo phiếu chi từ Đề nghị thanh toán:', err);
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('payment_proposals').update(updatedProps).eq('id', toUuid(id));
      } catch (e) {
        console.warn('DB update failed:', e);
      }
    }

    addSystemNotification({
      id: 'N-' + Date.now(),
      type: 'accounting',
      title: 'Đề nghị thanh toán đã được Chi tiền',
      message: `Kế toán ${accountingName} đã duyệt & thực hiện chi tiền cho đề nghị ${target.code} (${target.amount.toLocaleString('vi-VN')} đ).`,
      targetId: target.id,
      createdAt: new Date().toISOString(),
      read: false
    });
  };

  const rejectPaymentProposalAccounting = async (id: string, accountingName: string, accountingNote?: string) => {
    const target = paymentProposals.find(p => p.id === id);
    if (!target) return;

    const now = new Date().toISOString();
    const updatedProps: Partial<PaymentProposal> = {
      accounting_status: 'rejected',
      accounting_approved_by: accountingName,
      accounting_approved_at: now,
      accounting_note: accountingNote,
      status: 'rejected_accounting'
    };

    setPaymentProposals(prev => prev.map(p => p.id === id ? { ...p, ...updatedProps } : p));

    logActivity({
      action: 'Kế toán Từ chối Đề nghị thanh toán',
      module: 'Kế toán',
      details: `Mã đề nghị: ${target.code} - Từ chối bởi Kế toán: ${accountingName} - Lý do: ${accountingNote || 'Không có'}`
    });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('payment_proposals').update(updatedProps).eq('id', toUuid(id));
      } catch (e) {
        console.warn('DB update failed:', e);
      }
    }

    addSystemNotification({
      id: 'N-' + Date.now(),
      type: 'accounting',
      title: 'Đề nghị thanh toán bị Kế toán từ chối',
      message: `Kế toán ${accountingName} đã từ chối chi đề nghị ${target.code}.${accountingNote ? ` Lý do: ${accountingNote}` : ''}`,
      targetId: target.id,
      createdAt: new Date().toISOString(),
      read: false
    });
  };

  const deletePaymentProposal = async (id: string) => {
    const target = paymentProposals.find(p => p.id === id);
    if (!target) return;

    setPaymentProposals(prev => prev.filter(p => p.id !== id));

    logActivity({
      action: 'Xóa Đề nghị thanh toán',
      module: 'Kế toán',
      details: `Mã đề nghị: ${target.code}`
    });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('payment_proposals').delete().eq('id', toUuid(id));
      } catch (e) {
        console.warn('DB delete failed:', e);
      }
    }
  };

  return (
    <CRMContext.Provider value={{
      tours,
      orders,
      passengers,
      notifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      profilesList,
      refreshProfiles,
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
      updateMembershipSettings,
      visaCommonFiles,
      updateVisaCommonFiles,
      invoices,
      createInvoiceReceipt,
      approveInvoiceReceipt,
      rejectInvoiceReceipt,
      uploadInvoiceProof,
      deleteInvoiceReceipt,
      tourCosts,
      updateTourCost,
      activityLogs,
      logActivity,
      clearActivityLogs,
      paymentProposals,
      createPaymentProposal,
      approvePaymentProposalLeader,
      rejectPaymentProposalLeader,
      approvePaymentProposalAccounting,
      rejectPaymentProposalAccounting,
      deletePaymentProposal
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
