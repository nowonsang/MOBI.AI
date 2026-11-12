# BodyFit AI 기능정의

> 내 몸을 기억하는 자동차. 운전자의 체형과 평소 자세 조정 이력을 학습해, 탑승할 때마다 맞춤 시트 자세를 추천하고 주차(P) 상태에서 목표 자세까지 안내한다. 시트 제어 SDK가 열리면 운전자 확인 후 자동으로 맞춘다.

- 공모전: 현대자동차그룹 차량용 앱 개발 공모전 (Pleos Playground)
- 기준 문서: [Pleos Connect 앱 개발 시작하기](https://document.pleos.ai/docs/pleos-only/getting-started)
- 우선순위: **P0** = 11/15 기획서·MVP 시연 필수 · **P1** = 2차 PT(12/3~4) 전 · **P2** = 향후 확장 · **SDK 기능** = 시트 제어·STT·TTS 가 필요한 기능. 에뮬레이터에서 시연하고(contest 빌드), 실차·앱 마켓은 콘솔 승인 후 켠다
- 할 일과 진행 상황은 [todo.md](./todo.md)에서 관리한다. 단계별 개발 순서는 [개발 워크플로우 PDF](./BodyFit_AI_개발_워크플로우.pdf)에 그림으로 정리했다.

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

| SDK (버전) | 권한 | 쓰는 기능 | Playground 콘솔 상태 (11/9 확인) | Pleos Connect 에뮬레이터 v2.1.0 (11/11 확인) |
| --- | --- | --- | --- | --- |
| Vehicle 2.3.2 — Seat 조회 (Vehicle State) | `CAR_SEATS` | 시트 위치·범위 조회, 착좌 감지 | 사용 가능 | 권한 부여 · 조회 확인 |
| Vehicle 2.3.2 — Seat 제어 (Vehicle Control) | `CONTROL_CAR_SEATS` | 시트 이동 (`moveSeat*`) | **Coming Soon (신청 불가)** | 권한 부여 · 이동 명령 전달 확인 (위치 값은 그대로) |
| Android Car API — 기어 | `CAR_POWERTRAIN` | P단 확인 (Pleos Gear API deprecated) | Android 표준 | 권한 부여 |
| NaviHelper 3.0.5 | `NAVI_ROUTE` | 목적지 도착 이벤트 | 사용 가능 | 권한 부여 |
| SpeechToText 3.3.1 | `STT_SERVICE` | 음성 피드백 | **Coming Soon (신청 불가)** | 권한 부여 · 동작 미확인 |
| TextToSpeech 3.3.1 | `TTS_SERVICE` | 음성 안내 | **Coming Soon (신청 불가)** | 권한 부여 · 동작 미확인 |

- Pleos 권한은 App Market과 협의·승인된 범위에서만 쓸 수 있다. 승인되지 않은 권한을 선언하거나 API를 호출하면 앱 심사를 통과할 수 없다.
- **공모전 운영사무국 답변 (11/12 최종)**: 공모전 개발 범위는 Playground 개발 문서 기준이다. 콘솔에 '준비 중'이어도 개발 문서에 공개된 SDK(시트 제어·STT·TTS·FusedLocation 포함)는 출품작에 쓰고 에뮬레이터로 시연할 수 있다. 권한은 매니페스트 선언만 하면 되고 별도 신청·승인은 필요 없다. Pleos LLM SDK 는 쓸 수 없다. Pleos 앱 마켓 심사는 이와 별개라 market 빌드는 콘솔 승인 전 권한을 뺀다.
- 콘솔 "사용 가능" 항목 (11/11 MOBI 프로젝트): Vehicle State 11개(제원, 주행 정보·주행 거리, 도어·트렁크, EV·연료, 내부 온도·공조, 라이트·방향 지시등, 안전 경고등, 좌석 설정(열선·안전벨트), 사이드미러, 통행료, 창문·와이퍼), NaviHelper 2개(경로 정보·위치·TBT, 경로 탐색 옵션). Coming Soon: Vehicle Control, STT, TTS, FusedLocation
- "준비 중" 상태에는 신청 버튼이 없어 사전 신청도 할 수 없다. "신청 필요"로 바뀐 뒤에만 신청할 수 있다 ([SDK 사용 신청 가이드](https://document.pleos.ai/docs/pleos-only/create-my-project), 11/10 확인).
- **전제 (11/11 변경): Pleos Connect 에뮬레이터는 시트 제어·STT·TTS 권한을 제공한다.** 콘솔은 아직 "준비 중"이지만 에뮬레이터에서는 이 SDK 를 쓸 수 있으므로, 에뮬레이터 시연은 SDK 기능까지 포함한다.
- **주 경로**는 조회만으로 동작하는 가이드 조절(B-5), 주행 후 질문(D-1)과 터치 피드백(D-2)이다 (실차에서 SDK 승인 전에도 동작). 자동 조절(B-4, B-7)과 음성(D-3, D-4)은 **에뮬레이터 시연에 포함**하고, 실차·앱 마켓은 콘솔 승인 후 켠다.
- 에뮬레이터는 시트 이동 명령을 받지만 위치 값은 바뀌지 않았고, Virtual Console 에 시트 위치 항목이 없다 (11/11). 시트가 움직이는 장면의 시연 방법은 따로 확인한다 (`todo.md`).
- 확장 아이디어: 제어 API에는 안전벨트 높이(`moveSeatBeltHeight`), 좌판 깊이(`moveSeatDepth`), 헤드레스트 각도(`moveSeatHeadrestAngle`)도 있다.

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
| B-4 | SDK 기능 | 자동 조절 | 시트 제어 권한이 열리면: 운전자 확인 → P단 확인 → 축별로 목표 위치까지 이동 후 STOP (S-1~S-3) |
| B-5 | P0 | 가이드 조절 (주 경로) | 운전자가 시트 버튼을 조작하는 동안 실시간 조회로 축별 "조금 더 / 지나쳤어요 / 딱 좋아요 ✓" 안내. 모든 축이 허용 오차 안이면 완료 |
| B-6 | P0 | 현재 자세 저장 | 운전자가 직접 맞춘 자세를 저장 (학습 데이터). 목표와 달라도 그 위치를 최종값으로 인정 |
| B-7 | SDK 기능 | 멈추기 | 자동 조절 중 즉시 정지 (B-4와 함께) |

### C. 학습 (핵심 차별점)

| ID | 우선 | 기능 | 설명 |
| --- | --- | --- | --- |
| C-1 | P0 | 자세 기록 | 기본 추천(baseline)과 운전자가 최종으로 받아들인 자세(final)를 기록. 출처: 주행 시작 시 자세 / 직접 저장 / 터치 피드백 / 음성 피드백 (SDK 기능) |
| C-2 | P0 | 개인 보정 | 최근 10개 기록의 (final - baseline)을 최근일수록 크게(×0.7씩 감쇠) 평균. 축별 보정 폭은 ±0.3로 제한 |
| C-3 | P0 | 주행 시작 자세 학습 | 주행을 시작할 때(P단 해제) 시트 위치를 읽어 자동 기록. 운전자가 직접 고친 자세가 저절로 학습된다 |
| C-4 | P1 | 추천 근거 설명 | "지난번에 등받이를 더 세우셔서 반영했어요" |
| C-5 | P1 | 상황별 자세 | 운전자가 맞춤 자세 화면에서 상황(평소 / 출퇴근 / 장거리 / 시내)을 고른다. 주차(P) 중에만 고를 수 있고, 고르지 않으면 평소다 (S-5). 자세 기록(C-1)과 진행 중인 주행에 상황을 함께 남기고, 추천은 고른 상황의 기록으로 보정한다: 그 상황의 기록이 3건 이상이면 그 기록만, 1~2건이면 (기록 수 ÷ 3)만큼만 반영하고 나머지는 전체 기록, 없으면 전체 기록. 추천 근거(C-4)도 상황을 말한다 ("장거리에서는 등받이를 더 눕히셔서 반영했어요"). 상황별 기본 차이는 넣지 않고 운전자 본인의 기록으로만 달라진다 (기본값으로 쓸 근거 자료가 없다). 다른 운전자를 고르거나 운전석 착좌가 바뀌면 평소로 돌아간다. 예전 기록(상황 없음)은 평소로 읽는다 |

### D. 피드백

| ID | 우선 | 기능 | 설명 |
| --- | --- | --- | --- |
| D-1 | P0 | 주행 후 질문 | 60분 이상 주행 후 주차(P)하거나 목적지에 도착하면 "오늘 운전 자세는 편하셨나요?" 질문 (NaviHelper 도착 이벤트). **화면으로 묻고, 주차(P) 중에만 띄운다** (S-5). 시연용 contest 빌드는 영상·2차 PT 를 위해 1분 이상 주행으로 줄인다 (11/11 결정, market 빌드는 60분) |
| D-2 | P0 | 터치 피드백 (주 경로) | 선택지로 답하기 ("편했어요 / 등받이 세우기 / 시트 앞으로 …") → 다음 추천에 반영. 선택지는 음성 해석과 같은 형식(축·방향·양, `SeatNudge`)으로 바꾼다. **시트를 움직이지 않고** 기록(C-1, 출처 "터치")에 바로 반영한다. 선택지 확정 (11/11): "편했어요" + 등받이 세우기·눕히기, 시트 앞으로·뒤로, 시트 높이기·낮추기 |
| D-3 | SDK 기능 | 음성 피드백 | STT가 열리면: "등받이 좀 세워줘", "다리가 답답해"를 축·방향·양으로 해석 → 확인 후 반영 (S-4) |
| D-4 | SDK 기능 | 음성 안내 | TTS가 열리면: 질문과 결과를 음성으로 읽어주기 |
| D-5 | P2 | 차량 음성 AI(Gleo) 연동 | 자유 문장 이해는 Gleo에 맡기고 결과만 받기 |

### E. 온도 취향 ("내 운전석 통째로")

시트 자세뿐 아니라 운전석 온도 취향까지 사람별로 기억한다. 현대차그룹 스마트 자세제어(위치만 제안)와의 차별점이다. Vehicle SDK 에는 외부 온도 API 가 없어, **탈 때 실내 온도**를 기준으로 비슷한 날의 설정을 고른다.

| ID | 우선 | 기능 | 설명 |
| --- | --- | --- | --- |
| E-1 | P0 | 온도 취향 기록 | 출발할 때(P 해제) 시트 열선·통풍, 핸들 열선, 운전석 공조 설정 온도와 탈 때 실내 온도를 기록 (`getHvacSeatTemperature`, `getHvacSteeringWheelHeatState`, `getHvacTemperature`, `getHvacTemperatureCurrent`) |
| E-2 | P0 | 온도 취향 추천 | 지금 실내 온도와 ±5℃ 안이었던 최근 기록 5건의 가운데 값. 비슷한 날이 없으면 최근 기록 기준 |
| E-3 | P0 | 평소 온도로 맞추기 | 맞춤 자세 화면의 "내 운전석 온도" 카드. 주차(P) 중 운전자가 누르면 다른 항목만 바꾼다 (`setHvacSeatTemperature`, `setHvacSteeringWheelHeat`, `setHvacTemperature`). 네이티브에서도 기어 P 확인 |

## MVP 시연 시나리오 (Pleos 에뮬레이터)

공지에 따라 2차 PT는 에뮬레이터 구동 화면으로 시연할 수 있다. 1차 개발 산출물은 화면 녹화·프로토타입도 인정된다.

1. 운전자 등록 후 선택 (A-1, A-2)
2. 시트 상태 조회 → 추천 자세 계산 → 변경 미리보기 (B-1~B-3)
3. 가이드 조절: 시트 값을 바꾸면 화면이 "조금 더 뒤로… 딱 좋아요 ✓" 안내 (B-5)
4. 운전자가 등받이를 목표보다 더 세우고 주행 시작 → 주행 시작 자세 자동 기록 (C-3)
5. 장거리 주행 후 도착 → "편하셨나요?" → 터치로 "등받이 세우기" 선택 (D-1, D-2)
6. 다음 탑승 때 보정이 반영된 추천 (C-2)

에뮬레이터의 기어·도착 값은 Virtual Console로 바꿔 시연한다. 시연·영상·2차 PT 는 **contest 빌드**(`npm run android:build:release`, 에뮬레이터는 `npm run android:emulator`)로 하고, 자동 조절(B-4, B-7)과 음성(D-3, D-4)도 함께 보여 준다. 기획서·PT 에는 "에뮬레이터에서 동작, 실차는 SDK 승인 후 적용"으로 쓴다.

- 시트 장면 (11/11 결정): 에뮬레이터는 시트 위치 값이 바뀌지 않으므로, 자동 조절·가이드 조절은 실제 앱 화면 흐름(확인 → 이동 중 → 멈추기)을 녹화하고 "에뮬레이터는 시트 위치가 바뀌지 않음, 실차에서 이동"을 자막으로 밝힌다. 그래픽 합성은 하지 않는다 (2차 PT 에서 실제 앱과 비교된다).
- 주행 후 질문(5번): contest 빌드는 1분 주행 후 주차하면 질문이 뜬다. Virtual Console 에서 기어를 D → (1분) → P 로 바꾼다.

**market 빌드**는 Pleos 앱 마켓 제출용이다 (콘솔 승인 전 권한·화면 제외).

## 데이터

- 저장소: 기기 안 `expo-sqlite/kv-store`. 읽을 때 zod로 검증한다. 서버·Supabase에 보내지 않는다.
- 운전자 프로필: 이름, 키, 몸무게, 앉은키, 생성 시각
- 자세 기록: 프로필 ID, 시각, baseline, final, 출처(drive-start / saved / touch / voice), 상황(usual / commute / long / city). 운전자·상황마다 최근 50건
- 진행 중인 주행: 프로필 ID, 출발 시각. 기어가 P 에서 벗어나면 차량이 앱을 종료하므로 기기에 남겨 주행 후 질문(D-1)에 쓴다. 주차하거나 질문하면 지우고, 운전자를 지우면 함께 지운다. 12시간이 지난 기록으로는 묻지 않는다

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
