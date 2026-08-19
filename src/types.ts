export type Role = 'sale' | 'sale_leader' | 'operator' | 'visa' | 'accounting' | 'admin' | 'bod' | 'tour_guide' | 'marketing' | 'marketing_leader' | 'agent' | 'CTV';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  team_id?: string | null;
  team_name?: string | null;
  leader_id?: string | null;
  leader_name?: string | null;
}

export interface Profile {
  id: string;
  full_name?: string;
  phone?: string;
  company_name?: string;
  role: Role;
  team_id?: string | null;
  team_name?: string | null;
  leader_id?: string | null;
  leader_name?: string | null;
  email?: string;
  address?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  notes?: string;
  status?: 'active' | 'inactive';
  tier?: string;
  created_at?: string;
}

export interface Team {
  id: string;
  name: string;
  leader_id?: string | null;
  leader_name?: string | null;
  kpi_target?: number;
  created_at?: string;
}

export interface TeamPerformanceSummary {
  team_id: string;
  team_name: string;
  leader_id?: string;
  leader_name: string;
  pax_count: number;
  total_orders: number;
  revenue: number;
  net_profit: number;
  kpi_target: number;
  kpi_percentage: number;
}

export interface SalePerformanceSummary {
  sale_id: string;
  sale_name: string;
  team_id?: string;
  team_name: string;
  total_orders: number;
  pax_count: number;
  revenue: number;
  net_profit: number;
  direct_orders_count: number;
  assisted_ctv_orders_count: number;
  kpi_target?: number;
  kpi_percentage?: number;
}

export type TourStatus = 'available' | 'noshop' | 'last_minute' | 'holiday' | 'on_sale' | 'full';

export interface Tour {
  id: string;
  code: string; // Mã tour
  name: string; // Tên tour
  duration: string; // Số ngày đi (VD: 5 ngày 4 đêm)
  departure_time: string; // Ngày giờ đi
  return_time: string; // Ngày giờ về
  airline: string; // Hãng bay
  hotel: string; // Khách sạn
  price: number; // Giá tour
  destination: string; // Điểm đến
  start_date: string; // Ngày khởi hành (ISO Date)
  end_date: string; // Ngày kết thúc (ISO Date)
  commission: number; // Hoa hồng
  
  // Tình trạng chỗ
  total_seats: number;
  sold_seats: number; // Đã bán
  hold_seats: number; // Giữ chỗ
  available_seats: number; // Còn
  
  // Tình trạng tổng quan
  seat_status: 'Còn chỗ' | 'Hết chỗ' | 'Overbooked';
  
  // Các thông tin chi tiết (hiển thị khi bấm vào)
  flight_out?: string; // Chuyến bay đi chặng 1
  flight_out_transit?: string; // Chuyến bay đi chặng 2 (quá cảnh)
  flight_in?: string; // Chuyến bay về chặng 1
  flight_in_transit?: string; // Chuyến bay về chặng 2 (quá cảnh)
  transit_info?: string; // Ghi chú quá cảnh
  guide_name?: string; // Tên HDV
  guide_phone?: string; // SĐT HDV
  tour_guide_id?: string; // ID tài khoản HDV phụ trách tour
  ticket_status?: string; // Tình trạng vé
  ticket_deadline?: string; // Hạn xuất vé
  visa_deadline?: string; // Hạn nhận hồ sơ visa
  description?: string; // Thông tin đi tour / Link chi tiết
  tour_status?: TourStatus; // Trạng thái: còn chỗ, noshop, giờ chót, lễ tết, đang giảm giá
  status?: string; // Trạng thái vòng đời (Planning, Active, etc.)
  category?: string; // Danh mục sản phẩm (VD: Du lịch Đông Nam Á, Châu Âu, v.v.)
  hold_duration_hours?: number; // Thời gian giữ chỗ tối đa tính bằng tiếng
  overbook_limit?: number; // Số overbooking tối đa được phép bán vượt mức total_seats
  price_adult?: number;
  price_child?: number;
  price_infant?: number;
  single_room_surcharge?: number;
  discount?: number;
  itinerary_pdf_url?: string; // Link file PDF lịch trình chi tiết
  notice_sections?: string; // Bảng thông tin đi tour/Lưu ý dưới dạng JSON string
  tour_type?: 'internal' | 'outsourced' | 'partner' | 'private' | 'visa';
  // Đối tác nhận khách
  partner_name?: string;
  partner_contact?: string;
  partner_company_name?: string;
  partner_retail_price?: number;
  partner_net_cost?: number;
  ad_commission_amount?: number;
  // Tour đoàn riêng
  organization_name?: string;
  group_leader_contact?: string;
  custom_requirements?: string;
  // Dịch vụ visa lẻ
  visa_country?: string;
  visa_service_type?: string;
  visa_speed?: 'standard' | 'urgent';
  price_visa_tour?: number;
  created_at?: string;
}

