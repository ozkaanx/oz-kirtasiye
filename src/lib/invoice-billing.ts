import type { CustomerAddress } from '@/lib/customer';

export type InvoiceBuyerType = 'individual' | 'corporate';
export type InvoiceAddressMode = 'delivery' | 'saved' | 'manual';

export type InvoiceFormValue = {
  buyerType: InvoiceBuyerType;
  recipientName: string;
  companyName: string;
  taxOffice: string;
  taxNumber: string;
  addressMode: InvoiceAddressMode;
  savedAddressId: string;
  city: string;
  district: string;
  address: string;
};

export type InvoiceBillingPayload = {
  buyerType: InvoiceBuyerType;
  recipientName: string;
  companyName: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  city: string;
  district: string;
  address: string;
};

type DeliveryAddress = {
  customerName: string;
  city: string;
  district: string;
  address: string;
};

export function createInvoiceForm(addresses: CustomerAddress[]): InvoiceFormValue {
  return {
    buyerType: 'individual',
    recipientName: '',
    companyName: '',
    taxOffice: '',
    taxNumber: '',
    addressMode: 'delivery',
    savedAddressId: addresses.find((entry) => entry.is_default)?.id ?? addresses[0]?.id ?? '',
    city: 'İstanbul',
    district: '',
    address: '',
  };
}

export function getInvoiceBilling(
  value: InvoiceFormValue,
  method: 'shipping' | 'pickup',
  delivery: DeliveryAddress,
  addresses: CustomerAddress[],
): InvoiceBillingPayload {
  let resolvedAddress: { city: string; district: string; address: string };
  if (value.addressMode === 'delivery' && method === 'shipping') {
    resolvedAddress = delivery;
  } else if (value.addressMode === 'saved' && addresses.length > 0) {
    const selected = addresses.find((entry) => entry.id === value.savedAddressId);
    if (!selected) throw new Error('Geçerli bir fatura adresi seçmelisin.');
    resolvedAddress = selected;
  } else if (value.addressMode === 'manual') {
    resolvedAddress = value;
  } else {
    throw new Error('Fatura adresi seçilmedi.');
  }

  const recipientName = value.recipientName.trim() || delivery.customerName.trim();
  if (recipientName.length < 3 || recipientName.length > 120) {
    throw new Error('Fatura alıcısının adını ve soyadını kontrol et.');
  }
  const city = resolvedAddress.city.trim();
  const district = resolvedAddress.district.trim();
  const address = resolvedAddress.address.trim();
  if (
    city.length < 2 ||
    city.length > 80 ||
    district.length < 2 ||
    district.length > 80 ||
    address.length < 10 ||
    address.length > 500
  ) {
    throw new Error('Fatura adresini (il, ilçe ve açık adres) eksiksiz doldur.');
  }
  if (value.buyerType === 'corporate') {
    const companyName = value.companyName.trim();
    const taxOffice = value.taxOffice.trim();
    const taxNumber = value.taxNumber.trim();
    if (
      companyName.length < 3 ||
      companyName.length > 180 ||
      taxOffice.length < 2 ||
      taxOffice.length > 100 ||
      !/^\d{10}$/.test(taxNumber)
    ) {
      throw new Error('Kurumsal fatura için firma unvanı, vergi dairesi ve 10 haneli VKN gerekli.');
    }
    return {
      buyerType: 'corporate',
      recipientName,
      companyName,
      taxOffice,
      taxNumber,
      city,
      district,
      address,
    };
  }
  return {
    buyerType: 'individual',
    recipientName,
    companyName: null,
    taxOffice: null,
    taxNumber: null,
    city,
    district,
    address,
  };
}
