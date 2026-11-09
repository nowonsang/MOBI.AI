# BodyFit AI 기능정의

> 내 몸을 기억하는 자동차. 운전자의 체형과 평소 자세 조정 이력을 학습해, 탑승할 때마다 맞춤 시트 자세를 추천하고 주차(P) 상태에서 운전자 확인 후 시트를 맞춘다.

- 공모전: 현대자동차그룹 차량용 앱 개발 공모전 (Pleos Playground)
- 기준 문서: [Pleos Connect 앱 개발 시작하기](https://document.pleos.ai/docs/pleos-only/getting-started)
- 우선순위: **P0** = 11/15 기획서·MVP 시연 필수 · **P1** = 2차 PT(12/3~4) 전 · **P2** = 향후 확장
- 할 일과 진행 상황은 [todo.md](./todo.md)에서 관리한다.

## 플랫폼 (Pleos 공식 가이드 기준)

| 항목 | 공식 가이드 | MOBI.AI |
| --- | --- | --- |
| 앱 형태 | Android 앱 (Car / Automotive) | Android 앱 (Expo prebuild로 Android 프로젝트 생성) |
| 언어 | Kotlin | 화면: React Native(TypeScript) · Pleos SDK 연동: Kotlin 네이티브 모듈(`modules/pleos-connect`) |
| minSdk | API 28 이상 | 28 |
| 에뮬레이터 | Pleos Connect system image API 34, Automotive, RAM 4GB, Cold boot | 동일 (`ANDROID_SETUP.md`) |
| SDK 저장소 | `nexus-playground.pleos.ai` Maven | 동일 |
| Vehicle SDK | 예시 2.3.1 | 2.3.2 |
| 권한 | Manifest에 API별 권한 선언 | 선언함 (아래 SDK 표) |
| SDK 생명주기 | `initialize()` 후 사용, 끝나면 `release()` | 모듈 생성 시 초기화, `OnDestroy`에서 해제 |

공식 가이드의 예제는 순수 Kotlin 앱이다. React Native 화면 사용이 허용되는지는 가이드에 언급이 없으므로 확인이 필요하다 (todo.md).

## 사용 SDK와 권한

| SDK (버전) | 권한 | 쓰는 기능 | Playground 상태 (11/9 확인) |
| --- | --- | --- | --- |
| Vehicle 2.3.2 — Seat 조회 | `CAR_SEATS` | 시트 위치·범위 조회, 착좌 감지 | 사용 가능 |
| Vehicle 2.3.2 — Seat 제어 | `CONTROL_CAR_SEATS` | 시트 이동 (`moveSeat*`) | 준비 중 → 승인 확인 필요 |
| Android Car API — 기어 | `CAR_POWERTRAIN` | P단 확인 (Pleos Gear API deprecated) | Android 표준 |
| NaviHelper 3.0.5 | `NAVI_ROUTE` | 목적지 도착 이벤트 | 사용 가능 |
| SpeechToText 3.3.1 | `STT_SERVICE` | 음성 피드백 | 준비 중 → 승인 확인 필요 |
| TextToSpeech 3.3.1 | `TTS_SERVICE` | 음성 안내 | 준비 중 → 승인 확인 필요 |

- Pleos 권한은 App Market과 협의·승인된 범위에서만 쓸 수 있다. 승인되지 않은 권한을 선언하거나 API를 호출하면 앱 심사를 통과할 수 없다.
- 따라서 제어·음성 권한이 승인되지 않을 때를 대비해, 조회만으로 동작하는 **가이드 조절(B-5)**과 **터치 피드백(D-2)**을 대체 경로로 둔다.

## 안전 원칙 (모든 기능에 적용)

| ID | 원칙 |
| --- | --- |
| S-1 | 시트 이동은 기어 P에서만. 이동 전과 이동 중 계속 확인하고, 기어를 알 수 없으면 움직이지 않는다. |
| S-2 | 모든 이동은 운전자가 화면에서 확인한 뒤에만 시작한다. |
| S-3 | 이동은 성공·실패·취소 어느 경우든 반드시 STOP으로 끝난다. 시간 제한을 넘거나 반대 방향으로 움직이면 멈춘다. |
| S-4 | 음성 인식 결과는 신뢰하지 않는다. 검증하고, 한 번에 바뀌는 양을 제한하고, 확인 없이 실행하지 않는다. |
| S-5 | 주행 중에는 조작을 요구하지 않는다. |
| S-6 | 체형·자세 이력은 기기 안에만 저장하고(서버 전송 없음, 자동 백업 끔), 운전자가 지울 수 있다. |

## 기능

### A. 프로필

| ID | 우선 | 기능 | 설명 |
| --- | --- | --- | --- |
| A-1 | P0 | 운전자 등록 | 이름, 키, 몸무게, 앉은키(모르면 키로 추정) |
| A-2 | P0 | 운전자 선택 | 탑승 시 목록에서 선택 |
| A-3 | P0 | 운전자 삭제 | 프로필과 자세 이력 삭제 (S-6) |
| A-4 | P1 | 착좌 감지 | 운전석 착좌를 감지해 운전자 선택 화면 띄우기 (`SeatOccupancy`) |
| A-5 | P2 | 카메라 체형 추정 | 포즈 인식으로 신체 비율 추정 |
| A-6 | P2 | 자동 인식 | 승인된 탑승자 식별 |

### B. 추천·시트 조절

시트 위치는 차종마다 단위가 달라서, 축별로 차량이 지원하는 범위 안의 비율(0~1)로 다룬다. 축: 앞뒤(foreAft), 높이(height), 등받이(backrest), 좌판 기울기(tilt). 차량이 지원하지 않는 축은 건너뛴다.

| ID | 우선 | 기능 | 설명 |
| --- | --- | --- | --- |
| B-1 | P0 | 시트 상태 조회 | 축별 현재 위치, 범위, 이동 가능 여부 조회 (`checkSeat*Capabilities`, `getCurrentSeat*`) |
| B-2 | P0 | 추천 자세 계산 | 체형 기반 기본 추천 + 개인 보정(C-2). 키가 클수록 뒤로, 상체가 길수록 낮게 |
| B-3 | P0 | 변경 미리보기 | 현재와 추천의 축별 차이 표시 |
| B-4 | P0 | 자동 조절 | 운전자 확인 → P단 확인 → 축별로 목표 위치까지 이동 후 STOP (S-1~S-3) |
| B-5 | P1 | 가이드 조절 (대체 경로) | 제어 권한이 없을 때, 운전자가 시트 버튼을 조작하는 동안 실시간 조회로 "조금 더 / 딱 좋아요" 안내 |
| B-6 | P0 | 현재 자세 저장 | 운전자가 직접 맞춘 자세를 저장 (학습 데이터) |
| B-7 | P0 | 멈추기 | 이동 중 즉시 정지 |

### C. 학습 (핵심 차별점)

| ID | 우선 | 기능 | 설명 |
| --- | --- | --- | --- |
| C-1 | P0 | 자세 기록 | 기본 추천(baseline)과 운전자가 최종으로 받아들인 자세(final)를 기록. 출처: 주행 시작 시 자세 / 음성 피드백 / 직접 저장 |
| C-2 | P0 | 개인 보정 | 최근 10개 기록의 (final - baseline)을 최근일수록 크게(×0.7씩 감쇠) 평균. 축별 보정 폭은 ±0.3로 제한 |
| C-3 | P0 | 주행 시작 자세 학습 | 주행을 시작할 때(P단 해제) 시트 위치를 읽어 자동 기록. 운전자가 직접 고친 자세가 저절로 학습된다 |
| C-4 | P1 | 추천 근거 설명 | "지난번에 등받이를 더 세우셔서 반영했어요" |
| C-5 | P2 | 상황별 자세 | 출퇴근, 장거리, 시내 등 상황별 자세 |

### D. 피드백

| ID | 우선 | 기능 | 설명 |
| --- | --- | --- | --- |
| D-1 | P1 | 주행 후 질문 | 60분 이상 주행 후 주차(P)하거나 목적지에 도착하면 "오늘 운전 자세는 편하셨나요?" 질문 (NaviHelper 도착 이벤트) |
| D-2 | P1 | 터치 피드백 (대체 경로) | 음성 권한이 없을 때 선택지로 답하기 ("편했어요 / 등받이 세우기 / 시트 앞으로 …") |
| D-3 | P1 | 음성 피드백 | "등받이 좀 세워줘", "다리가 답답해"를 축·방향·양으로 해석 → 확인 후 조절 (S-4) |
| D-4 | P1 | 음성 안내 | 질문과 결과를 TTS로 읽어주기 |
| D-5 | P2 | 차량 음성 AI(Gleo) 연동 | 자유 문장 이해는 Gleo에 맡기고 결과만 받기 |

## MVP 시연 시나리오 (Pleos 에뮬레이터)

1. 운전자 등록 후 선택 (A-1, A-2)
2. 시트 상태 조회 → 추천 자세 계산 → 변경 미리보기 (B-1~B-3)
3. 운전자 확인 → P단 확인 → 시트 자동 조절 (B-4)
4. 운전자가 등받이를 직접 더 세우고 주행 시작 → 주행 시작 자세 자동 기록 (C-3)
5. 장거리 주행 후 도착 → "편하셨나요?" → "등받이 조금 세워줘" (D-1, D-3)
6. 다음 탑승 때 보정이 반영된 추천 (C-2)

제어 권한이 막히면 3단계를 가이드 조절(B-5)로, 5단계를 터치 피드백(D-2)으로 바꿔 시연한다. 에뮬레이터 차량 값은 Virtual Console로 바꿀 수 있다.

## 데이터

- 저장소: 기기 안 `expo-sqlite/kv-store`. 읽을 때 zod로 검증한다. 서버·Supabase에 보내지 않는다.
- 운전자 프로필: 이름, 키, 몸무게, 앉은키, 생성 시각
- 자세 기록: 프로필 ID, 시각, baseline, final, 출처(drive-start / voice / saved)

## 범위 밖 (MVP)

- 주행 중 시트 이동
- 서버 저장, 기기 간 동기화
- 실시간 압력 분포 분석
- 얼굴·생체 정보 기반 자동 인식

## 참고

- [Pleos Connect 앱 개발 시작하기](https://document.pleos.ai/docs/pleos-only/getting-started)
- [프로젝트 생성 및 SDK 사용 신청](https://document.pleos.ai/docs/pleos-only/create-my-project)
- [Vehicle SDK 소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/intro)
- [Vehicle Permission](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle-permission)
- [Virtual Console 사용 가이드](https://document.pleos.ai/docs/pleos-only/app-test-guide/virtual-console-guide)
- [App Review Guidelines](https://document.pleos.ai/docs/pleos-only/distribute/app-review-guide)
- [공모전 개요](https://appdevchallenge.auto-hmg.io/guide/overview) · [심사·시상](https://appdevchallenge.auto-hmg.io/guide/judging-awards) · [FAQ](https://appdevchallenge.auto-hmg.io/faq)
