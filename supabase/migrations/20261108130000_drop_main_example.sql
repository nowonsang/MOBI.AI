-- 예제(main 서비스 항목 목록) 제거
--
-- 첫 마이그레이션에서 만든 예제 테이블과 함수만 지운다.
-- mobi_ai 스키마, 권한 설정, 공통 함수(mobi_ai.set_updated_at)는 유지한다.
-- 실행 방법: Supabase Dashboard → SQL Editor 에 붙여넣고 실행 (여러 번 실행해도 안전하다)

begin;

-- 함수가 테이블의 행 타입을 반환하므로 함수를 먼저 지운다. 테이블을 지우면 트리거도 함께 지워진다.
drop function if exists mobi_ai.toggle_main_item(uuid);
drop table if exists mobi_ai.main_items;

commit;

notify pgrst, 'reload schema';
