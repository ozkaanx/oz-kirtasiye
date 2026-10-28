/**
 * This is a simple difference between entered selling and purchase amounts.
 * It is not net profit: VAT treatment, shipping, commissions and overhead
 * must be standardized before interpreting this as a formal gross margin.
 */
export function estimateProductProfit(price:number,cost:number|null|undefined) {
  if(cost==null || !Number.isFinite(price) || !Number.isFinite(cost) || price<0 || cost<0)
    return null;
  const difference=Math.round((price-cost)*100)/100;
  return {
    difference,
    marginPercent: price>0 ? Math.round((difference/price)*10000)/100 : null,
  };
}
