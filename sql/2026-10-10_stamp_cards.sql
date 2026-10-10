-- Promo kartu stamp: 5 sesi berbayar = 1 sesi gratis.
--
-- Pelanggan membuka /stamp tanpa login. Kartunya dibuat di server, lalu id +
-- token rahasianya disimpan di localStorage HP pelanggan (server hanya
-- menyimpan hash token). Setiap tautan /download/<kode> yang ditempel menjadi
-- satu stamp, dan satu sesi hanya bisa diklaim SEKALI di seluruh kartu
-- (unique session_id). Tujuannya supaya satu rombongan yang berbagi tautan
-- tidak bisa memakainya berkali-kali.
--
-- Setelah 5 stamp, pelanggan mengisi username IG dan memposting papannya.
-- Admin mengecek postingan, lalu membuat voucher dari dasbor (menu Kartu
-- Stamp). Kode voucher ikut tampil di papan pelanggan.
--
-- Semua akses pelanggan lewat API Next (service role). Dasbor membaca dan
-- menandai kartu sebagai admin login; polanya sama dengan story_templates.

create table if not exists public.stamp_cards (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  -- Kode pendek yang tercetak di papan (ikut terlihat di postingan IG),
  -- dipakai admin untuk mencocokkan postingan dengan kartu.
  kode          text not null unique,
  token_hash    text not null,
  ig_username   text,
  diajukan_at   timestamptz,           -- pelanggan menekan "Klaim hadiah"
  voucher_id    uuid references public.vouchers(id) on delete set null,
  voucher_kode  text,
  hadiah_at     timestamptz,           -- admin membuat voucher
  catatan       text,
  created_at    timestamptz not null default now()
);

create index if not exists stamp_cards_client_idx
  on public.stamp_cards (client_id, diajukan_at desc);

create table if not exists public.stamp_claims (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references public.stamp_cards(id) on delete cascade,
  session_id  uuid not null unique references public.sessions(id) on delete cascade,
  urutan      smallint not null check (urutan between 1 and 5),
  created_at  timestamptz not null default now(),
  unique (card_id, urutan)
);

create index if not exists stamp_claims_card_idx on public.stamp_claims (card_id);

alter table public.stamp_cards  enable row level security;
alter table public.stamp_claims enable row level security;

revoke all on public.stamp_cards  from anon;
revoke all on public.stamp_claims from anon;

drop policy if exists stamp_cards_admin on public.stamp_cards;
create policy stamp_cards_admin
  on public.stamp_cards for all
  to authenticated
  using (
    exists (
      select 1 from public.admin_users a
       where a.id = auth.uid()
         and a.is_active
         and (a.role = 'super_admin' or a.client_id = stamp_cards.client_id)
    )
  )
  with check (
    exists (
      select 1 from public.admin_users a
       where a.id = auth.uid()
         and a.is_active
         and (a.role = 'super_admin' or a.client_id = stamp_cards.client_id)
    )
  );

drop policy if exists stamp_claims_admin_read on public.stamp_claims;
create policy stamp_claims_admin_read
  on public.stamp_claims for select
  to authenticated
  using (
    exists (
      select 1 from public.stamp_cards c
        join public.admin_users a on a.id = auth.uid()
       where c.id = stamp_claims.card_id
         and a.is_active
         and (a.role = 'super_admin' or a.client_id = c.client_id)
    )
  );
