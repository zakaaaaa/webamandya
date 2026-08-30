-- Antrean pelanggan photobooth: tiket virtual lewat QR di standee.
--
-- KENAPA STRUKTURNYA BEGINI
--
-- 1. Nomor antrean TIDAK boleh dihitung di Node dengan count(*)+1. Saat tiga
--    orang scan QR dalam detik yang sama, ketiganya membaca hitungan yang sama
--    dan mendapat nomor kembar. Karena itu pengambilan nomor dikerjakan satu
--    fungsi Postgres (queue_take_ticket) yang mengunci baris device_queue_state
--    lebih dulu, sehingga semua permintaan untuk satu booth berbaris rapi.
--
-- 2. Mode antrean disimpan di SERVER, bukan di aplikasi kiosk. Panel operator
--    berjalan di HP operator, dan kiosk hanya membacanya saat idle. Efeknya:
--    kalau app kiosk crash di tengah acara, antrean tetap hidup dan operator
--    tetap bisa memanggil orang.
--
-- 3. Ada tiga mode, bukan dua. "closing" = berhenti menerima tiket baru tapi
--    tiket yang sudah terbit tetap dilayani. Tanpa ini, mematikan antrean saat
--    masih ada 3 orang memegang nomor akan menelantarkan mereka.
--
-- 4. queue_date memakai waktu Asia/Jakarta, bukan UTC. Tengah malam UTC itu
--    pukul 07.00 WIB — nomor antrean akan ter-reset persis saat booth mulai
--    ramai kalau ini dilewatkan.
--
-- Jalankan: SUPABASE_DB_PASSWORD=... node run-sql.js ../sql/2026-08-30_queue.sql

-- ============================================================
-- 1. Keadaan antrean per perangkat (satu baris per device)
-- ============================================================
create table if not exists public.device_queue_state (
  device_id                uuid primary key
                           references public.devices(id) on delete cascade,

  -- Slug pendek untuk URL publik: pabrikenangan.my.id/antri/<slug>.
  -- Sengaja bukan hwid — hwid itu panjang, membuat QR jadi rapat dan sulit
  -- di-scan dari jarak 1-2 meter, dan tidak bisa disebut lisan kalau ada
  -- pengunjung yang kameranya gagal membaca.
  queue_slug               text not null unique,

  -- off     : antrean mati, pengunjung langsung datang ke booth
  -- on      : menerima tiket baru
  -- closing : tidak menerima tiket baru, sisa tiket tetap dilayani
  mode                     text not null default 'off',

  -- PIN panel operator (halaman web di HP operator). Bukan kredensial
  -- bernilai tinggi — cakupannya hanya memanggil/melewati antrean satu booth.
  operator_pin             text,

  -- Kirim notifikasi "bersiap" saat sisa sekian orang di depannya. Bisa
  -- disetel dari panel karena angka yang pas baru ketahuan setelah hari
  -- pertama: tergantung seberapa jauh orang berani menjauh dari tenant.
  notify_lead              integer not null default 2,

  -- Batas panjang antrean. Menolak dengan "coba lagi ~45 menit" lebih baik
  -- daripada memberi nomor ke orang yang harus menunggu satu jam lalu kecewa.
  max_queue_length         integer not null default 12,

  -- Dipakai untuk estimasi tunggu sebelum ada cukup sesi selesai hari itu.
  fallback_session_seconds integer not null default 480,

  updated_at               timestamptz not null default now(),

  constraint device_queue_state_mode_check
    check (mode in ('off', 'on', 'closing'))
);

