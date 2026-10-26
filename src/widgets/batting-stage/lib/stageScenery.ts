import { SKY_COLOR_PAIRS, SKY_COLOR_ROWS } from '@/shared/config/original/stadiumScene'

/**
 * 타석 화면 배경·투수·판정 연출 (위치 분석 6차 — 바이트 확인, 추정은 표시).
 */
const SKY_LAST_COLUMN = 12

/** 하늘 표 0xd37a4 의 줄 수 — 0x783b0 이 6 으로 나눈 나머지를 쓴다 */
export const SKY_ROW_COUNT = 6

/**
 * 하늘 칸 — 이닝 넘김 0x3ad22 가 구장 +0x18 에 쓰는 **경기 상태 +0x6b(0부터 세는 이닝 인덱스)** 다(E-defense-rules · 0xb6b6c).
 * 웹 `GameState.inning` 은 1부터 세므로 하나 뺀다 — 1회 = 칸 0.
 */
export function skyColumnOfInning(inning: number): number {
  return inning - 1
}

/**
 * **하늘 줄 — 구장 +0x10** `0x783b0(구장)` (2026-10-08 직접 뜸). 구장 준비 0x352e8(354d2)이 경기 적재(상태 8 갱신 0x48658)와
 * 홈런더비 결과 진입(0x4f574)에서 한 번 부른다 — 곧 **경기 장면 하나에 한 번** 고르고 그 경기 내내(정산 0x19 결과 그림까지) 같은 줄이다.
 * ```
 * 783b2  m = 전역 모드 [0x1552d10]
 *        m ∈ {1, 8, 9}(0x302) → 0xb6bdc(경기 상태, 0) = 경기[0x28](측 0 — 선공 팀 번호)
 *        m == 2               → 0x1f55c(앱)(시즌 레코드) +0xb2   ; 리그 날짜 g
 *        m ∈ {3, 4}           → 0x1f8d4(앱)(나리 저장) +0xb2     ; = 리그 +0x32 날짜 g (국가대항전 중엔 대회 날짜)
 *        그 밖(5 · 6 · 7)      → rand(0, 6)
 * 78404  구장+0x10 = 값 mod 6 (0xca911) · 구장+0x18 = 경기 상태 +0x6b
 * ```
 * **모드 0 장면은 모드 1 로 읽힌다** — 하늘 줄(상태 8)보다 앞인 상태 9 의 0x39fdc(장면, 0) 모드 0 갈래(점프표 0xcfef8[0] = 0x39ff6)가
 * 끝 3a066~3a072 에서 전역 모드 [0x1552d10] · 장면 +0x1104 · st[1] 을 모두 1 로 바꾼다 → 0x783b0 은 m == 1 갈래(측 0 팀)를 타고 굴리지 않는다.
 * 모드 0 · 1 · 2 · 3 · 4 · 8 · 9 는 굴림이 없다. 굴리는 모드(5 · 6 · 7)면 null 을 돌려준다(부르는 쪽이 장면을 세울 때 굴린다).
 */
export function stadiumSkyRowOf(source: {
  readonly mode: number
  /** 리그 날짜 g (시즌 레코드 · 나리 저장 +0xb2) — 모드 2 · 3 · 4 */
  readonly dayCounter?: number
  /** 경기[0x28] — 측 0(선공) 팀 번호 — 모드 0(→ 1) · 1 · 8 · 9 */
  readonly side0TeamId?: number
}): number | null {
  const { mode } = source
  let value: number
  // 모드 0 — 0x39fdc 3a066~3a072 가 전역 모드를 1 로 바꾼 뒤라 모드 1 과 같은 갈래
  if (mode === 0 || mode === 1 || mode === 8 || mode === 9) value = source.side0TeamId ?? 0
  else if (mode === 2 || mode === 3 || mode === 4) value = source.dayCounter ?? 0
  else return null
  // 0xca911 — C 의 나머지(부호는 나뉨수를 따른다). s8 칸이라 음수는 안 온다
  return value % SKY_ROW_COUNT
}

