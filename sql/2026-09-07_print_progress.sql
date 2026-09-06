-- Progres CETAK di halaman unduh pelanggan.
--
-- KENAPA PERLU
-- Cetak 4R di EPSON L3210 memakan menit-menitan (terukur 2026-09-06: satu
-- lembar bertahan 4 menit 30 detik di antrian spooler). Selama itu pelanggan
-- berdiri di depan printer tanpa tahu apa-apa, karena app hanya bilang
-- "Terkirim ke printer" lalu diam. Kolom-kolom ini membuat halaman unduh —
-- yang toh sudah dibuka pelanggan di HP-nya — bisa menampilkan sampai mana
-- cetakannya dan memberi tahu saat selesai.
--
-- APA YANG SEBENARNYA DIUKUR (ini penting untuk siapa pun yang membaca
-- datanya nanti, supaya tidak salah menyimpulkan)
-- Sumbernya adalah antrian spooler Windows, bukan sensor di printer:
--   * L3210 EnableBIDI = True, port USB001 lewat Dynamic Print Monitor,
--     dan KeepPrintedJobs = False — job hilang dari antrian setelah datanya
--     benar-benar habis diterima printer, bukan setelah selesai di-spool.
--     Buktinya durasi 4,5 menit itu: job 48 KB yang cuma dibuang ke USB akan
--     lenyap dalam milidetik.
--   * `PagesPrinted` TIDAK bergerak untuk job satu halaman (tetap 0/1 sampai
--     job hilang). Jadi print_sheets_done dihitung per LEMBAR dari jumlah job
--     yang tersisa di antrian; tidak ada persentase cetak yang sungguhan.
--   * print_status = 'done' berarti data cetakan sudah habis diterima
--     printer. Kertas fisik keluar beberapa detik setelahnya. Kalimat di UI
--     harus "hampir selesai / silakan ambil", bukan klaim detik-detikan.
--
-- print_eta_seconds dikirim DARI APP, bukan dihitung di sini: hanya app yang
-- tahu ukuran kertas frame yang dipilih dan berapa lembar yang dicetak.

alter table public.sessions
  add column if not exists print_status       text,
  add column if not exists print_sheets_done  integer not null default 0,
  add column if not exists print_sheets_total integer not null default 0,
  add column if not exists print_eta_seconds  integer,
  add column if not exists print_reason       text,
  add column if not exists print_started_at   timestamptz,
  add column if not exists print_finished_at  timestamptz;

alter table public.sessions
  drop constraint if exists sessions_print_status_check;

-- null = sesi ini memang tidak mencetak (mis. hanya unduh digital), dan
-- halaman unduh menyembunyikan kartu cetaknya. Sengaja dibedakan dari
-- 'queued' supaya "belum mulai" tidak tertukar dengan "tidak dicetak".
alter table public.sessions
  add constraint sessions_print_status_check
  check (print_status is null
         or print_status in ('queued', 'printing', 'done', 'stuck', 'failed'));

comment on column public.sessions.print_status is
  'Progres cetak dari spooler Windows: queued | printing | done | stuck | failed. null = sesi tidak mencetak.';
comment on column public.sessions.print_sheets_done is
  'Lembar yang sudah lepas dari antrian printer. Per lembar, bukan persentase — PagesPrinted tidak bergerak untuk job 1 halaman.';
comment on column public.sessions.print_eta_seconds is
  'Perkiraan TOTAL detik untuk seluruh lembar, dikirim app (PrintJobWatcher.etaSecondsPerSheet). 0 saat selesai.';
comment on column public.sessions.print_started_at is
  'Saat app melapor progres cetak pertama kali. Bersama print_finished_at inilah bahan kalibrasi ETA per ukuran kertas.';

-- Halaman unduh menanyakan status tiap 4 detik selagi mencetak. Tanpa indeks
-- ini setiap tanya jadi scan penuh tabel sessions.
create index if not exists idx_sessions_print_status
  on public.sessions (print_status)
  where print_status in ('queued', 'printing');
