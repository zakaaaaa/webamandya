-- 2026-09-29 — Jenis voucher: CASH vs TEST
--
-- cash : pelanggan membayar TUNAI penuh ke operator, operator memasukkan
--        kodenya di kios. Sesi jadi payment_status 'paid', payment_method
--        'cash', amount = harga penuh → masuk pendapatan dasbor.
-- test : perilaku lama. 'full' menggratiskan (free, Rp0), potongan Rp/persen
--        menyisakan tagihan QRIS. Bagian yang digratiskan bukan pendapatan.
--
-- Logika pemakaiannya: hasilVoucher() di backend/src/utils/frame-categories.js.
-- Urutan deploy: SQL ini → backend → frontend (form voucher mengirim kolom kind).

begin;

alter table public.vouchers
  add column if not exists kind text not null default 'test';

alter table public.vouchers
  drop constraint if exists vouchers_kind_check;
alter table public.vouchers
  add constraint vouchers_kind_check check (kind in ('cash', 'test'));

-- Metode pembayaran baru di sessions:
--   cash        — voucher jenis cash (di atas)
--   qris_manual — QRIS statis saat sinyal buruk, dikonfirmasi operator
--                 (POST /api/payment/manual, live sejak 29 Sep 15.27 WIB —
--                  sebelum migrasi ini update-nya ditolak constraint lama)
alter table public.sessions
  drop constraint if exists sessions_payment_method_check;
alter table public.sessions
  add constraint sessions_payment_method_check
  check (payment_method = any (array['qris', 'qris_manual', 'cash', 'voucher', 'bypass', 'free']));

comment on column public.vouchers.kind is
  'cash = bayar tunai penuh ke operator (sesi paid, masuk pendapatan); test = gratis/potongan (bukan pendapatan)';

-- Permintaan pemilik 29 Sep 2026: semua voucher Pabrik Kenangan yang sudah ada
-- = cash (8 kode, termasuk D8GWC6TZ). Voucher klien lain tetap 'test'.
update public.vouchers set kind = 'cash'
where client_id = '8b7e2163-239b-4267-8f8a-f088ee3541a5';

-- Hitung ulang sesi voucher cash sejak 28 Sep 2026 18.00 WIB (kode D8GWC6TZ).
-- Dua sesi sore itu (17.27 & 17.37 WIB) adalah tes, jadi TIDAK diubah.
-- paid_at sudah terisi saat voucher dipakai; hanya status, metode, dan nominal.
update public.sessions
set payment_status = 'paid',
    payment_method = 'cash',
    amount         = original_amount
where transaction_code in (
        'sesi-1790603906075',  -- 28 Sep 20.58 WIB, Rp20.000
        'sesi-1790605495010',  -- 28 Sep 21.24 WIB, Rp20.000
        'sesi-1790606897097'   -- 28 Sep 21.48 WIB, Rp20.000
      )
  and payment_status = 'free'
  and payment_method = 'voucher';

-- Pemeriksaan: harus 3 baris cash Rp20.000; voucher: 8 cash, 7 test.
select transaction_code, payment_status, payment_method, amount, original_amount
from public.sessions
where transaction_code in ('sesi-1790603906075', 'sesi-1790605495010', 'sesi-1790606897097');

select kind, count(*) from public.vouchers group by kind;

commit;
