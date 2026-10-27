import type { CustomerAddress } from '@/lib/customer';
import type { DeliveryMethod } from '@/lib/delivery';

export type CheckoutFields = {
  customerName: string;
  phone: string;
  city: string;
  district: string;
  address: string;
  note: string;
};

export function resolveDeliveryFields(
  fields: CheckoutFields,
  address: CustomerAddress | null,
  method: DeliveryMethod,
  loggedIn: boolean,
): CheckoutFields {
  if (!loggedIn || method !== 'shipping' || !address) return fields;
  return {
    ...fields,
    customerName: address.recipient_name,
    phone: address.phone,
    city: address.city,
    district: address.district,
    address: address.address,
  };
}
