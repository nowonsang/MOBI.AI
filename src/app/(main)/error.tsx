"use client";

import { useEffect } from "react";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";

export default function MainError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const { reset } = useQueryErrorResetBoundary();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">데이터를 불러오지 못했습니다.</h2>
      <button
        type="button"
        className="self-start underline underline-offset-4"
        onClick={() => {
          // 실패한 쿼리를 초기화해야 재시도 시 에러 상태가 아닌 새 요청으로 시작한다.
          reset();
          retry();
        }}
      >
        다시 시도
      </button>
    </div>
  );
}
