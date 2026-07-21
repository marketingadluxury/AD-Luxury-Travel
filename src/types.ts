export type Role = 'sale' | 'operator' | 'visa' | 'accounting' | 'admin' | 'CTV' | 'Đại lý';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
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
  itinerary_pdf_url?: string; // Link file PDF lịch trình chi tiết
  notice_sections?: string; // Bảng thông tin đi tour/Lưu ý dưới dạng JSON string
  tour_type?: 'internal' | 'partner' | 'private' | 'visa';
  // Đối tác nhận khách
  partner_name?: string;
  partner_contact?: string;
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

export interface Order {
  id: string;
  tour_id: string;
  customer_id?: string;
  salesperson_id?: string;
  created_by: string; // Tên người tạo
  user_id?: string;
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

