# Aşama 29.1 — ödeme ve stok rezervasyonu temeli

Bu aşama **canlı PayTR ödemesi açmaz**. Herhangi bir tarayıcı/API endpoint'ine
`begin_payment_reservation` veya `finish_payment_reservation` bağlanmamıştır.
Var olan **manuel sipariş talebi** işleyişi ve adminin manuel stok işlemleri
değişmeden sürer.

## Kayıtlar ve durumlar

- `private.payment_attempts`: sipariş başına tek ödeme denemesi, PayTR için eşsiz
  `merchant_oid`, kuruş cinsinden değişmez tutar, TRY para birimi, ömür ve durum.
- `private.payment_reserved_items`: standart ve varyant ürün bazında ayrılan
  miktarlar. Kayıtlar gizli şemadadır; yalnızca servis rolü erişebilir.
- Sipariş `payment_status`: `not_collected`, `pending`, `paid`,
  `failed`, `expired`, `requires_review`.
- Sipariş `status`: ödeme beklerken `awaiting_payment`, başarılı ödemeden
  sonra `paid`. Bu durumlar mevcut manuel admin `prepare` işlemini bilerek
  engeller; ödeme sonrası yeni sipariş yönetim akışı 29.4'te geliştirilecek.

## Atomik işlemler

1. **Başlatma** (yalnızca sunucu servis rolü):
   `public.begin_payment_reservation(order_id,merchant_oid,ttl_seconds)`.
   En fazla 15 dakika önce oluşturulmuş, henüz işleme alınmamış, tutarı pozitif
   siparişlerde 300–1800 saniyelik rezervasyon yapılabilir (varsayılan 900).
   Ürün/varyant stoğu **rezervasyonda** düşülür; katalogdaki kalan stok
   hemen güncellenir. Aynı ödeme kimliğiyle tekrar çağrı ikinci kez düşmez.
2. **Bitirme**: `public.finish_payment_reservation(merchant_oid,outcome,reference)`.
   `succeeded` stok düşümünü kesinleştirir; `failed` stokları geri yükler,
   siparişi iptal eder ve kupon limitinden düşülmesini sona erdirir.
   Tekrar eden/ters sıralı bildirimler stoğu iki kez değiştiremez.
3. **Süre aşımı**: `public.expire_payment_reservations(limit)` en fazla 200
   süresi dolmuş rezervasyonu çağrı başına serbest bırakır (varsayılan 100).
   **Bu fonksiyon henüz planlanmış/çalışan bir cron değildir.** 29.2'de
   güvenilir zamanlayıcıdan periyodik çağrı yapılmalı, alarm kurulmalıdır.
4. **Geç gelen başarılı bildirim**: süresi dolmuş veya başarısız olmuş bir
   rezervasyona başarı gelirse stok yeniden düşülmez; `requires_review`
   olarak işaretlenir. İade/manuel mutabakat 29.4 kapsamında yapılmalıdır.

## Güvenlik

- DB fonksiyonları `SECURITY INVOKER`, **yalnızca service_role** için
  `EXECUTE` yetkili; yeni kayıtlar `private` şemasında ve RLS etkin.
- Adminin eski genel sipariş güncelleme yetkileri, ödeme durumunu değiştiremez
  veya bekleyen/ödenmiş siparişin bilgilerini değiştiremez.
- `merchant_oid` tekildir; ödeme miktarı API gövdesinden değil mevcut,
  sunucuda hesaplanıp kaydedilmiş sipariş tutarından alınır.
- 29.2'deki PayTR callback'i **hash ve tutar doğrulaması yapılmadan**
  `finish_payment_reservation` fonksiyonunu asla çağırmamalıdır.
- 29.2 ayrıca sipariş sahibi/oturum doğrulaması, korumalı ödeme başlangıç
  API'si, ödeme sağlayıcı bildirimlerinin kayıt ve mutabakatını sağlamalıdır.
  PayTR'nin verdiği sonucu müşterinin yönlendirme sayfasına göre kabul etmeyin.

## Geliştirme ve yayın sırası

1. CI'da temiz Supabase kurulumunda migration ve
   `supabase/tests/payment_reservation_foundation.sql` testi geçmeli.
2. Yeni migration, uygulama sürümünden **önce** uygun ortama uygulanmalı.
3. Bu aşamada PayTR kimlik bilgisi veya API anahtarı eklenmemeli.
4. 29.2/29.3 entegrasyonu tamamlanana kadar ödeme ekranı aktif edilmemeli.

Manual siparişlerde `payment_status='not_collected'` aynen kalır; mevcut
hazırlıkta stok düşme, iptalde geri yükleme işleyişi korunur.