/** 하늘 색 (0x77fe8 · 0x76fc4) — 행은 구장 +0x10(`stadiumSkyRowOf`), 열은 min(칸, 12) — 칸은 `skyColumnOfInning` */
export function skyColorsOf(row: number, skyColumn: number): { top: string; bottom: string; colorIndex: number } {
  const rowIndex = Math.max(0, Math.min(SKY_COLOR_ROWS.length - 1, row))
  const column = Math.max(0, Math.min(SKY_LAST_COLUMN, skyColumn))
  const colorIndex = SKY_COLOR_ROWS[rowIndex][column]
  const [topRed, topGreen, topBlue, bottomRed, bottomGreen, bottomBlue] = SKY_COLOR_PAIRS[colorIndex]
  return {
    top: `rgb(${topRed}, ${topGreen}, ${topBlue})`,
    bottom: `rgb(${bottomRed}, ${bottomGreen}, ${bottomBlue})`,
    colorIndex,
  }
}

/**
 * **구름 흐르기 0x78448(구장)** (2026-10-16 직접 떴다, r120):
 * ```
 * 7844a  구장+0x50 − 0x11 ≤ 1(0x11 · 0x12)이면 끝 — 안 센다
 * 78452  c = 셈 +0x28 ; +0x28 = c + 1 ; c ≤ 1 이면 끝
 * 7845e  i = 0..2: x[i] = 구장[+0x1c + 4i] − i − 1 ; x[i] < −480(0xfffffe20)이면 x[i] − i + 0x1df(= 새 값 + 480)
 * 7847e  +0x28 = 0
 * ```
 * 곧 **세 번째 부름마다** 구름 i 가 i + 1 px 왼쪽으로 가고, −480 **미만**이 되면 480 을 더한다(−480 은 그대로 남는다).
 * 칸 +0x1c~+0x24 · 셈 +0x28 은 0x76ab0 이 0 으로 둔다 — 생성자 0x76b24 → 0x76ac8(76ad8)과 **상태 9 갱신 0x3f584 의 3f594** 가 부른다
 * (`xref 0x76ab0`). 그 밖에 이 칸을 쓰는 곳은 없다.
 *
 * 부르는 곳 셋(`xref 0x78448`): 장면 공용 갱신 0x3f060(3f2f6, 갱신마다) · 홈런더비 결과 창 그리기 0x45c18(45c4c) · 정산 그리기 0x4a384.
 * 0x3f060 은 먼저 3f07c 에서 구장+0x50 = 경기 상태를 적고(상태 7 이면 그 전에 끝) 상태 0x18 · 0x19 · 0x1a, [장면+0x1780]+0(간이 엔진 진행 중),
 * +0x1993(레이저 멈춤)이면 끝, 야외 화면 상태 0x33c98(6 · 0x16 · 0x17 · 0x18 · 0x1a · 0x1c · 0x1e · 0x20 · 0x21 — 표 0x0d560001)면
 * 구름까지 안 가고, 상태 0x13(3f1de)도 다른 갈래다. 그래서 구름이 흐르는 갱신은 **0x11 · 0x12 · 0x13 · 야외 화면 상태를 뺀** 상태
 * (타석 웹 '대기' = 0xd~0x10, 인트로 0xc, 적재 8)이고, 결과 창 0x19 · 0x1a 는 그리기마다 센다(구장+0x50 이 0x19 · 0x1a 라 안 막힌다).
 * 웹은 이 부름 수를 경기 장면 동안 하나 두고 센다(`model/sceneCloudClock`).
 *
 * `calls` = 칸을 0 으로 둔 뒤 0x78448 이 센(+0x28 을 올린) 부름 수. 돌려주는 값은 구름 i 의 x 칸(그리기 0x782d6 이 x · x + 480 에 두 번 그린다).
 */
export const CLOUD_WRAP_WIDTH = 480
const CLOUD_CALLS_PER_STEP = 3
const NIGHT_COLOR_INDEX = 9

export function cloudScrollAt(cloudIndex: number, calls: number): number {
  const moved = (cloudIndex + 1) * Math.floor(Math.max(0, calls) / CLOUD_CALLS_PER_STEP)
  // 0 에서 시작해 −480 미만이면 +480 — 한 번 돈 뒤로는 0 대신 −480 에 선다
  return moved === 0 ? 0 : -(((moved - 1) % CLOUD_WRAP_WIDTH) + 1)
}

/**
 * **로딩 판 동안 센 구름 부름** — 상태 9 갱신 0x3f584 가 3f594 에서 0x76ab0 으로 구름 칸 · 셈을 0 으로 둔 뒤, 상태 8 갱신 0x48658 의
 * 두 그림(상태 틱 0 · 1)에서 0x3f060 이 0x78448 을 한 번씩 부른다(상태 9 그림의 부름은 같은 그림의 갱신이 지운다).
 * 그래서 로딩 판 다음 첫 그림(인트로 0xc · 모드 5~9 의 다음 상태)의 부름이 세 번째 — 구름이 한 칸 간 자리에서 시작한다.
 * 웹 로딩 판(`LoadingTip`)이 떠 있는 길이와는 상관없다(부름은 그림 수로 센다).
 */
