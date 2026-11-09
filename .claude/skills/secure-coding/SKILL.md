---
name: secure-coding
description: MOBI.AI 팀 공용 보안·안전 코딩 규칙 (Expo/React Native 차량 앱). 차량 제어(시트 등) 코드, Pleos 권한·앱 등록 정보, 환경 변수·비밀 값, 개인정보(체형) 저장, 음성 입력 처리, 외부 요청, 의존성 추가, 네이티브 모듈을 작성하거나 수정·리뷰할 때 반드시 로드한다. 보안 점검이나 감사 요청에도 사용한다.
---

# MOBI.AI 보안·안전 코딩 규칙

이 앱은 **실제 차량을 움직인다.** 보안 실수가 개인정보 유출을 넘어 물리적 사고로 이어질 수 있다. 애매하면 멈추고 사용자에게 확인한다.

## 1. 차량 제어 안전 (가장 중요)

- **시트 등 차량을 움직이는 동작은 주차(기어 P) 중에만 한다.** 네이티브(`DriverSeat.kt`)가 이동 전과 위치가 바뀔 때마다 기어를 다시 확인하고, P 가 아니면 즉시 멈춘다. JS 쪽 확인만 믿지 않는다.
- 기어를 확인할 수 없으면 **주차가 아닌 것으로 본다** (안전 쪽으로 실패).
- 움직이기 전에 운전자 확인을 받는다 (확인 대화상자: "시트 주변에 물건이나 사람이 끼지 않았는지"). 화면에는 언제나 **멈추기** 버튼이 보여야 한다.
- 이동은 항상 끝에서 멈춤(STOP)을 보낸다: 성공·실패·취소·시간 초과 모두 `finally` 에서. 목표에서 멀어지면 멈춘다.
- 목표값은 차량이 알려 준 범위(capability)로 자른다. 범위를 모르는 축은 움직이지 않는다.
- **음성 인식 결과로 바로 차량을 움직이지 않는다.** 결과는 신뢰하지 않는 입력이다: 정해진 축·방향·크기의 조절안으로만 바꾸고(`interpretByRules`), 조절안을 화면에 보여 준 뒤 운전자가 확인해야 움직인다.

## 2. 비밀 값과 환경 변수

- AI는 `.env*`, 키, 인증서 파일을 읽거나 출력하거나 수정하지 않는다. 훅과 deny 규칙으로 막혀 있으며, **우회를 시도하지 않는다**. 값이 필요하면 사용자에게 변수 이름만 묻는다.
- **`EXPO_PUBLIC_` 접두어 변수는 JS 번들에 그대로 들어가 APK 에서 누구나 꺼낼 수 있다.** 비밀 값에 절대 붙이지 않는다.
- 앱 설정(`app.config.ts`)의 값은 `expo-constants` 로 JS 에 노출된다. 비밀 값을 앱 설정이나 config plugin 옵션으로 넘기지 않는다. 필요하면 config plugin 안에서 `process.env` 를 직접 읽어 네이티브 쪽에만 넣는다 (`modules/pleos-connect/app.plugin.js` 참고).
- Pleos 앱 등록 정보(`PLEOS_CLIENT_ID`, `PLEOS_CLIENT_SECRET`)는 `.env.local` 에만 두고, prebuild 가 생성 폴더(`android/`, gitignore)의 매니페스트에만 넣는다. 그래도 **빌드된 APK 에서는 추출할 수 있으므로** 유출되면 Pleos Playground 에서 재발급한다.
- `.env*` 파일은 권한 600(본인만 읽기·쓰기)이어야 한다. `npm run secure:env` 로 맞춘다 (`project-setup` 스킬).
- 비밀 값·개인정보를 `console.log`, 에러 메시지, 화면 문구에 넣지 않는다. 코드, 테스트 데이터, README, 커밋 메시지에도 쓰지 않는다.
- 서명 키(`*.jks`, `*.keystore`)는 커밋하지 않는다 (gitignore·커밋 전 검사 대상).

## 3. 개인정보 (체형·자세 기록)

- 체형(키·몸무게·앉은키)과 자세 기록은 **기기 안(SQLite)에만** 저장하고 서버로 보내지 않는다. 밖으로 보내야 하는 기능은 사용자와 먼저 상의한다.
- 저장한 값을 읽을 때 zod 로 검증한다. 형식이 다르면 빈 값으로 본다.
- 운전자가 자기 정보를 지울 수 있어야 한다 (`useDeleteBodyProfile`: 프로필과 기록을 함께 삭제).
- 수집은 최소로: 꼭 필요한 값만 묻고, 선택 값(앉은키)은 비워도 동작해야 한다.

## 3-1. Pleos 앱 보안 가이드 (심사 기준)

