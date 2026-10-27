-- Recovered from the hosted migration ledger; original version retained.

-- Server-only catalogue promotion preview: invoker RPC needs explicit table SELECT.
-- This does not grant campaign read access to anon or authenticated users.
grant select on table
  public.automatic_campaigns,
  public.products,
  public.product_variants,
  public.categories
to service_role;
