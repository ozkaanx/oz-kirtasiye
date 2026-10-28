export type AccountTab = 'overview' | 'addresses' | 'orders';

/** URL parameters are untrusted: invalid values always return the profile tab. */
export function parseAccountTab(value: string | string[] | undefined): AccountTab {
  if (value === 'addresses' || value === 'orders') return value;
  return 'overview';
}

export type OrderTone = 'neutral' | 'success' | 'warning' | 'danger';

export function orderStatusPresentation(status: string): { label: string; tone: OrderTone } {
  const statuses: Record<string, { label: string; tone: OrderTone }> = {
    new: { label: 'Yeni talep', tone: 'neutral' },
    contacted: { label: 'Görüşüldü', tone: 'neutral' },
    awaiting_payment: { label: 'Ödeme bekleniyor', tone: 'warning' },
    paid: { label: 'Ödeme alındı', tone: 'success' },
    processing: { label: 'Hazırlanıyor', tone: 'warning' },
    shipped: { label: 'Kargoda', tone: 'warning' },
    delivered: { label: 'Teslim edildi', tone: 'success' },
    completed: { label: 'Tamamlandı', tone: 'success' },
    cancelled: { label: 'İptal edildi', tone: 'danger' },
  };
  return statuses[status] ?? { label: 'Durum güncelleniyor', tone: 'neutral' };
}

export function paymentStatusPresentation(status: string): { label: string; tone: OrderTone } {
  const statuses: Record<string, { label: string; tone: OrderTone }> = {
    not_collected: { label: 'Ödeme henüz alınmadı', tone: 'neutral' },
    pending: { label: 'Ödeme bekleniyor', tone: 'warning' },
    paid: { label: 'Ödeme alındı', tone: 'success' },
    failed: { label: 'Ödeme başarısız', tone: 'danger' },
    expired: { label: 'Ödeme süresi doldu', tone: 'danger' },
    requires_review: { label: 'Ödeme inceleme aşamasında', tone: 'warning' },
  };
  return statuses[status] ?? { label: 'Ödeme durumu doğrulanamadı', tone: 'neutral' };
}
