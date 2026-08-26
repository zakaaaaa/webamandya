-- Pelacakan bahan habis pakai per perangkat: KERTAS dan TINTA.
--
-- KENAPA STRUKTURNYA BEGINI
-- Level tinta EPSON L3210 TIDAK BISA dibaca dari software. Tangki EcoTank
-- tidak berchip, jadi printer-nya sendiri tidak punya sensor level tinta —
-- diverifikasi 2026-08-27: Get-PrinterProperty tidak mengembalikan satu pun
-- properti ink/level/supply, WMI Win32_Printer tidak punya properti tinta,
-- dan portnya USB (bukan IPP yang punya atribut supply).
--
-- Karena itu tinta dilacak sebagai AKUMULASI PEMAKAIAN, bukan sisa terukur.
-- Aplikasi menghitung liputan CMYK dari piksel yang benar-benar dicetak
-- (setelah koreksi warna), lalu mengirim deltanya ke sini. Satuannya
-- "halaman penuh": 1,0 = satu halaman penuh tinta pekat untuk satu kanal.
--
-- Kertas dilacak sebagai stok yang dikurangi tiap cetakan, dan diisi ulang
-- oleh operator lewat dashboard. Status real-time printer (PaperOut, macet)
-- datang terpisah dari spooler Windows dan berfungsi sebagai kebenaran
-- pembanding kalau hitungan stoknya meleset.
--
-- Jalankan di Supabase -> SQL Editor (project kqykaplhsutkxqxlymbq).

-- ============================================================
-- 1. Keadaan terkini per perangkat (satu baris per device)
-- ============================================================
create table if not exists public.device_consumables (
  device_id            uuid primary key
                       references public.devices(id) on delete cascade,

  -- KERTAS -----------------------------------------------------
  -- paper_loaded  : jumlah lembar saat terakhir diisi operator
  -- paper_remaining: sisa sekarang, dikurangi tiap cetakan berhasil
  paper_loaded         integer not null default 0,
  paper_remaining      integer not null default 0,
  paper_low_threshold  integer not null default 20,
  paper_last_loaded_at timestamptz,

  -- TINTA ------------------------------------------------------
  -- Akumulasi liputan sejak isi ulang terakhir, per kanal, satuan
  -- "halaman penuh". Dipisah per kanal karena pada photobooth kanal
  -- tertentu bisa habis jauh lebih cepat tergantung desain frame.
  ink_c                double precision not null default 0,
  ink_m                double precision not null default 0,
  ink_y                double precision not null default 0,
  ink_k                double precision not null default 0,

  -- Kapasitas satu siklus isi ulang, dalam satuan yang sama.
  -- 0 = belum dikalibrasi; dashboard menampilkan pemakaian mentah saja
  -- dan belum bisa menghitung persentase sisa. Diisi setelah satu siklus
  -- penuh: operator tahu berapa halaman-penuh yang terpakai sampai tinta
  -- benar-benar habis.
  ink_page_capacity    double precision not null default 0,
  ink_low_threshold    double precision not null default 0.85,
  ink_last_refill_at   timestamptz,

  -- STATUS PRINTER (dari spooler Windows, bukan hitungan) --------
  printer_status       text,
  printer_blocked      boolean not null default false,
  printer_reason       text,
  queued_jobs          integer not null default 0,
  printer_checked_at   timestamptz,

  -- Anti-spam notifikasi: kapan peringatan terakhir dikirim, supaya
  -- Telegram tidak dibanjiri satu pesan per cetakan saat stok menipis.
  paper_alerted_at     timestamptz,
  ink_alerted_at       timestamptz,
  printer_alerted_at   timestamptz,

  total_sheets_printed bigint not null default 0,
  updated_at           timestamptz not null default now()
);

-- ============================================================
-- 2. Riwayat kejadian (isi ulang kertas/tinta, penyesuaian manual)
-- ============================================================
-- Dipisah dari tabel keadaan supaya operator bisa menelusuri "kapan
-- terakhir diisi dan berapa" tanpa merusak angka berjalan, dan supaya
-- kapasitas tinta bisa dikalibrasi dari riwayat nyata.
create table if not exists public.consumable_events (
  id          uuid primary key default gen_random_uuid(),
  device_id   uuid not null references public.devices(id) on delete cascade,

  -- paper_load | ink_refill | paper_adjust | ink_calibrate
  kind        text not null,

  -- Untuk paper_load  : jumlah lembar yang dimuat
  -- Untuk ink_refill  : akumulasi liputan yang di-reset (buat kalibrasi)
  -- Untuk ink_calibrate: kapasitas baru yang ditetapkan
  amount      double precision,

  note        text,
  actor       text,
  created_at  timestamptz not null default now()
);

create index if not exists consumable_events_device_idx
  on public.consumable_events (device_id, created_at desc);

-- ============================================================
-- 3. RLS — samakan pola dengan tabel lain di project ini
-- ============================================================
alter table public.device_consumables enable row level security;
alter table public.consumable_events  enable row level security;

-- Backend memakai SERVICE ROLE KEY sehingga melewati RLS sepenuhnya;
-- policy di bawah hanya untuk dashboard (anon/authenticated) yang membaca
-- Supabase langsung. Operator hanya boleh melihat perangkat miliknya
-- sendiri, kecuali super admin.
drop policy if exists device_consumables_read on public.device_consumables;
create policy device_consumables_read on public.device_consumables
  for select using (
    exists (
      select 1
      from public.devices d
      join public.admin_users p on p.id = auth.uid()
      where d.id = device_consumables.device_id
        and (p.role = 'super_admin' or p.client_id = d.client_id)
    )
  );

drop policy if exists consumable_events_read on public.consumable_events;
create policy consumable_events_read on public.consumable_events
  for select using (
    exists (
      select 1
      from public.devices d
      join public.admin_users p on p.id = auth.uid()
      where d.id = consumable_events.device_id
        and (p.role = 'super_admin' or p.client_id = d.client_id)
    )
  );

-- Menulis dari dashboard (isi kertas, isi tinta, ubah ambang). Mengikuti
-- pola yang sudah dipakai DevicesManager, yang meng-update tabel devices
-- langsung dari klien alih-alih lewat backend.
drop policy if exists device_consumables_write on public.device_consumables;
create policy device_consumables_write on public.device_consumables
  for update using (
    exists (
      select 1
      from public.devices d
      join public.admin_users p on p.id = auth.uid()
      where d.id = device_consumables.device_id
        and (p.role = 'super_admin' or p.client_id = d.client_id)
    )
  );

drop policy if exists consumable_events_write on public.consumable_events;
create policy consumable_events_write on public.consumable_events
  for insert with check (
    exists (
      select 1
      from public.devices d
      join public.admin_users p on p.id = auth.uid()
      where d.id = consumable_events.device_id
        and (p.role = 'super_admin' or p.client_id = d.client_id)
    )
  );

-- ============================================================
-- 4. Baris awal untuk perangkat yang sudah ada
-- ============================================================
insert into public.device_consumables (device_id)
select id from public.devices
on conflict (device_id) do nothing;
