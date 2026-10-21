# Öz Kırtasiye — E-Ticaret Sitesi (İlk Geliştirme Paketi)

Bu proje, **Öz Kırtasiye için onaylanan sade, beyaz–siyah–turuncu tasarım dilinin** Next.js App Router ve React ile hazırlanan ilk sürümüdür.

> **DURUM: DEMO / GELİŞTİRME.** Bu sürüm gerçek müşteri kabul etmek veya ödeme almak için uygun değildir. Ürün adları, fiyatlar, görseller ve stoklar örnektir. Online sipariş, ödeme, veritabanı ve kullanıcı doğrulaması henüz bağlı değildir.

## Gereksinimler

- Node.js **20.9+** (Node.js 22 önerilir)
- npm

## Kurulum (Windows PowerShell veya Terminal)

```bash
cd oz-kirtasiye
npm install
npm run dev
```

Tarayıcı: http://localhost:3000

İsteğe bağlı:

```bash
npm run typecheck
npm run lint
npm run build
```

## Hazır ekranlar

| Adres | Amaç | Durum |
| --- | --- | --- |
| `/` | Ana sayfa, banner, kategori kartları, ürün vitrinleri | Arayüz ve örnek veriler |
| `/urunler` | Ürün listeleme, kategori/fiyat filtreleri, sıralama, arama | Tarayıcıda çalışır |
| `/urun/pastel-kursun-kalem-seti` | Örnek ürün detay sayfası | Tarayıcıda çalışır |
| `/sepet` | Sepet, adet artırma/azaltma, silme | localStorage ile demo |
| `/favoriler` | Favorilerim | localStorage ile demo |
| `/hesabim` | Hesap ekranı | Bilgilendirme / tasarım |
| `/hakkimizda` | Hakkımızda | Bilgilendirme |
| `/iletisim` | İletişim | Bilgilendirme |
| `/admin/stok` | **Barkodsuz manuel stok yönetimi** | **Yalnızca localStorage demosu** |

### Manuel stok yönetimi

`/admin/stok` adresinde bir ürünü seçip stok artırabilir/azaltabilir ve işlem açıklaması girebilirsiniz. Değişiklikler yalnızca kullanılan tarayıcıda saklanır. **Bu, gerçek mağaza stoğunu değiştirmez, internet mağazasına bağlanmaz, cihazlar arasında ortak çalışmaz.** Canlı yayına çıkmadan önce giriş yetkilendirmesi, PostgreSQL veritabanı, sunucu işlemleri, stok rezervasyonu ve hareket kayıtları kurulmalıdır.

**Barkod ve POS/kasa sistemi kapsam dışıdır.** Fiziksel mağaza satışı sonrası stok miktarı yönetim panelinden manuel değiştirilecek; gerçek online siparişlerin stok azaltması ise backend tamamlandığında otomatik ve güvenli biçimde yapılacaktır.

## Kod yapısı

```text
src/
  app/
    (store)/              # Müşteriye açık e-ticaret sayfaları
      page.tsx            # Ana sayfa
      urunler/            # Listeleme ve arama
      urun/[slug]/        # Ürün detay
      sepet/              # Sepet
      favoriler/          # Favoriler
      hesabim/            # Hesap ön izlemesi
      hakkimizda/
      iletisim/
    admin/stok/           # Manuel stok yönetimi arayüz demosu
    globals.css          # Öz Kırtasiye tasarım sistemi
    layout.tsx           # Uygulama kök layout'u
  components/
    admin/               # Manuel stok etkileşimleri
    cart/                # Sepet sayfası ve çekmecesi
    catalog/             # Ürün listeleme
    home/                # Ana sayfa bileşenleri
    layout/              # Header, footer, marka
    product/             # Ürün kartı ve detay
  context/shop-context.tsx  # Yerel demo sepet/favori durumu
  data/catalog.ts        # DEMO ürün/kategori kataloğu
  lib/format.ts
  types/shop.ts
public/illustrations/      # Yerel SVG örnek ürün görselleri
```

## Değiştirmek için

- Renkler ve responsive stiller: `src/app/globals.css`
- Demo ürünler, örnek fiyatlar: `src/data/catalog.ts`
- Ana sayfa: `src/components/home/home-storefront.tsx`
- Menü ve arama: `src/components/layout/header.tsx`
- Demo stok paneli: `src/components/admin/inventory-demo.tsx`

## Bir sonraki geliştirme sırası

1. Veritabanı modeli (ürün, kategori, varyant, stok hareketleri, sipariş, müşteri).
2. Sunucu tarafı admin oturumu ve yetkilendirme.
3. Gerçek ürün/medya yükleme ve manuel stok API'si.
4. Sipariş ve stok rezervasyonu (eşzamanlı satış güvenliği).
5. iyzico / PayTR ile güvenli ödeme; yasal sayfalar ve operasyonel süreçler.
6. Testler, gerçek cihazlarla kontrol, yayın ortamı ve SEO ayarları.

### Tasarım varlıkları hakkında

Bu başlangıç paketindeki ürün görselleri özel hazırlanmış **temsili SVG çizimleridir**; gerçek ürün fotoğrafları yüklenince değiştirilecektir.

### Test notu

Dosyaların TS/TSX sözdizimi ve yerel modül bağlantıları kontrol edildi. Bu oluşturma ortamında npm paket kayıt sistemine ağ erişimi olmadığı için bağımlılıkların kurulumu ve `next build` komutu çalıştırılamadı. Projeyi kendi makinenizde `npm install` ardından `npm run build` ile doğrulamanız gerekir.
