-- =====================================================================
--  Mapa Mental — banco de dados no Supabase
--  Cole este arquivo inteiro no "SQL Editor" do seu projeto e clique em "Run".
--  Pode rodar de novo sem problemas (é idempotente).
--
--  Papéis por mapa:  owner (dono) · editor · commenter (comenta) · viewer (só vê)
--  Toda tabela tem RLS: cada pessoa só lê/escreve o que o seu papel permite.
-- =====================================================================

-- ---------------------------------------------------------------- tabelas
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.maps (
  id text primary key check (char_length(id) between 4 and 64),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'Mapa sem nome' check (char_length(name) <= 120),
  data jsonb not null default '{"nodes":[],"wires":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create index if not exists maps_owner_idx on public.maps(owner);

create table if not exists public.map_members (
  map_id text not null references public.maps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer', 'commenter', 'editor')),
  added_at timestamptz not null default now(),
  primary key (map_id, user_id)
);
create index if not exists map_members_user_idx on public.map_members(user_id);

create table if not exists public.map_links (
  token text primary key default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  map_id text not null references public.maps(id) on delete cascade,
  role text not null check (role in ('viewer', 'commenter', 'editor')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked boolean not null default false
);
create index if not exists map_links_map_idx on public.map_links(map_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  map_id text not null references public.maps(id) on delete cascade,
  node_id text,
  author uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  mentions uuid[] not null default '{}',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_map_idx on public.comments(map_id);
create index if not exists comments_mentions_idx on public.comments using gin(mentions);

-- ---------------------------------------------------------------- funções auxiliares
-- Papel da pessoa logada num mapa: 'owner' | 'editor' | 'commenter' | 'viewer' | null
create or replace function public.map_role(m text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from maps where id = m and owner = auth.uid()) then 'owner'
    else (select role from map_members where map_id = m and user_id = auth.uid())
  end
$$;

create or replace function public.role_rank(r text) returns int
language sql immutable as $$
  select case r when 'owner' then 4 when 'editor' then 3 when 'commenter' then 2 when 'viewer' then 1 else 0 end
$$;

-- O dono de um mapa nunca muda (nem um editor consegue trocar)
create or replace function public.keep_map_owner() returns trigger
language plpgsql as $$
begin
  new.owner := old.owner;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists maps_keep_owner on public.maps;
create trigger maps_keep_owner before update on public.maps
  for each row execute function public.keep_map_owner();

-- Comentário: autor, mapa e objeto não podem ser trocados depois
create or replace function public.keep_comment_identity() returns trigger
language plpgsql as $$
begin
  new.author := old.author;
  new.map_id := old.map_id;
  new.node_id := old.node_id;
  new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists comments_keep_identity on public.comments;
create trigger comments_keep_identity before update on public.comments
  for each row execute function public.keep_comment_identity();

-- Perfil criado automaticamente no cadastro (nome = parte do e-mail antes do @)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(nullif(split_part(new.email, '@', 1), ''), 'Pessoa'))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Entrar num mapa por link: vira membro com o papel do link (nunca rebaixa quem já tem mais)
create or replace function public.join_map_by_link(link_token text) returns text
language plpgsql security definer set search_path = public as $$
declare l map_links;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta primeiro'; end if;
  select * into l from map_links where token = link_token and not revoked;
  if not found then raise exception 'Link inválido ou desativado'; end if;
  if exists (select 1 from maps where id = l.map_id and owner = auth.uid()) then return l.map_id; end if;
  insert into map_members (map_id, user_id, role) values (l.map_id, auth.uid(), l.role)
  on conflict (map_id, user_id) do update
    set role = case when role_rank(excluded.role) > role_rank(map_members.role) then excluded.role else map_members.role end;
  return l.map_id;
end $$;

-- Pessoas de um mapa (dono + membros) com nome de exibição — para a lista e as @menções
create or replace function public.map_people(m text)
returns table (user_id uuid, display_name text, role text)
language sql stable security definer set search_path = public as $$
  select x.uid, coalesce(p.display_name, ''), x.role
  from (
    select owner as uid, 'owner'::text as role from maps where id = m
    union all
    select user_id, role from map_members where map_id = m
  ) x
  left join profiles p on p.id = x.uid
  where public.map_role(m) is not null
$$;

grant execute on function public.map_role(text) to authenticated;
grant execute on function public.join_map_by_link(text) to authenticated;
grant execute on function public.map_people(text) to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.profiles    enable row level security;
alter table public.maps        enable row level security;
alter table public.map_members enable row level security;
alter table public.map_links   enable row level security;
alter table public.comments    enable row level security;

drop policy if exists "perfil: ver o próprio" on public.profiles;
create policy "perfil: ver o próprio" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "perfil: criar o próprio" on public.profiles;
create policy "perfil: criar o próprio" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "perfil: editar o próprio" on public.profiles;
create policy "perfil: editar o próprio" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "mapa: ver" on public.maps;
-- "owner = auth.uid()" é necessário: ao criar o mapa (upsert), map_role() ainda não enxerga a linha nova
create policy "mapa: ver" on public.maps for select to authenticated using (owner = auth.uid() or public.map_role(id) is not null);
drop policy if exists "mapa: criar" on public.maps;
create policy "mapa: criar" on public.maps for insert to authenticated with check (owner = auth.uid());
drop policy if exists "mapa: editar" on public.maps;
create policy "mapa: editar" on public.maps for update to authenticated
  using (public.map_role(id) in ('owner', 'editor')) with check (public.map_role(id) in ('owner', 'editor'));
drop policy if exists "mapa: excluir" on public.maps;
create policy "mapa: excluir" on public.maps for delete to authenticated using (owner = auth.uid());

drop policy if exists "membros: ver" on public.map_members;
create policy "membros: ver" on public.map_members for select to authenticated
  using (user_id = auth.uid() or public.map_role(map_id) is not null);
drop policy if exists "membros: dono adiciona" on public.map_members;
create policy "membros: dono adiciona" on public.map_members for insert to authenticated
  with check (public.map_role(map_id) = 'owner');
drop policy if exists "membros: dono altera" on public.map_members;
create policy "membros: dono altera" on public.map_members for update to authenticated
  using (public.map_role(map_id) = 'owner') with check (public.map_role(map_id) = 'owner');
drop policy if exists "membros: dono remove ou a pessoa sai" on public.map_members;
create policy "membros: dono remove ou a pessoa sai" on public.map_members for delete to authenticated
  using (public.map_role(map_id) = 'owner' or user_id = auth.uid());

drop policy if exists "links: dono gerencia" on public.map_links;
create policy "links: dono gerencia" on public.map_links for all to authenticated
  using (public.map_role(map_id) = 'owner') with check (public.map_role(map_id) = 'owner' and created_by = auth.uid());

drop policy if exists "comentários: ver" on public.comments;
create policy "comentários: ver" on public.comments for select to authenticated using (public.map_role(map_id) is not null);
drop policy if exists "comentários: criar" on public.comments;
create policy "comentários: criar" on public.comments for insert to authenticated
  with check (author = auth.uid() and public.map_role(map_id) in ('owner', 'editor', 'commenter'));
drop policy if exists "comentários: resolver" on public.comments;
create policy "comentários: resolver" on public.comments for update to authenticated
  using (author = auth.uid() or public.map_role(map_id) in ('owner', 'editor'))
  with check (author = auth.uid() or public.map_role(map_id) in ('owner', 'editor'));
drop policy if exists "comentários: excluir" on public.comments;
create policy "comentários: excluir" on public.comments for delete to authenticated
  using (author = auth.uid() or public.map_role(map_id) = 'owner');

-- ---------------------------------------------------------------- tempo real
-- Comentários chegam na hora para quem está com o mapa aberto
do $$ begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null; end $$;

-- Canais privados "map:<id>": só membros entram.
-- Presença (cursores) para qualquer membro; edições (broadcast) só para dono e editores.
drop policy if exists "canal do mapa: receber" on realtime.messages;
create policy "canal do mapa: receber" on realtime.messages for select to authenticated
  using (public.map_role(split_part(realtime.topic(), ':', 2)) is not null);
drop policy if exists "canal do mapa: enviar" on realtime.messages;
create policy "canal do mapa: enviar" on realtime.messages for insert to authenticated
  with check (
    (realtime.messages.extension = 'presence' and public.map_role(split_part(realtime.topic(), ':', 2)) is not null)
    or (realtime.messages.extension = 'broadcast' and public.map_role(split_part(realtime.topic(), ':', 2)) in ('owner', 'editor'))
  );