-- ============================================================
-- 2. Tiket antrean
-- ============================================================
create table if not exists public.queue_tickets (
  id                uuid primary key default gen_random_uuid(),
  device_id         uuid not null references public.devices(id) on delete cascade,
  client_id         uuid not null references public.clients(id) on delete cascade,

  queue_date        date    not null,
  ticket_no         integer not null,

  -- Kode 4 digit yang diketik pengunjung di kiosk. Ini satu-satunya yang
  -- mencegah orang lain memakai sesi yang sudah dibayar orang lain.
  claim_code        text    not null,

  -- waiting : masih antre
  -- called  : sudah dipanggil, belum sampai di booth
  -- serving : kode sudah diklaim di kiosk, sesi berjalan
  -- done    : selesai
  -- skipped : dilewati operator (tidak muncul saat dipanggil)
  -- left    : dibatalkan sendiri oleh pengunjung dari HP-nya
  status            text    not null default 'waiting',

  display_name      text,

  -- Opsional. Dipakai tombol tel: di panel operator — jaring pengaman untuk
  -- pengguna iPhone, yang tidak bisa menerima Web Push kecuali halamannya
  -- di-Add to Home Screen lebih dulu.
  phone             text,

  -- qr | operator. Operator menerbitkan tiket manual untuk orang yang sudah
  -- terlanjur berdiri antre saat mode antrean baru dinyalakan, supaya urutan
  -- fisik mereka tidak hilang dan tidak perlu rebutan scan.
  source            text    not null default 'qr',

  -- Penanda peramban pengunjung. Bukan untuk pelacakan — hanya supaya halaman
  -- yang di-reload (atau localStorage yang hilang) mengembalikan tiket yang
  -- sama, bukan menerbitkan nomor kedua untuk orang yang sama.
  fingerprint       text,

  -- Langganan Web Push (endpoint + keys). Null berarti pengunjung menolak
  -- atau perangkatnya tidak mendukung; halaman harus jujur menampilkan itu
  -- supaya dia tidak menjauh dari tenant sambil mengira akan dikabari.
  push_subscription jsonb,
  notified_soon_at  timestamptz,
  notified_turn_at  timestamptz,

  -- Frame yang dipilih dari HP sambil mengantre. Kiosk melewati halaman
  -- pemilihan frame kalau ini sudah terisi.
  selected_frame_id uuid references public.frames(id) on delete set null,

  -- Terisi setelah kode diklaim di kiosk. Sesi yang sudah lunas TIDAK pernah
  -- hangus karena antrean: pengunjung yang tidak muncul hanya kehilangan
  -- posisinya, bukan uangnya.
  session_id        uuid references public.sessions(id) on delete set null,

  created_at        timestamptz not null default now(),
  called_at         timestamptz,
  served_at         timestamptz,
  closed_at         timestamptz,

  constraint queue_tickets_status_check
    check (status in ('waiting', 'called', 'serving', 'done', 'skipped', 'left')),
  constraint queue_tickets_source_check
    check (source in ('qr', 'operator')),
  constraint queue_tickets_no_unik
    unique (device_id, queue_date, ticket_no)
);

-- Kode klaim hanya perlu unik di antara tiket yang masih hidup di booth itu.
-- Ruang 9000 angka melawan antrean belasan orang membuat bentrok praktis
-- tidak pernah terjadi, dan kode boleh dipakai ulang esok harinya.
create unique index if not exists queue_tickets_claim_aktif_idx
  on public.queue_tickets (device_id, claim_code)
  where status in ('waiting', 'called', 'serving');

-- Query panas: papan antrean, panel operator, dan polling halaman pengunjung.
create index if not exists queue_tickets_papan_idx
  on public.queue_tickets (device_id, queue_date, status, ticket_no);

-- ============================================================
-- 3. Ambil nomor — satu-satunya jalan masuk tiket baru
-- ============================================================
-- SECURITY DEFINER supaya backend (service role) dan dashboard sama-sama
-- memanggil jalur yang sama, dan tidak ada tempat kedua yang menghitung nomor.
create or replace function public.queue_take_ticket(
  p_slug        text,
  p_name        text default null,
  p_phone       text default null,
  p_fingerprint text default null,
  p_source      text default 'qr'
) returns public.queue_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state  public.device_queue_state;
  v_device public.devices;
  v_ticket public.queue_tickets;
  v_today  date;
  v_aktif  integer;
  v_code   text;
  v_coba   integer := 0;
