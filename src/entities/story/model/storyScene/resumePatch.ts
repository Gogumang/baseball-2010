import { EVENT_REWARD_KIND, type EventReward } from '@/entities/story/model/eventReward'
import type { SeasonEndState } from '@/entities/story/model/storyScene/otherSlices'

/** 0x8cc2e 가 가르는 모드 — `0x7b999([mgr+0xb4])`(게임 +0x20 == 2, 시즌모드)와 나리 갈래의 `0x7b971`(== 4, 타자편) */
export type RewardResumeMode = '나리타자' | '나리투수' | '시즌'

/** 보상 명령 뒤 고치는 이어하기 자리 — S+0x50 값과 S+0x12c(국가대항전 중, 463 · 464 만) */
export interface RewardResumePatch {
  /** S+0x50 (나리 0x1c154 · 시즌 0xcb 가 이 값으로 돌아갈 곳을 고른다) */
  readonly resumeCode: number
  /** S+0x12c — 463 은 1, 464 는 0. 그 밖 이벤트는 안 건드린다 */
  readonly nationalCup?: boolean
}

/** 이벤트 번호 구간 [첫, 끝] → 고칠 자리 */
type ResumePatchRow = readonly [first: number, last: number, patchOf: (mode: RewardResumeMode) => RewardResumePatch]

/** 시즌 갈래 (0x7b999 참, 8ccc8~8cd42 — S = SR) */
const SEASON_RESUME_PATCHES: readonly ResumePatchRow[] = [
  [372, 373, () => ({ resumeCode: 0xd })],
  [374, 375, () => ({ resumeCode: 0xe })],
  [378, 379, () => ({ resumeCode: 0x10 })],
  [393, 396, () => ({ resumeCode: 0xc })],
  [401, 403, () => ({ resumeCode: 0xf })],
]

/** 나리 갈래 (0x7b999 거짓, 8cc32~8ccc6) — 393~396 은 0x7b971(타자편)로 갈린다 */
const NARI_RESUME_PATCHES: readonly ResumePatchRow[] = [
  [371, 374, () => ({ resumeCode: 0xe })],
  [377, 377, () => ({ resumeCode: 0xf })],
  [393, 396, (mode) => ({ resumeCode: mode === '나리타자' ? 0xc : 0xd })],
  [463, 463, () => ({ resumeCode: 3, nationalCup: true })],
  [464, 464, () => ({ resumeCode: 0x11, nationalCup: false })],
]

/**
 * **보상 명령 뒤 이벤트 번호로 이어하기 자리를 고친다** — 0x8c460 끝 8cc1e~8cd42 (직접 떴다). 0x8b0e4 저장 뒤 지금 이벤트
 * 번호(0xacb61([mgr+4]))로 S = [mgr+0x2f8] 의 +0x50 을 쓰고, 갈래와 상관없이 8cd44 에서 `0x1fded · 0x22755(…, 1) · 0x1f1b9`
 * (전역기록 game_o.sav) 로 **한 번 더 저장한다**. 고치는 번호가 아니어도 저장은 한다.
 * ```
 * 나리(0x7b999 거짓, 8cc32~8ccc6)                    시즌(0x7b999 참, 8ccc8~8cd42 — S = SR)
 *   371~374 → 0xe                                     372 · 373 → 0xd       374 · 375 → 0xe
 *   377     → 0xf                                     378 · 379 → 0x10      393~396  → 0xc
 *   393~396 → 0x7b971(타자편) ? 0xc : 0xd              401~403  → 0xf
 *   463     → 3 · S+0x12c = 1
 *   464     → 0x11 · S+0x12c = 0
 * ```
 * 곧 시즌 끝 사슬의 결과 이벤트가 보상을 주면 이어하기 자리가 **다음 상태**로 넘어간다 — 나리 393~396(136 의 결과) → 130,
 * 371~374(130) → 131, 377(131) → 128 (0x1c154: 0xc|0xd → 130 · 0xe → 131 · 0xf → 그 밖 갈래 128), 시즌 393~396(0xee) → 0xeb ·
 * 373(0xeb) → 0xec · 375(0xec) → 0xed · 379(0xed) → 0xf0 · 401~403(0xf0) → 0xf(결산). 보상 창을 띄운 채 끄고 이어해도 그 결과
 * 이벤트를 다시 틀지 않는다(보상이 겹치지 않는다). 보상이 없는 결과 이벤트(나리 371 · 376, 시즌 372 · 374 · 378 · 395)는
 * 0x8c460 이 안 돌아 그대로다 — 끄고 이어하면 그 상태가 이벤트를 다시 튼다(보상이 없어 겹칠 것도 없다).
 * 463(출전) · 464(거절)는 461 의 선택지 결과다 — 3 · S+0x12c 면 0x1c154 그 밖 갈래가 134 대진판, 0x11 이면 1c25e 새 시즌 0x1b768.
 * 시즌 갈래는 463 · 464 를 안 본다(시즌 461 은 선택지가 없다 — s_event).
 */
