-- Tiket antrean yang menyeberangi pergantian hari harus kedaluwarsa.
--
-- BUG YANG DIPERBAIKI (ditemukan 2026-08-31)
-- queue_date hanya dipakai MENYARING papan antrean, tapi tidak ada apa pun
-- yang menutup tiket hari sebelumnya. Akibatnya tiket kemarin tetap berstatus
-- 'waiting' selamanya, dan:
--
--   1. HP pengunjung yang masih menyimpan tiket itu merendernya sebagai
--      antrean aktif — lengkap dengan nomor besar — padahal mode antrean
--      sudah mati dan posisinya null. Inilah gejala yang terlihat: "antrean
--      dimatikan tapi masih bisa mengantre".
--   2. Kode klaimnya ikut terkunci selamanya oleh indeks unik parsial.
--   3. Tiket itu tidak akan pernah bisa dipanggil, karena panggilBerikutnya
--      hanya membaca papan hari ini. Pengunjungnya menunggu selamanya.
--
-- Status 'expired' dipilih alih-alih memakai ulang 'left' atau 'skipped':
-- keduanya menuduh pihak yang salah — 'left' berarti pengunjung membatalkan
-- sendiri, 'skipped' berarti operator melewatinya. Yang terjadi di sini bukan
-- keduanya, dan dasbor harus bisa membedakannya saat menelusuri keluhan.
--
-- Jalankan: SUPABASE_DB_PASSWORD=... node run-sql.js ../sql/2026-08-31_queue_expired.sql

alter table public.queue_tickets
  drop constraint if exists queue_tickets_status_check;

alter table public.queue_tickets
  add constraint queue_tickets_status_check
  check (status in ('waiting', 'called', 'serving', 'done', 'skipped', 'left', 'expired'));

-- Bereskan tiket basi yang sudah terlanjur menggantung.
update public.queue_tickets
   set status = 'expired',
       closed_at = coalesce(closed_at, now())
 where status in ('waiting', 'called', 'serving')
   and queue_date < (now() at time zone 'Asia/Jakarta')::date;
