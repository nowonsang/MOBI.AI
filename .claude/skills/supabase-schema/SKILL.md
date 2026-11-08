---
name: supabase-schema
description: MOBI.AI가 다른 서비스와 공유하는 Supabase 프로젝트에서 DB 작업을 할 때 반드시 먼저 로드한다. 테이블·함수·트리거·RLS 정책·마이그레이션 SQL 작성, 스키마 설계, Supabase 조회 코드, 로그인 사용자·스토리지 사용, 데이터 정리 요청에 사용한다. mobi_ai 스키마 격리 규칙, 공유 서비스 영역 금지 작업, 마이그레이션 작성·검사·실행 방법, 해커톤 종료 후 정리 절차를 정의한다.
---

# Supabase 스키마 격리 규칙 (공유 프로젝트)

## 배경 — 왜 규칙이 필요한가

- MOBI.AI는 **해커톤용 단발 프로젝트**다. Supabase Free 플랜이라 다른 서비스(이하 '공유 서비스')와 **같은 프로젝트**를 쓰고, 제출 후 MOBI.AI 데이터는 정리한다.
- API 키, 로그인 사용자(`auth`), 스토리지는 공유 서비스와 **공유**한다.
- 팀원은 Dashboard에 Developer로 초대되어 **프로젝트 전체**(공유 서비스 포함)를 수정할 수 있다. DB 권한으로는 분리되지 않으므로, **규칙과 자동 검사로 분리를 지킨다.**
- 한 번의 실수(스키마 생략, 공유 테이블 수정, auth 트리거 추가)가 실서비스인 공유 서비스를 망가뜨린다. 애매하면 작업을 멈추고 사용자에게 확인한다.

## 1. 영역별 소유와 허용 범위

| 영역 | 소유 | MOBI.AI에서 허용 | 금지 |
| --- | --- | --- | --- |
| `mobi_ai` 스키마 | MOBI.AI | 테이블·함수·트리거·정책 자유롭게 생성·수정 | — |
| `public` 스키마 | 공유 서비스 | 없음 | 읽기·쓰기·변경·참조 전부 |
| `auth` 스키마 (로그인 사용자) | 공유 | `auth.uid()`·`auth.jwt()` 호출, `references auth.users(id)` 외래 키 | `auth.users` 수정, auth 테이블에 트리거 추가, `raw_user_meta_data` 변경 |
| `storage` (파일) | 공유 | 버킷 이름이 `mobi-ai-` 로 시작하는 버킷만 사용 | 공유 서비스 버킷 접근, 스토리지 정책 변경(사용자 확인 필요) |
| 확장(extension), 프로젝트 설정, API 키 | 공유 서비스 | 없음 | 설치·변경 (사용자와 상의) |
| `supabase_migrations` (마이그레이션 이력) | 공유 서비스 저장소의 GitHub 연동 | 없음 | `supabase db push`, `supabase link`, `supabase migration repair` |

- MOBI.AI 사용자별 데이터는 `auth.users` 를 고치지 말고 `mobi_ai.profiles (user_id uuid references auth.users(id))` 같은 MOBI 전용 테이블에 둔다. 공유 서비스 사용자도 같은 계정이므로, MOBI 기능을 처음 쓸 때 행을 만든다.
- `anon`·`authenticated` 역할은 공유 서비스 공개 키·로그인 사용자와 공유된다. 이 역할에 `mobi_ai` 권한을 주려면 사용자 확인을 먼저 받는다.

## 2. 마이그레이션 작성 규칙

파일: `supabase/migrations/<YYYYMMDDHHMMSS>_<snake_case 설명>.sql` (참고 구현: `20261108000000_create_mobi_ai_schema.sql`)

1. **모든 객체 이름에 `mobi_ai.` 를 붙인다.** 스키마를 생략하면 공유 서비스의 `public` 에 생성된다.
2. 새 테이블은 같은 파일에서:
   ```sql
   create table if not exists mobi_ai.<서비스>_<복수형> (...);
   alter table mobi_ai.<테이블> enable row level security;
   revoke all on table mobi_ai.<테이블> from public, anon, authenticated;
   grant select, insert, update, delete on table mobi_ai.<테이블> to service_role;
   ```
