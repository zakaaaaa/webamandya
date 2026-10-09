-- Template "Story IG" untuk halaman unduh + cache hasil render.
--
-- story_templates: dibuat/diubah admin dari dasbor (menu Template Story).
--   slots = [{ isi, x, y, w, h, rot, bingkai, warna_bingkai }] di kanvas
--   1080x1920; lihat backend/src/utils/story-render.js.
--   jenis 'strip2' hanya ditawarkan untuk frame 4R berisi dua strip (bisa
--   dibelah); 'umum' untuk semua sesi.
-- story_renders: satu baris per (sesi, template, versi template) yang pernah
--   dirender — cache sekaligus statistik pemakaian (dibagikan/disimpan).
--
-- Backend memakai service role (tidak terpengaruh RLS). Dasbor menulis
-- story_templates sebagai admin login; pola policy sama dengan
-- frame_categories. story_renders tidak dibuka untuk anon sama sekali.

create table if not exists public.story_templates (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  nama          text not null,
  jenis         text not null default 'strip2' check (jenis in ('strip2', 'umum')),
  latar_url     text not null,
  stiker_url    text,
  pratinjau_url text,
  slots         jsonb not null default '[]'::jsonb,
  is_active     boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists story_templates_client_idx
  on public.story_templates (client_id, is_active, sort_order);

-- Versi template = updated_at; setiap perubahan otomatis membatalkan cache.
create or replace function public.story_templates_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists story_templates_touch on public.story_templates;
create trigger story_templates_touch
  before update on public.story_templates
  for each row execute function public.story_templates_touch();

create table if not exists public.story_renders (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.sessions(id) on delete cascade,
  template_id    uuid not null references public.story_templates(id) on delete cascade,
  template_versi text not null,
  url            text not null,
  jenis          text not null check (jenis in ('video', 'gambar')),
  render_ms      integer,
  dibagikan      integer not null default 0,
  disimpan       integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists story_renders_cache_idx
  on public.story_renders (session_id, template_id, template_versi);
create index if not exists story_renders_template_idx
  on public.story_renders (template_id, created_at);

alter table public.story_templates enable row level security;
alter table public.story_renders enable row level security;

revoke all on public.story_templates from anon;
revoke all on public.story_renders from anon;

drop policy if exists story_templates_admin on public.story_templates;
create policy story_templates_admin
  on public.story_templates for all
  to authenticated
  using (
    exists (
      select 1 from public.admin_users a
       where a.id = auth.uid()
         and a.is_active
         and (a.role = 'super_admin' or a.client_id = story_templates.client_id)
    )
  )
  with check (
    exists (
      select 1 from public.admin_users a
       where a.id = auth.uid()
         and a.is_active
         and (a.role = 'super_admin' or a.client_id = story_templates.client_id)
    )
  );

-- Admin boleh membaca statistik render template miliknya.
drop policy if exists story_renders_admin_read on public.story_renders;
create policy story_renders_admin_read
  on public.story_renders for select
  to authenticated
  using (
    exists (
      select 1 from public.story_templates t
        join public.admin_users a on a.id = auth.uid()
       where t.id = story_renders.template_id
         and a.is_active
         and (a.role = 'super_admin' or a.client_id = t.client_id)
    )
  );
