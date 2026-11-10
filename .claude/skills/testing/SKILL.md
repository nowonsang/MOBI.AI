---
name: testing
description: MOBI.AI 자동화 테스트(Jest 단위 테스트 + Android 빌드 검증) 규칙과 push 전 검증 절차. git push, 커밋 후 원격 반영, 테스트 작성·수정, model 순수 로직·네이티브 모듈·app.config.ts 를 바꿀 때 반드시 로드한다. npm run verify 로 린트·타입·단위 테스트·Android 빌드를 통과한 뒤에만 push 한다.
---

# 테스트와 push 전 검증

## 1. push 규칙 (AI 필수)

1. **push 하기 전에 반드시 `npm run verify` 를 실행하고, 전부 통과했을 때만 push 한다.**
   - `verify` = `lint` → `typecheck` → `test`(Jest) → `scripts/android/build.mjs debug --arch arm64-v8a`(prebuild + Gradle `assembleDebug`, Kotlin 컴파일·Pleos SDK 의존성 확인)
2. 실패하면 push 하지 않고, 원인을 고친 뒤 다시 `verify` 를 돌린다. 테스트를 지우거나 `skip` 해서 통과시키지 않는다.
3. `git push --no-verify` 로 pre-push 훅을 건너뛰지 않는다.
4. 사용자에게 보고할 때 통과한 테스트 수를 함께 알린다.

`.githooks/pre-push` 가 같은 검사를 자동으로 돌린다 (활성화는 `project-setup` 스킬 5단계).

### 1-1. 브랜치 머지와 정리 (AI 필수)

PR 은 만들지 않는다. 브랜치에서 작업하고, 검사를 통과하면 `master` 에 바로 머지한 뒤 그 브랜치를 지운다.

1. `master` 에서 바로 작업하지 않고 브랜치를 만든다 (`git switch -c <브랜치>`).
2. 작업이 끝나면 `npm run verify` 가 전부 통과하는지 확인한다.
3. `master` 를 최신으로 받고(`git fetch origin`) 브랜치를 그 위로 올린다: `git rebase origin/master`. 충돌을 고쳤다면 `verify` 를 다시 돌린다.
4. fast-forward 로 머지하고 push 한다: `git switch master && git pull --ff-only && git merge --ff-only <브랜치> && git push origin master`
   - `master` 가 다른 폴더(worktree)에 체크아웃돼 있어 전환할 수 없으면 브랜치에서 `git push origin <브랜치>:master` 로 올린 뒤, 그 폴더에서 `git pull --ff-only` 한다.
5. 머지 직후 브랜치를 지운다: `git branch -d <브랜치>`, 원격에 올린 적이 있으면 `git push origin --delete <브랜치>`, 그리고 `git fetch --prune`. 그 브랜치용 worktree 가 있으면 `git worktree remove <경로>`.
6. `master` 와 아직 머지되지 않은 브랜치(다른 사람이 작업 중인 브랜치 포함)는 지우지 않는다.

### 1-2. 여러 세션이 동시에 작업할 때 (AI 필수)

**한 폴더(체크아웃)는 한 세션만 쓴다.** 두 세션이 같은 폴더에서 브랜치를 바꾸거나 커밋하면 서로의 HEAD·스테이징을 건드린다 (2026-11-11 실제로 한 세션의 `git switch` 가 다른 세션의 작업 브랜치에서 HEAD 를 빼 버렸다).

