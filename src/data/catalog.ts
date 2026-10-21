import type { Category, Product } from "@/types/shop";

// DEMO VERİ: Fiyatlar, stoklar ve ürünler mağazanın gerçek envanteri değildir.
// Gerçek veritabanı kurulduğunda burası servis katmanıyla değiştirilecek.
export const categories: Category[] = [
  { id: "defter", label: "Defter & Ajanda", caption: "Yazmaya değer", picture: "/illustrations/notebook.svg", color: "#F8E4FF" },
  { id: "kalem", label: "Kalemler", caption: "Rengini seç", picture: "/illustrations/pencils.svg", color: "#E2EFFF" },
  { id: "boya", label: "Boya & Sanat", caption: "Hayal gücü burada", picture: "/illustrations/paints.svg", color: "#FFF0D7" },
  { id: "oyuncak", label: "Oyuncaklar", caption: "Oyun başlasın", picture: "/illustrations/blocks.svg", color: "#FFE5E8" },
  { id: "canta", label: "Okul Çantaları", caption: "Yeni maceralar", picture: "/illustrations/bag.svg", color: "#E2F6ED" },
  { id: "ofis", label: "Ofis Ürünleri", caption: "Düzenin keyfi", picture: "/illustrations/sticky.svg", color: "#EEE9FF" },
];

export const products: Product[] = [
  { id: "p1", slug: "renkli-spiralli-defter", name: "Renkli Spiralli Defter", category: "defter", description: "Notlarına renk katacak, eğlenceli kapaklı spiralli defter.", price: 89.9, oldPrice: 119.9, badge: "Çok sevilen", image: "/illustrations/notebook.svg", tint: "#F8E7F7", featured: true },
  { id: "p2", slug: "pastel-kursun-kalem-seti", name: "Pastel Kurşun Kalem Seti", category: "kalem", description: "Yumuşak renklerde günlük kullanıma uygun kalem seti.", price: 74.9, badge: "Yeni", image: "/illustrations/pencils.svg", tint: "#E7F3FF", featured: true },
  { id: "p3", slug: "suluboya-eglence-seti", name: "Suluboya Eğlence Seti", category: "boya", description: "Resim saatlerini renklendiren örnek suluboya seti.", price: 159.9, oldPrice: 199.9, badge: "Fırsat", image: "/illustrations/paints.svg", tint: "#FFF1DE", featured: true },
  { id: "p4", slug: "ahsap-renkli-bloklar", name: "Ahşap Renkli Bloklar", category: "oyuncak", description: "Şekillerle oynamayı seven minikler için renkli bloklar.", price: 249.9, image: "/illustrations/blocks.svg", tint: "#FFE9EC", featured: true },
  { id: "p5", slug: "mini-okul-cantasi", name: "Mini Okul Çantası", category: "canta", description: "Günlük okul ihtiyaçları için örnek hafif çanta modeli.", price: 449.9, badge: "Yeni", image: "/illustrations/bag.svg", tint: "#E7F7ED", featured: true },
  { id: "p6", slug: "yapiskan-not-seti", name: "Renkli Yapışkan Not Seti", category: "ofis", description: "Hatırlatıcılarını eğlenceli hale getiren renkli not kağıtları.", price: 64.9, image: "/illustrations/sticky.svg", tint: "#F0EAFF", featured: true },
  { id: "p7", slug: "fosforlu-kalem-paketi", name: "Fosforlu Kalem Paketi", category: "kalem", description: "Önemli satırların altını çizmenin renkli hali.", price: 129.9, oldPrice: 159.9, image: "/illustrations/highlighters.svg", tint: "#E7F8EF", featured: true },
  { id: "p8", slug: "eglenceli-bulmaca-kutusu", name: "Eğlenceli Bulmaca Kutusu", category: "oyuncak", description: "Meraklı çocuklar için eğlenceli örnek kutu oyunu.", price: 189.9, badge: "Çok sevilen", image: "/illustrations/puzzle.svg", tint: "#FFF1D9", featured: true },
  { id: "p9", slug: "noktalı-planlayici", name: "Noktalı Planlayıcı Defter", category: "defter", description: "Planları ve fikirleri bir arada tutabileceğin defter.", price: 139.9, image: "/illustrations/planner.svg", tint: "#E8EEFF" },
  { id: "p10", slug: "pastel-yapistirici", name: "Renkli Stick Yapıştırıcı", category: "ofis", description: "El işi projelerine eşlik eden örnek stick yapıştırıcı.", price: 39.9, image: "/illustrations/glue.svg", tint: "#FFE7E3" },
];

export const getProductBySlug = (slug: string) => products.find((product) => product.slug === slug);
export const getProductById = (id: string) => products.find((product) => product.id === id);
