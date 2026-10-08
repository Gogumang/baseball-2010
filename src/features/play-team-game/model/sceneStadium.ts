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
