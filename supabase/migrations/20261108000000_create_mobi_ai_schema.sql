-- MOBI.AI 전용 스키마
--
-- 이 Supabase 프로젝트는 다른 서비스와 공유한다. 그래서 기본 정책은 "MOBI.AI 서버(service_role)만 접근"이다.
--   * anon          : 공유 서비스 브라우저에 공개된 키로 누구나 쓸 수 있는 역할 → 권한 없음
--   * authenticated : 공유 서비스 로그인 사용자도 같은 역할을 쓴다             → 권한 없음
--   * service_role  : MOBI.AI 서버의 DAL(features/*/server)만 사용            → 필요한 권한만 부여
-- 브라우저에서 직접 접근해야 하는 테이블이 생기면, 그 테이블에만 grant + RLS 정책을 명시적으로 추가한다.
--
-- 실행 방법: Supabase Dashboard → SQL Editor 에 붙여넣고 실행 (여러 번 실행해도 안전하다)
-- 실행 후:   Dashboard → Project Settings → Data API → Exposed schemas 에 mobi_ai 추가

begin;

create schema if not exists mobi_ai;

-- 스키마 USAGE 권한이 접근의 관문이다. 공유 역할에서는 명시적으로 회수한다.
revoke all on schema mobi_ai from public, anon, authenticated;
grant usage on schema mobi_ai to service_role;

-- 앞으로 만드는 객체의 기본 권한: service_role만.
-- (프로젝트 전역 기본 권한이 anon/authenticated에 테이블 권한을 주더라도, 위의 스키마 USAGE가 없어서 접근할 수 없다)
alter default privileges for role postgres in schema mobi_ai
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema mobi_ai
  grant usage, select on sequences to service_role;
alter default privileges for role postgres in schema mobi_ai
  revoke execute on functions from public;
alter default privileges for role postgres in schema mobi_ai
  grant execute on functions to service_role;

-- 공통: updated_at 자동 갱신
create or replace function mobi_ai.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- main 서비스: 항목 목록
create table if not exists mobi_ai.main_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 모든 테이블은 RLS를 켠다. 정책이 없으므로 anon/authenticated는 행을 볼 수 없고, service_role만 RLS를 우회한다.
alter table mobi_ai.main_items enable row level security;
revoke all on table mobi_ai.main_items from public, anon, authenticated;
grant select, insert, update, delete on table mobi_ai.main_items to service_role;

drop trigger if exists main_items_set_updated_at on mobi_ai.main_items;
create trigger main_items_set_updated_at
  before update on mobi_ai.main_items
  for each row execute function mobi_ai.set_updated_at();

-- 완료 상태를 원자적으로 토글 (읽고-쓰기 경쟁 방지)
create or replace function mobi_ai.toggle_main_item(item_id uuid)
returns mobi_ai.main_items
language sql
security invoker
set search_path = ''
as $$
  update mobi_ai.main_items
     set completed = not completed
   where id = item_id
  returning *;
$$;

revoke execute on function mobi_ai.set_updated_at() from public, anon, authenticated;
revoke execute on function mobi_ai.toggle_main_item(uuid) from public, anon, authenticated;
grant execute on function mobi_ai.toggle_main_item(uuid) to service_role;

-- 초기 데이터 (테이블이 비어 있을 때만)
insert into mobi_ai.main_items (title, completed, created_at)
select seed.title, seed.completed, now() + seed.position * interval '1 millisecond'
  from (values
    ('프로젝트 구조 잡기', true, 1),
    ('API 연동하기', false, 2),
    ('배포 파이프라인 구성', false, 3)
  ) as seed(title, completed, position)
 where not exists (select 1 from mobi_ai.main_items)
 order by seed.position;

commit;

-- PostgREST가 새 스키마·함수를 바로 인식하도록 스키마 캐시를 다시 읽게 한다.
notify pgrst, 'reload schema';