export const LOADING_CLOUD_CALLS = 2

/**
 * **결과 창 뒤 구장 밀기** — 장면 +0x17e2 (홈런더비 결과 창, 상태 0x1a):
 * ```
 * 진입 0x4f574  4f6b4  +0x17e2 = 0
 * 갱신 0x3c0b8  3c0c0  +0x17e2 += 5 ; > 150(0x96) 이면 150
 * 그리기 0x45c18  45c4c 0x78448(구름 흐르기) · 45c62 0x78578(구장, (s16)+0x17e2, 1)
 * ```
 * 한 틱 안에서 진입 → 갱신 → 그리기 차례라(0x52c50) 들어선 틱의 그림부터 5 다. 값만큼 구장·바닥이 **아래로** 내려간다
 * (0x77974 위 = 구장+8 + 값 + 3 · 0x7725c 위 = 구장+8 + 값 + 0xe2) — 하늘만 남기고 30틱에 걸쳐 가라앉는다.
 */
export const RESULT_BACKDROP_STEP = 5
export const RESULT_BACKDROP_LIMIT = 150

/** 결과 창에 들어선 뒤 틱 t(0 = 들어선 틱)의 그림에 쓰는 +0x17e2 */
export function resultBackdropOffsetAt(tick: number): number {
  return Math.min(RESULT_BACKDROP_LIMIT, RESULT_BACKDROP_STEP * (Math.max(0, tick) + 1))
}

/** 색 번호 9 미만일 때만 구름을 그린다 — 0x76ff6 (`v > 8` 이면 구름 그림을 아예 안 싣는다) · 0x782ea */
export function isCloudVisible(colorIndex: number): boolean {
  return colorIndex < NIGHT_COLOR_INDEX
}

/**
 * 하늘 그림 팔레트 줄 — 구장 배경 적재 `0x76fd0` (R6 6절, 다시 떠서 확인).
 * ```
 * 76fd0: 열 = min(구장+0x18 = 경기[0x6b], 12) ; v = (s8) 표0xd37a4[13·구장+0x10 + 열]   ; = skyColorsOf 의 colorIndex
 * 76ff6: v ≤ 8 → 0xb9719("stadium/attack_sky_cloud.pzx", 1, ".mpl", v − 1)     → 구장+0x34
 * 77028:        0xb9719("effect/sky_effect_light1.pzx", 1, 0, −1)             → 구장+0x3c (늘, 팔레트 없음)
 * 7703e: v ≤ 7 → 0xb9719("effect/sky_effect_light.pzx", 1, ".mpl", v ≤ 1 ? −1 : v − 2) → 구장+0x38
 * ```
 * 줄 −1 은 0xb9719 에 "팔레트 없음" = **구운 벌**이라 웹에서는 null 이다.
 * 같은 하늘(열이 그대로)이면 0x76fd8 이 다시 안 싣는다 — 값이 v 하나로만 정해지므로 웹은 매번 셈해도 같다.
 */
export function cloudPaletteRowOf(colorIndex: number): number | null {
  return colorIndex >= 1 ? colorIndex - 1 : null
}

/** 하늘 조명 `sky_effect_light` 를 싣는가 — 0x7703e `cmp #7 / bgt` (그리기 0x784d8 도 같은 검사를 다시 한다) */
export const SKY_LIGHT_LAST_COLOR_INDEX = 7

/** 하늘 조명을 안 그리는 모드 — 5 투수 미션 · 6 타자 미션 · 7 홈런더비 (0x784a2~0x784b0) */
const SKY_LIGHT_HIDDEN_MODES: readonly number[] = [5, 6, 7]

/**
 * 이 게임 모드(전역 `0x1552d10`)에서 하늘 조명 0x78490 을 그리는가 — 모드 5·6·7 이면 안 그린다.
 * 모드를 모르면(undefined) 그 셋이 아닌 것으로 본다.
 */
export function isSkyLightModeShown(gameMode: number | undefined): boolean {
  return gameMode === undefined || !SKY_LIGHT_HIDDEN_MODES.includes(gameMode)
}

export function skyLightPaletteRowOf(colorIndex: number): number | null {
  return colorIndex <= 1 ? null : colorIndex - 2
}

