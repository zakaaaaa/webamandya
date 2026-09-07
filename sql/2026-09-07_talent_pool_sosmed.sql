-- Talent pool: tambah kolom media sosial.
--
-- Migrasi terpisah, bukan suntingan pada 2026-09-07_talent_pool.sql, karena
-- berkas itu sudah dijalankan ke Supabase. Mengubahnya di tempat membuat
-- berkas SQL di repo tidak lagi menggambarkan urutan yang benar-benar terjadi
-- di database.
--
-- Kolom ini SENGAJA nullable dan tanpa unique:
--   - nullable, karena tidak semua calon crew punya (atau mau memberi) akun
--     media sosial. Mewajibkannya berarti membuang pelamar yang justru sudah
--     bersedia memberi nomor WA-nya.
--   - tanpa unique, karena satu akun dipakai bersama itu wajar (mis. akun
--     kolektif fotografi), dan nomor WA sudah menjadi kunci pembeda.
--
-- Isinya disimpan APA ADANYA seperti yang diketik, hanya dirapikan spasinya.
-- Tidak ada normalisasi seperti pada kolom phone: "@nama", "instagram.com/nama"
-- dan tautan TikTok tidak bisa disatukan tanpa menebak platform-nya, dan tebakan
-- yang salah justru merusak data yang sudah benar.
--
-- Jalankan: SUPABASE_DB_PASSWORD=... node run-sql.js ../sql/2026-09-07_talent_pool_sosmed.sql

alter table public.crew_applicants
  add column if not exists social text;

comment on column public.crew_applicants.social is
  'Instagram atau media sosial lain, opsional. Disimpan apa adanya seperti yang diketik pendaftar (bisa @username, bisa tautan penuh).';
