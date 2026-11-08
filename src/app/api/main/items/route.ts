import { connection } from "next/server";
import { findMainItems } from "@/features/main/server/main.repository";

// TanStack Query가 브라우저에서 재요청할 때 사용하는 BFF 엔드포인트. 경로는 /api/<서비스>/... 로 나눈다.
export async function GET() {
  // 예제 저장소는 메모리에서 읽어 빌드 시 정적으로 굳어버리므로 요청 시점 실행을 명시한다.
  // 실제 DB/외부 API 호출로 바꾸면 Next.js가 자동으로 동적 처리하므로 이 줄은 지워도 된다.
  await connection();
  return Response.json(await findMainItems());
}
