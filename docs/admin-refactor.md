# Admin incelemesi ve refactor

## Uygulanan ilk grup

- Korunan admin layout, AdminShell üzerinden tek yan menü ve tek main alanı oluşturur. Sayfalar kendi iş içeriğini sunar. Giriş ekranı bu çerçevenin dışındadır.
- Sayfalarda tekrarlanan üst çubuk ve çıkış işlemi AdminTopbar bileşenine taşındı. Çıkış hatası kullanıcıya gösterilir; başarılı çıkıştan sonra yönlendirme yapılır; eşzamanlı tıklamalar engellenir.
- Ürün/varyant, kategori ve rapor ekranlarının geri dönüş hedefleri korundu. Yorumlar ve özel kupon atama artık ortak gezinmeye dahildir.
- Mobil yan menünün birleşik CSS sınıfı düzeltildi; Escape kapatma ve menü düğmesine odak dönüşü eklendi.
- Sunucu oturum ve store_admins kontrolleri korunur. Bu çalışma veri yazma akışlarını, RPC/RLS politikalarını veya şemayı değiştirmez.

## Sonraki refactor grupları

| Öncelik | Bulgu                                                                                                                                               | Önerilen kapsam                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | admin-products.tsx ürün listesi, ürün formu, dosya yükleme ve stok diyaloğunu birlikte yönetiyor; admin-variants.tsx benzer sorumluluklar içeriyor. | Liste/form/stok diyaloğunu ayır; ortak fiyat, stok ve dosya doğrulamasını saf fonksiyonlara taşı. Boş sayı alanları ve sınır değerleri için anlamlı testler ekle. |
| 2       | Ürünler en yeni 1000, yorumlar 1000, faturalar ve iadeler 200 kayıtla sınırlı. Ürün filtreleri yalnızca yüklenen kümede çalışıyor.                  | Sipariş ekranındaki sunucu tarafı arama/sayfalama yaklaşımını bu ekranlara taşı; toplam ve gösterilen sayıları ayır.                                              |
| 3       | Müşteri detayı yalnızca 100 siparişi gösteriyor; kategori sayımları ilk 2000 üründen hesaplanıyor.                                                  | Sunucu sayımları ve sayfalama kullan; eksik kümeden hesaplanan özetleri açıkça işaretle.                                                                          |
| 4       | Bazı sayfalar Supabase hata mesajlarını doğrudan gösteriyor; hata eşleme farklı bileşenlerde tekrarlanıyor.                                         | Mevcut operasyon izleme yaklaşımını ortak admin hata eşlemesiyle genişlet. Kullanıcı mesajı ile teknik kaydı ayır.                                                |
| 5       | inventory-demo.tsx ve admin-customers.tsx aktif route bileşenlerinden ayrı eski alternatifler.                                                      | Kullanımları doğrulayıp kullanılmayan alternatifleri kaldır; genel CSS içinde yalnız bu ekranlara ait stilleri temizle.                                           |

## Doğrulama ve sınırlar

Üretim derlemesi, TypeScript ve mevcut 38 regresyon testi geçti. ESLint hata vermedi; mevcut 7 uyarı kaldı. Yerel, boş veri kullanan geçici önizlemede 1440 px masaüstü ve 390 px mobil çerçeve, menü açma/Escape ile kapatma, kapalı menünün erişilebilirlik ağacından çıkması, ürün formunun açılıp kapanması ve oturumsuz çıkışın giriş sayfasına yönlendirmesi kontrol edildi. Geçici önizleme route dosyası teslimden önce kaldırıldı. Kaynak taramasında aktif korumalı sayfalardan tekrarlanan çerçeve ve iç içe main alanları kaldırıldı.

Canlı bir admin hesabıyla ürün/stok/sipariş yazma işlemi yapılmadı. Bu ilk grup ortak ekran yapısına odaklanır; tam RLS güvenlik denetimi veya sayfalama dönüşümü olarak değerlendirilmemelidir.

## Uygulanan ikinci grup: ürün ve stok bileşenleri

