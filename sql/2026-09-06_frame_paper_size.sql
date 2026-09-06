-- Ukuran kertas cetak melekat pada FRAME, bukan pada perangkat.
--
-- Sebelumnya ukuran kertas hanya ada di device_settings.paper_size, satu nilai
-- untuk seluruh perangkat. Akibatnya template A4 (mis. koran) tercetak sebesar
-- 4R di tengah lembar A4 sampai operator ingat mengubah setting perangkat —
-- dan setting itu harus dibalik lagi untuk strip foto biasa.
--
-- Catatan penting: kolom ini TIDAK menyetel driver printer. Di Windows ukuran
-- halaman selalu milik default driver (package:printing mengirim dm = nullptr
-- saat usePrinterSettings:true). Kolom ini yang dipakai app untuk MEMERIKSA
-- profil driver sebelum job dikirim, dan untuk membangun halaman PDF-nya.

alter table public.frames
  add column if not exists paper_size text not null default '4R';

alter table public.frames
  drop constraint if exists frames_paper_size_check;

alter table public.frames
  add constraint frames_paper_size_check
  check (paper_size in ('4R', 'A5', 'A4'));

-- Isi awal untuk frame yang sudah ada, dari preset ukuran output yang dipakai
-- dashboard (SIZE_PRESETS di FramesManager.tsx). Hanya kecocokan persis yang
-- diubah; ukuran custom sengaja dibiarkan di 4R supaya tidak ada frame yang
-- diam-diam pindah kertas.
update public.frames
   set paper_size = 'A4'
 where output_width = 2480 and output_height = 3508;

update public.frames
   set paper_size = 'A5'
 where output_width = 1748 and output_height = 2480;

comment on column public.frames.paper_size is
  'Kertas cetak untuk frame ini: 4R | A5 | A4. Dibaca app lewat GET /api/frames.';
