import { qrMatrix, type QrMatrix } from "./qr-matrix";

const isDark = (matrix: QrMatrix, row: number, col: number) =>
  matrix.rows[row].some(
    (run) => col >= run.start && col < run.start + run.length,
  );

describe("qrMatrix", () => {
  const matrix = qrMatrix('{"k":"bodyfit","v":1}');

  it("정사각형 QR 을 만든다 (한 변 21 + 4n 칸)", () => {
    expect(matrix).not.toBeNull();
    if (!matrix) return;
    expect(matrix.rows).toHaveLength(matrix.size);
    expect((matrix.size - 21) % 4).toBe(0);
    for (const runs of matrix.rows) {
      for (const run of runs) {
        expect(run.length).toBeGreaterThan(0);
        expect(run.start + run.length).toBeLessThanOrEqual(matrix.size);
      }
    }
  });

  it("세 모서리에 위치 찾기 무늬(7칸 테두리 + 가운데 3칸)가 있다", () => {
    if (!matrix) throw new Error("QR 을 만들지 못했다");
    const last = matrix.size - 7;
    for (const [top, left] of [
      [0, 0],
      [0, last],
      [last, 0],
    ]) {
      for (let offset = 0; offset < 7; offset += 1) {
        expect(isDark(matrix, top, left + offset)).toBe(true);
        expect(isDark(matrix, top + 6, left + offset)).toBe(true);
        expect(isDark(matrix, top + offset, left)).toBe(true);
        expect(isDark(matrix, top + offset, left + 6)).toBe(true);
      }
      expect(isDark(matrix, top + 1, left + 1)).toBe(false);
      expect(isDark(matrix, top + 3, left + 3)).toBe(true);
    }
  });

  it("이어진 어두운 칸은 한 묶음으로 합친다", () => {
    if (!matrix) throw new Error("QR 을 만들지 못했다");
    expect(matrix.rows[0][0]).toEqual({ start: 0, length: 7 });
  });

  it("같은 글자는 같은 QR 이 되고, 글자가 길수록 칸이 늘어난다", () => {
    expect(qrMatrix("abc")).toEqual(qrMatrix("abc"));
    expect(qrMatrix("a".repeat(300))?.size).toBeGreaterThan(
      qrMatrix("abc")?.size ?? Infinity,
    );
  });

  it("빈 글자, ASCII 가 아닌 글자, 너무 긴 글자는 그리지 않는다", () => {
    expect(qrMatrix("")).toBeNull();
    expect(qrMatrix("운전자")).toBeNull();
    expect(qrMatrix("a".repeat(5000))).toBeNull();
  });
});
