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