/**
 * 하늘 조명 애니 칸 — 0x78490 이 그린 뒤 `0x93d90`(한 칸 넘기기) · `0x93cfc(애니, 1)`(되풀이로 켜기)를
 * 부르므로 **끝나면 처음으로 돌아가는** 되풀이다. 칸 길이는 판정 글자와 같은 `max(1, 지연)` 틱(0x93d90).
 */
export function skyLightFrameAt(
  entries: readonly { frame: number; delay: number }[],
  tick: number,
): number | null {
  if (entries.length === 0) return null
  const total = entries.reduce((sum, entry) => sum + Math.max(1, entry.delay), 0)
  let remaining = Math.max(0, tick) % total
  for (const entry of entries) {
    const length = Math.max(1, entry.delay)
    if (remaining < length) return entry.frame
    remaining -= length
  }
  return entries[entries.length - 1].frame
}

/**
 * **투수 그림 객체** (vtable 0xd73d0 — 갱신 0x9e004 → 0x9df8c · 자세 0x9e0b8, 경기 +0xf98). 2026-10-15 직접 떴다.
 * ```
 * 9dff8  상태 걸기(o, s): +0x14 = s · 단계 +0x1c = 0 · 카운터 +0x20 = 0
 * 9df8c  상태 1: 마투수(+0x24 ≥ 0)면 마지막 단계 = s8 0xd744f[u] · 유지 = s8 (0xd73fa + 17u)[단계],
 *               아니면 마지막 = 0xd · 유지 = s8 0xd73e9[단계]
 *        상태 2: 마지막 = 4 · 유지 = s8 0xd73e4[단계]
 *        c = 카운터++ ; c ≥ 유지 ∧ 단계 < 마지막 이면 단계 + 1 · 카운터 = 0        (그 밖 상태는 안 센다)
 * 9e004  갱신 뒤 상태 2 이고 단계 > 3 이면 9dff8(o, 0) — 대기는 **한 바퀴**만 하고 선 자세로 돌아온다
 * 9e0b8  상태 0 · 1: 마투수면 s8 (0xd7483 + 17u)[단계], 아니면 폼 0·1 / 2·3 / 4·5 → 0xd7475 / 0xd7467 / 0xd7459 [단계]
 *        상태 2: 마투수면 0, 아니면 0xd7454[단계]
 * ```
 * u = 마투수 순번 — 경기 장면은 0x35650 이 `0xb63a0(투수)` 를 +0x24 에 적는다(35686). 다른 화면 셋업(0x5690 · 0x61c0 · 0x108d2 · 0x65346)은 −1.
 * 상태를 거는 곳(경기 +0xf98): **0xf 진입 0x3d954 · 0xd 진입 0x48d50 → 0x35650 → 0x340c0 = 상태 0**,
 * 0x11 진입 0x3de10(3de7c) = 상태 1, 빈 구질 칸 키 0x50de8 = 상태 2.
 *
 * **갱신 0x9e004 를 부르는 곳 — 0xf 갱신 0x39c1c(39c28 vt+8) · 0x11 갱신 0x4e060(4e070 vt+8) 둘뿐** (2026-10-15 전수):
 * 0x9e005 는 vtable 0xd73d8 칸에만 있고(BL 없음), 0x9df8c 를 BL 하는 곳도 0x9e008 하나다. 경기 +0xf98 을 읽는 22곳
 * (`xval 0xf98`)을 다 떠 보면 vt+8 을 부르는 것은 위 둘이고, 나머지는 상태 걸기 · +8 · +0x10 읽기 · 자세 0x9e0b8 뿐이다.
 * 갱신 표 0xd0530(0x52c50 52e44~)에서 0xd 0x39e14 · 0xe 0x39bd4 · 0x10 0x39c5c · 0x12 0x4e6d4 · 0x13 0x406e8 은 투수를 안 센다.
 * 그래서 **단계는 0x11 의 마지막 갱신에서 굳고**(0x12 · 0x13 은 그 단계 그대로 — 공이 빨리 닿으면 마지막 단계 전에 굳는다),
 * 대기 동작(상태 2)도 **0xf 를 떠나면(0x10 조준) 그 단계에 굳는다**. 다음 0xd · 0xf 진입이 상태 0 으로 되돌린다 —
 * 0xd 진입이 상태 0 을 걸고 0xd 갱신 0x39e14 가 0xe 를 예약하므로, 0xd → 0xe 로 쉬는 동안 투수는 상태 0 이다(웹 쉬는 '대기').
 * 0xe 를 예약하는 곳은 0x39e2e(0xd 갱신)와 0x4984a(0xb 교체 화면의 # · CLR) 둘뿐이다(0xbcb48 부름 269곳의 `movs r1, #0xe`).
 * 0xb 는 0xe · 0xf 의 '#'(0x499f4)로 들고 갱신 칸이 비어 있어, 0xf 에서 대기 동작 중에 '#' 를 누르면 0xb → 0xe 동안 그 단계에
 * 굳어 있다가 다음 0xf 진입에 상태 0 이 된다. 웹(`PitcherSideStage`)은 0xb 동안 구질 목록 부품이 내려가 `idleEndTick` 이 서고(굳음),
 * 0xb 에서 곧장 선 0xe 는 0xd 표지(`sceneDEntryMark`)를 안 바꿔 그대로 굳어 있다가, OK 뒤 0xf 진입(`entersStateF`)에 상태 0 이 된다
 * (`PitcherSideStage.idle.test`).
 *
 * 한 그림 차례(0x52c50): 진입 표 → 키(0x498d4 → 조작 0x536bc → 0x534d8 → 0xbfbad 바로 보냄 → 0x509a0 메시지 7 → 0x50de8)
 * → 갱신 표 → 그리기. 그래서 0x11 진입 그림과 빈 칸 키 그림은 둘 다 **상태를 건 그 그림에 한 번 센 단계로 그린다**(틱 0).
 */
