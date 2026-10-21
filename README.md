# Öz Kırtasiye — Next.js + Supabase

Öz Kırtasiye için hazırlanan sade, beyaz–siyah–turuncu tasarım korunarak gerçek ürün ve barkodsuz manuel stok yönetimi Supabase'e bağlandı.

> **GELİŞTİRME SÜRÜMÜ:** Sipariş, online ödeme ve sepetin gerçek satış bağlantısı henüz yoktur. Önceki örnek katalog, sepet ve favoriler demo olarak durur. Gerçek ürünler ayrı vitrinde **inceleme amaçlı** gösterilir; satın alma aktif değildir.

## Yerel kurulum (Node.js 22 önerilir)

1. Dosyaları mevcut GitHub repo klasörünüzle birleştirin.
2. `.env.example` dosyasını `.env.local` olarak kopyalayın.
3. Supabase panelinde **Project Settings → API Keys** bölümünden `sb_publishable_...` anahtarını `.env.local` içerisine girin. `.env.local` dosyasını GitHub'a göndermeyin.
4. Terminalde:

```bash
npm install
npm run dev
```

Tarayıcı: `http://localhost:3000`.

### Yönetici hesabı oluşturma (bir kez)

Yönetici girişine herkesi otomatik kabul etmiyoruz. Önce Supabase Dashboard → **Authentication → Users → Add user** bölümünden kullanacağınız e-posta ve şifre ile bir kullanıcı oluşturun. E-postanın doğrulanmış olduğundan emin olun.

Sonra Dashboard → **SQL Editor** içinde **yalnızca kendi e-postanızı** yazarak şu sorguyu çalıştırın:

```sql
insert into public.store_admins (user_id, role)
select id, 'owner' from auth.users where email = 'KENDI_EPOSTANIZI_YAZIN'
on conflict (user_id) do update set role = excluded.role;
```

`INSERT 0 0` görürseniz e-posta adresine ait Auth kullanıcısı bulunamadı demektir. Yeni kullanıcı kayıt olunca yetki otomatik verilmez; her yeni yöneticiyi yetkili olarak ayrıca atamalısınız.

Yönetici girişi: `http://localhost:3000/admin/giris`  
Ürün ve stok ekranı: `http://localhost:3000/admin/urunler`

### İlk gerçek ürün

1. Yönetici olarak giriş yapın.
2. Önce **Kategori ekle** alanından bir kategori oluşturun.
3. **Yeni ürün ekle** ile ad, fiyat, açıklama, fotoğraf ve stok sayısı girin.
4. **Sitede yayınla** seçeneğini işaretleyin ve kaydedin.
5. Ana sayfayı yenileyin. **Mağazamızdaki ürünler** bölümünde Supabase'den gelen gerçek ürün görünür.
6. Ürünün **Stok** düğmesine basarak ekleme veya azaltma yapın; işlem **Stok hareketleri** bölümüne kaydedilir.

## Veri güvenliği

- `store_admins`, `categories`, `products`, `product_images` ve `stock_movements` tablolarında RLS açık.
- Yalnızca yönetici kullanıcıların ürün ve stok kayıtlarını değiştirme yetkisi var.
- Stok güncelleme `adjust_product_stock` isimli sunucu tarafı PostgreSQL fonksiyonuyla tek atomik işlem olarak çalışır ve hareket kaydı oluşturur.
- Fotoğraflar `product-images` public Storage bucket'ına yalnızca yöneticiler tarafından yüklenebilir. Görseller herkese açık URL ile yayımlanır; gizli dosyaları buraya yüklemeyin.
- `service_role`, `sb_secret_...` veya veritabanı şifresini projeye **eklemeyin**. Public/repo içinde yalnızca `.env.example` şablonu bulunur.
- Yönetim ekranlarının sunucu tarafı erişim kontrolü vardır. RLS, yalnızca arayüze güvenmeden veritabanı düzeyinde de erişimi kısıtlar.

## Supabase projesi

- Proje: `oz-kirtasiye`
- Ref: `dvkndlaamlwxikhszpqd`
- Bölge: `eu-central-1`
- Migration geçmişi Supabase projesinde oluşturuldu:
  - `20261021192915_initial_catalog_manual_inventory`
  - `20261021192947_restrict_automatic_rls_helper_execution`
  - `20261021193540_atomic_stock_adjustments_and_product_storage`

Sonraki aşamada Supabase CLI üzerinden migration dosyalarını repoya çekip sürüm kontrolüne dahil etmek uygun olacak. Bu pakette migration SQL dosyaları yeniden uygulanmak üzere yer almıyor; aynı şemayı tekrar oluşturmaya çalışmayın.

## Ekranlar

| Adres                                       | Durum                                                         |
| ------------------------------------------- | ------------------------------------------------------------- |
| `/`                                         | Onaylı ana sayfa + gerçek ürün vitrini (varsa) + demo katalog |
| `/urunler`                                  | Gerçek ürünler ve mevcut demo katalog                         |
| `/magaza/urun/[slug]`                       | Gerçek ürün detay sayfası, satın alma kapalı                  |
| `/admin/giris`                              | Supabase Auth girişi                                          |
| `/admin/urunler`                            | Yetkili ürün/kategori/fotoğraf/stok yönetimi                  |
| `/admin/stok`                               | Yeni yönetim paneline yönlendirir                             |
| `/sepet`, `/favoriler`, eski `/urun/[slug]` | Demo; gerçek sipariş oluşturmaz                               |

## Kod kontrolü

```bash
npm run typecheck
npm run lint
npm run build
```

Bu paketin oluşturulduğu ortamda npm kayıt sistemine erişilemediği için `npm install` ve tam Next.js derlemesi çalıştırılamadı. TypeScript/TSX dosyalarının söz dizimi kontrol edildi. Yukarıdaki komutlarla bilgisayarınızda doğrulayın.

## GitHub

Dosyaları mevcut `ozkaanx/oz-kirtasiye` klasörünüzle birleştirdikten sonra:

```bash
git checkout -b feature/supabase-products
git add .
git commit -m "feat: integrate Supabase product and inventory management"
git push -u origin feature/supabase-products
```

Projeyi GitHub'a yazma yetkisi olmadığı için bu paketteki değişiklikler **otomatik push edilmedi**.
