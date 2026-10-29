// 판 종류 마스크 표는 맨 앞에 둔다 — 원본 대조 시험이 배열 위 13 줄의 표 주소를 그 배열의 출처로 읽는다(`originalSource.test`)
/** 슬롯 2 의 52602 — 판 종류가 이 마스크(0x58c)면 플레이 vt4c 0xb45dc 를 안 부른다 (`runnerPlayEngine` 과 같은 표) */
export const VT4C_BLOCKED_PLAY_KINDS: readonly number[] = [2, 3, 7, 8, 10]

/** 슬롯 2 머리 52546 — [sp+0x14] = 0xae61c(판 종류 ∉ 마스크 0x58c = 2 · 3 · 7 · 8 · 10)가 거짓이면 필살 포구 연출을 안 켠다 */
export const DEADLY_FLASH_BLOCKED_PLAY_KINDS: readonly number[] = [2, 3, 7, 8, 10]

/** 능력치를 안 주면 쓰는 값 — 원본 평균대(등급 3) */
export const DEFAULT_ABILITY = 500
/** 야수.vte4 = 0xa1e60 — 필살타법 타구에 맞은 야수의 동작 잠금 +0xb4 (`movs r3, #0xf`, a1e70) */
export const HIT_STAGGER_LOCK_TICKS = 15
/** 한 플레이가 이 틱을 넘기면 강제로 끊는다 (원본에는 없는 우리 쪽 안전망) */
export const DEFAULT_MAXIMUM_TICKS = 240
/** 보류 해제 0xaa39e 가 메시지 0x13 에 싣는 주자 칸 (`movs r2, #0x64`) — 타자주자(0)가 아니다 */
export const RELEASED_RUN_SLOT = 0x64

/** 필살타법 타구에 맞은 야수 — 0xa1e60 의 `movs r1, #0x35` (b4588 vt74 → 0xb3420 → 야수 vte4) */
export const HIT_STAGGER_SOUND_EFFECT = 53

/**
 * 공+0xac4 의 거리 문턱 — 낙구점이 홈 (20000, 0, 29445)(표 0xd7be8)에서 **10274 넘게** 떨어지면 깊은 낙구(P2 2절).
 * `atBatSounds.deepHitCheerSoundIdOf` 의 문턱과 같은 값이다
 */
export const DEEP_LANDING_DISTANCE = 10_274

/** 홈을 가리키는 루 번호 — 원본 루 표의 [4] 가 홈의 사본이라 진루는 4 로 센다 */
export const HOME_BASE = 4

/** 타구 판의 플레이 종류 (0x3e11a 이후 상태 0x13 → 0x17) */
export const BATTED_BALL_PLAY_KIND = 1

/**
 * 예보 0xb12d0 은 틱 구간을 자르지 않고 궤적 끝까지(t = 1 → 공+0x6c − 1) 한 표를 만들고, 0xb3b38 은 낙구 전 포구
 * (우선순위 1~5)가 있으면 그것을, 없으면 6~8 갈래로 **바운드 뒤에 줍는 야수**를 고른다(P2 1a · 2a). 잡힐 뜬공인지는 이 예보가
 * 정한다 — 플레이.vt94 = 0xb1b2c(+0x11c 가장 이른 포구 틱 ≤ 낙구 틱)가 0xa9e44(a9ed6)·0xaf918(af98e)에 넘기는 그 값이다.
 * (예전 웹은 타석 결과 코드가 뜬공·직선타 아웃이면 낙구 전까지만, 그 밖이면 낙구 다음 틱부터 보도록 구간을 잘랐다 —
 * 결과를 먼저 정한 웹 다리였다. 원본처럼 결과는 이 판의 끝 정산이 내므로 걷었다.)
 */
export const FULL_FORECAST_WINDOW = { from: 0, to: Number.POSITIVE_INFINITY }

/** 판 끝 결과 코드 7 — 파울 (0x9d5bc 의 0xb68dc 갈래) */
export const FOUL_RESULT_CODE = 7
/** 판 끝 결과 코드 11 — 2스트라이크 번트 파울 아웃 (0x9d5bc 9d5fa) */
export const BUNT_FOUL_OUT_RESULT_CODE = 11

/** 예보 표가 비었을 때의 가장 이른 포구 틱 (플레이 +0x11c 초기값 0xffff — `forecastCatch`) */
export const NO_FORECAST_CATCH = 0xffff
/** 0xb2c90: 받는 야수까지 이 거리 이하면 던지지 않는다 */
export const MINIMUM_THROW_DISTANCE = 600
