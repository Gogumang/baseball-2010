import type { RandomPort } from '@/shared/api/random/randomPort'

/** 구장 번호가 그대로인 끝 — 기본 열 팀 0~9 (`0x78664` · `0x788d4` 의 `cmp r1, #9`) */
const LAST_STADIUM = 9
/** 9 보다 크면 고르는 구장 수 — `bfa55(0, 10)` */
export const STADIUM_ROLL_COUNT = 10

/**
 * **구장 번호 넣기** — 타석 구장 객체 `0x78664(무대, n)` 와 수비 구장 객체 `0x788d4(객체, n)` 는 같은 꼴이다(직접 떴다):
 * ```
 * 78664  n ≤ 9 → 무대+0x70 = n  /  그 밖 → 무대+0x70 = bfa55(0, 10)
 * 788d4  n ≤ 9 → 객체+0x10 = n  /  그 밖 → 객체+0x10 = bfa55(0, 10)
 * ```
 * n 은 s8 이다(부르는 쪽이 ldrsb 로 읽는다). 일반모드 n = st+0x30 = rec+0xc(구장) — 빠른실행이면 유저 팀 번호라 히든 팀(10~14)이면 굴린다.
 */
export function rollStadiumNumber(random: RandomPort, stadium: number): number {
  if (stadium <= LAST_STADIUM) return stadium
  return random.rand(0, STADIUM_ROLL_COUNT)
}

/**
 * 표 `0xcfd0c` — 경기 장면 셋업 0x39fdc 모드 1·8·9 갈래가 **st+0x30 을 그대로** 첨자로 읽어 두 구장 객체 +0xc(바닥 팔레트 줄)에 넣는다.
 * −1 = 기본색. 표는 열 칸이라 st+0x30 이 10~14(빠른실행 히든 유저 팀)면 뒤 자료를 읽는다 — 그 다섯 낱말도 그대로 둔다(원본 버그).
 */
const STADIUM_PALETTE_ROWS: readonly number[] = [
  -1, 0, 1, 2, 0, -1, -1, 0, 1, 2,
  // 0xcfd34~ — 표 밖 (u32 그대로)
  0x0f0c0e0c, 0x1817160c, 0x211a1818, 0x18151a1a, 0x181a1818,
]

/** 경기 장면의 두 구장 객체 — 0x39fdc 가 st+0x30 으로 채운 것 */
export interface SceneStadium {
  /** 타석 구장 객체 `[장면+0xf10]` +0x70 — `fence.pzf` 프레임·관중·하늘 단색(8)을 고른다(0x77974 · 0x78046) */
  readonly stadium: number
  /** 수비 구장 객체 `[장면+0xf14]` +0x10 — 그리기(0x78930)가 안 읽는다. 굴림 차례만 맞춘다 */
  readonly defenseStadium: number
  /**
   * 두 객체 +0xc = 표 `0xcfd0c[st+0x30]` — 바닥 그림 적재 0x76b6c(stadium/attack, 0x352e8 첫머리)와
   * 수비 바탕 적재 0x78824(stadium/defense, 0x35218)가 `.mpl` 줄로 쓴다. −1 = 기본색
   */
  readonly paletteRow: number
}

/**
 * **경기 장면 셋업 `0x39fdc` 모드 1·8·9 갈래 3a076** (점프표 0xcfef8[1·8·9] = 0x3a076, 직접 떴다):
 * ```
 * 3a084  0x78664([장면+0xf10], (s8)st+0x30)          ; 타석 구장 +0x70 — > 9 면 rand(0, 10)
 * 3a092  0xb6bdc(st, 1) · (st, 0) → 구장+0x80 · +0x84
 * 3a0c4  [장면+0xf10]+0xc = 표 0xcfd0c[(s8)st+0x30]   ; ← 굴린 값이 아니라 st+0x30 그대로
 * 3a0d4  0x788d4([장면+0xf14], (s8)st+0x30)          ; 수비 구장 +0x10 — > 9 면 rand(0, 10)
 * 3a0e4  [장면+0xf14]+0xc = 표 0xcfd0c[(s8)st+0x30]
 * ```
 * 이 갈래는 0x78688(표 0xd377c · st+0x30 되쓰기)을 **안 부른다** — 0x39fdc 안 0x78688 은 다른 갈래(3a25c · 3a298 · 3a4de)뿐이다.
 * 그래서 st+0x30 은 그대로 남고, 표 첨자도 굴린 구장이 아니라 st+0x30 이다.
 * 부르는 곳은 상태 9 갱신 0x3f584 의 3f856 하나 — 상태 7(덱 · 효과) 뒤 · 시뮬 초기화 3fa0e rand(0, 2) 앞. 이어하기도 같은 길이다.
 */
