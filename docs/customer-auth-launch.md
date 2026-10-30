# Alan adı üzerinden üyelik ve e-posta hazırlığı

## Canlı test bulgusu

30 Ekim 2026: Kullanıcının izin verdiği adrese mağazanın şifre sıfırlama formundan tek istek gönderildi. Kullanıcı e-postanın geldiğini, bağlantının eski Vercel projesine yönlendiğini doğruladı. Bu bulgu teslimatın tamamını veya kayıt/giriş testinin geçtiğini göstermez. Test adresi ve tek kullanımlık kodlar bu dokümana kaydedilmez.

## Supabase URL ayarları

Authentication → URL Configuration:

- Site URL: `https://ozkirtasiye.net`
- Redirect URLs: `https://ozkirtasiye.net/auth/callback?next=/hesabim`
- Redirect URLs: `https://ozkirtasiye.net/auth/callback?next=/sifre-yenile`
- Eski, kaldırılmış Vercel projesinin adresini kaldırın. Geliştirme adreslerini yalnızca gerçekten kullanılıyorsa tutun. Üretim için geniş wildcard kullanmayın.

Uygulama PKCE kullanır. E-posta isteğini başlattığınız tarayıcıda bağlantıyı açın; farklı tarayıcıda PKCE doğrulayıcısı bulunmadığı için bağlantı doğrulanamayabilir. Ayar değişikliğinden önceki e-postayı yeniden kullanmayın, yeni istek oluşturun.

## Resend ile gerçek gönderim

1. İşletmenin hesabında Resend domain doğrulamasını tamamlayın. Gösterilen SPF/DKIM kayıtlarını GoDaddy'ye aynen girin. Mevcut DNS ve DMARC kayıtlarını körlemesine silmeyin; aynı ad için ikinci SPF kaydı eklemeyin.
2. Doğrulanmış alan adında gönderici seçin. Öneri: `Öz Kırtasiye <hesap@ozkirtasiye.net>`. Gönderici adresi, çalışan bir destek posta kutusu olduğu anlamına gelmez; destek adresini ayrıca işletme belirler.
3. Supabase → Authentication → Email → SMTP Settings: Host `smtp.resend.com`, Port `465`, Username `resend`, Password alanına işletmenin Resend API anahtarı. Anahtarı GitHub'a veya sohbete yazmayın. Gönderici adresi ve adı girilip kaydedilmeli.
4. E-posta bağlantısı izlemeyi kapalı tutun. Kimlik doğrulama bağlantılarının izleme yönlendirmeleriyle değiştirilmesi akışı bozabilir.
5. Supabase email templates alanına `docs/email-templates/confirm-signup.html` ve `reset-password.html` dosyalarını ilgili şablonlara uygulayın. Konular: “Öz Kırtasiye hesabını doğrula” ve “Öz Kırtasiye şifreni yenile”. `ConfirmationURL` Supabase tarafından üretilir; URL ayarları yine doğru olmalı.
6. Sağlayıcı hesap kotasını ve Supabase gönderim sınırlarını kontrol edin. Hiçbir ücretsiz kota sınırsız kabul edilmez.

## Kabul kontrolleri

- Yeni hesap: kullanıcı kendi şifresini girer; doğrulama e-postası gelir; aynı tarayıcıdan açılınca gerçek alan adındaki hesap ekranı açılır.
- Çıkış/giriş: doğru şifre hesap ekranını açar, hatalı şifre anlaşılır bir hata gösterir.
- Sıfırlama: gerçek alan adında istek, e-posta, aynı tarayıcıda yeni şifre ekranı, kullanıcı tarafından şifre değişikliği ve yeniden giriş.
- Süresi dolmuş, tekrar kullanılmış, eksik veya hatalı bağlantılar giriş ekranında güvenli hata gösterir; kod/token hata mesajına taşınmaz.
- Kayıtlı olmayan adrese sıfırlama isteği hesabın varlığını açıklamaz.

Bu adımlar kullanıcı tarafından veya canlı tarayıcıda doğrulanmadan tamamlandı olarak işaretlenmez. Sipariş/kargo e-postaları ayrıca uygulama entegrasyonu gerektirir; SMTP ayarı onları kendiliğinden etkinleştirmez.

Kaynaklar: [Supabase yönlendirme ayarları](https://supabase.com/docs/guides/auth/redirect-urls), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Resend SMTP bağlantısı](https://resend.com/docs/send-with-supabase-smtp).
