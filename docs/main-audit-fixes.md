# Main reliability audit fixes

Based on main `7f5683e` (28 October 2026). Payment integration is outside this change.

## Behavior

- Cart, favorites and coupon persistence share safe storage. Blocked storage and quota errors keep the current tab functional with a memory fallback.
- `admin_save_product` saves product and private cost in one invoker transaction. A stable client UUID survives upload failure and lost save responses. Retrying never resets existing stock. Variant parent costs remain untouched.
- Image retries reuse one object path and metadata ID. Failed metadata writes are checked before orphan cleanup; uncertain reads keep the object for retry instead of deleting a potentially recorded image. Storage object listing/upsert is limited to existing store admins.
- The normalized SKU unique index enforces `upper(btrim(sku))`. A trigger normalizes future writes. Migration refuses legacy collisions instead of changing or merging products; production preflight found none.
- Multipart import counts the complete streamed request before parsing: a 2 MiB file plus a bounded 100 KB allowance for snapshots/other multipart fields. A client cannot bypass the total limit by omitting Content-Length or adding extra fields.
- Preview shows old/new prices and stock. Confirmation compares the preview snapshot against current product/cost rows under locks. A changed record returns HTTP 409 and requires a new preview. Existing stock opt-in and stock movement auditing are preserved.
- Customer orders use exact total count and 20-row pages with deterministic time/ID ordering. Return-eligible orders and return requests have independent 20-row pages. Claimed quantities include all non-rejected requests, even outside the displayed page. Request history is complete for the displayed request page. Product names for requests do not depend on the selected order page.
- Campaign product selection searches/paginates the full catalog through an admin-authenticated route. Attached target names are joined with their campaign row, including inactive targets. Existing campaign list limits are unchanged.
- Active category, variant, product, stock and import modals share a native modal dialog: background inertness, keyboard containment, Escape and focus return. Pending mutations cannot be dismissed.
- Six prior lint warnings were removed; small product thumbnails use Next Image.

## Verification

- 102 Node tests: existing application regressions, denied/quota storage, bounded multipart cancellation, image write/cleanup and lost-response retry, page URLs, and import HTTP authorization/preview/commit/conflict/outage paths.
- SQL regressions run only on isolated local CI Supabase: admin/customer/anonymous authorization, normalized SKU uniqueness, stable product UUID retry without stock reset, cost save/clear, import stale snapshot rejection and successful fresh confirmation, 65 customer orders/requests, more than 500 history rows, cross-customer isolation, and campaign search beyond 2,000 products.
- Existing order/payment concurrency suites remain part of CI.
- TypeScript, lint and production build are CI requirements. CI downloads official Docker Hub images after repeated GHCR throttling; no database checks are skipped.
- Browser QA used temporary fixture pages (removed before commit), including mobile 390×844 and desktop, modal Escape/focus return, independent return navigation and a 99−65=34 remaining-quantity example. No customer/admin production mutation was submitted through the browser.
- Hosted migration `20261028143500_audit_reliability_customer_pagination.sql` was applied after SQL CI passed. New functions are security invoker and cannot be executed by anon. Hosted checks use read-only transactions and sanitized counts, not fixture writes.

## Scope notes

Memory fallback cannot persist across a full reload when browser storage is unavailable. Images use a separate storage transaction: a product may be saved while its image awaits retry, and the UI reports this state. Local failure and retry tests are supplemented by database/HTTP tests; browser QA does not impersonate a live administrator or submit live orders.