export function rewardResumePatchOf(eventId: number, mode: RewardResumeMode): RewardResumePatch | null {
  const rows = mode === '시즌' ? SEASON_RESUME_PATCHES : NARI_RESUME_PATCHES
  const row = rows.find(([first, last]) => eventId >= first && eventId <= last)
  return row === undefined ? null : row[2](mode)
}

/** 보상 20(연봉)이 쓰는 S+0x50 — 0x8cac0 갈래 끝 8cb84~8cb92: 새 연봉을 `0xa4fd9(S, 값)` 로 쓰고 곧 `S+0x50 = 0xa` */
export const SALARY_REWARD_RESUME_CODE = 0xa

/**
 * **보상 명령의 줄이 쓰는 이어하기 자리** — 0x8c460 이 줄마다 갈래를 돌 때 종류 20(연봉, 0x8cac0)만 S+0x50 을 쓴다(0xa,
 * 8cb90 — 바이너리 전체의 `str rX,[rY,#0x50]` 앞 `movs rX,#0xa` 를 훑어 이 자리 하나뿐이다). 이 값은 줄을 다 돈 뒤 8cc2e 가 이벤트 번호로 다시
 * 고칠 수 있다(`rewardResumePatchOf` — 연봉 결과 384~391 은 그 목록에 없어 0xa 가 남는다). 연봉 줄이 없으면 null.
 */
export function rewardItemsResumeCodeOf(items: readonly EventReward[]): number | null {
  return items.some((item) => item.kind === EVENT_REWARD_KIND.연봉) ? SALARY_REWARD_RESUME_CODE : null
}

/** 나리 S+0x50 값 → 돌아갈 상태 (0x1c154 · 연봉 뒤 갈래 1c2a2) */
const NARI_SEASON_END_STATE_OF_RESUME_CODE: ReadonlyMap<number, SeasonEndState> = new Map<number, SeasonEndState>([
  [SALARY_REWARD_RESUME_CODE, 133],
  [0xc, 130],
  [0xd, 130],
  [0xe, 131],
  [0xf, 128],
  [0x11, 137],
])

/**
 * 나리 S+0x50 값 → 웹 `seasonEndState` (상태 번호). 0x1c154 가 그 값으로 돌아가는 상태다 — 0xc|0xd 130 · 0xe 131 · 0xf 128 ·
 * 0x11 새 시즌 0x1b768(→ 137) · 0xa 연봉 뒤 갈래(→ 133, 1c2a2 — `resumePointOf`). 3 은 웹이 null 로 든다(그 밖 갈래).
 */
export function nariSeasonEndStateOfResumeCode(resumeCode: number): SeasonEndState | null {
  return NARI_SEASON_END_STATE_OF_RESUME_CODE.get(resumeCode) ?? null
}
