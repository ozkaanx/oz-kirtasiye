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
