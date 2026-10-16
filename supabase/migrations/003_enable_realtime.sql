-- ============================================================================
-- JDIL·ASTRAL — Migration 003
-- Enable Supabase Realtime for the three tables our client subscribes to:
--   • public.line_items        (useLineItems)
--   • public.rigs              (useRigs, useFleetStats)
--   • public.purchase_orders   (usePOs)
--
-- Without this, `.on('postgres_changes', …)` subscriptions complete
-- successfully but never fire — the DB has no publication to broadcast
-- INSERT / UPDATE / DELETE events to.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- 1. Recreate the supabase_realtime publication cleanly. The hosted
--    Supabase project creates one by default, but we drop + create so
--    the following `alter publication … add table` calls start from a
--    known-good state. All three tables are then explicitly published.
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime
  add table public.line_items;

alter publication supabase_realtime
  add table public.rigs;

alter publication supabase_realtime
  add table public.purchase_orders;

-- 2. Replica identity. Supabase Realtime needs a way to carry old-row
--    data on UPDATE/DELETE events. REPLICA IDENTITY FULL emits every
--    column in the old row, which lets client-side filter clauses
--    (e.g. `filter: 'annexure_id=eq.<uuid>'` in useLineItems) match
--    both the old and new values. Without this, filters miss events
--    on columns that aren't part of the primary key.
alter table public.line_items       replica identity full;
alter table public.rigs             replica identity full;
alter table public.purchase_orders  replica identity full;

-- ============================================================================
-- Verify with:
--   select pubname, schemaname, tablename
--     from pg_publication_tables
--    where pubname = 'supabase_realtime';
-- Expect three rows: line_items, rigs, purchase_orders.
-- ============================================================================
