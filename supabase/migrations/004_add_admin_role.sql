-- ============================================================================
-- JDIL·ASTRAL — Migration 004
-- Admin role support + per-profile deactivation flag.
--
-- The sign-up flow (src/hooks/useAuth.ts → signUp) selects one of four
-- roles; the Admin role is only offered to the pre-approved admin email
-- in the signup form. The DB enforces the four-value enum regardless.
--
-- The `active` column lets the Admin dashboard soft-deactivate accounts
-- without losing historical references (purchase_orders.created_by,
-- purchase_orders.approved_by both reference auth.users and would
-- cascade-null if we deleted the profile).
-- ============================================================================

-- 1. Expand the role check constraint to include 'admin'.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('engineer', 'manager', 'csuite', 'admin'));

-- 2. Add the soft-deactivate flag. Defaults to true so existing rows
--    stay active without a backfill step.
alter table public.profiles
  add column if not exists active boolean not null default true;

-- 3. Make sure the per-role write policies include 'admin' as a writer
--    on every table that was previously gated to engineer+csuite.
--    Admins should have the same write capability as a csuite user.
--    (Drop + recreate keeps the migration idempotent.)

do $$
begin
  if exists (select 1 from pg_policies where policyname = 'projects_engineer_write') then
    drop policy "projects_engineer_write" on public.projects;
  end if;
  if exists (select 1 from pg_policies where policyname = 'annexures_engineer_write') then
    drop policy "annexures_engineer_write" on public.annexures;
  end if;
  if exists (select 1 from pg_policies where policyname = 'line_items_engineer_write') then
    drop policy "line_items_engineer_write" on public.line_items;
  end if;
  if exists (select 1 from pg_policies where policyname = 'po_engineer_write') then
    drop policy "po_engineer_write" on public.purchase_orders;
  end if;
  if exists (select 1 from pg_policies where policyname = 'fx_engineer_write') then
    drop policy "fx_engineer_write" on public.exchange_rates;
  end if;
end$$;

create policy "projects_engineer_write" on public.projects
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('engineer', 'csuite', 'admin')
    )
  );

create policy "annexures_engineer_write" on public.annexures
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('engineer', 'csuite', 'admin')
    )
  );

create policy "line_items_engineer_write" on public.line_items
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('engineer', 'csuite', 'admin')
    )
  );

create policy "po_engineer_write" on public.purchase_orders
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('engineer', 'csuite', 'admin')
    )
  );

create policy "fx_engineer_write" on public.exchange_rates
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('engineer', 'csuite', 'admin')
    )
  );

-- 4. Only admins (and csuite) may change another user's role or
--    toggle their active flag. We layer this on top of the existing
--    `profiles_update_own` policy so a user can still edit their own row.
drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write" on public.profiles
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'csuite')
    )
  );
