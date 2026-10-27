export const formatPrice = (value: number) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(value);

export const formatProductPrice = (value: number) =>
  `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(value)} TL`;