- AdminProducts yalnızca özetleri, açık pencereyi ve başarı bildirimlerini yönetir. Ürün listesi/filtreler/geçmiş AdminProductList; ürün formu/görsel yükleme AdminProductEditor; stok penceresi AdminProductStockDialog bileşenlerine ayrıldı.
- Formların kendi durumları vardır. Pencere kapatılıp yeniden açıldığında kaydedilmemiş taslak ve hata temizlenir; liste filtresi korunur. Kayıt sürerken formun kapanması engellenir.
- Ürün ve varyantlar fiyat, eski fiyat, stok, uyarı limiti, dosya tipi/boyutu ve stok değişimi için ortak saf doğrulamaları kullanır. Boş zorunlu sayılar sıfıra dönüşmez; ikiden fazla ondalık basamak ve veritabanı sınırını aşan değerler reddedilir. Ürün/varyant satış fiyatı üst sınırları mevcut farklı veritabanı kısıtlarıyla uyumludur.
- Stok azaltma mevcut adedi aşamaz; artış integer sınırını aşamaz. Atomik stok RPC ve sunucu kontrolleri son yetkili kaynak olmaya devam eder. Ürün düzenlemede gizli başlangıç stoku tekrar yazılmaz.
- Normalize edilince boş kalan slug kayıttan önce reddedilir. Dosya doğrulaması 5 MiB PNG/JPEG/WebP sınırını korur, sıfır bayt dosyaları da reddeder.
- 7 yeni sınır testiyle toplam 45 test geçti. TypeScript ve üretim derlemesi geçti; lint hata vermedi (mevcut 7 uyarı).
- Yerel sahte verilerle arama, ürün formunun doğru verilerle açılması, taslağın yeniden açılışta temizlenmesi, filtrenin korunması, geçersiz slug ve aşırı stok azaltmanın isteğe çıkmadan engellenmesi kontrol edildi. Form 390 px mobil genişlikte de incelendi. Canlı veriye yazılmadı; geçici önizleme route dosyası kaldırıldı.

Sıradaki grup: liste arama/filtre/sıralama ve sayfalamanın sunucuya taşınması. Büyük varyant ekranının kendi form/liste alt bileşenlerine ayrılması ayrıca sürdürülebilir. Görsel yükleme sonradan hata verirse kısmi kayıt/retry davranışı ayrı bir iş akışı çalışması gerektirir; mevcut kayıt ve yükleme sırası bu grupta korunmuştur.

## Üçüncü grup: tüm katalogda sunucu araması ve sayfalama

- Ürün listesi URL üzerinden GET filtreleriyle çalışır. Arama, kategori ağacı, yayın durumu, stok ve sıralama admin_search_products RPC içinde uygulanır. Sayfada en fazla 25 kayıt bulunur; arama ilk 1000 kayıtla sınırlı değildir.
- Varyantlı ürünlerde stok aktif varyantların toplamıdır; başlangıç fiyatı stokta bulunan aktif seçeneklerin en düşüğüdür. Stokta aktif seçenek yoksa tüm aktif seçeneklerin en düşük fiyatı, aktif seçenek yoksa ana ürün fiyatı kullanılır. Filtre ve sıralama aynı hesapları kullanır.
- Tam katalog özetleri filtrelerden bağımsızdır. Filtreli toplam ve sayfa bilgileri ayrı gösterilir. Fazla büyük veya silmelerden sonra boş kalan sayfa numarası gerçek son sayfaya sıkıştırılır; eşit sıralama değerlerinde UUID sırası bağlayıcıdır. Ayrı istekler arasında katalog değişirse numaralı sayfaların içeriği de değişebilir.
- Stok geçmişindeki ürün adları ürün listesinin mevcut sayfasından değil ilişki sorgusundan yüklenir. Geçmiş bu grupta son 30 hareketle sınırlıdır.
- RPC security invoker ve boş search_path kullanır, mevcut RLS altında çalışır; ayrıca store_admins kontrolü yapar. Anonim execute yetkisi yoktur. Türkçe arama normalize edilir; yüzde, alt çizgi ve ters eğik çizgi literal karakter kabul edilir. Ada göre sıralama Türkçe ICU kolasyonu kullanır.
- İki uygulama testi URL parametre normalizasyonu ve filtreleri koruyan sayfa bağlantılarını kapsar. 1005 ürünlü SQL testi 1000 sonrası arama, alt kategori, yetki sınırı, varyant hesabı, eşit isimlerde sayfa tekilliği ve uç sayfaları sınar.

Dağıtım sırası: admin_product_search_pagination migration önce uygulanmalı, ardından yeni uygulama sürümü yayınlanmalıdır. Bu migration ürün veya stok verilerini değiştirmez.

