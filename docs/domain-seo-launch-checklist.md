# Öz Kırtasiye — Domain ve SEO yayın kontrol listesi (Aşama 30)

Bu doküman, **henüz satın alınmamış bir domaini varsaymadan** canlıya geçişi
hazırlar. `main`e kod merge edilmesi, domain kaydı/DNS işlemlerini yapmaz
ve Google indekslemesini otomatik açmaz.

## 1. Alan adı kaydı (işletme sahibi tarafından)

- Kısa, kolay yazılan ve işletmeye ait kullanılabilir bir alan adı seçin.
- Alan adı müsaitliği, marka/tescil ve yenileme fiyatını kayıt firmasında kontrol
  edin; alan adını işletmenin kontrolündeki hesapla satın alın.
- Tek bir **asıl (canonical) adres** belirleyin: `https://domaininiz.tld`
  **veya** `https://www.domaininiz.tld`.
- Domain hesabına iki faktörlü doğrulama açın, yenileme hatırlatıcısı kurun.
- Yayın öncesinde işletmeye ait destek e-postası adresini ve yetkisini hazırlayın.

## 2. Vercel domain bağlantısı

1. Vercel proje ayarları → **Domains** alanına asıl domaini ekleyin.
2. Kayıt firması DNS panelinde **Vercel'in o projede gösterdiği** A/CNAME
   kayıtlarını uygulayın; zamanla değişebilecek IP'leri bu dokümandan kopyalamayın.
3. Hem `www` hem de kök alan adını gerekiyorsa Vercel'e tanımlayın.
   İkinci adresi **asıl adrese kalıcı yönlendirin**; iki ayrı canonical URL bırakmayın.
4. Vercel'de domainin doğrulandığını, HTTPS sertifikasının etkin olduğunu
   ve yönlendirmelerin zincir/sonsuz döngü yaratmadığını test edin.
5. Supabase Auth URL Configuration'da **Site URL** ve **Redirect URLs**
   ayarlarına gerçek alan adındaki güvenli giriş callback adreslerini ekleyin.
   Giriş/şifre sıfırlama akışını yeniden test edin.
6. Üretim ve preview deployment'ların ayrı ortam değişkenleri kullandığını doğrulayın.

## 3. SEO ortam değişkenleri

Vercel **Production** ortamında:

- `SITE_URL=https://ASIL-ALAN-ADINIZ` — yalnızca doğrulanmış, HTTPS, path
  ve query içermeyen, kök `/` adresi. Değer `.vercel.app`, localhost,
  IP veya preview alan adı olmamalıdır.
- `SEO_INDEXABLE=false` — **yayına gerçekten hazır olana dek** açıkça
  false bırakın.
- Yayına çıkmaya karar verildiğinde, içerik/ürün/yasal kontrollerden sonra
  yalnızca production ortamında `SEO_INDEXABLE=true` yapıp yeniden deploy edin.

`NODE_ENV=production`, `VERCEL_ENV=production`, geçerli `SITE_URL`
ve `SEO_INDEXABLE=true` koşullarının tamamı sağlanmadan public sayfalar
indekslenebilir olmaz. Vercel preview/development otomatik `noindex` kalır.

## 4. Yayın kontrolü

- Üretimde `/robots.txt` dosyasında storefront için doğru erişim
  ve `/sitemap.xml` adresi görünüyor mu?
- Index açılmadan önce `/robots.txt` tüm botları engelliyor mu ve
  `/sitemap.xml` boş mu?
- Ürün ve kategori URL'lerinin canonical adresi seçilen asıl domainde mi?
- Favoriler, sepet, giriş, hesap, checkout ve admin sayfaları `noindex` mi?
- `/magaza/urun/[slug]` yalnızca aktif ürünler için geçerli metadata
  ve ürün verisi üretiyor mu? Eski demo ürün yolu katalog listesine yönleniyor mu?
- Paylaşım için ana Open Graph görselini sosyal medya ön izleme
  araçlarında kontrol edin; SEO sıralamasını garanti etmez.
- Sitemap: aktif ürünler dahil; şu anda güvenlik için 20.000 ürün sınırı
  vardır. Katalog bu sınırı aşarsa canlı indekslemeye geçmeden
  bölünmüş sitemap yapısı gerekir (eksik liste yayımlanmaz).

## 5. Google Search Console

- Domain mülkiyetini **DNS kaydı ile** Google Search Console'da doğrulayın.
- `https://ASİL-ALAN-ADINIZ/sitemap.xml` adresini gönderin.
- Ana sayfa, `/urunler` ve birkaç ürün URL'si için
  URL Denetleme ile indekslemeyi kontrol edin.
- Birkaç gün içinde kapsam/hata raporlarını izleyin; indekslenme
  anlık veya garantili değildir.

## 6. Ticaret ve güvenlik kontrolü (SEO indekslemesinden önce)

- Mağaza iletişim bilgileri, iade adresi, teslimat politikası,
  fatura/vergisel bilgiler ve güncel hukuk metinleri tamamlanmalı.
- `ORDER_REQUESTS_ENABLED` yalnızca sipariş talebi akışı test
  edildiyse açılmalı. PayTR **29.2 bekliyor**; kartlı ödeme
  etkin değil, metinler buna uygun kalmalıdır.
- İşletme e-postası için SPF/DKIM/DMARC sağlayıcının önerisine
  göre yapılandırılmalı; hiçbir DNS anahtarı veya gizli bilgi GitHub'a
  yazılmamalıdır.

**Tamamlama kriteri:** Domain kaydı, Vercel doğrulaması, HTTPS,
kalıcı yönlendirmeler, giriş callback testleri, gerçek mağaza bilgileri,
SEO tarama kontrolü ve Search Console doğrulaması bitmeden
`SEO_INDEXABLE=true` yapılmaz.
