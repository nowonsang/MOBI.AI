// mobi_ai 스키마의 DB 타입 계약. supabase/migrations 의 SQL과 일치해야 한다.
// 테이블·함수를 추가하면 여기에 Row/Insert/Update 타입을 함께 추가한다 (예시: add-service 스킬의 templates.md).
// Supabase CLI를 연결하면 아래 명령으로 생성한 결과로 이 파일을 교체할 수 있다:
//   npx supabase gen types typescript --project-id <project-ref> --schema mobi_ai

export type Database = {
  mobi_ai: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