/** 투구 단계 → pitcher.pzx 프레임 (0x9e0b8 — 폼 0·1 0xd7475 · 2·3 0xd7467 · 4·5 0xd7459, 홀수 폼은 좌우 반전) */
const PITCH_STEP_FRAMES = [
  [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14],
  [1, 3, 4, 5, 6, 7, 15, 16, 10, 11, 12, 13, 14, 14],
  [2, 3, 4, 5, 6, 7, 17, 18, 10, 11, 12, 13, 14, 14],
]
/** 단계 유지 dur (표 0xd73e9) — 한 단계가 dur+1 틱 */
const PITCH_STEP_DURATIONS = [1, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]
/** 평범한 투수의 마지막 단계 (0x9dfba `movs r4, #0xd`) */
const PITCH_LAST_STEP = 0xd
/** 공을 놓는 단계 — 0x3f378 이 투수 단계 ≥ 6 (3f414 `movs r4, #6`) 인 틱부터 공 틱 +0x1098 을 올린다 */
const RELEASE_STEP = 6

/** 마투수 순번 u 별 단계 유지 (표 0xd73fa, 17칸씩) — ace/pitcher_*.pzx 애니 0 의 지연과 같다 */
const ACE_PITCH_STEP_DURATIONS = [
  [4, 2, 2, 2, 2, 2, 0, 0, 0, 0, 1, 2, 2, 2, 0, 0, 0],
  [4, 2, 2, 2, 0, 0, 0, 2, 2, 0, 0, 0, 1, 2, 3, 0, 0],
  [4, 2, 2, 2, 2, 2, 2, 2, 0, 0, 2, 2, 3, 0, 0, 0, 0],
  [4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0],
  [4, 2, 2, 2, 2, 2, 2, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0],
]
/**
 * 마투수 마지막 단계 (표 0xd744f). 싸이커(u 0)는 애니 0 이 14칸(… 14, 15)인데 마지막이 12 라 **프레임 15 는 안 나온다** —
 * 원본 그대로다.
 */
const ACE_PITCH_LAST_STEPS = [12, 14, 12, 15, 12]
/** 마투수 단계 → ace/pitcher_*.pzx 프레임 (표 0xd7483, 17칸씩) */
const ACE_PITCH_STEP_FRAMES = [
  [0, 3, 4, 5, 6, 7, 8, 16, 17, 11, 12, 13, 14, 15, 15, 15, 15],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14, 14],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 12, 12, 12],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 15],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 12, 12, 12],
]
/** 마투수가 공을 놓는 단계 — 0x3f378 3f40c 의 표 0xcfbe4[u] (공 객체 0x9e038 · 0x9e074 의 표 0xd74d8 과 같은 값) */
const ACE_RELEASE_STEPS = [6, 9, 6, 10, 8]

/** 표에 있는 마투수 순번인가 (0~4). 아니면 평범한 투수 표를 쓴다 */
function aceRowOf(aceOrder: number | null | undefined): number | null {
  return aceOrder !== null && aceOrder !== undefined && aceOrder >= 0 && aceOrder < ACE_PITCH_LAST_STEPS.length ? aceOrder : null
}

