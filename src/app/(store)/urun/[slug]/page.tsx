import { redirect } from 'next/navigation';

// Legacy sample-product URLs must not expose fictitious prices/products anymore.
export default function LegacyDemoProductPage() {
  redirect('/urunler');
}
