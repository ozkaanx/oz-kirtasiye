# /hesabim UI Refactor — Görsel ve Fonksiyonel QA

Bu PR sadece müşteri hesabı görünümünü/erişilebilirliğini iyileştirir.
Supabase migration, sipariş ve kupon fiyatlandırma/iş kuralları değişmez.

## Oturumlu test hesaplarında kontrol

### Masaüstü (1280px+)
- /hesabim: soldaki menü, sağ profil paneli, 2 özet kartı ve kupon alanı dengeli mi?
- Site üst menüsü sticky olduğunda hesap yan menüsü onun **altında** kalıyor mu?
- Adreslerim: yeni adres formu, düzenleme, varsayılan yapma ve silme başarılı mı?
- Siparişlerim: sipariş referansı, durum, tarih, ürün tutarı, fatura, kargo ve ödeme etiketi doğru mu?
- Avantajlar, iade/değişim ve bildirimler: ortak başlık ve navigasyon tutarlı mı?

### Tablet (768–1024px)
- Yan menü/panel taşması, uzun e-posta, ürün adı ve sipariş referansı kontrolü.
- İade ekranında iki kolonun tek kolona dönüşmesi ve kupon kartları.

### Mobil (320px, 375px, 390px, 430px)
- Hesap menüsü satır kırmadan yatay kaydırılabiliyor mu; tüm 6 bağlantı erişilebilir mi?
- Profil formu ve özet kartları ekrandan taşmıyor mu?
- Adres düzenle butonuna bastığında adres başlığı alanı görünür ve odakta mı?
- Yeni adres, vazgeç, kaydet, varsayılan ve sil butonları rahat basılıyor mu?
- Sipariş kartı/timeline uzun kargo takip numarasıyla taşmıyor mu?
- Kupon kodu, indirim etiketi, sepet butonları ve bildirim listesi sığabiliyor mu?

## Derin bağlantı ve erişilebilirlik
- `/hesabim` profil sekmesini açar.
- `/hesabim?tab=addresses` adresleri açar.
- `/hesabim?tab=orders` siparişleri açar.
- Bilinmeyen `?tab` değerleri profil sekmesine düşer.
- Klavye Tab / Shift+Tab ile menü, kayıt alanları ve işlemler erişilebilir mi?
- Klavye odağı görünüyor mu, ekran okuyucu aktif sekmeyi `aria-pressed` ile algılıyor mu?
- Hata ve başarı mesajları `role=alert/status` ile okunuyor mu?

## Test edilecek ödeme durumları
`not_collected`, `pending`, `paid`, `failed`, `expired`,
`requires_review` durumları müşteriye farklı ve gerçeğe uygun açıklamayla gösterilir.
Demo kartlı ödeme akışı bu UI PR'ı ile açılmaz.

## Kabul
CI'da TypeScript, test, lint, build ve database işi yeşil olmalı.
Ekran görüntüsü/oturum gerektiren tarayıcı QA'sı kaynak kod incelemesi ile
eşdeğer değildir; deploy preview veya yerel `npm run dev` ile ayrıca doğrulayın.
