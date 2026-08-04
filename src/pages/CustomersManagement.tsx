import { Mail, Phone, MapPin } from 'lucide-react';

const MOCK_AGENTS = [
  {
    id: 'A-01',
    name: 'Đại lý Việt Travel',
    email: 'contact@viettravel.com.vn',
    phone: '1900 1839',
    address: '190 Pasteur, Phường Võ Thị Sáu, Quận 3, TP. HCM',
    tier: 'Gold Partner',
    totalBookings: 154,
    commissionPaid: 95400000,
  },
  {
    id: 'A-02',
    name: 'Saigontourist Group',
    email: 'info@saigontourist.net',
    phone: '028 3827 2727',
    address: '45 Lê Lợi, Quận 1, TP. HCM',
    tier: 'Platinum Partner',
    totalBookings: 242,
    commissionPaid: 165000000,
  },
  {
    id: 'A-03',
    name: 'Đại lý Du Lịch Toàn Cầu',
    email: 'booking@globaltravel.com',
    phone: '0909 999 888',
    address: '12 Mạc Đĩnh Chi, Quận 1, TP. HCM',
    tier: 'Silver Partner',
    totalBookings: 45,
    commissionPaid: 27000000,
  }
];

export default function CustomersManagement() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Quản lý Đại lý (Agent)</h2>
        <p className="text-sm text-gray-500 mt-1">
          Theo dõi danh sách các đại lý phân phối Tour, hoa hồng đại lý và doanh số tích lũy.
        </p>
      </div>

      {/* Grid of Partners */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {MOCK_AGENTS.map(agent => (
          <div key={agent.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{agent.id}</span>
                  <h3 className="text-lg font-bold text-gray-900 mt-0.5">{agent.name}</h3>
                </div>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                  agent.tier.includes('Platinum') ? 'bg-purple-100 text-purple-800' :
                  agent.tier.includes('Gold') ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {agent.tier}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                  <span className="truncate">{agent.email}</span>
                </div>
                <div className="flex items-center">
                  <Phone className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                  <span>{agent.phone}</span>
                </div>
                <div className="flex items-start">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{agent.address}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-150 grid grid-cols-2 gap-4 text-center">
              <div>
                <span className="text-xs text-gray-500 font-medium">Tổng Booking</span>
                <div className="text-lg font-bold text-gray-900 mt-0.5">{agent.totalBookings} đơn</div>
              </div>
              <div>
                <span className="text-xs text-gray-500 font-medium">Hoa hồng tích lũy</span>
                <div className="text-lg font-bold text-green-600 mt-0.5">
                  {new Intl.NumberFormat('vi-VN').format(agent.commissionPaid)} VND
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