3. 함수는 `security invoker` + `set search_path = ''` 로 만들고 본문의 모든 객체에 `mobi_ai.` 를 붙인다. 만든 뒤 `revoke execute ... from public, anon, authenticated` 하고 필요한 역할에만 grant 한다.
4. `alter default privileges` 에는 반드시 `in schema mobi_ai` 를 쓴다 (없으면 공유 서비스를 포함한 프로젝트 전체 기본 권한이 바뀐다).
5. 다시 실행해도 안전하게 쓴다: `create ... if not exists`, `create or replace`, `drop ... if exists`.
6. 이미 실행한 마이그레이션 파일은 고치지 않는다. 변경은 새 파일로 추가한다.
7. 금지: `drop schema`, `create extension`, `security definer`, 공유 스키마(`public`·`auth`·`storage`…) 객체 변경.
8. 이름 규칙: 테이블 `<서비스>_<복수형>`(예: `main_items`), 함수 `<동사>_<대상>`(예: `toggle_main_item`), 트리거 `<테이블>_<동작>`, 정책 `"<누가> can <동작> <대상>"`, 버킷 `mobi-ai-<용도>`.

## 3. 작성 후 검증 (AI 필수)

1. `npm run check:migrations` — 스키마 생략, 공유 스키마 변경, RLS 누락, 위험 구문을 검사한다. `npm run lint` 에도 포함되어 있다. **오류가 있으면 고칠 때까지 완료로 보고하지 않는다.**
2. `src/shared/supabase/database.types.ts` 에 새 테이블·함수 타입을 추가한다.
3. 사용자에게 SQL Editor 실행을 요청하고, 실행 후 `npm run check:supabase` 로 확인한다.

## 4. 실행 방법 (사람이 한다)

- **AI는 원격 DB에 SQL을 직접 실행하지 않는다.** 마이그레이션 파일을 만든 뒤 사용자에게 실행을 요청한다.
- 실행: Supabase Dashboard → SQL Editor 에 파일 내용을 붙여넣고 실행.
- 새 스키마나 함수를 API에서 바로 쓰려면 파일 끝의 `notify pgrst, 'reload schema';` 를 유지한다.
- Supabase CLI의 `db push`·`link` 는 쓰지 않는다. 이 프로젝트의 마이그레이션 이력은 공유 서비스 저장소(GitHub 연동)가 관리하므로 섞이면 공유 서비스 배포가 깨진다.

## 5. 애플리케이션 코드 규칙

- DB 접근은 `features/<서비스>/server/*.repository.ts` 에서 `getSupabaseAdminClient()` (`@/shared/supabase/admin`) 로만 한다. 기본 스키마가 `mobi_ai` 로 고정되어 있다.
- `@supabase/*` 직접 import 와 `.schema(...)` 호출은 ESLint 에러다 (`src/shared/supabase/` 제외).
- 조회는 필요한 컬럼만 명시한다 (`select("id, title")`). Supabase 에러는 `error.code` 만 담아 서버에서 던진다.
- 원자적으로 처리해야 하는 변경(토글, 카운터, 여러 테이블 동시 변경)은 `mobi_ai` 함수로 만들고 `.rpc()` 로 호출한다.
- `service_role` 키는 공유 서비스 데이터까지 접근 가능한 관리자 키다. 서버 밖으로 내보내지 않는다 (`secure-coding` 스킬 참고).

## 6. 해커톤 종료 후 정리 (사람이 한다, AI 실행 금지)

순서대로 사용자에게 안내만 한다.

1. SQL Editor: `drop schema mobi_ai cascade;` (MOBI.AI 테이블·함수·정책 전부 삭제, 공유 서비스에는 영향 없음)
2. Project Settings → Data API → Exposed schemas 에서 `mobi_ai` 제거
3. Storage 에서 `mobi-ai-` 로 시작하는 버킷 삭제
4. `mobi_ai.profiles` 처럼 MOBI가 만든 사용자 데이터만 지워진다. 공유 로그인 사용자(`auth.users`)는 공유 서비스 사용자이므로 지우지 않는다.
5. Organization → Team 에서 해커톤 팀원 초대 해제
6. 팀원에게 키를 공유했다면 키 교체를 검토한다. 단, 기존 키 교체는 공유 서비스 배포에도 영향을 주므로 공유 서비스 쪽 env 갱신 계획과 함께 한다.
