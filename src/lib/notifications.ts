export type NotificationAudience = 'admin' | 'customer';

export type StoreNotification = {
  id: string;
  audience: NotificationAudience;
  event_type: 'order_created' | 'order_updated' | 'return_created' | 'return_updated';
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

export function formatNotificationDate(date: string) {
  return new Date(date).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
