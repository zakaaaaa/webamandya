-- Satu baris sesi per pelanggan; tiap percobaan bayar QRIS jadi satu invoice.
--
-- KENAPA PERLU
-- Dulu kiosk membuat DUA baris sesi per pelanggan: satu saat memilih frame
-- (tempat foto diunggah) dan satu lagi di halaman bayar, karena
-- invoice_number DOKU = transaction_code dan invoice yang sama tidak boleh
-- dipakai dua kali (tombol "Coba Lagi" wajib membuat order baru). Baris frame
-- tidak pernah dikirim ke DOKU sehingga mengendap 'pending' selamanya — audit
-- 2026-09-14: 29 baris pending pada 13 Sep, semuanya 404 di DOKU, dan jumlah
-- sesi di dasbor hampir dua kali lipat.
--
-- Sekarang nomor invoice DOKU dibuat server per percobaan
-- (<transaction_code>-p<waktu base36>) dan dicatat di sini, jadi baris sesi
-- tetap satu. Tabel ini juga membuat pembayaran ke QR LAMA (pelanggan
-- memindai QR sebelum menekan "Coba Lagi") tetap terdeteksi: semua invoice
-- yang masih 'pending' ditanyakan ke DOKU, bukan hanya yang terakhir.
--
-- status invoice:
--   pending  order dibuat (atau sedang dibuat) dan belum terbukti selesai
--   paid     DOKU menyatakan transaction.status = SUCCESS
--   expired  order kedaluwarsa, atau DOKU menjawab 404 untuk invoice yang
--            sudah cukup tua (order memang tidak pernah terbentuk)
--   failed   DOKU menolak pembuatan order (4xx), atau transaksi FAILED

create table if not exists public.payment_invoices (
  invoice_number text primary key,
  session_id     uuid not null references public.sessions(id) on delete cascade,
  amount         integer not null,
  status         text not null default 'pending',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint payment_invoices_status_check
    check (status in ('pending', 'paid', 'expired', 'failed'))
);

create index if not exists idx_payment_invoices_session
  on public.payment_invoices (session_id);

-- Hanya backend (service role) yang boleh membaca/menulis. Tanpa policy apa
-- pun, anon dan authenticated tidak mendapat akses sama sekali.
alter table public.payment_invoices enable row level security;

-- Penyapu sesi basi (backend/src/workers/penyapu-sesi.js) mencari baris
-- pending yang lama tidak berubah setiap 10 menit.
create index if not exists idx_sessions_pending_updated
  on public.sessions (updated_at)
  where payment_status = 'pending';

comment on table public.payment_invoices is
  'Satu baris per percobaan bayar DOKU. invoice_number = <sessions.transaction_code>-p<base36 ms>.';