begin
  -- Kunci baris booth ini lebih dulu. Inilah yang membuat nomor tidak pernah
  -- kembar: semua permintaan untuk satu booth berbaris di baris yang sama,
  -- sementara booth lain tidak ikut tertahan.
  select * into v_state
    from public.device_queue_state
   where queue_slug = p_slug
     for update;

  if not found then
    raise exception 'QUEUE_NOT_FOUND';
  end if;

  select * into v_device from public.devices where id = v_state.device_id;
  if not found or not v_device.is_active then
    raise exception 'DEVICE_INACTIVE';
  end if;

  v_today := (now() at time zone 'Asia/Jakarta')::date;

  -- Tiket aktif milik pengunjung yang sama dikembalikan apa adanya. Ini
  -- dicek SEBELUM mode, supaya orang yang sudah memegang nomor tetap bisa
  -- membuka halamannya meski antrean sudah ditutup untuk pendatang baru.
  if p_fingerprint is not null and p_fingerprint <> '' then
    select * into v_ticket
      from public.queue_tickets
     where device_id  = v_state.device_id
       and queue_date = v_today
       and fingerprint = p_fingerprint
       and status in ('waiting', 'called', 'serving')
     order by ticket_no
     limit 1;
    if found then
      return v_ticket;
    end if;
  end if;

  -- Operator boleh menerbitkan tiket meski mode masih 'closing' — dia yang
  -- melihat langsung siapa yang sudah berdiri di depan booth.
  if v_state.mode <> 'on' and p_source <> 'operator' then
    raise exception 'QUEUE_CLOSED';
  end if;

  select count(*) into v_aktif
    from public.queue_tickets
   where device_id  = v_state.device_id
     and queue_date = v_today
     and status in ('waiting', 'called');

  if v_aktif >= v_state.max_queue_length and p_source <> 'operator' then
    raise exception 'QUEUE_FULL';
  end if;

  loop
    v_coba := v_coba + 1;
    v_code := (1000 + floor(random() * 9000))::int::text;
    exit when not exists (
      select 1 from public.queue_tickets
       where device_id  = v_state.device_id
         and claim_code = v_code
         and status in ('waiting', 'called', 'serving')
    );
    if v_coba > 50 then
      raise exception 'CLAIM_CODE_EXHAUSTED';
    end if;
  end loop;

  insert into public.queue_tickets (
    device_id, client_id, queue_date, ticket_no, claim_code,
    display_name, phone, fingerprint, source
  )
  values (
    v_state.device_id,
    v_device.client_id,
    v_today,
    coalesce(
      (select max(ticket_no) from public.queue_tickets
        where device_id = v_state.device_id and queue_date = v_today), 0
    ) + 1,
    v_code,
    nullif(btrim(p_name), ''),
    nullif(btrim(p_phone), ''),
    nullif(btrim(p_fingerprint), ''),
    p_source
  )
  returning * into v_ticket;

  return v_ticket;
end;
$$;

-- Fungsi ini hanya boleh dipanggil backend. Hak eksekusi dicabut dari peran
-- publik supaya tidak ada jalur kedua yang bisa menerbitkan tiket — kalau anon
-- boleh memanggilnya, siapa pun bisa membanjiri antrean lewat PostgREST tanpa
-- melewati rate limit di backend.
--
-- REVOKE dari PUBLIC ikut mencabut service_role (hak default fungsi memang
-- diwarisi dari PUBLIC), jadi service_role harus di-grant kembali secara
-- eksplisit sesudahnya — kalau tidak, backend sendiri yang kena tolak.
revoke execute on function public.queue_take_ticket(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.queue_take_ticket(text, text, text, text, text)
  to service_role;

-- ============================================================
-- 4. RLS — samakan pola dengan device_consumables
-- ============================================================
-- Halaman pengunjung TIDAK pernah menyentuh Supabase langsung; semuanya lewat
-- backend yang memakai service role. Policy di bawah hanya untuk dashboard.
alter table public.device_queue_state enable row level security;
alter table public.queue_tickets      enable row level security;

drop policy if exists device_queue_state_read on public.device_queue_state;
create policy device_queue_state_read on public.device_queue_state
  for select using (
    exists (
      select 1
      from public.devices d
      join public.admin_users p on p.id = auth.uid()
      where d.id = device_queue_state.device_id
        and (p.role = 'super_admin' or p.client_id = d.client_id)
    )
  );

drop policy if exists device_queue_state_write on public.device_queue_state;
create policy device_queue_state_write on public.device_queue_state
  for update using (
    exists (
      select 1
      from public.devices d
      join public.admin_users p on p.id = auth.uid()
      where d.id = device_queue_state.device_id
        and (p.role = 'super_admin' or p.client_id = d.client_id)
    )
  );

drop policy if exists queue_tickets_read on public.queue_tickets;
create policy queue_tickets_read on public.queue_tickets
  for select using (
    exists (
      select 1
      from public.devices d
      join public.admin_users p on p.id = auth.uid()
      where d.id = queue_tickets.device_id
        and (p.role = 'super_admin' or p.client_id = d.client_id)
    )
  );

-- ============================================================
-- 5. Baris awal untuk perangkat yang sudah ada
-- ============================================================
-- Slug dinomori lanjut dari slug tertinggi yang sudah ada, supaya menjalankan
-- ulang berkas ini setelah menambah perangkat baru tidak pernah bentrok.
-- PIN operator diacak; ganti lewat dashboard sebelum dipakai di lapangan.
insert into public.device_queue_state (device_id, queue_slug, operator_pin)
select d.id,
       'pk' || lpad((
         coalesce((
           select max((substring(s.queue_slug from '[0-9]+$'))::int)
             from public.device_queue_state s
            where s.queue_slug ~ '^pk[0-9]+$'
         ), 0) + row_number() over (order by d.created_at)
       )::text, 2, '0'),
       (100000 + floor(random() * 900000))::int::text
  from public.devices d
 where not exists (
   select 1 from public.device_queue_state s where s.device_id = d.id
 );
