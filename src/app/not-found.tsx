import Link from "next/link";
export default function NotFound(){return <div className="container-wide empty-page"><h1>Bu sayfayı bulamadık.</h1><p>Aradığın sayfa taşınmış olabilir. Keşfe devam edelim!</p><Link href="/" className="button button-primary">Ana sayfaya dön</Link></div>}
