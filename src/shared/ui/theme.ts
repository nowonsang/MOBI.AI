/*
 * MOBI.AI 디자인 토큰. 사용 규칙: .claude/skills/ui-design/SKILL.md
 * 모양은 마이현대 앱(밝은 파랑 강조, 둥근 흰 카드, 연한 그림자)을 따르고, 크기는 Android for Cars 설계 지침(차량 디스플레이),
 * UX 행동 규칙은 토스 사례 기반. 컴포넌트에는 이 토큰만 쓴다. 이 파일 밖의 임의 색상(#..., rgb())은 ESLint 에러다.
 * 색은 주간·야간 두 세트라 모듈 최상위에서 고정해 쓰지 않는다. use-theme.ts 의 훅으로 읽는다.
 */

// 주간 색. 마이현대 앱 모양 그대로다.
const dayColors = {
  /* 브랜드 */
  primary: "#1570EF", // 밝은 파랑: 주 CTA·선택 상태·요약 카드 (흰 글자 대비 4.6:1)
  primaryStrong: "#0F5BD0", // 주 CTA 눌림
  primaryTint: "#E8F1FE", // 옅은 파랑: 아바타·진행 중인 행 배경
  accent: "#0F5BD0", // 링크·보조 강조·포커스
  highlight: "#00AAD2", // Sky Blue: 장식 전용, 글자색 금지
  onPrimary: "#FFFFFF", // primary·success·warning 면 위 글자 (AppText tone="inverse")

  /* 글자 */
  ink: "#111827", // 제목·본문
  inkSecondary: "#4B5563", // 보조 본문
  inkTertiary: "#5F6673", // 설명·캡션 (옅은 바탕 위에서도 4.5:1 이상)
  inkDisabled: "#9CA3AF", // 비활성·placeholder 전용, 본문 금지

  /* 면·선 */
  surface: "#FFFFFF", // 카드·입력칸
  surfaceMuted: "#F4F5F7", // 화면 바탕·스켈레톤·눌림
  fill: "#EEF0F3", // 고르지 않은 칩·개수 표시
  surfaceDark: "#1C1B1B",
  line: "#E5E7EB", // 카드 안 구분선
  lineStrong: "#D1D5DB", // 보조 버튼·입력칸 테두리
  scrim: "rgba(17, 24, 39, 0.6)", // 확인 창 뒤 화면을 가리는 막

  /* 상태 */
  danger: "#D32F2F",
  success: "#15803D", // 흰 글자 대비 5.0:1
  warning: "#B26A00",
} as const;

export type ColorToken = keyof typeof dayColors;
export type Colors = Record<ColorToken, string>;

// 야간 색. 넓은 밝은 면을 없애 운전자 눈부심을 막는다 (ui-design 스킬 1-3장).
// 강조·상태 색은 어두운 면 위에서 글자로도 4.5:1 이 나오게 밝은 톤으로 바꾸고,
// 그 면 위 글자(onPrimary)는 어두운 색으로 뒤집는다. 대비는 theme.test.ts 가 검사한다.
const nightColors: Colors = {
  primary: "#5C9DFF",
  primaryStrong: "#4688EE",
  primaryTint: "#172A46",
  accent: "#8AB8FF",
  highlight: "#00AAD2",
  onPrimary: "#0B1220",

  ink: "#E6E9EE", // 순백을 쓰지 않는다 (눈부심)
  inkSecondary: "#B4BBC6",
  inkTertiary: "#98A1AE",
  inkDisabled: "#6B7482",

  surface: "#1A1F27",
  surfaceMuted: "#0E1116",
  fill: "#2A313C",
  surfaceDark: "#1C1B1B",
  line: "#2A313C",
  lineStrong: "#3D4654",
  scrim: "rgba(0, 0, 0, 0.7)",

  danger: "#F28B82",
  success: "#57C785",
  warning: "#E5A94B",
};

export type ColorScheme = "day" | "night";

/** 주간·야간 색 세트. 컴포넌트는 use-theme.ts 의 useColors()·themedStyles() 로 읽는다. */
export const palettes: Record<ColorScheme, Colors> = {
  day: dayColors,
  night: nightColors,
};

/** 시스템 색 모드 → 색 세트. Android Automotive 는 차량의 주간·야간 상태를 시스템 다크 모드로 넘겨준다. */
export function colorSchemeFor(system: string | null | undefined): ColorScheme {
  return system === "dark" ? "night" : "day";
}

// 차량 디스플레이 기준 글자 크기(dp). 주요 글자 32 이상, 보조 글자 24 이상 (Android for Cars 지침).
export const typography = {
  display: { fontSize: 48, lineHeight: 60, fontWeight: "800" },
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
  // 행 앞 아이콘 원. Pleos 아이콘 그리드(48dp)에 여백을 더한 크기
  iconBadge: 76,
} as const;

// 마이현대 앱처럼 카드와 버튼을 크게 둥글린다.
export const radius = {
  control: 20, // 버튼·입력칸·선택 타일
  card: 24, // 카드
  sheet: 24,
  pill: 999, // 칩·아이콘 원·개수 표시
} as const;

// 카드를 바탕에서 살짝 띄우는 연한 그림자. 카드에만 쓴다.
export const shadows = {
  card: { boxShadow: "0 4px 16px rgba(17, 24, 39, 0.06)" },
} as const;

// 가로로 넓은 차량 화면에서 한 줄이 너무 길어지지 않게 본문 폭을 제한한다.
export const layout = {
  narrow: 880, // 한 화면 한 작업(입력·확인)
  content: 1440, // 일반 화면 (2단 구성)
  gutter: 48, // 화면 좌우 여백
  // 이 폭보다 좁은 창(1:1 분할 세로 창, 휴대폰 확인용)은 여백을 줄이고 하단 버튼을 세로로 쌓는다.
  compactWidth: 720,
  gutterCompact: 24,
  // 이 폭 이상이면 화면을 2단(왼쪽 요약·그림, 오른쪽 목록)으로 나눈다.
  twoColumnWidth: 1000,
  // 2단이고 창 높이가 이 값 이상이면 제목·탭을 고정하고 단 안에서만 스크롤할 수 있다 (usePinnedLayout).
  pinnedMinHeight: 600,
} as const;
