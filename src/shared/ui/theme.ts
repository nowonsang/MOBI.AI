/*
 * MOBI.AI 디자인 토큰. 사용 규칙: .claude/skills/ui-design/SKILL.md
 * 색은 현대자동차 마이현대 소개 페이지 실측값(2026-11-08), 크기는 Android for Cars 설계 지침(차량 디스플레이),
 * UX 행동 규칙은 토스 사례 기반. 컴포넌트에는 이 토큰만 쓴다. 이 파일 밖의 임의 색상(#..., rgb())은 ESLint 에러다.
 */

export const colors = {
  /* 브랜드 */
  primary: "#002C5F", // Hyundai Blue: 주 CTA·활성 상태
  primaryStrong: "#001B3A", // 주 CTA 눌림 (파생)
  accent: "#007FA8", // Active Blue: 링크·보조 강조·포커스 (흰 배경 대비 4.5:1)
  highlight: "#00AAD2", // Sky Blue: 장식·배지 배경 전용, 글자색 금지
  sand: "#E4DCD3", // 브랜드 영역 배경·구분
  sandLight: "#F6F3F2", // 섹션·카드 배경

  /* 글자 */
  ink: "#000000", // 제목·본문
  inkSecondary: "#444444", // 보조 본문
  inkTertiary: "#666666", // 설명·캡션 (최소 대비 기준)
  inkDisabled: "#999999", // 비활성·placeholder 전용, 본문 금지

  /* 면·선 */
  surface: "#FFFFFF",
  surfaceDark: "#1C1B1B",
  line: "#E5E5E5",

  /* 상태 (현대 페이지에 없음, 프로젝트 정의) */
  danger: "#D32F2F",
  success: "#2E7D32",
  warning: "#B26A00",
} as const;

// 차량 디스플레이 기준 글자 크기(dp). 주요 글자 32 이상, 보조 글자 24 이상 (Android for Cars 지침).
export const typography = {
  display: { fontSize: 48, lineHeight: 60, fontWeight: "700" },
  title: { fontSize: 40, lineHeight: 52, fontWeight: "700" },
  heading: { fontSize: 36, lineHeight: 48, fontWeight: "700" },
  body: { fontSize: 32, lineHeight: 44, fontWeight: "400" },
  bodyStrong: { fontSize: 32, lineHeight: 44, fontWeight: "700" },
  secondary: { fontSize: 28, lineHeight: 38, fontWeight: "400" },
  caption: { fontSize: 24, lineHeight: 32, fontWeight: "400" },
} as const;

export type TypographyVariant = keyof typeof typography;

// 4dp 배수. 터치 대상 사이는 최소 24dp 띄운다.
export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  xxl: 64,
} as const;

export const sizes = {
  touchTarget: 76, // 터치 대상 최소 76×76dp (Android for Cars 지침)
  primaryButton: 88, // 주 CTA 높이
  input: 88,
} as const;

// 구조 요소(화면·섹션)는 각지게(현대), 조작 요소(버튼·입력·카드)만 살짝 둥글게(토스).
export const radius = {
  control: 8,
  sheet: 20,
} as const;

// 가로로 넓은 차량 화면에서 한 줄이 너무 길어지지 않게 본문 폭을 제한한다.
export const layout = {
  narrow: 880, // 한 화면 한 작업(입력·확인)
  content: 1280, // 일반 화면
  gutter: 48, // 화면 좌우 여백
} as const;
