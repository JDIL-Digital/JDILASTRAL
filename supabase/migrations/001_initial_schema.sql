-- ============================================================================
-- JSIL·ASTRAL — Fleet Operations & Rig Governance Engine
-- Jindal Drilling & Industries Ltd.
--
-- Migration: 001_initial_schema
-- Purpose:   Bootstrap the entire domain — rigs, projects, annexures,
--            line items, purchase orders, FX rates, and user profiles —
--            with RLS, seed data, indexes, and triggers.
--
-- Apply with:  supabase db push
-- Or via SQL editor: paste the full file, run once, then commit the file.
-- ============================================================================


-- ============================================================================
-- TABLE 1 · rigs
-- ============================================================================
create table public.rigs (
  id         uuid default gen_random_uuid() primary key,
  name       text not null unique,
  type       text default 'Jackup',
  status     text default 'active'
             check (status in ('active', 'maintenance', 'standby')),
  photo_url  text,
  created_at timestamptz default now()
);

-- Seed all 6 rigs
insert into public.rigs (name, status, photo_url) values
  ('Discovery 1',     'active',      '/rigs/discovery-1.jpg'),
  ('Virtue 1',        'active',      '/rigs/virtue-1.jpg'),
  ('Jindal Star',     'active',      '/rigs/jindal-star.jpg'),
  ('Jindal Explorer', 'active',      '/rigs/jindal-explorer.jpg'),
  ('Jindal Pioneer',  'maintenance', '/rigs/jindal-pioneer.jpg'),
  ('Jindal Supreme',  'standby',     '/rigs/jindal-supreme.jpg');


-- ============================================================================
-- TABLE 2 · projects
-- ============================================================================
create table public.projects (
  id                uuid default gen_random_uuid() primary key,
  rig_id            uuid references public.rigs(id) on delete cascade,
  name              text not null,
  description       text,
  start_date        date,
  end_date          date,
  total_budget_usd  numeric(15, 2) default 0,
  status            text default 'active'
                    check (status in ('active', 'completed', 'on-hold')),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Seed Jindal Pioneer project
insert into public.projects
  (rig_id, name, description, start_date, total_budget_usd, status)
select
  id,
  'Jindal Pioneer Recertification 2026',
  'Recertification and miscellaneous services — ONGC contract',
  '2026-01-01',
  18960000.00,
  'active'
from public.rigs
where name = 'Jindal Pioneer';


-- ============================================================================
-- TABLE 3 · annexures
-- ============================================================================
create table public.annexures (
  id          uuid default gen_random_uuid() primary key,
  project_id  uuid references public.projects(id) on delete cascade,
  number      integer not null check (number between 1 and 11),
  name        text not null,
  budget_usd  numeric(15, 2) default 0,
  created_at  timestamptz default now()
);

-- Seed all 11 annexures for the Jindal Pioneer recertification project
insert into public.annexures (project_id, number, name, budget_usd)
select
  p.id,
  a.number,
  a.name,
  a.budget_usd
from public.projects p
cross join (values
  ( 1, 'Towage',           179850.00),
  ( 2, 'Class Survey',      36193.00),
  ( 3, 'Port Expenses',    936075.00),
  ( 4, 'CHA & Customs',    275000.00),
  ( 5, 'Crew',             917500.00),
  ( 6, 'Drilling',        6475383.56),
  ( 7, 'Mechanical',      1760997.00),
  ( 8, 'Electrical',      1320000.00),
  ( 9, 'Marine & Safety', 1856500.00),
  (10, 'Contractual',     4946840.00),
  (11, 'Missing Items',    257150.00)
) as a(number, name, budget_usd)
where p.name = 'Jindal Pioneer Recertification 2026';


-- ============================================================================
-- TABLE 4 · line_items
--
-- `actual_usd_computed` and `surplus_usd` are STORED generated columns so
-- every row exposes its USD-normalized totals without app-side conversion.
-- ============================================================================
create table public.line_items (
  id                     uuid default gen_random_uuid() primary key,
  annexure_id            uuid references public.annexures(id) on delete cascade,
  sr_no                  integer,
  material_code          text,
  area                   text,
  description            text not null,
  work_by                text,
  budget_usd             numeric(15, 2) default 0,
  actual_local_amount    numeric(15, 2),
  actual_local_currency  text default 'USD'
                         check (actual_local_currency in ('USD', 'INR', 'AED')),
  actual_local_date      date,
  exchange_rate_to_usd   numeric(10, 6) default 1,
  actual_usd_computed    numeric(15, 2)
                         generated always as
                           (actual_local_amount * exchange_rate_to_usd) stored,
  surplus_usd            numeric(15, 2)
                         generated always as
                           (budget_usd - (actual_local_amount * exchange_rate_to_usd)) stored,
  projected_cost         numeric(15, 2),
  mr_no                  text,
  po_no                  text,
  remarks                text,
  status                 text default 'pending'
                         check (status in ('pending', 'on-track', 'watch', 'overrun')),
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);


-- ============================================================================
-- TABLE 5 · purchase_orders
-- ============================================================================
create table public.purchase_orders (
  id              uuid default gen_random_uuid() primary key,
  project_id      uuid references public.projects(id) on delete cascade,
  line_item_id    uuid references public.line_items(id),
  po_number       text unique not null,
  vendor_name     text not null,
  description     text,
  amount_usd      numeric(15, 2),
  local_amount    numeric(15, 2),
  local_currency  text default 'USD',
  exchange_rate   numeric(10, 6) default 1,
  status          text default 'draft'
                  check (status in ('draft', 'approved', 'issued', 'cancelled')),
  pdf_url         text,
  created_by      uuid references auth.users(id),
  approved_by     uuid references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Sequence for auto-numbering POs. Application layer formats it as
-- e.g. `JSIL-PO-2026-00001` when calling nextval('po_sequence').
create sequence if not exists po_sequence start 1;


-- ============================================================================
-- TABLE 6 · exchange_rates
-- ============================================================================
create table public.exchange_rates (
  id               uuid default gen_random_uuid() primary key,
  base_currency    text not null,
  target_currency  text not null,
  rate             numeric(10, 6) not null,
  rate_date        date not null,
  source           text default 'frankfurter.app',
  created_at       timestamptz default now(),
  unique (base_currency, target_currency, rate_date)
);


-- ============================================================================
-- TABLE 7 · profiles (extends auth.users)
-- ============================================================================
create table public.profiles (
  id                uuid references auth.users(id) primary key,
  full_name         text,
  email             text,
  role              text default 'engineer'
                    check (role in ('engineer', 'manager', 'csuite')),
  assigned_rig_id   uuid references public.rigs(id),
  avatar_url        text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Auto-create a profile row whenever Supabase Auth creates a user.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.rigs             enable row level security;
alter table public.projects         enable row level security;
alter table public.annexures        enable row level security;
alter table public.line_items       enable row level security;
alter table public.purchase_orders  enable row level security;
alter table public.exchange_rates   enable row level security;
alter table public.profiles         enable row level security;

-- ---------- rigs ----------
create policy "rigs_read_all" on public.rigs
  for select using (auth.role() = 'authenticated');

-- ---------- projects ----------
create policy "projects_read_all" on public.projects
  for select using (auth.role() = 'authenticated');

create policy "projects_engineer_write" on public.projects
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('engineer', 'csuite')
    )
  );

-- ---------- annexures ----------
create policy "annexures_read_all" on public.annexures
  for select using (auth.role() = 'authenticated');

create policy "annexures_engineer_write" on public.annexures
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('engineer', 'csuite')
    )
  );

