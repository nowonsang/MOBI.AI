import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 캐시 저장소(R2 증분 캐시·D1 태그 캐시)는 아직 쓰지 않는다.
// 'use cache' 결과를 배포 사이에 유지하거나 updateTag 로 무효화해야 하는 기능이 생기면
// R2·D1 리소스를 만들고 여기에 incrementalCache·tagCache 를 추가한다 (README "배포" 참고).
export default defineCloudflareConfig();
