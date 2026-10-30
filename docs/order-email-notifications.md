# Sipariş ve kargo e-postaları

## Davranış

- Yeni manuel sipariş veya ödemesi başarılı duruma geçen sipariş için “Siparişiniz alındı”. Bekleyen/başarısız ödeme için onay mesajı yok; ödeme altyapısını bu özellik etkinleştirmez.
- İlk `shipped` geçişinde firma ve takip numarası içeren “Siparişiniz kargoya verildi”.
- Alıcı yalnızca siparişin hesabına bağlı, doğrulanmış Auth e-posta adresidir. Misafir siparişleri e-posta toplamadığından kapsam dışıdır. Daha sonra hesap bağlanan eski siparişler için geriye dönük toplu mesaj gönderilmez.
- Gönderici: `Öz Kırtasiye <hesap@ozkirtasiye.net>`. E-posta sade metin olarak gönderilir; adres/telefon, kart veya fatura detayları içermez. Hesap sayfasına sabit bağlantı vardır.

## Güvenilirlik ve güvenlik

Sipariş işlemiyle aynı transaction içinde özel outbox kaydı oluşturulur. Resend isteği veritabanı transaction'ının dışındadır; sağlayıcının kesintisi sipariş kaydını engellemez. Her sipariş/olay için tek kayıt ve değişmez gönderim içeriği vardır. İşçiler `SKIP LOCKED`, 5 dakikalık kira ve benzersiz kira token'ı ile yarışmaz. Eski işçi yeni işçinin sonucunu değiştiremez.

Her istekte sabit `Idempotency-Key` kullanılır. Ağ hatası, 408, 429 ve 5xx hataları artan beklemeyle en fazla 6 kez denenir. Kalıcı 4xx hataları inceleme için ayrılır. Resend anahtarları yalnızca 24 saat tuttuğu için 23 saati aşmış belirsiz gönderimler otomatik tekrar gönderilmez. “Sent” yalnızca sağlayıcının kabulüdür; gelen kutusu teslimi değildir. Teslim/bounce takibi Resend panelindedir; webhook bu sürümde yoktur.

Outbox ve ayar tablolarına tarayıcıların erişimi yoktur. Claim/ack RPC'leri yalnızca service_role içindir. İşçi gateway JWT doğrulamasına ek olarak service_role credential'ını kontrol eder; gövdesinden alıcı/metin kabul etmez. Log/yanıtlarda alıcılar ve anahtarlar bulunmaz. Sonuçlanan kayıtların içerikleri 30 gün sonra temizlenir, tekilleştirme kaydı korunur.

## Canlıya alma

1. Migration'ı uygulayın; varsayılan gönderim **kapalıdır**. Eski siparişler kuyruklanmaz.
2. Supabase Edge Functions → Secrets bölümünde **ORDER_RESEND_API_KEY** değerini doğrudan Resend anahtarınızla ekleyin. SMTP password ayarı Edge Functions'a otomatik aktarılmaz. Yetki yalnızca ilgili domainde e-posta gönderimi olabilir. Anahtarı sohbete/GitHub'a eklemeyin.
3. `order-email-worker` Edge Function'ı JWT doğrulaması açık şekilde dağıtın. Projenin `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` değerleri Edge ortamında otomatik sağlanır.
4. Supabase Vault'ta **order_email_service_role** adında gizli kayıt oluşturun. Değer proje API Keys → Legacy API Keys bölümündeki **service_role** JWT anahtarıdır. Publishable/anon anahtarı veya `sb_secret_...` bu JWT gateway akışıyla aynı değildir. Anahtarı yalnızca Vault ekranına girin, paylaşmayın.
5. `supabase/operations/enable-order-emails.sql` script'ini uygulayın. Bu işlem Vault anahtarını varlık kontrolünden geçirir, 5 dakikada bir çalışan işi kurar ve yalnızca bundan sonraki olayların kuyruklanmasını açar. Cron/platform kotalarını izleyin. `pg_net` anahtarı istek kuyruğunda geçici olarak tutar; bu şemaya tarayıcı rolleri için erişim verilmemeli.
6. İşletmenin izin verdiği doğrulanmış test hesabıyla iki `is_test=true`, `order_id=null` kuyruk kaydı kullanılarak TEST başlıklı örnek gönderimler yapılabilir. Bunlar gerçek sipariş/stok değişikliği gerektirmez ve genel gönderim kapalıyken de işlenir. Alıcının onayı olmadan örnek mesaj eklemeyin. Sipariş ve kargo geçişlerinin gerçek entegrasyonunu ayrıca izole veritabanı testleri doğrular. Resend kabulünü ve posta kutusunu kontrol edin.

## İzleme ve durdurma

Yönetim menüsü → E-posta gönderimleri ekranı açık/kapalı, bekleyen, kabul edilen ve inceleme gereken sayıları gösterir. Sıradan üye admin RPC'sini kullanamaz.

Durdurmak için SQL Editor'de `update private.order_email_settings set enabled=false where id;` kullanın. Bu, yeni kuyruk oluşturmayı ve claim işlemini durdurur; hâlihazırda sağlayıcıya gönderilen isteği geri alamaz. Zamanlayıcıyı ayrıca `select cron.unschedule('order-email-worker');` ile kaldırabilirsiniz. Anahtar değişince Vault ve Edge secret'larını eşleştirin.

Başarısız gönderimleri, özellikle 23 saati aşanları, sağlayıcı kayıtlarıyla eşleştirmeden elle yeniden sıraya almayın. Üretim anahtarı olmadan sadece migration/işçi dağıtımı yapılması canlı e-postayı etkinleştirmiş sayılmaz.

Kaynaklar: [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [Supabase zamanlanmış işçiler](https://supabase.com/docs/guides/functions/schedule-functions), [Supabase gizli değişkenleri](https://supabase.com/docs/guides/functions/secrets).