Bu grubun doğrulaması: 47 uygulama testi ve temiz Supabase kurulumu üzerindeki veritabanı regresyonları CI'da geçti. Migration Supabase'e 20261028090127 sürümüyle uygulandı; dosya adı canlı migration defteriyle eşleştirildi. Canlı katalogda authenticated yönetici rolü altında salt okunur sorgu, 4 ürün ve toplam 48 stok sonucunu doğruladı. Fonksiyon security invoker, anonim execute yetkisi kapalıdır. Ürün/stok verisi değiştirilmedi.

## Dördüncü grup: yorum araması ve sayfalama

- Yorum yönetimi ürün adı/yorum metni aramasını ve onay durumunu URL üzerinden sunucuya gönderir. İlk 1000 kayıt sınırı kaldırıldı; sayfa başına 25 yorum gelir. Yeni arama veya durum değişimi ilk sayfaya döner, önceki/sonraki bağlantılar arama ve durumu korur.
- Toplam/bekleyen/onaylı/reddedilen sayıları tüm veriden; ortalama yalnızca tüm onaylı yorumlardan hesaplanır. Kayıt yüklenemezse sıfır yerine yükleme hatası ve boş özet gösterilir.
- Moderasyon mevcut moderate_product_review RPC üzerinden sürer. Başarılı işlemden sonra sunucu yenilenir; filtre sonucu, sayımlar, ortalama ve son sayfa sınırı tekrar hesaplanır. Eşzamanlı tıklamalar ve yenileme sırasında tekrar işlem engellenir. Satın alma doğrulaması değiştirilmez.
- admin_search_reviews SECURITY INVOKER, boş search_path ve yönetici kontrolü kullanır. Anonim execute kapalıdır; yanıt müşteri kimliğini içermez. Arama Türkçe harfleri normalize eder ve jokerleri literal kabul eder; sıralama created_at/id ile kararlıdır.
- 49 uygulama testi ve üretim derlemesi geçti; mevcut 7 lint uyarısı kaldı. Yeni SQL testleri 1005 yorum, durum filtreleri, eski kayıt araması, 41 sayfada tekillik, yetkisiz erişim ve gerçek moderasyon sonrası sayımları kapsar. Yerel sahte verilerle masaüstü/mobil yerleşim ve filtre/sayfa bağlantıları incelendi; geçici önizleme route'u kaldırıldı.

Sıradaki kapsam: fatura listesinde sipariş/müşteri/tarih araması ve sayfalama; ardından iade listesi. Yorumlar için yeni migration uygulama dağıtımından önce uygulanmalıdır.

Yorum migration'ı Supabase'e 20261028091158 sürümüyle uygulandı; kaynak dosya adı canlı defterle eşleşir. Authenticated yönetici rolüyle canlı salt okunur sorgu 1 onaylı yorum ve ortalama 5 sonucunu verdi. Fonksiyon SECURITY INVOKER ve anonim execute kapalıdır. Canlı yorum durumları değiştirilmedi. Temiz kurulum SQL regresyonları ve 49 uygulama testi CI'da geçti; eski kayıt test fikstürü ayrıca 2000 tarihli bir yorumla güçlendirildi.

## Beşinci grup: fatura listesi araması ve sayfalama

- Son 200 sipariş sınırı kaldırıldı. Sipariş referansı, müşteri/telefon, alıcı/firma ve fatura numarası araması; fatura durumu ve sipariş tarihi aralığı sunucuya taşındı. Sayfa başına 25 kayıt, kararlı created_at/id sıralaması ve son sayfaya sıkıştırma kullanılır.
- Tarihler İstanbul yerel gün sınırlarıyla uygulanır; bitiş günü dahildir. Arayüzde alanlar açıkça sipariş tarihi olarak adlandırılır. Filtre değişimi ilk sayfaya döner, sayfa bağlantıları tüm filtreleri korur.
- Bekleyen/kaydedilen/eksik fatura özetleri tüm siparişlerden hesaplanır. Alıcı ve belge ayrıntıları yalnızca sayfadaki siparişler için JSON yanıtına eklenir.
- admin_search_invoices SECURITY INVOKER ve boş search_path kullanır; mevcut RLS ve ayrıca yönetici kontrolü vardır, anonim execute kapalıdır. Resmî belge kaydı mevcut onay ve admin_record_issued_invoice RPC üzerinden sürer; fatura düzenleme işlemi eklenmez.
- İşlem sırasında eşzamanlı gönderim ve form geçişi engellenir; başarılı kayıttan sonra sunucu listesi ve özetler yenilenir. Mevcut yeni/iptal sipariş ve mükerrer resmî belge kısıtları korunur.
- 52 uygulama testi, TypeScript ve üretim derlemesi geçti. SQL testleri 205 sipariş, 2000 tarihli eski kayıt, durumlar, alıcı/firma/fatura numarası, İstanbul gün sınırı, sayfa tekilliği ve resmî belge kaydı sonrası sayımları kapsar. Resmî belge yazan testler yalnızca izole CI veritabanında ve rollback içinde çalışır.
- Yerel sahte verilerle 1440 px masaüstü ve 390 px mobil görünüm, kayıt formu açma/kapama ve sayfa bağlantıları incelendi. Canlı fatura kaydı oluşturulmadı; geçici önizleme route'u kaldırıldı.

