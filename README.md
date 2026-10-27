# Öz Kırtasiye

Next.js 16, React 19 ve Supabase ile ürün/varyant, stok, müşteri hesabı, kupon/kampanya, sipariş talebi, kargo, fatura kaydı, iade ve yorum yönetimi.

## Satış akışı

Sepet gerçek ürünlere bağlıdır. Checkout çevrimiçi ödeme almaz: müşteri sipariş talebi oluşturur, mağaza iletişime geçer. Talep oluşturulurken stok ayrılmaz. Yönetici hazırlığa aldığında stok düşer; hazırlık aşamasında iptal edildiğinde bir kez geri eklenir. Kargoya verilmiş ürünler ayrı iade sürecinden geçer. Fatura ekranı resmî belge düzenlemez, düzenlenmiş belgenin kaydını tutar.

PayTR henüz entegre değildir. Ödeme, rezervasyon ve callback işlemleri ayrıca geliştirilecektir.

## Sipariş tekrar güvenliği ve istek sınırları

- Checkout her talep için rastgele `Idempotency-Key` üretir. Aynı içerikle yeniden deneme ve sekme yenilemede anahtar korunur. Tarayıcıdaki sessionStorage yalnızca içerik özeti ve anahtar tutar; adres/fatura bilgisi saklamaz. Başarıdan sonra temizlenir. Form içeriği değişirse yeni anahtar üretilir.
- PostgreSQL aynı anahtardaki eşzamanlı istekleri kilitler. Sipariş ve orijinal cevap aynı transaction içinde kaydedilir. Aynı anahtar/içerik/müşteri tekrarında orijinal cevap döner: ilk cevap 201, tekrar cevabı 200 ve `Idempotency-Replayed: true`. Kupon, fatura ve stok işlemleri tekrarlanmaz. Sonraki katalog değişiklikleri önceki başarılı cevabı değiştirmez.
- Aynı anahtar farklı içerik veya müşteriyle kullanılırsa 409 döner. Başarısız transaction anahtarı tüketmez. Anahtar kaydı siparişle tutulur; otomatik süre sonuyla tekrar sipariş oluşmasına izin verilmez.
- Dağıtık PostgreSQL sayaçları dakikada hesap/imzalı tarayıcı oturumu başına 20, güvenilir IP başına 40 ve mağaza genelinde 200 girişime izin verir. Pencere ilk girişimden itibaren bir dakikadır. Sınırda 429 ve `Retry-After` gelir. Limiter erişilemezse sipariş oluşturulmaz (503). Eski telefon başına saatte üç talep kuralı da korunur.
- Misafirler için HttpOnly/SameSite=Strict imzalı çerez kullanılır. Çerezi silmek oturum sınırını sıfırlayabilir; güvenilir IP ve genel sınır ayrıca uygulanır. Sayaçlar sunucu belleğinde değildir ve başarısız siparişte geri alınmaz. Ham IP yerine sunucu HMAC özeti tutulur; bir saatten eski sayaçlar sınırlı partilerle temizlenir.
- Vercel'de platformun yazdığı `x-vercel-forwarded-for` kullanılır. Diğer barındırmalarda IP kontrolü varsayılan kapalıdır; yalnızca her istekte güvenilir proxy tarafından üzerine yazılan tek IP başlığı `ORDER_REQUEST_TRUSTED_IP_HEADER` ile seçilebilir. Proxy atlanarak uygulamaya doğrudan erişim engellenmelidir. Başlık yapılandırılmış ama geçersiz/eksikse 503 döner. Rastgele istemci `X-Forwarded-For` başlıkları kullanılmaz. [Vercel başlıkları](https://vercel.com/docs/headers/request-headers)
- Bu uygulama katmanı koruması, ağ düzeyindeki DDoS/bot korumasının yerini almaz. Akış hâlâ manuel sipariş talebidir; stok rezervasyonu/online ödeme içermez.

Yayın sırası: önce bekleyen migration'ları (Aşama 1 güvenlik migration'ı dahil), sonra uygulama kodunu yayınlayın. Yeni RPC'ler hazır değilse API talep oluşturmadan 503 döner. Eski açık sekmelerde işlem anahtarı olmadığı için kullanıcıdan sayfayı yenilemesi istenir.

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

Veritabanı testleri yalnızca izole yerel test ortamında çalıştırılabilir. Testler rol/kimlik taklidi, ürün/sipariş fixture'ları ve transaction rollback kullanır. Ayrıca iki gerçek veritabanı oturumuyla eşzamanlı sipariş ve limit testleri çalışır; bu testin commit edilen fixture'ları sonunda silinir. Runner uzak bağlantıları reddeder. Üretim bağlantısını TEST_DATABASE_URL olarak kullanmayın.

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

## Ortak sepet fiyatlandırması

20261027112249_shared_checkout_pricing_core.sql migration'ı aktif fiyat önizleme ve sipariş akışını aynı private katalog, indirim ve kargo yardımcılarında birleştirir. Sipariş satırları kilitlenmiş katalog görüntüsünden kaydedilir; kupon ve otomatik kampanya birlikte uygulanmaz. Eşit indirimde otomatik kampanya tercih edilir. Ücretsiz kargo eşiği indirim sonrası ürün toplamına göre hesaplanır. Stok rezervasyonu davranışı değişmez.

Sepet ve ödeme sayfası useCartPricing üzerinden aynı gösterim modelini kullanır. Checkout teslimat alanları, özet ve gönderim durumu; yönetici sipariş kartı ve aksiyon formu ayrı bileşenlerdir. Eski quote_order_coupon uyumluluk için korunur; aktif akış quote_order_savings kullanır. pricing_parity.sql önizleme ile kaydedilen sipariş tutarlarının eşitliğini varyant, kupon, kampanya ve kargo senaryolarında doğrular.