export interface SurchargeItem {
  id: string;
  name: string;
  amount: number;
}

export interface Order {
  id: string;
  tour_id: string;
  customer_id?: string;
  salesperson_id?: string;
  created_by: string; // Tên người tạo
  user_id?: string;
  seller_type?: 'agent' | 'direct';
  partner_id?: string;
  original_price?: number;
  selling_price?: number;
  price_markup?: number;
  cit_tax_percent?: number;
  vat_tax_percent?: number;
  markup_fee_amount?: number;
  net_commission_amount?: number;
  net_payable_amount?: number;
  agent_commission_amount?: number;
  status: 'hold' | 'sure' | 'paid' | 'cancelled';
  hold_expiry?: string; // Thời gian hết hạn hold
  invoice_status: 'pending' | 'issued';
  payment_status?: 'unpaid' | 'partially_paid' | 'paid';
  cancel_reason?: string;
  paid_amount?: number;
  total_price: number;
  created_at: string;
  extension_status?: 'none' | 'requested' | 'approved' | 'rejected';
  extension_hours?: number;
  is_extended?: boolean;
  booker_name?: string;
  booker_phone?: string;
  customer_name?: string;
  customer_phone?: string;
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
  ctv_info?: string;
  discount_type?: 'percent' | 'amount';
  discount_value?: number;
  surcharge_name?: string;
  surcharge_amount?: number;
  surcharges?: SurchargeItem[];
  markup_tax_percent?: number;
  contract_url?: string;
  is_locked?: boolean;
  // Meta Ads Conversions API Tracking
  meta_lead_id?: string;
  customer_email?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  conversion_event_id?: string;
}

export type MetaTrackingType = 'PHONE_LEAD' | 'ORDER_CREATED' | 'PURCHASE_REVENUE';
export type MetaEventName = 'Lead' | 'Purchase' | 'Contact' | 'CompleteRegistration';

export interface MetaConversionLog {
  id: string;
  order_id?: string | null;
  tour_id?: string | null;
  tour_code?: string | null;
  event_name: MetaEventName | string;
  tracking_type: MetaTrackingType;
  event_id: string;
  meta_lead_id?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  hashed_phone?: string | null;
  hashed_email?: string | null;
  revenue_value: number;
  currency: string;
  payload?: any;
  response_data?: any;
  status: 'success' | 'error' | 'pending_config';
  error_message?: string | null;
  created_at: string;
}

