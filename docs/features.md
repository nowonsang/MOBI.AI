# BodyFit AI 기능정의

> 내 몸을 기억하는 자동차. 운전자의 체형과 평소 자세 조정 이력을 학습해, 탑승할 때마다 맞춤 시트 자세를 추천하고, 주차(P) 상태에서 운전자가 화면에서 확인하면 추천 자세까지 시트를 자동으로 맞춘다. 시트 버튼으로 직접 맞추는 운전자에게는 목표 자세까지 축별로 안내한다.

- 공모전: 현대자동차그룹 차량용 앱 개발 공모전 (Pleos Playground)
- 기준 문서: [Pleos Connect 앱 개발 시작하기](https://document.pleos.ai/docs/pleos-only/getting-started)
- 우선순위: **P0** = 11/15 기획서·MVP 시연 필수 · **P1** = 2차 PT(12/3~4) 전 · **P2** = 향후 확장 · **SDK 기능** = 시트 제어·STT·TTS 가 필요한 기능. 출품작(contest 빌드)에 넣어 에뮬레이터에서 시연하고, 앱 마켓 제출(market 빌드)에는 콘솔 승인 후 켠다
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
| Vehicle 2.3.2 — Seat 제어 (Vehicle Control) | `CONTROL_CAR_SEATS` | 시트 이동 (`moveSeat*`) | **Coming Soon (신청 불가)** | 권한 부여 · 기어 P 에서 이동 명령이 차량 계층(VHAL)까지 전달됨 (11/12). 위치 값은 0 으로만 읽힘 |
| Android Car API — 기어 | `CAR_POWERTRAIN` | P단 확인 (Pleos Gear API deprecated) | Android 표준 | 권한 부여 |
| NaviHelper 3.0.5 | `NAVI_ROUTE` | 목적지 도착 이벤트, 목적지까지 남은 거리·시간 (`getDestinationInfo`) | 사용 가능 | 권한 부여 |
| SpeechToText 3.3.1 | `STT_SERVICE` | 음성 피드백 | **Coming Soon (신청 불가)** | 권한 부여 · 동작 미확인 |
| TextToSpeech 3.3.1 | `TTS_SERVICE` | 음성 안내 | **Coming Soon (신청 불가)** | 권한 부여 · 동작 미확인 |

- Pleos 권한은 App Market과 협의·승인된 범위에서만 쓸 수 있다. 승인되지 않은 권한을 선언하거나 API를 호출하면 앱 심사를 통과할 수 없다.
- **공모전 운영사무국 답변 (11/12 최종)**: 공모전 개발 범위는 Playground 개발 문서 기준이다. 콘솔에 '준비 중'이어도 개발 문서에 공개된 SDK(시트 제어·STT·TTS·FusedLocation 포함)는 출품작에 쓰고 에뮬레이터로 시연할 수 있다. 권한은 매니페스트 선언만 하면 되고 별도 신청·승인은 필요 없다. Pleos LLM SDK 는 쓸 수 없다. Pleos 앱 마켓 심사는 이와 별개라 market 빌드는 콘솔 승인 전 권한을 뺀다.
- 콘솔 "사용 가능" 항목 (11/11 MOBI 프로젝트): Vehicle State 11개(제원, 주행 정보·주행 거리, 도어·트렁크, EV·연료, 내부 온도·공조, 라이트·방향 지시등, 안전 경고등, 좌석 설정(열선·안전벨트), 사이드미러, 통행료, 창문·와이퍼), NaviHelper 2개(경로 정보·위치·TBT, 경로 탐색 옵션). Coming Soon: Vehicle Control, STT, TTS, FusedLocation
- "준비 중" 상태에는 신청 버튼이 없어 사전 신청도 할 수 없다. "신청 필요"로 바뀐 뒤에만 신청할 수 있다 ([SDK 사용 신청 가이드](https://document.pleos.ai/docs/pleos-only/create-my-project), 11/10 확인).
- **전제 (11/12 확정): 자동 조절(시트 제어)과 음성(STT·TTS)은 출품작의 기능이다.** 운영사무국 최종 답변에 따라 contest 빌드에 넣고 에뮬레이터로 시연한다. 시트 이동 같은 제한 대상 제어는 기어 P 가 아니면 동작하지 않는다 (앱도 네이티브에서 P 를 확인한다, S-1).
- **주 경로 (contest 빌드)**: 맞춤 자세 화면의 주 버튼은 자동 조절(B-4, B-7)이다. 가이드 조절(B-5)은 시트 버튼으로 직접 맞추고 싶을 때 쓰는 보조 버튼이다. 피드백은 주행 후 질문(D-1)과 터치 피드백(D-2)이 주 경로이고 음성(D-3, D-4)을 함께 보여 준다. **market 빌드**(앱 마켓 제출)는 콘솔 승인 전 권한을 빼므로 자동 조절·음성이 없고 가이드 조절이 주 경로다.
- 에뮬레이터 v2.1.0 의 시트 (11/12 기어 P 에서 다시 확인): 이동 명령은 차량 계층까지 전달된다 (VHAL 로그 `control Row1Left seat's Slide type to Positive state`, Virtual Console 의 시트 값이 0.1초마다 5% 씩 움직이고 시스템이 "시트 위치 변경됨"을 띄운다). 하지만 Vehicle SDK 로 읽는 위치는 계속 0 이다. 에뮬레이터가 위치를 0~1 로 보내는데 VHAL 이 100 으로 나눈 뒤 정수로 바꾸기 때문이다 (로그 `Slide is 0.6, revised position: 0`). 그래서 실제 자동 조절은 목표에 닿았는지 알 수 없어 30초 뒤 "끝까지 맞추지 못했어요"로 끝난다. 에뮬레이터 시연은 **자동 조절 시연 모드**(B-4)로 한다.
- 무드등·사이드미러 열선 (11/12 구현, E-5·E-6): 새 권한 `CAR_LIGHTS`(무드등 읽기·맞추기), `CAR_MIRRORS`(사이드미러 열선 읽기), `CONTROL_CAR_MIRRORS`(사이드미러 열선 맞추기)를 선언했다 (Vehicle SDK 2.3.2 AAR 의 `@RequiresPermission` 확인. 개발 문서 공개 여부 11/12 확인: 쓰는 메서드가 모두 Vehicle SDK API Reference 에 있다 — [Light](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/light/entry) 의 `get`·`set`·`check…Capabilities` × `AmbientLightSwitch`·`AmbientLightBrightness`·`AmbientLightBrightnessColor`, [SideMirror](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/side-mirror/entry) 의 `getHvacSideMirrorHeatState`·`setHvacSideMirrorHeat`·`checkHvacSideMirrorHeatCapabilities`. 권한은 [Declaring permission](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle-permission) 에 `CAR_LIGHTS`(Light)·`CAR_MIRRORS`(SideMirror)와 제어용 `CONTROL_CAR_*` 규칙이 안내돼 있다). 앱 마켓과 협의한 권한이 아니므로 market 빌드는 세 권한을 모두 뺀다: 그 빌드에서는 값이 읽히지 않아 기록·추천에서도 빠진다.
- 조절 축 확대 (11/12 구현): 좌판 길이(깊이, `moveSeatDepth`), 헤드레스트 높이(`moveSeatHeadrestHeight`), 안전벨트 높이(`moveSeatBeltHeight`)를 넣었다. 조회·알림·이동 모두 기존 권한(`CAR_SEATS`, `CONTROL_CAR_SEATS`)으로 된다 (Vehicle SDK 2.3.2 AAR 의 `@RequiresPermission` 확인). 헤드레스트 각도·앞뒤(`moveSeatHeadrestAngle`, `moveSeatHeadrestForeAft`)와 허리 지지대(`moveSeatLumbar*`)는 키·앉은키로 정할 근거가 없어 넣지 않았다.
- 기억만 하는 축 (11/12 구현): 허리 지지대 앞뒤(`moveSeatLumbarForeAft`)와 헤드레스트 각도(`moveSeatHeadrestAngle`)를 "체형 추천 없이 운전자가 맞춘 값을 기억하는 축"으로 넣었다. 체형으로 정할 근거가 없으므로 기본 추천은 여전히 없다: 처음에는 추천하지 않고 지금 위치를 그대로 두며, 그 축의 위치가 든 기록(출발할 때·직접 저장·피드백)이 2건 쌓이면 운전자가 평소 두던 위치(최근 기록일수록 크게 반영한 평균, 상황별 반영은 다른 축과 같음)를 추천·가이드·자동 조절 대상으로 삼는다. 조회·알림·이동 모두 기존 권한으로 된다 (AAR 확인). 쓰는 API 는 모두 Pleos Playground 개발 문서의 Vehicle SDK API Reference(Seat)에 공개돼 있다 (11/12 확인, `https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/vehicle/ai.pleos.playground.vehicle.api/seat/` 아래 `move-seat-lumbar-fore-aft`, `move-seat-headrest-angle`, `get-current-seat-lumbar-fore-aft-position`, `get-current-seat-headrest-angle-position`, `check-seat-lumbar-fore-aft-position-capabilities`, `check-seat-headrest-angle-position-capabilities`, `check-move-seat-lumbar-fore-aft-capabilities`, `check-move-seat-headrest-angle-capabilities`, `register-seat-lumbar-fore-aft-position`, `register-seat-headrest-angle-position`). 허리 옆 지지(`moveSeatLumbarSideSupport`)와 헤드레스트 앞뒤(`moveSeatHeadrestForeAft`)는 넣지 않았다: 옆 지지는 자세보다 코너링 때 몸을 잡는 취향이고, 헤드레스트 앞뒤는 각도와 같은 간격(머리 뒤)을 바꾸는 축이라 둘을 함께 움직이면 기억한 값이 서로 어긋난다.

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
| A-4 | P1 | 착좌 감지 | 주차(P) 중 운전석 착좌가 바뀌면 운전자 선택 화면으로 돌아가기 (`SeatOccupancy`). 앱이 실행 중일 때만 동작하고 앱을 스스로 띄우지는 않는다 |
| A-5 | P2 | 카메라·AI 자동 조절 | 카메라로 체형을 재고 앉은 자세를 보고 시트를 맞춘다. Pleos 개발 문서에 실내 카메라 API 가 공개되면 적용한다 (11/13 [SDK 사용 신청 가이드](https://document.pleos.ai/docs/pleos-only/create-my-project) 확인: 카메라 API 없음). 영상은 저장하지 않고 차 안에서만 처리한다 (기획서 6번 확대 계획) |
| A-6 | P1 | 자동 인식 (1단계: 기록으로 추측) | 앱을 켜거나 착좌가 바뀌면, 주행 시작 기록의 요일·시간대·최근 운전자로 앉은 사람을 추측해 "○○님이시죠?"를 보여 주고 3초 뒤 그 운전자 화면으로 넘어간다 (주차 중에만). "다른 사람이에요"로 바로 고칠 수 있고, 고친 사람으로 출발한 기록이 다음 추측에 반영된다. 카메라·생체정보를 쓰지 않는다. 2단계: 연결된 휴대폰, 3단계: 실내 카메라 API 가 공개되면 얼굴 인식 |

### B. 추천·시트 조절

시트 위치는 차종마다 단위가 달라서, 축별로 차량이 지원하는 범위 안의 비율(0~1)로 다룬다. 축은 아홉 개다. 자세: 앞뒤(foreAft), 높이(height), 등받이(backrest), 좌판 기울기(tilt), 좌판 길이(depth). 머리·벨트: 헤드레스트 높이(headrestHeight), 안전벨트 높이(beltHeight). 기억한 위치: 허리 지지대(lumbar), 헤드레스트 각도(headrestAngle) — 기본 추천이 없고 기록이 쌓인 뒤에만 추천하는 축이다 (`LEARNED_ONLY_AXES`). 차량이 지원하지 않는 축은 건너뛴다. 좌판 길이·헤드레스트 높이·안전벨트 높이는 전동이 아닌 차량이 많아, 차량이 위치를 알려 줄 때만 추천·미리보기·안내·자동 조절에 넣는다 (없는 차량은 네 축 그대로). 순서는 앉은 자세를 먼저 잡고 머리·벨트를 나중에 맞춘다. 화면에서는 머리·벨트 축이 있을 때만 "자세 / 머리·벨트" 묶음으로 나눠 보여 준다. 허리 지지대·헤드레스트 각도도 차량이 위치를 알려 줄 때만 다루고, 기억한 값이 생기면 "기억한 위치" 묶음으로 맨 뒤에 나온다. 그 전에는 축별 추천 아래에 "편하게 맞춰 두면 기억했다가 다음부터 맞춰 드려요" 한 줄만 보인다 (지원하지 않는 차량에서는 아무것도 달라지지 않는다). 음성·터치 피드백으로는 바꾸지 않는다.

| ID | 우선 | 기능 | 설명 |
| --- | --- | --- | --- |
| B-1 | P0 | 시트 상태 조회 | 축별 현재 위치, 범위, 이동 가능 여부 조회 (`checkSeat*Capabilities`, `getCurrentSeat*`) |
| B-2 | P0 | 추천 자세 계산 | 체형 기반 기본 추천 + 개인 보정(C-2). 키가 클수록 뒤로, 상체가 길수록 낮게. 다리(키 − 앉은키)가 길수록 좌판을 길게, 앉은키가 클수록 헤드레스트·안전벨트를 높게 (안전벨트는 헤드레스트보다 완만하게) |
| B-3 | P0 | 변경 미리보기 | 현재와 추천의 축별 차이 표시 |
| B-4 | SDK 기능 | 자동 조절 | 맞춤 자세 화면의 "자동으로 맞추기"(contest 빌드의 주 버튼): 운전자 확인 → P단 확인 → 축별로 목표 위치까지 이동 후 STOP (S-1~S-3). 움직이는 동안 진행 화면이 축마다 "움직이는 중 / 맞췄어요 ✓ / 기다리는 중"과 지금·목표 위치를 보여 주고, 끝나면 결과를 한 줄로 알린다 (맞춤 / 멈춤 / 실패한 이유). **시연 모드**(contest 빌드, 맞춤 자세 화면의 "시연 모드" 칩): 차량에 이동 명령을 보내지 않고 모의 위치가 같은 화면 흐름으로 목표까지 움직인다. 화면에 시연 모드임을 계속 표시하고, P단에서만 동작하고, 학습 기록에 남기지 않는다 |
| B-5 | P0 | 가이드 조절 (market 빌드의 주 경로) | 운전자가 시트 버튼을 조작하는 동안 실시간 조회로 축별 "조금 더 / 지나쳤어요 / 딱 좋아요 ✓" 안내. 모든 축이 허용 오차 안이면 완료 |
| B-6 | P0 | 현재 자세 저장 | 운전자가 직접 맞춘 자세를 저장 (학습 데이터). 목표와 달라도 그 위치를 최종값으로 인정 |
| B-7 | SDK 기능 | 멈추기 | 자동 조절 중 즉시 정지 (B-4와 함께). 진행 화면에서 누를 수 있는 것은 화면 폭을 다 쓰는 "멈추기" 하나다. 축 사이에서 눌러도 다음 축을 시작하지 않고, 진행 화면을 벗어나면 이동도 멈춘다 |

### C. 학습 (핵심 차별점)

| ID | 우선 | 기능 | 설명 |
| --- | --- | --- | --- |
| C-1 | P0 | 자세 기록 | 기본 추천(baseline)과 운전자가 최종으로 받아들인 자세(final)를 기록. 출처: 주행 시작 시 자세 / 직접 저장 / 터치 피드백 / 음성 피드백 (SDK 기능) |
| C-2 | P0 | 개인 보정 | 최근 10개 기록의 (final - baseline)을 최근일수록 크게(×0.7씩 감쇠) 평균. 축별 보정 폭은 ±0.3로 제한 |
| C-3 | P0 | 주행 시작 자세 학습 | 주행을 시작할 때(P단 해제) 시트 위치를 읽어 자동 기록. 운전자가 직접 고친 자세가 저절로 학습된다 |
| C-4 | P1 | 추천 근거 설명 | "지난번에 등받이를 더 세우셔서 반영했어요" |
| C-5 | P1 | 상황별 자세 | 운전자가 맞춤 자세 화면에서 상황(평소 / 출퇴근 / 장거리 / 시내)을 고른다. 주차(P) 중에만 고를 수 있고, 고르지 않으면 평소다 (S-5). 자세 기록(C-1)과 진행 중인 주행에 상황을 함께 남기고, 추천은 고른 상황의 기록으로 보정한다: 그 상황의 기록이 3건 이상이면 그 기록만, 1~2건이면 (기록 수 ÷ 3)만큼만 반영하고 나머지는 전체 기록, 없으면 전체 기록. 추천 근거(C-4)도 상황을 말한다 ("장거리에서는 등받이를 더 눕히셔서 반영했어요"). 상황별 기본 차이는 넣지 않고 운전자 본인의 기록으로만 달라진다 (기본값으로 쓸 근거 자료가 없다). 다른 운전자를 고르거나 운전석 착좌가 바뀌면 평소로 돌아간다. 예전 기록(상황 없음)은 평소로 읽는다. **내비 경로로 상황 제안**: 주차(P) 중이고 아직 상황을 고르지 않았을 때(평소) 내비게이션 목적지가 있으면 남은 거리·시간으로 상황을 제안한다 ("목적지까지 120km, 1시간 30분쯤이에요. 장거리 자세로 볼까요?"). 예상 시간 60분 이상(D-1 과 같은 기준)이거나 80km 이상이면 장거리, 20km 이하면 시내, 그 사이는 제안하지 않는다. 출퇴근은 경로만으로 알 수 없어 제안하지 않는다. 제안만 하고 운전자가 눌러야 바뀐다. 거리·시간 값만 그 순간에 쓰고 저장하지 않으며, 좌표·목적지 이름은 읽지 않는다 (NaviHelper `getDestinationInfo`, 권한 `NAVI_ROUTE`) |

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
| E-1 | P0 | 온도 취향 기록 | 출발할 때(P 해제) 시트 열선·통풍, 핸들 열선, 운전석 공조 설정 온도, 풍량, 바람 방향과 탈 때 실내 온도를 기록 (`getHvacSeatTemperature`, `getHvacSeatVentilationState`, `getHvacSteeringWheelHeatState`, `getHvacTemperature`, `getHvacFanSpeed`, `getHvacFanDirection`, `getHvacTemperatureCurrent`). 통풍은 열선과 별개 값이다. 풍량·바람 방향은 운전자가 직접 맞춘 날만 남긴다: 자동 공조(`getHvacAutoState`)이거나 공조가 꺼져 있으면(`getHvacPowerState`) 차가 정한 값이라 뺀다 |
| E-2 | P0 | 온도 취향 추천 | 지금 실내 온도와 ±5℃ 안이었던 최근 기록 5건의 가운데 값. 바람 방향은 가장 자주 고른 방향. 열선과 통풍이 함께 추천되면 최근에 켠 쪽만 남긴다. 비슷한 날이 없으면 최근 기록 기준 |
| E-3 | P0 | 평소 온도로 맞추기 | 맞춤 자세 화면의 "내 운전석 온도" 카드. 주차(P) 중 운전자가 누르면 다른 항목만 바꾼다 (`setHvacSeatTemperature`, `setHvacSeatVentilation`, `setHvacSteeringWheelHeat`, `setHvacTemperature`, `setHvacFanSpeed`, `setHvacFanDirection`). 자동 공조 중이거나 공조가 꺼져 있으면 풍량·바람 방향은 그대로 둔다 (자동을 풀거나 공조를 켜지 않는다). 바람 방향은 "얼굴 / 발 / 앞유리"로 보여 주고, 바뀔 항목에만 지금 값을 붙인다. 네이티브에서도 기어 P 확인 |
| E-4 | SDK 기능 | 음성으로 온도 맞추기 | "말로 알려 주기"에서 온도 이야기도 듣는다: "추워요 / 더워요"(실내 온도 1℃, "너무"·"많이"면 2℃. 온도를 못 바꾸는 차는 시트 열선·통풍 1단), "핸들 열선 켜 줘", "시트 열선 꺼 줘", "통풍 틀어 줘", "바람 좀 줄여 줘"(풍량 1~2단), "평소 온도로 맞춰 줘"(E-2 추천 그대로). LLM 없이 규칙으로 해석한다. 열선·통풍은 한 번에 1단(끄기는 바로 0), 값은 차량 범위 안으로 자르고, 말로는 냉각 쪽으로 보내지 않으며, 열선을 켜면 켜져 있던 통풍을 끈다. 차량이 지원하지 않는 항목은 "이 차에서는 바꿀 수 없어요", 자동 공조·공조 꺼짐이면 풍량은 그대로. 바람 방향과 공조 전원은 말로 바꾸지 않는다. 시트 자세와 온도가 한 문장에 섞이면 어느 쪽도 만들지 않고 하나씩 말해 달라고 한다. 조절안("지금 → 바뀔 값")을 화면에 보여 주고 운전자가 "이대로 맞추기"를 누른 뒤에만, 주차(P) 중에만 `applyDriverComfort` 로 맞추고 결과를 음성으로 알린다 (S-4). 음성에 동의한 운전자, contest 빌드에서만 |
| E-5 | P1 | 사이드미러 열선 | 온도 항목과 같은 흐름으로 기록·추천·적용한다 (`getHvacSideMirrorHeatState`, `checkHvacSideMirrorHeatCapabilities`, `setHvacSideMirrorHeat`). 추운 날·습한 날에 켜는 것이라 기준도 같다: 지금 실내 온도와 ±5℃ 안이었던 최근 기록 5건의 가운데 값. 좌우 거울이 따로 구역으로 오는 차량은 둘 다 같은 단계로 맞춘다. 권한 `CAR_MIRRORS`·`CONTROL_CAR_MIRRORS` |
| E-6 | P1 | 무드등 취향 | 출발할 때 무드등 켜짐·밝기·색을 기록한다 (`getAmbientLightSwitch`, `getAmbientLightBrightness`, `getAmbientLightBrightnessColor`). 온도와 무관한 취향이라 **실내 온도로 거르지 않고 최근 기록 5건**에서 고른다 (실내 온도로 거르면 계절이 바뀔 때마다 추천이 사라진다): 켜짐·색은 가장 자주 고른 값, 밝기는 가운데 값. 꺼 둔 날은 밝기·색을 남기지 않고, 평소 꺼 두는 운전자에게는 끄기만 추천한다. 자동(AUTOMATIC)처럼 켜짐·꺼짐이 아닌 상태는 기록하지 않는다. 색은 차량이 준 정수 값을 그대로 되돌려 보내고 화면에서는 "평소 색"으로 부른다 (값의 뜻이 차종마다 다르다). 카드에서는 타일 하나("무드등: 켬 · 밝기 3단 · 평소 색")로 묶어 온도 항목 아래에 따로 둔다. 주차(P) 중 운전자가 누르면 다른 항목만 바꾼다 (`setAmbientLightSwitch`, `setAmbientLightBrightness`, `setAmbientLightBrightnessColor`), 네이티브에서도 기어 P 확인. 권한 `CAR_LIGHTS` (SDK 2.3.2 는 바꾸는 메서드에도 이 권한을 요구한다). 전조등·안개등 같은 주행 등화는 읽지도 바꾸지도 않는다 |

## MVP 시연 시나리오 (Pleos 에뮬레이터)

공지에 따라 2차 PT는 에뮬레이터 구동 화면으로 시연할 수 있다. 1차 개발 산출물은 화면 녹화·프로토타입도 인정된다.

1. 운전자 등록 후 선택 (A-1, A-2)
2. 시트 상태 조회 → 추천 자세 계산 → 변경 미리보기 (B-1~B-3)
3. 시트 맞추기: 자동 조절("자동으로 맞추기" → 확인 → 축별 진행 → 완료, 도중에 "멈추기". B-4, B-7) 또는 가이드 조절(시트 값을 바꾸면 화면이 "조금 더 뒤로… 딱 좋아요 ✓" 안내. B-5)
4. 운전자가 등받이를 목표보다 더 세우고 주행 시작 → 주행 시작 자세 자동 기록 (C-3)
5. 장거리 주행 후 도착 → "편하셨나요?" → 터치로 "등받이 세우기" 선택 (D-1, D-2)
6. 다음 탑승 때 보정이 반영된 추천 (C-2)

에뮬레이터의 기어·도착 값은 Virtual Console로 바꿔 시연한다. 시연·영상·2차 PT 는 **contest 빌드**(`npm run android:build:release`, 에뮬레이터는 `npm run android:emulator`)로 하고, 자동 조절(B-4, B-7)과 음성(D-3, D-4)도 함께 보여 준다. 기획서·PT 에는 "에뮬레이터에서 시연"으로 쓴다 (11/12 운영사무국 최종 답변).

- 시트 장면 (11/11 결정, 11/12 보완): 에뮬레이터는 시트 위치 값이 바뀌지 않으므로, 자동 조절·가이드 조절은 실제 앱 화면 흐름(확인 → 이동 중 → 멈추기·완료)을 녹화하고 "에뮬레이터는 시트 위치가 바뀌지 않음, 실차에서 이동"을 자막으로 밝힌다. 이 흐름은 **시연 모드**(자동 조절: 맞춤 자세 화면의 "시연 모드" 칩, 가이드 조절: 가이드 화면의 "시연 모드로 보기")로 보여 주고, 화면에도 시연 모드임이 계속 표시된다. 그래픽 합성은 하지 않는다 (2차 PT 에서 실제 앱과 비교된다).
- 주행 후 질문(5번): contest 빌드는 1분 주행 후 주차하면 질문이 뜬다. Virtual Console 에서 기어를 D → (1분) → P 로 바꾼다.
- 에뮬레이터 v2.1.0 확인 결과 (11/12, 합쳐진 develop 의 contest debug 빌드): 시나리오 1~6 이 이어서 통과한다 (자동 조절·가이드 조절은 시연 모드, 실제 자동 조절은 이동 명령·STOP 전달까지). 에뮬레이터 한계는 다음과 같다.
  - 기어 D 에서는 시스템이 앱을 흐리게 가리고 "주행 중에는 사용할 수 없습니다."를 띄운다 (앱은 종료되지 않고 P 로 돌아오면 그대로 이어진다). 주행 중 화면은 시연할 수 없다.
  - 시트: 기본 네 축은 0% 로만 읽히고, 좌판 길이·헤드레스트 높이·안전벨트 높이는 50%·50%·100% 로 읽힌다. 허리 지지대·헤드레스트 각도는 알려 주지 않는다.
  - 온도: 시트 열선·핸들 열선·공조 온도·풍량은 Virtual Console(`PUT /vehicle/hvac`, `/vehicle/steering-wheel-heat`)에서 바꾸면 읽히고 앱이 맞춘 값도 반영된다. 바람 방향은 지금 값만 읽히고 고를 수 있는 방향 목록이 비어 있어 앱이 바꾸지 않는다. 열선·공조는 값이 바뀔 때 알려 주는 알림이 없어 카드는 주차 중 5초마다 다시 읽는다.
  - 무드등: 밝기·색(RGB 값)은 읽히지만 켜짐 스위치는 0 으로만 읽혀 "꺼짐"으로 나온다. 사이드미러 열선은 0(범위 0~3)으로 읽히고 Virtual Console 에 바꾸는 항목이 없다. 내비 목적지를 정하는 항목도 없어 경로로 상황 제안(C-5)은 시연할 수 없다.
  - 다른 좌석 (11/13, 차량 속성 덤프 `dumpsys car_service --hal` 로 확인): 착좌(`SEAT_OCCUPANCY`)는 운전석·동승석·2열 좌·중·우에, 시트 앞뒤 위치·이동(`SEAT_FORE_AFT_POS`·`_MOVE`, 범위 0~100)은 운전석·동승석·2열 좌·우에 정의돼 있다. Virtual Console 에도 passenger·rear_left·rear_right 의 위치·착좌 항목이 있다. 위치 값이 0 으로만 읽히는 한계는 운전석과 같을 것으로 본다 (앱으로 읽어 보지는 않았다). 앱은 운전석만 다루고, 동승석·뒷좌석은 기획서의 확대 계획에 적었다.
  - 호스트가 바쁘면 에뮬레이터의 차량 서비스(carwatchdogd·VHAL)가 다시 시작하면서 앱이 종료된다. 녹화할 때는 다른 빌드를 멈추고, 종료되면 앱을 다시 실행한다 (콜드 부트는 필요 없다).

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
