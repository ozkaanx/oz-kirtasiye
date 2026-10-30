# Ödeme dışındaki yayın hazırlığı

30 Ekim 2026 kontrolü. Bu liste hesap/dış servis doğrulamasının yerine geçmez.

## Tamamlananlar

- Canlı mağaza ayarlarına Güneşli Vergi Dairesi, kullanıcının bildirdiği No:66/A iade adresi ve Yurtiçi Kargo / tahmini 2 iş gününde kargoya teslim açıklaması kaydedildi.
- İşletme ve teslimat ayarları okunamadığında düzenleme formu açılmaz; varsayılan değerler gerçek kayıtların üzerine yazılamaz. Yeniden deneme ekranı ve kişisel bilgi içermeyen hata kaydı var.
- Yayın kontrolünde boşluk içeren alanlar eksik sayılır; iade işlem talimatları ayrıca kontrol edilir.
- Node sürümü CI ile aynı 22.x ana sürümüne sabitlendi.
- Yeni Vercel projesindeki eksik genel Supabase bağlantı bilgileri eklendi. Main yeniden yayınlandı; Vercel READY, ana sayfa/giriş/kayıt/şifre sıfırlama/iletişim/teslimat sayfaları HTTP 200. Yönetici ayarları oturum açmadan girişe yönlendiriliyor. Robots tüm taramayı engelliyor, sitemap boş.
- Mağaza sayfası hatalarında müşteriye teknik hata ayrıntıları yerine tekrar deneme ekranı gösterilir.

## Hesap veya işletme bilgisi bekleyenler

- **Ürün listesi HTTP 500:** Yeni projede `SUPABASE_SECRET_KEY` eksik. İşletme sahibi bunu Vercel'de Sensitive, Production/Preview olarak eklemeli; sohbet/GitHub üzerinden paylaşmamalı. Ardından yeniden yayın ve ürün/kampanya sorguları doğrulanmalı. Bu anahtar olmadan katalog kontrolü başarılı sayılmaz.
- Destek telefonu belirlenmedi. İade işlem talimatlarını işletme tamamlamalı.
- Kayıtlı işletme adresi ile iade adresi farklı olabilir; resmî adres vergi levhasına göre işletme tarafından doğrulanmalı.
- Alan adı GoDaddy DNS kayıtları Vercel'in bu proje için verdiği güncel A/CNAME değerleriyle eşleşmeli. HTTPS ve www yönlendirmesi doğrulanmadan arama motoru indekslemesi açılmamalı.
- Supabase Auth Site URL ve izinli callback adresleri gerçek alan adıyla eşleşmeli; kayıt, e-posta doğrulama ve şifre sıfırlama gerçek posta kutusunda denenmeli.
- İşletme e-postası / gönderim sağlayıcısı seçilmeli; SPF, DKIM ve DMARC doğrulanmalı. Sipariş/kargo e-postaları henüz uygulanmış değil. Gizli anahtarlar yalnızca servis panellerine girilmeli.
- XML tedarikçi seçilmedi. Önce mevcut stoktan küçük bir katalog mevcut içe aktarma önizlemesiyle yüklenebilir. Tedarikçi seçildiğinde ürün kimliği, stok/fiyat güncelleme sıklığı, görsel kullanım izni, kargo/iade ve satış kısıtları yazılı netleştirilmeli.
- Veritabanı yedekleme kapsamı ve geri yükleme prosedürü Supabase planında doğrulanmalı; müşteri verileri GitHub'a aktarılmamalı.

## Son doğrulama

Doğru alan adı üzerinden mobil/masaüstü ürün arama, varyant seçimi, sepet, giriş, favori, hesap, izinli sipariş talebi ve yönetici sipariş/kargo/iade akışı denenmeli. Başarısız yayın veya eksik iletişim alanları varken `SEO_INDEXABLE=false` korunmalı. Ödeme çalışması ayrı yürütülüyor.