export function rollSceneStadium(random: RandomPort, stadiumId: number): SceneStadium {
  const stadium = rollStadiumNumber(random, stadiumId)
  const defenseStadium = rollStadiumNumber(random, stadiumId)
  return { stadium, defenseStadium, paletteRow: STADIUM_PALETTE_ROWS[stadiumId] ?? -1 }
}

/** 팔레트 줄 → 그림 칠하기 칸 (−1 기본색 = null). 표 밖 줄은 웹 팔레트에 없어 그리는 쪽이 기본색으로 둔다 */
export function sceneFieldPaletteOf(scene: SceneStadium | null | undefined): number | null {
  if (scene === null || scene === undefined || scene.paletteRow < 0) return null
  return scene.paletteRow
}

/**
 * 표 `0xd377c` — **0x78688(타석 구장, n, 되쓰기)** 의 +0xc 줄 (직접 떴다). 0~9 는 `0xcfd0c` 와 같은 값이다.
 * ```
 * 78690  n ≤ 9 → +0xc = 표[n]  /  그 밖 → +0xc = 표[(s8)구장+0x70]     ; 굴린 구장(0~9)으로 읽으므로 표 밖은 없다
 * 786a8  되쓰기면 st+0x30 = (s8)+0xc                                    ; 팔레트 줄이 st+0x30 에 남는다(원본 그대로 — 웹은 안 쓴다)
 * ```
 * 수비 구장 쪽 **0x788f8** 은 표 `0xd39e4`(0~9 같은 값)와 수비 구장 +0x10 으로 같은 일을 한다.
 */
const PLACED_PALETTE_ROWS: readonly number[] = [-1, 0, 1, 2, 0, -1, -1, 0, 1, 2]

/** 0x78688 의 +0xc — 0x78664 가 넣은(또는 굴린) 구장 +0x70 으로 표 0xd377c 를 읽은 것과 같다 */
export function placedPaletteRowOf(stadium: number): number {
  return PLACED_PALETTE_ROWS[stadium] ?? -1
}

/** 국가대항전 구장 — 남은 단계(L+0xad) > 1(풀리그)이면 2, 그 밖(결승)은 8 (0x3a1a8 · 0x3533c `cmp r3, #1 / ble`) */
export const NATIONAL_CUP_LEAGUE_STADIUM = 2
export const NATIONAL_CUP_FINAL_STADIUM = 8

export function nationalCupStadiumOf(stage: number): number {
  return stage > 1 ? NATIONAL_CUP_LEAGUE_STADIUM : NATIONAL_CUP_FINAL_STADIUM
}

/**
 * **나만의리그 경기 (모드 3·4)** — 경기 장면 셋업 `0x39fdc` 갈래 0x3a0e8 (점프표 0xcfef8[3·4], 직접 떴다):
 * ```
 * 3a10e  S+0x12c(국가대항전) ?
 * 3a190    0x78664([장면+0xf10], (s8)L+0xad > 1 ? 2 : 8)                        ; 대회 — 풀리그 2 · 결승 8
 * 3a1bc  : 0x78664([장면+0xf10], [sp+0x3c] == 1 ? 내 팀 : 상대)                ; 홈(측 1) 팀 = 0xb7844(L, 내 팀)
 * 3a1f4  구장+0x80 · +0x84 = 측 1 · 측 0 팀
 * 3a248~ 0x78688([장면+0xf10], 같은 n, 1) · 0x788f8([장면+0xf14], 같은 n, 1)    ; +0xc = 표 0xd377c · 0xd39e4[n]
 * ```
 * 수비 구장 0x788d4 는 이 갈래에 없다(+0x10 을 안 채운다 — 그리기가 안 읽어 0 으로 둔다).
 * 나리 리그는 열 팀 0~9 라 0x78664 가 굴리지 않고, 대회는 상수 2 · 8 이라 역시 안 굴린다 — **난수 없음**.
 * 경기 준비 0x352e8 은 모드 3·4 면 그 밖 갈래(354be)라 +0xc 를 덮지 않는다 — 그 줄로 바닥 · 수비 바탕을 그린다.
 */
export function nariSceneStadium(homeTeamId: number, nationalCupStage: number | null): SceneStadium {
  const stadium = nationalCupStage === null ? homeTeamId : nationalCupStadiumOf(nationalCupStage)
  return { stadium, defenseStadium: 0, paletteRow: placedPaletteRowOf(stadium) }
}

