create table if not exists public.bookings (
 id uuid primary key default gen_random_uuid(),
 booking_date date not null,
 start_time time not null,
 customer_name text not null,
 phone text not null,
 email text not null,
 service text not null default 'Haircut',
 created_at timestamptz not null default now(),
 constraint bookings_one_customer_per_slot unique (booking_date,start_time)
);
create index if not exists bookings_date_idx on public.bookings(booking_date);
alter table public.bookings enable row level security;
