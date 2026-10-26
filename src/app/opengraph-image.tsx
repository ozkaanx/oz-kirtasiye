import { ImageResponse } from 'next/og';
import { STORE_NAME } from '@/lib/seo';

export const alt = `${STORE_NAME} - Kırtasiye, oyuncak ve okul ihtiyaçları`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: 92, background: '#fff8f3', color: '#1b2028',
    }}>
      <div style={{ display: 'flex', fontSize: 24, letterSpacing: 3, color: '#e65a33', fontWeight: 700 }}>
        İSTANBUL · BAĞCILAR · GÜNEŞLİ
      </div>
      <div style={{ display: 'flex', fontSize: 100, fontWeight: 900, letterSpacing: -4, marginTop: 34 }}>
        öz kırtasiye<span style={{ color: '#ff643c' }}>.</span>
      </div>
      <div style={{ display: 'flex', fontSize: 34, color: '#555f68', marginTop: 22 }}>
        Renkli fikirler, mutlu başlangıçlar.
      </div>
      <div style={{ display: 'flex', marginTop: 55, width: 220, height: 13, borderRadius: 10, background: '#ff643c' }} />
    </div>,
    size,
  );
}
