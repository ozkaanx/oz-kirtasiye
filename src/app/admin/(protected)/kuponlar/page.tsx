import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminCoupons, type AdminCoupon } from '@/components/admin/admin-coupons';

export const metadata:Metadata={title:'Kupon Yönetimi',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';

export default async function AdminCouponsPage(){
  const supabase=await createServerSupabase();
  const [couponRes,redemptionRes]=await Promise.all([
    supabase.from('coupons').select('id,code,label,discount_type,discount_value,max_discount,min_subtotal,starts_at,expires_at,max_uses,max_uses_per_customer,is_active').order('created_at',{ascending:false}).limit(500),
    supabase.rpc('admin_coupon_usage'),
  ]);
  const usage=new Map<string,number>();
  for(const entry of redemptionRes.data??[]){
    usage.set(entry.coupon_id, Number(entry.used_count));
  }
  const coupons:AdminCoupon[]=(couponRes.data??[]).map(c=>({
    ...c,discount_type:c.discount_type as AdminCoupon['discount_type'],
    discount_value:Number(c.discount_value),min_subtotal:Number(c.min_subtotal),
    max_discount:c.max_discount===null?null:Number(c.max_discount),
    used_count:usage.get(c.id)??0,
  }));
  return <AdminCoupons coupons={coupons} loadError={couponRes.error?.message??redemptionRes.error?.message??null}/>;
}
