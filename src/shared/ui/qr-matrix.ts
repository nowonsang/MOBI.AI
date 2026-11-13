import createQr from "qrcode-generator";

/** 한 줄에서 이어진 어두운 칸 묶음 (칸 하나마다 뷰를 만들지 않으려고 묶는다) */
export type QrRun = { start: number; length: number };

export type QrMatrix = {
  /** 한 변의 칸 수 (여백 제외) */
  size: number;
  /** 줄마다 어두운 칸 묶음 */
  rows: QrRun[][];
};

// 오류 복원 수준 M (약 15%). 휴대폰으로 찍은 사진을 다시 카메라로 읽으므로 L 보다 한 단계 높인다.
// 더 높이면 칸이 촘촘해져 오히려 읽기 어려워진다.
const ERROR_CORRECTION = "M";

const ASCII_ONLY = /^[\x20-\x7e]*$/;

/**
 * 글자 → QR 코드 칸 배치. 그릴 수 없으면 null (ASCII 가 아닌 글자, QR 한 장에 담기에 너무 긴 글자).
 * ASCII 만 받는다: QR 은 글자 인코딩을 알려 주지 않아 읽는 쪽이 한글을 다르게 풀 수 있다.
 */
export function qrMatrix(value: string): QrMatrix | null {
  if (value.length === 0 || !ASCII_ONLY.test(value)) return null;
  try {
    const code = createQr(0, ERROR_CORRECTION);
    code.addData(value, "Byte");
    code.make();
    const size = code.getModuleCount();
    const rows: QrRun[][] = [];
    for (let row = 0; row < size; row += 1) {
      const runs: QrRun[] = [];
      let start = -1;
      for (let col = 0; col <= size; col += 1) {
        const dark = col < size && code.isDark(row, col);
        if (dark && start < 0) start = col;
        if (!dark && start >= 0) {
          runs.push({ start, length: col - start });
          start = -1;
        }
      }
      rows.push(runs);
    }
    return { size, rows };
  } catch {
    // 가장 큰 QR(40형)에도 담기지 않는 길이
    return null;
  }
}