export interface MetaLead {
  id: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_avatar?: string | null;
  gender?: string | null;
  page_id?: string | null;
  psid?: string | null;
  ad_id?: string | null;
  meta_lead_id?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  source_channel?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  status: 'lead_captured' | 'lead_converted' | 'contacted' | 'unqualified' | string;
  assigned_to?: string | null;
  assigned_name?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface MetaCapiConfig {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
  isEnabled: boolean;
}

export interface Passenger {
  id: string;
  order_id: string;
  is_payer: boolean; // Người trả tiền
  full_name: string;
  name?: string;
  passport_number?: string;
  phone?: string;
  dob?: string;
  passport_url?: string;
  labor_contract_url?: string;
  gender?: string; // Giới tính (Mr, Mrs, Ms...)
  nationality?: string; // Quốc tịch
  passport_issue_date?: string; // Ngày cấp hộ chiếu
  passport_expiry_date?: string; // Ngày hết hạn hộ chiếu
  visa_status: 'pending' | 'processing' | 'approved' | 'rejected' | 'not_required' | 'disqualified';
  needs_visa_service?: boolean; // Tùy chọn làm visa thông qua tour
  visa_submitted_at?: string;
  visa_disqualified_reason?: string;
  created_at?: string;
}

export interface MembershipSettings {
  silverMin: number;
  goldMin: number;
  platinumMin: number;
}

export interface Invoice {
  id: string;
  order_id: string | null;
  tour_id?: string;
  tour_code?: string;
  tour_name?: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  type: 'receipt' | 'payment';
  payment_method?: string;
  description?: string;
  invoice_code?: string;
  file_url?: string;
  created_by?: string;
  verified_by?: string;
  verified_at?: string;
  created_at?: string;
  refund_method?: string;
  refund_bank_name?: string;
  refund_account_number?: string;
  refund_account_name?: string;
}

export type ProposalStatus = 'pending_leader' | 'approved_leader' | 'rejected_leader' | 'approved_accounting' | 'rejected_accounting';

export interface PaymentProposal {
  id: string;
  code: string;
  proposal_type: 'individual' | 'tour' | 'general';
  title: string;
  amount: number;
  payment_method: 'Chuyển khoản' | 'Tiền mặt';
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  tour_id?: string;
  tour_code?: string;
  tour_name?: string;
  due_date?: string;
  file_url?: string;
  note?: string;
  created_by_id?: string;
  created_by_name: string;
  created_by_role: Role;
  created_at: string;
  leader_status: 'pending' | 'approved' | 'rejected';
  leader_approved_by?: string;
  leader_approved_at?: string;
  leader_note?: string;
  accounting_status: 'pending' | 'approved' | 'rejected';
  accounting_approved_by?: string;
  accounting_approved_at?: string;
  accounting_note?: string;
  accounting_proof_url?: string;
  status: ProposalStatus;
}

export interface LandtourCost {
  id: string;
  supplierName: string;
  amount: number;
  updatedAt: string;
}

export interface PartnerPaymentInstallment {
  id: string;
  amount: number;
  payment_method?: string;
  payment_date?: string;
  note?: string;
  proof_url?: string; // Ảnh xác nhận / UNC / Biên lai do Kế toán upload
  status?: 'pending' | 'approved' | 'rejected';
  invoice_id?: string;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  transfer_note?: string;
  created_at?: string;
}

export interface PartnerPayment {
  id: string;
  partnerName: string;
  amountToPay: number;
  status: 'unpaid' | 'partially_paid' | 'paid';
  voucherUrl?: string; // Chứng từ / đề xuất ban đầu
  proofUrl?: string; // Ảnh xác nhận thanh toán do Điều hành upload
  invoiceId?: string;
  installments?: PartnerPaymentInstallment[];
}

export interface TourCost {
  tourId: string;
  flightAmount: number;
  insuranceAmount: number;
  tourGuideAmount: number;
  giftAmount: number;
  commissionAmount: number;
  advertisingAmount: number;
  otherAmount?: number;
  visaAmount?: number;
  landtours: LandtourCost[];
  partnerPayments: PartnerPayment[];
  updatedAt: string;
}

export interface Notification {
  id: string;
  type: 'accounting' | 'visa' | 'extension' | 'order' | 'system';
  title: string;
  message: string;
  targetId?: string;
  createdAt: string;
  read: boolean;
}

export interface ActivityLog {
  id: string;
  user_id?: string;
  user_name: string;
  user_email?: string;
  user_role: Role;
  action: string;
  module: 'Tour' | 'Đơn hàng' | 'Visa' | 'Kế toán' | 'Hành khách' | 'Thành viên' | 'Chi phí' | 'Hệ thống';
  details?: string;
  created_at: string;
}

export interface TourMedia {
  id: string;
  tour_id: string;
  tour_code?: string;
  file_url: string;
  file_id?: string;
  file_name: string;
  file_size?: number;
  uploaded_by: string;
  uploader_role?: string;
  caption?: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id?: string;
  recipient_id?: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  attachments?: { url: string; name: string; type: 'image' | 'file' }[];
  tour_code?: string;
  order_code?: string;
  proposal_code?: string;
  reactions?: Record<string, string[]>;
  reply_to?: { id: string; sender_name: string; content: string };
  created_at: string;
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  role_access?: string[];
  icon?: string;
  type?: 'preset' | 'custom';
  members?: string[];
  created_by?: string;
  created_at?: string;
}



