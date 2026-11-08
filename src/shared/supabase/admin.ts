import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/shared/config/server-env";
import type { Database } from "./database.types";

// 이 프로젝트의 모든 테이블은 mobi_ai 스키마에 둔다 (같은 Supabase 프로젝트의 공유 서비스 public 스키마와 분리).
export const SUPABASE_SCHEMA = "mobi_ai";

type AdminClient = SupabaseClient<Database, typeof SUPABASE_SCHEMA>;

let adminClient: AdminClient | undefined;

/**
 * service_role 키를 쓰는 서버 전용 클라이언트.
 *
 * - RLS를 우회하며, 다른 서비스와 공유하는 Supabase 프로젝트 전체에 대한 관리자 권한을 가진다.
 * - features/<서비스>/server (DAL)에서만 호출하고, 결과는 화면에 필요한 필드만 골라 반환한다.
 * - 클라이언트·키를 'use cache' 함수의 인자로 넘기지 않는다 (캐시 키로 직렬화된다).
 * - 기본 스키마가 mobi_ai 이므로 .schema("public") 처럼 다른 스키마로 전환하지 않는다.
 */
export function getSupabaseAdminClient(): AdminClient {
  // 세션을 저장하지 않는 상태 없는 클라이언트이므로 서버 프로세스에서 하나를 재사용한다.
  adminClient ??= createClient<Database, typeof SUPABASE_SCHEMA>(
    serverEnv.SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      db: { schema: SUPABASE_SCHEMA },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  return adminClient;
}
