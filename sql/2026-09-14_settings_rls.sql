-- Kunci client_settings & device_settings.
--
-- Ditemukan 2026-09-14: kedua tabel TIDAK memakai RLS, sementara role anon
-- dan authenticated memegang INSERT/UPDATE/DELETE. Anon key ada di bundel
-- JavaScript dasbor yang publik, jadi siapa pun bisa mengubah harga sesi,
-- metode bayar, voucher, dan durasi booth mana pun tanpa login.
--
-- Siapa yang memakai tabel ini:
--   * backend (utils/settings.js) — service role, TIDAK terpengaruh RLS;
--   * dasbor Settings (durasi) dan Frames (harga default) — peramban admin
--     yang login (authenticated).
-- Tidak ada yang membacanya lewat anon, jadi anon ditutup total.
--
-- Pola policy sama dengan frame_categories (sql/2026-09-09_frame_categories.sql).

alter table public.client_settings enable row level security;
alter table public.device_settings enable row level security;

revoke all on public.client_settings from anon;
revoke all on public.device_settings from anon;

drop policy if exists client_settings_admin on public.client_settings;
create policy client_settings_admin
  on public.client_settings for all
  to authenticated
  using (
    exists (
      select 1 from public.admin_users a
       where a.id = auth.uid()
         and a.is_active
         and (a.role = 'super_admin' or a.client_id = client_settings.client_id)
    )
  )
  with check (
    exists (
      select 1 from public.admin_users a
       where a.id = auth.uid()
         and a.is_active
         and (a.role = 'super_admin' or a.client_id = client_settings.client_id)
    )
  );

drop policy if exists device_settings_admin on public.device_settings;
create policy device_settings_admin
  on public.device_settings for all
  to authenticated
  using (
    exists (
      select 1 from public.admin_users a
        join public.devices d on d.id = device_settings.device_id
       where a.id = auth.uid()
         and a.is_active
         and (a.role = 'super_admin' or a.client_id = d.client_id)
    )
  )
  with check (
    exists (
      select 1 from public.admin_users a
        join public.devices d on d.id = device_settings.device_id
       where a.id = auth.uid()
         and a.is_active
         and (a.role = 'super_admin' or a.client_id = d.client_id)
    )
  );
