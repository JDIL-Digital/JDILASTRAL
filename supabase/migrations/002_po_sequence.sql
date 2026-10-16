-- ============================================================================
-- JDIL·ASTRAL — Migration 002
-- PO number sequence: JDIL/IPO/YYYY/NNNNN (resets each calendar year).
--
-- Called from the client via:
--   const { data } = await supabase.rpc('get_next_po_number');
--
-- Marked `security definer` so authenticated users can call it without
-- needing direct write access to public.purchase_orders — the function
-- reads only the max sequence for the current year.
-- ============================================================================

create or replace function public.get_next_po_number()
returns text as $$
declare
  current_year text := extract(year from now())::text;
  last_seq integer;
  next_seq integer;
  po_number text;
begin
  select coalesce(
    max(
      cast(nullif(split_part(po_number, '/', 4), '') as integer)
    ),
    0
  )
  into last_seq
  from public.purchase_orders
  where po_number like 'JDIL/IPO/' || current_year || '/%';

  next_seq := last_seq + 1;
  po_number := 'JDIL/IPO/' || current_year || '/' ||
               lpad(next_seq::text, 5, '0');
  return po_number;
end;
$$ language plpgsql security definer;

-- Allow authenticated users to invoke it. (RLS still gates the subsequent
-- insert into purchase_orders.)
grant execute on function public.get_next_po_number() to authenticated;
