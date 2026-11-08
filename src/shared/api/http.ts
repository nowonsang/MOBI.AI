export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/**
 * 브라우저용 fetch 래퍼. 상대 경로(`/api/...`)는 브라우저에서만 해석되므로
 * 서버 컴포넌트에서는 이 함수 대신 `features/<도메인>/server`의 데이터 함수를 호출한다.
 */
export async function http<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new HttpError(
      response.status,
      `${init?.method ?? "GET"} ${input} failed with ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}
