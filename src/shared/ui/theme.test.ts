import { colorSchemeFor, palettes, type ColorToken } from "./theme";

// WCAG 2.x 상대 휘도와 대비.
function luminance(hex: string): number {
  const channel = (index: number) => {
    const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// [글자, 바탕] 실제로 화면에 쓰이는 조합.
const TEXT_ON: [ColorToken, ColorToken][] = [
  ["ink", "surface"],
  ["ink", "surfaceMuted"],
  ["ink", "fill"],
  ["ink", "primaryTint"],
  ["inkSecondary", "surface"],
  ["inkSecondary", "surfaceMuted"],
  ["inkSecondary", "fill"],
  ["inkTertiary", "surface"],
  ["inkTertiary", "surfaceMuted"],
  ["inkTertiary", "fill"],
  ["primary", "surface"],
  ["success", "surface"],
  ["danger", "surface"],
  ["danger", "surfaceMuted"],
  ["onPrimary", "primary"],
  ["onPrimary", "primaryStrong"],
  ["onPrimary", "success"],
];

describe.each(["day", "night"] as const)("%s 색 세트", (scheme) => {
  const colors = palettes[scheme];

  it.each(TEXT_ON)("%s 글자는 %s 위에서 대비 4.5:1 이상이다", (text, bg) => {
    expect(contrast(colors[text], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  // IconBadge 의 한 글자 기호(32dp 굵은 글자)에만 쓰이는 조합. 뜻은 옆 글자가 전한다.
  it.each([
    ["onPrimary", "warning"],
    ["primary", "primaryTint"],
  ] as const)("%s 기호는 %s 위에서 큰 글자 기준(3:1) 이상이다", (text, bg) => {
    expect(contrast(colors[text], colors[bg])).toBeGreaterThanOrEqual(3);
  });
});

describe("야간 색 세트", () => {
  const { night, day } = palettes;

  it("주간과 같은 토큰을 모두 가진다", () => {
    expect(Object.keys(night).sort()).toEqual(Object.keys(day).sort());
  });

  it("넓은 면(화면 바탕·카드·칩)은 어둡다 (눈부심 방지)", () => {
    for (const token of ["surfaceMuted", "surface", "fill"] as const) {
      expect(luminance(night[token])).toBeLessThan(0.05);
    }
  });

  it("글자에 순백을 쓰지 않는다", () => {
    expect(luminance(night.ink)).toBeLessThan(0.9);
  });

  it("카드는 화면 바탕보다 밝아 구분된다", () => {
    expect(luminance(night.surface)).toBeGreaterThan(
      luminance(night.surfaceMuted),
    );
  });
});

describe("colorSchemeFor", () => {
  it("시스템이 다크일 때만 야간이다", () => {
    expect(colorSchemeFor("dark")).toBe("night");
    expect(colorSchemeFor("light")).toBe("day");
  });

  it("값을 모르면 주간으로 둔다", () => {
    expect(colorSchemeFor(null)).toBe("day");
    expect(colorSchemeFor(undefined)).toBe("day");
    expect(colorSchemeFor("unspecified")).toBe("day");
  });
});
