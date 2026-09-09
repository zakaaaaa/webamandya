-- Kategori frame, diisi manual dari dasbor.
--
-- Sebelumnya kios menampilkan SELURUH frame aktif klien dalam satu strip
-- horizontal. Dengan 11 frame aktif dan tiga di antaranya bernama "grad",
-- pelanggan tidak punya cara membedakan apa pun kecuali menggeser satu per
-- satu — dan itu terjadi tepat sebelum timer sesi dimulai.
--
-- Kategorinya sengaja TABEL TERSENDIRI, bukan kolom teks di frames:
--   * kolom teks bebas langsung kena "Wisuda" vs "wisuda" dan tidak bisa
--     diurutkan sesuai keinginan operator;
--   * mengganti nama kategori jadi UPDATE massal ke semua baris frames;
--   * kategori perlu bisa dinonaktifkan sendiri (mis. kategori kertas A4
--     saat kertas A4 sedang tidak terpasang) tanpa menyentuh frame-nya.

create table if not exists public.frame_categories (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  name       text not null,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Nama unik per klien, tanpa peduli besar-kecil huruf. Ini satu-satunya
-- penjaga dari "Wisuda"/"wisuda" yang muncul sebagai dua chip di kios.
create unique index if not exists frame_categories_client_name_key
  on public.frame_categories (client_id, lower(name));

create index if not exists frame_categories_client_idx
  on public.frame_categories (client_id, sort_order);

-- NULLABLE dengan sengaja: 12 frame yang sudah ada tidak perlu langsung
-- dikategorikan, dan frame yang belum dikategorikan HARUS tetap muncul di
-- kios. Migrasi yang membuat frame hilang dari layar karena operator lupa
-- mengisi satu kolom adalah kegagalan yang jauh lebih mahal daripada daftar
-- yang belum rapi.
alter table public.frames
  add column if not exists category_id uuid
  references public.frame_categories(id) on delete set null;

-- on delete set null di atas: menghapus kategori TIDAK BOLEH ikut menghapus
-- frame-nya. Frame kembali ke kelompok "Lainnya", operator memindahkannya.

create index if not exists frames_category_idx
  on public.frames (category_id);

comment on table public.frame_categories is
  'Kategori frame per klien, dikelola manual dari dasbor. Dibaca kios lewat GET /api/frames dan HP antrean lewat GET /api/queue/:slug/frames.';
comment on column public.frames.category_id is
  'Kategori frame; NULL = belum dikategorikan, tetap tampil di kios pada kelompok "Lainnya".';

-- RLS: baca boleh siapa saja (tabel frames pun sudah terbaca anon), tulis
-- hanya untuk admin yang login DAN memang memegang klien itu. Ini lebih ketat
-- daripada tabel frames yang ada sekarang; jangan disamakan dengan menyalin
-- kelonggarannya.
alter table public.frame_categories enable row level security;

drop policy if exists frame_categories_read  on public.frame_categories;
drop policy if exists frame_categories_write on public.frame_categories;

create policy frame_categories_read
  on public.frame_categories for select
  using (true);

create policy frame_categories_write
  on public.frame_categories for all
  to authenticated
  using (
    exists (
      select 1 from public.admin_users a
       where a.id = auth.uid()
         and a.is_active
         and (a.role = 'super_admin' or a.client_id = frame_categories.client_id)
    )
  )
  with check (
    exists (
      select 1 from public.admin_users a
       where a.id = auth.uid()
         and a.is_active
         and (a.role = 'super_admin' or a.client_id = frame_categories.client_id)
    )
  );
