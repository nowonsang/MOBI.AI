---
name: redux-toolkit
description: MOBI.AI 의 Redux 아키텍처 규칙 (Redux Toolkit v2). Redux 상태를 추가·변경·리뷰할 때 반드시 로드한다. 무엇을 Redux 에 두고 무엇을 두지 않는지, 슬라이스·액션·셀렉터 작성법, 스토어 구성, 타입 지정 훅, 부수 효과(리스너 미들웨어), 테스트 방법을 정의한다.
---

# Redux 아키텍처 (Redux Toolkit)

Redux 공식 스타일 가이드를 이 프로젝트에 맞춘 규칙이다. 참고 구현: `src/features/bodyfit/model/bodyfit-session.slice.ts`, `src/core/store/`.

## 1. Redux 에 두는 것 / 두지 않는 것

| 상태 | 어디에 |
| --- | --- |
| 앱 전역 UI·세션 상태 (현재 운전자, 확인 대기 중인 조절안) | **Redux** |
| 앱이 종료돼도 남아야 하는 상태 (진행 중인 주행: 기어가 P 에서 벗어나면 차량이 앱을 종료한다) | 기기 저장소 + `useMutation`. Redux 는 메모리라 사라진다 |
| 저장소·차량에서 비동기로 읽는 데이터 (프로필, 시트 위치) | TanStack Query (`react-query` 스킬). Redux 에 복사하지 않는다 |
| 화면을 식별하는 값 (어떤 운전자 화면인지) | 라우트 파라미터 |
| 한 컴포넌트 안의 상태 (입력 중인 폼 값, 열림/닫힘) | `useState` |

- **RTK Query 는 쓰지 않는다.** 비동기 데이터는 TanStack Query 하나로만 캐시한다 (캐시가 둘이 되면 무효화가 어긋난다).
- 직렬화할 수 없는 값(함수, Promise, 클래스 인스턴스, Date, Map)은 상태·액션에 넣지 않는다. 시각은 `Date.now()` 숫자로.

## 2. 스토어 구성 (`src/core/store/`)

- 스토어는 하나다. `store.ts` 의 `makeStore()` 가 `configureStore` 로 만들고, `core/providers.tsx` 가 한 번만 생성한다.
- 슬라이스는 `reducer: { [slice.name]: slice.reducer }` 로 등록한다 (`slice.selectors` 가 이 경로를 전제로 한다).
- `RootState`, `AppDispatch` 타입은 `store.ts` 에서 추론한다. 손으로 상태 타입을 다시 쓰지 않는다.
- 컴포넌트에서는 `@/core/store/hooks` 의 `useAppDispatch`, `useAppSelector` 만 쓴다 (feature 가 core 에서 import 할 수 있는 유일한 파일).

## 3. 슬라이스 작성

- 위치·이름: `features/<서비스>/model/<서비스>-<주제>.slice.ts`, 변수 `<서비스><주제>Slice`, `name` 은 camelCase (`"bodyfitSession"`).
- `createSlice` 하나에 `initialState`, `reducers`, `selectors` 를 함께 둔다. 상태 타입은 파일 안에서 선언한다.
- **액션은 "무슨 일이 일어났는지"(과거형 이벤트)로 이름 짓는다**: `driverSelected`, `feedbackProposed`, `feedbackDismissed`. `setX`·`updateX` 같은 세터 이름을 쓰지 않는다.
- 로직은 리듀서에 둔다. 컴포넌트에서 다음 상태를 계산해 통째로 넘기지 않는다 (예: 이미 값이 있을 때 덮어쓸지 말지 같은 판단은 리듀서가 한다).
- 리듀서는 Immer 로 "변경하듯" 쓴다. 리듀서 안에서 비동기·랜덤·현재 시각 읽기 금지 (시각은 payload 로 받는다).
- 셀렉터는 슬라이스의 `selectors` 로 정의하고 `select<대상>` 으로 export 한다. 여러 값을 조합해 새 객체·배열을 만드는 셀렉터는 `createSelector` 로 메모이즈한다 (그대로 두면 매 렌더마다 리렌더된다).
- 목록·사전형 데이터를 Redux 에 둘 일이 생기면 `createEntityAdapter` 로 정규화한다. 단, 저장소에서 읽은 데이터라면 Redux 가 아니라 TanStack Query 다.

## 4. 부수 효과

- 리듀서·셀렉터에는 부수 효과가 없다.
- 화면 조작에서 시작하는 부수 효과(저장, 차량 제어)는 TanStack Query 의 `useMutation` 이 맡는다. 성공하면 필요한 Redux 액션을 dispatch 한다 (예: 조절 후 `feedbackDismissed()`).
- **액션에 반응하는 부수 효과**(예: "기어가 P 에서 벗어나면 기록")가 여러 화면에 걸쳐 필요해지면 컴포넌트 `useEffect` 체인 대신 RTK **리스너 미들웨어**(`createListenerMiddleware`)를 쓴다.
  - 리스너는 `features/<서비스>/api/<서비스>.listeners.ts` 에 두고, `core/store/store.ts` 에서 등록한다.
  - 캐시 무효화가 필요하면 `createListenerMiddleware({ extra: { queryClient } })` 로 QueryClient 를 넘긴다 (Providers 와 같은 인스턴스).
  - 도입할 때는 구조 변경이므로 사용자와 먼저 상의한다.
- `createAsyncThunk` 는 쓰지 않는다 (비동기 데이터는 TanStack Query 의 몫).

## 5. 테스트

- 리듀서는 순수 함수라 `slice.reducer(state, action)` 으로 바로 테스트한다. 파일은 슬라이스 옆 `<같은 이름>.test.ts`.
- 셀렉터는 `{ [slice.name]: state }` 형태의 가짜 루트 상태로 테스트한다.

## 6. 체크리스트

- [ ] Redux 에 넣은 값이 비동기 데이터(저장소·차량에서 읽는 값)가 아니다
- [ ] 액션 이름이 과거형 이벤트다
- [ ] 계산 로직이 리듀서·셀렉터 안에 있다
- [ ] 새 객체를 만드는 셀렉터는 `createSelector` 로 감쌌다
- [ ] 상태·액션에 직렬화할 수 없는 값이 없다
- [ ] 컴포넌트는 `useAppDispatch`·`useAppSelector` 만 쓴다
