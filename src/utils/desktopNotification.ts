/**
 * Tour CRM - Hệ Thống Quản Lý Thông Báo Đẩy Desktop (Native Web Push Notifications)
 * Tương thích: Chrome, Edge, Safari, Firefox trên Windows, macOS, Linux, Android
 */

const STORAGE_KEY_ENABLED = 'crm_desktop_notif_enabled';
const STORAGE_KEY_MUTED = 'crm_desktop_notif_sound_muted';

/**
 * Kiểm tra xem trình duyệt hiện tại có hỗ trợ Notification API hay không
 */
export function isDesktopNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Lấy trạng thái quyền hiện tại từ trình duyệt
 * 'granted' (Đã cấp quyền) | 'denied' (Đã chặn) | 'default' (Chưa hỏi)
 */
export function getDesktopNotificationPermission(): NotificationPermission {
  if (!isDesktopNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Kiểm tra xem người dùng đã bật thông báo Desktop trong CRM hay chưa
 */
export function isDesktopNotificationEnabled(): boolean {
  if (!isDesktopNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  return localStorage.getItem(STORAGE_KEY_ENABLED) !== 'false';
}

/**
 * Bật hoặc tắt trạng thái nhận thông báo trong CRM
 */
export function setDesktopNotificationEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY_ENABLED, enabled ? 'true' : 'false');
}

/**
 * Kiểm tra trạng thái bật/tắt âm thanh
 */
export function isDesktopNotificationSoundMuted(): boolean {
  return localStorage.getItem(STORAGE_KEY_MUTED) === 'true';
}

/**
 * Bật/tắt âm thanh thông báo
 */
export function setDesktopNotificationSoundMuted(muted: boolean): void {
  localStorage.setItem(STORAGE_KEY_MUTED, muted ? 'true' : 'false');
}

/**
 * Yêu cầu quyền gửi thông báo từ người dùng
 */
export async function requestDesktopNotificationPermission(): Promise<boolean> {
  if (!isDesktopNotificationSupported()) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setDesktopNotificationEnabled(true);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Lỗi khi yêu cầu cấp quyền Notification:', error);
    return false;
  }
}

/**
 * Phát âm thanh chuông thông báo AD Luxury (Web Audio API - E6 -> B6 Crystal Chimes)
 * Không phụ thuộc file mp3 ngoài, độ trễ 0ms, không lỗi CORS
 */
export function playNotificationSound(): void {
  if (isDesktopNotificationSoundMuted()) return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Âm 1: E6 (1318.5 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.5, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Âm 2: B6 (1975.5 Hz) sau 120ms
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1975.5, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.warn('Không thể phát âm thanh chuông:', e);
  }
}

export interface DesktopNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: any;
  playSound?: boolean;
  onClick?: () => void;
}

/**
 * Gửi thông báo đẩy Native lên Desktop của máy tính
 */
export function sendDesktopNotification(payload: DesktopNotificationPayload): Notification | null {
  if (!isDesktopNotificationSupported()) {
    return null;
  }

  if (Notification.permission !== 'granted' || !isDesktopNotificationEnabled()) {
    return null;
  }

  // Phát âm thanh chuông
  if (payload.playSound !== false) {
    playNotificationSound();
  }

  try {
    const notif = new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/favicon.svg',
      badge: payload.badge || '/favicon.svg',
      tag: payload.tag || `crm-notif-${Date.now()}`,
      data: payload.data || { url: payload.url },
      requireInteraction: false,
      silent: true // Tắt tiếng mặc định của OS để dùng tiếng chimes mượt mà của Web Audio
    });

    notif.onclick = () => {
      try {
        window.focus();
      } catch {}

      if (payload.onClick) {
        payload.onClick();
      }

      if (payload.url) {
        // Kích hoạt điều hướng React Router qua custom event
        window.dispatchEvent(new CustomEvent('crm-navigate-to', { detail: { path: payload.url, data: payload.data } }));
      }

      notif.close();
    };

    return notif;
  } catch (error) {
    console.warn('Lỗi khi hiển thị Desktop Notification:', error);
    return null;
  }
}

/**
 * Gửi thông báo đẩy thử nghiệm (Test Notification)
 */
export function sendTestDesktopNotification(): boolean {
  if (Notification.permission !== 'granted') {
    return false;
  }

  sendDesktopNotification({
    title: '🔔 AD Luxury Tours - Kiểm Tra Thông Báo',
    body: 'Hệ thống thông báo đẩy Desktop đã được kích hoạt thành công! Bạn sẽ nhận được thông báo ngay cả khi đang làm việc trên ứng dụng khác.',
    url: '/leave-requests',
    playSound: true
  });

  return true;
}
