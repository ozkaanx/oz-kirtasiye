export default function ProductLoading() {
  return (
    <section
      className="container-wide"
      aria-busy="true"
      aria-label="Ürün yükleniyor"
      style={{ padding: '32px 0', minHeight: '60vh' }}
    >
      <p role="status">Ürün bilgileri yükleniyor…</p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
          gap: 32,
        }}
        aria-hidden="true"
      >
        <div style={{ background: '#f4f4f4', aspectRatio: '1', borderRadius: 8 }} />
        <div>
          <div style={{ background: '#f4f4f4', height: 32, marginBottom: 24 }} />
          <div style={{ background: '#f4f4f4', height: 160 }} />
        </div>
      </div>
    </section>
  );
}