/** 단계 0..last 가 시작하는 틱 — 단계 k 는 유지 + 1 틱 */
function startsOf(durations: readonly number[], last: number): readonly number[] {
  return durations.slice(0, last).reduce<number[]>((starts, duration, index) => [...starts, starts[index] + duration + 1], [0])
}

const PITCH_STEP_STARTS = startsOf(PITCH_STEP_DURATIONS, PITCH_LAST_STEP)
const ACE_PITCH_STEP_STARTS = ACE_PITCH_STEP_DURATIONS.map((durations, row) => startsOf(durations, ACE_PITCH_LAST_STEPS[row]))

function pitchStepStartsOf(aceOrder: number | null | undefined): readonly number[] {
  const row = aceRowOf(aceOrder)
  return row === null ? PITCH_STEP_STARTS : ACE_PITCH_STEP_STARTS[row]
}

function stepAt(tick: number, starts: readonly number[], lastStep: number): number {
  let step = 0
  while (step < lastStep && tick >= starts[step + 1]) step += 1
  return step
}

/** 상태 1 의 마지막 단계 — 평범한 투수 13, 마투수 0xd744f[u]. 홈런 갈래 0x39096 의 비교 값(13 · 0xcfd34[u])과 같다 */
export function pitchLastStepOf(aceOrder?: number | null): number {
  const row = aceRowOf(aceOrder)
  return row === null ? PITCH_LAST_STEP : ACE_PITCH_LAST_STEPS[row]
}

/** 상태 1 에 든 뒤 틱 → 단계 (0x9df8c 를 그 수만큼 돌린 것 — 마지막 단계에서 멈춘다) */
export function pitchStepAt(tick: number, aceOrder?: number | null): number {
  const starts = pitchStepStartsOf(aceOrder)
  return stepAt(Math.max(0, tick), starts, starts.length - 1)
}

/** 단계 `step` 에 닿는 틱 (상태 1 에 든 뒤) */
export function pitchStepStartTickOf(step: number, aceOrder?: number | null): number {
  const starts = pitchStepStartsOf(aceOrder)
  return starts[Math.min(Math.max(0, step), starts.length - 1)]
}

/**
 * 공 틱이 오르기 시작하는 틱 (상태 1 에 든 뒤) — 투수 단계가 놓는 단계(평범 6 · 마투수 0xcfbe4[u])에 닿는 틱 (0x3f378).
 * 평범한 투수는 11, 마투수는 20 · 23 · 20 · 32 · 24 이다.
 */
export function pitcherReleaseTicksOf(aceOrder?: number | null): number {
  const row = aceRowOf(aceOrder)
  return pitchStepStartTickOf(row === null ? RELEASE_STEP : ACE_RELEASE_STEPS[row], aceOrder)
}

/** 평범한 투수가 공을 놓는 틱 (`pitcherReleaseTicksOf(null)`) */
export const PITCHER_RELEASE_TICKS = pitcherReleaseTicksOf(null)

/** 대기 동작 (상태 2) — 프레임 0xd7454 · 유지 0xd73e4 */
const IDLE_FRAMES = [0, 19, 0, 19, 0]
const IDLE_DURATIONS = [1, 1, 3, 4, 4]
const IDLE_LAST_STEP = 4
/** 0x9e026 `cmp r3, #3 / ble` — 단계가 3 을 넘으면 상태 0 */
const IDLE_END_STEP = 4
const IDLE_STARTS = startsOf(IDLE_DURATIONS, IDLE_LAST_STEP)
/** 대기 한 바퀴의 길이 — 단계 4 에 닿는 그 갱신(9e004)에 상태 0 으로 돌아가므로 단계 4 는 그려지지 않는다 */
export const PITCHER_IDLE_TICKS = IDLE_STARTS[IDLE_END_STEP]

/**
 * 투수 그림 객체가 그릴 수 있는 **바탕 프레임 전부** (자세 0x9e0b8) — 미리 받기가 쓴다.
 * 평범한 투수는 폼 세 줄의 투구 단계 + 대기 동작, 마투수는 그 순번 줄의 단계 0..마지막 (대기 동작은 0 이다).
 * 평범한 투수의 덧그림(+0x16)은 `pitcherLayersOf` 가 붙인다.
 */
