import { BURST_SOUND } from '@/entities/burst-mission/model/burstMissionJudge'
import type { BurstResolution } from '@/entities/burst-mission/model/burstMissionSession'
import { BURST_START_SOUND, HALF_INNING_SOUND } from '@/features/play-game/model/gameSounds'

/**
 * 경기 **진행**에서 나는 소리 — `features/play-game/model/gameSounds` 의 `gameStepSoundIdsOf`
 * 와 규칙이 같다. 원본은 어느 모드든 같은 경기 장면(0x104)이라 자리도 하나다.
 *
 * ⚠️ 저쪽 함수는 나만의리그 진행기 타입(`GameProgress`)을 받게 돼 있어 팀경기·투수편 진행 상태를
 * 그대로 못 넘긴다. 그래서 **정말로 보는 칸만** 적은 이 모양으로 다시 적었고, 번호는 저쪽 상수를
 * 그대로 가져다 쓴다 — 한쪽을 고치면 다른 쪽도 같이 고쳐야 한다.
 *
 * 근거: docs/re/L-sound-effects.md 1-F · docs/re/R10-game-states.md (상태 0x18) ·
 *       docs/re/K-bursts-special.md 4절.
 */
export interface SoundStepProgress {
  readonly game: {
    readonly half: unknown
    readonly inning: number
    readonly isFinished: boolean
  }
  readonly burst: { readonly current: unknown } | null
  readonly lastBurstResolution: BurstResolution | null
}

/**
 * 진행 한 걸음 사이에 울릴 번호들 — 원본이 나는 순서대로 담는다.
 *
 * 1. **돌발 판정** (0x8f414 → 0x8e5b8): 성공 36 · 실패 32 · 무효 37.
 * 2. **공수 교대** 13 (0x4f7ac): 반 이닝이 바뀌었고 경기가 안 끝났을 때
 *    (R10 2절 — 경기 끝이면 13 대신 결과 징글이 난다).
 * 3. **돌발 발동** 42 (0x8f000): 새 돌발이 떴을 때.
 */
export function stepSoundIdsOf(
  before: SoundStepProgress,
  after: SoundStepProgress,
): readonly number[] {
  const ids: number[] = []

  const resolution = after.lastBurstResolution
  if (resolution !== null && resolution !== before.lastBurstResolution && resolution.judgement !== null) {
    ids.push(BURST_SOUND[resolution.judgement])
  }

  const halfChanged = after.game.half !== before.game.half || after.game.inning !== before.game.inning
  if (halfChanged && !after.game.isFinished) ids.push(HALF_INNING_SOUND)

  if (before.burst?.current == null && after.burst?.current != null) ids.push(BURST_START_SOUND)

  return ids
}

/**
 * **"Time!" 22** — `#` 투수 교체 화면(경기 상태 0xb)에 **들어설 때**.
 *
 * 원본 상태 0xb 진입 `0x3ae08` 은 마지막에 조건 없이 `play(소리, 0x16, -1, 0)` 를 부른다
 * (0x3af06; 상태→진입 함수 표는 docs/re/I-controls.md 1절 "0xb 0x3ae08(교체)").
 * 같은 22 를 트는 다른 자리는 타석 준비 0xf 진입에서 CPU 대타가 걸려 교체 연출 0x16 으로
 * 넘어갈 때(0x3da88)뿐이다 — 웹에는 CPU 대타 연출이 없어 그 쪽은 안 이었다.
 *
 * ⚠️ L 노트가 0x3ae08 을 "경기 중 창" 으로 적어 두었지만 **경기 중 메뉴('\*', 0x3c158)에서는
 *    안 난다** — 0x3c158 이 트는 것은 소리 크기 미리듣기 5 뿐이다 (L 1-F).
 */
export const PITCHER_CHANGE_SOUND = 22
