-- Tabel pengaduan pelanggan (halaman unduh /download/<kode>).
--
-- Dipakai saat pelanggan melapor "foto saya belum muncul". Isinya dibaca
-- operator lewat notifikasi Telegram, dan nanti dipakai untuk mengirim hasil
-- foto secara otomatis begitu berkasnya sampai di server.
--
-- Jalankan di Supabase → SQL Editor (project kqykaplhsutkxqxlymbq).

create table if not exists public.complaints (
  id               uuid primary key default gen_random_uuid(),

  -- Sesi yang diadukan. transaction_code disimpan terpisah supaya pengaduan
  -- tetap terbaca walau baris sesinya kelak dihapus.
  session_id       uuid references public.sessions(id) on delete set null,
  transaction_code text not null,
  client_id        uuid references public.clients(id) on delete set null,

  -- Kontak pelanggan. email wajib (tujuan pengiriman otomatis),
  -- whatsapp opsional (jalur darurat buat operator).
  email            text not null,
  whatsapp         text,

  -- foto_tidak_muncul | foto_tidak_lengkap | hasil_salah | lainnya
  reason           text not null,
  note             text,

  -- baru      : belum ditangani
  -- terkirim  : hasil sudah dikirim otomatis ke email pelanggan
  -- selesai   : ditutup manual oleh operator
  status           text not null default 'baru',
  delivered_at     timestamptz,
  delivery_error   text,

  -- Potret keadaan saat pengaduan dibuat — memudahkan operator menilai
  -- apakah berkasnya memang belum sampai server atau pelanggan yang salah lihat.
  had_result       boolean,
  photo_count      integer,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists complaints_transaction_code_idx
  on public.complaints (transaction_code);

create index if not exists complaints_created_at_idx
  on public.complaints (created_at desc);

-- Antrean kerja operator: yang belum selesai saja.
create index if not exists complaints_open_idx
  on public.complaints (status, created_at desc)
  where status <> 'selesai';

-- Tabel ini hanya boleh disentuh service role (backend VPS & route server
-- Next.js). Tanpa policy, kunci anon di browser tidak bisa membaca alamat
-- email maupun nomor WhatsApp pelanggan.
alter table public.complaints enable row level security;

comment on table public.complaints is
  'Pengaduan pelanggan dari halaman unduh; akses hanya lewat service role.';
