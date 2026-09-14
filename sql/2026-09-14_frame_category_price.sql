-- Harga sesi per kategori frame.
--
-- NULL = kategori ini tidak punya harga sendiri dan memakai session_price
-- dari setelan (DEFAULT <- client_settings <- device_settings). Kolom sengaja
-- nullable: semua kategori yang sudah ada tetap berharga persis seperti
-- sebelum migrasi ini, dan frame tanpa kategori ("Lainnya") juga selalu
-- memakai harga setelan.
--
-- Kalau diisi, harga kategori MENIMPA session_price milik unit sekalipun —
-- frame yang sama tidak boleh berharga beda di dua booth tanpa operator
-- sadar. Harga dihitung server (backend/src/utils/harga-sesi.js), tidak
-- pernah dipercaya dari alat.
--
-- Wajib dijalankan SEBELUM backend yang membaca kolom ini di-deploy:
-- /api/frames memilih session_price dari tabel ini.

alter table public.frame_categories
  add column if not exists session_price integer;

alter table public.frame_categories
  drop constraint if exists frame_categories_session_price_check;

-- Nol ditolak: sesi QRIS berharga 0 ditolak DOKU di depan pelanggan. Sesi
-- gratis tetap lewat voucher.
alter table public.frame_categories
  add constraint frame_categories_session_price_check
  check (session_price is null or session_price > 0);

comment on column public.frame_categories.session_price is
  'Harga sesi (Rp) untuk frame di kategori ini; NULL = pakai session_price dari setelan. Menimpa device_settings.';