- 기기에 저장하는 민감 정보(SQLite·SharedPreferences·파일·캐시)는 암호화하고, 키는 Android Keystore 에 둔다. 코드에 키를 하드코딩하지 않는다. 개인정보는 `src/shared/storage/encrypted-storage.ts`(AES-GCM, 키는 `expo-secure-store`)로만 저장한다. `expo-sqlite/kv-store` 를 직접 쓰지 않는다.
- 자동 백업은 끈다 (`app.config.ts` 의 `allowBackup: false`, 적용됨).
- 릴리스 빌드는 배포용 인증서로 서명하고 디버깅을 끈다 (README 'APK 서명': 키 정보는 `~/.gradle/gradle.properties` 에만).
- 승인 전 Pleos 권한이 필요한 기능은 `src/shared/config/app-variant.ts` 로 가리고, 앱 마켓 제출은 `npm run android:build:market` 으로 만든다. 디버그 로그에 민감 정보를 남기지 않는다.
- 필요 없는 컴포넌트(Activity·Service·Receiver·Provider)는 export 하지 않는다. 통신은 HTTPS(TLS 1.2 이상)만.
- 개인정보는 수집 항목·목적·보관 기간·거부 권리를 알리고 **명시적으로 동의**받는다 (동의 버튼 외의 동작은 동의가 아니다). 동의 철회 시 데이터를 지운다.

## 4. Supabase (다른 서비스와 공유하는 프로젝트)

- **앱에서 Supabase 에 직접 접속하지 않는다.** 앱 번들에 들어간 키는 누구나 꺼낼 수 있고, 이 프로젝트의 키는 실서비스인 공유 서비스와 공유된다. `@supabase/*` import 는 `src/` 에서 ESLint 에러다.
- DB 가 필요해지면 백엔드 구조(키를 서버에만 두는 API)를 사용자와 먼저 정한다. DB 규칙은 `supabase-schema` 스킬.
- AI는 원격 DB에 SQL을 실행하지 않는다. 연결 점검은 `npm run check:supabase` 로만 한다 (키 값은 출력되지 않는다).

## 5. Pleos 권한

- Pleos 권한은 **Pleos App Market 과 사전 협의·승인된 범위**에서만 쓸 수 있다. 쓰지 않는 권한을 선언하면 심사 탈락 사유다.
- 권한은 `modules/pleos-connect/android/src/main/AndroidManifest.xml` 에 **용도 주석과 함께** 추가하고, 이름은 SDK 메서드의 `@RequiresPermission` 값과 맞춘다. 권한을 추가하기 전에 사용자에게 알린다.
- 권한이 없으면 SDK 는 `onFailed` 로 예외를 넘긴다. 앱은 에러 코드로 안내 문구를 보여 주고 죽지 않아야 한다.

## 6. 외부 요청·링크

- 사용자 입력이나 음성 인식 결과로 만든 URL 을 열거나(`Linking.openURL`) 요청하지 않는다. 호출 대상 도메인은 코드에 고정한다.
- 딥링크(`mobiai://...`) 파라미터는 사용자 입력이다. 라우트에서 그대로 차량 제어에 쓰지 않는다.

## 7. 의존성

- 새 패키지는 `npx expo install` 로 꼭 필요할 때만 추가하고, 이유와 함께 사용자에게 알린다. 다운로드 수가 적거나 이름이 유명 패키지와 비슷한 패키지(typosquatting)는 피한다.
- 추가·업데이트 후 `npm audit` 결과를 확인한다. `package-lock.json` 을 함께 커밋한다.
- `npm audit fix --force` 는 메이저 버전을 바꿔 Expo SDK 와 어긋나게 만들 수 있으므로 쓰지 않는다.
- Pleos SDK 버전을 올릴 때는 Maven 저장소의 `maven-metadata.xml` 과 변경된 `@RequiresPermission`·deprecated 표시를 확인한다.

## 8. AI 작업 보호 장치 (수정 금지)

- `.claude/settings.json`, `.claude/settings.local.json`, `.claude/hooks/**` 는 AI가 수정할 수 없다. 변경이 필요하면 사용자가 직접 수정하고 PR 리뷰를 받는다.
- 훅이 명령을 막으면 다른 명령으로 우회하지 말고, 막힌 이유를 사용자에게 설명한다.
- 환경 변수를 통째로 출력하거나(`process.env` 전체, `printenv`), env 파일을 직접 불러오는 코드·명령을 만들지 않는다. 키가 필요한 작업은 기존 `npm run` 스크립트를 쓴다.
- 커밋은 `.githooks/pre-commit` 의 비밀 값 검사를, push 는 `.githooks/pre-push` 의 `npm run verify` 를 통과해야 한다. `--no-verify` 로 건너뛰지 않는다.

## 9. 체크리스트 (보안·차량 제어 코드를 바꿨을 때)

- [ ] 차량을 움직이는 코드는 네이티브에서 기어 P 를 확인하고, 모든 경로에서 STOP 을 보낸다
- [ ] 움직이기 전 운전자 확인을 받고, 멈추기 버튼이 보인다
- [ ] 음성·저장소·딥링크에서 온 값은 zod 로 검증하고 범위를 제한했다
- [ ] 비밀 값이 JS 번들·앱 설정·로그·화면에 들어가지 않는다 (`EXPO_PUBLIC_` 확인)
- [ ] 개인정보는 기기 안에만 저장하고, 지우는 방법이 있다
- [ ] 새 Pleos 권한은 용도 주석과 함께 추가하고 사용자에게 알렸다
- [ ] `npm audit` 확인, `npm run lint` / `typecheck` / `test` / `android:build:debug` 통과
