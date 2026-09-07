-- Talent pool: status penanganan tiap pelamar.
--
-- Dipakai dasbor dash.pabrikenangan.my.id untuk menandai sudah sampai mana
-- seseorang ditangani. Nilainya sengaja cuma empat, dan namanya memakai kata
-- yang dipakai sehari-hari, bukan istilah HR:
--
--   baru        - baru mendaftar, belum disentuh
--   dihubungi   - sudah di-chat, menunggu jawaban
--   siap        - siap dipanggil kalau ada acara (ini yang dicari saat butuh crew)
--   tidak_cocok - tidak dilanjutkan
--
-- Default 'baru' dan NOT NULL: barisan yang masuk dari form publik tidak
-- pernah menyebut status, dan kolom nullable akan memaksa setiap pembacanya
-- menangani "null berarti baru" berulang-ulang.
--
-- Indeks (status, created_at desc) untuk tampilan yang disaring per status --
-- pola baca dasbornya persis itu.
--
-- Jalankan: SUPABASE_DB_PASSWORD=... node run-sql.js ../sql/2026-09-07_talent_pool_status.sql

alter table public.crew_applicants
  add column if not exists status text not null default 'baru';

alter table public.crew_applicants
  drop constraint if exists crew_applicants_status_check;

alter table public.crew_applicants
  add constraint crew_applicants_status_check
  check (status in ('baru', 'dihubungi', 'siap', 'tidak_cocok'));

create index if not exists crew_applicants_status_idx
  on public.crew_applicants (status, created_at desc);

comment on column public.crew_applicants.status is
  'Penanganan pelamar: baru | dihubungi | siap | tidak_cocok. Diubah dari dash.pabrikenangan.my.id.';
