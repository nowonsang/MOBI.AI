// mobi_ai 스키마의 DB 타입 계약. supabase/migrations 의 SQL과 일치해야 한다.
// Supabase CLI를 연결하면 아래 명령으로 생성한 결과로 이 파일을 교체한다:
//   npx supabase gen types typescript --project-id <project-ref> --schema mobi_ai

type MainItemRow = {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

export type Database = {
  mobi_ai: {
    Tables: {
      main_items: {
        Row: MainItemRow;
        Insert: {
          id?: string;
          title: string;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      toggle_main_item: {
        Args: { item_id: string };
        Returns: MainItemRow;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
