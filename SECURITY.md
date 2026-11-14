# 보안 정책 (MOBI.AI · BodyFit AI)

이 앱은 차량 시트를 실제로 움직이고 운전자의 체형 정보를 다룬다. 그래서 보안 문제는 개인정보 유출뿐 아니라 물리적 사고로 이어질 수 있다고 보고 설계했다. 이 문서는 무엇을 지키는지, 어디서 지키는지, 무엇이 아직 남았는지를 적는다. 개발 규칙의 원문은 [`.claude/skills/secure-coding/SKILL.md`](.claude/skills/secure-coding/SKILL.md)에 있다.

## 취약점 신고

- 취약점을 찾으면 공개 이슈에 재현 방법을 적지 말고, 저장소의 **Security → Report a vulnerability**(비공개 신고)로 알려 주세요. 비공개 신고가 열려 있지 않으면 재현 방법 없이 "보안 문의" 제목의 이슈만 남겨 주시면 연락드립니다.
- 지원 대상은 `master` 의 최신 커밋과 최신 [릴리스](https://github.com/nowonsang/MOBI.AI/releases)다.

## 지키는 것과 막는 방법

| 위험 | 막는 방법 | 코드 |
| --- | --- | --- |
| 주행 중 시트가 움직인다 | 이동 전과 위치가 바뀔 때마다 **네이티브에서** 기어 P 를 다시 확인한다. 기어를 읽지 못하면 주차가 아닌 것으로 본다 | `DriverSeat.kt` `moveLocked`·`followUntil`, `GearMonitor.kt` `isParked` |
| 시트가 멈추지 않는다 | 성공·실패·취소·시간 초과(30초) 모두 `finally` 에서 STOP 을 보낸다. 목표에서 멀어지면 멈춘다. 앱이 화면에서 사라져도 STOP 을 보낸다 | `DriverSeat.kt` `moveLocked`·`stopAllBlocking` |
| 범위 밖 값으로 움직인다 | 목표값을 차량이 알려 준 범위로 자른다. 범위를 모르거나 쓰기 권한이 없는 축은 움직이지 않는다 | `DriverSeat.kt` `bounds`·`canMove` |
| 확인 없이 움직인다 | 화면의 확인 대화상자에서 운전자가 눌러야 시작하고, 멈추기 버튼이 항상 보인다 | `bodyfit-seat-screen.tsx`, `src/shared/ui/confirm-dialog.tsx` |
| 음성으로 차량을 조작한다 | 음성 인식 결과는 신뢰하지 않는 입력이다. 정해진 규칙으로 조절안만 만들고, 운전자가 화면에서 확인해야 적용한다 | `bodyfit-voice-answer.ts`, `bodyfit-voice-comfort.ts` |
| 조작된 QR 코드 | 크기(600자) → 종류·버전 → 형식(zod strict) → 범위 순으로 검증하고 하나라도 어긋나면 저장하지 않는다. 통과해도 시트는 움직이지 않는다 | `bodyfit-transfer.ts` `decodeTransfer` |
| 딥링크(`mobiai://`) 파라미터 | 화면 주소의 값은 사용자 입력으로 본다. 숫자·열거값으로만 해석하고, 없는 운전자는 빈 화면으로 처리한다. 주소만으로 차량을 움직이는 경로는 없다 | `src/app/(bodyfit)/**` |
| 체형 정보 유출 | 기기 안에만 **AES-GCM** 으로 암호화해 저장한다. 키는 Android Keystore 가 보호한다(`expo-secure-store`). 서버로 보내지 않고, 자동 백업을 끄고, 운전자가 지울 수 있다. 읽을 때 zod 로 검증한다 | `encrypted-storage.ts`, `bodyfit.storage.ts`, `app.config.ts` `allowBackup: false` |
| 카메라 영상 유출 | 프레임은 메모리에서 분석하고 버린다. 파일·네트워크·JS 로 넘기지 않는다(JS 는 관절 좌표나 QR 글자만 받는다). 카메라 서비스는 다른 앱이 부를 수 없다(`exported=false`) | `modules/pose-camera/**` |
| 동의 없는 수집 | 수집 항목·목적·보관·거부 권리를 알리고 "동의하고 등록하기" 버튼으로만 동의받는다. 음성·주행 중 카메라는 별도 선택 동의이며, 동의를 거두면 기록을 지운다 | `bodyfit-consent-notice.tsx`, `bodyfit.storage.ts` `updateBodyProfile` |
| 비밀 값이 저장소·APK 에 들어간다 | `.env*`·키 파일은 gitignore 대상이고, 커밋 전 훅이 비밀 파일과 키 패턴을 막는다. `EXPO_PUBLIC_*`·앱 설정에는 비밀 값을 넣지 않는다. 공개하는 APK 는 `.env.local` 이 없는 폴더에서 빌드한다 | `.githooks/pre-commit`, `scripts/check-staged-secrets.mjs`, `app.plugin.js` |
| 과한 권한 | Pleos 권한은 용도 주석과 함께 선언하고, 승인 전 권한은 market 빌드에서 뺀다. Expo 기본 템플릿이 넣는 외부 저장소·다른 앱 위에 그리기·진동·생체 인증 권한은 제거한다 | 모듈 `AndroidManifest.xml`, `app.config.ts` `blockedPermissions` |
| 릴리스 APK 분석·변조 | R8 로 축소·난독화하고 배포용 인증서(v2·v3)로 서명한다. 릴리스 빌드는 디버깅이 꺼져 있고 평문 통신을 허용하지 않는다 | `app.config.ts`, README 'APK 서명' |
| 공유 DB 키 유출 | 앱은 Supabase 에 접속하지 않는다. `@supabase/*` import 는 ESLint 에러다 | `eslint.config.mjs` |

### 기기 밖으로 나가는 데이터

앱 코드가 직접 보내는 네트워크 요청은 없다(`fetch`·WebView·외부 링크 열기 없음). 다만 앱에 포함된 SDK 두 가지는 스스로 서버와 통신한다.

| SDK | 보내는 것 | 보내지 않는 것 | 끌 수 있는지 |
| --- | --- | --- | --- |
| Pleos STT·TTS | 음성 기능을 켠 운전자의 음성(서버 모드일 때) | 체형 정보, 카메라 영상 | 음성 기능은 선택 동의이며, 동의한 운전자에게만 마이크를 연다 |
| Google ML Kit (자세 인식·QR 읽기) | 진단·사용 통계: 기기·앱 정보, 설치별 식별자, 처리 시간, 이미지 형식·해상도, 오류 코드 ([Google 공개 문서](https://developers.google.com/ml-kit/android-data-disclosure)) | 카메라 영상, 관절 좌표, QR 내용. 인식은 기기 안에서만 한다 ([ML Kit 약관](https://developers.google.com/ml-kit/terms)) | Google 이 끄는 방법을 제공하지 않는다 |

ML Kit 은 원격 설정도 받아 온다. 이 통계 전송(`com.google.android.datatransport`)은 라이브러리 동작이라 앱에서 막을 수 없고, 2026-11-13 에뮬레이터 로그로 실제 전송을 확인했다. 운전자 등록 화면의 안내에 이 내용을 적었다 (README 'ML Kit').

## 자동 검사

- 커밋 전: 비밀 파일·키 패턴 검사 (`.githooks/pre-commit`)
- push 전: `npm run verify` — ESLint(계층·금지 import), 타입 검사, 단위 테스트, Android 빌드 (`.githooks/pre-push`)
- GitHub: secret scanning 과 push protection 사용

## 알려진 한계

- **Pleos 앱 등록 정보**(`PLEOS_CLIENT_ID`·`PLEOS_CLIENT_SECRET`)를 넣어 빌드한 APK 에서는 값을 꺼낼 수 있다. 모바일 앱의 구조적 한계라서, 공개 APK 에는 넣지 않고 유출되면 Pleos Playground 에서 재발급한다.
- **내보내기 QR** 은 암호화하지 않는다. 화면에만 그리고, 체형 정보가 들어 있음을 그 화면에서 알린다.
- **의존성**: `npm audit` 에 남은 항목은 모두 개발·빌드 도구(Expo CLI, Jest, ESLint)가 쓰는 `glob`·`minimatch`·`deepmerge` 이고 APK 에 들어가지 않는다. Expo SDK 와 어긋나지 않게 강제 업그레이드는 하지 않았다 (README '의존성 보안 메모').
- **실차 미검증**: 시트 이동·기어 전환·음성은 Pleos Connect 에뮬레이터에서만 확인했다.
- git 이력에는 이전 웹 버전(Next.js + Supabase)의 코드가 남아 있다. 키 값이 커밋된 적은 없다 (2026-11-14 전체 이력 검사).
