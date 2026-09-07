-- Estimasi tunggu yang bisa dijelaskan, dan antrean fisik yang tidak bertiket.
--
-- Dua hal yang tidak bisa diturunkan dari data yang sudah ada:
--
-- 1. Orang yang sudah berdiri antre SEBELUM mode antrean dinyalakan tidak
--    pernah scan QR, jadi tidak punya baris di queue_tickets. Tanpa
--    hitungannya, pemegang tiket pertama melihat estimasi yang jauh terlalu
--    pendek, lalu datang ke booth dan menemukan masih ada orang di depannya.
--
-- 2. Sisa waktu sesi yang sedang berjalan hanya diketahui oleh timer di
--    aplikasi kiosk. Server sebelumnya menebaknya dari selisih waktu mulai,
--    padahal sesi bisa dijeda atau berjalan lebih lama dari durasi setelan.

alter table public.device_queue_state
  -- Jumlah orang di barisan fisik yang belum bertiket, TERMASUK yang sedang
  -- berfoto saat ini. Menghitung yang di booth sekaligus di sini membuat
  -- angkanya bisa dikurangi di satu tempat saja (saat sesi selesai) alih-alih
  -- butuh sinyal terpisah saat sesi walk-in dimulai.
  add column if not exists walkin_ahead integer not null default 0,

  -- Laporan terakhir dari timer aplikasi kiosk. Dipakai apa adanya, bukan
  -- ditebak ulang dari waktu mulai.
  add column if not exists sesi_sisa_detik integer,
  add column if not exists sesi_sisa_at    timestamptz;

alter table public.device_queue_state
  drop constraint if exists device_queue_state_walkin_ahead_check;

alter table public.device_queue_state
  add constraint device_queue_state_walkin_ahead_check
  check (walkin_ahead >= 0 and walkin_ahead <= 30);

-- operator_pin tidak lagi dipakai: panel operator sekarang dibuka lewat tombol
-- di dashboard tanpa kredensial terpisah. Kolomnya SENGAJA tidak di-drop —
-- membuangnya membuat perubahan ini tidak bisa dibalik cepat kalau di lapangan
-- ternyata panel terbuka itu bermasalah.
comment on column public.device_queue_state.operator_pin is
  'Tidak dipakai sejak 2026-09-07. Panel operator dibuka dari dashboard tanpa PIN.';
