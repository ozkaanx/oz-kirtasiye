-- Catalog campaign previews are called only through the Next.js server.
-- SECURITY INVOKER executes with service_role privileges and needs SELECT on referenced tables.
-- Do not grant access to anon or authenticated users here.
grant select on table
  public.automatic_campaigns,
  public.products,
  public.product_variants,
  public.categories
  to service_role;
