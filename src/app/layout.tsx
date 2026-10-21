import type { Metadata } from "next";
import { ShopProvider } from "@/context/shop-context";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Öz Kırtasiye | Renkli fikirler, mutlu başlangıçlar", template: "%s | Öz Kırtasiye" },
  description: "Öz Kırtasiye: kırtasiye, okul ihtiyaçları, oyuncak ve yaratıcı hobi ürünleri. Bağcılar Güneşli'de.",
  robots: { index: false, follow: false },
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="tr"><body><ShopProvider>{children}</ShopProvider></body></html>;
}
