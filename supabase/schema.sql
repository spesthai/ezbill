-- EZBill (MVP) schema for Supabase
-- - Landlord web uses Supabase Auth + RLS (anon key in browser, authenticated session).
-- - Tenant H5 does NOT connect directly to Supabase; it goes through Cloudflare Worker (service_role).
-- - Time is stored in UTC as TIMESTAMPTZ; display in app as Asia/Bangkok.

-- ============================================================
-- Extensions (if not already enabled in your project)
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- Profiles (extends auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  language_preference text default 'en',
  created_at timestamptz default now()
);

-- Optional: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ============================================================
-- Properties / Rooms
-- ============================================================
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  label text not null,
  moo text,
  soi text,
  tambon text,
  amphoe text,
  province text,
  full_address text,
  created_at timestamptz default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id),
  label text not null,
  floor text,
  rental_type text check (rental_type in ('monthly', 'daily', 'hourly', 'stall')),
  occupancy_status text not null default 'occupied' check (occupancy_status in ('occupied', 'vacant')),
  base_rent numeric(10,2),
  created_at timestamptz default now()
);

-- ============================================================
-- Bills / Readings / Payments
-- ============================================================
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id),
  currency text not null default 'THB',
  period_start timestamptz not null,
  period_end timestamptz not null,
  due_at timestamptz not null,
  billing_unit text not null check (billing_unit in ('month', 'day', 'hour', 'stall')),
  billing_quantity numeric(10,2) not null default 1,
  rent_amount numeric(10,2) not null,
  water_usage numeric(10,2),
  water_unit_price numeric(10,4),
  water_amount numeric(10,2),
  electricity_usage numeric(10,2),
  electricity_unit_price numeric(10,4),
  electricity_amount numeric(10,2),
  other_fees jsonb,
  total_amount numeric(10,2) not null,
  status text check (status in ('pending', 'paid', 'overdue')),
  share_token_hash text unique not null,
  share_expires_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists bills_room_period on public.bills(room_id, period_start desc);

create table if not exists public.utility_readings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id),
  reading_type text check (reading_type in ('water', 'electricity')),
  reading_at timestamptz not null,
  reading_value numeric(10,2) not null,
  created_at timestamptz default now()
);

create index if not exists utility_readings_room_type_time
  on public.utility_readings(room_id, reading_type, reading_at desc);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid references public.bills(id),
  amount numeric(10,2),
  status text not null check (status in ('uploaded', 'verifying', 'verified', 'rejected', 'manual_approved', 'manual_rejected')),
  slip_object_key text,
  slip_verified boolean default false,
  provider text,
  provider_ref text,
  verification_data jsonb,
  paid_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists payments_bill_created on public.payments(bill_id, created_at desc);

-- ============================================================
-- User settings
-- ============================================================
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) unique,
  default_water_price numeric(10,4) default 8.0000,
  default_electricity_price numeric(10,4) default 8.0000,
  reminder_days_before_due integer default 3,
  created_at timestamptz default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.rooms enable row level security;
alter table public.bills enable row level security;
alter table public.utility_readings enable row level security;
alter table public.payments enable row level security;
alter table public.user_settings enable row level security;

-- profiles: owner access
drop policy if exists "profiles: owner access" on public.profiles;
create policy "profiles: owner access"
  on public.profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- properties: owner access
drop policy if exists "properties: owner access" on public.properties;
create policy "properties: owner access"
  on public.properties for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- rooms: owner access via property
drop policy if exists "rooms: owner access" on public.rooms;
create policy "rooms: owner access"
  on public.rooms for all
  to authenticated
  using (
    exists (
      select 1 from public.properties
      where properties.id = rooms.property_id
        and properties.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.properties
      where properties.id = rooms.property_id
        and properties.user_id = auth.uid()
    )
  );

-- bills: owner access via room -> property
drop policy if exists "bills: owner access" on public.bills;
create policy "bills: owner access"
  on public.bills for all
  to authenticated
  using (
    exists (
      select 1
      from public.rooms
      join public.properties on properties.id = rooms.property_id
      where rooms.id = bills.room_id
        and properties.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.rooms
      join public.properties on properties.id = rooms.property_id
      where rooms.id = bills.room_id
        and properties.user_id = auth.uid()
    )
  );

-- utility_readings: owner access via room -> property
drop policy if exists "utility_readings: owner access" on public.utility_readings;
create policy "utility_readings: owner access"
  on public.utility_readings for all
  to authenticated
  using (
    exists (
      select 1
      from public.rooms
      join public.properties on properties.id = rooms.property_id
      where rooms.id = utility_readings.room_id
        and properties.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.rooms
      join public.properties on properties.id = rooms.property_id
      where rooms.id = utility_readings.room_id
        and properties.user_id = auth.uid()
    )
  );

-- payments: owner access via bill -> room -> property
drop policy if exists "payments: owner access" on public.payments;
create policy "payments: owner access"
  on public.payments for all
  to authenticated
  using (
    exists (
      select 1
      from public.bills
      join public.rooms on rooms.id = bills.room_id
      join public.properties on properties.id = rooms.property_id
      where bills.id = payments.bill_id
        and properties.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.bills
      join public.rooms on rooms.id = bills.room_id
      join public.properties on properties.id = rooms.property_id
      where bills.id = payments.bill_id
        and properties.user_id = auth.uid()
    )
  );

-- user_settings: owner access
drop policy if exists "user_settings: owner access" on public.user_settings;
create policy "user_settings: owner access"
  on public.user_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

