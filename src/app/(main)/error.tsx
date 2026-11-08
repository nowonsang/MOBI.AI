"use client";

import { useEffect } from "react";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";

// 실패 화면은 사용자가 가장 오래 기억하는 순간이다: 탓하지 않는 문구 + 바로 할 수 있는 다음 행동 하나.
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
    <div className="mx-auto flex w-full max-w-narrow flex-col gap-3 py-10 text-center">
      <h2 className="text-heading font-bold text-ink lg:text-heading-lg">
        잠시 문제가 생겼어요
      </h2>
      <p className="text-body text-ink-tertiary">
        네트워크 상태를 확인하고 다시 시도해 주세요.
      </p>
      <button
        type="button"
        className="mt-4 h-13 w-full rounded-control bg-primary px-5 text-body-lg font-bold text-surface transition-colors hover:bg-primary-strong md:mx-auto md:w-auto md:min-w-60"
        onClick={() => {
          // 실패한 쿼리를 초기화해야 재시도 시 에러 상태가 아닌 새 요청으로 시작한다.
          reset();
          retry();
        }}
      >
        다시 시도하기
      </button>
    </div>
  );
}