Sıradaki kapsam: iade/değişim listesinde sunucu araması, durum filtreleri ve sayfalama.

Fatura migration'ı Supabase'e 20261028092446 sürümüyle uygulandı; dosya adı canlı migration defteriyle eşleşir. Authenticated yönetici rolü altında salt okunur kontrolde 6 sipariş, 3 bekleyen ve 3 eksik/eski kayıt doğrulandı. SECURITY INVOKER ve anonim execute kapalı. CI'da 52 uygulama testi, üretim derlemesi, temiz veritabanı kurulumu, tüm SQL regresyonları ve eşzamanlı sipariş testleri geçti. Canlı resmî belge kayıtları oluşturulmadı/değiştirilmedi.

## Altıncı grup: iade/değişim araması ve sayfalama

- Son 200 talep sınırı kaldırıldı. Sipariş numarası, müşteri/telefon ve ürün/varyant üzerinden arama; talep durumu ve iade/değişim türü filtreleri sunucuya taşındı. Sayfa başına 25 talep ve kararlı created_at/id sıralaması kullanılır. Filtreler URL'de korunur; yeni filtre ilk sayfaya döner, fazla büyük sayfa gerçek son sayfaya sıkıştırılır.
- Özetler tüm taleplerden hesaplanır. Sipariş/ürün/fatura bilgileri ve işlem geçmişi yalnızca sayfadaki talepler için yüklenir. İşlem geçmişinin toplu 1000 kayıt kesintisi kaldırıldı; tarih ve kimliğe göre kararlı sıralanır.
- admin_search_returns SECURITY INVOKER, boş search_path ve yönetici kontrolüyle mevcut RLS altında çalışır; anonim execute kapalıdır. Mevcut admin_handle_return_request mutasyon RPC'si ve fiziksel kontrol/muhasebe/atomik stok kuralları değişmez. Başarılı işlemden sonra liste ve özet sunucudan yenilenir; tekrar gönderim ve işlem sırasında form geçişi engellenir.
- 54 uygulama testi, TypeScript ve üretim derlemesi geçti; mevcut 7 lint uyarısı. SQL regresyonları 205 talep, eski kayıt, durum/tür birleşimi, Türkçe arama, literal jokerler, 9 sayfada tekillik ve 1001 geçmiş kaydının tam yüklenmesini kapsar.
- İş akışı testleri izole test veritabanında rollback içinde çalışır: onay/teslim alma stok artırmaz; teslim almadan kapatma, hasarlı ürünü stoğa ekleme ve fatura kontrolünü atlama engellenir; satılabilir kapanış stok iadesini bir kez yapar.
- Yerel sahte verilerle 1440 px masaüstü ve 390 px mobil görünüm, kapanış formu, muhasebe alanı, koşullu stok seçimi ve işlem geçmişi incelendi. Canlı talep durumu veya stok değiştirilmedi; geçici önizleme route'u kaldırıldı.

Bu liste gruplarından sonra kalan öncelikler: müşteri detayında 100 sipariş sınırı ve kategori sayımlarında ilk 2000 ürüne dayanılması; ardından ortak hata eşleme ve eski/demo bileşenlerin temizliği.

İade migration'ı Supabase'e 20261028093522 sürümüyle uygulandı; dosya adı canlı migration defteriyle eşleşir. Authenticated yönetici rolüyle salt okunur kontrolde mevcut 1 kapalı talep ve doğru global sayımlar döndü. Fonksiyon SECURITY INVOKER, anonim execute kapalıdır. CI'da 54 uygulama testi, temiz Supabase kurulumu, tüm SQL regresyonları ve eşzamanlı sipariş kontrolleri geçti. Canlı iade durumları ve stok değiştirilmedi.
