import { findMainItems } from "@/features/main/server/main.repository";

// TanStack Query가 브라우저에서 재요청할 때 사용하는 BFF 엔드포인트. 경로는 /api/<서비스>/... 로 나눈다.
// DB 조회(네트워크 요청)를 하므로 Next.js가 요청 시점에 실행한다.
export async function GET() {
  return Response.json(await findMainItems());
}