/**
 * **시즌 국가대항전 경기 (모드 2, SR+0x12c)** — 경기 준비 `0x352e8` 의 모드 2 갈래 35318~3538c (직접 떴다):
 * ```
 * 35320  L+0xac(대회) ?
 * 3533c    n = (s8)L+0xad > 1 ? 2 : 8
 * 35344    0x78664([장면+0xf10], n) · 0x78688(·, n, 1) · 0x788f8([장면+0xf14], n, 1)
 * 3537e    0x76ba4(구장, 0) · 0x786c8(구장, [구장+0xc], 0)                 ; 같은 줄로 바닥을 다시 싣는다
 * ```
 * 장면 셋업 0x39fdc 모드 2 갈래(0x3a3c0)는 구장을 안 건드린다 — 정규 · 포스트시즌 원정은 생성자 값(구장 0 · 줄 −1)이고,
 * 홈경기는 같은 0x352e8 의 시즌 구장 갈래(`seasonStadium`)다. 상수라 **난수 없음**.
 */
export function seasonNationalCupSceneStadium(stage: number): SceneStadium {
  const stadium = nationalCupStadiumOf(stage)
  return { stadium, defenseStadium: 0, paletteRow: placedPaletteRowOf(stadium) }
}

/**
 * **홈런더비 (모드 7)** — 경기 장면 셋업 `0x39fdc` 갈래 0x3a43e (직접 떴다):
 * ```
 * 3a44e  r7 = 내 타자편 팀 ; 3a454 상대 rand(0, 9)
 * 3a476  0x78664([장면+0xf10], r7)        ; > 9 면 rand(0, 10)
 * 3a486  구장+0x80 = +0x84 = r7
 * 3a496  0x788d4([장면+0xf14], r7)        ; > 9 면 rand(0, 10)
 * 3a4e2  0x78688(타석, r7, 1) · 3a4f0 0x788f8(수비, r7, 1)
 * ```
 * 굴림은 상대 rand(0, 9) **뒤** · 시뮬 초기화 rand(0, 2) 앞이다. 팔레트 줄은 0x78688 이 굴린 +0x70 으로 읽는다.
 */
export function rollDerbySceneStadium(random: RandomPort, myTeamId: number): SceneStadium {
  const stadium = rollStadiumNumber(random, myTeamId)
  const defenseStadium = rollStadiumNumber(random, myTeamId)
  return { stadium, defenseStadium, paletteRow: placedPaletteRowOf(stadium) }
}

/**
 * **경기정보 구장 미리보기의 무대** — 시즌 0xdd 진입 0x6548(67dc~6834) · 나리 142 진입 0x1c46c(1c7ae~1c87c) (직접 떴다):
 * ```
 * new(0x94) → 0x76b24          ; 무대
 * 0x78664(무대, 홈 팀)          ; 측 1 팀 — 대표팀(10~13)이면 rand(0, 10)
 * 무대+0x80 · +0x84 = 측 1 · 측 0 팀
 * 0x78688(무대, 홈 팀, 1)       ; +0xc = 표 0xd377c[굴린 구장]
 * 0x5fd04(스킨, 무대)           ; 미리보기 바탕을 떠 둔다 — 그 뒤 무대는 버린다
 * ```
 * 일반모드 22(0x314b0)는 구장이 st+0x30 이고 +0xc 가 표 0xce9d8[st+0x30] 이라 따로다(`generalMatchInfoStage`).
 */
export function placedMatchInfoStadium(stadium: number): { readonly stadium: number; readonly paletteRow: number } {
  return { stadium, paletteRow: placedPaletteRowOf(stadium) }
}

/**
 * 표 `0xce9d8` — 일반모드 22 진입 0x314b0 의 3161a 가 **st+0x30 을 그대로** 첨자로 무대 +0xc 에 넣는다(직접 떴다).
 * 0~9 는 다른 표와 같고 10~14(빠른실행 히든 유저 팀)는 −1 · −1 · 9 · 12 · 15 다(표 열다섯 칸 — 원본 그대로).
 */
const GENERAL_MATCH_INFO_PALETTE_ROWS: readonly number[] = [-1, 0, 1, 2, 0, -1, -1, 0, 1, 2, -1, -1, 9, 12, 15]

/** 일반모드 22 의 무대 — 구장 +0x70 = 0x78664(무대, st+0x30)(굴린 값) · +0xc = 표 0xce9d8[st+0x30] */
export function generalMatchInfoStage(
  rolledStadium: number,
  stadiumId: number,
): { readonly stadium: number; readonly paletteRow: number } {
  return { stadium: rolledStadium, paletteRow: GENERAL_MATCH_INFO_PALETTE_ROWS[stadiumId] ?? -1 }
}