export function pitcherPoseFramesOf(aceOrder?: number | null): number[] {
  const row = aceRowOf(aceOrder)
  const frames = row === null
    ? [...PITCH_STEP_FRAMES.flat(), ...IDLE_FRAMES]
    : [0, ...ACE_PITCH_STEP_FRAMES[row].slice(0, ACE_PITCH_LAST_STEPS[row] + 1)]
  return [...new Set(frames)].sort((a, b) => a - b)
}

export interface PitcherAnimation {
  /** +0x14 — 0 선 자세 · 1 투구 · 2 대기 동작 */
  readonly state: 0 | 1 | 2
  /** +0x1c */
  readonly step: number
}

/** 투수 그림 객체에 상태를 건 두 사건의 틱 — 웹 장면이 드는 것 */
export interface PitcherAnimationClock {
  /** 0x11 진입(0x3de10 → 상태 1) 뒤 틱. 다음 0xd · 0xf 진입(→ 상태 0)까지 산다. 없으면 null */
  readonly pitchTick: number | null
  /**
   * 0x11 의 마지막 갱신 틱(0x4e060 이 0x12 · 0x13 을 예약한 그림, `pitchTick` 셈) — 그 뒤로는 0x9e004 가 안 불려 단계가 굳는다.
   * 아직 0x11 이면 null
   */
  readonly pitchEndTick?: number | null
  /** 빈 구질 칸 키(0x50de8 → 상태 2) 뒤 틱. 없으면 null */
  readonly idleTick?: number | null
  /** 0xf 의 마지막 갱신 틱(0x39c1c, `idleTick` 셈) — 0x10 조준에 들면 대기 동작이 그 단계에 굳는다. 아직 0xf 면 null */
  readonly idleEndTick?: number | null
}

/** 갱신 0x9e004 가 불린 수만큼만 센 틱 — 끝 틱이 있으면 거기서 멈춘다 */
function countedTickOf(tick: number, endTick: number | null | undefined): number {
  return endTick === null || endTick === undefined ? tick : Math.min(tick, endTick)
}

/**
 * 투수 그림 객체의 지금 상태. 둘 다 있으면 투구가 나중 사건이다(빈 칸 키는 0xf 에서만 받고 0x11 이 그 뒤다).
 * 틱 0 은 상태를 건 그림 — 같은 그림의 갱신(0x39c1c · 0x4e060)이 이미 한 번 센 단계다(0x11 진입 · 빈 칸 키 모두, 위 차례).
 */
export function pitcherAnimationAt(clock: PitcherAnimationClock, aceOrder?: number | null): PitcherAnimation {
  if (clock.pitchTick !== null) {
    return { state: 1, step: pitchStepAt(countedTickOf(clock.pitchTick, clock.pitchEndTick), aceOrder) }
  }
  const idleTick = clock.idleTick ?? null
  const countedIdleTick = idleTick === null ? null : countedTickOf(idleTick, clock.idleEndTick)
  if (countedIdleTick !== null && countedIdleTick >= 0 && countedIdleTick < PITCHER_IDLE_TICKS) {
    return { state: 2, step: stepAt(countedIdleTick, IDLE_STARTS, IDLE_LAST_STEP) }
  }
  return { state: 0, step: 0 }
}

/**
 * 0x9df8c 의 상태별 규칙 — 단계 유지 표와 마지막 단계. 상태 0 · 그 밖은 안 센다(null).
 * 명예의 전당 목록 그림(`pages/special/lib/hallOfFameFigure`)도 같은 객체(vtable 0xd73d0)라 이 표를 쓴다.
 */
export function pitcherStepRuleOf(
  state: number,
  aceOrder?: number | null,
): { readonly durations: readonly number[]; readonly lastStep: number } | null {
  const row = aceRowOf(aceOrder)
  if (state === 1) {
    return row === null
      ? { durations: PITCH_STEP_DURATIONS, lastStep: PITCH_LAST_STEP }
      : { durations: ACE_PITCH_STEP_DURATIONS[row], lastStep: ACE_PITCH_LAST_STEPS[row] }
  }
  if (state === 2) return { durations: IDLE_DURATIONS, lastStep: IDLE_LAST_STEP }
  return null
}

/** 0x9e0b8 — 지금 상태의 그림 프레임. 마투수는 ace/pitcher_*.pzx, 아니면 pitcher.pzx 의 번호다 */
export function pitcherPoseOf(animation: PitcherAnimation, form: number, aceOrder?: number | null): number {
  const row = aceRowOf(aceOrder)
  if (animation.state === 2) return row === null ? (IDLE_FRAMES[animation.step] ?? 0) : 0
  if (row !== null) return ACE_PITCH_STEP_FRAMES[row][animation.step] ?? 0
  // 0x9e0e2 `cmp r3, #5 / bhi` — 폼이 0~5 밖이면 0
  if (form < 0 || form > 5) return 0
  return PITCH_STEP_FRAMES[form >> 1][animation.step] ?? 0
}

