-- Pilihan kertas bookpaper untuk frame newspaper A4.
--
-- frames.bookpaper_price: NULL = frame ini tidak menawarkan pilihan kertas
-- (semua frame yang sudah ada). Kalau diisi, kios menanyakan pelanggan
-- "Kertas foto glossy" (harga kategori) atau "Bookpaper" (harga ini), dan
-- app mengganti profil driver printer sesuai pilihannya.
--
-- sessions.paper_type: kertas yang dipilih pelanggan untuk sesi itu. Disimpan
-- supaya jalur yang tidak membawa pilihan kertas (voucher) tetap menagih
-- harga yang benar. NULL = frame tanpa pilihan kertas.
--
-- Harga dihitung server (backend/src/utils/harga-sesi.js), tidak pernah
-- dipercaya dari alat. Wajib dijalankan SEBELUM backend yang membaca kolom
-- ini di-deploy: /api/frames dan KOLOM_SESI memilih kolom-kolom ini.

alter table public.frames
  add column if not exists bookpaper_price integer;

alter table public.frames
  drop constraint if exists frames_bookpaper_price_check;

-- Nol ditolak: sesi QRIS berharga 0 ditolak DOKU di depan pelanggan.
alter table public.frames
  add constraint frames_bookpaper_price_check
  check (bookpaper_price is null or bookpaper_price > 0);

comment on column public.frames.bookpaper_price is
  'Harga sesi (Rp) kalau pelanggan memilih kertas bookpaper; NULL = frame tanpa pilihan kertas.';

alter table public.sessions
  add column if not exists paper_type text;

alter table public.sessions
  drop constraint if exists sessions_paper_type_check;

alter table public.sessions
  add constraint sessions_paper_type_check
  check (paper_type is null or paper_type in ('glossy', 'bookpaper'));

comment on column public.sessions.paper_type is
  'Kertas pilihan pelanggan: glossy | bookpaper; NULL = frame tanpa pilihan kertas.';

-- Frame A4 di kategori Newspaper: bookpaper Rp20.000.
update public.frames f
   set bookpaper_price = 20000
  from public.frame_categories c
 where f.category_id = c.id
   and c.name ilike 'newspaper'
   and f.paper_size = 'A4';