1. 작업을 시작할 때와 커밋·브랜치 전환 직전에 확인한다. 내가 만들지 않은 변경·스테이징이 `git status` 에 있거나, 내가 하지 않은 브랜치 전환이 `git reflog -5` 에 있으면 다른 세션이 이 폴더를 쓰는 중이다. 사용자가 세션을 여러 개 띄워 작업 중이라고 한 경우도 같다.
2. 그러면 세션마다 **별도 worktree** 에서 작업한다. 위치는 저장소 밖 형제 폴더 `../MOBI.AI-worktrees/<브랜치>` 다. 저장소 안(`.claude/worktrees/` 등)에 두면 lint·tsc·Jest·Metro 가 복사본까지 읽는다.

   ```bash
   git fetch origin
   git worktree add ../MOBI.AI-worktrees/<브랜치> -b <브랜치> origin/master
   cd ../MOBI.AI-worktrees/<브랜치> && npm install
   ```

   Claude Code 세션은 그 폴더에서 새로 시작하거나 `EnterWorktree`(path) 로 들어간다.
3. worktree 에는 `.env.local` 이 없다. 필요하면 **사용자가 직접** 복사하고 `npm run secure:env` 를 실행한다 (AI 는 복사하지 않는다). 없으면 음성 인식·안내는 온디바이스 모드로 동작한다.
4. `android/` 는 worktree 마다 따로 생긴다 (첫 빌드는 수 분). 에뮬레이터와 개발 서버 포트(8081)는 하나를 같이 쓰므로 `npm run android:emulator` 는 **한 번에 한 세션만** 실행한다. 다른 폴더의 개발 서버가 8081 을 쓰고 있으면 앱이 그 폴더의 JS 를 불러오므로, 실행 전에 `lsof -nP -iTCP:8081 -sTCP:LISTEN` 로 어느 폴더의 서버인지 확인한다.
5. 다른 세션이 쓰는 폴더에서는 `git switch`·`git commit`·`git stash`·`git reset`·`git checkout -- <파일>` 을 하지 않는다. 그 폴더의 파일도 고치지 않는다.
6. 머지는 1-1 과 같다. worktree 에서는 `master` 로 전환할 수 없으므로 1-1 4번의 방법대로 `git push origin <브랜치>:master` 로 올린다. 원래 폴더의 `master` 는 그 폴더를 쓰는 세션이 없을 때 `git pull --ff-only` 로 맞춘다.
7. 머지 직후 worktree 와 브랜치를 지운다: `git worktree remove ../MOBI.AI-worktrees/<브랜치>` → 1-1 5번.

## 2. 실행 방법

| 명령 | 대상 | 용도 |
| --- | --- | --- |
| `npm test` | `src/**/*.test.ts` (jest-expo) | 순수 로직 단위 테스트 |
| `npx jest src/features/bodyfit/model/bodyfit-feedback.test.ts` | 특정 파일만 | 디버깅 |
| `npm run android:build:debug` | prebuild + `./gradlew assembleDebug` | 네이티브 모듈·설정·SDK 의존성 확인 (처음은 수 분) |
| `npm run android:emulator` | Pleos Connect 에뮬레이터를 켜고 빌드·설치·실행 (없으면 설치 안내 후 중단, `project-setup` 스킬 2·6장) | 직접 확인 |
| `npm run android:device` | 내 기기에 빌드·설치·실행 (`-- --device <시리얼>`) | 직접 확인 |

`android:emulator`·`android:device` 는 빌드 전에 prebuild 를 다시 하고, 기본은 contest 빌드다. market 빌드로 확인할 때는 `-- --market` 을 붙인다.
| `npm run verify` | 위 전부 | push 전 필수 |

- 빌드 스크립트는 기존 `android/` 를 유지한 채 prebuild 한다. 설정이 꼬였으면 `npm run android:prebuild:clean` 으로 다시 만든다.
- `verify` 의 빌드는 컴파일 확인용이라 C++ 를 arm64-v8a 하나만 빌드한다 (네 가지 CPU 구조를 모두 빌드하면 몇 배 느리다). `android:emulator`·`android:device` 는 연결된 기기에 맞는 구조로 빌드한다.
- Android 빌드에는 JDK 17 과 Android SDK(`ANDROID_HOME`)가 필요하다 (`project-setup` 스킬).

## 3. 테스트 작성 규칙

