# Öz Kırtasiye

Next.js 16, React 19 ve Supabase ile ürün/varyant, stok, müşteri hesabı, kupon/kampanya, sipariş talebi, kargo, fatura kaydı, iade ve yorum yönetimi.

## Satış akışı

Sepet gerçek ürünlere bağlıdır. Checkout çevrimiçi ödeme almaz: müşteri sipariş talebi oluşturur, mağaza iletişime geçer. Talep oluşturulurken stok ayrılmaz. Yönetici hazırlığa aldığında stok düşer; hazırlık aşamasında iptal edildiğinde bir kez geri eklenir. Kargoya verilmiş ürünler ayrı iade sürecinden geçer. Fatura ekranı resmî belge düzenlemez, düzenlenmiş belgenin kaydını tutar.

PayTR henüz entegre değildir. Ödeme, rezervasyon ve callback işlemleri ayrıca geliştirilecektir.

## Uygulamayı çalıştırma

Node.js 22 ve npm kullanın:

```sh
npm ci
# .env.example dosyasını .env.local olarak kopyalayın ve değerleri doldurun.
npm run dev
```

- NEXT_PUBLIC_SUPABASE_URL: Supabase API adresi.
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: tarayıcıda kullanılabilen publishable anahtar.
- SUPABASE_SECRET_KEY: yalnızca sunucuda saklanan secret/service_role anahtarı.
- ORDER_REQUESTS_ENABLED: talep gönderimini açmak için true; varsayılan false.

Gizli anahtarlara NEXT_PUBLIC_ öneki eklemeyin. .env.local sürüm kontrolüne girmez.

## Yerel veritabanı ve kontroller

Docker, Supabase CLI 2.81.2 ve PostgreSQL istemcisi (psql) gerekir. Yerel başlangıç bir Supabase projesine bağlanmaz.

```sh
supabase start
supabase db reset --local
# TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
npm run test:db
npm run typecheck
npm run lint
npm run build
```

PowerShell ortam değişkeni örneği: $env:TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'. Uygulamayı yerel Supabase'e bağlamak için supabase status çıktısındaki API adresini ve public anahtarı .env.local dosyasına yazın. Build sırasında da public bağlantı değişkenleri gerekir; CI sahte yerel değerler kullanır ve canlı verilere bağlanmaz.

Veritabanı testleri yalnızca izole test ortamında çalıştırılmalıdır. Testler rol/kimlik taklidi, ürün/sipariş fixture'ları ve transaction rollback kullanır. Üretim bağlantısını TEST_DATABASE_URL olarak kullanmayın.

## Migration geçmişi

supabase/migrations klasörü canlı ortamın uygulanmış geçmişiyle eşleştirilmiştir. Eksik ilk üç migration ve iki katalog migration'ı canlı migration ledger'ından kurtarıldı. Dört dosyanın tarihleri canlı sürüm numaralarına düzeltildi. Önceden elle yeniden yazılmış tarihsel dosyalar, metin tabanlı fonksiyon güncellemelerinin temiz kurulumda çalışabilmesi için uygulanmış SQL ile eşleştirildi.

Tek uyumluluk istisnası: 20261021192947, yalnızca hosted ortamda bulunabilen rls_auto_enable() yardımcısı varsa yetkisini kaldırır. Yeni davranış değişiklikleri yeni migration'a eklenir; uygulanmış migration'ları elle tekrar çalıştırmayın.

Canlıya geçişten önce migration list çıktısını karşılaştırın. Bu çalışma uzaktaki migration history tablosunu değiştirmez. Yeni güvenlik migration'ı mevcut uygulamayla uyumludur; frontend deploy beklemez. Uygulama sürümünün deploy edilmesi tek başına veritabanı migration'ını uygulamaz.

## Yönetici hesabı

Supabase Auth üzerinde doğrulanmış kullanıcı oluşturun. Güvenilir SQL yönetim oturumundan yalnızca yöneticiniz için:

```sql
insert into public.store_admins(user_id,role)
select id,'owner' from auth.users where email='YONETICI_EPOSTASI'
on conflict(user_id) do update set role=excluded.role;
```

Yönetim: /admin/giris. Normal kullanıcı kaydı yönetici yetkisi vermez.

## Güvenlik sınırları

- Müşteri kimliği tarayıcı payload'ından alınmaz; Next.js API oturumu auth.getUser() ile doğrular.
- Kimlik alan RPC'ler yalnızca service_role tarafından çağrılır; private şeması API'ye açılmaz.
- Fiyat, varyant stoğu, kupon hakkı ve kargo tutarı PostgreSQL'de yeniden hesaplanır.
- Yorum yazma ve moderasyon yalnızca yetki kontrolü yapan RPC'lerden geçer; doğrudan tablo yazımı kapalıdır.
- Misafir katalog/yorum okuma politikaları yönetici tablosuna erişim istemez.
- product-images herkese açık görseller içindir; gizli dosya yüklemeyin.

GitHub Actions temiz Supabase kurulumunu, SQL regresyonlarını, TypeScript, lint ve build kontrollerini çalıştırır.
