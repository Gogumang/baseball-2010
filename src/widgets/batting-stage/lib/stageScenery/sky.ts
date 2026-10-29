import { SKY_COLOR_PAIRS, SKY_COLOR_ROWS } from '@/shared/config/original/stadiumScene'

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
  const value = skyRowSourceValueOf(source)
  if (value === null) return null
  // 0xca911 — C 의 나머지(부호는 나뉨수를 따른다). s8 칸이라 음수는 안 온다
  return value % SKY_ROW_COUNT
}

/** 측 0 팀 번호로 고르는 모드 — 0x302 묶음 {1, 8, 9} 에 모드 0(0x39fdc 3a066~3a072 가 전역 모드를 1 로 바꾼 뒤라 모드 1 과 같은 갈래) */
const TEAM_SKY_ROW_MODES: readonly number[] = [0, 1, 8, 9]
/** 리그 날짜 g 로 고르는 모드 — 2 시즌 · 3 · 4 나리 */
const DAY_SKY_ROW_MODES: readonly number[] = [2, 3, 4]

/** 0x783b2 갈래가 고르는 값 — 굴리는 모드(5 · 6 · 7)면 null */
function skyRowSourceValueOf(source: Parameters<typeof stadiumSkyRowOf>[0]): number | null {
  if (TEAM_SKY_ROW_MODES.includes(source.mode)) return source.side0TeamId ?? 0
  if (DAY_SKY_ROW_MODES.includes(source.mode)) return source.dayCounter ?? 0
  return null
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
