-- Talent pool crew freelance: pendaftaran lewat pabrikenangan.my.id/karir
--
-- KENAPA STRUKTURNYA BEGINI
--
-- 1. Nomor WA yang jadi kunci unik, bukan nama. Nama kembar itu wajar di
--    kumpulan pelamar; satu orang mendaftar dua kali karena mengira form-nya
--    gagal terkirim juga wajar. Yang kedua itulah yang harus ditolak, dan
--    hanya nomor yang bisa membedakannya.
--
-- 2. Nomor disimpan sudah TERNORMALISASI ke format 62xxxxxxxxxx (tanpa +,
--    tanpa 0 di depan, tanpa spasi/strip). Kalau normalisasi diserahkan ke
--    pembacanya nanti, "0812-3456" dan "+62 812 3456" akan lolos sebagai dua
--    baris berbeda dan unique constraint di atas jadi tidak ada gunanya.
--    Normalisasi dilakukan di route /api/karir sebelum insert.
--
-- 3. RLS menyala TANPA satu pun policy. Ini disengaja: daftar pelamar berisi
--    nomor HP orang, dan anon key ada di dalam bundel JavaScript yang bisa
--    dibaca siapa saja. Tanpa policy, anon dan authenticated tidak bisa
--    membaca maupun menulis apa pun; hanya service role (yang hidup di
--    server Next.js) yang menembusnya. Form publik tetap bisa mendaftar
--    karena insert-nya lewat route server, bukan dari browser.
--
-- Jalankan: SUPABASE_DB_PASSWORD=... node run-sql.js ../sql/2026-09-07_talent_pool.sql

create table if not exists public.crew_applicants (
  id         uuid primary key default gen_random_uuid(),

  full_name  text not null,

  -- Format tersimpan: 62 + nomor tanpa 0 di depan. Lihat catatan (2).
  phone      text not null unique,

  created_at timestamptz not null default now()
);

-- Pembacaan yang paling sering: "siapa saja yang baru mendaftar".
create index if not exists crew_applicants_created_at_idx
  on public.crew_applicants (created_at desc);

alter table public.crew_applicants enable row level security;

comment on table public.crew_applicants is
  'Talent pool crew freelance photobooth. Diisi dari halaman publik /karir lewat POST /api/karir (service role). Tidak ada policy RLS: anon key tidak boleh menyentuh tabel ini.';

comment on column public.crew_applicants.phone is
  'Nomor WhatsApp ternormalisasi: 62xxxxxxxxxx, hanya digit. Chat langsung: https://wa.me/<phone>.';