- 위치: 대상 파일 옆 `<같은 이름>.test.ts` (예: `model/bodyfit-recommend.test.ts`).
- **`model` 의 순수 로직을 추가·변경하면 같은 작업에서 테스트도 추가·수정한다.** 특히:
  - 차량에 보낼 값을 만드는 계산 (비율 ↔ 원시 값, 범위 자르기)
  - 신뢰하지 않는 입력의 검증 (음성 인식 결과 해석, 저장된 값, 사용자 입력 파싱)
  - 학습·추천 계수 (방향성과 0~1 범위 유지)
- 테스트 이름은 동작을 한국어 문장으로 쓴다 ("키가 클수록 시트를 뒤로 보낸다").
- 테스트는 `@/shared/pleos/pleos.types` 만 쓰고 네이티브 모듈을 부르지 않는다. 차량 호출이 필요한 로직은 값을 인자로 받도록 `model` 로 분리해서 테스트한다.
- 테스트에 실제 비밀 값·개인정보를 쓰지 않는다. 외부 서비스(공유 Supabase 포함)에 쓰기를 하는 테스트를 만들지 않는다.

## 4. 차량 동작 확인 (수동)

자동 테스트로 확인할 수 없는 차량 동작은 Pleos Connect 에뮬레이터에서 직접 확인하고 결과를 커밋 메시지에 적는다.

1. 에뮬레이터는 **콜드 부트**로 켠다 (퀵 부트면 VHAL 이 동작하지 않는다).
2. 기어 P 에서 "추천 자세로 맞추기" → 시트가 움직이고 멈추는지, 움직이는 중 "멈추기"가 동작하는지
3. 기어를 D 로 바꾸면 버튼이 비활성화되고, 움직이는 중이었다면 즉시 멈추는지
4. "말로 알려 주기" → 음성 인식 → 조절안 확인 → 조절
5. 주행 규제 켜기·끄기: `adb shell cmd hmg_car_service --service drivingstate driving_regulation on` (끄기는 `off`). 기어·착석 등은 Virtual Console(`adb forward tcp:8088 tcp:8088` → http://127.0.0.1:8088/)에서 바꾼다.
6. **폼 팩터 테스트**: 에뮬레이터를 별도 창으로 실행(Running Devices 창·Headless 금지) → Host Display Bridge(`https://nexus-playground.pleos.ai/repository/raw-releases/host-display-bridge/1.0.0/host-display-bridge.zip`, Go 1.22+, `go run . --avd "<AVD 이름>"`) → 에뮬레이터의 FormFactorConsole 에서 Display preset·Orientation(Portrait/Landscape) 선택 → 가상 디스플레이 생성 → 잘림·겹침, 글자·아이콘 크기, 가로·세로 배치, 터치·화면 전환 확인. 12.9인치 Portrait, 14.6인치 Landscape 는 반드시 본다.
7. 차량이 아닌 기기(일반 Android 에뮬레이터)에서는 "차량에 연결되어 있지 않아요" 안내가 나오고 앱이 죽지 않는지. 이 항목만 `npm run android:emulator -- --avd <일반 AVD 이름>` 으로 AVD 를 직접 골라 실행한다 (`--avd` 가 없으면 항상 Pleos Connect 에뮬레이터에 올라간다).

## 5. 실패했을 때

1. Android 빌드 실패: Gradle 로그의 첫 `e:`(Kotlin 컴파일 오류) 또는 `Could not resolve`(의존성) 줄을 찾는다.
   - `Could not resolve ai.pleos.playground:...` → `app.config.ts` 의 `extraMavenRepos` 와 SDK 버전(`modules/pleos-connect/android/build.gradle`)을 확인한다.
   - Kotlin 타입 오류 → SDK 시그니처를 AAR 에서 확인한다 (`project-architecture` 스킬 5장).
2. Jest 실패: `@/` 경로를 못 찾으면 `package.json` 의 `jest.moduleNameMapper` 를 확인한다.