/** 평범한 투수 상태 1 의 자세 (폼 표) */
export function pitcherFrameAt(form: number, tick: number): number {
  return pitcherPoseOf({ state: 1, step: pitchStepAt(tick) }, form)
}

/**
 * 투수 덧그림 — 같은 pitcher.pzx 를 **프레임 f + 22 로 한 번 더** 겹쳐 그린다 (확정).
 *
 * 투수 그림 객체의 그리기 0x79524 는 겹칠 판 6개를 쌓아 두고 한 번에 그린다
 * (0x7961e~0x79692, 칸은 L-sound-effects.md 3절과 같다):
 *   0 바탕 pzx [+0x0c] 프레임 f · 1 머리 아이템 [+0x1c] · 2 몸 아이템 [+0x24]
 *   **3 바탕 pzx 를 다시, 프레임 `f + 0x16`** (0x79662 `adds r3,r6,#0x16` → [sp+0x40], 0x7966a [sp+0x58] = [+0x0c])
 *   4 손 아이템 [+0x20] · 5 다리 아이템 [+0x28]
 * 아이템 칸은 obj+0x3e+부위 가 음수면 건너뛰지만 3번 칸은 **조건 없이** 늘 쌓인다.
 *
 * 그래서 pitcher.pzx 의 22~43 번 프레임은 깨진 그림이 아니라 **덧그림 전용**이다:
 *   대기 0·1·2 → 22·23·24 글러브 안 공 · 와인드업 3·4·5·6 → 25·26·27·28 몸통과 던지는 팔
 *   9 → 31 팔 잔상 · 18 → 40 잔상 · 좌완 대기 19·20·21 → 41·42·43 공
 *   그 밖(7·8·10~17)은 29·32~39 빈 프레임이라 아무것도 안 더해진다.
 * 타자가 쓰는 앞몸통 덧그림(`batterLayers.ts` FRONT_OFFSETS)과 같은 방식이다.
 */
export const PITCHER_OVERLAY_FRAME_OFFSET = 0x16

/**
 * 판정 종류 → game_judge 애니 번호 (0x393b4) — 표 0xcfe90 과 같다 (확정, R2-game-effects.md 7절·9절).
 * 안타·홈런은 원본에서 판정 글자가 아니라 타구 연출로 보여 주므로 글자로 둔다.
 */
const JUDGE_ANIMATIONS: Readonly<Record<string, number>> = {
  스트라이크: 0,
  헛스윙: 0,
  아웃: 1,
  볼: 3,
  파울: 4,
  세이프: 5,
  볼넷: 6,
  '몸에 맞는 공': 7,
  인정2루타: 8,
  삼진: 9,
}

export function judgeAnimationOf(text: string): number | null {
  return JUDGE_ANIMATIONS[text] ?? null
}

/** 팀 아이콘 번호 — 14 는 10, 10 이상은 11 (0x77974) */
const HIDDEN_TEAM_ICON = 10
const OTHER_TEAM_ICON = 11
const HIDDEN_TEAM_ID = 14
const FIRST_SPECIAL_TEAM = 10

export function teamIconOf(teamId: number): number {
  if (teamId === HIDDEN_TEAM_ID) return HIDDEN_TEAM_ICON
  return teamId >= FIRST_SPECIAL_TEAM ? OTHER_TEAM_ICON : teamId
}

/**
 * 판정 글자 애니는 반복하지 않는다 — 끝나면 마지막 칸(빈 그림)에 멈춘다.
 * 칸 길이 = max(1, 지연 + 보정) 틱 (0x93d90, R2-game-effects.md 9절). 보정(correction)은
 * 애니 상태별 s8 값으로 보통 0 이다 — 표에 값이 없으면 0 으로 본다.
 */
export function judgeFrameAt(
  entries: readonly { frame: number; delay: number; correction?: number }[],
  tick: number,
): number | null {
  let remaining = Math.max(0, tick)
  for (const entry of entries) {
    const length = Math.max(1, entry.delay + (entry.correction ?? 0))
    if (remaining < length) return entry.frame
    remaining -= length
  }
  return entries.length === 0 ? null : entries[entries.length - 1].frame
}
