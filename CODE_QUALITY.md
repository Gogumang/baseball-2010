# 코드 품질 기준

토스 [Frontend Fundamentals](https://frontend-fundamentals.com/code-quality/code/) 의 좋은 코드 4기준(가독성 · 예측 가능성 · 응집도 · 결합도)을 이 프로젝트에 맞춰 적용한다.
모든 기준보다 앞서는 조건이 하나 있다: **게임 동작(결과 · 난수 굴림 차례 · 부수효과 차례)은 원본과 같아야 한다.** 읽기 좋게 고치다가 굴림 차례가 의심되면 원래 모양을 둔다.

## 1. 가독성 — 한 번에 머리에 담을 맥락을 줄인다

- **같이 실행되지 않는 코드는 나눈다.** 팀 · 투수 · 시즌 · 미션처럼 모드나 편(공격/수비)에 따라 갈리는 코드가 한 함수에 섞여 있으면 갈래별 함수로 나누고, 고르는 곳은 한 군데로 모은다.
- **로직 종류가 다르면 함수를 나눈다.** 긴 함수는 `판정 → 계산 → 적용` 단계로 나눈다.
- **구현 상세는 감춘다.** 호출하는 쪽은 "무엇을 하는지"만 읽히게, "어떻게"는 이름 붙인 함수 안으로.
- **복잡한 조건에 이름을 붙인다.** `isRunnerOnThird`, `canStealSecond` 처럼. 한 번 쓰이고 단순한 조건은 그대로 둔다.
- **매직 넘버에 이름을 붙인다.** 원본 바이너리 값은 이름 붙인 상수로 두고 근거 주소는 주석으로 남긴다(`// 0xb5824`).
- **위에서 아래로 읽히게 한다.** 이른 반환으로 중첩을 없애고(중첩 2단 이하), 중첩 삼항은 쓰지 않는다. 같은 값으로 갈래 치는 `if`/`switch` 사슬은 조회 표나 `ts-pattern` 으로.

## 2. 예측 가능성 — 이름만 보고 동작을 짐작할 수 있게

- **같은 종류 함수는 반환 모양을 맞춘다.** 예: 세이브 읽기는 모두 "값 또는 null", 검사 함수는 모두 boolean.
- **숨은 로직을 드러낸다.** 난수를 굴리거나 상태를 바꾸는 함수는 이름에 보이게 한다(`rollXxx`, `applyXxx`). 계산만 하는 함수(`xxxOf`)가 몰래 굴리거나 저장하지 않는다.
- **이름이 겹치지 않게 한다.** 같은 이름이 다른 뜻으로 두 곳에 있지 않게.

## 3. 응집도 — 함께 고쳐지는 것은 함께 둔다

- **함께 고쳐지는 파일은 같은 폴더에.** 도메인(하위 기능)별 폴더, 한 파일 한 책임. 시험 파일도 옆에 둔다.
- **같은 값은 한 곳에서 정의한다.** 원본 표 · 상수는 `shared/config/original` 같은 한 곳에서.

## 4. 결합도 — 고칠 때 영향 범위를 좁힌다

- **책임은 하나씩.** 한 파일 · 한 훅이 여러 화면 상태를 다 들고 있지 않게.
- **억지 공통화보다 중복을 허용한다.** 원본도 모드마다 코드가 따로다. 비슷해 보여도 따로 바뀔 코드라면 합치지 않는다.
- **props 를 여러 단계로 넘기지 않는다.** 세션 상태는 상태 atom 으로 꺼내 쓴다 — 옮기는 법은 6절.

## 5. 렌더 중 곁일은 정해진 도우미에서만

원본은 장면 갱신마다 화면 칸을 그 자리에서 고친다. 웹도 같은 그림의 뒤 계산 · 자식이 고친 값을 봐야 할 때가 있어 그리는 중에 칸을
고치는데, 이 일은 아래 도우미 **안에서만** 한다. 컴포넌트 몸통에서 `ref.current` 를 읽고 쓰거나 상태 값을 고치지 않는다.

- **최신 값 ref** — `useMirrorRef(ref, value)` (`shared/lib/mirrorRef`): 틱 고리 · 키 처리기가 지난 그림의 값을 읽게 하는 ref.
  커밋 뒤에 읽기만 하면 `useEffectEvent` 나 `useLayoutEffect` 안에서 적기가 먼저다.
- **그림 차례 상태 기계** — `useRenderMachine(advance, input)` 와 그 위의 `usePreviousDistinct` · `useOnRenderChange` ·
  `useLastRenderValue` · `useHeldWhileSame` (`shared/lib/renderMachine`): `advance` 는 순수 함수(난수 · 저장 금지)로 둔다.
- **이름 붙인 칸 객체** — `useState(createXxx)` 로 한 번 만든 객체에 칸을 두고, 고치는 일은 그 객체의 메서드나 옆의 이름 붙인 함수만
  한다(예: `useFieldCarryTrack`, 수비 재생의 `drawRecordedFrame`). 난수 · 소리처럼 원본이 그 그림에서 내는 곁일을 그리는 중에 내야 할 때 쓴다.
  머리말에 "무엇을 그림에서, 무엇을 사건에서 고치는지" 를 적는다.

린트(React Compiler 계열 `react/refs` · `react/immutability`)는 이 도우미 안을 보지 못한다 — 그래서 도우미 밖에서는 같은 일을 하지 않는다.

## 6. 세션 상태는 atom 으로 (Jotai)

세션 훅(`useXxxSession`)이 하위 훅에 값을 줄줄이 넘기지 않게, 상태를 의미 단위 atom 으로 두고 하위 훅이 필요한 atom 만 직접 읽고 쓴다.
본보기는 시즌 세션(`app/model/seasonSession/atoms`, r370) · 커리어 세션(`app/model/careerSession/atoms`, r372) · 투수 리그 세션(`app/model/pitcherLeagueSession/atoms`, r373). 남은 세션(미션)도 같은 순서로 옮긴다.

1. **store 는 세션마다 하나** — `useState(() => createXxxAtoms(args))`. 옛 `useState` 처음 값(저장소 읽기 따위)을 **같은 차례로** 여기서 넣는다.
   앱 전체 `Provider` 를 쓰지 않는다: 세션 훅은 `App` 몸통에서 서고, 세션이 새로 서면 칸도 새것이어야 옛 동작과 같다.
2. **atom 은 의미 단위 파일로** — 저장 · 장면 · 다음 경기 · 화면 칸 · 이벤트 관리자 칸처럼. 그림에 안 쓰고 콜백 · effect 만 쓰던 ref 도
   atom 칸으로 옮기되 그림에서는 읽지 않는다(`atoms.get` — 구독하지 않으니 써도 다시 그리지 않는다).
3. **하위 훅은 `(매개변수 + store)` 하나만 받는다** — 그림에 쓰는 값은 `useSeasonValue(atoms, xAtom)`(옛 `useState` 값), 쓰기는 콜백 안에서
   `atoms.set`. 옛 코드가 콜백에서 **그림의 값**(클로저)을 읽었으면 그대로 `useSeasonValue` 값을 의존성에 두고, **ref** 를 읽었으면 `atoms.get` 으로
   — 이 구분을 지켜야 콜백 신원 · 읽는 값의 때가 같다.
4. **여러 하위 훅이 쓰는 콜백은 작은 훅으로** (`useSeasonSaveWriters` · `useStartEvent` 처럼) — 부르는 훅마다 불러 쓴다. 상태는 atom 에 있으니
   여러 번 불러도 칸은 하나다. effect 는 옛 훅 차례대로 세션 훅 머리에서 한 번씩만 부른다.
5. **최신 값 ref 는 걷는다** — `latestXRef` + `useMirrorRef` 는 그 atom 의 `atoms.get` 이 곧 최신 값이다. 지난 그림의 *계산한* 값을 콜백이 읽던
   것(`seasonMatchSettings` 처럼)만 `useMirrorRef` 상자를 남긴다.
6. **확인** — `useAtomValue` 는 `useReducer` 꼴이라 한 사건의 여러 쓰기는 옛 `setState` 묶음처럼 한 그림이다(`useAtomValueRawSync` 는 쓰지 않는다 —
   동기 갱신 차선이 달라진다). 옛 사본(`git show`)과 새 훅을 같은 각본으로 돌려 굴림 · 저장 · 소리 · 보이는 그림 값의 차례를 견준다.
   달라지는 것은 같은 값으로 다시 그리던 빈 그림(React 가 같은 값 `setState` 에 한 번 더 그리던 것)이 없어지는 것뿐이어야 한다.

## 끄기 주석

- 끄기는 **고칠 수 없는 한 줄**에만: 원본 차례(커밋 뒤에 적어야 하는 칸, 이 갈래를 그리는 렌더만 박는 틱 따위)가 그 모양을 요구할 때.
  `oxlint-disable-next-line <규칙> -- <까닭>` 꼴로, 까닭(원본 주소 · 바꾸면 무엇이 달라지는지)을 반드시 적는다. 파일 · 블록 전체 끄기는
  쓰지 않는다(마지막 하나였던 `useCareerSession` 의 105 진입 표지는 r372 에서 이름 붙인 칸 객체 `managementEntryMarker` 로 옮겨 걷었다).
- **`exhaustive-deps` 는 끄지 않는다** — 철자(`react/` · `react-hooks/` · `eslint-disable`)가 무엇이든 그 컴포넌트 · 훅 전체의
  React Compiler 검사(refs · immutability · set-state-in-effect …)가 함께 꺼진다. 의존성을 일부러 뺀 effect 는 `useEffectEvent` 로
  읽고 열쇠만 의존성에 둔다. `react/refs` · `react/set-state-in-effect` 같은 다른 규칙 끄기는 그 줄만 끈다.
- 시험 파일도 같다 — 하네스 모양을 바꿔(효과 이벤트 · `renderHook`) 끄지 않는다.
- 이름은 `oxlint-disable` 로 쓴다(`eslint-disable` 은 쓰지 않는다). 안 쓰이는 끄기는 린트 에러다(`reportUnusedDisableDirectives`).

## 강제 장치

| 기준 | 장치 |
|---|---|
| 린트 | oxlint — `pnpm lint` (설정 `oxlint.config.ts`, 에러 0 — 경고 규칙은 없다, 모두 에러. 커밋 hook 이 올린 파일을 본다) |
| 파일 길이 | oxlint `max-lines` 150(코드만) — 옛 파일은 `lint.max-lines-baseline.js`, `pnpm check:lines` |
| 포맷 | oxfmt — `pnpm format:check` (설정 `.oxfmtrc.json`) |
| try/catch | `src/shared/lib/safe` 도우미로만 — oxlint `local/no-try-statement` (`tools/lint/localPlugin.mjs`) |
| 중첩 · 복잡도 | oxlint `max-depth` 2 · `complexity` 8 · `no-else-return` · `no-lonely-if` · `max-nested-callbacks` 3 — 옛 파일은 `lint.readability-baseline.js` |
| 결합도 — 층 경계 | FSD 층 방향(app > pages > widgets > features > entities > shared, 아래가 위를 import 금지) · 같은 층 다른 조각 import 금지 · 실행 순환 import 금지 — oxlint `local/fsd-layer-direction` · `local/fsd-cross-slice`(`tools/lint/fsdBoundaries.mjs`) · `import/no-cycle`. 옛 파일은 `lint.boundaries-baseline.js`(규칙별 목록), `pnpm check:boundaries` |
| 응집도 — 안 쓰는 코드 | knip — `pnpm knip` (설정 `knip.jsonc`). 안 쓰는 파일 · export · 의존성 0. 일부러 남긴 원본 기록 · 나중에 쓸 길은 `knip.jsonc` 의 `ignoreIssues` 에 이유와 함께 |

새 파일은 예외 목록에 넣지 않는다. 옛 파일을 고칠 때는 이 기준으로 고치고 목록에서 뺀다.

예외 목록(`lint.max-lines-baseline.js` · `lint.readability-baseline.js` · `lint.boundaries-baseline.js`)은 **파일 이름만, 경로 알파벳 순**으로 둔다(줄 수 · 위반 수 같은 숫자 주석을 달지 않는다 — 한 줄만 고쳐도 목록이 바뀌고 머지 충돌이 나서). `pnpm check:lines` 는 "목록에 있는데 이제 규칙을 지키는 파일"과 "없는 파일"만 잡고, `pnpm check:lines --update` 가 그런 파일을 빼고 이름 목록을 다시 쓴다. 층 경계 목록은 `pnpm check:boundaries`(`--update`)가 같은 일을 하고, 목록에 없는 새 위반도 잡는다.
