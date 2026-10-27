'use client';

import type { CustomerAddress } from '@/lib/customer';
import type { InvoiceFormValue, InvoiceAddressMode, InvoiceBuyerType } from '@/lib/invoice-billing';
import css from './invoice-details.module.css';

type Props = {
  value: InvoiceFormValue;
  onChange: (next: InvoiceFormValue) => void;
  deliveryMethod: 'shipping' | 'pickup';
  addresses: CustomerAddress[];
  recipientName: string;
};

export function InvoiceDetails({
  value,
  onChange,
  deliveryMethod,
  addresses,
  recipientName,
}: Props) {
  const update = (change: Partial<InvoiceFormValue>) => onChange({ ...value, ...change });
  const canUseDelivery = deliveryMethod === 'shipping';
  const mode: InvoiceAddressMode =
    !canUseDelivery && value.addressMode === 'delivery'
      ? addresses.length
        ? 'saved'
        : 'manual'
      : value.addressMode;
  const selected = addresses.find((entry) => entry.id === value.savedAddressId);
  return (
    <section className={css.section} aria-label="Fatura bilgileri">
      <h3 className={css.heading}>Fatura bilgileri</h3>
      <p className={css.helper}>
        Faturanın kimin adına düzenleneceğini seç. Bu bilgiler siparişle birlikte saklanır; resmî
        fatura daha sonra düzenlenir.
      </p>
      <div className={css.choices} role="group" aria-label="Fatura alıcı tipi">
        {(
          [
            ['individual', 'Bireysel fatura'],
            ['corporate', 'Kurumsal fatura'],
          ] as const
        ).map(([type, label]) => (
          <label className={css.choice} data-selected={value.buyerType === type} key={type}>
            <input
              className={css.radio}
              type="radio"
              name="buyerType"
              value={type}
              checked={value.buyerType === type}
              onChange={() => update({ buyerType: type as InvoiceBuyerType })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {value.buyerType === 'corporate' ? (
        <div className={css.fields}>
          <label className={`${css.field} ${css.full}`}>
            Firma / şirket unvanı
            <input
              required
              minLength={3}
              maxLength={180}
              autoComplete="organization"
              value={value.companyName}
              onChange={(event) => update({ companyName: event.target.value })}
              placeholder="Vergi levhasındaki tam unvan"
            />
          </label>
          <label className={css.field}>
            Vergi dairesi
            <input
              required
              minLength={2}
              maxLength={100}
              value={value.taxOffice}
              onChange={(event) => update({ taxOffice: event.target.value })}
              placeholder="Vergi dairesi"
            />
          </label>
          <label className={css.field}>
            Vergi kimlik numarası (VKN)
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              minLength={10}
              value={value.taxNumber}
              onChange={(event) => update({ taxNumber: event.target.value.replace(/\D/g, '') })}
              placeholder="10 haneli VKN"
            />
          </label>
        </div>
      ) : (
        <p className={css.summary}>
          Fatura alıcısı:{' '}
          <strong>{value.recipientName.trim() || recipientName || 'Siparişteki ad soyad'}</strong>.
          Başka adla fatura istemek için aşağıdaki alanı kullanabilirsin.
        </p>
      )}
      {value.buyerType === 'individual' ? (
        <details className={css.editName}>
          <summary>Fatura adı soyadını değiştir (isteğe bağlı)</summary>
          <label className={css.field}>
            Faturada yer alacak ad soyad
            <input
              maxLength={120}
              minLength={3}
              value={value.recipientName}
              onChange={(event) => update({ recipientName: event.target.value })}
              placeholder={recipientName || 'Ad Soyad'}
            />
          </label>
        </details>
      ) : (
        <div className={css.fields}>
          <label className={`${css.field} ${css.full}`}>
            İlgili kişi adı soyadı
            <input
              maxLength={120}
              minLength={3}
              value={value.recipientName}
              onChange={(event) => update({ recipientName: event.target.value })}
              placeholder={recipientName || 'Ad Soyad'}
            />
          </label>
        </div>
      )}
      <div className={css.addressChoice}>
        <strong className={css.addressChoiceTitle}>Fatura adresi</strong>
        {canUseDelivery && (
          <label className={css.radioText}>
            <input
              className={css.radio}
              type="radio"
              name="billingAddressMode"
              checked={mode === 'delivery'}
              onChange={() => update({ addressMode: 'delivery' })}
            />
            Teslimat adresiyle aynı
          </label>
        )}
        {addresses.length > 0 && (
          <label className={css.radioText}>
            <input
              className={css.radio}
              type="radio"
              name="billingAddressMode"
              checked={mode === 'saved'}
              onChange={() => update({ addressMode: 'saved' })}
            />
            Kayıtlı adreslerimden seç
          </label>
        )}
        <label className={css.radioText}>
          <input
            className={css.radio}
            type="radio"
            name="billingAddressMode"
            checked={mode === 'manual'}
            onChange={() => update({ addressMode: 'manual' })}
          />
          Farklı fatura adresi gir
        </label>
      </div>
      {mode === 'saved' && addresses.length > 0 && (
        <div className={css.fields}>
          <label className={`${css.field} ${css.full}`}>
            Kayıtlı fatura adresi
            <select
              required
              value={value.savedAddressId}
              onChange={(event) => update({ savedAddressId: event.target.value })}
            >
              {addresses.map((entry) => (
                <option value={entry.id} key={entry.id}>
                  {entry.label} — {entry.district} / {entry.city}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <p className={`${css.summary} ${css.full}`}>
              {selected.address}, {selected.district} / {selected.city}
            </p>
          )}
        </div>
      )}
      {mode === 'manual' && (
        <div className={css.fields}>
          <label className={css.field}>
            İl
            <input
              required
              minLength={2}
              maxLength={80}
              value={value.city}
              onChange={(event) => update({ city: event.target.value })}
            />
          </label>
          <label className={css.field}>
            İlçe
            <input
              required
              minLength={2}
              maxLength={80}
              value={value.district}
              onChange={(event) => update({ district: event.target.value })}
            />
          </label>
          <label className={`${css.field} ${css.full}`}>
            Açık fatura adresi
            <textarea
              required
              minLength={10}
              maxLength={500}
              value={value.address}
              onChange={(event) => update({ address: event.target.value })}
              placeholder="Mahalle, sokak, bina ve daire numarası"
            />
          </label>
        </div>
      )}
      <p className={css.note}>
        Bireysel satışlarda T.C. kimlik numarası bu formda zorunlu tutulmaz. Resmî fatura için ek
        bilgi gerekirse mağaza seninle iletişime geçer. Fatura PDF&apos;si bu ekranda oluşturulmaz.
      </p>
    </section>
  );
}