-- ---------- line_items ----------
create policy "line_items_read_all" on public.line_items
  for select using (auth.role() = 'authenticated');

create policy "line_items_engineer_write" on public.line_items
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('engineer', 'csuite')
    )
  );

-- ---------- purchase_orders ----------
create policy "po_read_all" on public.purchase_orders
  for select using (auth.role() = 'authenticated');

create policy "po_engineer_write" on public.purchase_orders
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('engineer', 'csuite')
    )
  );

-- ---------- exchange_rates ----------
create policy "fx_read_all" on public.exchange_rates
  for select using (auth.role() = 'authenticated');

create policy "fx_engineer_write" on public.exchange_rates
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('engineer', 'csuite')
    )
  );

-- ---------- profiles ----------
create policy "profiles_read_all" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);


-- ============================================================================
-- INDEXES (performance)
-- ============================================================================
create index idx_projects_rig_id      on public.projects(rig_id);
create index idx_annexures_project_id on public.annexures(project_id);
create index idx_line_items_annexure_id on public.line_items(annexure_id);
create index idx_po_project_id        on public.purchase_orders(project_id);
create index idx_fx_date              on public.exchange_rates(rate_date);
create index idx_profiles_role        on public.profiles(role);


-- ============================================================================
-- updated_at auto-touch trigger
-- ============================================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on public.projects
  for each row execute procedure update_updated_at();

create trigger line_items_updated_at
  before update on public.line_items
  for each row execute procedure update_updated_at();

create trigger po_updated_at
  before update on public.purchase_orders
  for each row execute procedure update_updated_at();

-- Also apply to profiles so `updated_at` on that table means something.
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure update_updated_at();


-- ============================================================================
-- END OF MIGRATION 001
-- ============================================================================
